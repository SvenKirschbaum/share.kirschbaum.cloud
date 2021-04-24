import "reflect-metadata";

import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {AttributeValue, DynamoDBClient, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {transformAndValidateSync} from "class-transformer-validator";
import {AddShareRequestDto} from "./AddShareRequestDto";
import {getRandomId} from "./randomId";
import moment = require("moment");
import {uploadService} from "../../services/UploadService";

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});

export const handler = async function addShareHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const roles = event.requestContext.authorizer?.jwt.claims.roles as string[] | undefined;

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
                }
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
                }
            });

            responseContent.uploadUrls = uploadInfo.partUrls;

        }
        else {
            itemContent.link = {
                S: requestDto.link
            };
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
                'id': {
                    S: id
                },
                'user': {
                    S: event.requestContext.authorizer?.jwt.claims.sub as string
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