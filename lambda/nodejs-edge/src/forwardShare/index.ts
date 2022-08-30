import {
    CloudFrontRequestEvent,
    CloudFrontRequestResult
} from "aws-lambda";
import {DynamoDBClient, GetItemCommand} from "@aws-sdk/client-dynamodb";
import moment = require("moment");
import {CloudFrontRequestHandler} from "aws-lambda/trigger/cloudfront-request";
import {response404, response500} from "./responses";
import {injectLambdaContext, Logger} from "@aws-lambda-powertools/logger";
import middy from "@middy/core";

const logger = new Logger();

let _ddb: DynamoDBClient | undefined = undefined;
function getDDB(region: string) {
    if(_ddb) return _ddb;
    _ddb = new DynamoDBClient({region});
    return _ddb;
}

const idRegex = /^\/d\/([a-zA-Z\d]{6})$/;
const RFC2822_DATE_FORMAT = "ddd, DD MMM YYYY HH:mm:ss [GMT]";

export const lambdaHandler: CloudFrontRequestHandler = async function forwardShareHandler(event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> {
    const request = event.Records[0].cf.request;
    const tableName = request.origin?.s3?.customHeaders['x-table-name'][0].value;
    const tableRegion = request.origin?.s3?.customHeaders['x-table-region'][0].value;
    const match = idRegex.exec(request.uri)
    const ddb = getDDB(tableRegion as string);

    if(match === null) {
        return response404;
    }

    const id = match[1];
    const getItemCommand = new GetItemCommand({
        TableName: tableName,
        Key: {
            'PK': {
                S: 'SHARE#'+ id
            },
            'SK': {
                S: 'SHARE#'+ id
            },
        }
    });

    try {
        const itemResult = await ddb.send(getItemCommand);

        const share = itemResult.Item;

        if(!share) {
            return response404;
        }

        const expiration = moment.unix(Number(share.expire.N));

        if(expiration.isBefore(moment()) || share.uploadId || share.type.S === 'FILE_REQUEST') {
            return response404;
        }

        if(share.type.S === 'LINK') {
            return {
                status: '301',
                headers: {
                    'expires': [
                        {
                            value: expiration.locale("en").utc().format(RFC2822_DATE_FORMAT)
                        }
                    ],
                    'location': [
                        {
                            value: share.link.S as string
                        }
                    ]
                }
            }
        }

        const title = share.title.S;
        const fileName = share.fileName?.S;
        const forceDownload = share.forceDownload?.BOOL;

        request.uri = `/${share.file.S}`;
        request.querystring = new URLSearchParams({
            'response-content-disposition': `${forceDownload ? 'attachment' : 'inline'}; filename="${fileName ?? title}"`,
            'response-expires': expiration.locale("en").utc().format(RFC2822_DATE_FORMAT)
        }).toString();

        return request;
    }
    catch (err) {
        logger.error("Error processing request", err as Error);
        return response500;
    }
}

export const handler = middy(lambdaHandler)
    .use(injectLambdaContext(logger))