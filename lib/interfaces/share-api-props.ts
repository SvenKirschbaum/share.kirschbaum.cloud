import { Distribution } from '@aws-cdk/aws-cloudfront';

export interface ShareApiProps {
    jwtIssuerUrl: string;
    distribution: Distribution,
    domain: string,
    privateKeySecretName: string;
    publicKeySecretName: string;
}
