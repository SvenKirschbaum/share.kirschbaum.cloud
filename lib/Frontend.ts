import * as childProcess from 'child_process';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BehaviorOptions, CachePolicy, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

interface FrontendProps {
    keycloakUrl: string;
    keycloakRealm: string;
    frontendClientId: string;
}

export default class Frontend extends Construct {
  public defaultBehavior: BehaviorOptions;

  public additionalBehaviors: Record<string, BehaviorOptions> = {};

  constructor(scope: Construct, id: string, props: FrontendProps) {
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

    this.additionalBehaviors['/index.html'] = {
      origin: s3Origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new CachePolicy(this, 'ConfigCachePolicy', {
        minTtl: Duration.minutes(5),
        defaultTtl: Duration.minutes(5),
        maxTtl: Duration.minutes(5),
      }),
    };
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
