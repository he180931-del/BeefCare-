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

| Area | Location | Public entry |
|---|---|---|
| Herd entry | `frontend/src/features/herd-entry/` | `index.ts` lazy page loaders and API facade |
| Herd exit | `frontend/src/features/herd-exit/` | `index.ts` lazy page loaders and API facade |
| Cattle | `frontend/src/features/cattle/` | `index.ts` lazy page loaders |
| Pen management | `frontend/src/features/pen-management/` | `index.ts` lazy page loader |
| Authentication/authorization | `frontend/src/features/authentication/`, `authorization/` | `AuthProvider`, `AuthGate` |
| Shared transport/types/UI | `frontend/src/api/`, `types.ts`, `components/`, `hooks/` | Use only for genuinely cross-feature code |

Routes are composed in `frontend/src/App.tsx`: `/herd-entry`,
`/herd-entry/new`, `/herd-entry/:id`, `/herd-exit`, `/herd-exit/new`,
`/herd-exit/:id`, `/pens`, `/cattle`, and `/cattle/:code`.

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
