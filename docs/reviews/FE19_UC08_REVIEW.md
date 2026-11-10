# FE-19 UC-FE19-08 — authenticated receipt, durable processing and paid notice

Status: BE_REVIEWED locally on 10/11/2026; all five user-approved proposals implemented and verified, then four findings of the follow-up code review fixed and re-verified (section "Review fixes" at the end). Not READY_FOR_FE: no approved integrated checkpoint or SePay LIVE verification.

## Ownership and preservation

Single writer in `D:/Project/BeefCare-`, branch `feat/fe19-goi-thanh-toan`, starting HEAD `783189f934f569be389c3cc59063c37b6ac164a2`.
No worktree/branch/commit/merge is created. The 41 pre-existing dirty/untracked UC7 files are preserved with SHA-256 and copies under ignored `backend/target/uc8-preservation/`.

## Sources and approved scope

- `docs/REQUIREMENT_DECISIONS.md`: D12, D15, D19–D23 and the UC8 decision recorded for this assignment.
- SRS 28/10: I.3.2 H (Subscription anniversary, Payment Request, Bank Transfer Evidence and review); II.15.4 UC-FE19-08 all flows; III.24.6 JOB-06; III.24.7 JOB-07; III.25.2 API-02; NFR-P05 (10-second eligible confirmation under normal load), NFR-S08; GBR-13/15/64/72/73/74/84/86/88.
- `docs/requirements/specs/FE-19-goi-thanh-toan.md`: sections 2–5, A11/A15, Q5, TC-19-07–16/19/22/29; OPEN_QUESTIONS Chung Q1.
- `docs/agent-context/README.md` routes ARCHITECTURE/API_RULES/VERIFICATION; backend/AGENTS and backend-workflow/api-handoff HTML.
- Actual ingress: SePayWebhookResource → SePaySignatureVerifier → SePayWebhookService; Payment/Subscription/Farm/Evidence repositories and entities, migration master; shared PM confirmation and API-03.
- Official SePay HMAC matches the SRS (`https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc`). Provider retries and internal JOB-06 retries are different: HTTP-error retries must be enabled at SePay; no live configuration is changed.

Approved: webhook-only deferred settlement after evidence + job commit; both URLs; durable retry and manual reconciliation after 24h; no arbitrary choice among contradictory references; Vietnamese paid email. Keep immediate successful simulator/API-03 results, use the same stored-evidence processor and durable retry on technical failure. Scope JOB-07 to payment notifications/email; do not activate consumers for unrelated outbox events. PostgreSQL/MOCK/Mailpit verification; no LIVE.

## Contract and field audit before implementation

Machine ingress has no frontend form. Signed raw bytes must reach the verifier unchanged; browser adapters neither submit nor fabricate these values. Owner SCR-59 reads real received/confirmed clocks; SCR-62 reads real evidence and review state. Job and delivery diagnostics are internal, not new UI form fields.

| Field | Type/unit and requiredness/default | Rule / source | Complete storage and response path |
| --- | --- | --- | --- |
| X-SePay-Timestamp | required decimal Unix seconds | ±300 inclusive, HMAC input; API-02 / NFR-S08 | raw HTTP header → verifier; rejected calls retain only time/reason/body byte count, purged after 30 days by JOB-08; a metadata storage failure still answers 401 (review fix #4) |
| X-SePay-Signature | required sha256=64 hex | HMAC-SHA256(timestamp + '.' + exact raw bytes) | verifier before payload parsing; never persist signature/secret |
| id | required positive bigint | SePay transaction identity; BR-D24 | payload → normalized transfer → evidence.provider_txn_id; one unique provider/env/namespace/id |
| gateway | optional string; bounded only by the 65536-byte body (review fix #3) | provider bank name, never refused or truncated | payload → evidence.gateway (varchar 65536) → PM detail.bank |
| transactionDate | required bank time | ISO instant or yyyy-MM-dd HH:mm:ss in Asia/Ho_Chi_Minh | normalized Instant → bank_paid_at → Owner and PM bankPaidAt |
| accountNumber | optional string, body-bounded (review fix #3); missing cannot confirm | must match immutable request context/account; a non-matching long value is stored UNMATCHED | receiving_account (varchar 65536) → eligibility → PM detail/account check |
| code | optional string, body-bounded (review fix #3) | collect unique payment references alongside content/referenceCode | provider_code (varchar 65536) retained; single resolved value → quote_ref; conflict flag → NEEDS_REVIEW |
| content | optional string; raw body max65536 bytes | no arbitrary first match; exact unique request | full transfer_content (expanded from255) → PM evidence detail; no truncation |
| description | optional string, body size bound | API-02 lists it separately from content | new evidence.description; retained independently; not substituted for content |
| transferType | required IN/OUT after normalization | OUT retained; D20 NO_ACTION/no reconciliation notice | transfer_direction → processor → existing PM status adapter |
| transferAmount | required positive decimal within persisted precision/scale | exact quote amount to settle; no combine/split | evidence.amount → payment snapshot comparison; no forced null |
| referenceCode | optional string, body-bounded (review fix #3) | bank reference, also inspect for payment-reference contradiction | reference_code (varchar 65536) → PM detail.referenceCode |
| provider/environment/namespace | server-owned required context | immutable ingestion identity; compare request snapshot | evidence fields, unchanged for retries/processing |
| first received / delivery attempts | Instant / nullable legacy integer | first receipt immutable; authenticated replay increments accepted delivery count by bulk update (evidence version unchanged, review fix #2), job retry does not | first_received_at / delivery_attempts; old unknown counts remain null |
| job | required one per new evidence | PENDING → DONE / FAILED; durable lease, attempts, availability and first-failure deadline | evidence + bank_evidence_job same commit; replay never queues a second job |
| confirmation outputs | server-owned only | allocation + PAID + purchased period + farm service + audit + notice intent atomic | existing Payment/Subscription/Farm/Evidence fields; existing read APIs return actual persisted values |
| paid email intent | one per PAID payment | current Owner, dedup key, access recheck, independent provider retry up to24h | durable email_delivery_job references payment; no activation claim for SUSPENDED |

Existing mismatches: ingress runs settlement before acknowledgement; no JOB-06 durable row/retry; response exposes settlement DTO rather than acknowledgement; alias lacks security/route; first match silently wins contradictory codes; description dropped and content truncated; delivery count absent; no paid email. These are the bounded defect handoff for test-first implementation. Duplicate transfer equality from D19/D22 remains authoritative; no raw-payload hash-only rejection.

## Approved tests: what, where, why

- `web/rest/SePayWebhookResourceTest`: signed raw HTTP on both routes, security/time boundaries, exact ack, committed evidence + pending job, replay/delivery clocks, payload preservation, contradictory codes, immediate simulator/lookup compatibility and durable email. Proves the ingress contract and DB round trip, without outer rollback masking transaction boundaries.
- Worker cases are in `web/rest/SePayWebhookResourceTest` and `SePayWebhookPostgresIT`: deterministic worker calls, lease recovery, retry1/5/15/hourly and24h exhaustion, independent transaction rollback, manual decisions before processing and concurrent delivery/workers. Existing reconciliation/confirmation suites cover source finance constraints and farm serialization. Prevents lost transactions or duplicate service.
- Payment mail tests: current Owner/access at dispatch, exact receipt data and suspended wording, one intent, failure independent of PAID and bounded retry; recheck existing account email tests after shared dispatcher extension.
- Migration PostgreSQL: new DB plus full previous-schema upgrade, preserve legacy evidence/counts/paid requests; use new changeset only.
- Regression: existing SePay/signature/PM reconciliation/concurrency and Owner read contracts, OpenAPI export/catalog. Existing frontend feature suites/typecheck/build if API presentation changes.

Baseline: 32/32 selected backend tests PASS with JDK21/Maven3.9.16. Initial sandbox could not read/download Maven parent; the same command outside that restriction passed, without changing dependencies. TDD/verification skills routed by RTK are absent at both configured Windows cache paths and the local skills search; direct test-first workflow is used, with no skill/dependency installation.

## Implementation and resolved findings

- Evidence and BankEvidenceJob commit before acknowledgement; durable DB queue needs no new dependency. Both POST routes use identical HMAC/CSRF exemption/security rules. The shared processor preserves successful immediate simulator/API-03 results and the PM actor; failures after storage remain retryable.
- Each attempt claims a lease then locks job/evidence; confirmation keeps existing farm → subscription → payment locking. An already decided/locked/allocated evidence is not overwritten. Job retries cannot be confused with webhook delivery counts. Restricted rejected-call metadata contains only time/reason/body size.
- Queue state RECEIVED maps to the existing SCR-62 PROCESSING; unallocated processed state UNMATCHED retains API-03 compatibility and D18's TO_REVIEW normalization. Exhaustion is NEEDS_REVIEW with a separate technical reason. This resolves the spec's alternative UNMATCHED/NEEDS_REVIEW wording without changing the public enum.
- Payment-specific JOB-07 reuses email_delivery_job as the committed delivery intent, with a unique event key; no OutboxEventHandler or unrelated event consumer is activated. Existing in-app event keys remain deduplicated; delivery resolves current Owner/access and does not roll back PAID when SMTP fails. SMTP is not an exactly-once transport: a provider-accepted send followed by process failure before marking SENT can be redelivered; the app guarantees one intent and no duplicate period/receipt.
- GBR-73 anniversary is derived from the committed contiguous purchased-period chain. A February29 anchor survives intermediate February28 ends and a gap starts a new chain. No fabricated legacy subscription anchor column is introduced.
- Regression findings and fixes: synchronous ingress audit plus final processing initially doubled UC6 history; keep the existing single final evidence event. UC2's webhook-progress test now invokes JOB-06 before expecting PAID, retaining every previous business assertion. Two new fixtures were corrected (Hikari auto-commit=false requires explicit committed updates; inherited user(String) shadowed the security helper). No requirement assertions were weakened.

## Fresh verification

JDK21.0.11, Maven3.9.16, PostgreSQL16.15, H2 PostgreSQL mode, Vitest2.1.9. Final code checkpoint: `working-tree-b6494b2236c9d45e` on the starting HEAD; no production source changed after this verification/runtime.

| Check | Result |
| --- | --- |
| Initial baseline |32/32 selected backend tests PASS |
| Initial UC8 RED |7 cases:4 behavior failures and3 missing-schema errors, before implementation |
| Mail RED |Unknown receipt template was cancelled/no email; fixed by payment dispatch branch |
| Contract/calendar/legacy RED |3/3 failed: inherited session security, February28 instead of February29 in2032, fabricated legacy count1 |
| Final rule RED |3/3 failed before fixes: fractional/string ID silently accepted and outgoing exhaustion wrongly announced |
| Surefire |99/99 PASS: UC8 HTTP/DB26, SePay flow10/signature2, PM read13/reconciliation17, farm concurrency3, Owner overview11/create7/history9, OpenAPI1 |
| Failsafe |49/49 PASS: PostgreSQL UC8 HTTP/worker26 + full upgrade1 + farm-lock concurrency3 + reconciliation17 (47 PG cases), existing H2 email dispatch2 |
| Frontend |158/158 platform-service/subscription tests PASS; new reason test initially RED; typecheck and production build PASS |
| Quality gates |Checkstyle0 violations. Spotless/JaCoCo/Modernizer explicitly skipped; no claim for those gates. Existing >500kB frontend chunk advisory retained |
| Contract |OpenApiContractTest passed and exported actual headers/request/ack/alias/errors; export copied only after PASS; catalog refresh recorded below |

Final backend command from `backend/`:

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dtest=SePayWebhookResourceTest,SePaySignatureVerifierTest,SePayPaymentFlowTest,PlatformReconciliationResourceTest,SubscriptionConfirmationConcurrencyTest,SubscriptionOverviewResourceTest,SubscriptionPaymentRequestResourceTest,SubscriptionPaymentHistoryResourceTest,PlatformPaymentReadResourceTest,OpenApiContractTest' '-Dit.test=SePayWebhookPostgresIT,SePayProcessingMigrationPostgresIT,SubscriptionConfirmationConcurrencyPostgresIT,PlatformReconciliationPostgresIT,EmailActivationFlowIT' verify
```

Frontend commands from `frontend/`: set `VITE_BEEFCARE_DATA_SOURCE=local` for existing demo cases, then `node node_modules/vitest/vitest.mjs run tests/unit/platform-service tests/unit/subscription`, `npm.cmd run typecheck`, `npm.cmd run build`. Backend-mode tests explicitly exercise strict adapters. The actual runtime frontend/.env remained backend mode with empty API_URL.

Logs: ignored `backend/target/uc8-baseline.log`, `uc8-red.log`, `uc8-worker-mail-red.log`, `uc8-contract-anniversary-red.log`, `uc8-final-rule-red.log`, `uc8-verification.log`, `uc8-fe-verification.log`, `uc8-typecheck.log`, `uc8-build.log`; fresh Surefire/Failsafe XML reports. Failed intermediate runs are not final PASS evidence.

## Real HTTP, DB, email and manual browser evidence

- Session `beefcare-uc8`, backend8081/dev,local,api-docs; temporary Vite5174 using relative /api proxy to that backend. Own schema `uc8_runtime_b59f581382d68a0d` in local PostgreSQL16.15; application's existing schema unchanged. Synthetic receiving context MOCK/UC8-RUNTIME and test-only HMAC. Local seed identities only, Mailpit SMTP; no LIVE.
- Actual flow: JSON login + CSRF; PM publishes test price in owned schema; Owners create two requests; SCR-59 pending; signed invalid callback401; signed valid callback200 exactly success; scheduler confirms without a manual job call; SCR-59 polling displays PAID. Repeating via SRS alias200 keeps one allocation. Contradictory references for the second request remain unallocated and SCR-62 displays the Vietnamese reason/history. No interception or storage/cookie injection; API login uses in-memory browser contexts.
- Observed eligible callback → PAID read448ms under this local normal load (one sample, not a throughput benchmark). Persisted payment1901: PAID/SEPAY, receipt RC-26-001901, confirmed/start `2026-11-10T15:22:55.340902Z`, end/subscription end `2027-11-10T15:22:55.340902Z`. Evidence count1, first received `2026-11-10T15:22:55.103289Z`, delivery count2, description intact; job DONE/attempt1. Second payment1902 stays PENDING; conflicting evidence UNMATCHED. Fresh API and native psql readback are in manifest.
- Mailpit received "Xác nhận thanh toán gói dịch vụ BeefCare", including correct payment/receipt and `.../goi-dich-vu/lich-su?farm=<id>`. Email intent SENT. Own rendered HTML is saved with the evidence, no activation token/auth state.
- Artifact manifest: `C:/Users/nvkha/AppData/Local/Temp/beefcare-uc8-runtime-Bwuf5F/evidence/manifest.json`. Six PNGs and matching accessibility snapshots: SCR-59 pending/paid and SCR-62 conflicting-codes, each1180×820 and1440×900, all captured at the same production checkpoint and individually inspected. No document horizontal overflow. At1180 vertical scroll is present on all three states; at1440 only the long reconciliation page scrolls. Text/controls were visible in the inspected captures.
- This is manual runtime/visual inspection, after-only; no approved pixel baseline, side-by-side visual regression or automated E2E/visual suite. Skill consulted: project `.agents/skills/playwright-cli/SKILL.md`; CLI and referenced helper documents absent on Windows, so existing playwright-core was used without installing a runner/browser/dependency.
- No uncaught page exception or observed failed API response in the page flow. One resource404 console message remains; its resource URL was not captured, so it is not attributed or claimed fixed. Fake QR data showed the existing text fallback, as expected for the test fixture.
- All owned browser contexts, backend8081 and Vite5174 closed. Both own runtime schemas retained (first setup had a login415 before correcting the helper to the JSON contract; no feature defect); immutable price/payment history and Mailpit evidence retained. No saved cookies/tokens/storageState, no reset of shared DB/volume or existing user work.

## Handoff limits

Completed local UC8 acceptance and the five approved proposals; shared API-03/PM success behavior and Owner read regression verified. Unverified: SePay LIVE/Sandbox account delivery and provider retry configuration, production mail delivery/crash-window provider idempotence, approved merged/integrated environment, full repository suite, automated E2E/visual regression. Current status is local BE_REVIEWED, not READY_FOR_FE. No commit/push/merge.

## Final artifact and preservation audit

OpenAPI export equals the passing test artifact. Compared with the initial UC7 export: no removed path or changed existing schema; only the old webhook operation changes, one alias is added, and SePayPayload/WebhookAcknowledgement are new. Catalog:222 paths/271 operations/301 schemas, all271 have source snapshots. Both UC8 review records have current signatures and local BE_REVIEWED/doing, not READY; all previous review records are unchanged.

Offline HTML smoke PASS: UC8 search returns2 APIs, header/body fields and expanded200 ACK render, ready tab excludes the unfinished handoff, JSON export/import and HTML export preserve both current signatures, no page errors. Evidence: ignored backend/target/uc8-handoff-smoke.json and uc8-exported-handoff.html.

Preservation:31 of the41 initial dirty/untracked files are byte-identical, including all UC7 production/UI/test files outside the three intentionally shared backend files and documentation. The10 overlap files retain their UC7 content plus UC8 additions; original copies/hashes are preserved. A misplaced duplicate scratch backup created during preflight was removed only after verifying all7 copied hashes against the correct snapshots. No user work was removed. Final branch/HEAD unchanged, no commit/push/merge, owner /root ends this assignment locally complete.

Files changed for this assignment (including the10 explicit overlaps; unrelated UC7 files excluded):

- `backend/src/main/java/vn/edu/fpt/beefcare/config/BackendApiDocumentationConfiguration.java` (pre-existing UC7 overlap)
- `backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/domain/BankEvidenceJob.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/domain/BankTransferEvidence.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/domain/EmailDeliveryJob.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/domain/SePayWebhookRejection.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/repository/BankEvidenceJobRepository.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/repository/EmailDeliveryJobRepository.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/repository/PaymentRepository.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/repository/SePayWebhookRejectionRepository.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/MailService.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/email/EmailDeliveryJobService.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/SePayWebhookResource.java`
- `backend/src/main/resources/config/liquibase/changelog/20261110000400_sepay_durable_processing.xml`
- `backend/src/main/resources/config/liquibase/master.xml` (pre-existing UC7 overlap)
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/OpenApiContractTest.java` (pre-existing UC7 overlap)
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/SePayProcessingMigrationPostgresIT.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/SePayWebhookPostgresIT.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/SePayWebhookResourceTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/SubscriptionPaymentRequestResourceTest.java`
- `docs/LOCAL_SETUP.md`
- `docs/REQUIREMENT_DECISIONS.md` (pre-existing UC7 overlap)
- `docs/api-handoff.html` (pre-existing UC7 overlap)
- `docs/api/README.md` (pre-existing UC7 overlap)
- `docs/api/openapi.json` (pre-existing UC7 overlap)
- `docs/requirements/specs/FE-19-goi-thanh-toan.md` (pre-existing UC7 overlap)
- `docs/requirements/specs/MISSING_ROUTES.md` (pre-existing UC7 overlap)
- `docs/requirements/specs/OPEN_QUESTIONS.md` (pre-existing UC7 overlap)
- `docs/reviews/FE19_UC08_REVIEW.md`
- `frontend/src/features/platform-service/api/platformPaymentReadApi.ts`
- `frontend/tests/unit/platform-service/paymentSystemReasons.test.ts`

## Review fixes (10/11/2026)

A follow-up code review of the UC8 working tree found four defects; the user approved fixing all of them, choosing wider columns over rejecting long provider text (D24 review note). Each fix has a regression test that failed before the change (RED log: 4 failures + 1 error, then the race case as an assertion failure `expected 0 but was 1`).

| # | Defect | Fix | Regression test |
| --- | --- | --- | --- |
| 1 | JOB-06 polls every second on its own thread and could claim the job of an API-03 lookup or simulator call between its storage commit and the request's own run; the request then returned RECEIVED/no payment instead of the D21 immediate result (also a flake risk for testh2 suites with the 1 s scheduler). | `store` leases the immediate job to the request in the storage commit (`leaseUntil` +2 min, attempt 1); the request runs it without claiming. A dead request lets the lease expire, so E3 retry still applies. | `aJob06PollBetweenStorageAndTheImmediateRunCannotTakeTheSimulatorOrLookupResult` (TC-19-93) |
| 2 | A webhook redelivery incremented `delivery_attempts` on the managed entity, bumping the evidence `@Version`; a PM deciding on SCR-62 with the version already read got MSG-COM-05. | `BankTransferEvidenceRepository.countRepeatedDelivery` bulk update (version untouched, null legacy count stays null). | `aRepeatedDeliveryIsCountedWithoutInvalidatingTheEvidenceVersionAPmHasOpen` (TC-19-94) |
| 3 | gateway/referenceCode >100, accountNumber >50, code >255 returned 400, so an authenticated transfer was never stored (R-19-08, E3), and one such row made the whole API-03 period lookup 502. | New changeset `20261110000500_sepay_evidence_text_widths.xml` widens those four columns to varchar(65536), the bound of the signed body; entity/`SePayPayload` schema follow; `validate` keeps one 65536 bound (only reachable by API-03 rows). Changeset 0400 is unchanged because it already ran on the retained runtime schemas. | `authenticatedTransfersWithLongProviderFieldsAreStoredInFullForReview`, `longSePayFieldsAreListedAndStoredInFullInsteadOfFailingTheLookup`, `SePayProcessingMigrationPostgresIT` (legacy values kept, 1000-char values fit), `OpenApiContractTest` (TC-19-95) |
| 4 | Every unauthenticated call wrote a `sepay_webhook_rejection` row with no retention, and a failure to write it turned 401 into 500. | Storage failure is logged by class name only and still answers 401; JOB-08 deletes rejection metadata older than 30 days in its usual 5,000-row batches. | `aRejectedCallStaysUnauthorizedWhenItsMetadataCannotBeStored`, `PlatformJobsIT#purgeDropsRejectedWebhookMetadataOlderThanThirtyDaysOnly` (TC-19-96) |

The 30-day retention matches the other JOB-08 technical data (cash report snapshots); it is a constant in `DataRetentionJob` and can be changed if the team prefers another period.

Fresh verification after the fixes (JDK21, Maven3.9.16, PostgreSQL16.15 via Testcontainers, `-Dapi.version=1.44`), same command as above plus `PlatformJobsIT,PlanPriceMigrationPostgresIT,EvidenceReviewPaymentMigrationPostgresIT,SubscriptionPaymentMigrationPostgresIT` in `-Dit.test`:

| Check | Result |
| --- | --- |
| Surefire | 104/104 PASS: UC8 HTTP/DB 30, SePay flow 10/signature 2, PM read 13/reconciliation 18, farm concurrency 3, Owner overview 11/create 7/history 9, OpenAPI 1 |
| Failsafe | 63/63 PASS: PostgreSQL UC8 HTTP/worker 30, UC8 upgrade incl. 0500 1, plan-price/evidence-review/payment-progress upgrades 3, farm-lock concurrency 3, reconciliation 18; H2 platform jobs (JOB-08) 6, email 2 |
| Checkstyle | 0 violations (Spotless/JaCoCo/Modernizer skipped as before) |
| Contract | `OpenApiContractTest` passed; `docs/api/openapi.json` differs from the previous copy only in the four `SePayPayload` `maxLength` values and is semantically equal to the passing export (the export's nondeterministic property order in Page schemas was not copied). `generate_api_catalog.py`: 222 paths/271 operations. Only the two webhook operations changed signature; their review records were updated with the new signatures and evidence. |
| Handoff HTML | Offline smoke (playwright-core, headless shell): no page error, search finds both webhook routes, reviewed signatures equal current ones, 271 operations. |

Not re-run after the fixes: frontend tests/typecheck/build (no frontend file changed), the real-HTTP/Mailpit/browser runtime above, LIVE SePay. Three review records outside UC8 (`GET /api/farms/{farmId}/subscription`, `GET /api/platform/payments/evidence`, `POST /api/platform/payments/evidence/{evidenceId}/review`) already had stale signatures at HEAD 783189f; they were left for their owners to re-verify.

Files changed by the review fixes:

- `backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/repository/BankTransferEvidenceRepository.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/domain/BankTransferEvidence.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/repository/SePayWebhookRejectionRepository.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/DataRetentionJob.java`
- `backend/src/main/resources/config/liquibase/changelog/20261110000500_sepay_evidence_text_widths.xml` (new)
- `backend/src/main/resources/config/liquibase/master.xml`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/SePayWebhookResourceTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/PlatformReconciliationResourceTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/SePayProcessingMigrationPostgresIT.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/OpenApiContractTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/service/PlatformJobsIT.java`
- `docs/api/openapi.json`, `docs/api-handoff.html`
- `docs/REQUIREMENT_DECISIONS.md`, `docs/requirements/specs/FE-19-goi-thanh-toan.md`, `docs/LOCAL_SETUP.md`, this file
