# Review BE/FE — UC-FE19-07

## Scope and decisions

- Owner: DucNV / Codex. Branch `feat/fe19-goi-thanh-toan`; starting commit `783189f934f569be389c3cc59063c37b6ac164a2`, clean checkout.
- Status: BE_REVIEWED locally; not READY_FOR_FE (no approved integrated checkpoint/deployment).
- User approved all five proposals in this conversation on 10/11/2026: backend + existing SCR-63; withdrawal route and reason; remove saved drafts; retain future schedules on immediate publication and release withdrawn time slots; paged publication history and refresh at effective boundaries without periodic polling.
- Sources: D12 and decisions D14–D22; FE-19 §§3.1, 4 R-19-12/15, 5 UC-07, 6 SCR-63, 7 A13/A14, 9 TC-19-23…27, 10 Q1/Q4; approved SRS 28/10 entity Plan Price Version (783), BR-D25 (953), UC-07 (2458–2470), Table III-1 (2785–2800), SCR-63 (4968–4987), GBR-75/86/88/89, messages FE19-12…15. OpenAPI `/api/platform/plan-prices` and existing PlanPriceService/PlanVersion/PlanVersionRepository, SubscriptionPaymentService and PublicLandingService were traced before editing.
- Existing SCR-63 is the layout baseline. Approved changes remove Save draft, complete history metadata and add paging. Runtime verification targets 1180×820 and 1440×900, when services/browser are available; manual runtime evidence is distinct from automated visual regression.

## Field matrix and contract

| Field | Type/unit | Required/condition/default | Rule/source | Full storage/read path |
|---|---|---|---|---|
| price1y, price2y, price3y | Whole VND | All required; form starts from current prices or empty | Each 1,000…1,000,000,000, no cross-term ordering rule; SCR-63/BR-D25 | Form → publish DTO → service → plan_version.price_1_y/2_y/3_y → PM/public/Owner read DTO |
| applyNow | boolean | Required; form default true | Server chooses now for true; SCR-63 | Form → publish DTO → effective_at (mode is not separately persisted) |
| effectiveAt | ISO instant | Required only when applyNow=false; UI datetime interpreted in Asia/Ho_Chi_Minh | now or future; reject active duplicate timestamp; FE19-14/15 | Form datetime → UTC DTO → effective_at → read DTO → VN display |
| terms | text | Optional; trim, blank → null | At most 500; SCR-63 | Form → DTO → terms column (new migration expands 255→500) → read |
| id / displayed price version | bigint | Server-owned; no client max+1 | Unique identifier, not necessarily consecutive; SRS entity identity | plan_version.id; payment.price_version_id remains stable; withdrawal path uses this ID |
| publishedBy / publishedAt | user ID/name + instant | Server-owned; legacy null when no real audit evidence | Read-only; SCR-63 | Current actor/clock → new columns, audit in same transaction → PM DTO |
| status | SCHEDULED/EFFECTIVE/SUPERSEDED/WITHDRAWN | Read-only at one server clock | Latest nonwithdrawn effective_at≤now is current; future schedules survive immediate publication | effective_at/withdrawn_at → PM read DTO; no status-writing timer |
| reason | text | Withdrawal required | Trim; ≥5 non-space characters, ≤1,000; Table III-1, Q4 approved | Dialog → withdrawal DTO → withdraw_reason + audit → history |
| withdrawnBy / withdrawnAt | user ID/name + instant | Server-owned only on withdrawal | Only strictly before effectiveAt; retain all prices/terms/publication metadata | Actor/clock → columns + audit → PM history |
| expectedVersion / revision | nonnegative integer | Withdrawal requires observed revision, initial revision=0 | Stale/wrong lifecycle → COM-05; GBR-89 | PM DTO revision → command → @Version field |
| Idempotency-Key | header text | Each publish/withdraw intent; retain on retry | Same key/body replays, changed body COM-19; role rechecked | Existing IdempotencyCommandService + idempotency_record; atomic with version/audit/outbox |
| page, size | zero-based integer | Default 0/20; UI fixed 20 | 20/page, session page retained; publishedAt desc/nulls last, id desc | Read query → repository page → API page; current version independent of page |

`GET /api/platform/plan-prices` will return `{items,total,page,size,asOf,current,nextEffectiveAt}` instead of the old array (breaking PM read contract). Public `/api/public/prices` keeps its existing minimal price schema; no PM publication/withdrawal identity is exposed there. New mutations return full PM DTOs. Withdrawal body adds `expectedVersion` to the proposed `{reason}` contract to satisfy the existing-record version rule. Existing legacy IDs and payment references are preserved.

All three prices and terms belong to the complete publication, not to a farm or a purchased-period line. Each price field occurs once in the new-version form; current/history values are separate read-only contexts. The adapter sends all three exact amounts, never silently nulls a required price, and converts only scheduled VN local date-time to UTC. Apply-now/metadata are server-owned; optional blank terms alone normalize to null.

## Findings recorded before production edits

| ID | Expected / actual | Action / test layer |
|---|---|---|
| UC7-01 | SCR-63 backend mode is blocked by requireLocal for every price operation | Add backend adapter + UI contract tests |
| UC7-02 | Service accepts out-of-range prices/past effective times, terms only 255, generic conflict code | HTTP rule/boundary tests before fix |
| UC7-03 | No withdrawal route/storage; DTO lacks status and publisher/time | HTTP persisted round trip + PG new/upgrade migrations |
| UC7-04 | No command idempotency, check-then-insert is not serialized | Key/replay/rollback + real independent-transaction PG concurrency tests |
| UC7-05 | History rounds prices, omits required metadata/paging, client predicts version | UI tests for exact prices, metadata, pagination, refresh and server-issued ID |
| UC7-06 | `1500.5` / `1.50` were treated as a different whole amount after removing dots; price error was outside its field | Recorded before fix; parser and inline-validation regression RED → GREEN |
| UC7-07 | Native lock SQL ignored Hibernate default_schema on independently borrowed connections | Real PG concurrency RED (500); mapped PlanPriceLock + JPA pessimistic lock; same tests GREEN |
| UC7-08 | Manual confirmation screenshot used ISO date while Table III-1 requires dd/mm/yyyy | Same route's scheduled-time UI assertion RED → GREEN; use existing VN formatter; recapture final checkpoint |
| UC7-09 | Review 2: after a successful publish the page kept the intent key, so a separate identical publication (e.g. re-publishing a withdrawn slot, allowed by D23) replayed the first result: nothing created, UI showed success | `useIntentKey.complete()` after success (publish and withdraw); UI regression RED → GREEN |
| UC7-10 | Review 2: `PlanPriceMigrationPostgresIT` runs two full Liquibase migrations inside the method under the 15 s project default; timed out at 16.5 s on a loaded machine, 8.9 s idle | Explicit `@Timeout(120 s)` on that method; passed while frontend suite/typecheck/build ran concurrently |
| UC7-11 | Review 2: adapter applied the new input range to every stored row; one legacy positive whole price outside 1,000…1,000,000,000 (allowed by the old API) made SCR-63 unreadable | Read validation = BR-D25 positive safe integer; input keeps the range; UI regression RED → GREEN |
| UC7-12 | Review 2: legacy price/draft methods in `platformServiceApi` ("chưa có API"), demo draft state and a test asserting prices are "Chưa tích hợp"; unused `existsByEffectiveAt` (counted withdrawn rows) and `findAllByOrderByEffectiveAtDescIdDesc` | Removed; demo price tests use the store behind the local adapter; API test asserts the legacy methods are gone |
| UC7-13 | Review 2: SCR-63 #4 radio group had no "Áp dụng *" label; confirmation showed raw typed text; MSG-FE19-15 omitted `{time}` | Labelled `radiogroup`, confirmation shows `1.500.000 đ` amounts, conflict message shows VN time from `params.time` (HTTP assertion added) |
| UC7-14 | Review 2: withdrawal reason counted UTF-16 units client-side vs code points server-side; server COM-10 for `reason` showed a generic message | Count code points; COM-10 `field=reason` shows the 5…1,000 rule; UI regression RED → GREEN |
| UC7-15 | Review 2: history loaded publisher/withdrawer per user (N+1); `AppUser.platformStaffAccess` (`@OneToOne(mappedBy)`) adds one more select per user | `@EntityGraph` with both users and their staff access; statement-count test RED 11 → 17 without graph, 11 → 14 with users only, GREEN 11 → 11 |
| ENV-01 | Running legacy local-demo tests under frontend/.env backend fails 27 cases; no code defect: explicit local test env passes all 140 cases | Preserve mode-specific mocks; use VITE_BEEFCARE_DATA_SOURCE=local for combined suite |
| ENV-02 | mvnw.cmd fails on PowerShell `.Target[0]` before starting Maven | Installed Maven 3.9.16 matches wrapper version; use mvn.cmd, do not change wrapper |
| ENV-03 | Docker 29 rejects old client API 1.32; PostgreSQL rejects Windows JVM timezone alias Asia/Saigon | Test-only flags `-Dapi.version=1.44 -Duser.timezone=UTC`; business clocks remain explicit Asia/Ho_Chi_Minh |
| ENV-04 | Reused PG committed race data leaked into transactional clock tests; some pool connections defaulted to public | Fresh schema per UC7 test context, explicit Hibernate/Hikari schema; no DB reset or deletion |
| ENV-05 | JHipster WebConfigurer cannot parse nested:target path on Windows for executable JAR | Run identical verified JAR from own temp directory; no unrelated source fix |
| ENV-06 | Local .env allows localhost:5173, not 127.0.0.1:5173/5174 | Runtime uses actual configured localhost:5173 + Vite /api proxy; no CORS/env modification |

## Test plan approved with the proposals

- `PlatformPlanPriceResourceTest`: secured HTTP, required/whole/range/text/time/duplicate rules, publish/withdraw readback, audit, key/replay, observed version, current-vs-scheduled semantics and downstream price selection. Reuse on PostgreSQL in `PlatformPlanPricePostgresIT`.
- `PlanPriceMigrationPostgresIT`: full previous schema upgrade, preserve old prices/payment foreign keys and truthful nullable metadata; 500/1000 character storage, real new-schema migration covered by inherited HTTP suite.
- `PlanPriceTransactionPostgresIT`: independent concurrent transactions for duplicate publication, same-key replay and competing withdrawal; atomic rollback.
- `frontend/tests/unit/platform-service/planPriceBackend.test.tsx`: strict adapter, real field mapping/timezone, price form, retry keys/stale errors, current/history, paging/session, error recovery and one effective-boundary refresh without polling.
- Regression: existing platform-service/subscription feature tests, SubscriptionOverview/PaymentRequest HTTP tests, OpenAPI export, frontend typecheck/build.

## Results / limitations

Verification date: 10/11/2026. JDK 21.0.11, Maven 3.9.16 (same version as wrapper), PostgreSQL 16.15, H2 PostgreSQL mode, Node/Vitest 2.1.9. Work is uncommitted on the starting branch; code checkpoint for final runtime is `working-tree-b569293f698a0c06` (hash of tracked production diff plus untracked production files; full starting HEAD above).

| Verification | Actual result |
|---|---|
| Baseline | 140/140 frontend; 19/19 backend, before production edits |
| Initial feature RED | 8/8 backend and 10/10 frontend cases fail for missing UC7 behavior; new OpenAPI nullability assertion also failed before implementation |
| Final secured HTTP/H2 + OpenAPI | Review 2: 28/28 PASS: UC7 9, existing overview 11, payment creation 7, OpenAPI 1 (first round 27/27) |
| Real migrated PostgreSQL | Review 2: 15/15 PASS: identical UC7 HTTP/readback 9, full-schema upgrade 1, independent HTTP transaction races/rollback 5 (first round 14/14) |
| Final frontend feature regression | Review 2: 156/156 PASS (platform-service + subscription; first round 151/151); parser/date/inline and UC7-09/11/13/14 regressions failed before their fixes |
| Review 2 contract | Exported OpenAPI identical to `docs/api/openapi.json`; no catalog regeneration needed |
| Typecheck/build | `npm run typecheck` and production build PASS. Build retains existing >500kB chunk advisory |
| Checkstyle | 0 violations in final Maven verify |
| Quality-gate skips | Spotless, JaCoCo and Modernizer explicitly skipped; no claim for those gates |
| Runtime | Local backend + Vite /api proxy, authenticated PM, schedule → read → withdraw → read; 5 observed price endpoint responses all HTTP 200; no stored browser auth state |
| Runtime DB | psql readback of IDs 5701/5702: 1234567/2345678/3456789, exact Vietnamese terms/reasons, publisher/withdrawer ID 1056, separate persisted clocks and revision=1 |

Final backend command from `backend/` (one process, no parallel Maven):

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dtest=PlatformPlanPriceResourceTest,SubscriptionPaymentRequestResourceTest,SubscriptionOverviewResourceTest,OpenApiContractTest' '-Dit.test=PlatformPlanPricePostgresIT,PlanPriceMigrationPostgresIT,PlanPriceTransactionPostgresIT' verify
```

Final frontend commands from `frontend/`:

```powershell
$env:VITE_BEEFCARE_DATA_SOURCE='local'
node node_modules/vitest/vitest.mjs run tests/unit/platform-service tests/unit/subscription
npm.cmd run typecheck
npm.cmd run build
```

The combined frontend suite needs explicit local mode for legacy demo cases; the new backend-mode tests mock backendMode/transport explicitly, exercising no demo fallback. The running Vite still reads the unchanged frontend/.env: backend mode, empty API_URL.

Test reports and complete logs remain under ignored `backend/target/`: `uc7-verification.log`, `surefire-reports`, `failsafe-reports`, `uc7-fe-final.log`, `uc7-typecheck.log`, `uc7-build.log`. Earlier failed environment/fixture runs are not counted as final PASS. No full repository suite, SePay LIVE, automated E2E or automated visual regression was run.

## Manual runtime and visual evidence

- URL/route: `http://localhost:5173/nen-tang/bang-gia`, backend 8080, profiles dev/local/api-docs, local PostgreSQL 16.15. SePay is not used in this UC7 check.
- Session: `beefcare-uc7`, Chromium via already installed playwright-core (CLI command and referenced skill support files absent; no runner/dependencies installed). Locale vi-VN. Both viewports: 1180×820 and 1440×900.
- Reproduction: PM local login/CSRF → open route → invalid 999 price inline → enter all 3 exact prices/terms → Schedule with VN tomorrow time → review confirmation → Publish → read stored SCHEDULED history → withdraw with reason → await completed read refresh → see WITHDRAWN with publisher/withdrawer clocks.
- Final evidence folder: `C:/Users/nvkha/AppData/Local/Temp/beefcare-ui-evidence/uc7-20261110/manifest.json`. Ten PNGs plus matching accessibility snapshots, all named `fe19-uc7--bang-gia--<state>--<width>x<height>--after--working-tree-b569293f698a0c06`. States: current-history, invalid-price, confirm-schedule, scheduled-history, withdrawn-history. All ten final images were individually inspected. Final withdrawn images were recaptured after awaiting the specific updated row, not the preceding fixture's badge.
- No document horizontal overflow in any of the ten captures. Vertical page scrolling is present and required for the form/history (recorded heights in manifest); no clipped price/reason fields in inspected states. No uncaught page exception; expected unauthenticated initial GET authenticate 401 and existing favicon 404 are recorded. All five observed UC7 endpoint responses in the command flow are 200.
- Review 2 (UC7-09…15) changed the SCR-63 application label, confirmation text and messages after these captures; those changes are covered by UI tests only, and no new browser runtime capture was made.
- This is after-only manual runtime/visual inspection, not side-by-side regression or Figma approval. The preexisting SCR-63 source layout/SRS is the reference; no approved pixel baseline or automated visual runner exists.
- Browser contexts closed; no token/cookie/storageState files saved. Two local test publications 5701/5702 are retained as WITHDRAWN in immutable history; current prices remain absent (null before/after). No active real price or payment was changed. The positive-current version and apply-now branches are covered by HTTP/UI tests, not this local browser fixture.

## Handoff and remaining boundaries

- New endpoints/DTOs and all price fields were traced through form → adapter → secured HTTP → service → entity/native DB readback → read API → displayed history. Migrations preserve existing payment foreign keys and actual legacy publication metadata.
- OpenAPI exported only after the final contract test PASS; `docs/tools/generate_api_catalog.py` rerun using installed UV Python 3.12.13: 221 paths, 270 operations, 299 schemas, all 270 operations have source snapshots. New withdrawal candidate mapping is UC7. Handoff records remain local BE_REVIEWED/doing; not READY_FOR_FE.
- Offline HTML smoke PASS: searching UC-FE19-07 returns 3 APIs; opening GET and expanded HTTP 200 shows new output fields; verified/all tabs work; JSON export/import invoked successfully; exported HTML retains 270 operations, 3 UC7 records and matching signatures; no page errors. Evidence: `backend/target/uc7-handoff-smoke.json`.
- Only the available project Playwright SKILL.md was consulted. Its extra reference files and the routed React/TDD skill files are absent in this Windows checkout; no installation was performed. Direct test-first workflow and Vite-compatible React code were used; no Next.js/RSC advice or dependency changes.
- No commit/push/merge. No new branch/worktree, reset/stash or user-state movement. The checkout began clean; all final changes/untracked source files belong to UC7. Temporary browser/scripts/logs are ignored or in OS temp, and contain no saved credentials/auth state.
- Final runtime services are available at localhost:5173 and backend8080 (healthy HTTP probe; authenticate401 expected before login). Extra Vite5174 was stopped. PostgreSQL/Mailpit local services and the verified backend are left running for user review; no shared volume was removed/reset.
