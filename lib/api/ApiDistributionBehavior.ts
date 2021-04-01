import { Construct, Duration, Fn } from '@aws-cdk/core';
import { HttpOrigin, S3Origin } from '@aws-cdk/aws-cloudfront-origins';
import { ISecret, Secret } from '@aws-cdk/aws-secretsmanager';
import {
  AddBehaviorOptions, AllowedMethods,
  CacheHeaderBehavior,
  CachePolicy,
  KeyGroup,
  OriginRequestCookieBehavior, OriginRequestHeaderBehavior,
  OriginRequestPolicy, OriginRequestQueryStringBehavior,
  PublicKey,
  ViewerProtocolPolicy,
} from '@aws-cdk/aws-cloudfront';
import { ShareApiDistributionBehaviorProps } from '../interfaces/share-api-distribution-behavior-props';

export default class ApiDistributionBehavior extends Construct {
    publicKeyId: string;

    privateKey: ISecret;

    constructor(scope: Construct, id: string, props: ShareApiDistributionBehaviorProps) {
      super(scope, id);

      // Filebehavior

      const fileShareOrigin = new S3Origin(props.bucket);

      const publicKey = Secret.fromSecretNameV2(this, 'PublicKey', props.publicKeySecretName);
      this.privateKey = Secret.fromSecretNameV2(this, 'PrivateKey', props.privateKeySecretName);

      const pubKey = new PublicKey(this, 'FileSharePublicKey', {
        encodedKey: publicKey.secretValue.toString(),
      });
      this.publicKeyId = pubKey.publicKeyId;

      const keyGroup = new KeyGroup(this, 'FileShareKeyGroup', {
        items: [
          pubKey,
        ],
      });

      const fileShareBehavior = {
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: new OriginRequestPolicy(this, 'FileShareOriginRequestPolicy', {
          cookieBehavior: OriginRequestCookieBehavior.none(),
          queryStringBehavior: OriginRequestQueryStringBehavior.all(),
        }),
        trustedKeyGroups: [keyGroup],
      };

      props.distribution.addBehavior('/a/*', fileShareOrigin, fileShareBehavior);

      // ApiBehavior

      const apiOrigin = new HttpOrigin(Fn.select(2, Fn.split('/', props.api.apiEndpoint)));

      const apiBehavior: AddBehaviorOptions = {
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

      props.distribution.addBehavior('/api/*', apiOrigin, apiBehavior);

      // ForwardLinkBehavior

      const linkOrigin = new HttpOrigin(Fn.select(2, Fn.split('/', props.api.apiEndpoint)), {
        originPath: '/api',
      });

      const linkCachePolicy = new CachePolicy(this, 'LinkCachePolicy', {
        maxTtl: Duration.days(1),
        defaultTtl: Duration.seconds(60),
        minTtl: Duration.seconds(60),
      });

      const linkBehavior: AddBehaviorOptions = {
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: linkCachePolicy,
      };

      props.distribution.addBehavior('/d/*', linkOrigin, linkBehavior);
    }
}
