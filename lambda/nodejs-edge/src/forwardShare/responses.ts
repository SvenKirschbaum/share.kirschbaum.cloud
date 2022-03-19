import {CloudFrontResultResponse} from "aws-lambda";

export const response404: CloudFrontResultResponse = {
    status: '404',
    statusDescription: 'Not Found',
    headers: {
        'Content-Type': [
            {
                value: 'application/json'
            }
        ]
    },
    body: JSON.stringify({
        message: 'THe provided Id is invalid'
    })
}

export const response500: CloudFrontResultResponse = {
    status: '500',
    headers: {
        'Content-Type': [
            {
                value: 'application/json'
            }
        ]
    },
    body: JSON.stringify({
        message: 'Internal Error'
    })
};