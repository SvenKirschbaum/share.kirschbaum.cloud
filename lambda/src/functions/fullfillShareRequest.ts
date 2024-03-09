import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, GetItemCommand, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {uploadService} from "../services/UploadService";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {tracer} from "../services/Tracer";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {logger} from "../services/Logger";
import {DateTime} from "luxon";
import {BadRequest, NotFound} from "http-errors";
import {FileInfo} from "../schemas/FileInfo.interface";

import middy from "@middy/core";
import validateFileInfo from "../schemas/FileInfo.validator"
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import errorLogger from "@middy/error-logger";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpContentNegotiation from "@middy/http-content-negotiation";
import httpJsonBodyParserMiddleware from "@middy/http-json-body-parser";
import httpResponseSerializerMiddleware from "@middy/http-response-serializer";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient({region: process.env.AWS_REGION}));

const lambdaHandler = async function fullfillShareRequestHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const id = event.pathParameters?.id;

    if(!id) {
        throw new BadRequest('The provided Id is invalid')
    }

    const getItemCommand = new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
            'PK': {
                S: 'SHARE#'+ id
            },
            'SK': {
                S: 'SHARE#'+ id
            },
        }
    });

    const itemResult = await ddb.send(getItemCommand);

    const share = itemResult.Item;

    if(!share) {
        throw new NotFound();
    }

    const expiration = DateTime.fromSeconds(Number(share.expire.N));

    if(expiration < DateTime.now() || share.type.S !== 'FILE_REQUEST') {
        throw new NotFound();
    }

    if(event.requestContext.http.method === "GET") {
        return {
            statusCode: 200,
            body: {
                title: share.title.S
            } as any
        };
    } else {
        const requestDto = event.body as unknown as FileInfo;

        if(!validateFileInfo(requestDto)) throw new BadRequest();

        const uploadInfo = await uploadService.startUpload(Math.ceil(requestDto.fileSize / 1024 / 1024 / 200), requestDto.fileType);

        const putItemCommand = new PutItemCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                ...share,
                fileName: {
                    S: requestDto.fileName
                },
                file: {
                    S: uploadInfo.fileId
                },
                uploadId: {
                    S: uploadInfo.uploadId
                }
            }
        });

        await ddb.send(putItemCommand);

        return {
            statusCode: 200,
            body: {
                uploadUrls: uploadInfo.partUrls
            } as any
        }
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
    .use(httpContentNegotiation())
    .use(httpJsonBodyParserMiddleware({
        disableContentTypeError: true
    }))
    .use(
        httpResponseSerializerMiddleware({
            serializers: [
                {
                    regex: /^application\/json$/,
                    serializer: ({ body }) => JSON.stringify(body)
                }
            ],
            defaultContentType: 'application/json'
        })
    )
