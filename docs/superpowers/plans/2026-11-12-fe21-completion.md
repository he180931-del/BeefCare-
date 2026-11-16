# FE21 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện FE21 theo SRS 28/10 cho biên lai, khoản thu chi thủ công, snapshot báo cáo và XLSX bằng API/database thật.

**Architecture:** Giữ feature boundary hiện có. Backend là nguồn quyết định quyền, state, version, idempotency, bank claim, audit và snapshot; frontend chỉ map contract và trình bày trạng thái tiếng Việt. Mỗi lỗi được sửa bằng test RED→GREEN trước, sau đó kiểm chứng HTTP/PostgreSQL và UI.

**Tech Stack:** Spring Boot 3.5, Java 21 target chạy trên JDK 25, JPA/Liquibase/PostgreSQL, React 19/Vite/TypeScript, Vitest/Testing Library.

**Spec:** `docs/requirements/specs/FE-21-thu-chi-nen-tang.md`; kế hoạch test: `docs/testing/FE21_TEST_STRATEGY_AND_COVERAGE.md`.

## Global Constraints

- Nguồn chuẩn là SRS 28/10 theo D12; không dùng SRS 01/11.
- Chỉ PM ACTIVE được dùng FE21; backend phải từ chối role khác.
- Không dùng localStorage/mock làm nguồn nghiệp vụ ở backend mode.
- Vòng đời `DRAFT → POSTED → VOID`; DRAFT có thể discard.
- Command có `Idempotency-Key`; mutation có optimistic version.
- Ghi state, history, audit và claim trong cùng transaction.
- Snapshot bất biến, kỳ Asia/Ho_Chi_Minh tối đa 24 tháng; JOB-08 giữ 30 ngày theo SRS.
- Không sửa feature ngoài FE21/contract dùng trực tiếp bởi FE21.
- Không commit hoặc push nếu người dùng chưa yêu cầu.

## Review Focus

- Đổi bank source của một DRAFT từ evidence A sang B phải atomically giải phóng A và claim B, không vi phạm unique constraint.
- Hai PM hoặc hai record tranh cùng evidence/version phải chỉ có đúng một thao tác thành công.
- Snapshot phải giữ source reference và source version để export sau này không bị thay đổi theo nguồn.
- FE và BE phải thống nhất biên đúng 24 tháng, scope tổng, trạng thái discard và category label.
- XLSX phải là workbook mở được, đúng snapshot đang xem, đúng hai sheet kể cả báo cáo rỗng/Unicode.

---

### Task 1: Backend finance invariants

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/service/PlatformFinanceWorkflowTest.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformFinanceService.java`
- Modify only if persistence is required: FE21 domain/migration files.

**Interfaces:**
- Consumes: current `CreateRecord`, `VersionedRecord`, `VersionedAction`, `ReportLine`.
- Produces: atomic bank-source replacement, canonical audit action names, source-versioned report lines.

- [ ] Write failing service tests for bank A→B update, audit `FINANCE_RECORD_POSTED`/`FINANCE_RECORD_VOIDED`, and source version retained in S1 after source changes.
- [ ] Run focused backend test and confirm each new assertion fails for the intended current behavior.
- [ ] Implement the minimum transactional changes in `PlatformFinanceService` and DTO records.
- [ ] Run focused backend test to GREEN.
- [ ] Add/verify boundary tests for reason length, source eligibility and rollback without orphan claim/history/audit.

### Task 2: HTTP, concurrency and XLSX contract

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/PlatformFinanceResourceTest.java` or create a focused FE21 resource test.
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformFinanceResource.java`
- Modify: `docs/api/openapi.json` only through the documented generation workflow if runtime contract changes.

**Interfaces:**
- Consumes: Task 1 report lines and service actions.
- Produces: verified 201/4xx/410 behavior, two-session concurrency evidence, standards-compliant XLSX bytes.

- [ ] Write failing HTTP/XLSX tests: role matrix, missing/replayed key, stale version, true concurrent post/claim, workbook sheet/content/empty/Unicode/expired.
- [ ] Verify RED against current implementation.
- [ ] Implement only missing resource/export behavior; keep service authority in backend.
- [ ] Run focused resource + workflow tests to GREEN.
- [ ] Regenerate/check OpenAPI and confirm `/reports/latest`, status codes, schemas and XLSX MIME match runtime.

### Task 3: Frontend contract and rules

**Files:**
- Modify: `frontend/tests/unit/platform-finance/financeBackendApi.test.ts`
- Modify: `frontend/tests/unit/platform-finance/platformFinanceApi.test.ts`
- Modify: `frontend/src/features/platform-finance/types.ts`
- Modify: `frontend/src/features/platform-finance/api/financeBackendApi.ts`
- Modify: `frontend/src/features/platform-finance/domain/financeRules.ts`

**Interfaces:**
- Consumes: backend canonical scope/state/category/source-version contract.
- Produces: type-safe mapping and identical date boundary behavior.

- [ ] Write failing adapter/domain tests for backend `PLATFORM`, separate discarded state, source version and 24-month boundary dates.
- [ ] Verify RED.
- [ ] Update types/mappers/rules without adding client-side authority or business persistence.
- [ ] Run focused FE21 unit tests to GREEN.

### Task 4: FE21 screen completeness and Vietnamese UI

**Files:**
- Modify: `frontend/tests/unit/platform-finance/PlatformFinancePages.test.tsx`
- Modify only affected files under `frontend/src/features/platform-finance/pages/` and `components/`.

**Interfaces:**
- Consumes: Task 3 canonical frontend types.
- Produces: SCR-70..73 states and actions matching the spec.

- [ ] Write failing component tests for category labels, discarded-vs-void wording, loading/error/empty/expired, source version in detail, and required confirmations/toasts.
- [ ] Verify RED in backend data mode with transport stubs, not demo-store assumptions.
- [ ] Implement the minimum UI changes, keeping independent requests parallel and avoiding unnecessary React effects/state duplication.
- [ ] Run focused component tests to GREEN in both explicit local fixture mode and backend adapter mode.

### Task 5: Full verification and round-trip

**Files:**
- Update: `docs/testing/FE21_TEST_STRATEGY_AND_COVERAGE.md` with actual evidence only.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: reproducible completion evidence.

- [ ] Run frontend typecheck, build and complete test suite; report every unrelated failure.
- [ ] Run backend compile, focused FE21 test, full relevant suite and JaCoCo report using JDK 25.
- [ ] Start PostgreSQL/backend/frontend and execute create→edit→post→report→export→void→new snapshot with API/database readback.
- [ ] Manually verify SCR-70..73 at `1440×900` and `1180×820`, including role denial, console/network and overflow.
- [ ] Re-read all 24 TC-21 cases and record Pass/Fail/Blocked without claiming unexecuted coverage.
- [ ] Perform final diff review limited to FE21 and preserve unrelated user files.
