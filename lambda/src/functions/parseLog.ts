import {
    Handler
} from "aws-lambda";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {createGunzip} from "zlib";
import { createHash } from "crypto";
// @ts-ignore
import CloudFrontParser from 'cloudfront-log-parser'
import LogSubmittedEvent from "../types/LogSubmittedEvent";
import {ClickData, ClickDataMap} from "../types/ClickData";
import middy from "@middy/core";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {tracer} from "../services/Tracer";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {logger} from "../services/Logger";
import errorLogger from "@middy/error-logger";

const s3 = tracer.captureAWSv3Client(new S3Client({ region: process.env.AWS_REGION }));

const pathRegex = /^\/d\/([a-zA-Z\d]{6})$/;

const COUNTED_STATUSES = new Set([200, 206, 301, 302, 304]);

function sha256Hex(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

const lambdaHandler: Handler = async function processLogs(event: LogSubmittedEvent): Promise<ClickData> {
    const clickData: ClickDataMap = new Map();
    const seenInLogFile = new Set<string>();

    const getObjectCommand = new GetObjectCommand({
        Bucket: event.bucketName,
        Key: event.objectKey
    });

    const getObjectCommandOutput = await s3.send(getObjectCommand);

    if(!getObjectCommandOutput.Body) throw new Error('No file Content');

    // @ts-ignore
    for await (const data of getObjectCommandOutput.Body.pipe(createGunzip()).pipe(new CloudFrontParser())) {
        const uriStem = data["cs-uri-stem"] as string | undefined;
        if(!uriStem) continue;

        const match = uriStem.match(pathRegex);
        if(!match) continue;

        const method = (data["cs-method"] as string | undefined) ?? "";
        if(method !== "GET") continue;

        const statusRaw = data["sc-status"] as string | undefined;
        const status = statusRaw ? parseInt(statusRaw, 10) : NaN;
        if(!Number.isFinite(status) || !COUNTED_STATUSES.has(status)) continue;

        const shareId = match[1];
        const date = data["date"] as string | undefined;
        if(!date) continue;

        const ip = (data["c-ip"] as string | undefined) ?? "";
        const userAgent = (data["cs-user-agent"] as string | undefined) ?? "";
        const viewerHash = sha256Hex(`${ip}\n${userAgent}`);

        // Deduplicate per delivered CloudFront log file: count each viewer once per share/day.
        const seenKey = `${shareId}|${date}|${viewerHash}`;
        if(seenInLogFile.has(seenKey)) continue;
        seenInLogFile.add(seenKey);

        const key = `${shareId}-${date}`;
        const clickDatum = clickData.get(key);
        if(clickDatum) {
            clickDatum.value++;
        }
        else {
            clickData.set(key, {
                shareId,
                date,
                value: 1
            });
        }
    }

    return Array.from(clickData.values());
}


export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(errorLogger())
