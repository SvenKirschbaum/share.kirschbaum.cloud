import {
    Handler
} from "aws-lambda";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {createGunzip} from "zlib";
// @ts-ignore
import CloudFrontParser from 'cloudfront-log-parser'
import LogSubmittedEvent from "../../../types/LogSubmittedEvent";
import {ClickData, ClickDataMap} from "../../../types/ClickData";
import middy from "@middy/core";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";
import {tracer} from "../../../services/Tracer";

const s3 = tracer.captureAWSv3Client(new S3Client({ region: process.env.AWS_REGION }));

const pathRegex = /\/d\/(\w+)/;

const lambdaHandler: Handler = async function processLogs(event: LogSubmittedEvent): Promise<ClickData> {
    const clickData: ClickDataMap = new Map();

    const getObjectCommand = new GetObjectCommand({
        Bucket: event.bucketName,
        Key: event.objectKey
    });

    const getObjectCommandOutput = await s3.send(getObjectCommand);

    getObjectCommandOutput.Body

    for await (const data of getObjectCommandOutput.Body.pipe(createGunzip()).pipe(new CloudFrontParser())) {
        const match = data['cs-uri-stem'].match(pathRegex);
        if(match) {
            const key = match[1] + '-' + data['date'];

            const clickDatum = clickData.get(key);
            if(clickDatum) {
                clickDatum.value++;
            }
            else clickData.set(key, {
                shareId: match[1],
                date: data['date'],
                value: 1
            });
        }
    }


    return Array.from(clickData.values());
}


export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))