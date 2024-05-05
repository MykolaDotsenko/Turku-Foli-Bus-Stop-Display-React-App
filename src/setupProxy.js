// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use('/api', createProxyMiddleware({
    target: 'http://data.foli.fi',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '',
    },
  }));
};
