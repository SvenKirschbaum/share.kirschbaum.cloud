import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import ShareUtilStack from './ShareUtilStack';
import ShareStateStack from './ShareStateStack';
import ShareApiStack from './ShareApiStack';
import ShareFrontendStack from './ShareFrontendStack';
import ShareAnalyticsStack from './ShareAnalyticsStack';
import { DelegationOptions } from './interfaces/DelegationOptions';
import KeycloakOptions from './interfaces/KeycloakOptions';

export interface ShareStageProps extends StageProps {
    /**
     * The domain used for the instance of the application.
     * If undefined, a generated domain will be used
     */
    domain?: string;
    /**
     * Configuration to automatically generate a delegation record for the custom domain.
     */
    delegation?: DelegationOptions
    /**
     * Configuration for the keycloak identity provider
     */
    keycloak: KeycloakOptions
    /**
     * prefix applied to the names of all stateful resources
     */
    statePrefix: string;
    /**
     * Disables the functionality so send notification emails
     */
    disableEmail?: boolean;
}

export default class ShareStage extends Stage {
  constructor(scope: Construct, id: string, props: ShareStageProps) {
    super(scope, id, props);

    if (!props.domain && props.disableEmail === false) throw new Error('Emails cant be enabled without a custom domain');

    const frontendDomain = props.domain;
    const apiDomain = props.domain ? `api.${props.domain}` : undefined;
    const disableEmail = props.disableEmail ?? props.domain === undefined;

    const state = new ShareStateStack(this, 'State', {
      prefix: props.statePrefix,
    });

    const utilities = new ShareUtilStack(this, 'Utilities', {
      domain: frontendDomain,
      delegation: props.delegation,
      disableEmail,
      table: state.table,
      storageBucket: state.storageBucket,
    });

    const api = new ShareApiStack(this, 'Api', {
      apiDomain,
      emailDomain: disableEmail ? undefined : frontendDomain,
      jwtAudience: props.keycloak.backendClientId,
      jwtIssuerUrl: `${props.keycloak.url}/realms/${props.keycloak.realm}`,
      zone: utilities.zone,
      table: state.table,
      storageBucket: state.storageBucket,
    });

    const analytics = new ShareAnalyticsStack(this, 'Analytics', {
      table: state.table,
    });

    new ShareFrontendStack(this, 'Frontend', {
      frontendDomain,
      disableEmail,
      apiDomain: apiDomain ?? api.distribution.distributionDomainName,
      keycloakUrl: props.keycloak.url,
      keycloakRealm: props.keycloak.realm,
      keycloakClientId: props.keycloak.frontendClientId,
      zone: utilities.zone,
      logBucket: analytics.logBucket,
      storageBucket: state.storageBucket,
      table: state.table,
    });
  }
}
