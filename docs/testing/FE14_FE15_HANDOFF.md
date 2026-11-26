# FE-14 / FE-15 frontend adapter handoff

## Current verification status (16/11/2026)

- Dashboard state, weight and assignment data is now loaded in batches.
  `FarmDashboardBulkIT` passed its parity and SQL-count checks; the selected
  H2 dashboard, report and reminder integration run passed 29/29. On the
  300-cattle local QA dataset the dashboard API improved from 5.229–5.508 s
  to 182–245 ms in three single-session samples. The 100-session repeat had
  no request errors; some response times still exceeded the SRS thresholds.
  See `NFR_TEST_PLAN.md` and Report 5.4 for details and limitations.
- After RPT-05 historical status and RPT-02 batching changes, the focused
  frontend run passed 259/259 with typecheck and build. `FarmReportIndicatorsIT`
  passed 11/11, including the historical-status and query-count regressions.
  Chromium on the local QA database displayed 2 tracked females in Farm A and
  1 after filtering to QA-A. The RPT-02 query returned in 131–195 ms in three
  local samples after a comparable 15.544-second pre-optimization request.
- The first 100-session local load wave exposed dashboard timeouts. Its inputs,
  results and qualification are recorded in `NFR_TEST_PLAN.md` and Report 5.4.

- The updated farm overview and platform admin frontend tests passed (65/65).
  The full frontend typecheck and production build also passed. The other
  focused frontend suites for FE-07, FE-23 and platform admin passed earlier in
  this checkpoint (212/212, including the 24 platform admin adapter tests).
- `ReminderReconciliationIT` passed 17/17. OpenAPI and the generated API
  catalogue include the report sections and charts (234 paths, 288 operations).
- After the projection fix, `FarmReportServiceTest` passed 6/6 and
  `FarmReportIndicatorsIT` passed 9/9. RPT-07 derives the 60-day window from
  the latest valid weight in the effective FATTENING segment and rounds the
  projected days up once, after dividing by the exact rate of gain.
- RPT-07 uses effective FATTENING periods for feed and weight calculations and
  separates total feed from feed used for ratios. See the 16/11 follow-up below.
  RPT-05 tracked-female status now has an as-of calculation, covered by the
  integration fixture and frontend adapter run noted above.

## Previous verification status (15/11/2026)

This is the latest checkpoint summary and supersedes older verification and
OpenAPI caveats below. The chronological handoff notes remain intact.

- Backend focused suite: **83/83 passed**. `FarmReportIndicatorsIT`: **3/3
  passed**.
- Frontend focused suite: **192/192 passed**. Frontend typecheck and build
  passed.
- OpenAPI refresh verified: **234 paths, 288 operations**.
- Report output currently supplies a total row for **RPT-07 only** and a chart
  for **RPT-05 only**. RPT-05 groups one latest linked pregnancy-check result
  per breeding by the breeding month in the farm time zone; only PREGNANT and
  NOT_PREGNANT enter the rate, and months with fewer than three results have no
  percentage.
- A single total remains unavailable for RPT-01, RPT-03, RPT-04, RPT-05, and
  RPT-06 because their current rows combine separate dimensions and summing
  them would double-count. RPT-02 still lacks a trustworthy total because its
  row count includes records without a weight and does not expose complete ADG
  totals. Report-specific charts for RPT-01 through RPT-04 and RPT-06 through
  RPT-07 remain unimplemented because the current output has no defined,
  reliable series for those reports. RPT-05 still has no table total.

Scope completed:

- Reviewed and completed the assigned `farm-overview` frontend adapter, screens,
  domain helpers, focused unit tests, and this handoff.
- Dashboard filters now leave M03 and unsupported M08 breakdowns explicitly
  unavailable instead of presenting unfiltered totals as filtered results.
  The empty state follows filtered M01 while the header keeps the farm-wide
  active cattle count.
- Reminder dates and calendar grouping use the farm time zone. REM-05's
  `basisLabel` is shown, Technician can select the feed reminder type, and
  null-ID reminder rows receive distinct client-side list keys.
- Report scope only lists filters supported by the selected report. The first
  result-table heading and title reflect the report's row dimension. The 24-month
  boundary matches Java `LocalDate.plusMonths`, including leap-day behavior.
- Source actions stay hidden when the reminder contract does not provide a
  verified target. Report totals and charts stay absent when the response does
  not provide them.

Evidence:

- 15/11/2026: smoke API trực tiếp trên PostgreSQL 16.15 và DB QA mới, nền `de11943` cùng thay đổi chưa commit: Owner đăng nhập và đọc được dashboard và danh sách reminders. Chưa kiểm các loại báo cáo, bộ lọc, role hay UI qua PostgreSQL trong lượt này.

- Read `AGENTS.md`, `RTK.md` (source-of-truth, verification, and handoff
  sections), `docs/agent-context/README.md`, `API_RULES.md`,
  `ARCHITECTURE.md`, and `VERIFICATION.md`.
- Requirements checked: `docs/REQUIREMENT_DECISIONS.md` D10 and D12,
  `docs/requirements/SRS_2026-10-28.txt` Part III §14–15 and Tables III-3–III-5,
  `docs/requirements/specs/FE-14-nhac-viec-thong-bao.md` §§3–9, and
  `docs/requirements/specs/FE-15-dashboard-bao-cao.md` §§3–9.
- Contract and implementation checked: `docs/api/openapi.json`,
  `FarmDashboardResource.java`, `FarmDashboardDtos.java`,
  `FarmDashboardService.java`, `FarmReportService.java`,
  `FarmReminderQueryService.java`, `FeedManagementService.java`,
  `FarmOnboardingService.java`, and `PenResource.java`. The cattle profile
  target `/cattle/:code` is registered in `frontend/src/App.tsx`.
- `FarmDashboardDtos.ReportRequest` is `(reportType, from, to, penIds,
  breedIds, herdGroups, lifeStages)`; the adapter sends those Java DTO names.
  The tracked OpenAPI `ReportRequest` schema still describes an older unrelated
  shape (`dateFrom`, `dateTo`, `farmId`, `sourceFilter`). OpenAPI refresh is
  needed from the backend owner; this task did not edit shared API artifacts.
- `ReportView` returns `summary`, `rows`, and `unavailableData`; it has no
  `totalRow` or `chart`. Those stay `null` in backend mode. FE-15 §6 expects a
  total row and chart, so that remains a backend/API gap rather than synthetic
  frontend output.
- `ReminderView` supplies rule, source record, cattle ID, due time, urgency,
  highlight, basis label, and parameter version. It omits cattle display code,
  breed, pen, source summary, basis values, and source target. `/feed/reminders`
  does return more feed-specific detail, but `/reminders` has already folded
  those projections into its list without carrying that detail forward. The
  adapter leaves those fields and source links blank instead of guessing.
  FE-14 screens for notifications and SCR-74's combined home remain outside
  this assigned folder scope.

Worktree/branch/base SHA:

- `C:\Users\PC ASUS\OneDrive\Máy tính\FPT study\Sem 9\Đồ án\project\BeefCare`
- Branch `dev`, starting HEAD/base `de11943`.

Ownership mode and final status:

- Writable only within `frontend/src/features/farm-overview/**`,
  `frontend/tests/unit/farm-overview/**`, and this handoff as assigned.
- Work complete for the assigned slice; no commit or push.

Dirty status and untracked files:

- The workspace was already dirty across FE-07, FE-14/15, FE-23 and backend
  files when this assignment began. Those unrelated edits were left untouched.
- In the assigned slice, edited the farm-overview files listed below and
  `frontend/tests/unit/farm-overview/farmOverviewApi.test.ts`; added
  `frontend/src/features/farm-overview/api/farmOverviewBackend.ts` and this
  handoff. `FarmOverviewPages.test.tsx` was not changed by this agent.

Files changed:

- `frontend/src/features/farm-overview/api/farmOverviewApi.ts`
- `frontend/src/features/farm-overview/api/farmOverviewBackend.ts`
- `frontend/src/features/farm-overview/components/DashboardCards.tsx`
- `frontend/src/features/farm-overview/components/DashboardMetrics.tsx`
- `frontend/src/features/farm-overview/components/ReminderParts.tsx`
- `frontend/src/features/farm-overview/components/ReportResult.tsx`
- `frontend/src/features/farm-overview/domain/format.ts`
- `frontend/src/features/farm-overview/domain/reminderRules.ts`
- `frontend/src/features/farm-overview/domain/reportRules.ts`
- `frontend/src/features/farm-overview/pages/FarmDashboardPage.tsx`
- `frontend/src/features/farm-overview/pages/ManagementReportPage.tsx`
- `frontend/src/features/farm-overview/pages/RemindersPage.tsx`
- `frontend/src/features/farm-overview/pages/TechnicianRemindersPage.tsx`
- `frontend/src/features/farm-overview/types.ts`
- `frontend/tests/unit/farm-overview/farmOverviewApi.test.ts`
- `frontend/tests/unit/farm-overview/FarmOverviewPages.test.tsx`
- `docs/testing/FE14_FE15_HANDOFF.md`

Commands/tests run:

- From `frontend/`, with Node 22.22.2 first on `PATH`:
  `./node_modules/.bin/vitest run --passWithNoTests tests/unit/farm-overview`
  (Windows invocation: `vitest.cmd`). Result: 2 files passed, 33 tests passed.
- No browser runtime, typecheck, build, API integration test, or backend test was
  run in this assigned slice.

Checkpoint/merge state:

- Uncommitted working-tree changes only; no merge, cherry-pick, or push.

Failures or unverified areas:

- FE-15 reports remain contract-limited: no total row/chart data, and the
  OpenAPI `ReportRequest` schema is stale relative to the Java record.
- FE-14 reminder details/source actions are limited by the current DTO; feed
  item and pen identifiers are lost in the combined `/reminders` projection.
- Notification list screens and the Technician combined home were not part of
  the assigned path ownership and were not verified here.
- No visual runtime comparison was performed; the test run is unit/component
  evidence only.

Risks/conflicts:

- This checkout contains concurrent dirty work outside the assigned slice. Do
  not reset or include those files when checkpointing this work.
- OpenAPI refresh and any DTO expansion need coordination with the backend/API
  owner.

Recommendation/next owner:

- Backend/API owner: regenerate and verify OpenAPI `ReportRequest`, add report
  total/chart fields if still required by FE-15, and preserve feed details in
  the reminder projection or confirm `/feed/reminders` as the enrichment
  source.
- FE-14/15 owner: after those contracts are available, complete the remaining
  report and reminder mapping; route notification and Technician-home work to
  their assigned feature owner.

## Follow-up: consume the reminder projection (15/11/2026)

This follow-up supersedes the earlier reminder-projection gap above. It is
limited to the authorized `farm-overview` frontend files and this handoff; no
backend, shared API, OpenAPI, or `App.tsx` file was changed.

### Mapping and route policy

- The adapter now reads `cattle.code/breed/sex/ageMonths/pen`, `sourceType`,
  `sourceId`, `sourceSummary`, `basisValues`, `basisMissing`,
  `cattleProfileTarget`, and `sourceTarget`. Target IDs and dates are parsed as
  typed data; profile routes require matching cattle IDs and display codes.
- Reminder details show sex, age, the projected source summary, and labeled
  parameter values alongside the parameter version and basis label. Missing
  basis text is retained.
- Profile navigation uses the verified routes in `App.tsx`: Owner/Manager use
  `/cattle/:code`; Technician uses `/kt/dan-bo/:code`.
- Source actions are emitted only for a source/target identity match and a
  verified route/role: `HERD_ENTRY` on REM-01/03 for Owner/Manager,
  `DEATH_VOUCHER` on REM-12 for Owner/Manager, and complete REM-11
  `FEEDING_LOG` targets for Manager/Technician. The Technician destination is
  `/thuc-an/nhat-ky?date=...&readOnly=1`; its date query is supported by that
  page. A feed target without pen/date/session or a source ID mismatch has no
  action.
- Other typed source targets still display their source summary but have no
  source button. The current registered screens do not consume a verified
  source-specific ID/deep link for growth, reproduction events, pregnancy
  episodes, vaccination doses, calving, pen moves/life stage, calf
  registration, or feed items. REM-08 therefore keeps its existing profile
  link only when the separate profile target is valid; it does not open a
  move/stage modal.
- Technician source navigation remains limited to the read-only feed log.
  Server role filtering is preserved; the adapter also checks local route
  eligibility before exposing a button.

### Verification

- Focused tests were added for projection fields, basis display, safe profile
  paths, source ID matching, and role-gated source routes.
- Command from `frontend/`:
  `./node_modules/.bin/vitest run --passWithNoTests tests/unit/farm-overview`
  (Windows: `vitest.cmd run --passWithNoTests tests/unit/farm-overview`). Result:
  2 test files passed, 36 tests passed.
- No typecheck, build, browser runtime, API integration, or backend test ran in
  this follow-up. The BE handoff remains not READY_FOR_FE pending its reserved
  Maven target and OpenAPI refresh.

### Files and checkpoint

- Updated within scope: `frontend/src/features/farm-overview/types.ts`,
  `api/farmOverviewApi.ts`, `api/farmOverviewBackend.ts`,
  `components/ReminderParts.tsx`, and the farm-overview adapter/page unit tests.
- Updated handoff: `docs/testing/FE14_FE15_HANDOFF.md`.
- Other dirty files in the shared checkout were preserved. No commit, push,
  cherry-pick, merge, or backend edit was made by this follow-up.

## Follow-up: FE-15 report totals and monthly conception chart (15/11/2026)

This follow-up implements the report fields that can be derived from the
current backend report rows and their source data without combining unrelated
dimensions. It reads the approved `SRS_2026-10-28.txt` §15/Table III-5 and
§15.2, `REQUIREMENT_DECISIONS.md` D12, and
`docs/requirements/specs/FE-15-dashboard-bao-cao.md` §§3, 4, 6, 7, and 9.

### Supported output

- `ReportView` now carries typed `totalRow` and `chart` values. Fields stay
  `null` for report types without a defensible single total or chart in the
  current row shape.
- RPT-07 returns a total row from the report's farm-filtered accumulators:
  cattle with enough weights, total gain, feed used, feed cost, and the
  aggregate feed-per-gain ratios. A “Chưa phân chuồng” row keeps eligible
  cattle without a current pen visible so its displayed pen rows cover the
  total; insufficient-weight cattle remain outside included totals and are
  reported separately.
- RPT-05 returns monthly overall conception rates. Each breeding ID contributes
  at most once, using its latest non-null linked pregnancy check before the end
  of the requested period. Only PREGNANT / NOT_PREGNANT results enter the
  numerator / denominator; INCONCLUSIVE results are excluded. Months use the
  breeding date in the farm time zone. Bars include numerator and denominator;
  the percentage is `null` when `n < 3` per GBR-106 and the UI labels that as
  insufficient data.
- A single total row is not supplied for RPT-01, RPT-03, RPT-04, RPT-05, or
  RPT-06 because their current rows combine several independent dimensions
  (for example, group/pen/breed, schedule/vaccine, or source/type/pen). Summing
  those rows would double-count. RPT-02 also has no total yet: its current rows
  do not expose a complete ADG total, and the current count includes records
  without a weight value. Those row and contract shapes need a separate design
  before a total is added.
- The current reliable chart is RPT-05 only. The SRS's report-specific chart
  requirement remains open for other report types; no series is inferred from
  the mixed-dimension rows. RPT-05's table still has no total row for the same
  mixed-dimension reason.

### Verification and remaining work

- Focused frontend command from `frontend/`:
  `vitest run --passWithNoTests tests/unit/farm-overview` — 2 files and 37 tests
  passed. TypeScript command `npm run typecheck` failed on unrelated FE-23
  `FeedRationDialogs.tsx:18,48` calls (expected 3–4 arguments; received 1 and
  2). No diagnostic pointed to the farm-overview files in this slice.
- Added backend unit tests for per-breeding deduplication, local-month boundary,
  inconclusive outcomes, the `n < 3` threshold, and RPT-07 total cells. Extended
  `FarmReportIndicatorsIT` to assert chart numerator / denominator against its
  hand-calculated fixture and to assert the RPT-07 readback total. Maven was
  not run in this shared checkout, so those backend tests remain unverified.
- OpenAPI was not regenerated in this slice; the backend report response
  contract has changed and needs the owner-assigned refresh plus contract
  verification. No PostgreSQL or browser runtime check was performed.

Files changed for this follow-up: `backend/src/main/java/vn/edu/fpt/beefcare/service/FarmReportService.java`,
`backend/src/main/java/vn/edu/fpt/beefcare/service/dto/FarmDashboardDtos.java`,
`backend/src/test/java/vn/edu/fpt/beefcare/service/FarmReportServiceTest.java`,
`backend/src/test/java/vn/edu/fpt/beefcare/service/FarmReportIndicatorsIT.java`,
`frontend/src/features/farm-overview/api/farmOverviewBackend.ts`,
`frontend/src/features/farm-overview/components/ReportResult.tsx`,
`frontend/src/features/farm-overview/types.ts`,
`frontend/tests/unit/farm-overview/farmOverviewApi.test.ts`, and this handoff.

## Follow-up: FE-15 dimension sections and metric charts (15/11/2026)

This follow-up extends the earlier total/chart work with independently totaled
report sections and unit-bearing charts. It uses source rows selected under the
requested farm, period, and applicable pen/group/life-stage filters. A total is
only shown within its own partition; totals from separate dimensions must not
be added together.

### Supported output and known data limits

- RPT-01 has separate end-of-period sections for group, pen (including
  “Chưa phân chuồng”), breed, purpose, and life stage, plus entry-source and
  exit-type sections. Each section totals only its own rows. Its chart counts
  cattle by group. Pen and historical purpose/life-stage filters are evaluated
  at the relevant report/event date.
- RPT-02 adds sections by pen, group, and life stage with valid weighing count,
  average weight, and estimated share; where source weights permit it, each row
  also has ADG and cattle sample size. ADG uses valid non-null weights for the
  same cattle separated by at least 14 days. The total ADG is computed over
  unique cattle in the filtered source rows, not by summing dimension rows.
  Valid weigh records without a weight are counted separately and excluded
  from weight/ADG calculations. The chart is valid non-null weighing count by
  pen.
- RPT-03 has separate schedule-status and vaccine sections, each with its own
  total, and charts completed doses by schedule and on-farm doses by vaccine.
  Canceled schedule doses are included as a status so those schedule rows
  partition their source records. Deferred doses have no persisted deferral
  timestamp; their current status is visible, but historical deferral timing
  cannot be reconstructed.
- RPT-04 has independent sections for opened cases, closed cases by outcome,
  and treatment events by medicine, with a chart for closed cases by outcome.
  Active meat-withdrawal cattle are derived from qualifying source events as
  of the report end. Severity transitions and chronic-at-period-end are marked
  unavailable because case severity is mutable and chronic history is not
  persisted as dated transitions.
- RPT-05 keeps the monthly conception-rate chart described in the earlier
  follow-up and adds independent sections for breeding method, pregnancy-check
  result, calving course, and calf outcome. It does not report tracked-female
  status by date because there is no persisted status-history projection.
- RPT-06 has independent entry-source, exit-type, and pen-move-destination
  sections, each with its own total, plus an entry-source count chart.
- RPT-07 keeps its report total and adds ADG and sample size per pen, alongside
  its cattle-count chart by pen. Historical purpose filtering is evaluated at
  the measurement end date or exit date.
- `ReportView.sections` and `ReportView.charts` are additive; the existing
  `rows`, `totalRow`, and legacy RPT-05 `chart` remain available. Chart metric
  values carry a unit; ratio charts retain numerator/denominator/sample-size
  metadata. Missing chart numbers are not converted to zero. There is no
  cross-report or cross-dimension grand total.

### Verification and remaining work

- From `frontend/`,
  `vitest run --passWithNoTests tests/unit/farm-overview` passed: 3 files,
  39 tests. `npm run typecheck` passed, including test TypeScript compilation.
- Backend unit and H2 integration coverage was added for numeric zero versus
  missing chart values, historical pen/life-stage filtering and farm scope,
  and valid/missing weights plus 14-day ADG. Maven was not run in this shared
  checkout; these backend tests and Java compilation await the owner's shared
  target run.
- OpenAPI was not regenerated by this follow-up. The owner should regenerate
  and verify the report response contract after the backend run.

Files changed for this follow-up: `backend/src/main/java/vn/edu/fpt/beefcare/service/FarmReportService.java`,
`backend/src/main/java/vn/edu/fpt/beefcare/service/dto/FarmDashboardDtos.java`,
`backend/src/test/java/vn/edu/fpt/beefcare/service/FarmReportServiceTest.java`,
`backend/src/test/java/vn/edu/fpt/beefcare/service/FarmReportIndicatorsIT.java`,
`frontend/src/features/farm-overview/api/farmOverviewBackend.ts`,
`frontend/src/features/farm-overview/components/ReportResult.tsx`,
`frontend/src/features/farm-overview/types.ts`,
`frontend/tests/unit/farm-overview/farmOverviewApi.test.ts`,
`frontend/tests/unit/farm-overview/ReportResult.test.tsx`, and this handoff.

## Follow-up: FE-15 report feed coverage and filter alignment (16/11/2026)

This follow-up supersedes the earlier RPT-07 insufficient-weight total behavior
and the earlier report-filter list. Source of truth: approved
`docs/requirements/SRS_2026-10-28.txt` §15/Table III-5, GBR-54 §3.4.3 and
GBR-107; `docs/REQUIREMENT_DECISIONS.md` D12; and
`docs/requirements/specs/FE-15-dashboard-bao-cao.md` §§3.2, 4/R-15-09, 10/Q5.

### RPT-07 feed accounting

- Feed allocation now runs for every filtered FATTENING animal before the
  enough-weights check. `summary.feedUsedKg`, row `feedKg`, row/total `feedCost`,
  and total-row feed amount/cost cover the whole FATTENING cohort, including
  animals counted under insufficient weights.
- `feedKgForIncluded` and `feedCostForIncluded` are exposed separately as the
  numerator sample for the per-kilogram-gain and cost-per-kilogram-gain
  ratios. Gain and ratios still include only animals with both start and end
  weights. The chart count remains the eligible cattle count.
- Added an H2 fixture with two FATTENING cattle in one pen and 40 kg of feed;
  one animal has both weights and one has none. Expected outputs: 40 kg total
  feed, 20 kg / 100,000 đ in the eligible ratio sample, 30 kg gain and one
  insufficient-weight animal. A request with non-pen filters also verifies
  RPT-07 applies only its allowed pen filter.

### Filters and RPT-05 tracked-female status

- Frontend report filters now follow spec Q5: RPT-01/02/04/05/06 accept pen,
  breed, herd group and life stage; RPT-03 accepts pen and herd group; RPT-07
  accepts pen only. The backend applies the same allow-list.
- Frontend unit coverage checks the complete catalogue and the RPT-03 request
  payload. H2 integration coverage applies pen, breed, herd-group and
  life-stage filters to distinct RPT-02 source animals.
- `trackedFemales` now counts females included in the historical status table.
  The report uses the period end date to reconstruct effective purpose and life
  stage from `CattleProfileChange`, and derives status from VALID reproduction
  events, VALID calvings, VALID pregnancy-loss updates and pregnancy episodes
  that were still open at that date. A later effective profile change, event,
  loss or calving does not alter the earlier report. The applicable cohort is
  active at period end, has a VALID herd entry by then, and is a female at
  YOUNG_STOCK / ADULT with BREEDING / UNDECIDED purpose, or has an open
  pregnancy. Exit date, farm scope and Q5 filters are applied at period end.
- Sources used: approved `docs/requirements/SRS_2026-10-28.txt` Table III-5
  (RPT-05), §3.4.3 and GBR-54; `docs/requirements/specs/FE-15-dashboard-bao-cao.md`
  §3.2 and Q5; `docs/REQUIREMENT_DECISIONS.md` D12. `CattleStateService` is not
  used because it projects current profile and clock state. If no profile
  history exists, the stored profile is treated as the recorded baseline; if a
  pre-period change has no old value or a referenced purpose cannot be
  resolved in the farm, a potentially applicable female is excluded and the
  report explains how many could not be reconstructed. This avoids silently
  assigning a status from a later profile.
- Added H2 coverage with all five statuses, profile changes before and after
  the report end, a voided and a future event, an open pregnancy that closes
  after the period, exits before and after the period, another farm, and pen / life-stage
  filters. Added frontend adapter coverage for the count tile and status
  section. The shared Maven and frontend test runs were not started by this
  agent; the parent owns the concurrent run.

### Verification handoff

- The centralized frontend and backend runs are recorded under Current
  verification status above, including the regression tests for effective
  purpose changes, feed allocation and projection rounding.
- This checkpoint remains in the local `dev` checkout.

### RPT-02 query-count optimization (16/11/2026)

- Comparable Farm C baseline: 300 active cattle, 7,500 growth rows over 24
  months, report request filtered with `penIds: [8710001]`; response was HTTP
  200 in 15.544 seconds against a 5-second target. An earlier probe exceeding
  30 seconds was unfiltered because its Python request used the wrong field;
  it is not an apples-to-apples comparison and does not indicate an adapter/UI
  defect. The frontend adapter sends `penIds`.
- The expensive path resolved pen assignment and effective purpose/life-stage
  separately for each weighing in filtering, three sections and composite
  rows. The service now batches the required assignment and profile history,
  fetches cattle/breed/purpose with the growth rows, and reuses one resolved
  scope per cattle/date across selection and report sections. The report
  period, VALID status, historical filter semantics and output dimensions stay
  the same.
- Added an H2 query-count regression with 120 filtered measurements and an
  assertion that report SQL statements remain under a fixed bound. The shared
  Maven run and a repeat Farm C timing were not run by this agent; both remain
  pending the owner’s verification.
