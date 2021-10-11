import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import {DynamoDBClient, GetItemCommand} from "@aws-sdk/client-dynamodb";
import {getSigner} from "./signer";
import moment = require("moment");

const ddb = new DynamoDBClient({region: process.env.AWS_REGION});

const RFC2822_DATE_FORMAT = "ddd, DD MMM YYYY HH:mm:ss [GMT]";

function fixedEncodeURIComponent(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}

export const handler = async function forwardShareHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const id = event.pathParameters?.id;

    if(!id) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'THe provided Id is invalid'
            })
        };
    }

    const getItemCommand = new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
            'PK': {
                S: 'SHARE#'+ id
            },
            'SK': {
                S: 'SHARE#'+ id
            },
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

        const expiration = moment.unix(Number(share.expire.N));

        if(expiration.isBefore(moment()) || share.uploadId) {
            return {
                statusCode: 404
            };
        }

        if(share.type.S === 'LINK') {
            return {
                statusCode: 301,
                headers: {
                    'Expires': expiration.locale("en").utc().format(RFC2822_DATE_FORMAT),
                    'Location': share.link.S as string
                }
            };
        }

        const signer = await getSigner();
        const title = share.title.S;

        const signedUrl = signer.getSignedUrl({
            url: 'https://' + process.env.DOMAIN + '/a/' + share.file.S + '?response-content-disposition=' + fixedEncodeURIComponent(`inline; filename="${title}"`),
            expires: expiration.unix(),
        })

        return {
            statusCode: 303,
            headers: {
                'Expires': expiration.locale("en").utc().format(RFC2822_DATE_FORMAT),
                'Location': signedUrl
            }
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