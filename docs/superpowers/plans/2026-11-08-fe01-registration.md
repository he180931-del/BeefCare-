# FE01 Authentication and Account Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện UC-FE01-01 đến UC-FE01-06 để toàn bộ xác thực và truy cập tài khoản BeefCare hoạt động đúng spec trên frontend, backend, SMTP và session.

**Architecture:** Giữ Spring Security session, Google OAuth2/OIDC và transactional mail outbox hiện có. Bổ sung dữ liệu đăng ký còn thiếu vào `app_user`, làm các endpoint đăng ký trả hợp đồng rõ ràng, điều hướng mọi kết quả OAuth/xác minh về frontend, và để frontend dùng một hàm duy nhất tạo URL OAuth tới backend. Mỗi lát cắt được làm test-first từ backend contract đến giao diện.

**Tech Stack:** Java 21, Spring Boot/Security OAuth2 Client, Liquibase, PostgreSQL/H2, React 19, TypeScript, React Router, Vite, Vitest/Testing Library.

**Spec:** `docs/requirements/specs/FE-01-xac-thuc-tai-khoan.md` — toàn bộ UC-FE01-01 → UC-FE01-06, R-01-01 → R-01-15, A1 → A15 và TC-01-01 → TC-01-49.

## Global Constraints

- Email được trim, lowercase, tối đa 254 ký tự và duy nhất không phân biệt hoa thường.
- Mật khẩu dài 8–128 ký tự, khác email, chỉ lưu hash có salt và không xuất hiện trong response/log.
- Link xác minh hiệu lực 24 giờ, dùng một lần; link mới vô hiệu link cũ; tối đa 5 email/giờ và gửi lại có cooldown 60 giây.
- Google phải dùng OAuth 2.0/OpenID Connect thật; chỉ nhận email có claim `email_verified=true`; một subject không bao giờ gắn sang tài khoản khác.
- Tài khoản Google mới ACTIVE ngay; tài khoản email chỉ kích hoạt phương thức mật khẩu sau khi xác minh.
- Hoàn tất Owner cần họ tên hợp lệ và đồng ý điều khoản; không tự tạo trại, membership, role platform hay subscription.
- Local dùng Mailpit; production dùng Gmail SMTP bằng App Password qua biến môi trường, không lưu bí mật vào repository.
- Không thay đổi hành vi của UC-FE01-02 → UC-FE01-06 ngoài phần giao nhau bắt buộc với đăng ký và session sau xác minh/OAuth.

## Review Focus

- Hai request đăng ký đồng thời cùng email chỉ tạo một tài khoản và phản hồi còn lại bằng MSG-FE01-10 — Task 2 integration test.
- Google subject đã liên kết nhưng claim email thay đổi không được tạo hoặc chiếm tài khoản khác — Task 4 service test.
- Link xác minh hết hạn/đã dùng/malformed luôn về cùng trạng thái frontend, không lộ stack trace hoặc JSON thô — Task 3 web test.
- Reload SCR-04 không được vượt cooldown gửi lại 60 giây do server quyết định `nextAllowedAt` — Task 3 backend và frontend test.
- Lỗi ghi outbox cùng transaction không để lại `jhi_user`, `app_user`, token hoặc email job dở dang — Task 2 integration test.

---

### Task 1: Persist registration and sign-in-method state

**Files:**
- Create: `backend/src/main/resources/config/liquibase/changelog/20261108000100_fe01_registration_state.xml`
- Modify: `backend/src/main/resources/config/liquibase/master.xml`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/domain/AppUser.java`
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/service/IdentityServiceIT.java`
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/service/GoogleIdentityServiceTest.java`

**Interfaces:**
- Produces AppUser fields `termsAccepted`, `termsAcceptedAt`, `passwordMethodStatus`, `passwordLinkedAt`, `passwordLastUsedAt`, `googleLinkedAt`, `googleLastUsedAt`.
- `passwordMethodStatus` is `PENDING_VERIFICATION`, `ACTIVE`, or null for no password method.

- [ ] Write persistence tests proving email registration stores pending password and terms timestamps, while Google registration stores Google link/use timestamps and no password method.
- [ ] Run the focused backend tests and confirm they fail because the fields do not exist.
- [ ] Add the Liquibase columns, safe backfill for existing rows, constraints/indexes needed by the fields, and the matching AppUser mappings.
- [ ] Run the focused tests and schema validation until green.
- [ ] Commit the migration, entity and tests.

### Task 2: Make email registration atomic and contract-complete

**Files:**
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/repository/AppUserRepository.java` if a locking/existence query is required.
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/service/IdentityServiceIT.java`

**Interfaces:**
- `POST /api/register` consumes SCR-03 fields and returns `201 { "email": "normalized@example.com" }`.
- Registration persists `passwordMethodStatus=PENDING_VERIFICATION`; activation changes it to `ACTIVE`.

- [ ] Add failing tests for normalized response email, all field/message rules, case-insensitive duplicate, concurrent duplicate protection, hashed password, pending state and transactional rollback when token/outbox persistence fails.
- [ ] Run the focused tests and verify the expected failures.
- [ ] Change `IdentityService.register(...)` to return the normalized email, persist the new state, and translate database uniqueness races to MSG-FE01-10 without leaking internals.
- [ ] Change `AccountResource.registerAccount(...)` to return the A1 response record with validation annotations/OpenAPI schema.
- [ ] Run the focused backend suite until green.
- [ ] Commit the email-registration slice.

### Task 3: Complete verification link, resend cooldown and invalid-link UX contract

**Files:**
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/email/EmailDeliveryJobService.java`
- Modify: `frontend/src/features/authentication/types.ts`
- Modify: `frontend/src/features/authentication/client.ts`
- Modify: `frontend/src/features/authentication/pages/EmailSentPage.tsx`
- Modify: `frontend/src/features/authentication/pages/RecoveryPages.tsx`
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Test: `frontend/tests/unit/auth/GuestAuthFlow.test.tsx`
- Test: `frontend/tests/api/authApiContract.test.ts`

**Interfaces:**
- `POST /api/account/verification/resend` returns `{nextAllowedAt}` without revealing whether an account exists.
- `GET /api/activate?token=...` redirects success to `/owner-registration`; every invalid token redirects to `/lien-ket-khong-con-hieu-luc?type=verification`.

- [ ] Add failing backend tests for 24-hour/single-use/invalidate-old-link rules, server-enforced 60-second cooldown, five-per-hour limit, success session creation and invalid-link redirect.
- [ ] Add failing frontend tests showing the server timestamp drives the resend button and the invalid verification screen can request a new link.
- [ ] Implement the resend result and server cooldown without changing the privacy-preserving response for unknown email.
- [ ] Catch only the known invalid-link domain failure at the activation browser boundary and redirect it to the frontend state page; preserve unexpected failures as server errors.
- [ ] Update frontend types/client/pages to consume `nextAllowedAt` and render the SCR-04/E4 states.
- [ ] Run focused backend and frontend tests until green.
- [ ] Commit the verification slice.

### Task 4: Complete real Google OIDC registration and failure handling

**Files:**
- Create: `backend/src/main/java/vn/edu/fpt/beefcare/security/GoogleOidcFailureHandler.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/GoogleIdentityService.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/security/GoogleOidcSuccessHandler.java`
- Modify: `frontend/src/features/authentication/components/AuthControls.tsx`
- Modify: `frontend/src/features/authentication/pages/SignInPage.tsx`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/.env.example`
- Modify: `.env.example`
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/service/GoogleIdentityServiceTest.java`
- Create: `backend/src/test/java/vn/edu/fpt/beefcare/security/GoogleOidcHandlersTest.java`
- Test: `frontend/tests/unit/auth/GuestAuthFlow.test.tsx`

**Interfaces:**
- Frontend starts OAuth at the backend origin `/oauth2/authorization/google`; local proxy supports `/oauth2/**` and `/login/oauth2/**` when API URL is empty.
- New/incomplete Owner redirects to `/owner-registration`; completed account redirects to `/chon-trai`; cancellation/rejection redirects to `/sign-in?error=google-sign-in` and renders MSG-FE01-12.

- [ ] Add failing Google identity tests for new account, linking the same verified email, same subject reuse, subject collision, unverified email, suspended account and changed-email collision.
- [ ] Add failing handler/frontend tests for the three redirects and backend-origin OAuth URL.
- [ ] Harden `GoogleIdentityService` so subject lookup remains authoritative and cannot mutate/claim another email identity; persist Google metadata.
- [ ] Register explicit OAuth failure handling and correct all frontend route names in the success handler.
- [ ] Add the OAuth URL helper/proxy and document Google client configuration variables without adding secrets.
- [ ] Run focused backend/frontend tests until green.
- [ ] Commit the Google-registration slice.

### Task 5: Complete SCR-03 and SCR-07 owner-registration state

**Files:**
- Modify: `frontend/src/features/authentication/pages/RegisterPage.tsx`
- Create or modify the public Terms/Data Policy route components under `frontend/src/features/authentication/pages/`.
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/features/farm-workspace/pages/OwnerRegistrationPage.tsx`
- Modify: `frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java`
- Test: `frontend/tests/unit/auth/GuestAuthFlow.test.tsx`
- Test: `frontend/tests/unit/app/AppRoutes.test.tsx`
- Test: `frontend/tests/unit/farm-workspace/backendIsolation.test.ts`
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`

**Interfaces:**
- Owner completion normalizes phone by removing spaces/dots before validation and records terms acceptance timestamp.
- Completing Owner returns profile state and redirects frontend to `/dang-ky-trai`; it creates no farm, membership, platform access or subscription.

- [ ] Add failing tests for legal links, prefilled read-only email/name, phone normalization, required terms, persisted timestamps, idempotent Owner completion and absence of farm/role/subscription side effects.
- [ ] Run focused tests and verify the expected failures.
- [ ] Add accessible public legal routes, correct registration response consumption, and preserve form/error behavior from SCR-03.
- [ ] Make SCR-07 prefill from the authenticated profile, normalize phone consistently, persist terms/Owner completion atomically and navigate to farm registration.
- [ ] Run focused backend/frontend tests until green.
- [ ] Commit the Owner-completion slice.

### Task 6: Align mail environments and API documentation

**Files:**
- Modify: `backend/src/main/resources/config/application-local.yml`
- Modify: `backend/src/main/resources/config/application-prod.yml`
- Modify: `.env.example`
- Modify: `docs/LOCAL_SETUP.md`
- Modify: `docs/api/openapi.json` through the repository's documented catalog generation path.
- Test: relevant configuration/context tests and OpenAPI snapshot/catalog checks.

**Interfaces:**
- Local defaults to Mailpit `localhost:1025` with no auth/TLS.
- Production requires Gmail SMTP values from environment and uses the configured BeefCare sender; no Gmail password is committed.

- [ ] Add failing configuration/OpenAPI assertions for local Mailpit, production-required SMTP variables and A1/A2/A3/A4/A5/A6 schemas.
- [ ] Correct the profile-specific mail defaults and example variables, including Google client ID/secret/redirect guidance.
- [ ] Regenerate the OpenAPI catalog using the backend workflow and verify the registration records have required fields and correct responses.
- [ ] Run configuration/OpenAPI checks until green.
- [ ] Commit environment and contract documentation.

### Task 7: Registration end-to-end verification

**Files:**
- Modify only tests/docs required by failures found during verification; any behavior fix starts with a new failing test.

**Interfaces:**
- Produces runtime evidence for email registration/verification, resend, Google registration and Owner completion.

- [ ] Run all backend unit tests and FE01 integration tests on JDK 21.
- [ ] Run `npm test`, `npm run test:integration:ui`, `npm run typecheck` and `npm run build` in `frontend`.
- [ ] Start Mailpit, backend `8080`, frontend `5173`; manually verify email registration through the clicked link and Owner completion, including invalid/expired link and resend states.
- [ ] With configured Google Cloud test credentials, manually verify Google consent, cancellation, new-account creation, existing-email linking and final redirect; record that real Google evidence separately from automated tests.
- [ ] Confirm database readback for terms timestamps, method status/link metadata, Owner completion, and absence of an automatically created farm/membership/subscription.
- [ ] Review the final diff for secrets, unrelated changes and OpenAPI drift; commit any test-first corrections and prepare the handoff.

### Task 8: Complete password and Google sign-in, lockout, session bootstrap and destination routing

**Files:**
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AuthenticateController.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java`
- Modify: `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/vm/LoginVM.java`
- Modify: frontend authentication/session/routing files under `frontend/src/features/authentication/` and `frontend/src/features/authorization/`.
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Test: frontend auth/session unit and integration tests.

**Interfaces:**
- The fifth wrong password responds MSG-FE01-02 with unlock time; Google remains usable.
- Account profile/session bootstrap returns structured anonymous/suspended outcomes and enough data for the exact SCR-02 destination priority.

- [ ] Add failing tests for the 128-character boundary, fifth-attempt lock, last-login/method-last-used timestamps, suspended live session, 8-hour/30-day sessions and every destination-priority branch.
- [ ] Implement the backend authentication/session contract and structured 401/403 handling.
- [ ] Implement requested-route/invitation/Owner/platform/single-active-farm/multi-or-no-farm routing without granting access from client state.
- [ ] Run focused and full auth suites RED→GREEN and commit.

### Task 9: Complete logout and selected-farm device state

**Files:**
- Modify: frontend session/farm selection storage and logout components.
- Test: frontend session lifecycle tests and backend browser-session tests.

**Interfaces:**
- Selected farm is device state used only as a request hint; backend revalidates every request.
- Logout invalidates the server session, clears CSRF/session cookies and removes selected farm before opening SCR-02.

- [ ] Add failing tests for selected-farm restoration, unauthorized farm fallback, logout clearing and logout failure handling.
- [ ] Implement selected-farm state and logout cleanup.
- [ ] Run RED→GREEN suites and commit.

### Task 10: Complete profile and permissions contract

**Files:**
- Modify: account/profile backend DTOs, resource and OpenAPI annotations.
- Modify: owner, technician and platform profile frontend pages/components.
- Test: backend profile integration tests and frontend account page/API tests.

**Interfaces:**
- A7 includes sign-in methods, platform role and farms with service status; A10 returns permission-area values `FULL|RESTRICTED|NO`.
- Every authenticated role can update full name and normalized optional phone; email remains immutable.

- [ ] Add failing tests for all roles, current-farm permissions, phone normalization, immutable email and exact A7/A9/A10 schemas.
- [ ] Implement backend projection and technician/platform editing UI using server-provided permissions.
- [ ] Regenerate OpenAPI, run RED→GREEN suites and commit.

### Task 11: Complete forgotten-password flow

**Files:**
- Modify: password reset backend service/resource/DTO and transactional notification handling.
- Modify: frontend recovery pages/client/types.
- Test: backend reset integration tests and frontend recovery tests.

**Interfaces:**
- A11 remains privacy-preserving; A12 returns `{email}` for a valid token and FE01-06 for an invalid token.
- Reset uses a 30-minute one-time token, invalidates older links and all sessions, clears lockout and notifies the account without exposing passwords.

- [ ] Add failing tests for email syntax, Google-only advice, valid-link email, invalid/expired/used link, password rules, suspended account, all-session invalidation and atomic notification queueing.
- [ ] Implement backend contract and frontend read-only email/invalid-link/success states.
- [ ] Run RED→GREEN suites and commit.

### Task 12: Complete change/add-password and Google reauthentication flow

**Files:**
- Modify: change-password backend service/resource and OAuth reauthentication state.
- Modify: frontend account password dialog, return route and query/session state handling.
- Test: `backend/src/test/java/vn/edu/fpt/beefcare/service/GoogleReauthenticationIT.java`, browser tests and frontend account tests.

**Interfaces:**
- Existing-password users provide current password; Google-only or forgotten-current-password users require Google reauthentication within five minutes.
- Success keeps the current session, ends other sessions and queues the password-changed notice atomically.

- [ ] Add failing tests for fifth-attempt lock, 5-minute boundary, OAuth round trip, dialog restoration, first password, forgotten-current replacement and session expiry.
- [ ] Implement durable return state and correct `/ho-so` callback behavior without trusting a client boolean.
- [ ] Run RED→GREEN suites and commit.

### Task 13: Full FE01 completion audit and handoff

**Files:**
- Modify only test-first corrections, OpenAPI and requirement-status documentation warranted by evidence.

- [ ] Build a requirement-to-evidence matrix for R-01-01→15, A1→15 and TC-01-01→49.
- [ ] Run all backend tests on JDK 21, frontend API/unit/integration suites, typecheck and production build.
- [ ] Run local Mailpit/browser evidence for email registration, verification, reset, session and profile flows.
- [ ] Run real Google OAuth evidence with configured credentials; if credentials are unavailable, report this external evidence gap without claiming the flow verified.
- [ ] Perform whole-branch review, fix Critical/Important findings test-first, and prepare branch handoff.
