# Herd Data Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove voucher hardcodes and make Entry, Exit, Pen and Cattle flows operate on one tested localStorage-backed herd model.

**Architecture:** Extend the existing mock collection layer with a shared registry and seed enrichment. Put cross-feature cattle/pen mutations in one domain API, while pure model helpers own draft initialization and voucher payload construction.

**Tech Stack:** React 18, Vite 5, JavaScript ES modules, Node `node:test`, localStorage.

**Spec:** `docs/superpowers/specs/2026-10-27-herd-data-integration-design.md`

## Global Constraints

- No new dependency.
- Each feature worktree must build independently.
- Draft saves must not mutate cattle or pen occupancy.
- Posting/cancelling mutations must be idempotent.

## Review Focus

- Reopening a non-sale exit draft retains its type.
- Confirming the same voucher twice does not double-adjust pen counts.
- A disabled/full destination pen rejects a cattle move.
- Stored older rows gain new seed fields without losing user changes.
- Storage write failures reject the mutation.

---

### Task 1: Shared collection and herd domain foundation

**Files:**
- Modify: `frontend/src/api/client.js`
- Create: `frontend/src/api/herdDomainApi.js`
- Create: `frontend/src/data/pensData.js`
- Test: `frontend/src/api/client.test.js`
- Test: `frontend/src/api/herdDomainApi.test.js`

- [ ] Write failing tests for shared collection identity, seed enrichment, storage errors and cattle/pen transitions.
- [ ] Run `npm test` and confirm the intended failures.
- [ ] Implement the registry, canonical pen seed and domain mutations.
- [ ] Run `npm test && npm run build`.
- [ ] Commit on `frontend-foundation`.

### Task 2: Entry voucher lifecycle

**Files:**
- Modify: `frontend/src/api/herdEntryApi.js`
- Modify: `frontend/src/pages/ImportNew.jsx`
- Create: `frontend/src/api/herdEntryApi.test.js`

- [ ] Write failing tests for generated IDs, complete drafts and posted detail.
- [ ] Implement create/resume/post behavior and herd side effects.
- [ ] Run tests and build in `herd-entry-voucher`.
- [ ] Commit the entry repair.

### Task 3: Exit voucher lifecycle

**Files:**
- Modify: `frontend/src/api/herdExitApi.js`
- Modify: `frontend/src/pages/ExportNew.jsx`
- Modify: `frontend/src/pages/export/CancelModal.jsx`
- Create: `frontend/src/api/herdExitApi.test.js`

- [ ] Write failing tests for draft type restoration and confirm/cancel side effects.
- [ ] Implement the lifecycle through the shared herd domain API.
- [ ] Run tests and build in `herd-exit-voucher`.
- [ ] Commit the exit repair.

### Task 4: Pen and cattle integration

**Files:**
- Modify: `frontend/src/api/penApi.js`
- Modify: `frontend/src/data/penData.js`
- Modify: `frontend/src/api/cattleApi.js`
- Modify: `frontend/src/data/cowsData.js`
- Modify: `frontend/src/pages/cows/MoveModal.jsx`

- [ ] Add tests that reject inactive/full moves and ensure every displayed pen cattle link resolves.
- [ ] Switch both features to canonical `pens` and shared cattle records.
- [ ] Run tests and builds in both worktrees.
- [ ] Commit each feature repair on its corresponding branch.

### Task 5: Combined verification

- [ ] Build a temporary merged tree from the five branches.
- [ ] Run the full tests and production build.
- [ ] Smoke-test all nine routes at 1440px and 360px.
- [ ] Verify entry draft, exit draft, post, cancel, payment and pen/cattle synchronization after reload.
