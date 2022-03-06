#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import ShareStack from '../lib/ShareStack';

const app = new cdk.App();
new ShareStack(app, 'ShareStack', {
  domain: 'share.kirschbaum.cloud',
  delegation: {
    parentDomain: 'kirschbaum.cloud',
    accountId: '212836051001',
    roleName: 'CloudshareDNSDelegationRole',
  },
  keycloakUrl: 'https://id.elite12.de/auth',
  keycloakRealm: 'elite12',
  frontendClientId: 'cloud-share-frontend',
  backendClientId: 'cloud-share-backend',
  publicKeySecretName: 'share/cloudfront/public',
  privateKeySecretName: 'share/cloudfront/private',
  env: {
    account: '743848950232',
    region: 'eu-central-1',
  },
});
