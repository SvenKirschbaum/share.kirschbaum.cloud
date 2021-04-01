import { Construct, Stack } from '@aws-cdk/core';
import { NodejsFunction, NodejsFunctionProps } from '@aws-cdk/aws-lambda-nodejs';
import { Code, LayerVersion, Runtime } from '@aws-cdk/aws-lambda';

export default class DefaultNodejsFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
    const layerId = 'backend-default-lambda-layer';

    const stack = Stack.of(scope);
    let layer = stack.node.tryFindChild(layerId) as LayerVersion;

    layer = layer || new LayerVersion(stack, layerId, {
      code: Code.fromAsset('lambda', {
        exclude: ['nodejs/src/functions'],
      }),
      compatibleRuntimes: [Runtime.NODEJS_10_X, Runtime.NODEJS_12_X, Runtime.NODEJS_14_X],
    });

    super(scope, id, {
      ...props,
      bundling: {
        externalModules: [
          'aws-sdk',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-secrets-manager',
          '@aws-sdk/s3-presigned-post',
          '@aws-sdk/client-s3',
          'class-transformer',
          'class-transformer-validator',
          'class-validator',
          'moment',
          'reflect-metadata',
          'uuid',
        ],
      },
      runtime: Runtime.NODEJS_14_X,
      layers: [layer],
    });
  }
}
