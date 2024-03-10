import {
  Stack, StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';
import {CfnTemplate, EmailIdentity, Identity} from 'aws-cdk-lib/aws-ses';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { DynamoEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import DefaultNodejsFunction from './util/DefaultNodejsFunction';
import { DelegationOptions } from './interfaces/DelegationOptions';
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";
import {RecordType} from "aws-cdk-lib/aws-route53";
import {ResourceRecordSet} from "aws-sdk/clients/route53";

export interface ShareUtilStackProps extends StackProps {
    domain?: string;
    delegation?: DelegationOptions;
    disableEmail: boolean;
    table: Table;
    storageBucket: Bucket
}

export default class ShareUtilStack extends Stack {
  constructor(scope: Construct, id: string, props: ShareUtilStackProps) {
    super(scope, id, props);

    if (!props.disableEmail) this.createEmailResources(props.domain, props.delegation);
    this.createFileDeletionResources(props.table, props.storageBucket);
  }

  private createEmailResources(domain?: string, delegation?: DelegationOptions) {
    if (domain && delegation) {
      const identity = new EmailIdentity(this, 'EmailIdentity', {
        identity: Identity.domain(domain),
      });

      new CrossAccountRoute53RecordSet(this, 'EmailIdentityDNSRecords', {
        delegationRoleName: delegation.roleName,
        delegationRoleAccount: delegation.accountId,
        hostedZoneId: delegation.parentZoneId,
        resourceRecordSets: identity.dkimRecords.map((dkimRecord) => ({
          Name: dkimRecord.name,
          Type: RecordType.CNAME,
          TTL: 3600,
          ResourceRecords: [{
            Value: dkimRecord.value
          }],
        } as ResourceRecordSet)),
      });
    }

    // Create Template for all files in the folder
    fs.readdirSync(path.resolve(__dirname, 'templates', 'ses'))
      .map((fileName) => fs.readFileSync(path.resolve(__dirname, 'templates', 'ses', fileName)))
      .map((buffer) => buffer.toString())
      .map((fileContent) => JSON.parse(fileContent))
      .map((template) => new CfnTemplate(this, `${template.templateName}Template`, {
        template,
      }));
  }

  private createFileDeletionResources(table: Table, storageBucket: Bucket) {
    // Filedeletion
    const deadLetterQueue = new Queue(this, 'deletionDeadLetterQueue');
    const onShareDeletionFunction = new DefaultNodejsFunction(this, 'onShareDeletion', {
      entry: 'lambda/src/functions/onShareDeletion.ts',
      environment: {
        FILE_BUCKET: storageBucket.bucketName,
        POWERTOOLS_SERVICE_NAME: 'share-deletion',
      },
    });
    storageBucket.grantDelete(onShareDeletionFunction);
    table.grantReadWriteData(onShareDeletionFunction);
    onShareDeletionFunction.addEventSource(new DynamoEventSource(table, {
      startingPosition: StartingPosition.LATEST,
      onFailure: new SqsDlq(deadLetterQueue),
      bisectBatchOnError: true,
      enabled: true,
    }));
  }
}
