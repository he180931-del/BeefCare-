# API and data rules

## Transport

Frontend requests use relative `/api` paths. Vite proxies `/api` to the local
backend in `frontend/vite.config.js`; do not hardcode a remote origin or solve
CORS in page code. `frontend/src/shared/api/backendClient.ts` requires paths starting
with `/api/` and always sends `credentials: 'include'`, but it prefixes
`VITE_BEEFCARE_API_URL` when that variable is set. Keep it empty (as in
`frontend/.env.example`) so requests stay relative; a backend origin there
bypasses the proxy and relies on backend CORS.

`frontend/src/shared/config/runtime.ts` (`backendMode`) selects the backend adapters unless
`VITE_BEEFCARE_DATA_SOURCE=local` is set explicitly (`npm run dev:mock`, Vitest, and the
`tests/node/setup.ts` preload of `npm run test:api`). `vite build` refuses `local` and
`VITE_BEEFCARE_AUTH_MODE=mock`. Screens never read `backendMode`: the feature API exposes what
its adapter offers (for example `feedReceiptServerBacked`, `subscriptionApi.paymentRouteId`) and owns
every demo default (checked by `tests/api/layerBoundary.test.ts`).
Demo data reaches the app only through `frontend/src/demo/demoModules.ts`: feature APIs read
`demo.<module>` inside their local branch, at call time (`lazyObject` wraps a store handed to a
factory). `vite build` and `vite` on the backend swap that door for `src/demo/noDemo.ts`
(plugin `beefcare-demo-door` in `vite.config.js`), and the build fails if a demo module still
reaches the bundle. Do not import `data/`, `*LocalApi` or the legacy local modules from
production code.
Local collection persistence in `frontend/src/api/client.ts` is for local demo
and tests only; backend mode must not silently fall back to localStorage.
The tracked `frontend/.env.example` is only a backend-mode sample: Vite never
reads it. The untracked `frontend/.env` is what the current Vite process uses;
without it, `npm run dev` still talks to the backend through the `/api` proxy.
Read the active env before claiming which mode is live; never infer runtime mode
from the example file alone.

The farm of every farm-scoped request is `activeFarmId`
(`frontend/src/app/session/currentFarm.ts`): the farm entered on Select Farm in
this browser tab (UC-FE02-02), read once per page load. There is no configured
or default farm. Farm screens are wrapped in `RequireFarm`
(`app/routes/RequireFarm.tsx`), which opens Select Farm when the tab has no farm
and comes back to the requested screen once a farm is entered (router state
`returnTo`, in-app paths only; the only ACTIVE farm opens directly, AF4). The
Owner pages reached from Select Farm may name the farm in the address with
`?farm=` / `?farmId=`; the account pages (`/ho-so`, `/kt/tai-khoan`) need no farm. `transport.farmPath(null, ...)` builds a path the client
refuses with `NoActiveFarmError` before anything is sent. Keep numeric internal
IDs separate from display codes such as cattle and voucher codes.

## Session and commands

The browser flow is: GET `/api/csrf` -> POST `/api/authenticate` with the CSRF
header -> fetch a fresh CSRF token -> call authenticated farm endpoints. The
implementation is `frontend/src/shared/api/backendClient.ts`; backend security rules
are in `backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java`.
Do not store credentials, session cookies, or bearer tokens in localStorage.

Business mutations require an `Idempotency-Key`, generated once per user
intent. Existing-record commands also carry the documented version field
(`expectedVersion`, `cattleVersion`, or the DTO-specific name). On 401 report an
authentication/session problem; on 404 report a route/contract or missing-data
problem. Map domain `{code, params}` errors to the SRS message catalogue instead
of replacing them with mock data.

## Feature endpoints

| Feature | API boundary | Backend resource |
|---|---|---|
| Entry | `features/herd-entry/api/herdEntryBackendApi.ts` | `HerdEntryVoucherResource` |
| Exit | `features/herd-exit/api/herdExitBackendApi.ts` | `HerdExitVoucherResource` |
| Cattle | `api/cattleBackendApi.ts` | `CattleProfileResource` |
| Pens/moves | `api/cattleBackendApi.ts` and `features/pen-management/api/penApi.ts` | `PenResource`, `PenMoveResource` |

Read `docs/api/README.md` and the relevant DTO/OpenAPI operation before changing
request fields, requiredness, status values, or error handling. Verify the
contract again before implementation; this summary is not authority for a new
field.

## Read next

`FEATURE_HERD_ENTRY.md`, `FEATURE_HERD_EXIT.md`, `FEATURE_CATTLE.md`, or
`FEATURE_PEN_MANAGEMENT.md`, then the exact Java resource/DTO and OpenAPI
operation named there.
