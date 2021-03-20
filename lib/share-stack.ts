import * as cdk from '@aws-cdk/core';
import {CfnOutput, Duration, Fn, RemovalPolicy} from '@aws-cdk/core';
import {ShareStackProps} from "./share-stack-props";
import {Bucket, BucketEncryption} from "@aws-cdk/aws-s3";
import {BucketDeployment, Source} from "@aws-cdk/aws-s3-deployment";
import {HttpOrigin, S3Origin} from "@aws-cdk/aws-cloudfront-origins";
import {
  AllowedMethods,
  BehaviorOptions,
  CacheHeaderBehavior,
  CachePolicy,
  Distribution,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ViewerProtocolPolicy
} from "@aws-cdk/aws-cloudfront";
import {Certificate} from "@aws-cdk/aws-certificatemanager";
import {ShareApi} from "./api/share-api";

export class ShareStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ShareStackProps) {
    super(scope, id, props);

    const customDomain: boolean = props?.domain != undefined;

    if (customDomain && !props?.certificateARN) throw new Error('You must specify a certificateARN when using a custom Domain');

    //Frontend
    const frontendBucket = new Bucket(this, 'FrontendBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      publicReadAccess: true,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html'
    });

    //Backend
    const api = new ShareApi(this, 'Api', props);

    //Cloudfront
    const s3Origin = new S3Origin(frontendBucket);

    const configBehavior: BehaviorOptions = {
      origin: s3Origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new CachePolicy(this, 'ConfigCachePolicy', {
        minTtl: Duration.minutes(5),
        defaultTtl: Duration.minutes(5),
        maxTtl: Duration.minutes(5)
      })
    }

    const frontendBehavior: BehaviorOptions = {
      origin: s3Origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new CachePolicy(this, 'DefaultCachePolicy', {
        minTtl: Duration.days(365),
        defaultTtl: Duration.days(365),
        maxTtl: Duration.days(365)
      })
    }

    const apiOrigin = new HttpOrigin(Fn.select(2, Fn.split('/', api.apiEndpoint)));

    const apiBehavior: BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: AllowedMethods.ALLOW_ALL,
      cachePolicy: new CachePolicy(this, 'ApiCachePolicy', {
        minTtl: Duration.seconds(0),
        defaultTtl: Duration.seconds(0),
        maxTtl: Duration.seconds(1),
        headerBehavior: CacheHeaderBehavior.allowList('Authorization')
      }),
      originRequestPolicy: new OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
        headerBehavior: OriginRequestHeaderBehavior.none(),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
        cookieBehavior: OriginRequestCookieBehavior.none()
      })
    }

    const linkOrigin = new HttpOrigin(Fn.select(2, Fn.split('/', api.apiEndpoint)), {
      originPath: '/api',
    });

    const linkCachePolicy = new CachePolicy(this, 'LinkCachePolicy', {
      maxTtl: Duration.days(1),
      defaultTtl: Duration.seconds(60),
      minTtl: Duration.seconds(60)
    });

    const linkBehavior: BehaviorOptions = {
      origin: linkOrigin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: linkCachePolicy,
    }

    const distribution = new Distribution(this, 'Distribution', {
      certificate: customDomain ? Certificate.fromCertificateArn(this, 'Certificate', props?.certificateARN as string) : undefined,
      domainNames: customDomain ? [props?.domain as string] : undefined,
      defaultRootObject: 'index.html',

      additionalBehaviors: {
        '/index.html': configBehavior,
        '/api/*': apiBehavior,
        '/d/*': linkBehavior,
        '/a/*': api.fileShareBehavior
      },

      defaultBehavior: frontendBehavior
    });

    new BucketDeployment(this, 'FrontendDeployment', {
      destinationBucket: frontendBucket,
      distribution,
      sources: [
        Source.asset('./frontend/build')
      ]
    });

    new CfnOutput(this, 'Url', {
      value: distribution.domainName
    })
  }
}
