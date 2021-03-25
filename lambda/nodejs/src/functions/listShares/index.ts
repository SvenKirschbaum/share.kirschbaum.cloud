import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, ScanCommand} from "@aws-sdk/client-dynamodb";
import moment = require("moment");

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});

export const handler = async function listSharesHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const roles = event.requestContext.authorizer?.jwt.claims.roles as string[] | undefined;

    if(!roles?.includes('member')) {
        return {
            statusCode: 403
        };
    }

    const scanCommand = new ScanCommand({
        TableName: process.env.TABLE_NAME,
        ProjectionExpression: 'id,title,expire,#t',
        ExpressionAttributeNames: {
            '#t': 'type'
        },
        FilterExpression: 'attribute_not_exists(uploadId)'
    });

    try {
        const scanResult = await ddb.send(scanCommand);

        const shareItems = scanResult.Items || [];

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