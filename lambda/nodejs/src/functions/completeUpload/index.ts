import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, GetItemCommand, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {uploadService} from "../../services/UploadService";
import {transformAndValidateSync} from "class-transformer-validator";
import {CompleteUploadDto} from "./CompleteUploadDto";

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});

export const handler = async function completeUpload(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const roles = event.requestContext.authorizer?.jwt.claims.roles as string[] | undefined;

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

            if((share.type.S !== 'FILE' && share.type.S !== 'FILE_REQUEST') || !share.uploadId || (share.user.S !== event.requestContext.authorizer?.jwt.claims.sub && share.type.S !== 'FILE_REQUEST') ) {
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
            updatedShare.type.S = 'FILE'

            const putItemCommand = new PutItemCommand({
                TableName: process.env.TABLE_NAME,
                Item: updatedShare
            });

            await ddb.send(putItemCommand);


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