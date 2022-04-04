import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import ShareStateStack from './ShareStateStack';

describe('ShareStateStack', () => {
  test('has Resources', () => {
    const app = new cdk.App();

    const stateStack = new ShareStateStack(app, 'ShareStateStack', {
      prefix: 'Test',
    });

    const template = Template.fromStack(stateStack);

    template.hasResource('AWS::DynamoDB::Table', {
      Properties: {
        TableName: 'TestShareTable',
      },
    });

    template.hasResource('AWS::S3::Bucket', {
      Properties: {
        BucketName: 'testsharestoragebucket',
      },
    });
  });
});
