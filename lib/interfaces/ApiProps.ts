import { Bucket } from '@aws-cdk/aws-s3';
import { ISecret } from '@aws-cdk/aws-secretsmanager';

export interface ApiProps {
    jwtIssuerUrl: string,
    jwtAudience: string,
    domain: string,
    fileBucket: Bucket,
    fileShareKeyId: string,
    fileShareKeySecret: ISecret
}
