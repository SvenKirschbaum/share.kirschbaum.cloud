import {
    DynamoDBStreamEvent,
    DynamoDBStreamHandler
} from "aws-lambda";
import {DeleteObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {BatchWriteItemCommand, DynamoDBClient, QueryCommand} from "@aws-sdk/client-dynamodb";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ddb = new DynamoDBClient({region: process.env.AWS_REGION});


export const handler: DynamoDBStreamHandler = async function onShareDeletion(event: DynamoDBStreamEvent): Promise<void> {
    await Promise.all(
        event.Records.map(async record => {
            if(record.eventName === 'REMOVE') {
                const entry = record.dynamodb?.OldImage;
                if(entry?.SK.S?.startsWith('SHARE#')) {
                    if(entry?.file) {
                        const deleteItemCommand = new DeleteObjectCommand({
                            Bucket: process.env.FILE_BUCKET,
                            Key: entry?.file.S
                        });

                        await s3.send(deleteItemCommand);
                    }
                }
            }
        })
    );
}