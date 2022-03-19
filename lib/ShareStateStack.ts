import {
  Duration, PhysicalName, Stack, StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AttributeType, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import {
  BlockPublicAccess, Bucket, BucketEncryption, HttpMethods,
} from 'aws-cdk-lib/aws-s3';

export interface ShareStateStackProps extends StackProps {
    prefix: string
}

export default class ShareStateStack extends Stack {
  public table: Table;

  public storageBucket: Bucket;

  constructor(scope: Construct, id: string, props: ShareStateStackProps) {
    super(scope, id, props);

    this.createTable(props.prefix);
    this.createStorageBucket(props.prefix);
  }

  private createTable(resourcePrefix: string) {
    this.table = new Table(this, 'Table', {
      tableName: `${resourcePrefix}ShareTable`,
      partitionKey: {
        name: 'PK',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: AttributeType.STRING,
      },
      readCapacity: 1,
      writeCapacity: 1,
      timeToLiveAttribute: 'expire',
      stream: StreamViewType.OLD_IMAGE,
    });

    this.table.addGlobalSecondaryIndex({
      partitionKey: {
        name: 'user',
        type: AttributeType.STRING,
      },
      indexName: 'user-index',
      writeCapacity: 1,
      readCapacity: 1,
    });
  }

  private createStorageBucket(resourcePrefix: string) {
    this.storageBucket = new Bucket(this, 'StorageBucket', {
      bucketName: `${resourcePrefix}ShareStorageBucket`.toLowerCase(),
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [HttpMethods.PUT],
          allowedOrigins: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
    });
  }
}
