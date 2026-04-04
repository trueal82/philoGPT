import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isDebug = LOG_LEVEL === 'debug';

// Expose runtime config to the browser before any static/catch-all middleware
app.get('/config', (_req, res) => {
    res.json({ apiUrl: process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001' });
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
                `[admin][debug] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
            );
        });
        next();
    });
}

// Serve static files from Vite build output
app.use(express.static(path.join(__dirname, 'dist')));

// Serve the main HTML file for all routes (SPA fallback)
app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Admin frontend (React-admin) running at http://localhost:${PORT} (LOG_LEVEL=${LOG_LEVEL})`);
});
