import { Duration, Fn } from 'aws-cdk-lib';
import { HttpApi, HttpMethod, HttpStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import { AttributeType, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { HttpJwtAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import { DynamoEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AllowedMethods,
  BehaviorOptions,
  CacheHeaderBehavior,
  CachePolicy,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import DefaultNodejsFunction from './lambda/DefaultNodejsFunction';
import { ApiProps } from './interfaces/ApiProps';

export default class Api extends Construct {
  public additionalBehaviors:Record<string, BehaviorOptions> = {};

  public readonly table: Table;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.table = new Table(this, 'Table', {
      partitionKey: {
        name: 'PK',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: AttributeType.STRING,
      },
      readCapacity: 1,
      writeCapacity: 1,
      timeToLiveAttribute: 'expire',
      stream: StreamViewType.OLD_IMAGE,
    });

    this.table.addGlobalSecondaryIndex({
      partitionKey: {
        name: 'user',
        type: AttributeType.STRING,
      },
      indexName: 'user-index',
      writeCapacity: 1,
      readCapacity: 1,
    });

    const api = new HttpApi(this, 'Api', {
      createDefaultStage: false,
    });

    new HttpStage(this, 'Stage', {
      httpApi: api,
      autoDeploy: true,
      stageName: 'api',
    });

    const authorizer = new HttpJwtAuthorizer('jwtAuthorizer', props.jwtIssuerUrl, {
      jwtAudience: [props.jwtAudience],
    });

    const defaultLambdaEnvironment = {
      TABLE_NAME: this.table.tableName,
      FILE_BUCKET: props.fileBucket.bucketName,
      DOMAIN: props.domain,
    };

    // Filedeletion
    const deadLetterQueue = new Queue(this, 'deletionDeadLetterQueue');
    const onShareDeletionFunction = new DefaultNodejsFunction(this, 'onShareDeletion', {
      entry: 'lambda/nodejs/src/functions/onShareDeletion/index.ts',
      environment: defaultLambdaEnvironment,
    });
    props.fileBucket.grantDelete(onShareDeletionFunction);
    this.table.grantReadWriteData(onShareDeletionFunction);
    onShareDeletionFunction.addEventSource(new DynamoEventSource(this.table, {
      startingPosition: StartingPosition.LATEST,
      onFailure: new SqsDlq(deadLetterQueue),
      bisectBatchOnError: true,
      enabled: true,
    }));

    this.additionalBehaviors['/api/*'] = {
      origin: new HttpOrigin(Fn.select(2, Fn.split('/', api.apiEndpoint))),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: AllowedMethods.ALLOW_ALL,
      cachePolicy: new CachePolicy(this, 'ApiCachePolicy', {
        minTtl: Duration.seconds(0),
        defaultTtl: Duration.seconds(0),
        maxTtl: Duration.seconds(1),
        headerBehavior: CacheHeaderBehavior.allowList('Authorization'),
      }),
      originRequestPolicy: new OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
        headerBehavior: OriginRequestHeaderBehavior.none(),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
        cookieBehavior: OriginRequestCookieBehavior.none(),
      }),
    };

    this.additionalBehaviors['/d/*'] = {
      origin: new HttpOrigin(Fn.select(2, Fn.split('/', api.apiEndpoint)), {
        originPath: '/api',
      }),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new CachePolicy(this, 'LinkCachePolicy', {
        maxTtl: Duration.days(1),
        defaultTtl: Duration.seconds(60),
        minTtl: Duration.seconds(60),
      }),
    };

    // Routes

    const addShareFunction = new DefaultNodejsFunction(this, 'AddShare', {
      entry: 'lambda/nodejs/src/functions/addShare/index.ts',
      environment: defaultLambdaEnvironment,
      timeout: Duration.seconds(15),
    });
    this.table.grantWriteData(addShareFunction);
    props.fileBucket.grantPut(addShareFunction);

    api.addRoutes({
      path: '/add',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('addShareIntegration', addShareFunction),
      authorizer,
    });

    const completeUploadFunction = new DefaultNodejsFunction(this, 'CompleteUpload', {
      entry: 'lambda/nodejs/src/functions/completeUpload/index.ts',
      environment: defaultLambdaEnvironment,
      timeout: Duration.seconds(15),
    });
    this.table.grantReadWriteData(completeUploadFunction);
    props.fileBucket.grantPut(completeUploadFunction);

    const completeUploadIntegration = new HttpLambdaIntegration('completeUploadIntegration', completeUploadFunction);

    api.addRoutes({
      path: '/completeUpload/{id}',
      methods: [HttpMethod.POST],
      integration: completeUploadIntegration,
      authorizer,
    });

    api.addRoutes({
      path: '/public/completeUpload/{id}',
      methods: [HttpMethod.POST],
      integration: completeUploadIntegration,
    });

    const listSharesFunction = new DefaultNodejsFunction(this, 'ListShares', {
      entry: 'lambda/nodejs/src/functions/listShares/index.ts',
      environment: defaultLambdaEnvironment,
    });
    this.table.grantReadData(listSharesFunction);

    api.addRoutes({
      path: '/list',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('listSharesIntegration', listSharesFunction),
      authorizer,
    });

    const deleteShareFunction = new DefaultNodejsFunction(this, 'DeleteShare', {
      entry: 'lambda/nodejs/src/functions/deleteShare/index.ts',
      environment: defaultLambdaEnvironment,
    });
    this.table.grantWriteData(deleteShareFunction);

    api.addRoutes({
      path: '/share/{id}',
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('deleteShareIntegration', deleteShareFunction),
      authorizer,
    });

    const forwardShareFunction = new DefaultNodejsFunction(this, 'ForwardShare', {
      entry: 'lambda/nodejs/src/functions/forwardShare/index.ts',
      environment: {
        ...defaultLambdaEnvironment,
        KEY_ID: props.fileShareKeyId,
        KEY_SECRET: props.fileShareKeySecret.secretName,
      },
    });
    this.table.grantReadData(forwardShareFunction);
    props.fileShareKeySecret.grantRead(forwardShareFunction);

    api.addRoutes({
      path: '/d/{id}',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('forwardShareIntegration', forwardShareFunction),
    });

    const fullfillShareRequestFunction = new DefaultNodejsFunction(this, 'FullfillShareRequest', {
      entry: 'lambda/nodejs/src/functions/fullfillShareRequest/index.ts',
      environment: defaultLambdaEnvironment,
    });
    this.table.grantReadWriteData(fullfillShareRequestFunction);
    props.fileBucket.grantPut(fullfillShareRequestFunction);

    api.addRoutes({
      path: '/public/request/{id}',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: new HttpLambdaIntegration('fullfillShareRequestIntegration', fullfillShareRequestFunction),
    });
  }
}
