# Legal Bento Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị Điều khoản sử dụng và Chính sách dữ liệu dạng popup Bento có nội dung truy nguyên từ spec, giữ nguyên form đăng ký, đồng thời bắt buộc tài khoản Google chưa đồng ý hoàn tất consent trước khi dùng ứng dụng.

**Architecture:** Tách dữ liệu pháp lý có kiểu rõ ràng khỏi phần trình bày, tạo một tài liệu dùng chung và một dialog điều khiển bằng tab. `RegisterPage` chỉ quản lý tab đang mở; `LegalPage` tiếp tục phục vụ URL trực tiếp nhưng dùng cùng nội dung để tránh sai lệch.

**Tech Stack:** React 18, TypeScript, React Router, Tailwind CSS, shared `Modal`, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-legal-bento-dialog-design.md`

## Global Constraints

- Nội dung chỉ diễn giải quy tắc có trong `docs/requirements/SRS_2026-10-28.txt`, `docs/requirements/specs/` và `docs/REQUIREMENT_DECISIONS.md`.
- Không thay đổi payload đăng ký hiện có; chỉ bổ sung API consent độc lập theo Task 4.
- Không thêm migration hoặc `termsVersion`; dùng `termsAccepted`/`termsAcceptedAt` hiện có theo D49.
- Lệnh consent mới chỉ cập nhật `termsAccepted`/`termsAcceptedAt`; không được cập nhật `ownerRegistrationCompleted`, membership, vai trò hoặc trại.
- Popup phải giữ nguyên state của form đăng ký.
- Dùng component UI dùng chung; không thêm dependency.
- Không khẳng định các quyền/cam kết pháp lý mà spec không quy định.

## Review Focus

- Mở popup sau khi đã nhập form: dữ liệu và checkbox phải giữ nguyên sau khi đóng.
- Nhấn từng link phải mở đúng tab, không rơi về trang đăng nhập hoặc route khác.
- Popup dài trên màn hình thấp phải cuộn nội dung, còn header/footer và nút đóng vẫn dùng được.
- Escape, nút ×, nền phủ và “Đã hiểu” đều đóng; focus trở lại trigger.
- URL pháp lý trực tiếp vẫn render cùng nội dung, không có hai bản copy khác nhau.
- Tài khoản Google chưa consent chỉ gọi được nhóm API allowlist; email/password đã consent và Google đã consent không bị ảnh hưởng.

---

### Task 1: Nguồn nội dung pháp lý có kiểu

**Files:**
- Create: `frontend/src/features/authentication/domain/legalContent.ts`
- Test: `frontend/tests/unit/auth/legalContent.test.ts`

**Interfaces:**
- Produces: `LegalKind = 'terms' | 'policy'`, `LegalSection`, `LegalDocument`, `LEGAL_DOCUMENTS: Record<LegalKind, LegalDocument>`.
- Each document exposes `title`, `summary`, `cards`, `sections`, and `sources` for both dialog and route rendering.

- [ ] **Step 1: Write the failing content-contract test**

Assert literal required groups: Terms contains account, authentication security, session, farm authorization, service/account status and history; Policy contains account, farm/membership, cattle operations, payments/support, purpose/access/security, integrations and correction/history. Assert every section has at least one source label.

- [ ] **Step 2: Run test to verify RED**

Run: `./node_modules/.bin/vitest run tests/unit/auth/legalContent.test.ts`
Expected: FAIL because `legalContent.ts` does not exist.

- [ ] **Step 3: Implement the typed documents**

Translate only the source map approved in the design document. Keep prose plain Vietnamese and mark the footer as “Tóm tắt theo SRS 28/10/2026”; do not introduce unsourced legal guarantees.

- [ ] **Step 4: Run test to verify GREEN**

Run: `./node_modules/.bin/vitest run tests/unit/auth/legalContent.test.ts`
Expected: PASS.

### Task 2: Tài liệu Bento và popup dùng chung

**Files:**
- Create: `frontend/src/features/authentication/components/LegalDocument.tsx`
- Create: `frontend/src/features/authentication/components/LegalDialog.tsx`
- Modify: `frontend/src/features/authentication/pages/LegalPage.tsx`
- Test: `frontend/tests/unit/auth/LegalDialog.test.tsx`

**Interfaces:**
- Consumes: `LegalKind`, `LEGAL_DOCUMENTS` from Task 1 and shared `Modal`.
- Produces: `LegalDocument({ kind }: { kind: LegalKind })` and `LegalDialog({ initialKind, onClose, returnFocusRef }: LegalDialogProps)`.

- [ ] **Step 1: Write failing dialog behavior tests**

Test initial tab, tab switching, Bento cards, detailed sections, source footer, “Đã hiểu”, close button/Escape, and focus restoration. Include a constrained-height container assertion that the document body is the scroll region rather than the page.

- [ ] **Step 2: Run test to verify RED**

Run: `./node_modules/.bin/vitest run tests/unit/auth/LegalDialog.test.tsx`
Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement shared document and dialog**

Use `Modal` at width `820`, a fixed legal header/tab row, a responsive two-column Bento summary and detailed sections in the existing modal scroll body. Footer contains the source label and `ModalButton` “Đã hiểu”. Keep tab semantics (`role=tablist`, `aria-selected`, `tabpanel`) and restore focus on close.

- [ ] **Step 4: Reuse `LegalDocument` in `LegalPage`**

Keep direct legal routes working and replace the old three-item copy with the shared structured content. The page remains a fallback for bookmarks/direct URLs, not the registration interaction.

- [ ] **Step 5: Run test to verify GREEN**

Run: `./node_modules/.bin/vitest run tests/unit/auth/LegalDialog.test.tsx tests/unit/app/AppRoutes.test.tsx`
Expected: PASS.

### Task 3: Mở popup từ trang đăng ký và giữ state

**Files:**
- Modify: `frontend/src/features/authentication/pages/RegisterPage.tsx`
- Modify: `frontend/tests/unit/auth/GuestAuthFlow.test.tsx`

**Interfaces:**
- Consumes: `LegalDialog` and `LegalKind` from Tasks 1–2.
- `RegisterPage` stores `legalKind: LegalKind | null` and refs to the two trigger buttons.

- [ ] **Step 1: Extend the existing failing registration test**

Enter full name/email/password, toggle acceptance, open each legal trigger, assert the correct tab/document, close, and assert every entered value plus checkbox state is unchanged. Assert location remains `/dang-ky`.

- [ ] **Step 2: Run test to verify RED**

Run: `./node_modules/.bin/vitest run tests/unit/auth/GuestAuthFlow.test.tsx`
Expected: FAIL because links currently navigate away instead of opening a dialog.

- [ ] **Step 3: Replace navigation links with accessible dialog triggers**

Use button elements styled as inline links, open the matching `LegalKind`, render one `LegalDialog`, and return focus to the opening trigger after close. Do not mutate `termsAccepted` when opening or closing.

- [ ] **Step 4: Run focused tests**

Run: `./node_modules/.bin/vitest run tests/unit/auth`
Expected: all auth unit tests PASS.

- [ ] **Step 5: Run frontend verification**

Run: `npm run typecheck && npm run build && git diff --check`
Expected: exit 0; existing non-failing warnings are reported separately.

- [ ] **Step 6: Manual runtime check**

At `/dang-ky`, verify both triggers, tab switching, scrolling, close/focus and preserved form state at 1180×820 and 1440×900. Record that this is manual runtime evidence, not automated visual regression.

### Task 4: Lệnh consent độc lập và chặn API cho Google chưa đồng ý

**Files:**
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/GoogleIdentityService.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/security/GoogleOidcSuccessHandler.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/AuthenticateControllerIT.java`
- Modify: `docs/api/openapi.json` through `OpenApiContractTest`

**Interfaces:**
- Produces: `POST /api/account/terms-acceptance` with `{ "accepted": true }`; response `{ termsAccepted, termsAcceptedAt }`.
- `GoogleIdentityService.Result` also exposes `termsAccepted` for OAuth redirect.
- `ActiveAccountFilter` permits only `/api/csrf`, `/api/authenticate`, `/api/logout`, `/api/account/profile`, `/api/account/terms-acceptance`, and `/api/account/owner-registration` while a Google-linked account has not consented.

- [ ] **Step 1: Write failing HTTP tests**

Create a Google-linked active account with `termsAccepted=false`. Assert a normal authenticated API returns 403 `MSG-FE01-14`; profile and logout remain reachable; `accepted=false` is rejected; `accepted=true` persists the timestamp without setting Owner completion; replay keeps the original timestamp; normal API becomes reachable.

- [ ] **Step 2: Run test to verify RED**

Run from `backend`: `./mvnw --batch-mode '-Pdev,!webapp' -Dspotless.skip=true -Djacoco.skip=true -Dtest=AuthenticateControllerIT test`
Expected: FAIL because endpoint and filter behavior do not exist.

- [ ] **Step 3: Implement endpoint, scoped filter and OAuth redirect**

Add the independent transactional command, return the persisted fact, and add a consent branch after active-account validation without invalidating the session. Extend Google result and redirect to `/chap-nhan-dieu-khoan` before Owner/farm routing when false.

- [ ] **Step 4: Run backend tests and export OpenAPI**

Run the focused test, then `./mvnw --batch-mode '-Pdev,!webapp' -Dspotless.skip=true -Djacoco.skip=true -Dtest=OpenApiContractTest test` and copy `backend/target/beefcare-openapi.json` to `docs/api/openapi.json` only after PASS.

### Task 5: Frontend consent gate cho tài khoản Google

**Files:**
- Create: `frontend/src/features/authentication/pages/TermsAcceptancePage.tsx`
- Modify: `frontend/src/features/authentication/hooks/useAuthenticationUseCase.ts`
- Modify: `frontend/src/app/session/sessionTypes.ts`
- Modify: `frontend/src/app/session/sessionProfile.ts`
- Modify: `frontend/src/app/session/SessionProvider.tsx`
- Modify: `frontend/tests/unit/auth/sessionTermsAcceptance.test.tsx`
- Modify: `docs/REQUIREMENT_DECISIONS.md`
- Modify: `docs/requirements/specs/FE-01-xac-thuc-tai-khoan.md`

**Interfaces:**
- Consumes: legal popup/document from Tasks 1–2 and `POST /api/account/terms-acceptance` from Task 4.
- Produces: session fact `termsAccepted: boolean`, `acceptTerms(): Promise<unknown>`, and `TermsAcceptancePage({ onAccepted, onLogout })`.

- [ ] **Step 1: Write failing session-gate tests**

Assert a backend profile with `googleSignInLinked=true` and `termsAccepted=false` renders only the consent page; both legal documents open; unchecked submit stays blocked; accepted submit sends `{accepted:true}`, reloads/updates the profile and renders children. Assert password and already-consented profiles render children unchanged.

- [ ] **Step 2: Run test to verify RED**

Run: `./node_modules/.bin/vitest run tests/unit/auth/sessionTermsAcceptance.test.tsx`
Expected: FAIL because the session fact and gate do not exist.

- [ ] **Step 3: Implement consent page and session gate**

Use the BeefCare authentication shell, a concise Bento consent card and the shared `LegalDialog`. Keep logout available. Update session only after the backend succeeds; surface server failures without unlocking children.

- [ ] **Step 4: Update requirement decision and FE-01 spec**

Record the user-approved rule as D49: Google-linked accounts must consent before authenticated use, with a consent-only endpoint and no Owner side effect. Update UC-FE01-01, routing priority, screen fields and API notes without inventing broader legal guarantees.

- [ ] **Step 5: Run frontend verification**

Run: `./node_modules/.bin/vitest run --passWithNoTests tests/unit/auth && npm run typecheck && npm run build && git diff --check`
Expected: all tests and commands PASS; warnings reported separately.
