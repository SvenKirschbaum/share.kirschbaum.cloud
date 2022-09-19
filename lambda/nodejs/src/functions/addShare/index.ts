import "reflect-metadata";

import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {AttributeValue, DynamoDBClient, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {transformAndValidateSync} from "class-transformer-validator";
import {AddShareRequestDto} from "./AddShareRequestDto";
import {getRandomId} from "./randomId";
import {uploadService} from "../../services/UploadService";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";
import middy from "@middy/core";
import {tracer} from "../../services/Tracer";
import {injectLambdaContext} from "@aws-lambda-powertools/logger";
import {logger} from "../../services/Logger";
import {DateTime} from "luxon";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient({region: process.env.AWS_REGION}));

const lambdaHandler = async function addShareHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const claims = event.requestContext.authorizer.jwt.claims;
    const roles = claims.roles as string[] | undefined;

    if(!roles?.includes('member')) {
        return {
            statusCode: 403
        };
    }

    try {
        const requestDto = transformAndValidateSync(AddShareRequestDto, event.body as string, {
            validator: {
                validationError: {
                    target: false
                },
                forbidUnknownValues: true
            }
        }) as AddShareRequestDto;

        if(requestDto.notifyOnUpload && !process.env.EMAIL_DOMAIN) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "message": 'Email functionality is disabled'
                })
            };
        }

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
                if(!claims.email || !claims.email_verified) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: 'Your need a verified email address to receive notifications.'
                        })
                    };
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
            return {
                statusCode: 422,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'The expiration Date must be in the future'
                })
            };
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
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        shareId: id,
                        ...responseContent
                    })
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
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal error'
            })
        };
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
    .use(injectLambdaContext(logger))