import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration, Lazy } from 'aws-cdk-lib';
import {
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  ResponseHeadersPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { ShareStackProps } from './interfaces/ShareStackProps';
import Api from './Api';
import Frontend from './Frontend';
import AssetStorage from './AssetStorage';
import Analytics from './Analytics';

export default class ShareStack extends cdk.Stack {
  private readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: ShareStackProps) {
    super(scope, id, props);

    const customDomain: boolean = props?.domain !== undefined;

    if (customDomain && !props?.certificateARN) throw new Error('You must specify a certificateARN when using a custom Domain');

    const frontend = new Frontend(this, 'Frontend', {
      frontendClientId: props.frontendClientId,
      keycloakRealm: props.keycloakRealm,
      keycloakUrl: props.keycloakUrl,
    });

    const assetStorage = new AssetStorage(this, 'AssetStorage', {
      privateKeySecretName: props.privateKeySecretName,
      publicKeySecretName: props.publicKeySecretName,
    });

    // Backend
    const api = new Api(this, 'Api', {
      jwtAudience: props.backendClientId,
      jwtIssuerUrl: `${props.keycloakUrl}/realms/${props.keycloakRealm}`,
      domain: customDomain ? props.domain as string : Lazy.string({
        produce: () => this.distribution.domainName,
      }),
      fileShareKeyId: assetStorage.publicKeyId,
      fileShareKeySecret: assetStorage.privateKeySecret,
      fileBucket: assetStorage.fileShareBucket,
    });

    const analytics = new Analytics(this, 'Analytics', {
      table: api.table,
    });

    const responseHeaderPolicy = new ResponseHeadersPolicy(this, 'ResponseHeaderPolicy', {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.seconds(31536000),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        frameOptions: {
          frameOption: HeadersFrameOption.DENY,
          override: true,
        },
        xssProtection: {
          protection: true,
          override: true,
          modeBlock: true,
        },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    this.distribution = new Distribution(this, 'Distribution', {
      certificate: customDomain ? Certificate.fromCertificateArn(this, 'Certificate', props?.certificateARN as string) : undefined,
      domainNames: customDomain ? [props?.domain as string] : undefined,
      defaultRootObject: 'index.html',

      defaultBehavior: {
        ...frontend.defaultBehavior,
        responseHeadersPolicy: responseHeaderPolicy,
      },

      logBucket: analytics.logFileBucket,
      enableLogging: true,
    });

    // Add SubConstruct behaviors to Cloudfront distribution
    new Map([
      ...frontend.additionalBehaviors,
      ...assetStorage.additionalBehaviors,
      ...api.additionalBehaviors,
    ])
      .forEach(
        (behavior, key) => this.distribution.addBehavior(key, behavior.origin, {
          ...behavior,
          responseHeadersPolicy: responseHeaderPolicy,
        }),
      );

    new CfnOutput(this, 'Url', {
      value: this.distribution.domainName,
    });
  }
}
