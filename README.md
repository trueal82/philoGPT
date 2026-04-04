# PhiloGPT

PhiloGPT is a full-stack multi-bot chat platform with:

- User-facing chat frontend (React + Vite)
- Admin frontend for content/config management
- API service (Express + Socket.IO + MongoDB)
- Startup seeding for demo/default data

## Repository Layout

```
.
├── api/             # TypeScript API + Socket.IO + seed logic
├── user-frontend/       # React/Vite chat UI + runtime config server
├── admin-frontend/      # Legacy admin UI (kept for reference)
├── admin-frontend-new/  # Active admin UI (React-admin) + runtime config server
├── docker-compose.yml   # Service topology (parameterized via root .env)
├── .env.example         # Deployment variable template
├── start-api.sh
├── start-user-frontend.sh
├── start-admin.sh       # Starts active admin frontend
├── start-mongodb.sh
└── SYNOLOGY.md          # Synology deployment guide
```

## Architecture Overview

- API listens internally on container port `5001`.
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
docker compose logs api --tail=40
```

## Environment Model

The project uses a single root `.env` file for Compose substitution. `docker-compose.yml` references values with `${VAR}` so the compose file itself stays static.

Important variables:

- `FRONTEND_URL`: public chat URL (used in API CORS)
- `ADMIN_URL`: public admin URL (used in API CORS)
- `API_URL`: public API URL (injected into both frontends)
- `API_PORT`, `FRONTEND_PORT`, `ADMIN_PORT`, `MONGO_PORT`: host port mappings
- `SEED_ON_EMPTY_DB`: seed when DB is empty
- `PURGE_AND_RESEED`: one-shot destructive reseed flag

## Seeding Behavior

Seeding is owned by the API startup flow:

- If `SEED_ON_EMPTY_DB=true`, API seeds when database is empty.
- If `PURGE_AND_RESEED=true`, API drops app collections and reseeds.

After a purge run, set `PURGE_AND_RESEED=false` again.

### Versioned seed patches

Every startup the API runs a seed-version check:

1. If no `SeedVersion` record exists (fresh DB, or existing DB upgrading to the versioned system), the current baseline (`v1.0`) is stamped automatically — no data is touched.
2. Any patches registered in `api/src/scripts/seedPatches.ts` that have an `apply()` function and are not yet recorded are applied in version order, then stamped.

This means **seed migrations run automatically on startup** as long as the new image is deployed — no manual database intervention is needed for typical updates.

The applied versions are visible in the admin panel under **Maintenance → Seed Versions**.

---

## Updating a Deployed Instance

This describes the standard update workflow when running under Docker Compose.

### Standard update (no destructive data change)

Pull the new code and redeploy. The API will apply any pending seed patches on startup.

```bash
git pull
docker compose build
docker compose up -d
```

The API container restarts, connects to the existing MongoDB data, stamps any missing seed-version entries, and applies pending patches. **No data is lost.**

Verify the update completed cleanly:

```bash
docker compose logs api --tail=60
```

Look for a line like:
```
INFO  Seed versioning check complete  current="1.1" applied=["1.0","1.1"]
```

### Updating environment variables only

If you only changed values in `.env` (e.g. `LOG_LEVEL`, `LLM_LOG_TTL_DAYS`, URLs):

```bash
docker compose up -d --force-recreate
```

No rebuild is needed; Compose re-reads the env file when containers restart.

### Forcing a full reseed (destructive)

Only use this if you want to **wipe all app data** and start fresh (e.g. development/staging reset).

Pass the flag as an inline variable so `.env` is never modified and no reset step is needed.

Without `sudo`:
```bash
PURGE_AND_RESEED=true docker compose up -d --force-recreate api
```

With `sudo` (Synology / restricted environments) — use `sudo env` so the variable survives sudo's environment stripping:
```bash
sudo env PURGE_AND_RESEED=true docker compose up -d --force-recreate api
```

The variable only applies to that single invocation. The next `docker compose up -d` reads `.env` again (`PURGE_AND_RESEED=false`), so the flag cannot accidentally persist.

`--force-recreate` is required because Compose only recreates a container when its image changes; without it, an env-only change is silently ignored.

Verify the reseed completed:

```bash
docker compose logs api --tail=60
```

> **Warning:** `PURGE_AND_RESEED=true` drops all app collections including users, sessions, memories, and logs. Never run this against a production database unless you intend to lose all data.

### Adding a seed patch (for developers)

When a new version needs a data migration:

1. Add an entry to `SEED_PATCHES` in `api/src/scripts/seedPatches.ts`:
   ```ts
   {
     version: '1.1',
     description: 'Short description of what changed',
     apply: async () => {
       // migration logic here — runs exactly once per database
     },
   }
   ```
2. Update `CURRENT_VERSION` in the same file to `'1.1'`.
3. Deploy as a standard update (`docker compose build && docker compose up -d`). The patch runs automatically on the next startup.

Patches without an `apply()` are baseline markers only (no code runs). Patches are applied in array order; do not reorder or remove existing entries.

## Local Development (Without Docker)

Run services in separate terminals from repo root:

```bash
./start-mongodb.sh
./start-api.sh
./start-user-frontend.sh
./start-admin.sh
```

Notes:

- `start-api.sh` runs from `api/`, so API env vars must be available there (for example via `api/.env` or exported shell variables).
- At minimum, API requires `JWT_SECRET`; typically you also set `MONGODB_URI` and `ALLOWED_ORIGINS`.
- `start-admin.sh` starts the active admin frontend on `3001`.
- `start-user-frontend.sh` starts user frontend dev server.
- `start-api.sh` starts API in watch mode on `5001`.

To stop common local listeners:

```bash
./kill_all.sh
```

## API Scripts

From `api/`:

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

Or from `api/`:

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

From `admin-frontend-new/`:

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
