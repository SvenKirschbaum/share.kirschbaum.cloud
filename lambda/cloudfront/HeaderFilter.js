function handler(event) {
    var response = event.response;
    var headers = response.headers;

    // Set HTTP security headers
    // Since JavaScript doesn't allow for hyphens in variable names, we use the dict["key"] notation
    headers['strict-transport-security'] = { value: 'max-age=31536000; includeSubdomains; preload'};
    headers['x-content-type-options'] = { value: 'nosniff'};
    headers['x-frame-options'] = {value: 'DENY'};
    headers['x-xss-protection'] = {value: '1; mode=block'};
    headers['referrer-policy'] = {value: 'strict-origin-when-cross-origin'};
    headers['expect-ct'] = {value: 'enforce, max-age=15552000, report-uri="https://e12.report-uri.com/r/d/ct/enforce"'};

    // Return the response to viewers
    return response;
}