import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, QueryCommand, ScanCommand} from "@aws-sdk/client-dynamodb";
import moment = require("moment");

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});

export const handler = async function listSharesHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const roles = event.requestContext.authorizer?.jwt.claims.roles as string[] | undefined;

    if(!roles?.includes('member')) {
        return {
            statusCode: 403
        };
    }

    const queryCommand = new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: 'user-index',
        ProjectionExpression: 'id,title,expire,#t',
        FilterExpression: 'attribute_not_exists(uploadId)',
        KeyConditionExpression: '#u = :sub',
        ExpressionAttributeNames: {
            '#t': 'type',
            '#u': 'user'
        },
        ExpressionAttributeValues: {
            ':sub': {
                S: event.requestContext.authorizer?.jwt.claims.sub as string
            }
        }
    });

    try {
        const queryResult = await ddb.send(queryCommand);

        const shareItems = queryResult.Items || [];

        const shares = shareItems
            .filter(value => moment.unix(Number(value.expire.N)).isAfter(moment()))
            .map(value => {
                return {
                    id: value.id.S,
                    title: value.title.S,
                    type: value.type.S
                };
            }
        );

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                shares
            })
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