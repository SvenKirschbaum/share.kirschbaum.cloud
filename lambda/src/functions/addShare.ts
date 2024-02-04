import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {AttributeValue, DynamoDBClient, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {uploadService} from "../services/UploadService";
import {tracer} from "../services/Tracer";
import {logger} from "../services/Logger";
import {getRandomId} from "../util/randomId";
import {DateTime} from "luxon";
import {BadRequest, InternalServerError, UnprocessableEntity} from "http-errors"

import middy from "@middy/core";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";
import {injectLambdaContext} from "@aws-lambda-powertools/logger";
import httpJsonBodyParserMiddleware from '@middy/http-json-body-parser'
import httpResponseSerializerMiddleware from '@middy/http-response-serializer'
import validatorMiddleware from '@middy/validator'
import httpErrorHandlerMiddleware from '@middy/http-error-handler'
import errorLogger from '@middy/error-logger'
import httpContentNegotiation from '@middy/http-content-negotiation'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import authorizationMiddleware from "../services/AuthorizationMiddleware";

import eventSchemaValidator from '../schemas/AddShareRequestEvent.validator';
import {AddShareRequestDTO} from "../schemas/AddShareRequestDTO.interface";
import validationErrorJSONFormatter from "../util/exposeValidationErrorMiddleware";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient({region: process.env.AWS_REGION}));

const lambdaHandler = async function addShareHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const requestDto = event.body as unknown as AddShareRequestDTO;

    const itemContent: { [p: string]: AttributeValue } = {};
    const responseContent: { [p: string]: any} = {};

    if(requestDto.type === 'FILE') {
        const uploadInfo = await uploadService.startUpload(Math.ceil(requestDto.file.fileSize/1024/1024/200), requestDto.file.fileType);

        Object.assign(itemContent, {
            file: {
                S: uploadInfo.fileId
            },
            uploadId: {
                S: uploadInfo.uploadId
            },
            fileName: {
                S: requestDto.file.fileName
            },
            forceDownload: {
                BOOL: requestDto.forceDownload
            }
        });

        responseContent.uploadUrls = uploadInfo.partUrls;

    }
    else if (requestDto.type === 'LINK') {
        itemContent.link = {
            S: requestDto.link
        };
    }
    else if (requestDto.type === 'FILE_REQUEST') {
        if(requestDto.notifyOnUpload) {
            if(!process.env.EMAIL_DOMAIN) {
                throw new BadRequest('Email functionality is disabled');
            }

            const claims = event.requestContext.authorizer.jwt.claims;

            if(!claims.email || !claims.email_verified) {
                throw new BadRequest('Your need a verified email address to receive notifications')
            }

            itemContent.notifications = {
                L: [
                    {
                        S: claims.email as string
                    }
                ]
            }
        }
    }

    const expirationDate = DateTime.fromISO(requestDto.expires);

    if(expirationDate < DateTime.now()) {
        throw new UnprocessableEntity('The expiration Date must be in the future')
    }

    let retry = 0;

    while(retry < 3) {
        retry++;
        const id = getRandomId();
        const putItemCommand = new PutItemCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                'PK': {
                    S: 'SHARE#'+ id
                },
                'SK': {
                    S: 'SHARE#'+ id
                },
                'user': {
                    S: event.requestContext.authorizer?.jwt.claims.sub as string
                },
                'created': {
                    N: DateTime.now().toSeconds().toString()
                },
                'expire': {
                    N: expirationDate.toSeconds().toString()
                },
                'title': {
                    S: requestDto.title
                },
                'type': {
                    S: requestDto.type
                },
                'clicks': {
                    M: {}
                },
                ...itemContent
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });

        try {
            await ddb.send(putItemCommand);

            //Success
            return {
                statusCode: 201,
                body: {
                    shareId: id,
                    ...responseContent
                } as any
            };
        }
        catch (err) {
            //Log and retry
            tracer.addErrorAsMetadata(err as Error);
            logger.warn("Failed to save item in try " + (retry + 1), err as Error);
        }
    }

    //Fail after 3 tries
    logger.error("Failed to save item after 3 tries");
    throw new InternalServerError();
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(validationErrorJSONFormatter())
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(authorizationMiddleware())
    .use(httpHeaderNormalizer())
    .use(httpContentNegotiation())
    .use(httpJsonBodyParserMiddleware())
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
    .use(validatorMiddleware({ eventSchema: eventSchemaValidator }))
