# Public Release Checklist

Use this checklist before marking a release or making the repository public.

## Repository Hygiene

- [ ] `LICENSE` is present and correct (MIT)
- [ ] `README.md` is current and accurate
- [ ] docs are up to date under `docs/`
- [ ] no stale references to removed folders/scripts

## Secrets and Credentials

- [ ] no committed `.env` files
- [ ] no hardcoded API keys, private keys, or access tokens
- [ ] default admin credentials are documented as development-only
- [ ] deployment docs instruct users to rotate credentials

## Deployment Hardening

- [ ] MongoDB is not exposed on public interfaces
- [ ] HTTPS reverse proxy is configured for all public endpoints
- [ ] CORS origins are explicit (`FRONTEND_URL`, `ADMIN_URL`)
- [ ] production logging level is appropriate (`LOG_LEVEL=info` or stricter)

## Testing and Quality

- [ ] API builds cleanly
- [ ] frontends build cleanly
- [ ] `npm run test:security` passes
- [ ] critical user/admin flows are manually smoke tested

## Collaboration Readiness

- [ ] contribution guide exists and is linked from README
- [ ] security reporting process exists
- [ ] issues/PRs are enabled and monitored
