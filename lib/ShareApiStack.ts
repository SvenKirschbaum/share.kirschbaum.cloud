import {
  CfnOutput,
  Duration, Fn, Stack, StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CorsHttpMethod,
  HttpApi, HttpMethod, HttpStage,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import {HostedZone, RecordType} from 'aws-cdk-lib/aws-route53';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import {
  AllowedMethods,
  CacheHeaderBehavior,
  CachePolicy,
  Distribution, HttpVersion,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import DefaultNodejsFunction from './util/DefaultNodejsFunction';
import {DelegationOptions} from "./interfaces/DelegationOptions";
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";
import {DnsValidatedCertificate} from "@trautonen/cdk-dns-validated-certificate";
import {Role} from "aws-cdk-lib/aws-iam";

export interface ShareApiStackProps extends StackProps {
    apiDomain?: string,
    emailDomain?: string,
    jwtIssuerUrl: string,
    jwtAudience: string,
    delegation?: DelegationOptions
    table: Table,
    storageBucket: Bucket
}

export default class ShareApiStack extends Stack {
  public api: HttpApi;

  private authorizer: HttpJwtAuthorizer;

  public distribution: Distribution;

  constructor(scope: Construct, id: string, props: ShareApiStackProps) {
    super(scope, id, props);
    this.createApi(props.jwtIssuerUrl, props.jwtAudience);
    this.createCustomDomain(props.apiDomain, props.delegation);
    this.createApiRoutes(props.table, props.storageBucket, props.emailDomain);
  }

  private createApi(jwtIssuerUrl: string, jwtAudience: string) {
    this.api = new HttpApi(this, 'Api', {
      createDefaultStage: false,
      disableExecuteApiEndpoint: false,
      corsPreflight: {
        allowHeaders: [
          'Content-Type',
          'Authorization',
        ],
        allowMethods: [CorsHttpMethod.ANY],
        allowOrigins: ['*'],
        maxAge: Duration.days(1),
      },
    });

    new HttpStage(this, 'DefaultStage', {
      httpApi: this.api,
      autoDeploy: true,
      stageName: '$default',
    });

    this.authorizer = new HttpJwtAuthorizer('JwtAuthorizer', jwtIssuerUrl, {
      jwtAudience: [jwtAudience],
    });
  }

  private createCustomDomain(domain?: string, delegation?: DelegationOptions) {
    let certificate;
    if (domain && delegation) {
      const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: delegation.parentZoneId,
        zoneName: domain
      })
      certificate = new DnsValidatedCertificate(this, 'Certificate', {
        validationHostedZones: [{
            hostedZone: hostedZone,
            validationRole: Role.fromRoleArn(this, 'CertificateValidationRole', 'arn:aws:iam::' + delegation.accountId + ':role/' +delegation.roleName, {
              mutable: false
            })
        }],
        domainName: domain,
        certificateRegion: 'us-east-1'
      })
    }

    this.distribution = new Distribution(this, 'Distribution', {
      certificate,
      domainNames: domain ? [domain] : undefined,
      defaultBehavior: {
        origin: new HttpOrigin(Fn.select(2, Fn.split('/', this.api.apiEndpoint))),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: new CachePolicy(this, 'CachePolicy', {
          minTtl: Duration.seconds(0),
          defaultTtl: Duration.seconds(0),
          maxTtl: Duration.seconds(1),
          headerBehavior: CacheHeaderBehavior.allowList('Authorization', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'),
        }),
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
    });

    if (domain && delegation) {
      new CrossAccountRoute53RecordSet(this, 'DNSRecords', {
        delegationRoleName: delegation.roleName,
        delegationRoleAccount:delegation.accountId,
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

    new CfnOutput(this, 'ApiDomain', {
      value: domain ?? this.distribution.distributionDomainName,
    });
  }

  private createApiRoutes(table: Table, storageBucket: Bucket, emailDomain?: string) {
    const defaultLambdaEnvironment: {[p: string]: string} = {
      TABLE_NAME: table.tableName,
      FILE_BUCKET: storageBucket.bucketName,
      POWERTOOLS_SERVICE_NAME: 'share-api',
    };

    if (emailDomain) {
      defaultLambdaEnvironment.EMAIL_DOMAIN = emailDomain;
    }

    const addShareFunction = new DefaultNodejsFunction(this, 'AddShare', {
      entry: 'lambda/src/functions/addShare.ts',
      environment: defaultLambdaEnvironment,
      timeout: Duration.seconds(15),
    });
    table.grantWriteData(addShareFunction);
    storageBucket.grantPut(addShareFunction);

    this.api.addRoutes({
      path: '/add',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('addShareIntegration', addShareFunction),
      authorizer: this.authorizer,
    });

    const completeUploadFunction = new DefaultNodejsFunction(this, 'CompleteUpload', {
      entry: 'lambda/src/functions/completeUpload.ts',
      environment: defaultLambdaEnvironment,
      timeout: Duration.seconds(15),
    });
    table.grantReadWriteData(completeUploadFunction);
    storageBucket.grantPut(completeUploadFunction);
    completeUploadFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendBulkEmail', 'ses:SendBulkTemplatedEmail'],
      resources: ['*'],
      effect: iam.Effect.ALLOW,
    }));

    const completeUploadIntegration = new HttpLambdaIntegration('completeUploadIntegration', completeUploadFunction);

    this.api.addRoutes({
      path: '/completeUpload/{id}',
      methods: [HttpMethod.POST],
      integration: completeUploadIntegration,
      authorizer: this.authorizer,
    });

    this.api.addRoutes({
      path: '/public/completeUpload/{id}',
      methods: [HttpMethod.POST],
      integration: completeUploadIntegration,
    });

    const listSharesFunction = new DefaultNodejsFunction(this, 'ListShares', {
      entry: 'lambda/src/functions/listShares.ts',
      environment: defaultLambdaEnvironment,
    });
    table.grantReadData(listSharesFunction);

    this.api.addRoutes({
      path: '/list',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('listSharesIntegration', listSharesFunction),
      authorizer: this.authorizer,
    });

    const deleteShareFunction = new DefaultNodejsFunction(this, 'DeleteShare', {
      entry: 'lambda/src/functions/deleteShare.ts',
      environment: defaultLambdaEnvironment,
    });
    table.grantWriteData(deleteShareFunction);

    this.api.addRoutes({
      path: '/share/{id}',
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('deleteShareIntegration', deleteShareFunction),
      authorizer: this.authorizer,
    });

    const fullfillShareRequestFunction = new DefaultNodejsFunction(this, 'FullfillShareRequest', {
      entry: 'lambda/src/functions/fullfillShareRequest.ts',
      environment: defaultLambdaEnvironment,
    });
    table.grantReadWriteData(fullfillShareRequestFunction);
    storageBucket.grantPut(fullfillShareRequestFunction);

    this.api.addRoutes({
      path: '/public/request/{id}',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: new HttpLambdaIntegration('fullfillShareRequestIntegration', fullfillShareRequestFunction),
    });
  }
}
