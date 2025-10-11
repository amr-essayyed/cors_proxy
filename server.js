const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3001; // Proxy server port

// CORS configuration for your React frontend
const corsOptions = {
    origin: ['http://localhost:5173', 'http://154.26.136.133:7777'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Enable CORS for all routes
app.use(cors(corsOptions));

// Parse JSON bodies with increased limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Proxy configuration
const proxyOptions = {
    target: 'http://154.26.136.133:10025',
    changeOrigin: true,
    timeout: 30000, // 30 second timeout
    proxyTimeout: 30000, // 30 second proxy timeout
    pathRewrite: {
        '^/api': '' // Remove /api prefix when forwarding to target
    },
    onProxyReq: function (proxyReq, req, res) {
        // Log the request for debugging
        console.log(`Proxying ${req.method} ${req.url} to ${proxyReq.path}`);

        // Set proper headers
        proxyReq.setHeader('Connection', 'keep-alive');

        // If it's a POST request, ensure content-length is set properly
        if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
        }
    },
    onProxyRes: function (proxyRes, req, res) {
        // Add CORS headers to the response - allow both origins
        const origin = req.headers.origin;
        if (origin === 'http://localhost:5173' || origin === 'http://154.26.136.133:7777') {
            proxyRes.headers['Access-Control-Allow-Origin'] = origin;
        }
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';

        console.log(`Response: ${proxyRes.statusCode} for ${req.url}`);
    },
    onError: function (err, req, res) {
        console.error('Proxy error:', err.message);
        console.error('Request URL:', req.url);
        console.error('Request method:', req.method);

        if (!res.headersSent) {
            res.status(502).json({
                error: 'Bad Gateway - Target server error',
                message: err.message,
                timestamp: new Date().toISOString()
            });
        }
    }
};

// Create proxy middleware
const proxy = createProxyMiddleware(proxyOptions);

// Use proxy for /api routes
app.use('/api', proxy);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Proxy server is running', port: PORT });
});

app.listen(PORT, () => {
    console.log(`CORS Proxy server running on http://localhost:${PORT}`);
    console.log(`Proxying requests to: http://154.26.136.133:10025`);
    console.log(`Frontend origins allowed: http://localhost:5173, http://154.26.136.133:7777`);
});