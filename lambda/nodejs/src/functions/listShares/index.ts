import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {
    DynamoDBClient,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import moment = require("moment");

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});

export const handler = async function listSharesHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const roles = event.requestContext.authorizer?.jwt.claims.roles as string[] | undefined;

    if(!roles?.includes('member')) {
        return {
            statusCode: 403
        };
    }

    const queryCommand = new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: 'user-index',
        ProjectionExpression: 'PK,title,expire,#t,clicks',
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
        let queryCommandOutput;
        const shareItems = [];
        do {
            queryCommandOutput = await ddb.send(queryCommand);
            if(queryCommandOutput.LastEvaluatedKey) queryCommand.input.ExclusiveStartKey = queryCommandOutput.LastEvaluatedKey;

            if(queryCommandOutput.Items) {
                shareItems.push(...queryCommandOutput.Items);
            }
        }while (queryCommandOutput.LastEvaluatedKey);

        const shares = shareItems
            .filter(value => moment.unix(Number(value.expire.N)).isAfter(moment()))
            .map(value => {
                return {
                    id: value.PK.S?.replace('SHARE#', ''),
                    title: value.title.S,
                    type: value.type.S,
                    clicks: Object.entries(value.clicks.M!).reduce((result, [date, clickValue]) => {
                        result[date] = parseInt(clickValue.N!);
                        return result;
                    }, {} as {[date: string] : number})
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