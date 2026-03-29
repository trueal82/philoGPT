# PhiloGPT

PhiloGPT is a full-stack multi-bot chat platform with:

- User-facing chat frontend (React + Vite)
- Admin frontend for content/config management
- Backend API (Express + Socket.IO + MongoDB)
- Startup seeding for demo/default data

## Repository Layout

```
.
├── backend/             # TypeScript API + Socket.IO + seed logic
├── user-frontend/       # React/Vite chat UI + runtime config server
├── admin-frontend/      # Admin UI + runtime config server
├── docker-compose.yml   # Service topology (parameterized via root .env)
├── .env.example         # Deployment variable template
├── start-backend.sh
├── start-user-frontend.sh
├── start-frontend.sh    # Starts admin frontend
├── start-mongodb.sh
└── SYNOLOGY.md          # Synology deployment guide
```

## Architecture Overview

- Backend listens internally on container port `5001`.
- User frontend listens on container port `3002`.
- Admin frontend listens on container port `3001`.
- MongoDB listens on container port `27017`.

Both frontends expose runtime config endpoints (`/config.js` for user frontend, `/config` for admin frontend). Those values are injected into the browser, so API URLs must be public/browser-reachable domains.

## Quick Start (Docker Compose)

### 1) Create the root environment file

```bash
cp .env.example .env
```

Edit `.env` and set at least:

- `FRONTEND_URL`
- `ADMIN_URL`
- `API_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### 2) Build and run

```bash
docker compose build
docker compose up -d
```

### 3) Verify

```bash
docker compose ps
docker compose logs backend --tail=40
```

## Environment Model

The project uses a single root `.env` file for Compose substitution. `docker-compose.yml` references values with `${VAR}` so the compose file itself stays static.

Important variables:

- `FRONTEND_URL`: public chat URL (used in backend CORS)
- `ADMIN_URL`: public admin URL (used in backend CORS)
- `API_URL`: public backend API URL (injected into both frontends)
- `BACKEND_PORT`, `FRONTEND_PORT`, `ADMIN_PORT`, `MONGO_PORT`: host port mappings
- `SEED_ON_EMPTY_DB`: seed when DB is empty
- `PURGE_AND_RESEED`: one-shot destructive reseed flag

## Seeding Behavior

Seeding is owned by the backend startup flow:

- If `SEED_ON_EMPTY_DB=true`, backend seeds when database is empty.
- If `PURGE_AND_RESEED=true`, backend drops app collections and reseeds.

After a purge run, set `PURGE_AND_RESEED=false` again.

## Local Development (Without Docker)

Run services in separate terminals from repo root:

```bash
./start-mongodb.sh
./start-backend.sh
./start-user-frontend.sh
./start-frontend.sh
```

Notes:

- `start-backend.sh` runs from `backend/`, so backend env vars must be available there (for example via `backend/.env` or exported shell variables).
- At minimum, backend requires `JWT_SECRET`; typically you also set `MONGODB_URI` and `ALLOWED_ORIGINS`.
- `start-frontend.sh` starts admin frontend on `3001`.
- `start-user-frontend.sh` starts user frontend dev server.
- `start-backend.sh` starts backend in watch mode on `5001`.

To stop common local listeners:

```bash
./kill_all.sh
```

## Backend Scripts

From `backend/`:

```bash
npm run dev        # ts-node runtime
npm run dev:watch  # nodemon + ts-node
npm run build      # compile TypeScript
npm start          # run dist/server.js
npm test           # jest (all tests)
npm run test:security  # security-focused integration tests
```

## Security Tests

The project includes automated security integration tests covering:

- **Authentication boundaries** — registration, login, locked accounts, JWT validation
- **Admin/user separation** — all admin endpoints reject unauthenticated and non-admin users
- **Data ownership** — users cannot access other users' sessions, messages, or memories
- **Bot entitlement** — subscription-based bot access control
- **OWASP checks** — IDOR, role escalation, input validation, invalid ObjectIds, security headers

Run from the repo root (no external MongoDB needed — uses in-memory server):

```bash
./run-security-tests.sh          # security tests only
./run-security-tests.sh --all    # all tests
```

Or from `backend/`:

```bash
npm run test:security
```

## Frontend Scripts

From `user-frontend/`:

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
```

From `admin-frontend/`:

```bash
npm start
```

## API Surface (High-Level)

- `/api/auth`: auth and token workflows
- `/api/bots`: bot catalog and bot configuration
- `/api/chat`: chat sessions and messages
- `/api/admin`: admin-only management endpoints
- `/health`: health check endpoint

## Deployment

For Synology NAS and reverse proxy setup, see `SYNOLOGY.md`.
