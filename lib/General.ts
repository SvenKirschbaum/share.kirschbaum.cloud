import { Construct } from 'constructs';
import {
  BehaviorOptions,
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  ResponseHeadersPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import {
  CfnOutput, Duration, Fn, Stack,
} from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { CrossAccountZoneDelegationRecord } from 'aws-cdk-lib/aws-route53';
import { GeneralProps } from './interfaces/GeneralProps';

export default class General extends Construct {
  private delegationRecord?: CrossAccountZoneDelegationRecord;

  constructor(scope: Construct, id: string, props: GeneralProps) {
    super(scope, id);

    const zone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: props.domain,
    });

    // Create delegation automatically if specified
    if (props.delegation) {
      // create the delegation record
      this.delegationRecord = new route53.CrossAccountZoneDelegationRecord(this, 'DelegationRecord', {
        delegatedZone: zone,
        parentHostedZoneName: props.delegation.parentDomain,
        delegationRole: iam.Role.fromRoleArn(this, 'DelegationRole', Stack.of(this).formatArn({
          region: '', // IAM is global in each partition
          service: 'iam',
          account: props.delegation.accountId,
          resource: 'role',
          resourceName: props.delegation.roleName,
        })),
      });
    }

    const certificate = new acm.DnsValidatedCertificate(this, 'Certificate', {
      domainName: props.domain,
      hostedZone: zone,
      // Required for use with Cloudfront
      region: 'us-east-1',
    });

    const responseHeaderPolicy = new ResponseHeadersPolicy(this, 'ResponseHeaderPolicy', {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.seconds(31536000),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        frameOptions: {
          frameOption: HeadersFrameOption.DENY,
          override: true,
        },
        xssProtection: {
          protection: true,
          override: true,
          modeBlock: true,
        },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    // Add ResponseHeaderPolicy to all Behaviors
    const additionalBehaviors:Record<string, BehaviorOptions> = {};
    Object.entries(props.additionalBehaviors).forEach(([key, behavior]) => {
      additionalBehaviors[key] = {
        ...behavior,
        responseHeadersPolicy: responseHeaderPolicy,
      };
    });

    const distribution = new Distribution(this, 'Distribution', {
      certificate,
      domainNames: [props.domain],
      defaultRootObject: 'index.html',

      defaultBehavior: {
        ...props.defaultBehavior,
        responseHeadersPolicy: responseHeaderPolicy,
      },
      additionalBehaviors,

      logBucket: props.logBucket,
      enableLogging: true,
    });

    new route53.ARecord(this, 'DistributionARecord', {
      zone,
      target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new route53.AaaaRecord(this, 'DistributionAAAARecord', {
      zone,
      target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new CfnOutput(this, 'NameserverOutput', {
      exportName: 'Nameservers',
      value: Fn.join(' ', zone.hostedZoneNameServers as string[]),
    });
  }
}
