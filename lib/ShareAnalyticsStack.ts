import {
  Duration, RemovalPolicy, Stack, StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { JsonPath } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import DefaultNodejsFunction from './util/DefaultNodejsFunction';

export interface ShareAnalyticsStackProps extends StackProps {
    table: Table
}

export default class ShareAnalyticsStack extends Stack {
  private stateMachine: sfn.StateMachine;

  logBucket: Bucket;

  constructor(scope: Construct, id: string, props: ShareAnalyticsStackProps) {
    super(scope, id, props);

    this.createLogBucket();
    this.createStateMachine(props.table);
    this.createSubmitResources();
  }

  private createLogBucket() {
    this.logBucket = new Bucket(this, 'LogBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          expiration: Duration.days(3),
        },
      ],
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  private createStateMachine(table: Table) {
    const parseLogFunction = new DefaultNodejsFunction(this, 'parseLogFunction', {
      entry: 'lambda/nodejs/src/functions/analytics/parseLog/index.ts',
    });
    this.logBucket.grantRead(parseLogFunction);

    const parseLogStep = new tasks.LambdaInvoke(this, 'parseLogStep', {
      lambdaFunction: parseLogFunction,
      resultSelector: {
        'clickData.$': '$.Payload',
      },
      outputPath: '$.clickData',
    });

    const mapStep = new sfn.Map(this, 'mappingStep', {
      resultPath: JsonPath.DISCARD,
    });

    const ddbKey = {
      attributeValue: {
        'S.$': "States.Format('SHARE#{}', $.shareId)",
      },
      toObject(): any {
        return this.attributeValue;
      },
    };

    const updateClickData = new tasks.DynamoUpdateItem(this, 'updateClickStats', {
      table,
      key: {
        PK: ddbKey,
        SK: ddbKey,
      },
      updateExpression: 'ADD clicks.#date :val',
      conditionExpression: 'attribute_exists(clicks)',
      expressionAttributeNames: {
        '#date.$': '$.date',
      },
      expressionAttributeValues: {
        ':val': {
          attributeValue: {
            'N.$': "States.Format('{}', $.value)",
          },
          toObject(): any {
            return this.attributeValue;
          },
        },
      },
    });

    const ignoreMissingShareState = new sfn.Pass(this, 'ignoreMissingShareState');

    const successState = new sfn.Succeed(this, 'successState');

    const definition = parseLogStep
      .next(
        mapStep
          .iterator(
            updateClickData
              .addCatch(ignoreMissingShareState, {
                errors: ['DynamoDB.ConditionalCheckFailedException'],
              }),
          )
          .next(successState),
      );

    this.stateMachine = new sfn.StateMachine(this, 'LogParsingStateMachine', {
      definition,
    });
  }

  private createSubmitResources() {
    const submitLogAnalysisFunction = new DefaultNodejsFunction(this, 'SubmitLogAnalysisFunction', {
      entry: 'lambda/nodejs/src/functions/analytics/submitLogAnalysis/index.ts',
      environment: {
        LOG_PARSING_STATE_MACHINE: this.stateMachine.stateMachineArn,
      },
    });
    this.stateMachine.grantStartExecution(submitLogAnalysisFunction);
    this.logBucket.addObjectCreatedNotification(
      new LambdaDestination(submitLogAnalysisFunction),
    );
  }
}
