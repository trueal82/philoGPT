# Running PhiloGPT on a Synology NAS

This guide covers deploying PhiloGPT on a Synology NAS using SSH to build and manage containers, and Web Station to expose the services via reverse proxy.

## Prerequisites

- DSM 7.2 or later
- **Docker** package installed (Container Manager)
- **Web Station** package installed
- SSH access enabled (*Control Panel → Terminal & SNMP → Enable SSH service*)
- Git installed on the NAS (via SynoCommunity or Entware)
- Your domain or DDNS hostname pointed at the NAS, with the following subdomains:
  - `philogpt.example.com` — user chat frontend
  - `philogpt-api.example.com` — backend API
  - `philogpt-admin.example.com` — admin frontend

---

## 1. Clone the repository

SSH into the NAS and clone the project into a persistent volume location:

```bash
ssh admin@<nas-ip>

cd /volume1
git clone https://github.com/youruser/philoGPT.git
cd philoGPT
```

---

## 2. Configure environment variables

All configuration lives in a single root `.env` file. `docker-compose.yml` references it via `${VAR}` substitution — no values are hardcoded there.

```bash
cd /volume1/philoGPT
cp .env.example .env
nano .env
```

**Values you must set:**

| Variable | What to set |
|---|---|
| `FRONTEND_URL` | Public URL of the chat frontend — `https://philogpt.example.com` |
| `ADMIN_URL` | Public URL of the admin panel — `https://philogpt-admin.example.com` |
| `API_URL` | Public URL of the backend API — `https://philogpt-api.example.com` |
| `JWT_SECRET` | A long random string — run `openssl rand -hex 32` |
| `ADMIN_EMAIL` | Login email for the admin account |
| `ADMIN_PASSWORD` | Login password for the admin account |

> **Why `FRONTEND_URL` / `ADMIN_URL`?** Compose injects them into `ALLOWED_ORIGINS` on the backend, so CORS is configured automatically from the same values. `API_URL` flows into both frontend services as `BACKEND_URL`/`SOCKET_URL` — the browser uses it to reach the API, so it must be a public domain, not a Docker-internal hostname.

**Optional overrides (defaults shown):**

| Variable | Default | Notes |
|---|---|---|
| `BACKEND_PORT` | `5001` | Host port for the backend — change if it conflicts with DSM or other services |
| `FRONTEND_PORT` | `3002` | Host port for the user frontend |
| `ADMIN_PORT` | `3001` | Host port for the admin frontend |
| `MONGO_PORT` | `27017` | Host port for MongoDB |
| `SEED_ON_EMPTY_DB` | `true` | Seeds the database on first start if it is empty |
| `PURGE_AND_RESEED` | `false` | Set to `true` **once** to wipe and reseed, then back to `false` |
| `LOG_LEVEL` | `info` | Set to `debug` for verbose output |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | *(blank)* | OAuth — leave empty to disable |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | *(blank)* | OAuth — leave empty to disable |

> **Security:** `.env` is gitignored and never committed. `.env.example` (committed, no real secrets) serves as the canonical reference for all variables.

---

## 3. Build and start the containers

**First-time build** (runs inside the project directory):

```bash
cd /volume1/philoGPT
docker compose build
docker compose up -d
```

Verify all three containers are running:

```bash
docker compose ps
```

Expected output:

```
NAME                          STATUS          PORTS
philogpt-backend-1            running         0.0.0.0:5001->5001/tcp
philogpt-admin-frontend-1     running         0.0.0.0:3001->3001/tcp
philogpt-user-frontend-1      running         0.0.0.0:3002->3002/tcp
philogpt-mongo-1              running         0.0.0.0:27017->27017/tcp
```

Check backend logs to confirm the database seeded successfully:

```bash
docker compose logs backend --tail=30
```

---

## 4. Expose services via Web Station

Web Station uses **virtual hosts** to proxy traffic to each container port.

### 4.1 Open Web Station

*DSM → Package Center → Web Station → Open*

Navigate to **Web Service Portal** and create a portal for each service.

---

### 4.2 User frontend — `philogpt.example.com` (port 3002)

Go to **Web Station → Web Service Portal → Create → Service Portal**:

| Field | Value |
|---|---|
| Portal type | Reverse proxy |
| Enable | ✓ |
| Hostname | `philogpt.example.com` |
| HTTPS | ✓ (Let's Encrypt via Synology Certificate) |
| Backend server | `http://localhost:3002` |
| WebSocket support | ✓ (required for real-time chat) |

---

### 4.3 Backend API — `philogpt-api.example.com` (port 5001)

The backend is called by the browsers directly, so it needs its own public hostname:

| Field | Value |
|---|---|
| Portal type | Reverse proxy |
| Enable | ✓ |
| Hostname | `philogpt-api.example.com` |
| HTTPS | ✓ |
| Backend server | `http://localhost:5001` |
| WebSocket support | ✓ (Socket.IO) |

Once the backend hostname is set, update `ALLOWED_ORIGINS` in `docker-compose.yml` and restart:

```bash
# In docker-compose.yml, under backend > environment:
# - ALLOWED_ORIGINS=https://philogpt.example.com,https://philogpt-admin.example.com

docker compose restart backend
```

---

### 4.4 Admin frontend — `philogpt-admin.example.com` (port 3001)

| Field | Value |
|---|---|
| Portal type | Reverse proxy |
| Enable | ✓ |
| Hostname | `philogpt-admin.example.com` |
| HTTPS | ✓ |
| Backend server | `http://localhost:3001` |
| WebSocket support | ✗ |

---

### 4.5 Issue TLS certificates

Go to *DSM → Control Panel → Security → Certificate* and use **Add → Get a certificate from Let's Encrypt** for each of the three hostnames:

- `philogpt.example.com`
- `philogpt-api.example.com`
- `philogpt-admin.example.com`

Assign each certificate to its respective Web Station virtual host.

---

## 5. Updating the application

Pull the latest code and rebuild only changed services:

```bash
cd /volume1/philoGPT
git pull
docker compose build
docker compose up -d
```

Docker Compose will only restart containers whose images have changed.

---

## 6. Resetting the database

To wipe all application data and reseed with defaults, set `PURGE_AND_RESEED=true` in `.env`, restart the backend, then set it back to `false`:

```bash
# 1. Enable the purge flag
sed -i 's/^PURGE_AND_RESEED=.*/PURGE_AND_RESEED=true/' /volume1/philoGPT/.env

# 2. Restart the backend so it runs the purge + reseed
docker compose up -d backend

# 3. Confirm seeding completed
docker compose logs backend --tail=20

# 4. Disable the flag so the next restart does not purge again
sed -i 's/^PURGE_AND_RESEED=.*/PURGE_AND_RESEED=false/' /volume1/philoGPT/.env
```

---

## 7. Persisted data

MongoDB data is stored in a named Docker volume:

```bash
docker volume inspect philogpt_mongo_data
```

To back up:

```bash
docker run --rm \
  -v philogpt_mongo_data:/data/db \
  -v /volume1/backups:/backup \
  mongo:latest \
  mongodump --host localhost --out /backup/$(date +%F)
```

---

## 8. Useful commands

```bash
# View live logs for all services
docker compose logs -f

# Restart a single service
docker compose restart backend

# Open a shell inside the backend container
docker compose exec backend sh

# Run a MongoDB shell against the running database
docker compose exec mongo mongosh philogpt

# Stop everything
docker compose down

# Stop and remove volumes (DESTRUCTIVE — deletes all data)
docker compose down -v
```
