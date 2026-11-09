# FE-19 UC-06 — Reconcile subscription payment (SCR-62)

## Scope and decision

User approved all five proposals on 10/11/2026 (D19). Backend + SCR-62 backend
mode: PM decisions ACCEPT / HOLD / REJECT, lock for return, record return,
unlock, and SePay lookup (API-03) by transaction ID and by period. Builds on the
UC-05 read slice (D18). Branch `feat/fe19-goi-thanh-toan`.

Sources: SRS_2026-10-28 UC-FE19-06 (2440–2453), SCR-62 (4951–4964), Bank
Transfer Evidence / Evidence Review (808–815), GBR-72/73/74/84/86 (5863–5883),
API-03 (1591, 5654–5659), MSG-FE19-10/11/16 (6122–6128); FE-19 spec R-19-06,
R-19-08 to R-19-10, A9–A11, TC-19-17 to TC-19-22, Q2, Q4; D18, D19.

## Contract and field matrix (before production changes)

Every command: PM with ACTIVE account and ACTIVE PM access on each request;
header `Idempotency-Key` (1–128, no control characters; same key + same body
replays the first result, same key + other body is MSG-COM-19); `version` is the
evidence version the PM saw. All writes of one command commit together.

| Field / input | Type, requiredness, condition | Validation and error | API | Storage |
|---|---|---|---|---|
| decision | enum ACCEPT / HOLD / REJECT, required | missing COM-06, other COM-10 | A9 body | `evidence_review.decision`; HOLD/REJECT also `bank_transfer_evidence.review_status` |
| paymentId | Long; required for ACCEPT unless the evidence payment code identifies exactly one request; ignored for HOLD/REJECT | none and no exact code: FE19-11 NO_CANDIDATE; unknown COM-08 | A9 body | `bank_transfer_evidence.payment_id` on ACCEPT |
| reason (decision) | text, required, trimmed 1–1,000 (D19) — one field "Reason and evidence references" | missing COM-06, longer COM-10 | A9 body | `evidence_review.reason` (clob); `bank_transfer_evidence.review_reason` varchar(1000) |
| version | Long, required | missing COM-06; differs COM-05 (E4, e.g. SePay just confirmed) | A9/A10 body | `bank_transfer_evidence.version` (@Version) |
| ACCEPT checks | shared GBR-72 + GBR-84, serialized per farm | FE19-11 with `reason`: EVIDENCE_ALLOCATED, LOCKED_FOR_RETURN, OUTGOING, REQUEST_NOT_PENDING, REQUEST_ALLOCATED, OUTSIDE_WINDOW, AMOUNT_MISMATCH, ACCOUNT_MISMATCH, MANUAL_INCOME; nothing allocated | A9 | Payment PAID + period + receipt; Subscription end; farm status (not if SUSPENDED); review row; audit; Owner notification |
| HOLD / REJECT state | allowed on unallocated, unlocked evidence; re-review allowed (AF2) | allocated FE19-11 EVIDENCE_ALLOCATED; locked FE19-11 LOCKED_FOR_RETURN | A9 | review_status HOLD / REJECTED, review row, audit |
| lock reason | text, required, 1–1,000 (Q4, D19) | COM-06 / COM-10; allocated, already locked or OUT direction COM-05 | A10 lock-return | locked_for_return, review_status LOCKED_FOR_RETURN, review row LOCK, audit |
| return reference | outgoing bank reference, required, 1–255 | COM-06 / COM-10 | A10 record-return | `return_reference` |
| returnDate | ISO date, required (D19) | COM-06; after today (Asia/Ho_Chi_Minh) COM-07; before the bank-paid date COM-10 | A10 record-return | new `return_date` (date) |
| return result | text, required, 1–500 | COM-06 / COM-10 | A10 record-return | `return_result` |
| record-return state | only while locked and not yet recorded; recorded once, immutable (D19) | not locked or already recorded COM-05 | A10 | review row RETURN_VERIFIED, audit; evidence stays locked |
| unlock reason | text, required, 1–1,000 | COM-06 / COM-10; not locked or return recorded COM-05 | A10 unlock-return | locked_for_return false, review_status UNMATCHED, review row UNLOCK, audit |
| lookup transactionId | positive Long path | not configured 503, not found 404, provider failure 502 | A11 POST | evidence stored once by (SEPAY, env, namespace, txn id) |
| lookup from / to | ISO dates, both required, from ≤ to, span ≤ 31 days | COM-06; reversed COM-11; longer COM-10 | A17 GET (new) | read only; each row carries the stored evidenceId if any |
| lookup row | transactionId, bankPaidAt, amount, direction, content?, referenceCode?, evidenceId? | at most 200 rows (`limit` returned) | A17 | — (SePay data, not stored until "Save as evidence") |
| detail return fields | returnReference?, returnDate?, returnResult? | — | A16 GET | evidence columns |
| history | REVIEW rows now include LOCK / UNLOCK / RETURN_VERIFIED; RETURN_VERIFIED carries reference / result / returnDate | legacy audit-only events still shown, no duplicates (same timestamp written by one command) | A16 GET | `evidence_review` + allowlisted `audit_log` |

Duplicate webhook vs lookup (D19.4): the same (provider, environment, namespace,
transaction id) is a duplicate when amount, direction, bank-paid time and
receiving account are equal, even if the provider's payload text differs; other
differences remain 409.

Implementation choices not in the SRS (flagged for the user): the period lookup
is capped at 31 days and 200 rows; lookup has no `Idempotency-Key` because it is
idempotent by the evidence identity; lock / unlock / record state errors use
MSG-COM-05 because the UI only offers them in valid states.

Not in this slice: delivery-attempt count, the separate "related payment request"
attribute of Evidence Review (the allocated payment is on the evidence), JOB-06
retry queue and SePay LIVE verification.

## Implementation and verification — 10/11/2026

Tests were written first. RED logs are in the session scratchpad, not in the
repository.

| Check | Result |
|---|---|
| Backend RED | `PlatformReconciliationResourceTest` 10/10 and `OpenApiContractTest` failed for the expected reasons (no key enforcement, no FE19-11 codes, 500-character limit, no period lookup, 409 on provider text differences, no review rows) |
| Frontend RED | `platformReconciliationBackend.test.tsx` 9/9 failed (no decision panel or lookup) |
| Backend H2 | **86/86 PASS**: UC6 10, UC5 12, SePay flow 9, UC4 8, overview 11, history 9, request 7, OpenAPI 1, finance workflow 12, notification target 2, entity 5 |
| PostgreSQL | **22/22 PASS**: `PlatformReconciliationPostgresIT` 10 (real migrations: varchar(1000), `return_date`, review rows, pessimistic locks) and `PlatformPaymentReadPostgresIT` 12; Testcontainers PostgreSQL 16.15 with `-Dapi.version=1.44` |
| Checkstyle | 0 violations (Spotless, JaCoCo, Modernizer explicitly skipped) |
| Frontend | **133/133 PASS** platform-service + subscription (UC6 9, UC5 14) |
| Typecheck / build | PASS / PASS (existing chunk-size warning) |
| OpenAPI | Exported after `OpenApiContractTest`: 220 paths / 269 operations / 296 schemas (+ `GET /lookup`, `SePayLookupRow`, `SePayLookupPage`); key header required on the four commands; `Review` has no `references` and `reason.maxLength` 1000 |
| Catalog | `generate_api_catalog.py` maps `lookupPeriod` to UC-06 and refreshed the embedded spec |

Backend command (installed Maven 3.9.16; the wrapper fails on this Windows host):

```powershell
mvn.cmd --batch-mode -o '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dtest=PlatformReconciliationResourceTest,PlatformPaymentReadResourceTest,PlatformSubscriptionResourceTest,SePayPaymentFlowTest,SubscriptionOverviewResourceTest,SubscriptionPaymentHistoryResourceTest,SubscriptionPaymentRequestResourceTest,OpenApiContractTest,PlatformFinanceWorkflowTest,NotificationTargetAccessServiceTest,BankTransferEvidenceTest,EvidenceReviewTest' '-Dit.test=PlatformReconciliationPostgresIT,PlatformPaymentReadPostgresIT' verify
```

Frontend: `VITE_BEEFCARE_DATA_SOURCE=local node node_modules/vitest/vitest.mjs run tests/unit/platform-service tests/unit/subscription`, then `npm.cmd run typecheck` and `npm.cmd run build`.

Round trip covered by tests: secured HTTP request with key and version →
resource → idempotent transaction → service rules → DB (flush/clear readback on
H2 and PostgreSQL: payment state, period, receipt, allocation, review rows,
audit, notification, reason length, return date) → response → frontend adapter
and SCR-62 state (request body, key reuse, success and error messages, reload).

Changed UI: SCR-62 backend mode gains the "Xử lý chứng từ" panel (decision,
candidate radio, one reason field with counter, Check and accept / Save HOLD /
Save REJECT, Lock for return, Record return, Unlock), the "Tra cứu giao dịch
SePay" card (by ID and by period) and history labels for LOCK / UNLOCK /
RETURN_VERIFIED with the return date. Local demo mode is unchanged.

Runtime (scripted, 10/11/2026): `backend/target/fe19-uc06-runtime.cjs` started
an isolated backend from the built classes (H2 in memory, profile
`dev,local,testh2`, port 8090, SePay MOCK, empty lookup token, random seed
password) and Vite on 5175 in backend mode; the user's own services on
5173/8080 were left running and untouched. Real cookie/CSRF login as PM. Flows:
mistyped code → decision/candidate/reason validation → ACCEPT (payment PAID,
source PM, receipt, evidence linked, tiles/list/history updated); exact code
with wrong amount → server MSG-FE19-11 shown in the panel → HOLD; lock → future
return date rejected → return recorded (history RETURN_VERIFIED, LOCK,
EVIDENCE_RECEIVED, no duplicates); another PM changes the evidence → MSG-COM-05
warning and reload; outgoing transfer offers only HOLD/REJECT; SePay lookup by ID
and by period shows the not-configured message, 32-day range rejected without
HTTP. No page errors; no horizontal overflow at 1440x900 and 1180x820; the only
non-2xx responses were the intended 409/503 cases and the existing favicon 404.
Screenshots and manifest: `backend/target/fe19-uc06-ui/` (ignored, not a
baseline). Review findings from this run are listed by the agent separately.

Not verified: manual E2E by the user; SePay LIVE lookup and the real list API
(client mocked in tests, token empty at runtime); full repository suite. Handoff
stays BE_REVIEWED local, not READY_FOR_FE.

## Runtime review fixes and D20 — 10/11/2026

User chose option (a) for the outgoing-transfer question and asked to fix all
five UI findings. Tests were written first (backend 2 RED, frontend 7 RED).

| # | Finding from the runtime review | Fix |
|---|---|---|
| 1 | The inline error stayed after the PM selected a candidate or edited the reason | Any input change clears the panel error |
| 2 | A MSG-COM-05 reload remounted the form and lost the typed decision, candidate and reason | The draft is kept by the evidence panel and restored into the reloaded form (candidate only if still eligible); a saved change still starts empty |
| 3 | Candidates appeared twice (read-only card and radio list) | One radio list (SCR-62 #9), shown before a decision, each with "Xem yêu cầu" link; the choice is sent only for ACCEPT |
| 4 | Lookup dates had no visible label; the ID box filled the card width | Visible labels "Mã giao dịch SePay", "Từ ngày", "Đến ngày"; fixed widths in two groups |
| 5 | History showed "—" before a recorded return's reference | "—" only when the row has no reason, reference, result or return date |
| 6 (D20) | Unresolved outgoing transfers counted as "Cần xem" | `NO_ACTION` status ("Không cần xử lý"), excluded from the tile and the TO_REVIEW filter, visible under ALL; legacy rows without direction stay reviewable |

| Check | Result |
|---|---|
| Backend RED | `outgoingTransfersAreNotQueuedForReviewButStayVisibleUnderAll` and `OpenApiContractTest` (enum) failed as expected |
| Frontend RED | 7 expected failures (stale error kept, draft lost, duplicate candidate list, missing lookup labels, leading dash, NO_ACTION rejected by the adapter) |
| Backend H2 | **87/87 PASS** (UC5 13, UC6 10, others unchanged) |
| PostgreSQL | **23/23 PASS** (`PlatformPaymentReadPostgresIT` 13, `PlatformReconciliationPostgresIT` 10) |
| Checkstyle | 0 violations |
| Frontend | **134/134 PASS** platform-service + subscription; typecheck PASS |
| OpenAPI | 220 / 269 / 296 unchanged; `reviewStatus` enum adds `NO_ACTION`; catalog refreshed |
| Runtime rerun | Same isolated harness: review tile 4 with an outgoing row present, "Không cần xử lý" in the list, one candidate list, error cleared on candidate selection, draft kept after MSG-COM-05, no leading dash in the return row, visible lookup labels; no page errors, no horizontal overflow, only the intended 409/503 responses |
