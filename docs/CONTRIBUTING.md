# Contributing to PhiloGPT

Thanks for considering a contribution.

## Ways to Contribute

- report bugs
- propose and discuss features
- improve docs and onboarding
- submit code and tests
- review pull requests

## Development Setup

1. Fork and clone the repository.
2. Create a branch from `main`.
3. Start local services:

```bash
./start-mongodb.sh
./start-api.sh
./start-user-frontend.sh
./start-admin.sh
```

4. Run tests before opening a PR:

```bash
cd api
npm test
npm run test:security
```

## Pull Request Guidelines

- Keep PRs focused and small where possible.
- Include tests for behavior changes.
- Update docs for user-visible or operational changes.
- Avoid unrelated refactors in the same PR.
- Use clear commit messages describing intent.

## Code Quality Expectations

- TypeScript should compile without errors.
- New behavior should have either tests or a clear rationale when tests are not practical.
- Security-sensitive changes should include threat notes in the PR description.

## Branch and Review Flow

1. Open an issue for non-trivial changes first.
2. Link the issue in your PR.
3. Request review once CI is green.
4. Address feedback with follow-up commits.

## Communication

If you want to collaborate long-term, open an issue labeled `collaboration` and include:

- your area of interest
- your experience level
- where you want help onboarding
