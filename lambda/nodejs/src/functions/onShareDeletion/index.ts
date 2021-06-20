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
                            Key: 'a/' +entry?.file.S
                        });

                        await s3.send(deleteItemCommand);
                    }

                    const queryCommand = new QueryCommand({
                        TableName: process.env.TABLE_NAME,
                        KeyConditionExpression: 'PK = :pk',
                        ExpressionAttributeValues: {
                            ':pk': {
                                S: entry?.SK.S
                            }
                        },
                        ProjectionExpression: 'PK,SK',
                        Limit: 25
                    });

                    let queryCommandOutput;
                    const deletePromises = [];
                    do {
                        queryCommandOutput = await ddb.send(queryCommand);
                        if(queryCommandOutput.LastEvaluatedKey) queryCommand.input.ExclusiveStartKey = queryCommandOutput.LastEvaluatedKey;

                        if(queryCommandOutput.Items && queryCommandOutput.Items.length > 0) {
                            const batchDelete = new BatchWriteItemCommand({
                                RequestItems: {
                                    [process.env.TABLE_NAME as string]: queryCommandOutput.Items.map((e) => ({
                                        DeleteRequest: {
                                            Key: e
                                        }
                                    }))
                                }
                            });

                            deletePromises.push(ddb.send(batchDelete));
                        }
                    }while (queryCommandOutput.LastEvaluatedKey);

                    await Promise.all(deletePromises);
                }
            }
        })
    );
}