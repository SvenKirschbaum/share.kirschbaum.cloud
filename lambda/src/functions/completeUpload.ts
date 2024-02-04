import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, GetItemCommand, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {uploadService} from "../services/UploadService";
import {SendBulkEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import {tracer} from "../services/Tracer";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";
import {injectLambdaContext} from "@aws-lambda-powertools/logger";
import {logger} from "../services/Logger";
import {DateTime} from "luxon";

import middy from "@middy/core";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import errorLogger from "@middy/error-logger";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpContentNegotiation from "@middy/http-content-negotiation";
import httpJsonBodyParserMiddleware from "@middy/http-json-body-parser";
import httpResponseSerializerMiddleware from "@middy/http-response-serializer";
import validatorMiddleware from "@middy/validator";

import eventSchemaValidator from "../schemas/CompleteUploadRequestEvent.validator";
import {BadRequest, Conflict, NotFound} from "http-errors";
import {CompleteUploadRequestDTO} from "../schemas/CompleteUploadRequestDTO.interface";
import validationErrorJSONFormatter from "../util/exposeValidationErrorMiddleware";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient({region: process.env.AWS_REGION}));
const ses = tracer.captureAWSv3Client(new SESv2Client({region: process.env.AWS_REGION}));


const lambdaHandler = async function completeUpload(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const id = event.pathParameters?.id;

    if(!id) {
        throw new BadRequest('The provided Id is invalid');
    }


    const requestDto = event.body as unknown as CompleteUploadRequestDTO;

    const getItemCommand = new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
            'PK': {
                S: 'SHARE#'+ id
            },
            'SK': {
                S: 'SHARE#'+ id
            }
        }
    });

    const itemResult = await ddb.send(getItemCommand);

    const share = itemResult.Item;

    if(!share) {
        throw new NotFound()
    }

    if((share.type.S !== 'FILE' && share.type.S !== 'FILE_REQUEST') || !share.uploadId || (share.user.S !== event.requestContext.authorizer?.jwt?.claims?.sub && share.type.S !== 'FILE_REQUEST') ) {
        throw new Conflict('There is no upload for the specified share id and user')
    }

    await uploadService.finishUpload(share.uploadId.S as string, share.file.S as string, requestDto.parts);

    const updatedShare = Object.assign({}, share);
    delete updatedShare.uploadId;
    delete updatedShare.notifications;
    updatedShare.type.S = 'FILE'

    const putItemCommand = new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: updatedShare
    });

    await ddb.send(putItemCommand);

    if(share.notifications?.L && process.env.EMAIL_DOMAIN) {
        try {
            await ses.send(new SendBulkEmailCommand({
                FromEmailAddress: "no-reply@" + process.env.EMAIL_DOMAIN,
                BulkEmailEntries: share.notifications.L.map(email => ({
                    Destination: {
                        ToAddresses: [email.S as string]
                    }
                })),
                DefaultContent: {
                    Template: {
                        TemplateName: 'REQUEST_FULFILLED_NOTIFICATION',
                        TemplateData: JSON.stringify({
                            'SHARE_TITLE': share.title.S,
                            'SHARE_URL': `https://${process.env.EMAIL_DOMAIN}/d/${id}`,
                            'SHARE_EXPIRATION': DateTime.fromSeconds(Number(share.expire.N)).toLocaleString(DateTime.DATETIME_SHORT)
                        })
                    },
                }
            }))
            logger.info("Sent notification emails");
        }
        catch (e) {
            tracer.addErrorAsMetadata(e as Error);
            logger.error(`Sending of Email notification failed`,e as Error);
        }
    }

    return {
        statusCode: 201
    };
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(validationErrorJSONFormatter())
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
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
