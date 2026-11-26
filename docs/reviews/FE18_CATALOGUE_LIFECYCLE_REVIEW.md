# Review BE / FE — FE-18 catalogue lifecycle (D42)

## Scope

- Owner: AnNT, implemented and checked with Codex on 22/11/2026 (UTC+07:00).
- Branch: `codex/fe18-catalogue-policy`; base `dev` at `34a1e0da4263eb6c470e39190018e69ec811b090`. Validation below ran against the uncommitted worktree before delivery; subsequent commits and merge are recorded in Git and the pull request.
- Status: BE_REVIEWED locally; not READY_FOR_FE on a shared integration branch.
- UC-FE18-03/04, 07/08, 11/12, 15/16: edit, stop/reactivate and delete policy; UC17 parameter versions are regression scope.
- Sources, read before implementation: D12, D37, D39, D41, D42; approved SRS 28/10/2026 GBR-67/68/88/89, BR-D12/32, SCR-52 through SCR-56; feature spec sections 2–7 and Q4; existing DTO/OpenAPI contracts. D42, the spec and OPEN_QUESTIONS were updated before source edits.
- Owner / Manager manage catalogues in an ACTIVE farm; Technician reads all five tabs and history. Existing authentication, tenant and service guards remain.
- Original checkout `E:/doan/SEP490_G35_2026_FALL-BeefCare/BeefCare`: nine pre-existing FE16 dirty files were preserved. This package uses the already-attached clean worktree and does not incorporate that patch.

## Acceptance criteria và bằng chứng

| Case | Source | Given / When / Then | API / service | Evidence | Result |
|---|---|---|---|---|---|
| AC01 | D42, TC-18-30 | Owner/Manager calls former breed/purpose/medicine DELETE; HTTP 405, rows/cattle/audit unchanged | Former three DELETE routes | `CatalogueLifecycleResourceTest#onlyVaccinesExposeADeleteCommand`, secured MockMvc + CSRF / H2, both roles | PASS |
| AC02 | R-18-16, TC-18-32 | Stop/reactivate unused or referenced items, retaining IDs and relationships | Catalogue saves + database readback | `CatalogueFe18Test#d42UnusedAndReferencedItemsAreStoppedAndReactivatedWithTheSameId`; medicine case `tc1814MedicineNeedsWithdrawalButNotDoseOrRoute` | PASS |
| AC03 | R-18-17 | A vaccine only in an old correction or earlier schedule choice remains used; code/deletion locked | Care catalogue read/save/delete | `vaccineKeptOnlyInACorrectionStillCannotBeDeletedOrHaveItsCodeChanged`, `changingTheScheduleVaccineRetainsItsOldCatalogueReferenceWithoutDoubleCounting` | PASS |
| AC04 | R-18-17/18 | Draft entry declaration is retained before cattle exists; breed/purpose/vaccine references are counted | Existing draft JSON → catalogue projection | `aDraftEntryDeclarationKeepsItsCatalogueReferencesBeforeCattleExist`; entry posting/correction/farm-born regressions | PASS |
| AC05 | R-18-04/05/18 | Rename/stop vaccine: recorded name and withdrawal period persist; correct dose keeping the same inactive reference; selecting it in a new schedule returns FE18-08 | Catalogue save → vaccination correction/readback | `renamingAndStoppingAVaccinePreservesTheRecordedSnapshotAndAllowsCorrectingTheSameReference` | PASS, final rerun |
| AC06 | TC-18-34, R-18-19 | Creation commits first: deletion waits, then FE18-04; deletion commits first: creation waits, then COM-08; no orphan or successful-delete audit on rejection | Catalogue delete vs actual scheduling / recording commands | All four `CatalogueConcurrencyPostgresIT` cases; PostgreSQL 16.15, independent transactions, `pg_blocking_pids` confirms a real lock wait | PASS |
| AC07 | R-18-15 | Preserve observed version including zero; do not refetch to overwrite it | FE adapter → command payload | `catalogueApi.test.ts`: original version-zero payload; existing stale-version and parameter-version tests | PASS |
| AC08 | D42, TC-18-30/31/32 | No delete button for the three types; default ACTIVE; confirm historical references with zero active cattle; filter and reactivate same ID | Four catalogue screens | `CatalogueLifecycle.test.tsx` (six cases), API unit tests; manual browser checks | PASS |
| AC09 | R-18-08/09/15, D37 | CURRENT / SCHEDULED remain separate; previous parameter history read-only; Technician has no save actions | Existing parameter / role screens and services | FE catalogue unit tests and parameter cases in `CatalogueFe18Test` | PASS, selected regression scope |

## Contract và field completeness

No form field is added or dropped. Existing database columns and DTO shapes are reused; no migration.

| Field / operation | Contract and persistence path | Verified behavior |
|---|---|---|
| `available` | Existing boolean in command → entity → view → form | Stop/reactivate same ID; inactive records remain readable; default screen filter ACTIVE, API lists still support all states |
| `expectedVersion`, delete `If-Match` | Version observed by the form, including 0; checked inside command transaction | No adapter GET-before-save; stale versions rejected; version and idempotency contracts unchanged |
| `referencedCount` | Existing Long projection; FE uses number, falling back only for older demo fixtures | Counts retained history/declarations; not inferred from active cattle count; no count lost on local save |
| `scheduleCount`, `recordCount` | Current source IDs union historical source IDs, avoiding repeated correction/audit counts for the same source | Old vaccine still locked after switching a record or schedule to another vaccine |
| Entry `vaccination.items[].vaccineId` | Existing optional Long (ID or free-text name per `EntryLineRequest`); draft JSON → validator/catalogue lookup → posting vaccination | Field contract unchanged. Writing lookups share-lock and refresh the vaccine; read-only checks stay non-locking. Existing full posting validation still checks availability |
| Vaccine name / withdrawal snapshots | Values already stored on vaccination, not rewritten by catalogue save | Database readback proves original name and 21-day withdrawal after catalogue rename/stop; same-ID correction preserves the original name |
| Delete operations | Remove resource mappings and service methods for breed, medicine and purpose; retain vaccine delete | Generated contract has only PUT at retired paths; vaccine path still has PUT + DELETE |

## Findings và xử lý

| Finding | Classification | Resolution |
|---|---|---|
| Q4 had no recorded decision while three backend delete commands claimed approval | Requirement / source mismatch | D42 first; delete commands removed. Current frontend already had no such delete APIs/buttons; corrected misleading comments and policy text |
| Confirmation used active cattle/current receiving pens | Source bug | Use complete reference counts with fallback for older demo fixtures |
| Past vaccination corrections, schedule choices and draft declarations were not counted | Missing history coverage | Farm-scoped JSON declaration/revision lookup; historical schedule audit lookup; preserve code and deletion guards |
| Deletion could race with new references | Concurrency coverage / source gap | Vaccine catalogue write lock; reference commands share-lock; four real PostgreSQL transaction races |
| Correction of a dose could reject an unchanged inactive vaccine or replace its original name snapshot | Source bug | Same vaccine ID keeps the existing reference/snapshot; replacement vaccine still requires ACTIVE |
| Selecting an inactive vaccine returned COM-05 rather than the catalogue-specific error | Source bug (R-18-05) | New selections in schedule / record / correction commands return 422 MSG-FE18-08 with `field=vaccineId` |
| OpenAPI generation exceeds common 15-second test timeout locally | Test runtime limit | Unchanged assertions passed with command-only `-Djunit.jupiter.execution.timeout.testable.method.default=60 s`; first generation 22.5 seconds; no persistent timeout increase |

## Kết quả chạy thực tế

JDK 21; JVM/test process timezone UTC, business clock UTC+07:00. Checkstyle: zero violations. Spotless, JaCoCo and Modernizer skipped with the existing local flags; no claim of those checks passing.

- Baseline before source edits: BE 9/9, FE 35/35.
- Backend regression / secured HTTP: 103/103 (H2), eight classes: CatalogueFe18Test 10, HerdCatalogueCommandServiceTest 3, CatalogueLifecycleResourceTest 2, VaccinationGapCommandTest 21, VaccinationCommandResourceTest 8, HerdEntryPostingServiceTest 25, HerdEntryCorrectionServiceTest 18, FarmBornEntryTest 16.
- Final inactive-vaccine error-code change: reran the four affected classes (CatalogueFe18Test, HerdCatalogueCommandServiceTest, VaccinationGapCommandTest, VaccinationCommandResourceTest), 42/42 PASS. Unaffected passing entry/HTTP/concurrency cases are not counted again.
- OpenAPI: 1/1 passed separately with the documented 60-second allowance. Initial combined run and isolated 15-second rerun timed out; they are not reported as green whole-suite runs.
- PostgreSQL concurrency: 4/4, zero failures/errors/skips; `postgres:16.15`, Testcontainers and a fresh isolated schema, actual product version asserted. No shared DB or volume reset.
- Frontend catalogue: 43/43, five files, rerun after the final policy/hint copy changes. Vaccination dependency: 41/41, four files, including three error-mapping cases for FE18-08, compatibility with the old code, and stale-version distinction. Total 84 distinct frontend tests. Final typecheck and production build after the mapping change: PASS.
- Runtime browser: demo/mock at `http://127.0.0.1:5188`, Owner → select demo farm → catalogue. Checked 1440×900 and 1180×820; ACTIVE default, historical-only breed confirmation, stop/filter/reactivate, no delete actions on breed/medicine/purpose, purpose type locked, unused-vaccine confirmation. No console errors or document horizontal overflow. Normal vertical page scrolling at both sizes. Viewport override reset, tab closed, Vite stopped afterward.
- Browser evidence is manual runtime QA, not automated E2E or a pixel comparison against an approved baseline. It does not certify browser-to-backend integration; secured HTTP and PostgreSQL are separate evidence.
- Local ignored logs: `backend/target/fe18-verify.log`, `fe18-openapi-export.log`, `fe18-postgres.log`, `fe18-inactive-message-verified.log`, `fe18-frontend-verified.log`, `fe18-vaccination-frontend.log`, `fe18-typecheck-final.log`, `fe18-build-final.log`. Images/AX snapshot and source-checkpoint manifest: `backend/target/fe18-ui-20261122/`.

Commands from `backend/` (common flags: `-P-webapp -Dspotless.skip=true -Djacoco.skip=true -Dmodernizer.skip=true -Duser.timezone=UTC -DargLine=-Duser.timezone=UTC`):

```text
.\mvnw.cmd <common> -Dtest=CatalogueFe18Test,HerdCatalogueCommandServiceTest,CatalogueLifecycleResourceTest,VaccinationGapCommandTest,VaccinationCommandResourceTest,HerdEntryPostingServiceTest,HerdEntryCorrectionServiceTest,FarmBornEntryTest,OpenApiContractTest -Dit.test=CatalogueConcurrencyPostgresIT verify
.\mvnw.cmd <common> '-Djunit.jupiter.execution.timeout.testable.method.default=60 s' -Dtest=OpenApiContractTest test
.\mvnw.cmd <common> -Dit.test=CatalogueConcurrencyPostgresIT failsafe:integration-test failsafe:verify
.\mvnw.cmd <common> -Dtest=CatalogueFe18Test,HerdCatalogueCommandServiceTest,VaccinationGapCommandTest,VaccinationCommandResourceTest test
```

The first command reached 103 passing regressions but stopped at the document-export timeout before Failsafe. The next two commands completed the remaining checks.

Frontend: `TZ=UTC`, local/mock for `node node_modules/vitest/vitest.mjs run tests/unit/farm-catalogue --maxWorkers=1 --minWorkers=1` and the same command with `tests/unit/vaccination`; backend auth/data mode for `npm run typecheck` and `npm run build`.

## Handoff FE

- Local implementation and contract checked; no shared-deployment READY_FOR_FE claim. Commit, push and merge are tracked separately by Git and the pull request; this report does not certify a deployment.
- `docs/api/openapi.json`: 235 paths, 286 operations, 359 schemas; generated from the passing export, no manual schema patch. Fresh export also synchronizes existing FE23 groupBy annotations; FE23 Java/runtime behavior unchanged. `docs/api-handoff.html` regenerated; existing review-state JSON preserved exactly.
- Normal session login + CSRF, ACTIVE farm, Owner/Manager for writes, one Idempotency-Key per intent; preserve version the user saw. Former DELETE calls now return 405; use the existing PUT with `available=false/true` instead. Used vaccine deletion still returns MSG-FE18-04. Selecting an inactive vaccine returns 422 MSG-FE18-08; the vaccination frontend shows the inactive-vaccine field message and supports the older COM-05 / vaccine_inactive response too.
- No new seed accounts or secrets. No migration; no data backfill needed because references are read from retained source data.
- Scope excludes a full repository test run, shared-environment deployment, full clinical/entry E2E, database upgrade acceptance and performance benchmarking of all catalogue sizes.
