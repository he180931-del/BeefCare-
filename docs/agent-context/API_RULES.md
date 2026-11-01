# API and data rules

## Transport

Frontend requests use relative `/api` paths. Vite proxies `/api` to the local
backend in `frontend/vite.config.js`; do not hardcode a remote origin or solve
CORS in page code. `frontend/src/api/backendClient.ts` rejects non-relative API
paths and always sends `credentials: 'include'`.

`VITE_BEEFCARE_DATA_SOURCE=backend` selects the backend adapters in
`frontend/src/api/backendTransport.ts`. Any other value selects local adapters.
Local collection persistence in `frontend/src/api/client.ts` is for local demo
and tests only; backend mode must not silently fall back to localStorage.
The tracked `frontend/.env.example` is a backend-mode sample, while an
untracked local `frontend/.env` can override it for the current Vite process.
Read the active env before claiming which mode is live; never infer runtime mode
from the example file alone.

`VITE_BEEFCARE_FARM_ID` is the numeric backend farm ID. Keep numeric internal
IDs separate from display codes such as cattle and voucher codes.

## Session and commands

The browser flow is: GET `/api/csrf` -> POST `/api/authenticate` with the CSRF
header -> fetch a fresh CSRF token -> call authenticated farm endpoints. The
implementation is `frontend/src/api/backendClient.ts`; backend security rules
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
