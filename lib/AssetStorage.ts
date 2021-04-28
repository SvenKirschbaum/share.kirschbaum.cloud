import * as cdk from '@aws-cdk/core';
import {
  BlockPublicAccess, Bucket, BucketEncryption, HttpMethods,
} from '@aws-cdk/aws-s3';
import { Duration } from '@aws-cdk/core';
import { S3Origin } from '@aws-cdk/aws-cloudfront-origins';
import {
  BehaviorOptions,
  CachePolicy,
  KeyGroup,
  OriginRequestCookieBehavior,
  OriginRequestPolicy, OriginRequestQueryStringBehavior,
  PublicKey,
  ViewerProtocolPolicy,
} from '@aws-cdk/aws-cloudfront';
import { ISecret, Secret } from '@aws-cdk/aws-secretsmanager';
import { AssetStorageProps } from './interfaces/AssetStorageProps';

export default class AssetStorage extends cdk.Construct {
  public additionalBehaviors = new Map<string, BehaviorOptions>();

  public publicKeyId: string;

  public privateKeySecret: ISecret;

  public fileShareBucket: Bucket;

  constructor(scope: cdk.Construct, id: string, props: AssetStorageProps) {
    super(scope, id);

    this.fileShareBucket = new Bucket(this, 'Bucket', {
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

    const publicKey = Secret.fromSecretNameV2(this, 'PublicKeySecret', props.publicKeySecretName);
    this.privateKeySecret = Secret.fromSecretNameV2(this, 'PrivateKeySecret', props.privateKeySecretName);

    const pubKey = new PublicKey(this, 'PublicKey', {
      encodedKey: publicKey.secretValue.toString(),
    });
    this.publicKeyId = pubKey.publicKeyId;

    const keyGroup = new KeyGroup(this, 'KeyGroup', {
      items: [
        pubKey,
      ],
    });

    const fileShareOrigin = new S3Origin(this.fileShareBucket);

    this.additionalBehaviors.set('/a/*', {
      origin: fileShareOrigin,
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      originRequestPolicy: new OriginRequestPolicy(this, 'OriginRequestPolicy', {
        cookieBehavior: OriginRequestCookieBehavior.none(),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
      }),
      trustedKeyGroups: [keyGroup],
    });
  }
}
