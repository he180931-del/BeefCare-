# Care and reproduction backend status

This is an implementation status against the 28 October 2026 SRS and ERD. The backend is a partial implementation; the commands and read models below still require the parent integration build and PostgreSQL service tests. No Maven test run was performed by this agent.

## Implemented paths

| SRS | Implemented paths and behavior |
|---|---|
| FE-09 vaccination | Manager command paths create, edit and stop schedules; defer and record planned doses; batch-record ON_FARM or HISTORICAL vaccination; correct or void records. Voiding restores a scheduled dose to PLANNED/DEFERRED for an active schedule, or CANCELLED for a stopped schedule. Schedule targeting now resolves ACTIVE cattle from AND-combined pen, herd-group and life-stage filters, adds individually selected cattle, and removes exclusions. Dose count is constrained to SRS 1–10. `GET /api/farms/{farmId}/vaccination-schedules` and `GET /api/farms/{farmId}/vaccinations/history` provide schedule/dose and herd history reads. |
| FE-10 health | Manager commands open a case with an opening observation or attach one to an OPEN/CHRONIC case, record follow-ups and treatments, change case status, correct/void follow-ups and treatments, and correct closure outcomes. Corrections and voids require reason and expected version, write revisions/audit, preserve rows, and recalculate withdrawal/health state. DIED/MISSING status invokes pending loss-voucher creation/cancellation hooks in the same transaction. |
| FE-10 reads | `GET /api/farms/{farmId}/health-cases` supports tab, text, severity, pen and period filters. `GET /api/farms/{farmId}/health-cases/cattle/{cattleId}` returns current and previous case cards, observation/treatment chronology, derived health state and withdrawal date. These are newly added and not yet verified by compilation or DB tests. |
| FE-11/12 reproduction | Command service supports estrus/breeding, pregnancy checks and updates, calving and calf outcomes, registered-now/draft choices, correction/void paths, dependency checks, revisions/audits, worklist/history reads, and reminder callbacks. `CattleStateService` derives reproductive state, expected date/basis, and eligibility from valid source events; a valid latest growth measurement is required for the weight condition. Temporal ordering compares calving/loss and reproduction events. |
| FE-18 parameters | Immutable effective-dated farm snapshots and version history are supported. SCR-56 ranges are enforced: stages 3–12/6–24/15–48 months, breeding age 6–36 months, decimal breeding weight 100–600 kg, gestation 270–300 days, check 25–90, recheck 7–60, calving lead 1–60, postpartum 20–120, window start 0–24/end 1–36 with end greater than start, cycle 17–25, weighing 7–180, vaccination lead 1–30, target weight 150–900 or omitted, and BCS `1-5:0.5` or `1-9:1`. The stage ages must be strictly increasing and source note is limited to 255 characters. Effective selection sorts by date descending then version descending. |
| Shared state | `CattleStateService.state(Cattle)` derives health state, current withdrawal end, contagious flag, reproductive status, expected calving date/basis, breeding eligibility, and failed conditions. It does not persist these values. |

Care/reproduction read access uses `VIEW_HEALTH`; the command paths use `MANAGE_HEALTH`. Catalogue and parameter writes use the applicable farm catalogue permission. Command writes use the shared idempotency, farm-access, audit, and version-guard services where applicable.

## Verification added, pending parent run

`CattleStateServiceIT` covers valid/voided weight selection, calving superseding older breeding, stopping a schedule, a NOT_PREGNANT result without creating an episode, treatment correction chronology/withdrawal calculation, and SCR-56 boundaries and cross-field validation. The Liquibase destructive-change guard fixture was reported passing by the parent. Newly added health read routes and schedule target expansion do not yet have focused integration tests. All unrun tests must be treated as pending, not passing.

## Remaining SRS gaps and cautions

- FE-09 target matching, vaccination history filters, schedule edits, dose restoration and historical-vs-on-farm edge cases need tests against the current schema. JOB-01 reminder rescheduling and schedule stop reason persistence are not complete. Batch updates do not yet expose the full SRS screen preview/count operations.
- FE-10 read DTOs are a first implementation and need a parent review/test for Open/Chronic/Closed date filtering, reaction linkage, displayed recorder/observer, and corrections. Full MSG-FE10 validation/error catalog mapping and every case/observation/treatment dependency permutation are not yet proven. Closing-date chronology was added but not tested.
- FE-11/12 commands and derived state exist, but all SRS edge cases, role/error mappings, reminder recomputation, and correction/void dependency branches have not been verified end to end. The reproduction worklist/history DTOs need comparison against every SCR-38/39 field. Parameter snapshot selection must consistently use effective date then version across all consumers.
- SCR-56 save does not yet invoke JOB-01 to recompute future reminders. The legacy `ReminderParameter` projection remains for current reminder consumers.
- Several legacy generated CRUD controllers still exist alongside the new command routes and require a tenancy/authorization review before exposing them as production APIs.

## Schema notes

Care lifecycle changes are additive in `20261028000200_care_reproduction_schema.xml`, `20261028000203_calf_outcome_lifecycle.xml`, and `20261028000204_reproduction_observer.xml`. The parent owns `master.xml` wiring and the final migration order. No already-applied changeSet bodies should be changed. Parent reported that all 164 PostgreSQL changeSets applied successfully; its separate OID/TEXT mapping repair is in progress. Do not treat this workstream as complete until the parent’s current PostgreSQL startup, compilation and integration run finishes.
