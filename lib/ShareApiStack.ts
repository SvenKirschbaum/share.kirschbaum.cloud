import {
  CfnOutput,
  Duration, Fn, Stack, StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CorsHttpMethod,
  HttpApi, HttpMethod, HttpStage,
} from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpJwtAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import { HostedZone } from 'aws-cdk-lib/aws-route53/lib/hosted-zone';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { AaaaRecord, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
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

export interface ShareApiStackProps extends StackProps {
    apiDomain?: string,
    emailDomain?: string,
    jwtIssuerUrl: string,
    jwtAudience: string,
    zone?: HostedZone,
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
    this.createCustomDomain(props.apiDomain, props.zone);
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

  private createCustomDomain(domain?: string, zone?: HostedZone) {
    let certificate;
    if (domain && zone) {
      certificate = new acm.DnsValidatedCertificate(this, 'DistributionCertificate', {
        domainName: domain,
        hostedZone: zone,
        region: 'us-east-1',
      });
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
      httpVersion: HttpVersion.HTTP2_AND_3
    });

    if (domain && zone) {
      new ARecord(this, 'ARecord', {
        zone,
        recordName: domain,
        target: RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      });

      new AaaaRecord(this, 'AAAARecord', {
        zone,
        recordName: domain,
        target: RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
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
      entry: 'lambda/nodejs/src/functions/addShare/index.ts',
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
      entry: 'lambda/nodejs/src/functions/completeUpload/index.ts',
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
      entry: 'lambda/nodejs/src/functions/listShares/index.ts',
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
      entry: 'lambda/nodejs/src/functions/deleteShare/index.ts',
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
      entry: 'lambda/nodejs/src/functions/fullfillShareRequest/index.ts',
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
