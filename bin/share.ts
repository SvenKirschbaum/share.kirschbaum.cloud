#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import ShareStack from '../lib/ShareStack';

const app = new cdk.App();
new ShareStack(app, 'ShareStack', {
  domain: 'share.kirschbaum.cloud',
  certificateARN: 'arn:aws:acm:us-east-1:743848950232:certificate/443c0959-73fc-4e36-83db-5a8cefb8dc07',
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
