import {
    S3CreateEvent,
    S3Handler,
} from "aws-lambda";
import LogSubmittedEvent from "../types/LogSubmittedEvent";
import middy from "@middy/core";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {tracer} from "../services/Tracer";
import {SFNClient, StartExecutionCommand} from "@aws-sdk/client-sfn";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {logger} from "../services/Logger";
import errorLogger from "@middy/error-logger";

const sfnClient = tracer.captureAWSv3Client(new SFNClient({ region: process.env.AWS_REGION }));

const lambdaHandler: S3Handler = async function submitLogAnalysis(event: S3CreateEvent): Promise<void> {
    await Promise.all(
        event.Records.map(async record => {
            if(record.eventName.startsWith('ObjectCreated:')) {
                const eventData: LogSubmittedEvent = {
                    bucketName: record.s3.bucket.name,
                    objectKey: record.s3.object.key
                };

                const startCommand = new StartExecutionCommand({
                    input: JSON.stringify(eventData),
                    name: `${record.s3.object.key}-${record.s3.object.eTag}`,
                    stateMachineArn: process.env.LOG_PARSING_STATE_MACHINE as string
                });

                await sfnClient.send(startCommand);
            }
        })
    );
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(errorLogger())