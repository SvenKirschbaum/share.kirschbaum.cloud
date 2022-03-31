import {
    DynamoDBStreamEvent,
    DynamoDBStreamHandler
} from "aws-lambda";
import {DeleteObjectCommand, S3Client} from "@aws-sdk/client-s3";
import middy from "@middy/core";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";
import {tracer} from "../../services/Tracer";

const s3 = tracer.captureAWSv3Client(new S3Client({ region: process.env.AWS_REGION }));

const lambdaHandler: DynamoDBStreamHandler = async function onShareDeletion(event: DynamoDBStreamEvent): Promise<void> {
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


export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))