# PhiloGPT

**Open-source, self-hosted philosophy chat — powered by local or cloud LLMs.**

PhiloGPT lets you run a multi-persona AI chat platform entirely on your own infrastructure. Configure philosophical or custom AI bots, manage users and subscriptions through an admin panel, and chat in real time with streaming responses and tool call support.

---

## What it does

- **Multi-bot personas** — run characters like Socrates, Marcus Aurelius, Spock, or your own custom AI
- **Real-time streaming** — Socket.IO chat with live token output and thinking traces
- **Tool calling** — extend bots with custom tools and function definitions
- **Admin panel** — manage bots, prompts, users, subscriptions, LLM configs, and SMTP
- **Provider agnostic** — Ollama (local), OpenAI, or any compatible API endpoint
- **Versioned seed patches** — database migrations run automatically on deploy
- **Context-window ring** — live token usage indicator per message with history compression
- **Security test suite** — OWASP, IDOR, and auth integration tests included

---

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env — set FRONTEND_URL, ADMIN_URL, API_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

docker compose build
docker compose up -d

docker compose ps
docker compose logs api --tail=40
```

The API seeds default bots and config on first run. Visit your `FRONTEND_URL` to start chatting.

---

## Local development

Run each service in a dedicated terminal from repo root:

```bash
./start-mongodb.sh
./start-api.sh
./start-user-frontend.sh
./start-admin.sh
```

Stop all local listeners:

```bash
./kill_all.sh
```

---

## Repository layout

```text
.
├── api/                 # Express + Socket.IO API — auth, LLM, tools, seed migrations
├── user-frontend/       # React + Vite user chat app (PWA)
├── admin-frontend-new/  # React Admin management panel
├── docs/                # Architecture, contributing, security, and release docs
├── docker-compose.yml   # Full-stack Compose config (reads from .env)
├── .env.example         # All required and optional variables documented
└── SYNOLOGY.md          # NAS and reverse-proxy deployment guide
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Setup, PR guidelines, and code expectations |
| [docs/SECURITY.md](docs/SECURITY.md) | Vulnerability reporting and security hardening |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System components, data flow, and security boundaries |
| [docs/PUBLIC_RELEASE_CHECKLIST.md](docs/PUBLIC_RELEASE_CHECKLIST.md) | Pre-release checklist |
| [SYNOLOGY.md](SYNOLOGY.md) | Synology NAS and reverse-proxy deployment guide |

---

## Scripts

**API** (`api/`):

```bash
npm run dev            # ts-node (single run)
npm run dev:watch      # nodemon + ts-node watch mode
npm run build          # compile TypeScript
npm start              # run compiled dist/server.js
npm test               # run all tests
npm run test:security  # OWASP + auth + ownership integration tests
```

**User frontend** (`user-frontend/`):

```bash
npm run dev
npm run build
npm run typecheck
```

**Admin frontend** (`admin-frontend-new/`):

```bash
npm run dev
npm run build
npm start
```

---

## Security

- No secrets in source — all credentials come from `.env`
- MongoDB is bound to `127.0.0.1` in Compose by default (not publicly exposed)
- JWT-based auth with strict admin role separation
- Ownership checks prevent cross-user data access
- Security tests cover authentication boundaries, IDOR, role escalation, and OWASP Top-10 patterns

Run the security test suite:

```bash
./run-security-tests.sh
# or
cd api && npm run test:security
```

---

## Collaboration

Contributions are welcome — code, tests, docs, and ideas.

- Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) to get started
- Open an issue to discuss a bug or feature before submitting a PR
- For long-term collaboration, open an issue labeled `collaboration`
- Report security issues privately — see [docs/SECURITY.md](docs/SECURITY.md)

---

## License

MIT — see [LICENSE](LICENSE).

