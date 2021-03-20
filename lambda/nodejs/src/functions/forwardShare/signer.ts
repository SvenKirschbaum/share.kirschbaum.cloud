import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";

const AWS = require('aws-sdk');
let _signer: any = undefined;

export async function getSigner(): Promise<any> {
    if (_signer) return _signer;

    const smc = new SecretsManagerClient({region: process.env.AWS_REGION});

    const privateKey = await smc.send(new GetSecretValueCommand({
        SecretId: process.env.KEY_SECRET
    }));

    _signer = new AWS.CloudFront.Signer(process.env.KEY_ID, privateKey.SecretString);
    return _signer;
}