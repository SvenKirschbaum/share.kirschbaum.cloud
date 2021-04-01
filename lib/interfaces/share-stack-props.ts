import { StackProps } from '@aws-cdk/core';

export interface ShareStackProps extends StackProps {
    domain?: string;
    certificateARN?: string;
    keycloakUrl: string;
    keycloakRealm: string;
    frontendClientId: string;
    backendClientId: string;
    privateKeySecretName: string;
    publicKeySecretName: string;
}
