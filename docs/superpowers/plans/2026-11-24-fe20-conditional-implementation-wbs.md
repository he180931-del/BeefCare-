# FE-20 Conditional Implementation WBS

> **Status: CONDITIONAL / NOT AUTHORIZATION TO IMPLEMENT.** This is the
> implementation-ready decomposition requested for FE-20. Code, migrations,
> OpenAPI changes, or automated tests may begin only after the Decision Gate
> below is satisfied and the normal isolated-worktree/TDD sequence in
> `RTK.md` is explicitly authorized.

**Goal:** Replace the legacy support internal-request contract with the approved
text-first `VERIFY` workflow, then add the separately approved supplement
workflow without weakening ticket data boundaries.

**Authoritative inputs:**

- `docs/REQUIREMENT_DECISIONS.md` (first authority)
- `docs/requirements/SRS_2026-10-28.txt` and
  `docs/requirements/specs/FE-20-ho-tro-khach-hang.md` (§§3–9, 12)
- `docs/requirements/specs/FE-20-DECISION-PACKET.md` (proposal only until
  signed into the decision register)
- `docs/superpowers/plans/2026-11-24-fe20-decision-gate-wbs.md`
- `docs/testing/FE20_TARGET_TEST_DESIGN.md`
- `docs/api/openapi.json`, `backend/AGENTS.md`, and `RTK.md`

**Current legacy boundary (not target behavior):**

| Area | Existing symbol / field | Target replacement |
|---|---|---|
| IR input | `SupportDtos.InternalCreate.question`, `context`, `InternalRequest.question/contextJson` | `requestText`; no context references or domain selector |
| IR result | `SupportDtos.Complete.result`, `domainResultAuditId`, `PERFORMED/UNABLE/OUTSIDE_DOMAIN` | `resultNote`; `CONFIRMED/NOT_CONFIRMED/NEED_MORE_INFO/OUT_OF_SCOPE` |
| IR state | `OPEN/DONE/CANCELLED` | add `WAITING_CS`; clarification returns it to `OPEN` |
| PM/SA UI | `listDomainResults`, domain-result picker | text-only response; recipient opens their separately authorized domain screen |
| Supplement | absent | a separately contracted, private work item; do not use `ASK_CUSTOMER` or chat as a substitute |

## Decision Gate — mandatory before any implementation task

The Product direction is recorded in D58, but all open Security/operational
gaps below must be resolved in `docs/REQUIREMENT_DECISIONS.md`, then reconciled
into the SRS/spec/OpenAPI catalogue and field matrix. The decision packet is
the current gap record, not an implementation contract.

| Gate | Decision | Blocks |
|---|---|---|
| D-FE20-01 | Product direction recorded; Owner post-create priority mutation contract still required | T03, T09, T15 |
| D-FE20-02 | PDF/JPEG/PNG recorded; type/count/size/scan/retention Security policy open | T11–T18 |
| D-FE20-03 | Product permits all CS reads/downloads; role/audit/revocation contract open | T11–T18 |
| D-FE20-04 | Product permits CS-selected IR evidence; delegation Security contract open | T11–T18 |
| D-FE20-05 | Product permits PM or SA for SYSTEM_USAGE/OTHER at assigned-CS discretion | T05, T08, T15 |
| D-FE20-06 | Product requires deadline/reminder/EXPIRED; exact behavior open | T11–T18 |

**Do not start** if one gate is unresolved, if §7 lacks the supplement route
and error contract, or if the target state/field matrix differs across sources.
`DRAFT` supplement work is non-blocking; exactly `OPEN`, `SUBMITTED`,
`UNDER_REVIEW`, and `NEEDS_CORRECTION` are active/blocking only after the
approved contract says the same.

## Execution boundaries

- Before creating either worktree, resolve and record the explicit `LamKD`
  base SHA. Use one isolated `codex/fe20-unit-test` worktree for test
  authoring and one isolated `codex/fe20-support` worktree for implementation.
  They must not write concurrently. Preserve the existing dirty checkout.
- Every Java/TypeScript symbol change requires GitNexus impact analysis first;
  warn and stop for HIGH/CRITICAL results. Run `gitnexus_detect_changes()`
  before any future commit.
- A `*IT` test is integration evidence and must run through Maven `verify`.
  The feature task itself should use focused unit/service tests only. Manual
  integration/system execution remains the user's responsibility.
- For each implementation task that names a `BE-U*` or `FE-U*` dependency,
  first author its focused red test in `codex/fe20-unit-test`, review and
  transfer that test change, then implement the matching production slice in
  `codex/fe20-support`. Do not have both worktrees write at the same time.
  T19/T20 below are the test-inventory completion checkpoints, not permission
  to postpone every test until after production behavior exists.
- Keep all target routes behind the approved DTO/OpenAPI slice. Do not ship a
  frontend adapter that sends target fields to the current legacy endpoints.

## Ordered small tasks

Each task is deliberately one reviewable result. “Unit-test dependency” below
names the focused test that must be written red before its matching
implementation task under the execution boundary above; it does not authorize
test creation today.

### Phase A — contract and target IR (no supplements)

### T01: Sign the decision register and regenerate the FE-20 field matrix

**Prerequisites:** D58 plus closed Security/operational gaps for this slice.

**Files:**

- Modify: `docs/REQUIREMENT_DECISIONS.md`
- Modify: `docs/requirements/specs/FE-20-ho-tro-khach-hang.md` (§7, §12.6,
  §12.11)
- Modify: `docs/requirements/SRS_2026-10-28.txt` only where Product approves
  target changes
- Modify: `docs/api/openapi.json` only through the contract export workflow

**Action:** Record the six settled values, then make one field matrix covering
Owner/CS/PM/SA audiences, requiredness, allowed values, version/key, and
persistence owner. Explicitly state whether existing records are migrated or
remain legacy read-only.

**Acceptance evidence:** Every scoped row in spec §7 has a matching DTO/OpenAPI
operation design. Attachment/expiry/priority-mutation rows remain excluded until
their currently provisional contract values are closed.

### T02: Freeze the target endpoint and compatibility strategy

**Prerequisites:** T01.

**Likely symbols/files:**

- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/dto/SupportDtos.java`
  (`InternalCreate`, `InternalManage`, `Complete`, `InternalView`, `Ticket`,
  `Page`)
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/CsSupportResource.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AssignedInternalSupportResource.java`
- Modify: `docs/api/openapi.json`

**Action:** Choose and document one cut-over: replace the currently published
IR payloads in one breaking contract release, or introduce versioned routes.
Do not have an endpoint accept both `question` and `requestText`, or both
outcome vocabularies, without an explicitly documented compatibility rule.

**Acceptance evidence:** Generated OpenAPI names A14–A18 payloads and response
audiences exactly as spec §7; frontend migration has one transport target.

### T03: Model owner ticket row projection and server-derived action

**Prerequisites:** T01, D-FE20-01.

**Likely symbols/files:**

- Modify: `SupportDtos.Ticket` / add a dedicated owner row/page record in
  `SupportDtos.java`
- Modify: `SupportTicketCommandService.mine`, `get`, and ticket mapping
  helpers
- Modify: `OwnerSupportResource`
- Modify: `frontend/src/features/support/types.ts`
- Modify: `frontend/src/features/support/api/supportApi.ts`

**Action:** Return only the `OwnerTicketRow` projection required by §7/§12.9;
derive safe `nextAction` server-side. Do not leak CS assignment, IR, or
protected supplement/review fields. Include Owner post-create priority editing
only after the A6a lifecycle/version/idempotency/audit contract is approved.

**Unit-test dependency:** FE-U02; BE-U04 response-projection case.

**Acceptance evidence:** Owner list/detail JSON excludes every prohibited
field, with priority edit unavailable until its A6a contract exists, and
selects the safe next action from persisted state, not client guess.

### T04: Model CS queue row projection and common count predicate

**Prerequisites:** T01.

**Likely symbols/files:**

- Modify: `SupportDtos.Page` / add `CsTicketRow` and page/tile records
- Modify: `SupportTicketCommandService.queue` and its mapping/filter helpers
- Modify: `CsSupportResource.queue`
- Modify: `frontend/src/features/platform-support/types.ts`
- Modify: `frontend/src/features/platform-support/api/supportApi.ts`

**Action:** Materialize `workOwner`, allowlisted `nextAction`, `agingSeconds`,
active supplement/IR statuses and assignee availability on the server. Make
queue tiles/counts use the same filter predicate as items.

**Unit-test dependency:** BE-U04, FE-U04.

**Acceptance evidence:** A queue-row fixture has no ticket body, CS-only note,
attachment, or security reason; a filtered count matches the returned rows.

### T05: Replace category-to-role enforcement with the approved matrix

**Prerequisites:** T01, D-FE20-05.

**Likely symbols/files:**

- Modify: `InternalSupportRequestService.create`, `specialistRole`, and its
  target-role validation helper
- Modify: `SupportTicketCommandService` mapping helper if category data is
  normalized there
- Modify: `frontend/src/features/platform-support/domain/supportRules.ts`
- Modify: `frontend/src/features/platform-support/components/TicketDialogs.tsx`

**Action:** Validate persisted ticket category to target role at the server;
make the UI offer only server-approved recipient-role choices. For
`SYSTEM_USAGE`/`OTHER`, permit PM or SA only for an assigned CS and only when
the named recipient is available.

**Unit-test dependency:** BE-U02, FE-U04.

**Acceptance evidence:** `ACCOUNT_ACCESS→SA`, `PAYMENT/FARM_SERVICE→PM`, and
the approved SYSTEM_USAGE/OTHER treatment are enforced even when a client
posts an incompatible role.

### T06: Add the target IR persistence state without retroactive guessing

**Prerequisites:** T02, T05.

**Likely symbols/files:**

- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/domain/InternalRequest.java`
- Create: timestamped changelog under
  `backend/src/main/resources/config/liquibase/changelog/`
- Modify: `backend/src/main/resources/config/liquibase/master.xml`
- Modify: `InternalSupportRequestService.create/manage/complete/mine/get`

**Action:** Add state/data required for `VERIFY`, `requestText`, result-note
history and `WAITING_CS`. Use a forward migration. Existing context/audit data
may remain retained for historical records but is never inferred into a target
request or exposed in target recipient projection.

**Unit-test dependency:** BE-U05, BE-U06.

**Acceptance evidence:** New `VERIFY` record round-trips its target data and
legacy `PERFORMED` data remains readable only by the documented legacy view;
no historic row is silently reclassified.

### T07: Implement one state transition command: PM/SA NEED_MORE_INFO

**Prerequisites:** T02, T06.

**Likely symbols/files:**

- Modify: `SupportDtos.Complete` (or target-named response record)
- Modify: `InternalSupportRequestService.complete`
- Modify: `AssignedInternalSupportResource.complete`
- Modify: `frontend/src/features/platform-support/api/supportApi.ts`
- Modify: `frontend/src/features/platform-support/pages/InternalRequestsPage.tsx`
- Modify: `frontend/src/features/platform-support/components/ResultForm.tsx`

**Action:** Change only the `NEED_MORE_INFO` branch: require sanitized
`resultNote`, retain the named recipient, set state `WAITING_CS`, append
history/audit and notify CS. It must not mark the IR DONE or resolve/close the
ticket.

**Unit-test dependency:** BE-U05, FE-U05.

**Acceptance evidence:** One stale or non-recipient request fails; a valid
request visibly becomes `WAITING_CS`, blocks ticket resolution/close, and has
no Owner-readable result.

### T08: Implement one state transition command: CS clarification

**Prerequisites:** T07.

**Likely symbols/files:**

- Modify: `SupportDtos.InternalManage`
- Modify: `InternalSupportRequestService.manage`
- Modify: `CsSupportResource.manageInternal`
- Modify: `frontend/src/features/platform-support/api/supportApi.ts`
- Modify: `frontend/src/features/platform-support/components/TicketDialogs.tsx`

**Action:** Add `CLARIFY` with `clarificationText` and request `expectedVersion`.
It is legal only in `WAITING_CS`, appends an immutable clarification revision,
returns the same request to `OPEN`, and notifies the same authorized recipient.
Keep REASSIGN/CANCEL reasons required and reject clarification in other states.

**Unit-test dependency:** BE-U05, FE-U05.

**Acceptance evidence:** `OPEN → WAITING_CS → OPEN` preserves the same IR
identity; reassign/cancel revokes the former recipient before their next read.

### T09: Implement target terminal VERIFY outcomes and close blockers

**Prerequisites:** T03, T06, T07, T08.

**Likely symbols/files:**

- Modify: `InternalSupportRequestService.complete`
- Modify: `SupportTicketCommandService.resolve`, `close`, and active-IR
  predicate/helper
- Modify: `frontend/src/features/platform-support/domain/supportRules.ts`
- Modify: `frontend/src/features/platform-support/components/ResultForm.tsx`
- Modify: `frontend/src/features/platform-support/components/TicketDialogs.tsx`

**Action:** Complete `CONFIRMED`, `NOT_CONFIRMED`, and `OUT_OF_SCOPE` to DONE;
block resolution/close exactly for `OPEN` and `WAITING_CS`. Remove the target
path’s domain-audit picker and do not interpret CONFIRMED as a mutation.

**Unit-test dependency:** BE-U03/BE-U05, FE-U04/FE-U05.

**Acceptance evidence:** Only the three terminal outcomes make the IR DONE;
both active statuses prevent resolution and close, while a DONE request does
not.

### T10: Cut frontend data adapters and remove target use of legacy context

**Prerequisites:** T02–T09.

**Likely symbols/files:**

- Modify: `frontend/src/features/platform-support/types.ts`
- Modify: `frontend/src/features/platform-support/api/supportApi.ts`
- Modify: `frontend/src/features/platform-support/data/supportDemoStore.ts`
- Modify: `frontend/src/features/platform-support/data/supportMock.ts`
- Modify: `frontend/src/features/platform-support/pages/InternalRequestRoutes.tsx`
- Modify: `frontend/src/features/platform-support/pages/InternalRequestsPage.tsx`

**Action:** Adapt only server target fields to typed feature models; reject or
ignore unknown protected fields rather than falling back to `farmId: 0`, empty
history, context selector, or a mock domain result. Keep any legacy route
visibly marked legacy/read-only until the migration release removes it.

**Unit-test dependency:** FE-U03, FE-U05, FE-U06.

**Acceptance evidence:** PM/SA receives only minimal request data; Owner never
receives IR data; backend mode never calls the demo store for target commands.

### Phase B — supplement slice (only after its separate route/attachment contract)

### T11: Add the approved supplement contract to OpenAPI and DTOs

**Prerequisites:** T01, D-FE20-02, D-FE20-03, D-FE20-04, D-FE20-06.

**Likely symbols/files:**

- Modify: `SupportDtos.java` (create/read/draft/submit/review/cancel/waive
  records and role-specific views)
- Modify: `CsSupportResource` and `OwnerSupportResource`, or add narrowly
  named supplement resources after the route review
- Modify: `docs/api/openapi.json`

**Action:** Write exact payloads, status/error schema, attachment lifecycle,
authorization and download route before entity code. Include `expectedVersion`
and `Idempotency-Key` for non-draft mutation commands.

**Unit-test dependency:** BE-U08, FE-U07.

**Acceptance evidence:** There is no placeholder JSON shape; all attachment
limits/roles/retention/deadline outcomes come from approved decisions.

### T12: Add supplement persistence identity and state constraints

**Prerequisites:** T11.

**Likely symbols/files:**

- Create: `CustomerSupplementRequest` and subordinate revision/attachment
  domain entities under `backend/src/main/java/vn/edu/fpt/beefcare/domain/`
- Create: matching repositories under `repository/`
- Create: timestamped Liquibase changelog(s); modify `master.xml`

**Action:** Persist ticket identity, revision, request text, evidence-required,
state, audit actor/time/version and a database-safe enforcement of one active
request per ticket. Model file metadata, not public storage URLs.

**Unit-test dependency:** BE-U08.

**Acceptance evidence:** A migration readback proves one active request and
immutable submitted revisions; DRAFT neither blocks nor becomes Owner-visible.

### T13: Add quarantined upload and authorized evidence retrieval

**Prerequisites:** T11, T12.

**Likely symbols/files:**

- Create/update the approved file-storage/scan integration service and
  supplement resource(s), names chosen in T11
- Modify: `CustomerSupplementRequest` relation/mapping and DTO mapper
- Modify: frontend supplement API adapter selected in T15

**Action:** Implement the exact approved upload → signature/type/size → scan →
READY/REJECTED sequence. Reauthorize every metadata/read/download request from
the supplement source record. Never return storage keys, signed URLs, or file
content in ticket/IR/notification projections.

**Unit-test dependency:** BE-U08, FE-U07.

**Acceptance evidence:** A rejected/non-READY required file cannot be
submitted/accepted/downloaded as evidence; unauthorized and PM/SA access obey
D-FE20-03/04.

### T14: Implement one supplement lifecycle command at a time

**Prerequisites:** T12, T13.

**Likely symbols/files:**

- Create: a focused `CustomerSupplementService` (or approved equivalent)
- Modify: CS/Owner supplement resources selected in T11
- Modify: `SupportTicketCommandService` active-supplement blocker helper

**Action sequence:** (a) CS ISSUE `DRAFT→OPEN`; (b) Owner SUBMIT
`OPEN/NEEDS_CORRECTION→SUBMITTED`; (c) CS REVIEW `SUBMITTED→UNDER_REVIEW`;
(d) CS ACCEPT or REQUEST_CORRECTION; (e) authorized CANCEL/WAIVE. Implement
no EXPIRED transition unless D-FE20-06 gives exact behavior.

**Unit-test dependency:** BE-U08.

**Acceptance evidence:** Every command verifies assignee, version/key and
state; only `OPEN/SUBMITTED/UNDER_REVIEW/NEEDS_CORRECTION` block resolve/close.

### T15: Add owner supplement presentation and safe primary CTA

**Prerequisites:** T03, T11–T14.

**Likely symbols/files:**

- Create: focused supplement components/pages under
  `frontend/src/features/support/`
- Modify: `frontend/src/features/support/types.ts`, `api/supportApi.ts`,
  `pages/TicketDetailPage.tsx`, `components/ConversationCard.tsx`

**Action:** Render only the requester’s request/revision/file scan/review
fields and replace the primary CTA with draft/submit when an active supplement
exists. Public reply remains available only as conversation, never as evidence
submission.

**Unit-test dependency:** FE-U04, FE-U07.

**Acceptance evidence:** Owner cannot see CS-only/IR/other-owner data; submit
is disabled until every policy-required attachment is READY.

### T16: Add CS supplement review UI and queue action mapping

**Prerequisites:** T04, T11–T14.

**Likely symbols/files:**

- Create: focused components/pages under
  `frontend/src/features/platform-support/`
- Modify: `types.ts`, `api/supportApi.ts`, `pages/QueuePage.tsx`,
  `pages/TicketPage.tsx`, `components/TicketDialogs.tsx`

**Action:** Display safe queue next-action/status and permit only assigned CS
to issue/review/cancel/waive. Do not display private object URLs or migrate
legacy `ASK_CUSTOMER` content into a supplement form.

**Unit-test dependency:** FE-U04, FE-U07.

**Acceptance evidence:** A non-assigned CS gets no mutation CTA; all queue
rendering derives from response allowlists rather than locally inferred cause.

### T17: Implement notifications/history for target IR and supplement changes

**Prerequisites:** T07–T09 and, for supplement events, T14.

**Likely symbols/files:**

- Modify: `InternalSupportRequestService.enqueueNotice/enqueueCompletionNotice`
- Modify/add approved supplement notification/outbox handler(s)
- Modify: `SupportTicketCommandService.history/changed` call sites
- Modify: feature notification adapters/pages only if schema changes

**Action:** Emit minimal identity/status/link notification data and durable
history. Recheck current assignment/recipient authorization at read time; do
not place request text, result note, filename/content, storage URL, or raw
domain data in the event.

**Unit-test dependency:** BE-U06, BE-U08.

**Acceptance evidence:** Reassigned/revoked users cannot open or mark target
notifications as read; notification payload is boundary-safe.

### T18: Implement explicitly approved deadline policy only

**Prerequisites:** T14, D-FE20-06.

**Likely symbols/files:**

- Modify/create the approved maintenance-job/service symbols; inspect
  `SupportMaintenanceJob` before choosing ownership
- Modify supplement service/state mapper and notification handler(s)

**Action:** Add reminder/expiry only with the decision’s clock, timezone,
transition, blocker, and idempotency rules. If the decision says no expiry,
make no job/state implementation.

**Unit-test dependency:** BE-U08.

**Acceptance evidence:** A fixed-clock test proves the exact decision and
rerunning the job does not duplicate notifications/transitions.

### Phase C — test implementation and legacy retirement

### T19: Complete and verify the backend unit/service inventory

**Prerequisites:** T01–T18 contract choices for the test’s scope. Individual
BE-U tests are authored before their matching implementation task; this is the
completion checkpoint in the isolated `codex/fe20-unit-test` worktree based on
the recorded `LamKD` SHA.

**Files:**

- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/service/SupportTicketWorkflowTest.java`
- Create only if isolation warrants it:
  `InternalSupportRequestServiceTest.java` and
  `CustomerSupplementServiceTest.java`

**Action:** Complete any remaining concrete BE-U01…BE-U08 cases in
`docs/testing/FE20_TARGET_TEST_DESIGN.md`: D40 ticket creation, claim/state,
resolution/ack/close blockers, audience projection, VERIFY loop/authorization,
idempotency/stale behavior, and approved supplement policy. Avoid generic
entity getter tests and do not treat HTTP success as persistence proof.

**Acceptance evidence:** Each target state/persistence/boundary behavior has a
focused red→green service assertion and its exact Maven command is recorded.

### T20: Complete and verify the frontend unit/adapter inventory

**Prerequisites:** T01–T18 contract choices for the test’s scope; after T19
checkpoint is reviewed/transferred. Individual FE-U tests are authored before
their matching UI task; this is the completion checkpoint in the isolated
`codex/fe20-unit-test` worktree based on the recorded `LamKD` SHA.

**Files:**

- Modify/create: `frontend/tests/unit/support/*.test.ts(x)`
- Modify/create: `frontend/tests/unit/platform-support/*.test.ts(x)`
- Existing anchors: `supportApi.test.ts`, `ticketValidation.test.ts`,
  `supportRules.test.ts`, `PlatformSupportPages.test.tsx`,
  `platform-support/supportApi.test.ts`

**Action:** Complete any remaining FE-U01…FE-U07 cases: form/payload, field validation, safe
response mapping, allowed CTA, VERIFY clarification presentation, stale/forbidden
error mapping, and approved supplement file rules. Mock transport, not the
behavior under test; backend mode must never use a demo fallback.

**Acceptance evidence:** Tests prove protected fields cannot be rendered from
an unexpected response and stale errors do not automatically resubmit a command.

### T21: Retire the legacy target path only after a proven cut-over

**Prerequisites:** T02–T10, T17, T19–T20, and a user-approved migration
checkpoint.

**Likely symbols/files:**

- Remove/alter legacy-only `context`, `domainResultAuditId`,
  `domainResults`, `PERFORMED/UNABLE/OUTSIDE_DOMAIN` paths in
  `InternalSupportRequestService`, `SupportDtos`, resources and platform
  frontend adapter/store/pages
- Modify the forward migration/compatibility read mapper selected in T02

**Action:** Remove only code made unreachable by the documented migration
strategy. Preserve historical read/audit access where the approved retention
policy requires it; do not delete or rewrite old business evidence.

**Acceptance evidence:** `rg` finds legacy terms only in documented migration
or history compatibility code; target paths contain no context/domain-audit
payload or UI.

### T22: Contract export and manual acceptance handoff

**Prerequisites:** T19–T21 plus integration checkpoint authorization.

**Files:**

- Modify: `docs/api/openapi.json` through `OpenApiContractTest` export only
- Update: `docs/api-handoff.html` only with actual evidence
- Reference: `docs/testing/FE20_TARGET_TEST_DESIGN.md` MI-01…MI-06 and
  MS-01…MS-03

**Action:** Export current OpenAPI after tests pass, refresh API catalogue,
and hand the user the manual integration/system scripts. Do not turn MI/MS
scripts into automated E2E without a separate user-approved scope.

**Acceptance evidence:** Handoff distinguishes fresh unit results from manual
runtime evidence and records the unexecuted manual scenarios as such.

## Review focus and safe stopping points

| Risk to review | Owning task/test |
|---|---|
| A client posts a mismatched role/category or a stale version | T05, T07–T09; BE-U02/05 |
| A recipient receives conversation, CS notes, file data or audit IDs | T03/T06/T10; BE-U04/05, FE-U03/05 |
| NEED_MORE_INFO accidentally completes the request or permits close | T07–T09; BE-U05, FE-U05 |
| Legacy context/domain audit silently survives the target adapter | T02/T10/T21; FE-U03 |
| Attachment scan/retention/deadline is invented before policy approval | Decision Gate, T11–T18; BE-U08/FE-U07 |

**Safe stop A:** After T10, target text-only VERIFY is independently usable;
supplement work remains unavailable until its contract and gate are complete.

**Safe stop B:** After T18, supplement is usable only if its approved security
and deadline policy has been implemented and tested. T21 cannot start until
the target release/readback evidence exists.

## Self-review of this WBS

- **Contract coverage:** tasks T03–T10 cover the approved ticket/IR target;
  T11–T18 isolate all supplement and file-policy work; T19–T22 cover unit
  proof, legacy retirement and manual handoff.
- **Decision coverage:** every D-FE20-01…06 appears as a prerequisite where
  it changes behavior; none is replaced with a guessed value.
- **Migration safety:** T02 and T06 require an explicit compatibility choice;
  T21 delays removal until after target evidence.
- **Test focus:** automated work is limited to FE/BE unit/service behavior;
  MI/MS stay manual as requested.
- **No authorization implied:** this document adds no code, test or API route
  and must not bypass the Decision Gate.
