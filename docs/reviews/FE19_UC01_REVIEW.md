# UC-FE19-01 — Owner subscription overview

## Scope and authority

- Owner: Văn Đức / DucNV; UC-FE19-01 only, backend and SCR-57 API integration authorized on 09/11/2026.
- Workspace: `D:/Project/BeefCare-`; branch `feat/fe02-uc04-05-dich-vu-pm`; starting SHA `0125b2275cae5bf4a7727068d93cf0ed5bed1894`. Single writer in the existing checkout; no worktree/branch transfer or commit.
- Preserved starting changes: `docs/REQUIREMENT_DECISIONS.md`, `docs/requirements/specs/FE-19-goi-thanh-toan.md`, `docs/requirements/specs/OPEN_QUESTIONS.md` from the preceding requirement discussion.
- Status: BE_REVIEWED in this working tree, with SCR-57 wired and verified locally. Shared integrated-branch publication is still required for READY_FOR_FE; no commit, merge or push was requested.
- Sources: requirement decision D12 (SRS version), D14 (whole days rounded down); SRS 28/10 Part I §3.2 Subscription/Payment/Plan Price Version, §4.2.19; Part III §19.1.1 SCR-57; GBR-07, 09, 12–15, 69–71, 73, 75; BR-D23/25. Spec FE-19 §§2–7 and TC-19-32–39; FE-02 Q4 and Q9. Backend workflow BE1 and `backend/AGENTS.md` apply.
- Request: `GET /api/farms/{farmId}/subscription`; required positive numeric farm ID, no request body. Authentication and current Owner membership checked on every read. There is no form submission or payment write in this UC.
- Out of scope: creating a payment, payment-history filters, reconciliation, webhook, price publication, provider LIVE verification. Opening the existing pending instruction requires only its existing read endpoint.

## Field audit before implementation

Each row is one SCR-57 item. All values belong to the selected farm; a purchased-period row belongs to one PAID payment. Dates are exact ISO instants; calendar arithmetic uses Asia/Ho_Chi_Minh. Null is an absence, not an invented persisted value. No new storage or migration is needed.

| # / SCR-57 item | Exact API / UI field and type | Requiredness, condition, default | Storage / derivation and source |
|---|---|---|---|
| 1 Farm / switch | `farmId: int64`, `farmName: string`; selected farm / switch link | Required; no fabricated farm; API path must match response farmId | Farm.id/name; active Owner membership. Existing Select Farm handles switching. GBR-07, 09, 12 |
| 2 Payment history | UI navigation to SCR-60, selected farm retained | Always available to Owner; no stored field | Existing history route; UC-03 remains a dependency. SCR-57 |
| 3 Pay / renew | `eligibility: {ok: boolean, reason?: SUSPENDED/PRICE_UNAVAILABLE/OUTSIDE_WINDOW, opensAt?: instant}` | Required; blocked when suspended, prices unavailable or before latest-end minus 90 days; no period permits first purchase | Derived from suspension, effective price, confirmed periods and clock. SCR-57, GBR-70/71. Navigation only; UC-02 rechecks on creation |
| 4 Service status | `serviceStatus: PENDING_PAYMENT/ACTIVE/EXPIRED/SUSPENDED` | Required; suspension takes precedence, otherwise derive at read time | Farm suspension + PAID periods; GBR-13/15. A stale cached ACTIVE is not proof of coverage |
| 5 Current period | `currentPeriod: PurchasedPeriod or null` | Conditional on PAID start <= now < end; default null / “—” | Payment.purchasedStart/purchasedEnd; GBR-73 |
| 6 Days remaining | `daysRemaining: integer or null` (days) | Conditional on currentPeriod; floor(duration/24h), >=0; no current period null / “—”; suspended still counts | Derived from current-period end + clock; D14, FE-02 Q4 |
| 7 Confirmed end | `latestEnd: instant or null` | Conditional on any PAID period; maximum end including future periods; else null | Payment.purchasedEnd; SCR-57 |
| 8 Renewal opens | `renewalOpensAt: instant or null` | Conditional on latestEnd; minus 90 calendar days, always returned even after opening; else null | Derived from latestEnd; SCR-57, GBR-71 |
| 9 Suspension | `suspended: boolean`, `suspendedSince: instant or null` | Flag required; since conditional on current suspension and its recorded history; otherwise null | Farm.serviceStatus SUSPENDED + latest FARM_SERVICE_SUSPEND audit.loggedAt; FE-02 Q9, GBR-15 |
| 10 Pending request | `pendingPayment: PaymentDTO or null` | Conditional on PENDING and now < expiresAt; else null / “—”; code and numeric id identify the existing request | Payment.state/expiresAt/id/quoteRef and immutable bank snapshot. GBR-70 |
| 11 Effective version | `currentPrices: PriceDTO or null` (`id`, `effectiveAt`) | Conditional on effectiveAt <= now; latest version wins; else null + MSG-FE19-04 | PlanVersion.id/effectiveAt; existing id identifies a published price version. GBR-75 |
| 12 Future periods | `futurePeriods: PurchasedPeriod[]` | Required array; PAID start > now; default [] / “—” | Payment; same records also occur once in the purchased-period table. SCR-57, GBR-73 |
| 13 Three prices | `currentPrices.price1y/price2y/price3y: number` (whole VND) | All three when currentPrices exists; published range 1,000–1,000,000,000; missing price object stays null, no fallback price | PlanVersion.price1y/2y/3y; SCR-57, BR-D25, GBR-69/75. Price publishing validation is UC-07 |
| 14 Purchased periods | `periods: PurchasedPeriod[]`; each `{paymentCode: string, durationYears: 1/2/3, amountVnd: number, start/end: instant, status: CURRENT/FUTURE/PAST}` | Required array; PAID only, exactly one row per payment, default []; status uses [start,end) | Payment.quoteRef/durationYears/amountVnd/purchasedStart/purchasedEnd. GBR-73/74; no PENDING or EXPIRED request grants a period |

Compatibility: keep existing `latestEnd`, `renewalOpensAt`, `currentPrices`, `pendingPayment`, `farmId`, `serviceStatus`, `entitlementStatus`. Add the SCR-57 fields already declared in frontend `subscription/types.ts`; entitlementStatus is derived CURRENT / FUTURE_ONLY / NONE. Spec A1 uses conceptual names; the actual JSON names above will be exported from the DTO and documented in OpenAPI.

Trace: SubscriptionPaymentResource → SubscriptionPaymentService.overview → authorized Farm, PaymentRepository, PlanVersionRepository, FarmServiceFacts suspension audit → explicit response records → BackendApiDocumentationConfiguration / OpenAPI SubscriptionOverview → subscriptionApi.getOverview → useOverview → SubscriptionHomePage / ServiceFacts / TermCards. Frontend form state, validators and payload adapter are N/A (GET only); response adapter must preserve every field. Existing GET payment details supports the pending instruction by numeric payment ID. Other commands remain outside this UC.

## Findings and test plan

| Finding | Expected / baseline actual | Planned evidence |
|---|---|---|
| Missing overview fields | SCR-57 needs all 14 items; baseline DTO has only 7 properties | SubscriptionOverviewResourceTest: persisted fixtures → secured GET → complete JSON |
| Missing renewal date within window | Date remains latestEnd −90 days; baseline returns null after opening | Fixed-clock boundary test before, at and after opening |
| Stale service cache | Classify coverage at read time; baseline returns Farm.serviceStatus verbatim | Read immediately at period end without JOB-04, verify stored records are unchanged |
| Frontend adapter pending | Backend mode must call HTTP; baseline getOverview throws backendPending | subscriptionOverviewBackend.test.tsx: transport and UI, errors/retry, current farm, no local store fallback |
| Nullable response contract | OpenAPI 3.1 export omitted nullable=true, although the real overview and legacy payment snapshots return null | Contract test first failed; a scoped schema customizer now emits anyOf with an explicit null type for overview, eligibility and payment conditional properties. Raw frontend bank fields accept null; the view adapter normalizes absence without inventing account data |
| Confirmed end at midnight | SCR-57 confirmed end is the actual boundary used for renewal; the old UI subtracted 1 ms and showed the previous date at midnight, making the displayed renewal explanation inconsistent | Focused frontend date-boundary regression; current/purchased period display remains a separate last-covered-day representation |
| Scope defaults / stale data | Selected backend farm must be used and previous farm must not flash on change. A second RED test reproduced configured ID 42 overriding authenticated farm 77; the hook now prefers the authenticated context | Frontend route tests with selected farm 42, authenticated farm 77, and delayed response on switching |

Test locations: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/SubscriptionOverviewResourceTest.java` combines secured HTTP + real H2 persistence and fixed-clock rule checks, avoiding duplicate unit-only fixtures. `frontend/tests/unit/subscription/subscriptionOverviewBackend.test.tsx` covers the actual backend adapter and SCR-57 with HTTP transport stubs; it is not a browser E2E or a PostgreSQL claim.

## Verification log

- Baseline backend: Maven 3.9.16, JDK 21, testh2/H2; SePayPaymentFlowTest, FarmAccessServiceTest, FarmWorkspaceServiceTest: 26 tests passed. Maven Wrapper fails in PowerShell before Maven starts (null Target array); installed same-version Maven used. Sandbox network initially blocked resolution; approved execution succeeded.
- Baseline frontend: 35 tests passed with VITE_BEEFCARE_DATA_SOURCE=local for the demo suites. The initial default-mode run had 18 UI failures because frontend/.env selects backend while those old tests require the demo adapter. No .env change; explicit local mode restored the baseline.
- RED: SubscriptionOverviewResourceTest initially ran 10 cases with 6 assertion failures for missing farmName/days/suspension/eligibility and stale coverage. The new frontend backend suite initially ran 10 cases with 8 failures because the adapter was still backendPending. A separate selected-context case failed before the hook fix. Initial Java fixture compilation errors were corrected before counting assertion-based RED.
- GREEN backend: SubscriptionOverviewResourceTest 11/11 (H2 + real security chain), OpenApiContractTest 1/1, SePayPaymentFlowTest 7/7, FarmAccessServiceTest 10/10, FarmWorkspaceServiceTest 9/9. Total 38 Surefire tests, zero failures/errors/skips across the recorded focused/regression runs.
- PostgreSQL: SubscriptionOverviewPostgresIT inherits the same 11 HTTP/readback cases; 11/11 passed on actual PostgreSQL 16.15 (metadata asserted before each case). Test clock/mail/job settings reuse testh2, but datasource URL, driver, credentials and dialect are explicitly overridden to the Testcontainers PostgreSQL instance. Fixtures are flushed and the entity manager cleared before GET; readback checks unchanged stored farm/payment/subscription state. Every case rolls back its fixtures. This is not H2 evidence relabeled as PostgreSQL.
- Final `verify` completed 09/11/2026 02:25:51 UTC (09:25:51 Asia/Ho_Chi_Minh): all 38 Surefire cases above and 11 Failsafe PostgreSQL cases, total 49; zero failures/errors/skips; Checkstyle reports 0 violations.
- Frontend: 51/51 feature unit/component tests (16 adapter/UI cases in the new backend suite); 102/102 existing API/transport tests; `npm run typecheck` passed; `npm run build` passed. The confirmed-end midnight regression failed before changing that value and its renewal explanation to the exact boundary date. Existing React Router future notices and the main bundle size warning remain informational.
- OpenAPI export passed and was copied from `backend/target/beefcare-openapi.json`; catalog refreshed using `python docs/tools/generate_api_catalog.py` (218 paths / 267 operations / 289 schemas). Overview has 15 JSON properties serving 14 SCR-57 items, with explicit service/period/coverage/eligibility enums. Conditional root properties remain present as JSON null, explicitly allowed by the OpenAPI 3.1 schemas.
- The full generated export also refreshes pre-existing parentage contract drift: `/api/farms/{farmId}/pending-calves/{calfId}/parentage`, EntryLineRequest, AssignCalfParentageRequest and PendingCalf were already implemented in the starting commit. No parentage production source was changed or reviewed as part of UC-01; other raw Page-schema differences are property order. No peer operation is marked reviewed by this refresh.
- Catalog browser check passed: BE1/FE-19 filter, exact overview operation, nullable output rendering, JSON/HTML export, JSON import and the verified tab. Signature `fff71f5aca816771137b`; status remains `doing`, verified count 0; no page errors. Evidence: `backend/target/fe19-catalog-check.json`.

### Exact commands

From `backend/` (installed Maven 3.9.16 is the same version as the wrapper distribution):

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=SePayPaymentFlowTest,FarmAccessServiceTest,FarmWorkspaceServiceTest' test
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=SubscriptionOverviewResourceTest,SePayPaymentFlowTest,FarmAccessServiceTest,FarmWorkspaceServiceTest,OpenApiContractTest' test
$env:DOCKER_HOST = 'npipe:////./pipe/dockerDesktopLinuxEngine'
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dlogging.level.root=WARN' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dlogging.level.org.springframework=WARN' '-Dtest=SubscriptionOverviewResourceTest,OpenApiContractTest,SePayPaymentFlowTest,FarmAccessServiceTest,FarmWorkspaceServiceTest' '-Dit.test=SubscriptionOverviewPostgresIT' verify
```

The two initial test commands used the same logging overrides as the final command when capturing evidence. Logs: `backend/target/fe19-uc01-red.log`, `fe19-uc01-green.log`, `fe19-uc01-postgres.log`, `fe19-uc01-final.log`, `fe19-openapi-null-red.log`, `fe19-openapi-null-green.log`; XML reports in `target/surefire-reports` and `target/failsafe-reports`.

From `frontend/`:

```powershell
$env:VITE_BEEFCARE_DATA_SOURCE = 'local'
.\node_modules\.bin\vitest.cmd run tests/unit/subscription
npm.cmd run test:api
npm.cmd run typecheck
npm.cmd run build
```

The new backend-specific test file overrides the adapter mode to backend. The local flag is only the fixture mode of the existing demo suites, not the runtime data source.

Final frontend logs: `backend/target/fe19-frontend-final.log` (51 passing tests), `fe19-typecheck-final.log` (both application and test TypeScript checks), `fe19-frontend-build.log` (successful production build).

### Runtime and visual evidence

- Actual frontend mode: backend, relative `/api` through Vite to 127.0.0.1:8080. Actual browser base: `http://localhost:5173`, matching existing BEEFCARE_PUBLIC_URL and CORS origins; the initial 127.0.0.1 browser login returned 403 because that origin is absent from the user's configured allowlist. Correcting the browser hostname required no .env or security change.
- Backend ran with dev/local profiles, existing local PostgreSQL 16.15 and local seed account; no bank/provider LIVE operation. JVM timezone UTC avoids PostgreSQL rejecting the host alias Asia/Saigon; business calendar arithmetic remains Asia/Ho_Chi_Minh.
- Runtime session: `beefcare-fe19-uc01`; installed playwright-core + system Chrome, headless. The project-local playwright-cli skill was read, but the global CLI and its referenced local reference files are absent. No package/runner/baseline was installed. This was a scripted runtime smoke with manual screenshot inspection, not an approved automated E2E/visual regression test or before/after comparison.
- Product checkpoint: `working-tree-9369f8b0b8e273b2`, computed from the seven production source files named in the evidence manifest; captured 09/11/2026 02:35:59 UTC after the final contract and date-display changes. Subsequent changes were documentation only.
- Route: `/goi-dich-vu?farm=1151`; both 1180x820 and 1440x900 returned overview HTTP 200, all 15 JSON keys, correct farm, no page/console errors, no horizontal or vertical overflow in the captured state. Price Retry performed another GET 200.
- Observed live state: PENDING_PAYMENT, no paid/current/future period, no pending request and no effective price. The page retains farm/service facts, shows “—” and the empty periods state, displays MSG-FE19-04 + Retry, and disables activation. No price or coverage was fabricated for the demo. Covered/suspended/future/expiry/renewal boundaries were exercised by the PostgreSQL suite and frontend component tests, not by these live screenshots.
- Artifacts (transient, ignored): `backend/target/fe19-ui-evidence/manifest.json`; `scr57--1180x820--after--9369f8b0b8e273b2.png/.yml`; `scr57--1440x900--after--9369f8b0b8e273b2.png/.yml`. Both screenshots were visually inspected at the final checkpoint.
- Browser contexts closed; no saved cookies, tokens or browser profiles. Temporary frontend/backend processes started for verification were stopped. Existing Docker infrastructure was not stopped or reset; test containers use the repository's framework-managed lifecycle.

### Environment and quality-gate exceptions

- Spotless and JaCoCo were skipped as in the documented Windows commands; tests were not skipped. Full verify first hit 35 existing Modernizer violations outside this UC, then passed with the documented `modernizer.skip=true`. No unrelated modernization was performed.
- Testcontainers required the actual Docker Desktop pipe and api.version=1.44 on this host (Docker server minimum 1.40); no dependency or global Docker configuration changed. Initial setup failures were Docker API 400, the legacy JVM timezone alias, missing generic-test mail properties, then lazy container port access; the final test starts the isolated container before registering PostgreSQL properties and verifies database metadata.
- A dev-profile packaged JAR hit an existing Windows nested static-path error; the browser verification used the documented `spring-boot:run` classpath launch. This does not affect the verified overview endpoint, but the Windows dev JAR launch was not fixed in this UC.

## Acceptance evidence and handoff

| Criteria | Requirement | Passing test (H2 and PostgreSQL) |
|---|---|---|
| Empty view, no commercial writes | TC-19-32/34; SCR-57 | newFarmHasACompleteEmptyOverviewWithoutCreatingCommercialData |
| Stored periods, current/future/past and exact values | TC-19-35; GBR-73 | periodsComeFromPaidRowsIncludingFutureCoverageRatherThanCachedTotals |
| Whole days and exact end, without waiting for JOB-04 | TC-19-36; D14; GBR-13 | wholeDaysRoundDownAndCoverageEndsAtTheExactInstantWithoutWaitingForTheJob |
| Renewal opens once and its date remains visible | TC-19-37; GBR-71 | renewalDateRemainsVisibleBeforeAtAndAfterTheOpeningBoundary |
| Suspension, pending instructions and since date | TC-19-32/37; GBR-15 | suspensionHasPriorityAndRetainsCoverageAndLastSuspensionDate |
| Pending expiry boundary without writing status | TC-19-38; GBR-70 | pendingRequestDisappearsAtExpiryWithoutMutatingIt |
| Effective prices and absent-price partial view | TC-19-39; GBR-75 | pricesUseTheEffectiveVersionAndChangeAtItsExactStart; missingPricesKeepTheFarmOverviewAndBlockPayment |
| Owner, role changes, anonymous and other farms | TC-19-33; GBR-07/09/12 | nonOwnersAndOtherFarmOwnersCannotReadAndRoleChangesApplyImmediately; anonymousCannotReadSubscription |
| One Owner, two owned farms: no mixed values | SCR-57 switcher; GBR-12 | oneOwnerSwitchingBetweenTwoFarmsNeverMixesPeriodsOrPendingRequests |

Read-only GET has no command key/version, rollback workflow, payment confirmation race or new migration; these are N/A to this UC rather than missing mutation tests. PostgreSQL migrations ran on an isolated test DB; no schema change was made by this implementation and no shared DB upgrade is claimed.

FE call: normal cookie login/CSRF → GET `/api/farms/{selectedFarmId}/subscription`. Prefer authenticated session farm; optional explicit farm query must be authorized again by BE. Reopen a returned pending request through the existing GET `/api/farms/{farmId}/subscription/payments/{pendingPayment.id}`; numeric ID is used in backend mode, display code remains quoteRef. History navigation is SCR-60 / UC-03 and first purchase/renewal navigation is SCR-58 / UC-02. Creating requests and connecting the history list remain those later UCs; payment timing/progress fields and final QR behavior are not completed here.

Example empty response shape: `{farmId, farmName, serviceStatus:"PENDING_PAYMENT", entitlementStatus:"NONE", latestEnd:null, renewalOpensAt:null, currentPeriod:null, daysRemaining:null, suspended:false, suspendedSince:null, pendingPayment:null, currentPrices:null, futurePeriods:[], periods:[], eligibility:{ok:false, reason:"PRICE_UNAVAILABLE", opensAt:null}}`. Error examples: anonymous 401; wrong Owner / Manager / Technician / revoked membership 403 MSG-COM-01. Missing price is a successful partial overview with null currentPrices, not a mock fallback or a failed whole page.

Remaining delivery condition: publish an approved integrated checkpoint before labeling the endpoint READY_FOR_FE. API HTML remains “doing” with the completed local evidence and this condition stated; other FE-19 operations are not marked reviewed. Local DB also needs a legitimate effective price through the separately agreed pricing scope to enable purchase; no price was published as part of this read-only UC.
