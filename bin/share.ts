#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import ShareStage from '../lib/ShareStage';

const app = new cdk.App();
new ShareStage(app, 'Prod', {
  domain: 'share.kirschbaum.cloud',
  delegation: {
    parentDomain: 'kirschbaum.cloud',
    accountId: '212836051001',
    roleName: 'CloudshareDNSDelegationRole',
  },
  keycloak: {
    url: 'https://id.elite12.de/auth',
    realm: 'elite12',
    frontendClientId: 'cloud-share-frontend',
    backendClientId: 'cloud-share-backend',
  },
  statePrefix: 'Prod',
  env: {
    account: '743848950232',
    region: 'eu-central-1',
  },
});
