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
| paymentId | Long; required for ACCEPT unless the evidence payment code identifies exactly one request; D21: optional related request for HOLD/REJECT | none and no exact code: FE19-11 NO_CANDIDATE; supplied unknown ID COM-08 | A9 body | `bank_transfer_evidence.payment_id` on ACCEPT; D21 `evidence_review.related_payment_id` per decision |
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

Not in the original D19 slice: delivery-attempt count, the separate "related
payment request" attribute of Evidence Review (added by D21 below), JOB-06
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

## D21 follow-up — approved 10/11/2026

Owner: current agent, sequential test/code/review, writable current checkout
`D:/Project/BeefCare-`, branch `feat/fe19-goi-thanh-toan`, initial HEAD
`4aac1e23e50573f2992877d40e3e01e949c74325`, initially clean. No new worktree,
commit, branch transfer or merge. User approved automatic confirmation of valid
looked-up transfers and per-decision related payment history.

Pre-edit sources: D12/D19/D20/D21; SRS Bank Transfer Evidence / Evidence Review
(808–815), UC-FE19-06 (2440–2453), SCR-62 (4951–4964), API-03 (5654–5659),
GBR-72/73/74/84/86/88/89; spec §3.4, §5 UC6, §6 SCR-62, A9/A11/A16/A17.
Traced the resource, review/lookup service, evidence/review/payment entities,
history query/DTO, OpenAPI, frontend read/command adapters, form and page.

### Field matrix and rules before editing production

| Field | Type / requiredness / default | Validation / condition | Storage and round trip |
|---|---|---|---|
| Review.paymentId | Long; default null; ACCEPT resolves exact code if omitted; optional for HOLD/REJECT | Supplied ID must exist (COM-08); HOLD/REJECT do not run acceptance rules or allocate money | Form candidate -> A9 -> service -> new nullable `evidence_review.related_payment_id` FK -> A16 history -> SCR-62 link |
| History.relatedPaymentId / relatedPaymentCode | nullable Long / string; one pair per review; default null | Saved review relation only; ACCEPT stores the resolved request; legacy rows and handling events have null | Review relation -> history DTO -> strict frontend adapter -> link to that exact payment; never infer from current evidence allocation |
| Lookup result reviewStatus / paymentId | existing string / nullable Long | Valid transfer automatically uses GBR-72/84; unmatched transfers remain unallocated; repeat returns original evidence/payment | Existing SePay ingestion -> payment/period/receipt/evidence -> API response -> frontend success message and refreshed detail |

The related request is per decision, not per voucher/cattle or a replacement
for evidence allocation. New migration only; existing review rows stay null.
All original reason/version/permission/return rules still apply.

### Regression record and test plan

P2 history loss: choose request A on SCR-62, save HOLD, then choose request B
and ACCEPT. Expected: HOLD retains A and ACCEPT retains B. Before: frontend
discarded the HOLD choice and history had no related request field. Source:
SRS 815; evidence: `EvidenceActions.submitDecision`, `EvidenceReview`,
`PlatformPaymentQueryService.evidence`. Current agent performs Testing then
Coding sequentially under the entry-point collaboration model.

| What | Where | Why |
|---|---|---|
| Lookup exact valid transfer -> PAID, period, receipt, Owner notice; replay unchanged; mismatches remain pending | PlatformReconciliationResourceTest + inherited PlatformReconciliationPostgresIT | Prove automatic confirmation and persisted effects without PM ACCEPT |
| HOLD A / REJECT without a request / ACCEPT B retain separate links; invalid optional ID writes nothing; legacy history stays null | Same backend classes; OpenApiContractTest | Prove history, optionality, database FK/readback and contract |
| HOLD/REJECT send selected candidate or null; history links use each row's request; lookup reports automatic confirmation | platformReconciliationBackend.test.tsx | Prove payload and visible behavior on SCR-62 |

Baseline: existing frontend reconciliation/read tests 24/24 PASS; existing
backend reconciliation/OpenAPI tests 11/11 PASS. Maven offline failed inside
the sandbox because the user cache was inaccessible; the same offline command
passed outside the sandbox using existing dependencies. New test results and
final verification are recorded below after the implementation.

### D21 implementation and verification

Implemented the optional per-review request as a nullable FK with insert-only
JPA mapping. The review command validates any supplied ID before writing;
ACCEPT saves the resolved/locked request, while HOLD/REJECT save context without
allocation. The history query fetches that relation and returns a nullable
`relatedPaymentId`/`relatedPaymentCode` pair. SCR-62 sends the selected candidate
for all three decisions, offers "Không gắn yêu cầu", and links each history row
to its own request. Lookup already used automatic confirmation; it retains
that behavior and now shows the confirmation result in the UI.

| Check | Fresh result, 10/11/2026 |
|---|---|
| Backend RED | 3 expected failures: missing history fields, unknown optional request accepted, OpenAPI missing nullable fields. Lookup behavior tests already passed after correcting the fixture code to the existing 14-character payment-code format. |
| Frontend RED | 6 expected failures: HOLD/REJECT dropped the choice, no way to clear an exact candidate (2 cases), missing per-review links, missing automatic confirmation message. |
| Backend H2/security/OpenAPI/domain | **42/42 PASS**: reconciliation 14, read workbench 13, SePay flow 9, OpenAPI 1, entity regressions 5. |
| PostgreSQL 16.15 | **28/28 PASS** via Failsafe: reconciliation 14, read workbench 13, previous-schema upgrade 1. New column, FK and old-row preservation verified on real migrations. |
| Frontend | **139/139 PASS**, platform-service + subscription; reconciliation/read subset 29/29. |
| Typecheck / production build | PASS / PASS; existing chunk-size warning. |
| Checkstyle | 0 violations; Spotless, JaCoCo and Modernizer explicitly skipped. |
| Contract | Exported from passing OpenApiContractTest; 220 paths / 269 operations. New history fields are nullable in OpenAPI 3.1; A9 describes optional HOLD/REJECT context. Catalog refreshed and 3 relevant review records updated; status remains BE_REVIEWED local (`doing`), not READY_FOR_FE. |

The broader frontend run first found one existing QR-test failure: the fixture
expired at 2026-11-10T03:00Z while the test used wall-clock time. The smallest
test-only fix freezes `Date.now()` at the fixture's NOW for that QR case; no
subscription production code or expiry rule changed. The full selected suite
then passed. The first OpenAPI GREEN attempt also exposed the existing 3.1
nullable-field allowlist; the two new fields were added, without weakening
the contract assertions.

Backend command (offline installed Maven 3.9.16, JDK 21; executed outside the
sandbox for access to the existing user Maven cache and Docker):

```powershell
mvn.cmd --batch-mode -o '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dtest=PlatformReconciliationResourceTest,PlatformPaymentReadResourceTest,SePayPaymentFlowTest,OpenApiContractTest,BankTransferEvidenceTest,EvidenceReviewTest' '-Dit.test=PlatformReconciliationPostgresIT,PlatformPaymentReadPostgresIT,EvidenceReviewPaymentMigrationPostgresIT' verify
```

Frontend commands: `VITE_BEEFCARE_DATA_SOURCE=local node node_modules/vitest/vitest.mjs run tests/unit/platform-service tests/unit/subscription`,
`npm.cmd run typecheck`, `npm.cmd run build`. Tests mock the backend transport
explicitly; this environment flag is not evidence of a live service mode.
Contract refresh: copy the successful `backend/target/beefcare-openapi.json`
to `docs/api/openapi.json`, then `py docs/tools/generate_api_catalog.py`.

Persistence evidence: secured HTTP -> resource -> service -> FK row, followed
by flush/clear + native SQL/read API on H2 and PostgreSQL. HOLD A remains linked
to A after ACCEPT B; an unlinked REJECT and legacy HOLD remain null; replay
adds no review. Exact-code ACCEPT also stores its resolved request. Valid
lookup creates one allocation/period/receipt and Owner notification with source
SEPAY; replay leaves them unchanged. Wrong amount/account/window/code and
outgoing transfers grant no period. Upgrade test starts from the full prior
schema in an isolated Testcontainers schema, preserves the old row and checks
both a valid new FK and rejection of an invalid FK.

Files changed: payment review entity/service/query/resource and OpenAPI config;
new `20261110000200_evidence_review_payment.xml` + master include; reconciliation,
OpenAPI and migration tests; platform-service read/command adapters, decision
form, lookup and history page + tests; one existing subscription QR test clock;
D21, FE-19 spec/open questions, this report, OpenAPI and API handoff catalog.
Initial user changes: none. Committed on the same feature branch after the UC6
review (10/11/2026) as `9a43cb6` (code) and `40066fc` (docs). No merge or push.

Skills: the RTK TDD/React/verification paths referenced on the macOS host are
not installed in this Windows checkout; used the entry-point/RTK test-first,
feature-boundary and verification rules directly. No package was installed.

Limits: no new browser/runtime/side-by-side capture, automated E2E or visual
regression test in this follow-up; earlier runtime captures above are historical.
SePay client is mocked in HTTP tests; no SePay LIVE request or configuration
change, full repository suite, new concurrency/rollback audit or integrated
deployment. Existing lookup deduplication remains by BR-D24 identity rather
than an Idempotency-Key; delivery-attempt count and JOB-06 remain outside scope.

## UC6 review fixes and D22 — 10/11/2026

Review of the committed UC6 slice (`f3e35e9`, `4aac1e2`) and D21 (`9a43cb6`,
`40066fc`). The user chose: an exact code funds only its own farm; the SePay
transaction ID stays the lookup request key; commit D21 before the fixes (D22).

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | Confirmations were not serialized per farm as GBR-72 requires: PM ACCEPT, the SePay pipeline and JOB-04 loaded the request/subscription before the farm lock. `Payment.subscription` is EAGER and `Subscription` has no `@Version`, so `lockByFarmId` returned the earlier copy unchanged | A temporary test showed `lockByFarmId` returning `latestEnd = null` after another transaction committed a new end; the new concurrency tests reproduced it end to end (RED below) | Id-only reads before the lock (`findRequestFarmById`, `findRequestFarmsByQuoteRef`, `findFarmIdById`), then farm → subscription → request locks in all three paths |
| 2 | With an exact code of request X, ACCEPT took any selected request, including another farm's | Candidate query listed every farm's matching request | D22: candidates and ACCEPT limited to X's farm; other farm → MSG-FE19-11 `OTHER_FARM`, nothing allocated; mistyped code unchanged |
| 3 | A PM lookup that confirms a payment (D21) was audited without actor (GBR-86) and showed "Hệ thống" | `audit(null, …)` in the shared pipeline | Lookup passes the PM as audit actor for `SEPAY_EVIDENCE` / `SEPAY_PAYMENT_PAID`; `confirmationSource` stays SEPAY (decoupled from the actor) |
| 4 | Outgoing transfers still notified every PM "cần đối soát" although D20 makes them NO_ACTION | `saveEvidence` always called `evidenceNeedsReview` | Notice only for incoming or legacy direction-less evidence; evidence and audit unchanged |
| 5 | A malformed SePay row turned the lookup into 400 and the UI into a generic save error | `transfer()` client-error mapping reused for provider data | API-03 rows that cannot be stored are 502 (by ID and by period, the period list fails as a whole, nothing stored); UI text for 502 names both causes |

The earlier PostgreSQL row "pessimistic locks" in this report only covered
sequential tests; concurrent locking is now covered by
`SubscriptionConfirmationConcurrencyTest` / `…PostgresIT`.

### Field matrix (changed rows only)

| Field | Type / requiredness | Validation / condition | Storage and round trip |
|---|---|---|---|
| Review.paymentId on ACCEPT | Long, optional when the code is exact | must exist (COM-08); if the evidence code exactly matches request X, the selected request must belong to X's farm, else FE19-11 `OTHER_FARM` | unchanged: `bank_transfer_evidence.payment_id`, `evidence_review.related_payment_id` |
| Candidates (A8) | list | exact code → X's farm only; mistyped/missing code → all farms | read only |
| Lookup actor (A11) | — | PM with ACTIVE access | `audit_log.actor_id` of `SEPAY_EVIDENCE` / `SEPAY_PAYMENT_PAID` → history `pmName` |
| Lookup provider data (A11/A17) | — | unparsable time, missing direction, non-positive amount → 502 | nothing stored |

Left unchanged, reported to the user: JOB-04 computes `entitlementChanged`
after setting the entitlement on the same instance, so an entitlement-only
change (for example a SUSPENDED farm whose coverage ends) is saved without the
`SERVICE_STATUS_JOB` audit — existing behaviour, kept as is. `expireUnpaidRequests`
still loads the request before the farm lock; `Payment` is versioned, so a
concurrent change fails optimistically and the job retries — no wrong data.
`audit_log` has no role column (GBR-86 "actor, role"), pre-existing.

### Verification

| Check | Result, 10/11/2026 |
|---|---|
| Backend RED | 7 expected failures: PM ACCEPT and SePay periods started at the confirmation time (2026-10-28T03:00Z) instead of the end committed meanwhile (2029-10-28T03:00Z); JOB-04 wrote `latestEnd` 2026-10-28T02:59Z back over the renewal; the other farm's request was a candidate; lookup audit actor null; invalid SePay data 400; outgoing notice sent. The 23 existing tests of the run passed |
| Frontend RED | 1 expected failure (OTHER_FARM and 502 texts) |
| Backend H2 | **98/98 PASS**: reconciliation 17, read workbench 13, concurrency 3, SePay flow 10, subscription 8, overview 11, history 9, request 7, finance workflow 12, OpenAPI 1, notification target 2, entity 5 |
| PostgreSQL 16.15 | **34/34 PASS** via Failsafe: reconciliation 17, read workbench 13, concurrency 3 (own schema `uc6_concurrency`, asserted), migration 1 |
| Checkstyle | 0 violations (Spotless, JaCoCo, Modernizer skipped) |
| Frontend | **140/140 PASS** platform-service + subscription; typecheck PASS; production build PASS (existing chunk-size warning) |
| OpenAPI | Only `Review.paymentId` description changed (220 paths / 269 operations / 296 schemas); the committed file equals the export semantically (springdoc reorders `Page` properties, so only the changed line was applied); catalog regenerated |

Backend command (installed Maven 3.9.16, JDK 21, offline):

```powershell
mvn.cmd --batch-mode -o '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dtest=SubscriptionConfirmationConcurrencyTest,PlatformReconciliationResourceTest,PlatformPaymentReadResourceTest,PlatformSubscriptionResourceTest,SePayPaymentFlowTest,SubscriptionOverviewResourceTest,SubscriptionPaymentHistoryResourceTest,SubscriptionPaymentRequestResourceTest,OpenApiContractTest,PlatformFinanceWorkflowTest,NotificationTargetAccessServiceTest,BankTransferEvidenceTest,EvidenceReviewTest' '-Dit.test=SubscriptionConfirmationConcurrencyPostgresIT,PlatformReconciliationPostgresIT,PlatformPaymentReadPostgresIT,EvidenceReviewPaymentMigrationPostgresIT' verify
```

Frontend: `VITE_BEEFCARE_DATA_SOURCE=local node node_modules/vitest/vitest.mjs run tests/unit/platform-service tests/unit/subscription`,
`npm.cmd run typecheck`, `npm.cmd run build`.

Not verified: browser/runtime rerun, manual E2E by the user, SePay LIVE, the
full repository suite. Handoff stays BE_REVIEWED local, not READY_FOR_FE.
