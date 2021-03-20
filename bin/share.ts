#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ShareStack } from '../lib/share-stack';

const app = new cdk.App();
new ShareStack(app, 'ShareStack', {
    domain: 'share.kirschbaum.cloud',
    certificateARN: 'arn:aws:acm:us-east-1:743848950232:certificate/443c0959-73fc-4e36-83db-5a8cefb8dc07',
    jwtIssuerUrl: 'https://id.elite12.de/auth/realms/elite12',
    env: {
        region: 'eu-central-1'
    }
});
