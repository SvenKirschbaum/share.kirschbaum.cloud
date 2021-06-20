import {
    S3CreateEvent,
    S3Handler,
} from "aws-lambda";
import {StepFunctions} from "aws-sdk";
import LogSubmittedEvent from "../../../types/LogSubmittedEvent";

const stepFunctions = new StepFunctions();

export const handler: S3Handler = async function submitLogAnalysis(event: S3CreateEvent): Promise<void> {
    await Promise.all(
        event.Records.map(async record => {
            if(record.eventName.startsWith('ObjectCreated:')) {
                const eventData: LogSubmittedEvent = {
                    bucketName: record.s3.bucket.name,
                    objectKey: record.s3.object.key
                };

                await stepFunctions.startExecution({
                    input: JSON.stringify(eventData),
                    name: `${record.s3.object.key}-${record.s3.object.eTag}`,
                    stateMachineArn: process.env.LOG_PARSING_STATE_MACHINE as string
                }).promise();
            }
        })
    );
}