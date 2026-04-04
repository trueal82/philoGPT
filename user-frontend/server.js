import 'dotenv/config';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isDebug = LOG_LEVEL === 'debug';

// Serve runtime config before static middleware so it is never cached as a static file
app.get('/config.js', (_req, res) => {
    const apiUrl = process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001';
    const socketUrl = process.env.SOCKET_URL || 'http://localhost:5001';
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`window.__APP_CONFIG__ = ${JSON.stringify({ apiUrl, socketUrl })};`);
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
                `[user-frontend][debug] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
            );
        });
        next();
    });
}

// Serve built Vite output
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback — all unmatched routes serve index.html
app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`User frontend server running at http://localhost:${PORT} (LOG_LEVEL=${LOG_LEVEL})`);
});
