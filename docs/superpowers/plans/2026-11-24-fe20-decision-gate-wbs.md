# FE-20 Decision-Gate Documentation WBS

> **For agentic workers:** This WBS is deliberately limited to Product/Security decisions and documentation. Do not begin implementation, migration, OpenAPI implementation work, UI work, or test-code authoring from this file. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the recorded FE-20 Product decisions (D58) and close their
remaining Security/operational gaps into a complete, reviewable contract
supplement, so implementation can be created safely.

**Architecture:** FE-20 remains a support-ticket workflow with separate Owner, CS, and PM/SA audiences. The proposed target adds a structured `CustomerSupplementRequest` and a text-first `VERIFY` internal request, but these remain documentation targets until every decision and contract detail below is approved and recorded. This WBS coordinates only the decision records and source-of-truth documentation; it creates no runtime behavior.

**Tech Stack:** Documentation only — Markdown requirement/specification files, SRS, OpenAPI catalogue, and field/contract matrix.

**Spec:** `docs/requirements/specs/FE-20-ho-tro-khach-hang.md` (§7, §10.1, §12.6, §12.7, §12.11, §12.11.1); `docs/REQUIREMENT_DECISIONS.md` (D40); SRS 28/10 (FE-20, SCR-64–69, GBR-76–81; từ 28/11/2026 đối chiếu `docs/requirements/SRS_Report3_v1.2.txt` theo D90, các mã này giữ nguyên số).

## Scope gate — mandatory

**GO now:** research, decision capture, cross-document reconciliation, contract/matrix/OpenAPI documentation refresh, and test-design inventory only.

**NO-GO now:** supplement/file/attachment-sharing/deadline code changes,
migrations, endpoint implementation, UI implementation or production test code.
D58 records Product direction, but Security/operational contract gaps remain
for D-FE20-02/03/04/06 and the supplement contract below is incomplete.

Do not substitute a recommendation for an approval. Any answer that is absent, conditional, or conflicts with the approved SRS, D40, or an earlier approved decision remains a blocker and must be escalated to the named owner.

## Sources and invariants to preserve

- D40 is already authoritative: `ACCOUNT_ACCESS → ACCOUNT`; `PAYMENT` and `FARM_SERVICE → FARM`; `SYSTEM_USAGE` and `OTHER` may use the approved eligible scopes. No UI fallback may override it.
- GBR-76–81 retain Owner ownership, assignment/state controls, explicit acknowledgment before close, and strict audience separation.
- The documented target is `VERIFY` text-first: PM/SA receive minimal request
  text/metadata and only attachments explicitly selected by CS for that IR
  revision; never conversation, CS notes, deep-link/domain data, all ticket
  files, a public URL, or a mutation command.
- Supplement details in §12.6 are provisional until their decisions and the complete contract are approved. Existing free `ASK_CUSTOMER` must not be silently backfilled as a structured supplement.

## Review focus

- A product decision that is recorded in one document but leaves a contradictory SRS screen, field matrix, message, or OpenAPI description.
- A supplement upload/download path that lacks explicit quarantine, scan result, retention, or re-authorization semantics.
- Any payload that lets a stale client replay an action against a different revision, request, assignee, or recipient.
- Any PM/SA response or CS view that leaks Owner files, public conversation, CS-only notes, secrets, raw account/bank data, or domain records.
- `SYSTEM_USAGE`/`OTHER` role routing being inferred from a UI control rather than the approved category matrix.

## WBS

### D-FE20-01 — Owner priority field decision

**Owner:** Product

**Recorded Product decision:** System determines initial priority; Owner may
edit the priority after creation. The contract still needs mutation timing,
expected-version/idempotency and audit/history rules.

**Deliverable / source-of-truth update:** A dated decision entry in `docs/REQUIREMENT_DECISIONS.md`, followed by reconciled wording in the approved FE-20 spec and SRS SCR-65/related message or field descriptions. Record the exact Owner-visible behavior; do not merely remove a visual label.

- [x] Product records the direction, owner and date in D58.
- [ ] Reconcile SRS SCR-65 and the field matrix: Owner may not select initial priority, but can edit it only at the explicitly approved later point.
- [ ] Define the priority mutation payload, expected version, allowed lifecycle states and immutable audit event.

**Exit evidence:** A reviewer can trace one approved answer from the decision register to SCR-65, the FE-20 field matrix, and the create-ticket contract without ambiguity.

### D-FE20-02 — Evidence attachment policy

**Owner:** Product + Security

**Decision to obtain:** The allowed attachment policy for a customer supplement. Required answers are allowed MIME/type families, maximum size per file, maximum count per submission/request, prohibited content, retention/deletion rule and owner, and whether evidence is optional or required for each issued request. Security must approve the quarantine, signature/type validation, malware scan, and failed-scan handling constraints.

**Deliverable / source-of-truth update:** An approved evidence-policy decision in `docs/REQUIREMENT_DECISIONS.md` and precise FE-20/SRS/security-policy references. The decision must name values or an approved policy reference; “validated safely” is not sufficient.

- [ ] Product supplies the business rule for optional versus required evidence and any category-specific exception; do not infer it from ticket category.
- [ ] Security supplies MIME/type, size, count, signature validation, quarantine, scan, rejected-file, download, retention, deletion, and audit requirements.
- [ ] Resolve Product/Security conflicts in one recorded approval before editing downstream contract prose.
- [ ] Update FE-20 §12.6/§12.8 and the SRS wording to cite the final policy rather than a placeholder.

**Exit evidence:** The policy makes it possible to specify upload validation, `READY` eligibility, rejected-file behavior, retention, and audit without inventing values during implementation.

### D-FE20-03 — Non-assigned CS access to customer evidence

**Owner:** Security, with Product confirmation of workflow impact

**Recorded Product decision:** Any CS may view/download evidence without claim
or handover. Security still owns role boundary, read/download reauthorization,
audit and revocation detail.

**Deliverable / source-of-truth update:** A decision-register entry and reconciled FE-20 access matrix, including claim/handover/revocation behavior and the authorization point for every metadata/read/download operation.

- [ ] Security records the answer and the re-authorization rule for list metadata, preview, and file read/download separately if they differ.
- [ ] Product confirms the permitted CS workflow when the current assignee is unavailable or a handover is needed.
- [ ] Update the Owner/CS visibility matrix and the supplement lifecycle text with the approved rule.
- [ ] Check that the result still satisfies GBR-77, GBR-81, and the prohibition on showing storage keys or signed URLs.

**Exit evidence:** A contract author can determine, for any CS user and supplement state, whether the user may see metadata, content, or neither.

### D-FE20-04 — PM/SA access to customer attachments

**Owner:** Product + Security

**Recorded Product decision:** CS may explicitly select evidence to attach to a
named PM/SA IR. It is a scoped IR-revision delegation, not broad ticket-file
access; Security still owns the exact authorization/audit/revocation contract.

**Deliverable / source-of-truth update:** An approved MVP boundary in the decision register and the FE-20 role matrix; if a future exception is approved, create a separately scoped product/security decision record instead of adding it to the MVP contract.

- [x] Product selects scoped sharing: CS selects evidence for a named PM/SA IR;
  it is not broad ticket-file access.
- [ ] Security defines selected-attachment identity, per-revision immutability,
  read/download authorization, reassign/cancel revocation, audit and retention.
- [ ] Reconcile SCR-69, IR payload/response descriptions, notifications and
  acceptance criteria to permit only selected evidence.
- [ ] Confirm `VERIFY` remains text-first and never becomes broad evidence
  transfer by implication.

**Exit evidence:** PM/SA access is unambiguous and cannot be implemented as a broad ticket/file read permission.

### D-FE20-05 — `SYSTEM_USAGE` / `OTHER` target-role matrix

**Owner:** Product, with Security review

**Decision to obtain:** The explicit allowed internal-request target role(s), if any, for `SYSTEM_USAGE` and `OTHER`. The result must also state whether no IR is permitted. Do not infer a role from a screen, label, recipient availability, or past ticket.

**Deliverable / source-of-truth update:** A server-enforced category-to-role matrix in the decision register and reconciled FE-20/SRS contract text. Retain approved mappings `ACCOUNT_ACCESS → SA` and `PAYMENT`/`FARM_SERVICE → PM` alongside D40 scope rules.

- [ ] Product records each category’s allowed role set or explicit “none.”
- [ ] Security reviews the least-privilege implications of every allowed role.
- [ ] Reconcile the matrix with D40 and SRS GBR-79/SCR-68/SCR-69; distinguish scope eligibility from recipient role eligibility.
- [ ] Update the future create-IR contract requirement to reject invalid category/role pairs server-side.

**Exit evidence:** The matrix has a definitive row for all five categories and contains no implicit fallback route.

### D-FE20-06 — Deadline, reminder, expiry policy

**Owner:** Product + Security

**Decision to obtain:** Whether a supplement deadline exists; reminder timing/channel; what `EXPIRED` means; whether it remains a blocker; who may waive/cancel it; audit/notification requirements; and confirmation that a deadline never auto-closes a ticket. Security must review retention implications for unsubmitted drafts/files.

**Deliverable / source-of-truth update:** A dated decision-register entry and reconciled supplement state/blocker table, notification/message catalogue, and retention policy reference.

- [ ] Product records the complete deadline/reminder/expiry behavior or explicitly selects “no deadline/reminder/expiry in MVP.”
- [ ] Security records how draft/uploaded/expired evidence is retained, purged, and audited under the selected behavior.
- [ ] Update `EXPIRED` transition, ticket `workOwner`/`nextAction`, resolve/close blockers, and notifications only from the approved policy.
- [ ] Verify the policy does not violate GBR-80: no close by silence, timeout, or text interpretation.

**Exit evidence:** The lifecycle has no undecided `EXPIRED` transition, no hidden automatic closure, and no unspecified retention outcome.

### Contract supplement — only after D-FE20-01…06 all pass

**Owner:** Product + Security approve; API/Backend/Frontend document owners reconcile

**Precondition:** Every decision task above is checked with a dated source-of-truth reference. If any decision is open or contradictory, stop here.

**Deliverable / source-of-truth update:** A dedicated approved supplement-contract group added to FE-20 §7 (and aligned OpenAPI/SRS decision references), not inferred from the provisional tables. It must make the following items explicit:

- [ ] **Operations and resource ownership:** Owner read/current request, save draft, submit revision; CS create/edit DRAFT, issue, review start, accept, request correction, waive, cancel; attachment upload, scan-status read, metadata/read/download; list/detail/history operations. Specify actor, state preconditions, authorization, and response resource for each.
- [ ] **Payloads and responses:** Exact request/response fields for supplement identity, `ticketId`, `definitionVersion`, record/submission/review versions, status, request text, evidence rule, due date if approved, response text, attachment metadata/scan state, review reason, history, safe `nextAction`, and pagination where applicable. Define which fields are absent versus nullable; no sentinel IDs/defaults.
- [ ] **Error and message catalogue:** Field-error shape `{code, field, message}`, stale/conflict/forbidden/not-found/scan-rejected/policy-limit transitions, exact message IDs, display audience, and retry/reload behavior. Add or reconcile message IDs rather than reusing an unrelated message by guesswork.
- [ ] **Concurrency and idempotency:** Required `Idempotency-Key` and expected version for every create, issue, submit, review, waive, cancel, reassign, clarification, and completion mutation; replay result semantics; stale conflict behavior; correlation/history/audit identity.
- [ ] **File security and lifecycle:** Quarantine → signature/type/size validation → scan → `READY`/rejected lifecycle; who can see metadata/read/download at each state; no public URL/storage key; malware/failed scan outcome; retention/deletion/audit per D-FE20-02/03/04/06.
- [ ] **IR compatibility:** Preserve `VERIFY` text-first and `WAITING_CS`, exact payload/result/history fields, category-role enforcement, recipient re-authorization, selected-attachment authorization/audit/revocation, and no conversation/CS-note/domain-data or unselected-attachment leakage. Keep `PERFORM_ACTION` out of this MVP unless separately approved with provenance.
- [ ] **State/notification consistency:** Supplement active/blocking states, ticket status/work-owner/next-action effects, owner/CS notification minimal payloads, and no deadline-based ticket closure.

**Exit evidence:** A reviewer can implement every proposed supplement/IR operation from the contract without selecting an unstated payload, state transition, file-policy value, authorization rule, message ID, or concurrency policy.

### Field matrix, API catalogue, and source reconciliation — after contract supplement

**Owner:** Documentation/API owners; Product/Security review security-sensitive rows

**Precondition:** The approved contract supplement exists.

**Deliverable / source-of-truth update:** A refreshed FE-20 field matrix and API/OpenAPI catalogue that exactly match approved SRS/spec/decision records. This is documentation refresh only, not an endpoint implementation.

- [ ] Refresh the Owner, CS, PM/SA, supplement, attachment, IR, ticket-row, and dialog field matrices: exact name, type/unit, allowed values/range, required/optional/conditional status, activation condition, default, visibility, mutability, persistence source, and source-of-truth citation.
- [ ] Reconcile D40 category/scope rules; GBR-76–81 role/audience/lifecycle rules; SCR-64–69 UI fields; §7 payloads/errors/messages; §12.6 supplement states; and §12.7 VERIFY states. Record and resolve every mismatch rather than silently choosing one.
- [ ] Refresh `docs/api/openapi.json` documentation/catalogue with approved operations, schemas, error responses, idempotency/version headers/fields, security/authorization descriptions, and message/error identifiers. Do not claim routes are implemented solely because documentation is updated.
- [ ] Re-read the resulting API catalogue against the contract supplement and confirm each mutation, attachment read, and role-specific GET is represented exactly once.

**Exit evidence:** The field matrix and OpenAPI catalogue expose no UI-only persisted claim, no undocumented server field, and no supplement/IR authorization or conditional rule gap.

### Test preparation — inventory and manual scripts only

**Owner:** Test planner with Product/Security review of acceptance/security cases

**Precondition:** The approved contract supplement and refreshed field/API matrix exist.

**Deliverable / source-of-truth update:** A test-design inventory only. Do not create unit, integration, system, UI, or E2E test code in this WBS.

- [ ] List proposed **backend unit** seams: state-transition/authorization guards, D40 category-scope validation, category-role matrix validation, version/idempotency decision, supplement blocker rule, attachment-policy/authorization decision, and safe response projection. Name behavior and expected assertion, not implementation class names until the later implementation WBS fixes interfaces.
- [ ] List proposed **frontend unit** seams: payload adapters, field/conditional validation, `nextAction`/primary-CTA mapping, allowed-action visibility, safe response adapters, stale/field-error mapping, and no-sentinel/null handling. Name behavior and expected assertion only.
- [ ] Write **manual integration scripts** (not automated E2E) for: sign-in routes to the correct role home; ticket creation succeeds and opens owner detail; CS claim/processing; supplement issue/upload/scan/submit/review; VERIFY request/`NEED_MORE_INFO` clarification loop; resolution/acknowledgment/close. Specify preconditions, test data, steps, expected result, and standard 1180×820 and 1440×900 viewport observations where UI is checked.
- [ ] Write **manual system scripts** (not automated E2E) for end-to-end cross-session behavior: a newly registered/authorized account can later sign in where registration is in scope; an Owner-created ticket is visible only to that Owner and appropriate CS; an approved supplement/IR/resolution flow remains correctly accessible after a fresh sign-in; and revoked/reassigned users lose access. Only include registration behavior if its existing feature contract/environment supports it; do not invent FE-20 registration flows.
- [ ] Map every acceptance criterion and GBR-76–81 to either a future unit test candidate, a manual integration script, a manual system script, or a documented reason it needs a separate approved test scope.

**Exit evidence:** The inventory keeps the user-requested emphasis on focused frontend/backend unit behavior while clearly labeling integration and system coverage as manual scripts, not claims of automated coverage.

## Explicit handoff gate: permission to create implementation WBS

Create a separate FE-20 implementation WBS only when all are true:

- [ ] D-FE20-01 through D-FE20-06 are approved, dated, and linked from the source-of-truth decision record.
- [ ] The FE-20 §7 supplement-contract group has complete operations, payloads, responses, errors/message IDs, version/idempotency, scan/retention, and read/download authorization semantics.
- [ ] The category-to-role matrix and D40 scope mapping are reconciled across SRS/spec/OpenAPI/field matrix.
- [ ] The field-completeness audit is refreshed and shows each affected field’s end-to-end intended path; discrepancies are resolved or explicitly returned to Product/Security.
- [ ] The OpenAPI catalogue is refreshed as documentation and independently reviewed for one-to-one operation/schema/error coverage.
- [ ] Test preparation distinguishes focused automated unit candidates from manual integration/system scripts and does not overstate automation.
- [ ] Product/Security explicitly authorize the next phase.

Until every checkbox above is true, the only allowed next work is further decision/documentation reconciliation. No code or test implementation may be scheduled.

## Remaining blockers at WBS creation

1. D58 resolves Product direction, but D-FE20-02/03/04/06 retain Security and
   operational contract gaps; D-FE20-01 needs its mutation contract.
2. The supplement-contract boundary in §7 expressly lacks routes, payloads, storage/scan policy, and message catalogue pending those decisions.
3. Current implementation/OpenAPI differs from the target `VERIFY` text-first contract (§10.1), so a later implementation must be a coordinated contract/DTO/migration/API/frontend slice, not a UI-only change.
4. No existing approved supplement persistence/storage/scan integration exists (§10.1); no claim of implementation readiness is warranted.

## WBS self-review checklist

- [x] Scope is decision/documentation only; it contains no code, migration, endpoint, test-code, commit, or rollout step.
- [x] Each D-FE20 decision has a named owner, a smallest checkable sequence, a deliverable/source-of-truth update, and an exit-evidence condition.
- [x] The post-approval contract supplement explicitly covers operations, payloads, errors/message IDs, version/idempotency, scan/retention/auth, and state/notification behavior.
- [x] The WBS requires field-matrix and OpenAPI refresh before an implementation handoff.
- [x] Test preparation separates future unit-test candidates from manual integration/system scripts as requested.
- [x] No product answer, policy value, route, or implementation behavior is invented beyond the cited provisional target or approved D40/GBR rules.
