import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { DnsValidatedDomainIdentity } from 'aws-cdk-ses-domain-identity';
import { CfnTemplate } from 'aws-cdk-lib/aws-ses';
import * as fs from 'fs';
import * as path from 'path';

interface SESConfigurationProps {
    domain: string,
    zone: route53.PublicHostedZone
}

export default class SESConfiguration extends Construct {
  constructor(scope: Construct, id: string, props: SESConfigurationProps) {
    super(scope, id);

    new DnsValidatedDomainIdentity(this, 'DomainIdentity', {
      domainName: props.domain,
      dkim: true,
      hostedZone: props.zone,
    });

    // Create Template for all files in the folder
    fs.readdirSync(path.resolve(__dirname, '..', 'templates', 'ses'))
      .map((fileName) => fs.readFileSync(path.resolve(__dirname, '..', 'templates', 'ses', fileName)))
      .map((buffer) => buffer.toString())
      .map((fileContent) => JSON.parse(fileContent))
      .map((template) => new CfnTemplate(this, `${template.templateName}Template`, {
        template,
      }));
  }
}
