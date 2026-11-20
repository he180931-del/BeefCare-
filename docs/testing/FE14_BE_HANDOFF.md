# FE-14 backend handoff — projection and JOB-01 event slice

## Kiểm thử nhắc việc — 16/11/2026

`ReminderReconciliationIT` đạt 17/17 trên H2. Các ca xác nhận dữ liệu nhắc việc theo vai trò và trại, cập nhật theo sự kiện nguồn, và xử lý lại sự kiện không tạo bản ghi trùng.

## Latest-worktree checkpoint — 15/11/2026

Focused Maven verification passed **83/83** across FE-07, FE-14/15, FE-23, and
JOB-07. Failsafe passed `ReminderReconciliationIT` **17/17** and
`FarmReportIndicatorsIT` **3/3**. On the PostgreSQL QA clone, a supported
`FARM_REMINDER_SOURCE_CHANGED` event behind 51 earlier unowned events was
delivered (`attempts=1`); all 51 unowned events remained pending. OpenAPI and
the API catalog were regenerated with **234 paths and 288 operations**. These
results supersede the older verification-pending notes below.

## Scope and sources checked

- Feature scope: FE-14 reminder list / detail data (SCR-44, SCR-74) and JOB-01.
- Read `AGENTS.md`, `RTK.md`, `backend/AGENTS.md`, `docs/agent-context/README.md`,
  `docs/agent-context/API_RULES.md`, `docs/api-handoff.html`,
  `docs/backend-workflow.html`, `docs/requirements/specs/FE-14-nhac-viec-thong-bao.md`
  §§2–7, `docs/requirements/specs/FE-15-dashboard-bao-cao.md` §7,
  `docs/requirements/SRS_2026-10-28.txt` Part III §§14, 24.1, 24.7,
  GBR-63/64 and NFR-P07, `docs/testing/FE14_FE15_HANDOFF.md`, and
  `docs/testing/FE23_PHASE1_HANDOFF.md`.
- Checked Java source, the current OpenAPI `ReminderView`, reminder reconciliation
  tests, and `origin/dev` changes through `bd7d598`. No pull or merge was done.

## Findings

- `GET /api/farms/{farmId}/reminders` already requires current `VIEW_CATTLE`
  access, filters rules by Owner/Manager/Technician, reads only stored rows for
  the requested farm, and includes live feed, weighing and finishing fallbacks.
- The existing response omitted cattle display code/breed/sex/age/current pen,
  source summary, the parameter values that formed the due date, and a safe
  typed target. Feed detail from the existing FE-23 query was lost when folded
  into the combined list. FE-14's existing frontend handoff confirms those
  fields and source actions were blank rather than guessed.
- JOB-01 has a 15-minute scheduled reconciliation. `FarmParameterCommandService`
  also calls reconciliation directly for an immediately effective version.
  The dedicated event added in this follow-up covers the selected care,
  reproduction, entry/exit and pen-move actions listed below. Other reminder-
  relevant source mutations without an existing event or a listed command ID
  still have no producer and rely on scheduled reconciliation.
- FE-15 still has a separate known gap: report responses do not provide the
  total/chart expected by FE-15 §7, and the checked-in OpenAPI report request
  shape is stale. This handoff did not change dashboard/report resources or
  shared contracts.

## Backend changes

`FarmReminderQueryService` now adds the following to each list item:

- `cattle`: `code`, `breed`, `sex`, `ageMonths`, and current `pen`.
- `sourceType`, `sourceId`, and `sourceSummary` for the supported source record.
- `basisValues` with the relevant parameter names/values, while preserving
  `basisLabel` and `parameterVersion`; `basisMissing` identifies a missing
  basis in Vietnamese.
- `cattleProfileTarget` and `sourceTarget`, each a typed object with `type`,
  `id`, `cattleId`, `penId`, `date`, `sessionNo`, and `code`. No route string or
  URL is synthesized. The destination still has to check current permission.

Every source lookup is constrained to the requested farm. A reminder linked to
a cattle record from another farm is omitted. Cattle/pen/breed labels and source
IDs are withheld when their farm relationship cannot be verified. REM-08 source
actions are returned only to Owner/Manager; Technician can still receive its
profile target. Existing role filters remain in place.

`ReminderReconciliationOutboxHandler` handles event types emitted by current
source code and the reminder-specific event added in this follow-up:

- Cattle/profile and weighing: `CATTLE_PROFILE_UPDATED`, `GROWTH_RECORDED`,
  `GROWTH_CORRECTED`.
- Pen state: `PEN_CREATED`, `PEN_UPDATED`, `PEN_AVAILABILITY_CHANGED`.
- Source commands: `FARM_REMINDER_SOURCE_CHANGED` for care, vaccination,
  reproduction, entry, exit and pen-move commands.
- Feed state/session: `FEED_ITEM_CREATED`, `FEED_ITEM_UPDATED`,
  `FEED_RECEIPT_POSTED`, `FEED_RECEIPT_VOIDED`, `FEED_STOCK_ADJUSTED`,
  `FEED_RATION_VERSION_SAVED`, `FEED_RATION_VERSION_CANCELLED`,
  `FEED_RATION_STOPPED`, `FEEDING_RECORDED`, `FEEDING_VOIDED`,
  `FEEDING_CORRECTED`.

The handler validates farm scope and calls the existing idempotent
`reconcileFarm`. `IdempotencyCommandService` emits the dedicated event in the
same transaction as the command for selected source actions; the existing
`FARM_COMMAND_COMMITTED` event remains untouched and unowned. Idempotency replay
returns before producing either event, and command failure rolls both event
writes back. Draft entry/exit commands are excluded because they do not affect
the active herd or reminders. `PEN_MOVE` is included because it can resolve a
pen-fit suggestion (REM-08).

The selected command IDs are the FE-10 care actions (`HEALTH_CASE_OPEN`,
`HEALTH_CASE_FOLLOWUP`, `HEALTH_CASE_STATUS`, `HEALTH_TREATMENT_RECORD`,
`HEALTH_OBSERVATION_CORRECT`, `HEALTH_OBSERVATION_VOID`,
`HEALTH_TREATMENT_CORRECT`, `HEALTH_TREATMENT_VOID`); FE-09 vaccination
actions (`VACCINATION_SCHEDULE_CREATE`, `VACCINATION_SCHEDULE_EDIT`,
`VACCINATION_SCHEDULE_STOP`, `VACCINATION_DOSE_DEFER`,
`VACCINATION_RECORD_BATCH`, `VACCINATION_CORRECT`, `VACCINATION_VOID`); FE-11/12
reproduction actions (`REPRODUCTION_ESTRUS`, `REPRODUCTION_BREEDING`,
`REPRODUCTION_PREGNANCY_CHECK`, `PREGNANCY_UPDATE`,
`PREGNANCY_UPDATE_CORRECT`, `PREGNANCY_UPDATE_VOID`,
`REPRODUCTION_EVENT_CORRECT`, `REPRODUCTION_EVENT_VOID`, `CALVING_RECORD`,
`CALVING_CORRECT`, `CALVING_VOID`, `CALF_OUTCOME_CORRECT`,
`CALF_OUTCOME_VOID`); and entry/exit actions `ENTRY_VOUCHER_POST:{id}`,
`ENTRY_VOUCHER_VOID:{id}`, `HERD_ENTRY_CORRECT:{id}`, `HERD_ENTRY_VOID:{id}`,
`PENDING_CALF_DIED:{id}`, `EXIT_VOUCHER_CONFIRM:{id}`,
`EXIT_VOUCHER_DISMISS:{id}`, `EXIT_VOUCHER_VOID:{id}`, and `PEN_MOVE`.

The handler also accepts the two existing feed-ration cancellation/stop events,
which affect feeding-session reminders (REM-11). It does not send notifications
or email. `OutboxService` now discovers the due event types and filters them by
registered handlers before loading its bounded delivery batch. Events with no
handler stay pending without starving supported events; `FARM_COMMAND_COMMITTED`
is not acknowledged by the reminder handler. `reconcileFarm` keeps a pessimistic
write lock on the farm row so cron and event retries for the same farm serialize
before reading/reconciling source state. No schema change is required.

## Tests and evidence

Added cases in `ReminderReconciliationIT`:

- `reminderProjectionContainsCattleDetailsBasisAndTenantScopedTargets`
- `sourceOutboxEventReconcilesJob01AndCanBeRetriedWithoutDuplicates`
- `supportedReminderEventPassesAnEarlierBacklogOfMoreThanFiftyUnownedEvents`
- `technicianGetsNoRem08SourceActionTarget`
- `IdempotencyCommandServiceTest.savedReminderSourceCommandEnqueuesDedicatedEventBesideGenericCommandEvent`
- `IdempotencyCommandServiceTest.replayedReminderSourceCommandDoesNotEnqueueDuplicateEvents`
- `IdempotencyCommandServiceTest.resultSerializationFailureAfterEnqueueRollsBackCommandTransaction`
- `IdempotencyCommandServiceTest.unrelatedFarmCommandLeavesGenericEventForItsOwnHandler`
- `IdempotencyCommandServiceTest.onlyReminderAffectingEntryAndExitActionsMatchTheDedicatedProducer`
- `IdempotencyCommandServiceTest.callbackFailureRollsBackReservationAndNeverSavesResult`
- `OutboxServiceTest.supportedEventIsNotStarvedByEarlierUnhandledBacklog`
- `OutboxServiceTest.duplicateHandlersStillLeaveEventRetryableWithoutCallingEitherHandler`

These add H2 coverage for source event delivery across a 51-event unhandled
backlog, preservation of those pending generic events, action filtering,
idempotent retry, and duplicate-handler retryability. The unit tests cover
command replay/failure without a duplicate reminder event. The focused Maven
run passed 83/83; Failsafe passed `ReminderReconciliationIT` 17/17 and
`FarmReportIndicatorsIT` 3/3. PostgreSQL QA also confirmed the supported event
passes the 51-event unowned backlog while those unowned events remain pending.
This verifies dispatch/backlog behavior; it does not establish end-to-end
one-minute delivery for every source mutation that still lacks a producer.

## Contract coordination and limits

- `ReminderView` has additive fields. The generated `docs/api/openapi.json` and
  embedded catalog in `docs/api-handoff.html` were regenerated after focused
  verification; the catalog contains 234 paths and 288 operations. FE should
  map the target type to a locally verified screen.
- No persistence fields changed, so no migration is needed.
- The 15-minute cron remains the fallback for reminder-relevant mutations
  without an existing event or a listed command ID. The new command event
  covers the selected FE-09/10/11/12, FE-06/13 and FE-04 move commands; FE-08
  growth/profile, existing pen and FE-23 feed changes use their own events.
  End-to-end one-minute delivery is not established for source mutations that
  still lack producers.
- JOB-07 remains a separate gap. `EmailDeliveryJobService` polls durable
  `EmailDeliveryJob` rows every two seconds and retries the existing account,
  invitation, support, subscription and payment email templates; it is not an
  `OutboxEventHandler` and does not consume notification outbox events.
  `NotificationService.notify` writes deduplicated in-app notification rows
  synchronously in selected support, subscription, payment and reconciliation
  flows. There is no unified JOB-07 dispatcher/notification event consumer in
  the current handler set. The FE-14 spec assigns JOB-07 to Tài, but completion
  needs coordination with the feature owners that create subscription/payment,
  support, reconciliation and announcement events; those event producers and
  delivery paths were not changed in this JOB-01 follow-up.

## Workspace

- Shared checkout: `dev`, with parallel FE-07, FE-14/15, FE-23, JOB-07 and API
  documentation work in the same worktree. The focused Maven/Failsafe runs and
  OpenAPI regeneration above completed against this shared checkout.
- No commit or push was made for this follow-up. No persistence change or
  migration was needed.
