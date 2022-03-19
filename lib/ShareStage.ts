import { Stack, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import ShareUtilStack from './ShareUtilStack';
import ShareStateStack from './ShareStateStack';
import ShareApiStack from './ShareApiStack';
import ShareFrontendStack from './ShareFrontendStack';
import ShareAnalyticsStack from './ShareAnalyticsStack';
import { DelegationOptions } from './interfaces/DelegationOptions';

export interface ShareStageProps extends StageProps {
    domain: string;
    delegation?: DelegationOptions
    keycloakUrl: string;
    keycloakRealm: string;
    frontendClientId: string;
    backendClientId: string;
    statePrefix: string;
}

export default class ShareStage extends Stage {
  constructor(scope: Construct, id: string, props: ShareStageProps) {
    super(scope, id, props);

    const frontendDomain = props.domain;
    const apiDomain = `api.${props.domain}`;

    const state = new ShareStateStack(this, 'State', {
      prefix: props.statePrefix,
    });
    const utilities = new ShareUtilStack(this, 'Utilities', {
      domain: frontendDomain,
      delegation: props.delegation,
      table: state.table,
      storageBucket: state.storageBucket,
    });

    // eslint-disable-next-line no-unused-vars
    const api = new ShareApiStack(this, 'Api', {
      apiDomain,
      frontendDomain,
      jwtAudience: props.backendClientId,
      jwtIssuerUrl: `${props.keycloakUrl}/realms/${props.keycloakRealm}`,
      zone: utilities.zone,
      table: state.table,
      storageBucket: state.storageBucket,
    });

    const analytics = new ShareAnalyticsStack(this, 'Analytics', {
      table: state.table,
    });

    // eslint-disable-next-line no-unused-vars
    const frontend = new ShareFrontendStack(this, 'Frontend', {
      frontendDomain,
      apiDomain,
      keycloakUrl: props.keycloakUrl,
      keycloakRealm: props.keycloakRealm,
      keycloakClientId: props.frontendClientId,
      zone: utilities.zone,
      logBucket: analytics.logBucket,
      storageBucket: state.storageBucket,
      table: state.table,
    });
  }
}
