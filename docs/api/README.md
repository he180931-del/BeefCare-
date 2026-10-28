# BeefCare frontend API contract

This contract is in progress. An endpoint appearing in generated OpenAPI means it is registered in code, not that its whole SRS use case has passed acceptance tests. The implementation traceability pages record remaining feature gaps. Do not use generated legacy entity CRUD such as `/api/cattle` or `/api/support-tickets`.

The canonical contract is `openapi.json`, exported from Springdoc's `beefcare` group after `OpenApiContractTest` passes. The runtime endpoint is `/v3/api-docs/beefcare` when profile `api-docs` is active; it requires the development documentation authority. Import the JSON file into frontend tooling without needing that account. Java request/response DTOs are authoritative; update and regenerate this file with backend changes.

Current contract: **199 paths, 272 schemas** (regenerated 28 October 2026 evening). To regenerate, run from `backend/`:

```powershell
.\mvnw.cmd --batch-mode -o '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=OpenApiContractTest' test
Copy-Item target\beefcare-openapi.json ..\docs\api\openapi.json
```

The test writes only to `backend/target/beefcare-openapi.json`; the copy step publishes it here. Commit the regenerated file in the same change as the DTO or route change.

## Browser authentication

Use `credentials: 'include'` on calls. First GET `/api/csrf` and retain the response's `token` and `headerName`. POST JSON `{ "username": "account email", "password": "password", "rememberMe": false }` to `/api/authenticate` with that CSRF header. Success is HTTP 204 and a session cookie. Fetch a fresh CSRF token after login and after logout. Do not put credentials or bearer tokens in localStorage. POST `/api/logout` ends the server session and the frontend clears its selected farm.

Local backend runs at `http://localhost:8080`; the allowed frontend origins are configured with `BEEFCARE_CORS_ORIGINS` (local defaults localhost:5173 and localhost:3000). Keep the hostname consistent; localhost and 127.0.0.1 have different cookies. Production cookies require HTTPS.

The shared browser adapter is `frontend/src/api/backendClient.js`; its tests cover cookie/CSRF and command behavior. Existing frontend mock screens have not all been switched over. Replace each screen's mock adapter deliberately rather than keeping client-side business mutations alongside backend commands.

## Commands and errors

Send `Idempotency-Key` on business commands, generated once per user intent (for example `crypto.randomUUID()`). Keep the same key and identical body on retry after a timeout. A changed form submission needs a new key. Reusing a key with different data returns a conflict. Existing-record commands also need the version returned by the current read DTO (`expectedVersion`, `cattleVersion` or the explicitly named field in OpenAPI). A conflict means reload and ask the person to review the latest data.

Platform finance commands (`/api/platform/finance/records` create/update/discard/post/void/replacement and `/api/platform/finance/reports`) require `Idempotency-Key` and use the shared durable idempotency service (PM role, action per command and record id), so a retry with the same key and body returns the first result.

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
| Feed stock (SCR-77) | `/api/farms/{farmId}/feed/stock`, `/stock/{feedId}/movements`, `/feed/reminders` |
| Feed receipts (SCR-78/79) | `/api/farms/{farmId}/feed/receipts`, `/{receiptId}/draft`, `/post`, `/void`, `/payments` |
| Stock adjustment (SCR-80) | `/api/farms/{farmId}/feed/adjustments`, `/{adjustmentId}`, `/{adjustmentId}/draft`, `/{adjustmentId}/post` |
| Rations and feeding (SCR-81–84) | `/api/farms/{farmId}/feed/rations`, `/feed/feeding-records`, `/{recordId}/correct`, `/{recordId}/void` |
| Feed catalogue and report | `/api/farms/{farmId}/feed/catalogue`, `/feed/reports/consumption` |
| Platform finance (PM) | `/api/platform/finance/records` (+ `/{id}/post`, `/void`, `/discard`, `/replacement`), `/bank-transactions`, `/categories`, `/reports`, `/reports/{id}/xlsx` |
| Email preview | Mailpit local `http://localhost:8025`; SMTP on localhost:1025 |

### Feed stock adjustment flow

`POST /feed/adjustments` with `{countDate, adjustmentType, countedBy, lines:[{feedItemId, countedKg, reason}], postNow}` creates a document coded `ĐCK-YYYY-nnnn`. `adjustmentType` is one of `PERIODIC_COUNT`, `LOSS`, `SPOILAGE`, `OTHER`; `countDate` cannot be in the future; each feed appears at most once. With `postNow: false` the result is a `DRAFT` that changes no stock; edit it with `PUT /{id}/draft` (`expectedVersion` + same fields) and post it with `POST /{id}/post` (`{expectedVersion}`). `postNow: true` saves and posts in one command.

The response `AdjustmentView` returns, per line, `systemKg` (system stock at the end of the count date in the farm timezone), `differenceKg = countedKg − systemKg`, `unitCost` (weighted average) and `differenceValue`. Show these as read-only values; the backend recomputes them when posting. Posting requires a `reason` for every non-zero difference (`MSG-FE23-08`, params `feedItemId`) and rejects a result that would make current stock negative (`MSG-COM-10`, field `countedKg`). A `POSTED` adjustment is immutable (`MSG-COM-05`); correct a mistake with a new adjustment. Only the Owner and Managers can read or write adjustments.

Feed messages the screens need: `MSG-FE23-03` (expiry not after the receipt date, field `expiryDate`), `MSG-FE23-05` (receipt void blocked by stock, params `receipt_code`, `feed`, `stock`), `MSG-FE23-08` (difference without reason) and `MSG-COM-08` (inactive feed or supplier, field `feedItemId`/`supplierId`). Lot numbers are expiry warnings only: `StockView.nearestLotNumber`/`nearestLotExpiryDate` is the nearest posted lot expiring within 30 days. There is no lot-level (FEFO) stock.

## Contract changes

| Date | Change | Frontend impact |
|---|---|---|
| 2026-10-28 (evening) | `POST /api/farms/{farmId}/feed/adjustments` now creates an adjustment document and returns `AdjustmentView`. It previously posted directly and returned `StockAdjustmentResult`, which is removed. The request adds `postNow` (default `false` = draft). New `GET /adjustments`, `GET/PUT /adjustments/{id}[/draft]`, `POST /adjustments/{id}/post`. | **Breaking.** Send `postNow: true` for the old one-step behaviour and read `AdjustmentView`. No current screen called the old route. |
| 2026-10-28 (evening) | Platform finance commands require the `Idempotency-Key` header (create, update, discard, post, void, replacement, report run). The amount error is `MSG-FE21-09` and the category/type error is `MSG-FE21-10` (previously `MSG-COM-10`). Report snapshots are available for 30 days (previously 7). | **Breaking** for callers without the header: a missing header is a generic Spring 400 (not a domain message), a blank key is 400 `MSG-COM-19`. |
| 2026-10-28 (evening) | Feed receipt codes are `PNK-YYYY-nnnn` from a yearly sequence (previously `PNK-YYYY-` + 6-digit database id). Feed errors use `MSG-FE23-03`, `MSG-FE23-05` and `MSG-COM-08` instead of generic codes. | Treat codes as opaque display text; map the new message codes. Existing receipts keep their old codes. |

The frontend submits one domain command, then reloads the returned aggregate or invalidates related queries. It must not compose raw entity writes to emulate transactions, grant its own service status after displaying a QR, infer ticket confirmation from reply text, or treat a reminder suggestion as a recorded event.
