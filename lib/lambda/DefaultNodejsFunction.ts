import { Stack } from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as nodePackageJson from '../../lambda/nodejs/package.json';
import {Construct} from "constructs";
import {RetentionDays} from "aws-cdk-lib/aws-logs";

export default class DefaultNodejsFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
    const layerId = 'default-node-layer';

    const stack = Stack.of(scope);
    let layer = stack.node.tryFindChild(layerId) as LayerVersion;

    layer = layer || new LayerVersion(stack, layerId, {
      code: Code.fromAsset('lambda', {
        exclude: ['nodejs/src/functions', 'cloudfront'],
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
      layers: [layer],
      logRetention: RetentionDays.TWO_WEEKS,
    });
  }
}
