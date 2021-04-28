import * as cdk from '@aws-cdk/core';
import {
  CfnOutput,
} from '@aws-cdk/core';
import { Distribution } from '@aws-cdk/aws-cloudfront';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { ShareStackProps } from './interfaces/ShareStackProps';
import Api from './Api';
import Frontend from './Frontend';
import AssetStorage from './AssetStorage';

export default class ShareStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ShareStackProps) {
    super(scope, id, props);

    const customDomain: boolean = props?.domain !== undefined;

    if (customDomain && !props?.certificateARN) throw new Error('You must specify a certificateARN when using a custom Domain');

    const frontend = new Frontend(this, 'Frontend', {
      frontendClientId: props.frontendClientId,
      keycloakRealm: props.keycloakRealm,
      keycloakUrl: props.keycloakUrl,
    });

    const distribution = new Distribution(this, 'Distribution', {
      certificate: customDomain ? Certificate.fromCertificateArn(this, 'Certificate', props?.certificateARN as string) : undefined,
      domainNames: customDomain ? [props?.domain as string] : undefined,
      defaultRootObject: 'index.html',

      defaultBehavior: frontend.defaultBehavior,
    });

    const assetStorage = new AssetStorage(this, 'AssetStorage', {
      privateKeySecretName: props.privateKeySecretName,
      publicKeySecretName: props.publicKeySecretName,
    });

    // Backend
    const api = new Api(this, 'Api', {
      jwtAudience: props.backendClientId,
      jwtIssuerUrl: `${props.keycloakUrl}/realms/${props.keycloakRealm}`,
      domain: customDomain ? props.domain as string : distribution.domainName,
      fileShareKeyId: assetStorage.publicKeyId,
      fileShareKeySecret: assetStorage.privateKeySecret,
      fileBucket: assetStorage.fileShareBucket,
    });

    // Add SubConstruct behaviors to Cloudfront distribution
    new Map([
      ...frontend.additionalBehaviors,
      ...assetStorage.additionalBehaviors,
      ...api.additionalBehaviors,
    ])
      .forEach(
        (behavior, key) => distribution.addBehavior(key, behavior.origin, behavior),
      );

    new CfnOutput(this, 'Url', {
      value: distribution.domainName,
    });
  }
}
