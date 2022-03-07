import "reflect-metadata";

import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {AttributeValue, DynamoDBClient, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {transformAndValidateSync} from "class-transformer-validator";
import {AddShareRequestDto} from "./AddShareRequestDto";
import {getRandomId} from "./randomId";
import moment = require("moment");
import {uploadService} from "../../services/UploadService";

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});

export const handler = async function addShareHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
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

        const itemContent: { [p: string]: AttributeValue } = {};
        const responseContent: { [p: string]: any} = {};

        if(requestDto.type === 'FILE') {
            const uploadInfo = await uploadService.startUpload(Math.ceil(requestDto.fileSize/1024/1024/200), requestDto.fileType);

            Object.assign(itemContent, {
                file: {
                    S: uploadInfo.fileId
                },
                uploadId: {
                    S: uploadInfo.uploadId
                },
                fileName: {
                    S: requestDto.fileName
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

        const expirationDate = moment(requestDto.expires);

        if(expirationDate.isBefore(moment())) {
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
                    N: moment().unix().toString()
                },
                'expire': {
                    N: expirationDate.unix().toString()
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
        }
        catch (err) {
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