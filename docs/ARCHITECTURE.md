# Architecture Notes

PhiloGPT is split into three runtime applications and one database.

## Components

- `api/`: Express + Socket.IO server, auth, chat orchestration, seed migrations
- `user-frontend/`: customer-facing chat client
- `admin-frontend-new/`: admin configuration and management panel
- `mongo`: persistence for users, bots, sessions, messages, configs, and logs

## Data and Control Flow

1. Browser clients authenticate against API auth endpoints.
2. User chat communicates with API through REST + Socket.IO.
3. API resolves model/provider config and executes LLM + tools.
4. Messages and metadata are persisted in MongoDB.
5. Admin panel manages prompts, LLM configs, tools, users, and maintenance records.

## Seed Versioning

`api/src/scripts/seedPatches.ts` defines ordered, one-time patches.

- On startup, missing patch versions are applied in order.
- Applied versions are stamped in the database.
- Existing versions are never re-applied.

## Security Boundaries

- Auth middleware enforces JWT validation.
- Admin routes require admin role checks.
- Session/message ownership checks prevent cross-user access.
- Security integration tests cover common OWASP and IDOR paths.
