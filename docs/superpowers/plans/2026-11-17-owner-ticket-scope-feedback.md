# Owner ticket category/scope enforcement implementation plan

> Execute in this session with `superpowers:executing-plans` and strict RED-GREEN TDD.

**Goal:** Make Owner support-ticket categories select and enforce the correct farm scope in both the frontend and backend.

**Architecture:** Keep the category/scope policy explicit at both trust boundaries. The frontend domain validator owns user-facing validation and the form derives disabled/automatic scope choices from the same helpers. The backend command service repeats the policy as authoritative validation before persistence.

**Tech stack:** React 19, TypeScript, Vitest, Testing Library, Spring Boot, Java 25, JUnit 5, AssertJ.

**Spec:** `docs/superpowers/specs/2026-11-17-owner-ticket-scope-feedback-design.md`

## Global constraints

- Preserve all existing user changes and untracked files.
- Do not commit or push; the user has not requested either action for this change.
- `ACCOUNT_ACCESS` is account-only; `PAYMENT` and `FARM_SERVICE` are farm-only; `SYSTEM_USAGE` and `OTHER` permit both scopes.
- Validation must exist in frontend and backend; disabled controls alone are insufficient.

## Review focus

- Category changes must not leave a stale invalid scope or `farmId` in the submitted payload.
- Farm-only categories must reject account scope through direct API calls.
- Account-only categories must reject farm scope through direct API calls.
- Optional-scope categories must continue to work for both account and farm tickets.
- Existing generic scope, farm ownership, and visible backend error handling must remain intact.

### Task 1: Frontend category/scope contract

**Files:**
- Modify: `frontend/tests/unit/support/supportRules.test.ts`
- Modify: `frontend/tests/unit/support/NewTicketForm.test.tsx`
- Modify: `frontend/src/features/support/domain/ticketRules.ts`
- Modify: `frontend/src/features/support/components/NewTicketForm.tsx`

1. Add tests that prove `PAYMENT`/`FARM_SERVICE` reject account scope, `ACCOUNT_ACCESS` rejects farm scope, and optional categories permit both.
2. Run the focused tests and confirm RED because the policy does not yet exist.
3. Add category policy helpers and enforce them in `validateCreate`.
4. Make category selection force the required scope, disable the invalid segmented option, clear stale `farmId` for account-only tickets, and show the farm-required explanation.
5. Re-run the focused tests and the complete support unit suite; expect GREEN.

### Task 2: Backend category/scope enforcement

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/service/SupportTicketWorkflowTest.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/SupportTicketCommandService.java`

1. Add integration assertions for all three forbidden category/scope combinations and retained optional-scope behavior.
2. Run `SupportTicketWorkflowTest` and confirm RED because the backend currently validates scope independently of category.
3. Enforce the category/scope matrix before the existing farm ownership validation.
4. Re-run `SupportTicketWorkflowTest`; expect GREEN.

### Task 3: Contract documentation and end-to-end verification

**Files:**
- Modify: `docs/REQUIREMENT_DECISIONS.md`
- Inspect/update if generated contract changes: `docs/api/openapi.json`, `docs/api-handoff.html`

1. Record D40 as the product decision resolving FE-20's category/scope ambiguity.
2. Confirm the OpenAPI request shape remains compatible and document conditional semantics where the current contract supports it.
3. Run frontend typecheck/build and backend focused tests.
4. Manually verify `/ho-tro/moi`: Payment and Farm service force farm scope with an explanation; Account access forces account scope; System usage and Other allow both; submitting a farm-scoped ticket without a farm shows the inline error.
