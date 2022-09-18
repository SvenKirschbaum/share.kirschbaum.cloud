#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import ShareStage from '../lib/ShareStage';

const app = new cdk.App();

new ShareStage(app, 'Dev', {
  keycloak: {
    url: 'https://id.elite12.de',
    realm: 'elite12',
    frontendClientId: 'cloud-share-frontend',
    backendClientId: 'cloud-share-backend',
  },
  statePrefix: 'Dev',
  env: {
    account: '<<ACCOUNT-ID>>',
    region: 'eu-central-1',
  },
});
