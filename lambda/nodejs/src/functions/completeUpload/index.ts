import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, GetItemCommand, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {uploadService} from "../../services/UploadService";
import {transformAndValidateSync} from "class-transformer-validator";
import {CompleteUploadDto} from "./CompleteUploadDto";
import {SendBulkEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import moment = require("moment");
import {tracer} from "../../services/Tracer";
import middy from "@middy/core";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient({region: process.env.AWS_REGION}));
const ses = tracer.captureAWSv3Client(new SESv2Client({region: process.env.AWS_REGION}));

const lambdaHandler = async function completeUpload(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const id = event.pathParameters?.id;

    if(!id) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'The provided Id is invalid'
            })
        };
    }


    try {
        const requestDto = transformAndValidateSync(CompleteUploadDto, event.body as string, {
            validator: {
                validationError: {
                    target: false
                },
                forbidUnknownValues: true
            }
        }) as CompleteUploadDto;

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

        try {
            const itemResult = await ddb.send(getItemCommand);

            const share = itemResult.Item;

            if(!share) {
                return {
                    statusCode: 404
                };
            }

            if((share.type.S !== 'FILE' && share.type.S !== 'FILE_REQUEST') || !share.uploadId || (share.user.S !== event.requestContext.authorizer?.jwt?.claims?.sub && share.type.S !== 'FILE_REQUEST') ) {
                return {
                    statusCode: 409,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'There is no upload for the specified share id and user'
                    })
                };
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
                                    'SHARE_EXPIRATION': moment.unix(Number(share.expire.N)).format("dddd, MMMM Do YYYY, HH:mm:ss")
                                })
                            },
                        }
                    }))
                }
                catch (e) {
                    console.error(`Sending of Email notification failed for share ${id}`,e);
                }
            }

            return {
                statusCode: 201
            };
        }
        catch (err) {
            console.error(err);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Unable to connect to Database'
                })
            };
        }
    }
    catch (e) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(e)
        };
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))