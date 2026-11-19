# Frontend tests

All frontend tests live under this directory:

- `api/`: API adapters, persistence, migrations, feature boundaries, and domain lifecycle tests.
- `unit/`: React component and frontend helper unit tests, grouped by feature.
- `integration/`: tests that cross the real feature adapter and HTTP client boundary.

Scripts, run from `frontend/`:

- `npm run test:api`: API/domain tests in `tests/api/` (Node test runner).
- `npm run test:unit` / `npm run test:unit:run`: Vitest in watch mode / one run. The
  include pattern in `vitest.config.ts` covers both `tests/unit` and `tests/integration`.
- `npm run test:integration`: only the herd-entry Node integration smoke tests.
- `npm run test:integration:ui`: Vitest integration tests (`tests/integration/**/*.test.tsx`).
- `npm test`: `test:api`, then `test:unit:run`, then the herd-entry smoke. It is a
  convenience aggregate, not a complete integration gate.

To test one feature, pass its folder: `./node_modules/.bin/vitest run --passWithNoTests tests/unit/<feature>`.
Test stages and the full integration command are in `docs/agent-context/VERIFICATION.md`.
