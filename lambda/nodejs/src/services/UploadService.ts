import {v4 as uuidv4} from 'uuid';
import {
    CompletedPart,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    S3Client,
    UploadPartCommand
} from "@aws-sdk/client-s3";
import UploadInfo from "../types/UploadInfo";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

class UploadService {
    private readonly s3: S3Client;

    constructor() {
        this.s3 = new S3Client({ region: process.env.AWS_REGION });
    }

    public async startUpload(parts: number, contentType: string): Promise<UploadInfo> {
        const fileId = uuidv4();

        const createMultipartUploadCommand = new CreateMultipartUploadCommand({
            Bucket: process.env.FILE_BUCKET as string,
            Key: fileId,
            ContentType: contentType
        });

        const createUploadResponse = await this.s3.send(createMultipartUploadCommand);

        const partUrls = await Promise.all(
            [...Array(parts).keys()]
            .map(partNumber => {
                const uploadPartCommand = new UploadPartCommand({
                    Bucket: process.env.FILE_BUCKET,
                    Key: fileId,
                    PartNumber: partNumber + 1,
                    UploadId: createUploadResponse.UploadId
                });
                return getSignedUrl(this.s3, uploadPartCommand, {expiresIn: 60 * 60 * 24})
            })
        );

        return {
            uploadId: createUploadResponse.UploadId as string,
            fileId: fileId,
            partUrls: partUrls
        };
    }

    public async finishUpload(uploadId: string, fileId: string, parts: CompletedPart[]): Promise<void> {
        const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
            Bucket: process.env.FILE_BUCKET,
            Key: fileId,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts
            },
        });

        await this.s3.send(completeMultipartUploadCommand);
    }
}

export const uploadService = new UploadService();