import { StackProps } from 'aws-cdk-lib';

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
