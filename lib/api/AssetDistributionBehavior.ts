import {Construct} from "@aws-cdk/core";
import {S3Origin} from "@aws-cdk/aws-cloudfront-origins";
import {ISecret, Secret} from "@aws-cdk/aws-secretsmanager";
import {
    BehaviorOptions,
    CachePolicy,
    KeyGroup,
    OriginRequestCookieBehavior,
    OriginRequestPolicy, OriginRequestQueryStringBehavior,
    PublicKey,
    ViewerProtocolPolicy
} from "@aws-cdk/aws-cloudfront";
import {Bucket} from "@aws-cdk/aws-s3";

export class AssetDistributionBehavior extends Construct {

    behavior: BehaviorOptions;
    publicKeyId: string;
    privateKey: ISecret;

    constructor(scope: Construct, id: string, bucket: Bucket) {
        super(scope, id);

        const fileShareOrigin = new S3Origin(bucket);

        const publicKey = Secret.fromSecretNameV2(this, 'PublicKey', 'share/cloudfront/public');
        this.privateKey = Secret.fromSecretNameV2(this, 'PrivateKey', 'share/cloudfront/private');

        const pubKey = new PublicKey(this, 'FileSharePublicKey', {
            encodedKey: publicKey.secretValue.toString(),
        });
        this.publicKeyId = pubKey.publicKeyId;

        const keyGroup = new KeyGroup(this, 'FileShareKeyGroup', {
            items: [
                pubKey,
            ],
        });

        this.behavior = {
            origin: fileShareOrigin,
            cachePolicy: CachePolicy.CACHING_OPTIMIZED,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            originRequestPolicy: new OriginRequestPolicy(this, 'FileShareOriginRequestPolicy', {
                cookieBehavior: OriginRequestCookieBehavior.none(),
                queryStringBehavior: OriginRequestQueryStringBehavior.all(),
            }),
            trustedKeyGroups: [keyGroup]
        }
    }
}