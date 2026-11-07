# BeefCare architecture

## Runtime shape

BeefCare is a Spring Boot backend and a Vite/React/TypeScript frontend.

```text
frontend/src/App.tsx
  -> feature page
  -> feature API boundary
  -> shared BackendTransport / backendClient
  -> /api/farms/{farmId}/...
  -> REST resource -> service -> repository/domain
  -> DTO mapper -> feature state -> UI
```

## Frontend ownership

Every feature folder under `frontend/src/features/` exposes its pages and API
facade through `index.ts`. The four features with a dedicated context file are
herd entry, herd exit, cattle and pen management (`FEATURE_*.md`).

| Folder in `frontend/src/features/` | Spec |
|---|---|
| `authentication`, `account` | FE-01, FE-22 (public page in the guest flow) |
| `authorization` | FE-01, FE-03 (`AuthProvider`, `AuthGate`) |
| `farm-workspace` | FE-02, FE-03 |
| `pen-management` | FE-04 |
| `cattle` | FE-05, FE-16 (timeline tab) |
| `herd-entry` | FE-06 |
| `farm-announcements` | FE-07 |
| `growth` | FE-08 |
| `vaccination` | FE-09 |
| `health` | FE-10 |
| `reproduction` | FE-11, FE-12 |
| `herd-exit` | FE-13 |
| `farm-overview`, `notifications` | FE-14, FE-15 |
| `platform-admin` | FE-03, FE-17 |
| `farm-catalogue` | FE-18 |
| `subscription`, `platform-service` | FE-19 (`platform-service` also covers FE-02 for PM) |
| `support`, `platform-support` | FE-20 |
| `platform-finance` | FE-21 |
| `feed-stock` | FE-23 |

Shared transport, types and UI live in `frontend/src/api/`, `types.ts`,
`components/` and `hooks/`; use them only for genuinely cross-feature code.
Routes are composed in `frontend/src/App.tsx`.

Feature internals must not be imported by another feature. Cross-feature data
goes through the backend/domain boundary. Do not add new feature pages under
legacy `frontend/src/pages`; `Placeholder` is the remaining cross-feature
exception.

## Backend ownership

Relevant layers are under `backend/src/main/java/vn/edu/fpt/beefcare/`:

- `web/rest/`: HTTP resources and endpoint contracts.
- `service/`: workflows, authorization checks, validation, and transitions.
- `domain/`: entities and enumerations.
- `repository/`: persistence access.
- `service/dto/`: request and response contracts.

For a change, start at the resource and DTO, follow the called service, then
inspect the relevant repository/domain test. Do not infer a transaction from a
controller name alone.

## Read next

- API and session rules: `API_RULES.md`
- Feature-specific ownership: the matching `FEATURE_*.md`
- Verification boundaries: `VERIFICATION.md`
