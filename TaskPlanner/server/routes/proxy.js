/**
 * Proxy Routes — forwards requests to the Aithon FastAPI backend.
 * The Node.js server acts as the unified API gateway; all /api/aithon/*
 * requests are transparently forwarded to FastAPI running on port 8000.
 * The gateway injects the Authorization header from the aithon_token
 * stored in the browser's localStorage and sent as a request header.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

const FASTAPI_BASE = process.env.FASTAPI_URL || 'http://localhost:8000';

/**
 * Build a proxy middleware instance that:
 *  1. Strips the /api/aithon prefix before forwarding.
 *  2. Passes through any Authorization header the frontend already set.
 *  3. Forwards cookies (for future unified session support).
 */
const aithonProxy = createProxyMiddleware({
  target: FASTAPI_BASE,
  changeOrigin: true,
  // Rewrite: /api/aithon/dataset/upload → /dataset/upload
  pathRewrite: { '^/api/aithon': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      // Forward the aithon bearer token if the client sent it
      const aithonToken = req.headers['x-aithon-token'];
      if (aithonToken) {
        proxyReq.setHeader('Authorization', `Bearer ${aithonToken}`);
      }
    },
    error: (err, req, res) => {
      console.error('[Proxy] Error forwarding to FastAPI:', err.message);
      res.status(502).json({ error: 'Aithon service unavailable', detail: err.message });
    },
  },
});

module.exports = { aithonProxy };
