import {
  HeadersFrameOption,
  HeadersReferrerPolicy,
  ResponseHeadersPolicy,
  ResponseHeadersPolicyProps,
} from 'aws-cdk-lib/aws-cloudfront';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export default class DefaultResponseHeadersPolicy extends ResponseHeadersPolicy {
  constructor(scope: Construct, id: string, props: ResponseHeadersPolicyProps) {
    super(scope, id, {
      ...props,
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
        ...props.securityHeadersBehavior,
      },
    });
  }
}
