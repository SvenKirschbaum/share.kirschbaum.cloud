import {
    DynamoDBStreamEvent,
    DynamoDBStreamHandler
} from "aws-lambda";
import {DeleteObjectCommand, S3Client} from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });


export const handler: DynamoDBStreamHandler = async function onShareDeletion(event: DynamoDBStreamEvent): Promise<void> {
    await Promise.all(
        event.Records.map(async record => {
            if(record.eventName === 'REMOVE') {
                if(record.dynamodb?.OldImage?.file) {
                    const deleteItemCommand = new DeleteObjectCommand({
                        Bucket: process.env.FILE_BUCKET,
                        Key: 'a/' + record.dynamodb.OldImage.file.S
                    });

                    await s3.send(deleteItemCommand);
                }
            }
        })
    );
}