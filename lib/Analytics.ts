import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Duration } from 'aws-cdk-lib';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { JsonPath } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { AnalyticsProps } from './interfaces/AnalyticsProps';
import DefaultNodejsFunction from './lambda/DefaultNodejsFunction';

export default class Analytics extends Construct {
  public readonly logFileBucket: Bucket;

  constructor(scope: Construct, id: string, props: AnalyticsProps) {
    super(scope, id);

    this.logFileBucket = new Bucket(this, 'LogBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          expiration: Duration.days(3),
        },
      ],
    });

    const parseLogFunction = new DefaultNodejsFunction(this, 'parseLogFunction', {
      entry: 'lambda/nodejs/src/functions/analytics/parseLog/index.ts',
    });
    this.logFileBucket.grantRead(parseLogFunction);

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
      table: props.table,
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

    const stateMachine = new sfn.StateMachine(this, 'LogParsingStateMachine', {
      definition,
    });

    const submitLogAnalysisFunction = new DefaultNodejsFunction(this, 'SubmitLogAnalysisFunction', {
      entry: 'lambda/nodejs/src/functions/analytics/submitLogAnalysis/index.ts',
      environment: {
        LOG_PARSING_STATE_MACHINE: stateMachine.stateMachineArn,
      },
    });
    stateMachine.grantStartExecution(submitLogAnalysisFunction);
    this.logFileBucket.addObjectCreatedNotification(
      new LambdaDestination(submitLogAnalysisFunction),
    );
  }
}
