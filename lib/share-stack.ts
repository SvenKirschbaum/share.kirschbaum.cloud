import * as cdk from '@aws-cdk/core';
import * as childProcess from 'child_process';
import {
  CfnOutput, Duration, RemovalPolicy,
} from '@aws-cdk/core';
import { Bucket, BucketEncryption } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import { S3Origin } from '@aws-cdk/aws-cloudfront-origins';
import {
  BehaviorOptions,
  CachePolicy,
  Distribution,
  ViewerProtocolPolicy,
} from '@aws-cdk/aws-cloudfront';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { ShareStackProps } from './interfaces/share-stack-props';
import ShareApi from './api/share-api';

export default class ShareStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ShareStackProps) {
    super(scope, id, props);

    const customDomain: boolean = props?.domain !== undefined;

    if (customDomain && !props?.certificateARN) throw new Error('You must specify a certificateARN when using a custom Domain');

    // Frontend
    const frontendBucket = new Bucket(this, 'FrontendBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      publicReadAccess: true,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    ShareStack.buildFrontend({
      REACT_APP_CLIENT_ID: props.frontendClientId,
      REACT_APP_KEYCLOAK: props.keycloakUrl,
      REACT_APP_REALM: props.keycloakRealm,
    });

    new BucketDeployment(this, 'FrontendDeployment', {
      destinationBucket: frontendBucket,
      sources: [
        Source.asset('./frontend/build'),
      ],
    });

    // Cloudfront
    const s3Origin = new S3Origin(frontendBucket);

    const configBehavior: BehaviorOptions = {
      origin: s3Origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new CachePolicy(this, 'ConfigCachePolicy', {
        minTtl: Duration.minutes(5),
        defaultTtl: Duration.minutes(5),
        maxTtl: Duration.minutes(5),
      }),
    };

    const frontendBehavior: BehaviorOptions = {
      origin: s3Origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new CachePolicy(this, 'DefaultCachePolicy', {
        minTtl: Duration.days(365),
        defaultTtl: Duration.days(365),
        maxTtl: Duration.days(365),
      }),
    };

    const distribution = new Distribution(this, 'Distribution', {
      certificate: customDomain ? Certificate.fromCertificateArn(this, 'Certificate', props?.certificateARN as string) : undefined,
      domainNames: customDomain ? [props?.domain as string] : undefined,
      defaultRootObject: 'index.html',

      additionalBehaviors: {
        '/index.html': configBehavior,
      },

      defaultBehavior: frontendBehavior,
    });

    // Backend
    new ShareApi(this, 'Api', {
      jwtIssuerUrl: `${props.keycloakUrl}/realms/${props.keycloakRealm}`,
      distribution,
      domain: customDomain ? props.domain as string : distribution.domainName,
      privateKeySecretName: props.privateKeySecretName,
      publicKeySecretName: props.publicKeySecretName,
    });

    new CfnOutput(this, 'Url', {
      value: distribution.domainName,
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
