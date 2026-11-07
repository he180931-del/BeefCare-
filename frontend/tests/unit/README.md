# Frontend unit tests

Unit tests live outside production code and are grouped by feature. Each folder
matches a folder in `src/features/` (`pens/` is `pen-management`, `auth/` covers
`authentication` and `authorization`), plus:

- `app/`: route-level checks such as every route loading.
- `shared/`: reusable frontend components and helpers.
- `api/`: shared API helpers used by several features.

Use `./node_modules/.bin/vitest run --passWithNoTests tests/unit/<feature>` for one
feature, `npm run test:unit` while developing, and `npm run test:unit:run` for a
single run. The Vitest include pattern also picks up `tests/integration`, so
`test:unit:run` is not a unit-only run; see `../README.md`.

Each test should describe observable behavior and use accessible queries such as role, label, and visible name. Mock only external boundaries such as backend requests.
