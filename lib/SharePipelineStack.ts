import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import ShareStage from './ShareStage';

export default class SharePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const source = pipelines.CodePipelineSource.connection('fallobst22/share.kirschbaum.cloud', 'master', {
      connectionArn: 'arn:aws:codestar-connections:eu-central-1:900412866728:connection/800140c2-1054-4743-bdea-deb6eb8dedcc',
    });

    const buildFrontend = new pipelines.ShellStep('BuildFrontend', {
      input: source,
      primaryOutputDirectory: './frontend/build',
      installCommands: [
        'cd frontend',
        'npm ci',
      ],
      commands: [
        'npm run build',
      ],
    });

    const synth = new pipelines.ShellStep('Synth', {
      input: source,
      additionalInputs: {
        'frontend/build': buildFrontend,
      },
      installCommands: [
        'npm ci',
        '(cd lambda/nodejs && npm ci)',
        '(cd lambda/nodejs-edge && npm ci)',
      ],
      commands: [
        'npm test',
        'npx cdk synth',
      ],
    });

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      synth,
      publishAssetsInParallel: false,
      crossAccountKeys: true,
    });

    pipeline.addStage(new ShareStage(this, 'Staging', {
      domain: 'share-staging.kirschbaum.cloud',
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
      statePrefix: 'Staging',
      env: {
        account: '276098254089',
        region: 'eu-central-1',
      },
    }));

    pipeline.addStage(
      new ShareStage(scope, 'Prod', {
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
      }),
      {
        pre: [
          new pipelines.ManualApprovalStep('PromoteToProd'),
        ],
      },
    );
  }
}
