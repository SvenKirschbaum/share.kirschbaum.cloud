import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, DeleteItemCommand} from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});

export const handler = async function deleteShareHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
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

    const getItemCommand = new DeleteItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
            'id': {
                S: id
            }
        }
    });

    try {
        await ddb.send(getItemCommand);

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