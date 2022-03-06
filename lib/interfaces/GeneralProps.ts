import { BehaviorOptions } from 'aws-cdk-lib/aws-cloudfront';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { DelegationOptions } from './DelegationOptions';

export interface GeneralProps {
    domain: string;
    delegation?: DelegationOptions
    logBucket: Bucket;
    defaultBehavior: BehaviorOptions;
    additionalBehaviors: Record<string, BehaviorOptions>;
}
