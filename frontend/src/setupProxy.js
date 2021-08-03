const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
    app.use(
        '/api',
        createProxyMiddleware({
            target: 'localhost',//'https://share.kirschbaum.cloud',
            changeOrigin: true,
        })
    );
};