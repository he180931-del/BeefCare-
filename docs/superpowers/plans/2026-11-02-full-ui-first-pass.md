# BeefCare Full UI First-Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one coherent, reviewable visual first pass for all SCR-01 through SCR-122 while preserving the real backend behavior of the currently implemented cattle, pen, herd-entry, and herd-exit flows.

**Architecture:** A typed screen manifest maps every SRS screen to its role, route, owning feature, page/tab/dialog kind, archetype, and data mode. Shared BeefCare primitives and three role-aware shells render the common visual language; archetype renderers provide complete UI states for screens without backend coverage, while existing feature pages keep their real adapters and are visually converged without changing payloads or business rules.

**Tech Stack:** React 18, TypeScript 5.7, React Router 6, Tailwind CSS 4, Vitest, Testing Library, existing Vite build.

**Spec:** `docs/superpowers/specs/2026-11-02-full-ui-first-pass-design.md`

## Global Constraints

- The latest 122-screen inventory is `docs/requirements/SRS_2026-11-01_SEP490_G35_Report.txt`.
- Requirement decisions, SRS, OpenAPI/backend contracts, backend rules, and Figma apply in that order.
- Figma is wireframe evidence only; the refined herd-entry screen is the primary visual/UX quality precedent.
- Do not create the AI-dashboard look: no repeated decorative cards, oversized radii, gratuitous shadows, or meaningless stat tiles.
- Default radii are 6-8px; large overlays are at most 10-12px.
- Use `Be Vietnam Pro`, the existing BeefCare palette, compact 42-44px controls, and spacing values 4/8/12/16/24/32px.
- Existing cattle, pen, herd-entry, and herd-exit APIs, payloads, validation, navigation, and persistence must not change in this visual pass.
- Screens without backend coverage use typed in-session fixtures, display `Dữ liệu minh họa · chưa lưu`, and never claim persistence.
- Do not add a component, chart, state, icon, or UI framework dependency.
- Keep domain pages under `frontend/src/features/<feature>`; only truly shared primitives, shell, navigation, and manifest belong in shared/app folders.
- Preserve unrelated dirty files, especially current backend herd-exit changes.
- Do not commit or push unless the user separately authorizes it.

## Review Focus

1. A screen with no API must stay usable for review but visibly identify fixture data and reset on reload; pin in Tasks 4 and 5.
2. A user switching role must see only that role's navigation and allowed screens, with the correct landing route; pin in Tasks 3 and 5.
3. A missing/failed query must show an actionable loading, empty, or error state without collapsing the page shell; pin in Tasks 2, 6, and 10.
4. Long forms, tables, and dialogs must not cause page-level horizontal overflow or hide primary actions at 1440x900, 1180x820, or technician phone width; pin in Tasks 2, 8, and 12.
5. Existing backend-connected flows must issue the same API commands and preserve data after visual convergence; pin in Task 12 using existing contract and integration tests.

---

### Task 1: Complete screen delivery manifest

**Files:**
- Create: `frontend/src/app/screenManifest.ts`
- Create: `frontend/tests/unit/app/screenManifest.test.ts`
- Modify: `docs/superpowers/specs/2026-11-02-full-ui-first-pass-design.md`

**Interfaces:**
- Produces: `ScreenId`, `ScreenRole`, `ScreenKind`, `ScreenArchetype`, `ScreenDataMode`, `ScreenDefinition`, `SCREEN_MANIFEST`, `screenById(id)`, `screensForRole(role)`.
- `ScreenDefinition` fields: `id`, `feature`, `viTitle`, `roles`, `kind`, `archetype`, `route`, `dataMode`, optional `parentId`, optional `figmaRef`.

- [ ] **Step 1: Write the manifest completeness test**

  Assert that the manifest contains exactly 122 unique IDs from `SCR-01` to `SCR-122`, every item has a Vietnamese title, feature, at least one role, kind, archetype, route, and data mode, and every `parentId` resolves.

- [ ] **Step 2: Run the test and confirm RED**

  Run: `cd frontend && npx vitest run tests/unit/app/screenManifest.test.ts`

  Expected: FAIL because `screenManifest.ts` does not exist.

- [ ] **Step 3: Implement the typed manifest from the SRS screen list**

  Use role values `guest | owner | manager | technician | cs | pm | sa`; kinds `page | tab | dialog`; archetypes `public | list | detail | form | dashboard | report | catalogue | workbench | mobile`; data modes `backend | fixture | hybrid`.

- [ ] **Step 4: Add the screen delivery matrix to the design spec**

  Summarize the manifest fields and state that the TypeScript manifest is the executable delivery matrix; do not duplicate all 122 rows in Markdown.

- [ ] **Step 5: Run the focused test and typecheck**

  Run: `cd frontend && npx vitest run tests/unit/app/screenManifest.test.ts && npm run typecheck`

  Expected: PASS.

### Task 2: Consolidate BeefCare visual primitives

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/ui.tsx`
- Modify: `frontend/src/components/Modal.tsx`
- Create: `frontend/src/components/workspace.tsx`
- Create: `frontend/tests/unit/ui/WorkspacePrimitives.test.tsx`

**Interfaces:**
- Produces: `WorkSection`, `FilterBar`, `SummaryStrip`, `InlineMessage`, `EmptyState`, `LoadingState`, `StickyActions`, `FixtureNotice`.
- Existing exports from `ui.tsx` remain source-compatible.

- [ ] **Step 1: Write failing semantic and state tests**

  Test that `WorkSection` has no default decorative border/card class, `FixtureNotice` exposes `Dữ liệu minh họa · chưa lưu`, `StickyActions` renders warning content before its action group, and `EmptyState` exposes one named next action.

- [ ] **Step 2: Run the test and confirm RED**

  Run: `cd frontend && npx vitest run tests/unit/ui/WorkspacePrimitives.test.tsx`

- [ ] **Step 3: Normalize tokens and existing primitives**

  Change standard control/button radii to 6-8px, preserve status pills, keep overlay radius at 10-12px, remove decorative shadows, and retain semantic colors. Do not change component props used by existing features.

- [ ] **Step 4: Implement workspace primitives**

  Build the named exports with semantic HTML, visible focus, restrained dividers, and compact spacing. Make dialog bodies own overflow while modal actions remain visible.

- [ ] **Step 5: Run focused and existing shared-component consumers**

  Run: `cd frontend && npx vitest run tests/unit/ui/WorkspacePrimitives.test.tsx tests/unit/herd-entry/ImportNew.header.test.tsx tests/unit/pens/PenManagement.test.tsx`

  Expected: PASS.

### Task 3: Role-aware navigation and application shells

**Files:**
- Create: `frontend/src/app/navigation.ts`
- Modify: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/TechnicianLayout.tsx`
- Create: `frontend/src/components/PlatformLayout.tsx`
- Create: `frontend/tests/unit/app/RoleNavigation.test.tsx`

**Interfaces:**
- Consumes: `ScreenRole` and `SCREEN_MANIFEST` from Task 1.
- Produces: `navigationForRole(role)`, `landingRouteForRole(role)`, `FarmLayout`, `TechnicianLayout`, `PlatformLayout`.
- Preserve the default export compatibility of `Layout` for existing pages.

- [ ] **Step 1: Write role/navigation tests**

  Assert Owner sees Overview/Herd/Care/Administration/Farm groups; Manager omits Owner-only farm actions and gets read-only Exit; Technician gets Home/Cattle/Scan/Reproduction/Today's Rations/Announcements; CS, PM, and SA receive their SRS menus and correct landing routes.

- [ ] **Step 2: Run the test and confirm RED**

  Run: `cd frontend && npx vitest run tests/unit/app/RoleNavigation.test.tsx`

- [ ] **Step 3: Move navigation data out of `Layout.tsx`**

  Implement the menu and landing route registry without hardcoded farm data identifiers. Preserve current Owner and Manager appearance while reducing decorative rounded navigation shapes.

- [ ] **Step 4: Implement technician and platform shells**

  Technician uses compact header and bottom navigation; Platform uses the same visual tokens with platform-specific groups. All shells render loading/error content without disappearing.

- [ ] **Step 5: Run focused test and typecheck**

  Run: `cd frontend && npx vitest run tests/unit/app/RoleNavigation.test.tsx && npm run typecheck`

### Task 4: Development fixture session and review controls

**Files:**
- Create: `frontend/src/app/fixtureSession.tsx`
- Create: `frontend/src/app/fixtureData.ts`
- Create: `frontend/src/components/ScreenReviewBar.tsx`
- Create: `frontend/tests/unit/app/FixtureSession.test.tsx`

**Interfaces:**
- Produces: `FixtureSessionProvider`, `useFixtureSession()`, `FixtureAction`, `applyFixtureAction(state, action)`, `ScreenReviewBar`.
- Fixture state exists only in React memory and resets on reload; it must not touch local storage or backend APIs.

- [ ] **Step 1: Write fixture behavior tests**

  Test add/edit/status actions in memory, reload/provider remount reset, visible fixture notice, role switch, SCR jump, and state selector for loading/empty/error/read-only/success.

- [ ] **Step 2: Run the test and confirm RED**

  Run: `cd frontend && npx vitest run tests/unit/app/FixtureSession.test.tsx`

- [ ] **Step 3: Implement typed fixture state and actions**

  Keep realistic Vietnamese labels and domain values, but avoid backend-owned IDs being presented as canonical records.

- [ ] **Step 4: Implement the development-only review bar**

  Render only in Vite development mode. It must switch role, route to any SCR, and choose the review state without leaking into production output.

- [ ] **Step 5: Verify focused test and production exclusion**

  Run: `cd frontend && npx vitest run tests/unit/app/FixtureSession.test.tsx && npm run build`

  Expected: tests/build pass and production rendering does not show review controls.

### Task 5: Route registry and complete SCR reachability

**Files:**
- Create: `frontend/src/app/ScreenRouter.tsx`
- Create: `frontend/src/pages/ScreenPreviewPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Create: `frontend/tests/unit/app/ScreenReachability.test.tsx`

**Interfaces:**
- Consumes: manifest from Task 1, shells from Task 3, fixture provider from Task 4.
- Produces: `routeForScreen(screen, role)`, `ScreenRouter`, `ScreenPreviewPage`.
- Existing explicit routes for backend-connected screens take precedence over generated fixture routes.

- [ ] **Step 1: Write reachability and precedence tests**

  Iterate over all 122 definitions and assert each resolves to a page, tab owner, or dialog owner. Assert `/cattle`, `/pens`, `/herd-entry`, and `/herd-exit` still resolve to their existing lazy feature pages rather than the generic preview renderer.

- [ ] **Step 2: Run the test and confirm RED**

  Run: `cd frontend && npx vitest run tests/unit/app/ScreenReachability.test.tsx`

- [ ] **Step 3: Implement generated review routes**

  Use stable `/ui/<scr-id-lowercase>` review routes for dialog/tab ownership and production-like Vietnamese routes for top-level pages. Preserve existing URLs.

- [ ] **Step 4: Replace the catch-all placeholder with an actionable not-found state**

  Show the role home action and keep the correct shell instead of an empty page.

- [ ] **Step 5: Run focused test and typecheck**

  Run: `cd frontend && npx vitest run tests/unit/app/ScreenReachability.test.tsx && npm run typecheck`

### Task 6: Public, authentication, onboarding, and account surfaces

**Files:**
- Create: `frontend/src/features/account/pages/AccountScreens.tsx`
- Create: `frontend/src/features/account/components/AccountForm.tsx`
- Create: `frontend/src/features/account/data/accountFixtures.ts`
- Create: `frontend/tests/unit/account/AccountScreens.test.tsx`

**Interfaces:**
- Produces: `AccountScreen({ screen, state })` covering SCR-01 through SCR-21 where owned by account/onboarding/membership/platform-access flows.
- Consumes shared primitives and fixture actions only; existing authentication provider stays unchanged.

- [ ] **Step 1: Write screen-content/state tests**

  Assert exact Vietnamese titles, required fields, primary actions, no vague error copy, suspended/expired/invitation states, and fixture notice on unsupported actions.

- [ ] **Step 2: Run RED, implement screens, run GREEN**

  Run: `cd frontend && npx vitest run tests/unit/account/AccountScreens.test.tsx`

- [ ] **Step 3: Verify responsive structure**

  Assert public/auth forms have one readable column; membership and platform account lists use the list archetype and do not wrap each row in a card.

### Task 7: Operational list and worklist surfaces

**Files:**
- Create: `frontend/src/features/operations/pages/OperationalScreens.tsx`
- Create: `frontend/src/features/operations/data/operationalFixtures.ts`
- Create: `frontend/tests/unit/operations/OperationalScreens.test.tsx`

**Interfaces:**
- Produces: `OperationalScreen({ screen, state })` for farm announcements, growth, vaccination, health, reproduction, reminders, catalogue lists, feed lists, entry/exit fixture variants, and related SCR list screens.
- Existing cattle/pen/entry/exit top-level pages remain real pages.

- [ ] **Step 1: Write table/worklist tests**

  Assert heading/action alignment, single filter toolbar, table-level empty/error states, role-specific action visibility, and precise Vietnamese status labels.

- [ ] **Step 2: Run RED and implement list/worklist renderer**

  Run: `cd frontend && npx vitest run tests/unit/operations/OperationalScreens.test.tsx`

- [ ] **Step 3: Add domain-specific column/config definitions**

  Keep repeated list mechanics shared while storing columns, labels, filters, and actions in domain-local definitions rather than one universal table schema.

- [ ] **Step 4: Run GREEN and typecheck**

  Run: `cd frontend && npx vitest run tests/unit/operations/OperationalScreens.test.tsx && npm run typecheck`

### Task 8: Record detail, profile, timeline, and history surfaces

**Files:**
- Create: `frontend/src/features/records/pages/RecordScreens.tsx`
- Create: `frontend/src/features/records/components/RecordHeader.tsx`
- Create: `frontend/src/features/records/components/RecordTimeline.tsx`
- Create: `frontend/tests/unit/records/RecordScreens.test.tsx`

**Interfaces:**
- Produces: `RecordScreen({ screen, state })`, `RecordHeader`, `RecordTimeline` for cattle profile tabs, voucher details, ticket details, payment details, and audit detail ownership.

- [ ] **Step 1: Write profile/tab/history tests**

  Assert compact identity header, tab ownership, parent/care/status visibility, timeline ordering, read-only variants, and one persistent side summary at most.

- [ ] **Step 2: Run RED and implement record archetypes**

  Run: `cd frontend && npx vitest run tests/unit/records/RecordScreens.test.tsx`

- [ ] **Step 3: Pin long-content behavior**

  Test that timelines, histories, and detail tables own their scrolling and do not create a second nested card for every event.

- [ ] **Step 4: Run GREEN and typecheck**

  Run: `cd frontend && npx vitest run tests/unit/records/RecordScreens.test.tsx && npm run typecheck`

### Task 9: Forms, voucher editors, and recording overlays

**Files:**
- Create: `frontend/src/features/forms/pages/FormScreens.tsx`
- Create: `frontend/src/features/forms/components/ConditionalField.tsx`
- Create: `frontend/src/features/forms/components/FormOverlay.tsx`
- Create: `frontend/tests/unit/forms/FormScreens.test.tsx`

**Interfaces:**
- Produces: `FormScreen({ screen, state })`, `ConditionalField`, `FormOverlay` for all fixture-backed editors and record dialogs.

- [ ] **Step 1: Write conditional/error/footer tests**

  Assert conditionally required fields appear beside their controller, missing required fields name the exact field after submit, long overlay bodies scroll internally, and warnings/actions share one compact footer row.

- [ ] **Step 2: Run RED and implement form archetypes**

  Run: `cd frontend && npx vitest run tests/unit/forms/FormScreens.test.tsx`

- [ ] **Step 3: Add per-screen field definitions from the SRS**

  Keep each field definition in its owning domain section and include label, type, requiredness, condition, hint, and fixture default. Do not claim backend persistence.

- [ ] **Step 4: Run GREEN and typecheck**

  Run: `cd frontend && npx vitest run tests/unit/forms/FormScreens.test.tsx && npm run typecheck`

### Task 10: Dashboard, reports, catalogue, configuration, support, finance, and audit workbenches

**Files:**
- Create: `frontend/src/features/insights/pages/InsightScreens.tsx`
- Create: `frontend/src/features/platform/pages/PlatformScreens.tsx`
- Create: `frontend/src/features/platform/data/platformFixtures.ts`
- Create: `frontend/tests/unit/insights/InsightScreens.test.tsx`
- Create: `frontend/tests/unit/platform/PlatformScreens.test.tsx`

**Interfaces:**
- Produces: `InsightScreen({ screen, state })` and `PlatformScreen({ screen, state })` for SCR-73 through SCR-103 and feed/report screens where applicable.

- [ ] **Step 1: Write dashboard/report/workbench tests**

  Assert one compact summary band, primary table or chart-equivalent content, filters with labeled periods, accessible textual totals, empty/error guidance, and role-specific actions.

- [ ] **Step 2: Run RED and implement insight screens without a chart dependency**

  Run: `cd frontend && npx vitest run tests/unit/insights/InsightScreens.test.tsx tests/unit/platform/PlatformScreens.test.tsx`

- [ ] **Step 3: Implement support, reconciliation, finance, and audit workbenches**

  Preserve the shared BeefCare visual language; do not use a separate admin template.

- [ ] **Step 4: Run GREEN and typecheck**

  Run: `cd frontend && npx vitest run tests/unit/insights/InsightScreens.test.tsx tests/unit/platform/PlatformScreens.test.tsx && npm run typecheck`

### Task 11: Technician phone surfaces

**Files:**
- Create: `frontend/src/features/technician/pages/TechnicianScreens.tsx`
- Create: `frontend/src/features/technician/data/technicianFixtures.ts`
- Create: `frontend/tests/unit/technician/TechnicianScreens.test.tsx`

**Interfaces:**
- Produces: `TechnicianScreen({ screen, state })` for SCR-104, SCR-122, scan, cattle, reproduction, announcements, reminders, and read-only care views.

- [ ] **Step 1: Write mobile navigation and action tests**

  Assert bottom navigation labels, one-hand primary action placement, read-only restrictions, scan entry point, and compact stacked list behavior.

- [ ] **Step 2: Run RED and implement technician screens**

  Run: `cd frontend && npx vitest run tests/unit/technician/TechnicianScreens.test.tsx`

- [ ] **Step 3: Run GREEN and typecheck**

  Run: `cd frontend && npx vitest run tests/unit/technician/TechnicianScreens.test.tsx && npm run typecheck`

### Task 12: Converge existing backend-connected screens without changing contracts

**Files:**
- Modify: `frontend/src/features/cattle/pages/CowList.tsx`
- Modify: `frontend/src/features/cattle/pages/CowProfile.tsx`
- Modify: `frontend/src/features/cattle/components/*.tsx` only where visual convergence requires it
- Modify: `frontend/src/features/pen-management/pages/BarnList.tsx`
- Modify: `frontend/src/features/pen-management/components/*.tsx` only where visual convergence requires it
- Modify: `frontend/src/features/herd-entry/pages/*.tsx`
- Modify: `frontend/src/features/herd-entry/components/*.tsx` only where visual convergence requires it
- Modify: `frontend/src/features/herd-exit/pages/*.tsx`
- Modify: `frontend/src/features/herd-exit/components/*.tsx` only where visual convergence requires it
- Test: existing tests under `frontend/tests/unit/{cattle,pens,herd-entry,herd-exit}` and API/integration contract tests

**Interfaces:**
- Consumes shared primitives from Task 2 and shells from Task 3.
- Produces no API or domain interface changes.

- [ ] **Step 1: Record the existing contract test baseline**

  Run the existing focused unit/API tests for the four real features and save the pass/fail output before visual edits.

- [ ] **Step 2: Replace decorative cards with work sections and flat tables**

  Keep every field, callback, query, mutation, payload adapter, response adapter, validation rule, and route behavior unchanged.

- [ ] **Step 3: Normalize controls, modals, and sticky action footers**

  Use the entry-screen precedent: aligned grids, compact controls, internal modal scrolling, warnings beside actions, and no oversized footer padding.

- [ ] **Step 4: Run all focused real-feature tests**

  Run: `cd frontend && npx vitest run tests/unit/cattle tests/unit/pens tests/unit/herd-entry tests/unit/herd-exit && npm run test:api && npm run test:integration:ui`

  Expected: no behavioral regression.

- [ ] **Step 5: Run typecheck and build**

  Run: `cd frontend && npm run typecheck && npm run build`

### Task 13: Full visual consistency and runtime evidence

**Files:**
- Modify: `frontend/src/app/screenManifest.ts` only to correct evidence-backed gaps
- Modify: `docs/superpowers/specs/2026-11-02-full-ui-first-pass-design.md`
- Create: `docs/testing/FULL_UI_FIRST_PASS_CHECKLIST.md`

**Interfaces:**
- Consumes all earlier tasks.
- Produces a review checklist mapping all 122 screens to route/owner/archetype/data mode and manual evidence status.

- [ ] **Step 1: Run all frontend unit/API/integration tests**

  Run: `cd frontend && npm test`

- [ ] **Step 2: Run typecheck and production build**

  Run: `cd frontend && npm run typecheck && npm run build`

- [ ] **Step 3: Review representative screens at standard viewports**

  Manually verify at least one screen per archetype and each role at 1440x900, 1180x820, and technician 390x844. Record route, role, state, horizontal/vertical overflow, visible actions, console, and failed requests.

- [ ] **Step 4: Complete the 122-screen checklist**

  Mark each screen reachable, visually reviewed or pending review, backend/fixture/hybrid, and page/tab/dialog owner. Do not call fixture screens functionally complete.

- [ ] **Step 5: Self-critique and remove one unnecessary visual boundary per archetype where found**

  Compare against the refined herd-entry baseline and remove any repeated decorative cards, excessive radius, redundant title, or empty padding found during runtime review.

## Self-review result

- **Spec coverage:** Tasks 1 and 5 cover all SCR IDs and reachability; Tasks 6-11 cover every archetype/role; Task 12 protects real backend flows; Task 13 provides runtime and inventory evidence.
- **Boundary:** Shared primitives and shells are centralized, but every domain screen remains feature-owned. Existing API adapters are outside the visual-change contract.
- **Type consistency:** `ScreenDefinition` and the role/archetype/data-mode unions are defined once in Task 1 and consumed by Tasks 3-11.
- **Known limitation:** A visually complete fixture screen is not a functionally complete backend feature; the fixture notice and final checklist make that distinction explicit.
- **Preservation:** No task modifies backend files or the current dirty backend herd-exit work.
