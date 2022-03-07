import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackProps } from 'aws-cdk-lib';
import Api from './Api';
import Frontend from './Frontend';
import AssetStorage from './AssetStorage';
import Analytics from './Analytics';
import General from './General';
import { DelegationOptions } from './interfaces/DelegationOptions';

interface ShareStackProps extends StackProps {
    domain: string;
    delegation?: DelegationOptions
    keycloakUrl: string;
    keycloakRealm: string;
    frontendClientId: string;
    backendClientId: string;
    privateKeySecretName: string;
    publicKeySecretName: string;
}

export default class ShareStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ShareStackProps) {
    super(scope, id, props);

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
      domain: props.domain,
      fileShareKeyId: assetStorage.publicKeyId,
      fileShareKeySecret: assetStorage.privateKeySecret,
      fileBucket: assetStorage.fileShareBucket,
    });

    const analytics = new Analytics(this, 'Analytics', {
      table: api.table,
    });

    new General(this, 'General', {
      domain: props.domain,
      delegation: props.delegation,

      logBucket: analytics.logFileBucket,
      defaultBehavior: frontend.defaultBehavior,
      additionalBehaviors: {
        ...frontend.additionalBehaviors,
        ...assetStorage.additionalBehaviors,
        ...api.additionalBehaviors,
      },
    });
  }
}
