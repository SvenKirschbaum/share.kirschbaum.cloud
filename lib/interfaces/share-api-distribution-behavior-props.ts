import { Distribution } from '@aws-cdk/aws-cloudfront';
import { Bucket } from '@aws-cdk/aws-s3';
import { HttpApi } from '@aws-cdk/aws-apigatewayv2';

export interface ShareApiDistributionBehaviorProps {
    distribution: Distribution,
    bucket: Bucket,
    api: HttpApi,
    privateKeySecretName: string;
    publicKeySecretName: string;
}
