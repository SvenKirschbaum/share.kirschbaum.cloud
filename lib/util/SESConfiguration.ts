import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { DnsValidatedDomainIdentity } from 'aws-cdk-ses-domain-identity';

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
  }
}
