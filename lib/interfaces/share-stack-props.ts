import { StackProps } from '@aws-cdk/core';

export interface ShareStackProps extends StackProps {
    domain?: string;
    certificateARN?: string;
    jwtIssuerUrl: string;
    privateKeySecretName: string;
    publicKeySecretName: string;
}
