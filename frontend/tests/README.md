# Frontend tests

All frontend tests live under this directory:

- `api/`: API adapters, persistence, migrations, feature boundaries, and domain lifecycle tests.
- `unit/`: React component and frontend helper unit tests, grouped by feature.
- `integration/`: tests that cross the real feature adapter and HTTP client boundary.

Run the complete suite with `npm test`, API/domain tests with `npm run test:api`,
component unit tests with `npm run test:unit`, or HTTP-boundary integration tests with
`npm run test:integration`.
