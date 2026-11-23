# Account Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone account pages with one authenticated, reusable account dialog that opens over the current page without changing its URL.

**Architecture:** Add an account-dialog context inside `SessionProvider`, let every `AccountMenu` open it, and render one responsive dialog containing the existing profile and role-permission panels. Remove the page shell and standalone page routes after their business logic has moved into panel components.

**Tech Stack:** React 18, React Router 6, TypeScript, Tailwind CSS, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-11-23-account-popup-design.md`

## Global Constraints

- The dialog is mounted only after authentication and session loading.
- Opening or switching account sections must not change `location.pathname`.
- Desktop keeps a fixed 220 px sidebar and scrolls only the right content column.
- Mobile uses horizontal section tabs and a vertically scrollable dialog body.
- Existing profile, password, Google reauthentication and permission behavior must remain unchanged.
- No new dependency is allowed.

## Review Focus

- Opening from Select Farm must preserve `/chon-trai` and its state.
- Escape from the nested password dialog must not also close the account dialog.
- Loading and API-error states must remain inside the dialog instead of replacing the underlying page.
- Switching sections after editing an unsaved profile must not silently submit it.
- Small viewports must keep the close button and both tabs reachable without horizontal page overflow.

---

### Task 1: Shared account-dialog controller

**Files:**
- Create: `frontend/src/features/account/components/AccountDialogContext.tsx`
- Modify: `frontend/src/app/providers/AppProviders.tsx`
- Move: `frontend/src/app/components/AccountMenu.tsx` → `frontend/src/features/account/components/AccountMenu.tsx`
- Test: `frontend/tests/unit/account/AccountDialog.test.tsx`

**Interfaces:**
- Produces: `AccountDialogProvider({ children }: { children: ReactNode })` and `useAccountDialog(): { openAccountDialog(tab?: AccountDialogTab): void; closeAccountDialog(): void }`.
- Produces: `AccountDialogTab = 'profile' | 'permissions'`.

- [x] **Step 1: Write failing tests for opening from `AccountMenu`, preserving the current path, closing with `×`, backdrop and Escape, and refusing to render outside a loaded session.**
- [x] **Step 2: Run `./node_modules/.bin/vitest run tests/unit/account/AccountDialog.test.tsx` and confirm the new expectations fail.**
- [x] **Step 3: Implement the context/provider, mount it inside `SessionProvider`, and change the account menu item from a route link to `openAccountDialog('profile')`.**
- [x] **Step 4: Run the focused test and confirm it passes.**

### Task 2: Move page content into the responsive dialog

**Files:**
- Create: `frontend/src/features/account/components/AccountDialog.tsx`
- Create: `frontend/src/features/account/components/AccountProfilePanel.tsx`
- Create: `frontend/src/features/account/components/RolePermissionsPanel.tsx`
- Modify: `frontend/src/features/account/components/ProfileParts.tsx`
- Test: `frontend/tests/unit/account/AccountDialog.test.tsx`
- Test: `frontend/tests/unit/account/AccountPages.test.tsx`

**Interfaces:**
- Consumes: `AccountDialogTab`, `closeAccountDialog()` from Task 1.
- Produces: `AccountDialog({ active, onTabChange, onClose }: AccountDialogProps)`.
- Produces: `AccountProfilePanel()` and `RolePermissionsPanel()` with no page-shell dependency.

- [x] **Step 1: Add failing tests for the two internal sections, 220 px fixed desktop sidebar, right-only scrolling, mobile horizontal tabs, profile save/error states, role switching and nested password-dialog Escape behavior.**
- [x] **Step 2: Run the account tests and confirm the layout/content expectations fail.**
- [x] **Step 3: Extract the existing page business logic into the two panels and implement the account dialog with a shared Cài đặt header and a z-index below `ChangePasswordDialog`.**
- [x] **Step 4: Run `./node_modules/.bin/vitest run tests/unit/account` and confirm all account tests pass.**

### Task 3: Remove standalone account pages and retain safe redirects

**Files:**
- Delete: `frontend/src/features/account/components/AccountShell.tsx`
- Delete: `frontend/src/features/account/pages/AccountPage.tsx`
- Delete: `frontend/src/features/account/pages/RolePermissionsPage.tsx`
- Modify: `frontend/src/features/account/routes.ts`
- Modify: `frontend/src/app/routes/AppRoutes.tsx`
- Test: `frontend/tests/unit/app/AppRoutes.test.tsx`

**Interfaces:**
- Consumes: the dialog opened by `AccountMenu`; no route renders account content.
- Produces: legacy `/tai-khoan`, `/quyen-theo-vai-tro`, `/ho-so`, `/kt/tai-khoan`, and `/nen-tang/ho-so` redirects that never create a second account UI.

- [x] **Step 1: Change route tests to require redirects instead of standalone account headings.**
- [x] **Step 2: Run the route tests and confirm they fail against the existing pages.**
- [x] **Step 3: Remove the page loaders/pages/shell and register redirects to the authenticated home flow.**
- [x] **Step 4: Run `./node_modules/.bin/vitest run tests/unit/app tests/unit/account` and confirm all tests pass.**

### Task 4: Regression verification

**Files:**
- Modify only if a verification failure proves a regression in the scoped implementation.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: verified account popup behavior with no standalone account page.

- [x] **Step 1: Run `./node_modules/.bin/vitest run --passWithNoTests tests/unit/account tests/unit/app tests/unit/auth tests/unit/farm-workspace tests/unit/shared`.**
- [x] **Step 2: Run `npm run typecheck`.**
- [x] **Step 3: Run `npm run build`.**
- [x] **Step 4: Run `git diff --check` and `gitnexus detect-changes --scope unstaged`; review every affected flow.**
- [x] **Step 5: Manually verify the same popup from `/chon-trai` and one farm page at desktop and mobile widths, recording that this is runtime evidence rather than automated visual regression.**
