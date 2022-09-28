import middy from '@middy/core'
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2
} from 'aws-lambda'
import {Forbidden} from "http-errors";

//TODO: Dynamic role
const middleware = (): middy.MiddlewareObj<APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2> => {
    const before: middy.MiddlewareFn<APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2> = async (
        request,
    ): Promise<void> => {
        const claims = request.event.requestContext.authorizer.jwt.claims;
        const roles = claims.roles as string[] | undefined;

        if(!roles?.includes('member')) {
            throw new Forbidden();
        }
    }

    return {
        before
    }
}

export default middleware