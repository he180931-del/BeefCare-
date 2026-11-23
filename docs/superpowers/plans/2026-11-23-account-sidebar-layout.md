# Account Sidebar Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the shared account pages a responsive left sidebar and make the personal-profile card wider and more spacious.

**Architecture:** Keep navigation ownership in `AccountShell` so both account routes share one responsive layout. Keep profile-specific spacing in `ProfileParts` and page-width spacing in `AccountPage`; do not change component props or account behavior.

**Tech Stack:** React 18, TypeScript, React Router 6, Tailwind CSS 4, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-account-sidebar-layout-design.md`

## Global Constraints

- Preserve `/tai-khoan` and `/quyen-theo-vai-tro` and their active states.
- Preserve `AccountShell` and `ProfileCard` public props.
- Desktop sidebar width is 220 px with the title `Tài khoản của tôi`; the area below the 73 px header is viewport-height, only the right column scrolls, and its 48 px top/bottom spacing belongs inside the scroll container. Narrow viewports use horizontal navigation with normal page scrolling.
- Do not change API calls, profile validation, submit behavior, or password behavior.
- Do not commit because the user did not request a commit and the worktree contains unrelated changes.

## Review Focus

- The account menu and “Về ứng dụng” link remain reachable in the header.
- Both routes highlight the correct navigation destination.
- Long Vietnamese navigation labels do not overflow the 220 px sidebar.
- The profile form uses available width without introducing horizontal overflow at 1180×820.
- The narrow layout keeps navigation above content and does not squeeze the form.

---

### Task 1: Responsive account sidebar and profile spacing

**Files:**
- Create: `frontend/tests/unit/account/AccountLayout.test.tsx`
- Modify: `frontend/src/features/account/components/AccountShell.tsx`
- Modify: `frontend/src/features/account/components/ProfileParts.tsx`
- Modify: `frontend/src/features/account/pages/AccountPage.tsx`

**Interfaces:**
- Consumes: `AccountShell({ active, children })` and `ProfileCard(...)` exactly as currently defined.
- Produces: the same interfaces with responsive layout classes only.

- [ ] **Step 1: Write failing component tests**

Render `AccountShell` in `MemoryRouter` and assert that its account navigation has desktop column/width classes and its content wrapper has a `220px + minmax(0,1fr)` desktop grid. Render `ProfileCard` with a representative profile and assert that its wrapper uses full available width and its identity/form/action sections expose the increased spacing classes.

- [ ] **Step 2: Run the account test and verify RED**

Run: `./node_modules/.bin/vitest run tests/unit/account/AccountLayout.test.tsx`

Expected: FAIL because the current shell uses header tabs and the profile card is capped at 760 px with compact gaps.

- [ ] **Step 3: Implement the responsive shell**

Move the account nav from the header into the main responsive grid in `AccountShell.tsx`. Use horizontal navigation below `md`; at `md` and above use a 220 px full-height sidebar, hide overflow on the viewport-height main region, and apply `overflow-y-auto` only to the right content column. Retain the active styling and existing header actions.

- [ ] **Step 4: Widen and space the profile content**

Remove the 760 px cap in `ProfileParts.tsx`, use the wider content column in `AccountPage.tsx`, and increase spacing between the identity row, form grid, and password action without changing any form wiring.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `./node_modules/.bin/vitest run tests/unit/account/AccountLayout.test.tsx`

Expected: PASS.

- [ ] **Step 6: Verify frontend contracts**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 7: Inspect runtime layout when available**

At `/tai-khoan`, inspect 1180×820 and 1440×900 with the same authenticated state. Confirm correct active item, no horizontal overflow, sidebar/content alignment, and visibly increased profile spacing. Record if runtime verification is blocked by authentication or services.
