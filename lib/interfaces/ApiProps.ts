import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';

export interface ApiProps {
    jwtIssuerUrl: string,
    jwtAudience: string,
    domain: string,
    fileBucket: Bucket,
    fileShareKeyId: string,
    fileShareKeySecret: ISecret
}
