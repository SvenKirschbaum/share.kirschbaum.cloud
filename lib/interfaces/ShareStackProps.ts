import { StackProps } from 'aws-cdk-lib';
import { DelegationOptions } from './DelegationOptions';

export interface ShareStackProps extends StackProps {
    domain: string;
    delegation?: DelegationOptions
    keycloakUrl: string;
    keycloakRealm: string;
    frontendClientId: string;
    backendClientId: string;
    privateKeySecretName: string;
    publicKeySecretName: string;
}
