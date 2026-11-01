# Frontend unit tests

Unit tests live outside production code and are grouped by feature:

- `herd-entry/`: entry pages, components, validation, and user interactions.
- `herd-exit/`: exit pages, components, validation, and user interactions.
- `shared/`: reusable frontend components and helpers.

Use `npm run test:unit` while developing and `npm run test:unit:run` for a single CI-style run. `npm test` runs both the existing API/domain suite and this unit suite.

Each test should describe observable behavior and use accessible queries such as role, label, and visible name. Mock only external boundaries such as backend requests.
