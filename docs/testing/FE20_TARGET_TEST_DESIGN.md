# FE-20 Target Test Design — decision-gated inventory

## Status and scope

**NO-GO for supplement/file/deadline target test code.** This is a test-design artifact only. Do not add
or alter frontend/backend test code, production code, endpoint contracts,
migrations, configuration, or feature specifications from this document. FE-20
§12.11.1 and the decision-gate WBS prohibit that work until D58's remaining
Security/operational gaps and the approved §7 supplement contract, field matrix,
and OpenAPI catalogue are complete.

The repository contains **legacy/current** support tests (for example,
`frontend/tests/unit/support/`, `frontend/tests/unit/platform-support/`,
`backend/.../SupportTicketWorkflowTest`, and support REST tests). They are seam
evidence only: they neither approve the target contract nor satisfy the cases
below. This document defines **future target** coverage; it makes no claim that
any target test exists, has run, or passes.

Primary sources used: FE-20 §§3–10 and 12.6–12.11.1; D40; SRS FE-20
GBR-76–81; `docs/superpowers/plans/2026-11-24-fe20-decision-gate-wbs.md`; and
the current test folders named above. In a conflict, the decision register then
the approved SRS govern; a proposed test must not choose a product answer.

## Gate before test authoring

Test authoring starts only after all six decisions, the completed contract
supplement, and the field/API reconciliation gate are approved. The future
author works **one behaviour at a time**:

1. Choose a fully decided case below and the concrete interface established by
   the implementation WBS.
2. Write the smallest focused test first; run it and record the expected RED
   failure caused by absent behaviour, not setup or typing errors.
3. Implement the smallest change to GREEN; rerun that focused test, then the
   agreed feature-local suite. Refactor only while green.

Do not invent class, method, endpoint, DTO, mock, or test-file signatures from
this inventory. Expected locations name a future layer/folder, not an API.

## Proposed future unit coverage

### Backend

| ID | Behaviour and source | Required input / fixture | Expected assertion | Future layer / location |
|---|---|---|---|---|
| BE-U01 | Owner create obeys D40 and GBR-76 | Each category with ACCOUNT/FARM and owned/unowned/null farm variants | ACCOUNT_ACCESS permits only ACCOUNT + null farm; PAYMENT/FARM_SERVICE require owned FARM; SYSTEM_USAGE/OTHER accept only D40-eligible combinations; requester stays fixed; server calculates initial priority and Owner sends no priority on create | Ticket create validation/domain workflow test |
| BE-U02 | Claim and assignment are atomic (GBR-77) | Unassigned OPEN ticket, two available CS actors, same displayed version | Exactly one claim assigns its actor and turns OPEN into IN_PROGRESS; loser receives stale/conflict; RESOLVED claim preserves RESOLVED | Ticket command/workflow test |
| BE-U03 | Ticket lifecycle and read-only guard (GBR-78) | Assigned ticket in each allowed status; owner/assigned/non-assigned actor | Only legal transitions occur: ask→WAITING_CUSTOMER; Owner reply→IN_PROGRESS; reopen reason→OPEN; public reply does not reopen RESOLVED; CLOSED rejects mutation | State-transition/authorization test |
| BE-U04 | Resolution and close need explicit latest acknowledgment (GBR-80) | Resolution versions, matching/stale acknowledgment, active IR states | New immutable resolution supersedes old acknowledgment; close succeeds only with latest explicit acknowledgment, no active blocker, and required CS confirmation; silence/time never closes | Resolution/close guard test |
| BE-U05 | Audience-safe projections (GBR-81, D58) | Same ticket containing PUBLIC, CS_ONLY, IR text/result and protected fields; Owner, assigned CS, non-assigned CS, named PM/SA; selected/unselected evidence | Owner never receives CS/IR internals; any permitted CS evidence access follows the approved role policy; named recipient sees only the IR revision's selected evidence, never conversation/note/domain data/unselected files | Role projection/authorization test |
| BE-U06 | VERIFY lifecycle and stale/revoked recipient guard (§12.7–12.8) | Valid role/category pair, request text, version, recipient; reassigned/cancelled and stale variants | One active IR per ticket/role; NEED_MORE_INFO becomes WAITING_CS and clarification returns OPEN; other listed outcomes become DONE; old recipient is forbidden immediately; stale action requires reload | Internal-request workflow test |
| BE-U07 | Idempotency/version decision (§4 R-20-12, §12.8) | Replayed same mutation/key and conflicting version/action | Same legitimate replay returns the recorded result without duplicating event; stale/conflicting intent is not retargeted and returns conflict/reload semantics | Mutation concurrency/idempotency test |
| BE-U08 | Supplement blocker/security decision (§12.6/12.8) | One request in every provisional state plus attachment scan result | Only approved active states block resolve/close; DRAFT does not; no EXPIRED behaviour is authored until D-FE20-06 operational details are closed; READY-only acceptance and all file authorization cases wait for D-FE20-02/03/04/06 | Future supplement policy/workflow test |
| BE-U09 | Owner priority update after D58 contract closure | Own ticket across each permitted lifecycle state; stale version and replay variants | Only approved state/enum changes succeed; server records immutable audit/history and rejects stale/replayed mutation as contracted | Future priority command/workflow test |
| BE-U10 | Evidence reads and IR selected-attachment delegation after Security contract closure | Assigned/non-assigned CS; named/revoked PM/SA; READY/rejected and selected/unselected files | Authorized CS read/download never gains ticket mutation; named PM/SA reads only selected READY refs and loses access on reassign/cancel; no public URL/key leaks | Future evidence authorization test |

### Frontend

| ID | Behaviour and source | Required input / fixture | Expected assertion | Future layer / location |
|---|---|---|---|---|
| FE-U01 | Create-form D40 conditional fields | Each category and scope selection | Scope is forced/locked where D40 requires it; farm control is required only for FARM; account payload has null farm; invalid category/scope is blocked before submit | FE-20 form validation + payload adapter tests |
| FE-U02 | Owner create validation (GBR-76, §12.3) | Missing/over-limit category, subject, description, conditional farm | Correct field receives error; only target fields are sent; no priority/assignee/IR/secret/sentinel values are fabricated | FE-20 ticket-create form/payload tests |
| FE-U03 | Safe response adaptation and rendering (§12.2, §12.7, §12.9) | Owner/CS/recipient response fixtures including absent vs nullable values | UI preserves absent/null semantics, never manufactures `0` IDs/empty history, and never renders fields absent from that audience response | FE-20 response adapter/view-model tests |
| FE-U04 | Allowed actions and primary CTA (§12.6, §12.9) | Ticket status, assignment/current permission, blocker, latest ack/version fixtures | Only legal action is visible/enabled; loading/stale/closed hides mutation; active supplement maps to correct safe next action rather than public-reply completion | FE-20 action/CTA mapping tests |
| FE-U05 | VERIFY presentation/clarification (§12.7, AC-20-13/14) | OPEN, WAITING_CS, DONE, CANCELLED; recipient/old recipient responses | NEED_MORE_INFO renders CS clarification path, not completed; old/revoked recipient sees forbidden/reload path; Owner cannot see IR result | FE-20 internal-request page/adapter tests |
| FE-U06 | Server error mapping (§12.8–12.9) | `{code, field, message}`, forbidden, stale, scan-rejected fixtures | Field error is adjacent to named field with summary focus; stale asks reload without automatic resubmit; forbidden does not disclose protected content | Shared FE error mapper + FE-20 forms/pages |
| FE-U07 | Supplement UI only after policy decision (§12.6) | Approved contract fixture, after D-FE20-02/03/04/06 | Request/evidence/review controls follow the approved limits and authorization; no test codifies provisional MIME/size/count/retention/deadline values | Future FE supplement validation/adapter tests |

## Manual integration scripts (not automated E2E)

Run UI observations at **1180×820** and **1440×900**. Record route, role,
seed/data identifiers without credentials, viewport, expected/observed result,
overflow, console/request failures, and the source checkpoint. These scripts
are manual acceptance checks, not executable automated tests.

| Script | Preconditions and data | Steps | Expected result |
|---|---|---|---|
| MI-01 role route | Existing active Owner, CS, PM/SA accounts; use locally approved seed mechanism | Sign in separately as each role; navigate to its allowed FE-20 route/link | Owner reaches ticket list/create; CS reaches queue; named PM/SA reaches assigned IR list only. Unauthorized route is denied/redirected without data disclosure. |
| MI-02 Owner create → detail | Owner and an owned farm; categories for ACCOUNT_ACCESS, PAYMENT, FARM_SERVICE, SYSTEM_USAGE/OTHER | Open create; exercise D40 forced/account/farm choices; submit valid ticket; open success link/detail; edit priority at the approved lifecycle point | Valid ticket is OPEN with owner as fixed requester and first PUBLIC description; D40 mismatches and unowned farm fail at the correct field; server assigns initial priority and Owner edit records its version/audit once that mutation contract is completed. |
| MI-03 CS claim/process | Newly created unassigned ticket and two CS sessions | CS-A claims; CS-B refreshes; CS-A asks public question; Owner replies | Claim is atomic and opens processing for CS-A; CS-B cannot mutate; status moves OPEN→IN_PROGRESS→WAITING_CUSTOMER→IN_PROGRESS and history/notification appears safely. |
| MI-04 VERIFY NEED_MORE_INFO loop | Assigned CS ticket in IN_PROGRESS; valid category/role mapping; named available PM/SA; selected/unselected evidence where policy is complete | CS creates VERIFY, optionally selects specific evidence; recipient opens it and sends NEED_MORE_INFO; CS sends clarification; recipient completes with a sanitized non-NEED_MORE_INFO outcome | Recipient sees minimal request metadata plus only selected evidence; IR transitions OPEN→WAITING_CS→OPEN→DONE; Owner never sees IR or result; reassignment/cancel revokes old recipient access. SYSTEM_USAGE/OTHER may target PM or SA at assigned-CS discretion. |
| MI-05 resolve → acknowledge → close | Assigned CS, eligible ticket, no active IR, Owner session | CS records resolution; Owner acknowledges latest version; CS opens close popup, checks confirmation, closes | Resolution is immutable and ticket becomes RESOLVED; latest explicit acknowledgment is shown; close only succeeds with confirmation and no active blockers; CLOSED is read-only. |
| MI-06 supplement flow — blocked shell | Only after all supplement decisions and §7 contract are approved | CS issues supplement; Owner drafts/uploads/submits; wait for scan; CS reviews/accepts or requests correction | Execute only against the approved attachment, scan, access, retention, deadline, and blocker contract. Until then this is deliberately **not executable** and has no expected policy values. |

## Manual system scripts (not automated E2E)

| Script | Preconditions and data | Steps | Expected result |
|---|---|---|---|
| MS-01 cross-session ownership and isolation | Owner-A, Owner-B, assigned CS, non-assigned CS, named recipient; one ticket owned by A | Create as A; fresh sign-ins for every actor; attempt list/detail URLs and action endpoints through the UI; reassign/revoke recipient then refresh old session | Only A and authorized role-specific actors see the permitted projection. B and non-assigned/old recipients cannot access or mutate protected data; access is rechecked after a fresh request/session. |
| MS-02 persistent workflow after fresh sign-in | Ticket progressed through claim, VERIFY clarification, resolution, and acknowledgment | Sign out each actor; sign in fresh; reopen their permitted route and complete next legal action | Status/version/history and allowed next action remain coherent; no stale client action is replayed or retargeted. |
| MS-03 registration then sign-in — FE-01 reference only | Existing FE-01 registration environment/contract; this is not a FE-20 registration flow | Register an account per FE-01 script; complete its approved activation/authorization conditions; sign in | Registration reports its FE-01 success condition and the new account can sign in only once FE-01 prerequisites are met. Do not infer FE-20 ticket entitlement from registration alone. |

## Requirement mapping and unresolved decisions

| Requirement / acceptance focus | Planned coverage | Gate/limitation |
|---|---|---|
| GBR-76; AC-20-01 | BE-U01, FE-U01/02, MI-02 | D58 permits Owner priority edit after server initial calculation; mutation timing/version/audit contract remains open. |
| GBR-77; AC-20-11/12 | BE-U02/03, FE-U04, MI-03, MS-01 | Existing legacy behaviours are not target proof. |
| GBR-78 | BE-U03, MI-03/05, MS-02 | No unresolved product choice for core transitions stated here. |
| GBR-79; AC-20-13/14 | BE-U05/06, FE-U03/05/06, MI-04, MS-01 | D58 permits assigned CS to select PM or SA for SYSTEM_USAGE/OTHER; server must still enforce role/recipient availability. |
| GBR-80; AC-20-12/14 | BE-U04/07, FE-U04/06, MI-05, MS-02 | No closure by timeout/silence; supplement blocker conditions remain partly gated. |
| GBR-81; AC-20-02/03/11/13/14 | BE-U05, FE-U03/05/06, MI-04, MS-01 | Attachment views/downloads await D-FE20-02/03/04 and completed contract. |
| AC-20-02–10 (supplement) | BE-U08, FE-U04/07, MI-06 | Cannot be finalized or authored until D-FE20-02/03/04/06 plus §7 payload/error/scan/retention contract. |
| AC-20-14 cross-cutting errors/stale/file state | BE-U07/08, FE-U06/07, MI-01–06 | File-scan and EXPIRED expectations are intentionally undecided until the named decisions. |

## Handoff checklist for the later test author

- Confirm D-FE20-01…06 are each dated and approved, then verify §7, SRS,
  OpenAPI catalogue, and field matrix agree.
- Replace only the relevant inventory rows with concrete test names/locations
  after interfaces are approved; keep tests focused on observable behaviour.
- Resolve and record the explicit `LamKD` base SHA before creating the
  dedicated `codex/fe20-unit-test` worktree. Write a focused red test there,
  review/transfer it to the implementation worktree, then make the smallest
  matching production change; never have both worktrees write concurrently.
  Integration/system scripts remain manual unless a separate automated scope
  is approved.
- Record RED and GREEN evidence per test and do not report coverage as passing
  without the fresh command output.
