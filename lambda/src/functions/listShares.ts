import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {
    DynamoDBClient,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";
import {tracer} from "../services/Tracer";
import {injectLambdaContext} from "@aws-lambda-powertools/logger";
import {logger} from "../services/Logger";
import {DateTime} from "luxon";

import middy from "@middy/core";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import errorLogger from "@middy/error-logger";
import authorizationMiddleware from "../services/AuthorizationMiddleware";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpContentNegotiation from "@middy/http-content-negotiation";
import httpResponseSerializerMiddleware from "@middy/http-response-serializer";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient({region: process.env.AWS_REGION}));

const lambdaHandler = async function listSharesHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const queryCommand = new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: 'user-index',
        ProjectionExpression: 'PK,title,created,expire,#t,clicks',
        FilterExpression: 'attribute_not_exists(uploadId) or #t = :req',
        KeyConditionExpression: '#u = :sub',
        ExpressionAttributeNames: {
            '#t': 'type',
            '#u': 'user'
        },
        ExpressionAttributeValues: {
            ':sub': {
                S: event.requestContext.authorizer?.jwt.claims.sub as string
            },
            ':req': {
                S: 'FILE_REQUEST'
            }
        }
    });


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
        .filter(value => DateTime.fromSeconds(Number(value.expire.N)) > DateTime.now())
        .map(value => {
            return {
                id: value.PK.S?.replace('SHARE#', ''),
                title: value.title.S,
                type: value.type.S,
                created: DateTime.fromSeconds(Number(value.created?.N)).toISO(),
                expire: DateTime.fromSeconds(Number(value.expire.N)).toISO(),
                clicks: Object.entries(value.clicks.M!).reduce((result, [date, clickValue]) => {
                    result[date] = parseInt(clickValue.N!);
                    return result;
                }, {} as {[date: string] : number})
            };
        }
    );

    return {
        statusCode: 200,
        body: {
            shares
        } as any
    };
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(authorizationMiddleware())
    .use(httpHeaderNormalizer())
    .use(httpContentNegotiation())
    .use(
        httpResponseSerializerMiddleware({
            serializers: [
                {
                    regex: /^application\/json$/,
                    serializer: ({ body }) => JSON.stringify(body)
                }
            ],
            defaultContentType: 'application/json'
        })
    )