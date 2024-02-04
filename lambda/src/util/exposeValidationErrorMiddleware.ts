const validationErrorJSONFormatter = () => ({
    onError: (request: any) => {
        const response = request.response;
        const error = <any>request.error;
        if (response.statusCode != 400) return;
        if (!error.expose || !error.cause || !error.cause.data) return;
        response.headers["Content-Type"] = "application/json";
        response.body = JSON.stringify({ message: response.body, validationErrors: error.cause.data });
    },
});

export default validationErrorJSONFormatter;
