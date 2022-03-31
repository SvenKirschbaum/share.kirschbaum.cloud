import {
  CfnOutput, Fn, Stack, StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as iam from 'aws-cdk-lib/aws-iam';
import { HostedZone } from 'aws-cdk-lib/aws-route53/lib/hosted-zone';
import { DnsValidatedDomainIdentity } from 'aws-cdk-ses-domain-identity';
import * as fs from 'fs';
import * as path from 'path';
import { CfnTemplate } from 'aws-cdk-lib/aws-ses';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { DynamoEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import DefaultNodejsFunction from './util/DefaultNodejsFunction';
import { DelegationOptions } from './interfaces/DelegationOptions';

export interface ShareUtilStackProps extends StackProps {
    domain?: string;
    delegation?: DelegationOptions;
    disableEmail: boolean;
    table: Table;
    storageBucket: Bucket
}

export default class ShareUtilStack extends Stack {
  public zone?: HostedZone;

  constructor(scope: Construct, id: string, props: ShareUtilStackProps) {
    super(scope, id, props);

    this.createDnsResources(props.domain, props.delegation);
    if (!props.disableEmail) this.createEmailResources(props.domain);
    this.createFileDeletionResources(props.table, props.storageBucket);
  }

  private createDnsResources(domain?: string, delegationOptions?: DelegationOptions) {
    if (!domain && delegationOptions) throw new Error('Specifing a delegation without a domain is not possible');

    if (domain) {
      this.zone = new route53.PublicHostedZone(this, 'HostedZone', {
        zoneName: domain,
      });

      // Create delegation automatically if specified
      if (delegationOptions) {
        // create the delegation record
        new route53.CrossAccountZoneDelegationRecord(this, 'DelegationRecord', {
          delegatedZone: this.zone,
          parentHostedZoneName: delegationOptions.parentDomain,
          delegationRole: iam.Role.fromRoleArn(this, 'DelegationRole', Stack.of(this).formatArn({
            region: '', // IAM is global in each partition
            service: 'iam',
            account: delegationOptions.accountId,
            resource: 'role',
            resourceName: delegationOptions.roleName,
          })),
        });
      }

      new CfnOutput(this, 'NameserverOutput', {
        exportName: 'Nameservers',
        value: Fn.join(' ', this.zone.hostedZoneNameServers as string[]),
      });
    }
  }

  private createEmailResources(domain?: string) {
    if (this.zone && domain) {
      new DnsValidatedDomainIdentity(this, 'DomainIdentity', {
        domainName: domain,
        dkim: true,
        hostedZone: this.zone,
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
      entry: 'lambda/nodejs/src/functions/onShareDeletion/index.ts',
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
