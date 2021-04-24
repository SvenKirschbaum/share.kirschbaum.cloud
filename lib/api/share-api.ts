import * as cdk from '@aws-cdk/core';
import { Duration } from '@aws-cdk/core';
import { HttpApi, HttpMethod, HttpStage } from '@aws-cdk/aws-apigatewayv2';
import { AttributeType, StreamViewType, Table } from '@aws-cdk/aws-dynamodb';
import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers';
import {
  BlockPublicAccess, Bucket, BucketEncryption, HttpMethods,
} from '@aws-cdk/aws-s3';
import { DynamoEventSource, SqsDlq } from '@aws-cdk/aws-lambda-event-sources';
import { Queue } from '@aws-cdk/aws-sqs';
import { StartingPosition } from '@aws-cdk/aws-lambda';
import DefaultNodejsFunction from './DefaultNodejsFunction';
import ApiDistributionBehavior from './ApiDistributionBehavior';
import { ShareApiProps } from '../interfaces/share-api-props';

export default class ShareApi extends cdk.Construct {
    apiEndpoint: string;

    constructor(scope: cdk.Construct, id: string, props: ShareApiProps) {
      super(scope, id);

      const table = new Table(this, 'ShareTable', {
        partitionKey: {
          name: 'id',
          type: AttributeType.STRING,
        },
        readCapacity: 1,
        writeCapacity: 1,
        timeToLiveAttribute: 'expire',
        stream: StreamViewType.OLD_IMAGE,
      });

      table.addGlobalSecondaryIndex({
        partitionKey: {
          name: 'user',
          type: AttributeType.STRING,
        },
        indexName: 'user-index',
        writeCapacity: 1,
        readCapacity: 1,
      });

      const fileShareBucket = new Bucket(this, 'FileShareBucket', {
        encryption: BucketEncryption.S3_MANAGED,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        cors: [
          {
            allowedMethods: [HttpMethods.PUT],
            allowedOrigins: ['*'],
            exposedHeaders: ['ETag'],
          },
        ],
        lifecycleRules: [
          {
            abortIncompleteMultipartUploadAfter: Duration.days(1),
          },
        ],
      });

      const api = new HttpApi(this, 'BackendApi', {
        createDefaultStage: false,
      });
      this.apiEndpoint = api.apiEndpoint;

      new HttpStage(this, 'BackendStage', {
        httpApi: api,
        autoDeploy: true,
        stageName: 'api',
      });

      const authorizer = new HttpJwtAuthorizer({
        jwtAudience: ['cloud-share-backend'],
        jwtIssuer: props.jwtIssuerUrl,
      });

      const assetDistributionBehavior = new ApiDistributionBehavior(this, 'AssetDistribution', {
        bucket: fileShareBucket,
        distribution: props.distribution,
        privateKeySecretName: props.privateKeySecretName,
        publicKeySecretName: props.publicKeySecretName,
        api,
      });

      const defaultLambdaEnvironment = {
        TABLE_NAME: table.tableName,
        KEY_ID: assetDistributionBehavior.publicKeyId,
        KEY_SECRET: assetDistributionBehavior.privateKey.secretName,
        FILE_BUCKET: fileShareBucket.bucketName,
        DOMAIN: props.domain,
      };

      // Filedeletion
      const deadLetterQueue = new Queue(this, 'deadLetterQueue');
      const onShareDeletionFunction = new DefaultNodejsFunction(this, 'onShareDeletionFunction', {
        entry: 'lambda/nodejs/src/functions/onShareDeletion/index.ts',
        environment: defaultLambdaEnvironment,
      });
      fileShareBucket.grantDelete(onShareDeletionFunction);
      onShareDeletionFunction.addEventSource(new DynamoEventSource(table, {
        startingPosition: StartingPosition.LATEST,
        onFailure: new SqsDlq(deadLetterQueue),
        bisectBatchOnError: true,
        enabled: true,
      }));

      const addShareFunction = new DefaultNodejsFunction(this, 'AddShareFunction', {
        entry: 'lambda/nodejs/src/functions/addShare/index.ts',
        environment: defaultLambdaEnvironment,
        timeout: Duration.seconds(15),
      });
      table.grantWriteData(addShareFunction);
      fileShareBucket.grantPut(addShareFunction);

      api.addRoutes({
        path: '/add',
        methods: [HttpMethod.POST],
        integration: new LambdaProxyIntegration({
          handler: addShareFunction,
        }),
        authorizer,
      });

      const completeUploadFunction = new DefaultNodejsFunction(this, 'CompleteUploadFunction', {
        entry: 'lambda/nodejs/src/functions/completeUpload/index.ts',
        environment: defaultLambdaEnvironment,
        timeout: Duration.seconds(15),
      });
      table.grantReadWriteData(completeUploadFunction);
      fileShareBucket.grantPut(completeUploadFunction);

      api.addRoutes({
        path: '/completeUpload/{id}',
        methods: [HttpMethod.POST],
        integration: new LambdaProxyIntegration({
          handler: completeUploadFunction,
        }),
        authorizer,
      });

      const listSharesFunction = new DefaultNodejsFunction(this, 'ListSharesFunction', {
        entry: 'lambda/nodejs/src/functions/listShares/index.ts',
        environment: defaultLambdaEnvironment,
      });
      table.grantReadData(listSharesFunction);

      api.addRoutes({
        path: '/list',
        methods: [HttpMethod.GET],
        integration: new LambdaProxyIntegration({
          handler: listSharesFunction,
        }),
        authorizer,
      });

      const deleteShareFunction = new DefaultNodejsFunction(this, 'DeleteShareFunction', {
        entry: 'lambda/nodejs/src/functions/deleteShare/index.ts',
        environment: defaultLambdaEnvironment,
      });
      table.grantWriteData(deleteShareFunction);

      api.addRoutes({
        path: '/share/{id}',
        methods: [HttpMethod.DELETE],
        integration: new LambdaProxyIntegration({
          handler: deleteShareFunction,
        }),
        authorizer,
      });

      const forwardShareFunction = new DefaultNodejsFunction(this, 'ForwardShareFunction', {
        entry: 'lambda/nodejs/src/functions/forwardShare/index.ts',
        environment: defaultLambdaEnvironment,
      });
      table.grantReadData(forwardShareFunction);
      assetDistributionBehavior.privateKey.grantRead(forwardShareFunction);

      api.addRoutes({
        path: '/d/{id}',
        methods: [HttpMethod.GET],
        integration: new LambdaProxyIntegration({
          handler: forwardShareFunction,
        }),
      });
    }
}
