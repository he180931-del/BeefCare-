# BeefCare frontend API contract

This contract is in progress. An endpoint appearing in generated OpenAPI means it is registered in code, not that its whole SRS use case has passed acceptance tests. The implementation traceability pages record remaining feature gaps. Do not use generated legacy entity CRUD such as `/api/cattle` or `/api/support-tickets`.

The canonical contract is `openapi.json`, exported from Springdoc's `beefcare` group after `OpenApiContractTest` passes. The runtime endpoint is `/v3/api-docs/beefcare` when profile `api-docs` is active; it requires the development documentation authority. Import the JSON file into frontend tooling without needing that account. Java request/response DTOs are authoritative; update and regenerate this file with backend changes.

## Browser authentication

Use `credentials: 'include'` on calls. First GET `/api/csrf` and retain the response's `token` and `headerName`. POST JSON `{ "username": "account email", "password": "password", "rememberMe": false }` to `/api/authenticate` with that CSRF header. Success is HTTP 204 and a session cookie. Fetch a fresh CSRF token after login and after logout. Do not put credentials or bearer tokens in localStorage. POST `/api/logout` ends the server session and the frontend clears its selected farm.

Local backend runs at `http://localhost:8080`; the allowed frontend origins are configured with `BEEFCARE_CORS_ORIGINS` (local defaults localhost:5173 and localhost:3000). Keep the hostname consistent; localhost and 127.0.0.1 have different cookies. Production cookies require HTTPS.

The shared browser adapter is `frontend/src/api/backendClient.js`; its tests cover cookie/CSRF and command behavior. Existing frontend mock screens have not all been switched over. Replace each screen's mock adapter deliberately rather than keeping client-side business mutations alongside backend commands.

## Commands and errors

Send `Idempotency-Key` on business commands, generated once per user intent (for example `crypto.randomUUID()`). Keep the same key and identical body on retry after a timeout. A changed form submission needs a new key. Reusing a key with different data returns a conflict. Existing-record commands also need the version returned by the current read DTO (`expectedVersion`, `cattleVersion` or the explicitly named field in OpenAPI). A conflict means reload and ask the person to review the latest data.

Checkpoint limitation: some newly added platform finance commands do not yet use the shared durable idempotency service. Sending the header alone does not make those commands safe to retry. See HANDOFF_BACKEND.md; the next agent must finish and test their idempotency before enabling automatic retries for them.

Domain failures use `{ "code": "MSG-...", "params": { ... } }`, with 400 for malformed input, 403 for denied access, 404 for an inaccessible/missing source, 409 for stale state and 422 for a domain condition. The frontend maps codes to the SRS message catalogue and uses params for display. Spring field validation and authentication failures must be handled separately; not every HTTP error is a domain message. List endpoints use their documented DTO shape, commonly `{items,total,page,size,...}`; pages start at 0.

Path IDs are numeric internal IDs. Display codes such as `BC-000125`, pen codes and Vietnamese labels are separate values. Dates are ISO `yyyy-MM-dd`; occurrence/recording timestamps are ISO instants; farm dates use the returned farm timezone. Send enum codes, not translated display labels.

## Main integration points

| Frontend area | API entry points |
|---|---|
| Sign in and profile | `/api/csrf`, `/api/authenticate`, `/api/account/**` |
| Farm selector and bootstrap | `/api/farms`, `/api/farms/{farmId}/context`, `/catalogues` |
| Cattle and QR | `/api/farms/{farmId}/cattle`, `/{id}`, `/{id}/profile`, `/{id}/qr-tags`, `/resolve?code=` |
| Growth | `/api/farms/{farmId}/growth`, `/cattle/{id}/growth` |
| Timeline | `/api/farms/{farmId}/cattle/{id}/timeline` |
| Catalogues | `/api/farms/{farmId}/catalogues/breeds`, `/catalogues/production-purposes`; care catalogue and parameter paths are in OpenAPI |
| Owner support | `/api/support/tickets` and ticket replies/acknowledgments/reopen |
| CS support | `/api/platform/support/tickets` and explicit processing/resolution/closure commands |
| PM/SA internal requests | `/api/platform/internal-requests`; recipient sees request context only |
| Email preview | Mailpit local `http://localhost:8025`; SMTP on localhost:1025 |

The frontend submits one domain command, then reloads the returned aggregate or invalidates related queries. It must not compose raw entity writes to emulate transactions, grant its own service status after displaying a QR, infer ticket confirmation from reply text, or treat a reminder suggestion as a recorded event.
