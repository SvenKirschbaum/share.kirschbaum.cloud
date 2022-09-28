import {APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, DeleteItemCommand} from "@aws-sdk/client-dynamodb";
import {tracer} from "../services/Tracer";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer";
import {injectLambdaContext} from "@aws-lambda-powertools/logger";
import {logger} from "../services/Logger";

import middy from "@middy/core";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import errorLogger from "@middy/error-logger";
import authorizationMiddleware from "../services/AuthorizationMiddleware";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpContentNegotiation from "@middy/http-content-negotiation";
import httpResponseSerializerMiddleware from "@middy/http-response-serializer";
import {BadRequest} from "http-errors";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient({region: process.env.AWS_REGION}));

const lambdaHandler = async function deleteShareHandler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
    const id = event.pathParameters?.id;

    if(!id) {
        throw new BadRequest('The provided Id is invalid');
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

    await ddb.send(deleteItemCommand);

    return {
        statusCode: 200
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