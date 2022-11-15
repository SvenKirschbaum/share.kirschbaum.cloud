import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import ShareStage from './ShareStage';

export default class SharePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.createBuild();

    const pipeline = this.createPipeline();

    pipeline.addStage(new ShareStage(this, 'Staging', {
      domain: 'share-staging.kirschbaum.cloud',
      delegation: {
        parentDomain: 'kirschbaum.cloud',
        accountId: '212836051001',
        roleName: 'CloudshareDNSDelegationRole',
      },
      keycloak: {
        url: 'https://id.elite12.de',
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
          url: 'https://id.elite12.de',
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

  private createPipeline() {
    const source = pipelines.CodePipelineSource.connection('fallobst22/share.kirschbaum.cloud', 'master', {
      connectionArn: 'arn:aws:codestar-connections:eu-central-1:900412866728:connection/800140c2-1054-4743-bdea-deb6eb8dedcc',
    });

    const synth = new pipelines.ShellStep('Synth', {
      input: source,
      installCommands: [
        'npm ci',
        '(cd frontend && npm ci)',
        '(cd lambda && npm ci --unsafe-perm)',
      ],
      commands: [
        '(cd frontend && npm run build)',
        'npm test',
        'npx cdk synth',
      ],
    });

    return new pipelines.CodePipeline(this, 'Pipeline', {
      synth,
      publishAssetsInParallel: false,
      crossAccountKeys: true,
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        },
      },
    });
  }

  private createBuild() {
    new codebuild.Project(this, 'Build', {
      source: codebuild.Source.gitHub({
        owner: 'fallobst22',
        repo: 'share.kirschbaum.cloud',
        webhook: true,
        webhookFilters: [
          codebuild.FilterGroup.inEventOf(
            codebuild.EventAction.PULL_REQUEST_CREATED,
            codebuild.EventAction.PULL_REQUEST_UPDATED,
            codebuild.EventAction.PULL_REQUEST_REOPENED,
          ),
        ],
        reportBuildStatus: true,
      }),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: 0.2,
        phases: {
          install: {
            commands: [
              'npm ci',
              '(cd frontend && npm ci)',
              '(cd lambda && npm ci --unsafe-perm)',
            ],
          },
          build: {
            commands: [
              '(cd frontend && npm run build)',
              'npm test',
              'npx cdk synth',
            ],
          },
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        computeType: codebuild.ComputeType.SMALL,
      },
    });
  }
}
