import {
  CfnOutput, Duration, RemovalPolicy, Stack, StackProps, Token,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  CachePolicy,
  Distribution,
  experimental,
  HttpVersion,
  LambdaEdgeEventType,
  OriginAccessIdentity,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import DefaultResponseHeadersPolicy from './util/DefaultResponseHeadersPolicy';
import { Bundling } from './util/bundling/Bundling';
import {DelegationOptions} from "./interfaces/DelegationOptions";
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";
import {RecordType} from "aws-cdk-lib/aws-route53";
import {DnsValidatedCertificate} from "@trautonen/cdk-dns-validated-certificate";
import {Role} from "aws-cdk-lib/aws-iam";

export interface ShareFrontendStackProps extends StackProps {
    frontendDomain?: string,
    apiDomain: string,
    keycloakUrl: string;
    keycloakRealm: string;
    keycloakClientId: string;
    disableEmail: boolean;
    delegation?: DelegationOptions
    logBucket: Bucket,
    storageBucket: Bucket,
    table: Table
}

export default class ShareFrontendStack extends Stack {
  private frontendBucket: Bucket;

  private distribution: Distribution;

  private responseHeadersPolicy: DefaultResponseHeadersPolicy;

  constructor(scope: Construct, id: string, props: ShareFrontendStackProps) {
    super(scope, id, props);
    this.createBucket(
      props.apiDomain,
      props.keycloakUrl,
      props.keycloakRealm,
      props.keycloakClientId,
      props.disableEmail,
    );
    this.createDistribution(props.logBucket, props.frontendDomain, props.delegation);
    this.createAssetAccessResources(
      props.storageBucket,
      props.table,
    );
  }

  private createBucket(
    apiDomain: string,
    keycloakUrl: string,
    keycloakRealm: string,
    keycloakClientId: string,
    disableEmail: boolean,
  ) {
    this.frontendBucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
    });

    new BucketDeployment(this, 'FrontendDeployment', {
      destinationBucket: this.frontendBucket,
      // Exclude config Deployment files from sync, to prevent them from beeing deleted
      exclude: ['index.html', 'config.json'],
      sources: [
        Source.asset('./frontend/build', {
          // Exclude files from bundling
          exclude: ['*.map', 'config.json', 'index.html', 'asset-manifest.json'],
        }),
      ],
      cacheControl: [
        CacheControl.fromString('public, max-age=31536000, immutable'),
      ],
    });

    // Workaround for Cross Stack References
    // See: https://github.com/aws/aws-cdk/issues/19257
    let parameter;
    if (Token.isUnresolved(apiDomain)) {
      parameter = new ssm.StringParameter(this, 'ApiDomainParameter', {
        stringValue: apiDomain,
      });
    }

    new BucketDeployment(this, 'ConfigDeployment', {
      destinationBucket: this.frontendBucket,
      // Exclude everything not related to this deployment to prevent other files from being deleted
      exclude: ['*'],
      include: ['index.html', 'config.json'],
      sources: [
        Source.asset('./frontend/build', {
          // Bundle only index.html
          exclude: ['*', '!index.html'],
        }),
        Source.jsonData('config.json', {
          API_URL: `https://${parameter?.stringValue ?? apiDomain}`,
          EMAIL_DISABLED: disableEmail,
          KEYCLOAK: {
            url: keycloakUrl,
            realm: keycloakRealm,
            clientId: keycloakClientId,
          },
        }),
      ],
      cacheControl: [
        CacheControl.fromString('public, max-age=300'),
      ],
    });
  }

  private createDistribution(logBucket: Bucket, domain?: string, delegation?: DelegationOptions) {
    let certificate;
    if (domain && delegation) {
      const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: delegation.parentZoneId,
        zoneName: domain
      })
      certificate = new DnsValidatedCertificate(this, 'DistributionCertificate', {
        hostedZone: hostedZone,
        domainName: domain,
        validationRole: Role.fromRoleArn(this, 'CertificateValidationRole', 'arn:aws:iam::' + delegation.accountId + ':role/' +delegation.roleName, {
          mutable: false
        }),
        certificateRegion: 'us-east-1'
      })
    }

    // This is required, as the automatically created OAI will not include List permissions,
    // causing requests to non existing objects to return 403 instead of 404
    const originAccessIdentity = new OriginAccessIdentity(this, 'OriginAccessIdentity');
    this.frontendBucket.grantRead(originAccessIdentity);

    const origin = new S3Origin(this.frontendBucket, {
      originAccessIdentity,
    });
    this.responseHeadersPolicy = new DefaultResponseHeadersPolicy(this, 'ResponseHeaderPolicy', {});

    this.distribution = new Distribution(this, 'Distribution', {
      certificate,
      domainNames: domain ? [domain] : undefined,
      defaultRootObject: 'index.html',

      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],

      defaultBehavior: {
        responseHeadersPolicy: this.responseHeadersPolicy,
        origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new CachePolicy(this, 'DefaultCachePolicy', {
          minTtl: Duration.seconds(1),
          defaultTtl: Duration.days(365),
          maxTtl: Duration.days(365),
        }),
      },

      logBucket,
      enableLogging: true,

      httpVersion: HttpVersion.HTTP2_AND_3,
    });

    if (domain && delegation) {
      new CrossAccountRoute53RecordSet(this, 'DNSRecords', {
        delegationRoleName: delegation.roleName,
        delegationRoleAccount: delegation.accountId,
        hostedZoneId: delegation.parentZoneId,
        resourceRecordSets: [
          {
            Name: domain,
            Type: RecordType.A,
            AliasTarget: {
              DNSName: this.distribution.distributionDomainName,
              HostedZoneId: 'Z2FDTNDATAQYW2', // Cloudfront Hosted Zone ID
              EvaluateTargetHealth: false,
            },
          },
          {
            Name: domain,
            Type: RecordType.AAAA,
            AliasTarget: {
              DNSName: this.distribution.distributionDomainName,
              HostedZoneId: 'Z2FDTNDATAQYW2', // Cloudfront Hosted Zone ID
              EvaluateTargetHealth: false,
            },
          }
        ],
      });
    }

    new CfnOutput(this, 'FrontendDomain', {
      value: domain ?? this.distribution.distributionDomainName,
    });
  }

  private createAssetAccessResources(
    storageBucket: Bucket,
    table: Table,
  ) {
    const forwardFunction = new experimental.EdgeFunction(this, 'ForwardShare', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: Bundling.bundle(this, {
        entry: path.resolve('lambda/src/functions/forwardShare.ts'),
        runtime: Runtime.NODEJS_20_X,
        architecture: Architecture.X86_64,
        depsLockFilePath: path.resolve('lambda/package-lock.json'),
        projectRoot: path.resolve('lambda/'),
      }),
    });
    table.grantReadData(forwardFunction);

    this.distribution.addBehavior(
      '/d/*',
      new S3Origin(storageBucket, {
        // Workaround, as Lambda@Edge does not support environment variables
        customHeaders: {
          'x-table-name': table.tableName,
          'x-table-region': Stack.of(this).region,
        },
      }),
      {
        responseHeadersPolicy: this.responseHeadersPolicy,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: new OriginRequestPolicy(this, 'AssetOriginRequestPolicy', {
          queryStringBehavior: OriginRequestQueryStringBehavior.all(),
        }),
        edgeLambdas: [{
          eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          functionVersion: forwardFunction.currentVersion,
        }],
      },
    );
  }
}
