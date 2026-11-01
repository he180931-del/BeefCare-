# Entry and Exit Backend Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the herd-entry and herd-exit frontend integration with the real backend, including resumable drafts, PDF/JPG attachments, and backend-validated Excel import.

**Architecture:** The Spring backend remains the source of truth for voucher state, validation, file metadata, and Excel parsing. The React feature adapters translate backend DTOs to the existing Vietnamese UI models; screens save a draft before uploading documents or importing Excel, then post or confirm the same versioned voucher.

**Tech Stack:** Spring Boot, JPA, Liquibase, React 18, TypeScript, Vite, Node test runner, Vitest.

**Spec:** `docs/superpowers/specs/BeefCare_FE_Chuong_Nhap_Xuat_Logic.md` and `docs/superpowers/specs/BeefCare_BE_REST_API.md`

## Global Constraints

- Preserve the current entry and exit routes and visual structure.
- Existing uncommitted user changes are in scope and must be preserved; do not reset, discard, or commit them.
- Entry drafts are manageable by Owner and Manager; exit drafts and attachment mutations are Owner-only, while Owner and Manager can read vouchers and attachments.
- PDF/JPEG attachments are at most 10 MiB each, validated from file content, mutable only while the voucher is DRAFT, and readable after post/confirm/void.
- Entry Excel import uses the backend template and backend validation, with at most 200 data rows and a 5 MiB file limit.
- Posting or confirming must happen only after draft persistence and successful attachment/Excel operations.
- Remove the voucher-level pricing-basis selector from both forms. Each cattle card/row owns its unit price; totals are derived only from those per-cattle values and the backend receives the compatible fixed basis required by its current contract.
- All new behavior follows test-first red-green-refactor and includes regression coverage for adapter payloads and lifecycle ordering.

## Review Focus

- Editing a draft must retain its immutable entry/exit type and backend version.
- A failed attachment upload or Excel import must leave the voucher as a recoverable draft and must not post/confirm it.
- Detail screens must download private attachments through authenticated fetch and a blob URL, not direct unauthenticated navigation.
- Excel preview and commit must use the same backend file and must not duplicate accepted lines.
- Local-data mode must continue to work without calling backend-only endpoints.
- Changing one cattle's unit price must update only that line and the derived voucher total; there is no external pricing mode that reinterprets all rows.

---

### Task 1: Voucher attachment API for entry and exit

**Files:**
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/domain/enumeration/AttachmentOwnerType.java`
- Create: `backend/src/main/java/vn/edu/fpt/beefcare/service/VoucherAttachmentService.java`
- Create: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/VoucherAttachmentResource.java`
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/VoucherAttachmentResourceTest.java`

**Interfaces:**
- Consumes: shared `AttachmentService`, `AttachmentStorage`, voucher repositories, and farm role actions.
- Produces: GET/POST `/entry-vouchers/{id}/attachments`, GET/DELETE `/entry-vouchers/{id}/attachments/{attachmentId}`, and the equivalent exit-voucher routes.

- [ ] Write failing integration tests for draft upload/list/download/remove, posted/confirmed read-only access, file content/type/size rejection, permissions, and farm isolation.
- [ ] Run the focused backend test and verify the missing routes fail.
- [ ] Implement shared voucher attachment ownership, validation, storage, and authenticated responses.
- [ ] Run the focused test and relevant attachment tests until green.

### Task 2: Frontend adapters and draft lifecycle

**Files:**
- Modify: `frontend/src/features/herd-entry/api/herdEntryBackendApi.ts`
- Modify: `frontend/src/features/herd-entry/api/herdEntryApi.ts`
- Modify: `frontend/src/features/herd-exit/api/herdExitBackendApi.ts`
- Modify: `frontend/src/features/herd-exit/api/herdExitApi.ts`
- Modify: `frontend/src/api/backendTransport.ts`
- Test: `frontend/tests/api/herdEntryBackendApi.test.ts`
- Test: `frontend/tests/api/herdExitBackendApi.test.ts`

**Interfaces:**
- Consumes: voucher CRUD/post/confirm, attachment routes, and the Excel import endpoints.
- Produces: version-safe save APIs that persist draft, run dependent file operations, then post/confirm; attachment download helpers; Excel preview/commit helpers.

- [ ] Write failing adapter tests for entry and exit draft restore/update, attachment ordering, authenticated blob reads, and entry Excel template/preview/commit.
- [ ] Run focused frontend API tests and verify expected failures.
- [ ] Implement the adapter methods and DTO mappings with no regression to local mode.
- [ ] Run focused API tests and typecheck until green.

### Task 3: Complete entry and exit screens

**Files:**
- Modify: `frontend/src/features/herd-entry/components/ExcelModal.tsx`
- Modify: `frontend/src/features/herd-entry/pages/ImportNew.tsx`
- Modify: `frontend/src/features/herd-entry/pages/ImportDetail.tsx`
- Modify: `frontend/src/features/herd-exit/pages/ExportNew.tsx`
- Modify: `frontend/src/features/herd-exit/pages/ExportDetail.tsx`
- Modify: `frontend/src/components/ui.tsx`
- Test: `frontend/tests/unit/herd-entry/ExcelModal.test.tsx`
- Create: `frontend/tests/unit/herd-entry/ImportDraftDocuments.test.tsx`
- Create: `frontend/tests/unit/herd-exit/ExportDraftDocuments.test.tsx`

**Interfaces:**
- Consumes: Task 2 adapter APIs.
- Produces: resumable drafts, private document view/remove, backend Excel validation, and post/confirm after dependent operations succeed.

- [ ] Write failing UI tests for restored drafts, immutable type after first save, PDF/JPG selection/removal, backend Excel preview/commit, and failure states that remain on the form.
- [ ] Write failing UI tests that both forms have no voucher-level pricing selector and derive totals from the unit price stored inside each cattle row/card.
- [ ] Run the focused Vitest files and verify failures.
- [ ] Wire both forms and details to the adapters while preserving layout and copy from the SRS.
- [ ] Run focused UI tests, full frontend tests, typecheck, and production build.

### Task 4: End-to-end verification

**Files:**
- Modify only if verification exposes a concrete integration defect.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: verified entry/exit contract with review evidence.

- [ ] Run relevant backend tests and the frontend full suite.
- [ ] Run frontend typecheck and production build.
- [ ] Review the complete working-tree diff for unrelated changes and stale local-only paths.
- [ ] Have an independent Sol reviewer inspect correctness, permissions, data mapping, tests, and SRS compliance; fix material findings and re-run affected checks.
