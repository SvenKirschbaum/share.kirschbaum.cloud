import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  Architecture, Runtime, Tracing,
} from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export default class DefaultNodejsFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
    super(scope, id, {
      ...props,
      runtime: Runtime.NODEJS_16_X,
      architecture: Architecture.ARM_64,
      logRetention: RetentionDays.TWO_WEEKS,
      tracing: Tracing.ACTIVE,
    });
  }
}
