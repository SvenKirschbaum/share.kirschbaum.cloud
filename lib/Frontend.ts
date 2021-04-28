import * as cdk from '@aws-cdk/core';
import * as childProcess from 'child_process';
import { Bucket, BucketEncryption } from '@aws-cdk/aws-s3';
import { Duration, RemovalPolicy, Stack } from '@aws-cdk/core';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import { S3Origin } from '@aws-cdk/aws-cloudfront-origins';
import { BehaviorOptions, CachePolicy, ViewerProtocolPolicy } from '@aws-cdk/aws-cloudfront';
import { FrontendProps } from './interfaces/FrontendProps';

export default class Frontend extends cdk.Construct {
  public defaultBehavior: BehaviorOptions;

  public additionalBehaviors = new Map<string, BehaviorOptions>();

  constructor(scope: cdk.Construct, id: string, props: FrontendProps) {
    super(scope, id);

    Frontend.buildFrontend({
      REACT_APP_CLIENT_ID: props.frontendClientId,
      REACT_APP_KEYCLOAK: props.keycloakUrl,
      REACT_APP_REALM: props.keycloakRealm,
    });

    const frontendBucket = new Bucket(this, 'Bucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      publicReadAccess: true,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    new BucketDeployment(this, 'Deployment', {
      destinationBucket: frontendBucket,
      sources: [
        Source.asset('./frontend/build', {
          exclude: ['*.map'],
        }),
      ],
    });

    const s3Origin = new S3Origin(frontendBucket);

    this.defaultBehavior = {
      origin: s3Origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new CachePolicy(this, 'DefaultCachePolicy', {
        minTtl: Duration.days(365),
        defaultTtl: Duration.days(365),
        maxTtl: Duration.days(365),
      }),
    };

    this.additionalBehaviors.set('/index.html', {
      origin: s3Origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new CachePolicy(this, 'ConfigCachePolicy', {
        minTtl: Duration.minutes(5),
        defaultTtl: Duration.minutes(5),
        maxTtl: Duration.minutes(5),
      }),
    });
  }

  private static buildFrontend(environment: {[p: string]: string}) {
    childProcess.execSync('npm run build:frontend', {
      env: {
        ...process.env,
        ...environment,
      },
      stdio: 'inherit',
    });
  }
}
