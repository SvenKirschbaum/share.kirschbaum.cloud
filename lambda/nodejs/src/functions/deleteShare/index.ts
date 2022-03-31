import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, DeleteItemCommand} from "@aws-sdk/client-dynamodb";
import {tracer} from "../../services/Tracer";
import middy from "@middy/core";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient({region: process.env.AWS_REGION}));

const lambdaHandler = async function deleteShareHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const roles = event.requestContext.authorizer?.jwt.claims.roles as string[] | undefined;

    if(!roles?.includes('member')) {
        return {
            statusCode: 403
        };
    }

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

    const deleteItemCommand = new DeleteItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
            'PK': {
                S: 'SHARE#'+ id
            },
            'SK': {
                S: 'SHARE#'+ id
            },
        },
        ConditionExpression: '#u = :sub',
        ExpressionAttributeNames: {
            '#u': 'user'
        },
        ExpressionAttributeValues: {
            ':sub': {
                S: event.requestContext.authorizer?.jwt.claims.sub as string
            }
        }
    });

    try {
        await ddb.send(deleteItemCommand);

        return {
            statusCode: 200
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

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))