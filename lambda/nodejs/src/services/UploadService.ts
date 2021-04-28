import {v4 as uuidv4} from 'uuid';
import {CompleteMultipartUploadCommand, CreateMultipartUploadCommand, S3Client} from "@aws-sdk/client-s3";
import UploadInfo from "../types/UploadInfo";
import {CompletedPart} from "aws-sdk/clients/s3";
import {S3} from "aws-sdk";

const AWS = require('aws-sdk');

class UploadService {

    private s3: S3Client;
    private s3v2: S3;

    constructor() {
        this.s3 = new S3Client({ region: process.env.AWS_REGION });
        this.s3v2 = new S3();
    }

    public async startUpload(parts: number, contentType: string): Promise<UploadInfo> {
        const fileId = uuidv4();

        const createMultipartUploadCommand = new CreateMultipartUploadCommand({
            Bucket: process.env.FILE_BUCKET as string,
            Key: 'a/' + fileId,
            ContentType: contentType
        });

        const createUploadResponse = await this.s3.send(createMultipartUploadCommand);

        const partUrls = await Promise.all(
            [...Array(parts).keys()]
            .map(partNumber =>
                this.s3v2.getSignedUrlPromise('uploadPart', {
                    Bucket: process.env.FILE_BUCKET as string,
                    Key: 'a/' + fileId,
                    UploadId: createUploadResponse.UploadId,
                    PartNumber: partNumber + 1,
                    Expires: 60*60*24
                })
            )
        );

        return {
            uploadId: createUploadResponse.UploadId as string,
            fileId: fileId,
            partUrls: partUrls
        };
    }

    public async finishUpload(uploadId: string, fileId: string, parts: CompletedPart[]): Promise<void> {
        const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
            Bucket: process.env.FILE_BUCKET as string,
            Key: 'a/' + fileId,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts
            },
        });

        await this.s3.send(completeMultipartUploadCommand);
    }
}

export const uploadService = new UploadService();