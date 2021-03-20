import "reflect-metadata";

import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {AttributeValue, DynamoDBClient, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {transformAndValidateSync} from "class-transformer-validator";
import {v4 as uuidv4} from 'uuid';
import {createPresignedPost} from "@aws-sdk/s3-presigned-post";
import {S3Client} from "@aws-sdk/client-s3";
import {AddShareRequestDto} from "./AddShareRequestDto";
import {getRandomId} from "./randomId";
import moment = require("moment");

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});
const s3 = new S3Client({ region: process.env.AWS_REGION });

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

        let fileid : string | undefined = undefined;
        let uploadUrl : string | undefined = undefined;
        let fields : object | undefined = undefined;
        const content: { [p: string]: AttributeValue } = {};

        if(requestDto.type === 'FILE') {
            fileid = uuidv4();
            content.file = {
                S: fileid
            }

            const presignedPost = await createPresignedPost(
                s3,
                {
                    Bucket: process.env.FILE_BUCKET as string,
                    Key: 'a/' + fileid,
                    Expires: 300,
                    Conditions: [
                        ["starts-with", "$Content-Type", ""]
                    ]
                }
            );

            uploadUrl = presignedPost.url;
            fields = presignedPost.fields;
        }
        else {
            content.link = {
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
                'expire': {
                    N: expirationDate.unix().toString()
                },
                'title': {
                    S: requestDto.title
                },
                'type': {
                    S: requestDto.type
                },
                ...content
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
                uploadUrl,
                fields
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