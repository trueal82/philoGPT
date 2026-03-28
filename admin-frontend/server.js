require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isDebug = LOG_LEVEL === 'debug';

// Expose runtime config to the browser before any static/catch-all middleware
app.get('/config', (_req, res) => {
    res.json({ apiUrl: process.env.BACKEND_URL || 'http://localhost:5001' });
});

// Security headers
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

if (isDebug) {
    app.use((req, res, next) => {
        const startedAt = Date.now();
        res.on('finish', () => {
            const durationMs = Date.now() - startedAt;
            console.log(
                `[frontend][debug] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
            );
        });
        next();
    });
}

// Serve static files from admin-frontend directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file for all routes (SPA fallback)
app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Admin frontend server running at http://localhost:${PORT} (LOG_LEVEL=${LOG_LEVEL})`);
});