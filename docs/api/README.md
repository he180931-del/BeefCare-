# BeefCare frontend API contract

This contract is in progress. An endpoint appearing in generated OpenAPI means it is registered in code, not that its whole SRS use case has passed acceptance tests. The implementation traceability pages record remaining feature gaps. Do not use generated legacy entity CRUD such as `/api/cattle` or `/api/support-tickets`.

The canonical contract is `openapi.json`, exported from Springdoc's `beefcare` group after `OpenApiContractTest` passes. The runtime endpoint is `/v3/api-docs/beefcare` when profile `api-docs` is active; it requires the development documentation authority. Import the JSON file into frontend tooling without needing that account. Java request/response DTOs are authoritative; update and regenerate this file with backend changes.

Current contract: **203 paths, 274 schemas** (regenerated 28 October 2026, late). To regenerate, run from `backend/`:

```powershell
.\mvnw.cmd --batch-mode -o '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=OpenApiContractTest' test
Copy-Item target\beefcare-openapi.json ..\docs\api\openapi.json
```

The test writes only to `backend/target/beefcare-openapi.json`; the copy step publishes it here. Commit the regenerated file in the same change as the DTO or route change.

## Browser authentication

Use `credentials: 'include'` on calls. First GET `/api/csrf` and retain the response's `token` and `headerName`. POST JSON `{ "username": "account email", "password": "password", "rememberMe": false }` to `/api/authenticate` with that CSRF header. Success is HTTP 204 and a session cookie. Fetch a fresh CSRF token after login and after logout. Do not put credentials or bearer tokens in localStorage. POST `/api/logout` ends the server session and the frontend clears its selected farm.

Registration is `POST /api/register` with `{ fullName, email, password, confirmPassword, termsAccepted }` (201, no body; the account stays unverified until the e-mailed link is opened, see `GET /api/activate?token=`, which answers 303 to the front end with a session). Forgotten password is `POST /api/account/reset-password/init` and `POST /api/account/verification/resend` with the JSON object `{ "email": "..." }` (always 200, same answer for every address), `GET /api/account/reset-password/validate?token=` (`{valid}`) and `POST /api/account/reset-password/finish` with `{ key, newPassword, confirmPassword }` where `key` is the token from the link. Change password is `POST /api/account/change-password` with `{ currentPassword, newPassword, confirmPassword }`.

Sign-in and account failures carry the SRS code in the body (`{code, params, message, status}`), so the form can map them: `MSG-FE01-01` wrong or unknown e-mail/password (401, identical for both), `MSG-FE01-11` e-mail not verified (401), `MSG-FE01-02` password sign-in locked for 15 minutes after 5 failures (423, `params.time` = ISO instant), `MSG-FE01-03` suspended account (403, `params.email`), `MSG-FE01-06` link expired or used (400), `MSG-FE01-08` / `-09` password rules / confirmation (400, `params.field`), `MSG-FE01-10` e-mail already registered (409), `MSG-FE01-14` terms not accepted (400), `MSG-FE01-16` wrong current password (400). A request without the CSRF header is a bare 403 and an expired or ended session a bare 401 (no body).

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
| Sign in and profile | `/api/csrf`, `/api/authenticate`, `/api/logout`, `/api/register`, `/api/activate`, `/api/account/**` (`profile` GET/POST, `owner-registration`, `change-password`, `reset-password/*`, `verification/resend`) |
| Members and invitations (Owner) | `/api/farms/{farmId}/members`, `/api/farms/{farmId}/invitations` (+ `/{invitationId}/resend`, `/cancel`; each needs `Idempotency-Key`), `PUT /api/farms/{farmId}/members/{membershipId}`; invitee: `GET/POST /api/invitations/accept` (no key needed, a repeat returns the same membership) |
| Farm selector and bootstrap | `/api/farms`, `/api/farms/{farmId}/context`, `/catalogues` |
| Cattle and QR | `/api/farms/{farmId}/cattle`, `/{id}`, `/{id}/profile`, `/{id}/qr-tags`, `/resolve?code=` |
| Growth | `/api/farms/{farmId}/growth`, `/cattle/{id}/growth` |
| Timeline | `/api/farms/{farmId}/cattle/{id}/timeline` |
| Catalogues | `/api/farms/{farmId}/catalogues/breeds`, `/catalogues/production-purposes`; care catalogue and parameter paths are in OpenAPI |
| Owner support | `/api/support/tickets` and ticket replies/acknowledgments/reopen |
| CS support | `/api/platform/support/tickets` and explicit processing/resolution/closure commands |
| PM/SA internal requests | `/api/platform/internal-requests`; recipient sees request context only |
| Feed stock (SCR-77) | `/api/farms/{farmId}/feed/stock`, `/stock/{feedId}/movements`, `/feed/reminders` |
| Feed receipts (SCR-78/79) | `/api/farms/{farmId}/feed/receipts`, `/{receiptId}/draft`, `/post`, `/void`, `/payments`; files: `/{receiptId}/attachments` (GET list, POST upload) and `/{receiptId}/attachments/{attachmentId}` (GET download, DELETE remove) |
| Stock adjustment (SCR-80) | `/api/farms/{farmId}/feed/adjustments`, `/{adjustmentId}`, `/{adjustmentId}/draft`, `/{adjustmentId}/post`; files: `/{adjustmentId}/attachments` (GET list, POST upload) and `/{adjustmentId}/attachments/{attachmentId}` (GET download, DELETE remove) |
| Rations and feeding (SCR-81–84) | `/api/farms/{farmId}/feed/rations`, `/feed/feeding-records`, `/{recordId}/correct`, `/{recordId}/void` |
| Feed catalogue and report | `/api/farms/{farmId}/feed/catalogue`, `/feed/reports/consumption` |
| Platform finance (PM) | `/api/platform/finance/records` (+ `/{id}/post`, `/void`, `/discard`, `/replacement`), `/bank-transactions`, `/categories`, `/reports`, `/reports/{id}/xlsx` |
| Email preview | Mailpit local `http://localhost:8025`; SMTP on localhost:1025 |

### Feed receipt and adjustment attachments

SCR-79 (invoice, delivery note) and SCR-80 (count record, photos). Owner and Manager only; the files belong to a document that already exists, so the screen saves a draft first (`postNow: false`), uploads, then posts. `POST .../attachments` is `multipart/form-data` with one part named `file` and an `Idempotency-Key` header; it returns `AttachmentDTO { id, contentType, fileSize, originalFilename, createdAt }`. Keep the key for a retry of the same file. `GET .../attachments` lists the active files; `GET .../attachments/{id}` returns the bytes with the stored `Content-Type` and `Content-Disposition: attachment` (fetch it with the session cookie and show it through a blob URL); `DELETE .../attachments/{id}` (with `Idempotency-Key`) removes a file. Adding or removing is possible only while the document is a `DRAFT` (409 `MSG-COM-05`, `params.reason` `receipt_is_not_draft` / `adjustment_is_not_draft`); posted or voided documents are read-only but their files can still be listed and downloaded.

Only PDF and JPEG, at most 10 MiB (10 485 760 bytes) per file, judged from the file content: `MSG-COM-10` with `params.field=file` and `params.reason` = `too_large` (HTTP 413), `unsupported_type` or `content_type_mismatch` (415); an empty file or missing part is `MSG-COM-06` (400). The `Content-Type` of the part must match the file (`application/pdf` or `image/jpeg`). The returned `originalFilename` is sanitized and always carries the right extension; display it, do not trust the name you sent. A Technician, another farm, or an id from another farm is `MSG-COM-01` (403) or `MSG-COM-08` (404).

### Feed stock adjustment flow

`POST /feed/adjustments` with `{countDate, adjustmentType, countedBy, lines:[{feedItemId, countedKg, reason}], postNow}` creates a document coded `ĐCK-YYYY-nnnn`. `adjustmentType` is one of `PERIODIC_COUNT`, `LOSS`, `SPOILAGE`, `OTHER`; `countDate` cannot be in the future; each feed appears at most once. With `postNow: false` the result is a `DRAFT` that changes no stock; edit it with `PUT /{id}/draft` (`expectedVersion` + same fields) and post it with `POST /{id}/post` (`{expectedVersion}`). `postNow: true` saves and posts in one command.

The response `AdjustmentView` returns, per line, `systemKg` (system stock at the end of the count date in the farm timezone), `differenceKg = countedKg − systemKg`, `unitCost` (weighted average) and `differenceValue`. Show these as read-only values; the backend recomputes them when posting. Posting requires a `reason` for every non-zero difference (`MSG-FE23-08`, params `feedItemId`) and rejects a result that would make current stock negative (`MSG-COM-10`, field `countedKg`). A `POSTED` adjustment is immutable (`MSG-COM-05`); correct a mistake with a new adjustment. Only the Owner and Managers can read or write adjustments.

Feed messages the screens need: `MSG-FE23-03` (expiry not after the receipt date, field `expiryDate`), `MSG-FE23-05` (receipt void blocked by stock, params `receipt_code`, `feed`, `stock`), `MSG-FE23-08` (difference without reason) and `MSG-COM-08` (inactive feed or supplier, field `feedItemId`/`supplierId`). Lot numbers are expiry warnings only: `StockView.nearestLotNumber`/`nearestLotExpiryDate` is the nearest posted lot expiring within 30 days. There is no lot-level (FEFO) stock.

## Contract changes

| Date | Change | Frontend impact |
|---|---|---|
| 2026-10-29 | Sign-in of a Google-only account with a password now answers **401** `MSG-FE01-01`, exactly like a wrong password (was 403). `POST /api/account/reset-password/init` for a Google-only address now mails advice to use Google (UC-FE01-05 AF1, same 5-per-hour limit, no link, no password). | Map 401 `MSG-FE01-01` as today; nothing else changes on the form. |
| 2026-10-29 | UC-FE01-06 AF1/AF2: `POST /api/account/google-reauthentication` (204) then send the browser to `/oauth2/authorization/google`; Google returns to `/profile?googleReauthenticated=true`. For 5 minutes `POST /api/account/change-password` accepts `{newPassword, confirmPassword}` without `currentPassword` (first password for a Google-only account, or a forgotten one). Without a recent Google sign-in a Google-only account gets 403 `MSG-COM-01` with `params.reason=google_reauthentication_required`. | New dialog branch; `passwordSignInEnabled` / `googleSignInLinked` in the profile decide which fields to show. |
| 2026-10-29 | `GET /api/account/profile`: each `farms[]` item adds `permissions` (FarmAction codes of the fixed role policy, GBR-06) for the SCR-08 permission table. | Additive. |
| 2026-10-29 | New PM read routes: `GET /api/platform/subscriptions` (`q`, `coverage` = ALL/CURRENT/FUTURE_ONLY/NONE, `serviceStatus`, `endFrom`, `endTo`, paging; SCR-61), `GET /api/platform/subscriptions/{farmId}` (periods, renewal opening date), `GET /api/platform/finance/receipts` (`q`, `farmId`, `bankFrom`, `bankTo`; tiles `receiptsInPeriod`, `totalAmount`; SCR-70), `GET /api/platform/finance/receipts/{paymentId}` (confirmation source `SEPAY_AUTOMATIC` / `PM_ACCEPT`, masked transaction id), `GET /api/platform/payments/summary` (SCR-62 tiles). `GET /api/platform/payments` adds optional `state`, `q`; `GET /api/platform/payments/evidence` adds optional `status` (ALL, TO_REVIEW, HOLD, REJECTED, ACCEPTED, LOCKED), `bankFrom`, `bankTo` — without them both behave as before. | Additive. |
| 2026-10-29 | An expired or purged cash report snapshot answers 410 with `MSG-FE21-12` (was a bare 410 text). | Show the MSG-FE21-12 banner and offer to run the report again. |
| 2026-10-29 | SCR-48 "Getting started": `GET /api/farms/{farmId}/dashboard/getting-started`, `POST .../getting-started/steps/{step}/done` (only `REVIEW_BREEDS_AND_PURPOSES`, `CHECK_FARM_PARAMETERS`, `COMPLETE_VACCINE_DOSES`), `POST .../getting-started/dismiss`. Owner and Manager; the invite step is Owner only. | New panel. |
| 2026-10-29 | New notifications: PM reconciliation notice per bank evidence that needs review (`targetType` `BANK_TRANSFER_EVIDENCE`, UC-FE14-04); Owner subscription notices from JOB-05 (`targetType` `SUBSCRIPTION`: renewal opening, 30/7/1 days before the end, expired) with an email each; a reminder to the named PM/SA of an internal request OPEN for 4 hours (`INTERNAL_REQUEST`). | Appear in `/api/notifications/mine`. |
| 2026-10-28 (late) | New feed document routes: `GET/POST /api/farms/{farmId}/feed/receipts/{receiptId}/attachments`, `GET/DELETE .../receipts/{receiptId}/attachments/{attachmentId}` and the same four under `.../adjustments/{adjustmentId}/attachments` (PDF/JPEG, 10 MiB, DRAFT only for changes). Upload/remove require `Idempotency-Key`. Multipart limits are now 10 MB per file / 11 MB per request. | Additive. Build the SCR-79/80 attachment lists on these routes; do not use `/api/farms/{farmId}/attachments/{id}` for them (it serves only cattle and entry photos). |
| 2026-10-28 (late) | Invitation and membership commands (`POST .../invitations`, `.../invitations/{id}/resend`, `.../cancel`, `PUT .../members/{id}`) require the `Idempotency-Key` header and replay on a retry. Invitation errors use `MSG-FE03-02/03/04/08/09/20` with params (`email`, `status`, `target`, `value`). | **Breaking** for callers without the header (generic 400). No screen calls these yet. |
| 2026-10-28 (late) | `POST /api/register` takes `{fullName, email, password, confirmPassword, termsAccepted}` (the old `ManagedUserVM` schema also demanded a `login` name, so the SRS form could not register). `POST /api/account/reset-password/init` and `/api/account/verification/resend` take the JSON object `{email}` (a bare JSON string arrived with its quotes and never matched an account). `ProfileResponse` adds `platformRole` and `farms[{farmId,farmName,role}]`. Sign-in, registration and password failures return `MSG-FE01-xx` codes (see Browser authentication). A SUSPENDED account can now request and finish a password reset. | **Breaking** for the two JSON-string bodies and the register body; additive for the profile fields and error codes. |
| 2026-10-28 (evening) | `POST /api/farms/{farmId}/feed/adjustments` now creates an adjustment document and returns `AdjustmentView`. It previously posted directly and returned `StockAdjustmentResult`, which is removed. The request adds `postNow` (default `false` = draft). New `GET /adjustments`, `GET/PUT /adjustments/{id}[/draft]`, `POST /adjustments/{id}/post`. | **Breaking.** Send `postNow: true` for the old one-step behaviour and read `AdjustmentView`. No current screen called the old route. |
| 2026-10-28 (evening) | Platform finance commands require the `Idempotency-Key` header (create, update, discard, post, void, replacement, report run). The amount error is `MSG-FE21-09` and the category/type error is `MSG-FE21-10` (previously `MSG-COM-10`). Report snapshots are available for 30 days (previously 7). | **Breaking** for callers without the header: a missing header is a generic Spring 400 (not a domain message), a blank key is 400 `MSG-COM-19`. |
| 2026-10-28 (evening) | Feed receipt codes are `PNK-YYYY-nnnn` from a yearly sequence (previously `PNK-YYYY-` + 6-digit database id). Feed errors use `MSG-FE23-03`, `MSG-FE23-05` and `MSG-COM-08` instead of generic codes. | Treat codes as opaque display text; map the new message codes. Existing receipts keep their old codes. |

The frontend submits one domain command, then reloads the returned aggregate or invalidates related queries. It must not compose raw entity writes to emulate transactions, grant its own service status after displaying a QR, infer ticket confirmation from reply text, or treat a reminder suggestion as a recorded event.
