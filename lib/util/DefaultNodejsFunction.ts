import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  Architecture, Code, LayerVersion, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Stack } from 'aws-cdk-lib';
// eslint-disable-next-line import/no-relative-packages
import * as nodePackageJson from '../../lambda/nodejs/package.json';

export default class DefaultNodejsFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
    const layerId = 'default-node-layer';

    const stack = Stack.of(scope);
    let layer = stack.node.tryFindChild(layerId) as LayerVersion;

    layer = layer || new LayerVersion(stack, layerId, {
      code: Code.fromAsset('lambda', {
        exclude: ['nodejs/src/functions', 'nodejs-edge'],
      }),
      compatibleRuntimes: [Runtime.NODEJS_10_X, Runtime.NODEJS_12_X, Runtime.NODEJS_14_X],
    });

    super(scope, id, {
      ...props,
      bundling: {
        externalModules: [
          'aws-sdk',
          ...Object.keys(nodePackageJson.dependencies),
        ],
      },
      runtime: Runtime.NODEJS_14_X,
      architecture: Architecture.ARM_64,
      layers: [layer],
      logRetention: RetentionDays.TWO_WEEKS,
    });
  }
}
