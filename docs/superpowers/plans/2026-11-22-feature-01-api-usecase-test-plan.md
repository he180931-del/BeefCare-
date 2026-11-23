# Feature 01 API Use-Case Test Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kiểm thử đầy đủ Feature 01 theo đúng 6 use case, chứng minh được chuỗi frontend → API → security/session → service → database/email → response → frontend routing; mọi nhánh thành công, lỗi và hậu điều kiện quan trọng đều có bằng chứng chạy lại được.

**Architecture:** Dùng kiểm thử theo hợp đồng và theo luồng. Frontend API tests khóa method/path/body/CSRF/cookie/error mapping; backend MockMvc integration tests chạy security chain thật và đọc lại DB; service tests khóa Google/OIDC và quy tắc thời gian; frontend integration/unit tests khóa điều hướng và xóa trạng thái trên thiết bị. Không dùng UI test để thay cho business rule backend, và không dùng HTTP 2xx làm bằng chứng thay cho readback DB.

**Tech Stack:** Java 21, Spring Boot 3.5, Spring Security session + CSRF, MockMvc, JUnit 5, AssertJ, H2 `@ServiceIntegrationTest`, PostgreSQL 16 smoke khi bàn giao tích hợp, React 19, TypeScript, Node test runner, Vitest, Testing Library.

**Spec:** `docs/requirements/specs/FE-01-xac-thuc-tai-khoan.md` §3, §5, §7–§10; `docs/REQUIREMENT_DECISIONS.md`; `docs/api/openapi.json`; `backend/AGENTS.md`; `docs/agent-context/API_RULES.md`; `docs/agent-context/VERIFICATION.md`.

## Global Constraints

- Chỉ lập kế hoạch và bổ sung test khi kế hoạch được duyệt; không sửa production code trong giai đoạn lập kế hoạch.
- Expected result lấy theo thứ tự nguồn chuẩn của repo: requirement decisions → SRS/spec → OpenAPI/DTO → code/test hiện tại. Không đổi assertion chỉ để khớp hành vi đang chạy.
- Mỗi lỗi phát hiện phải được phân loại là `PRODUCT`, `CONTRACT`, `TEST`, hoặc `ENVIRONMENT`, kèm expected/actual và bằng chứng tái hiện.
- Mỗi mutation phải có CSRF hợp lệ; thêm một ca thiếu/sai CSRF và xác nhận DB không đổi.
- Email, token, cookie, session ID và mật khẩu chỉ dùng dữ liệu test; không ghi giá trị thật vào log hoặc tài liệu bằng chứng.
- Không `sleep` để chờ 15 phút, 30 phút hoặc 24 giờ. Điều khiển clock hoặc sửa mốc thời gian fixture trong transaction kiểm thử.
- Mỗi tài khoản dùng email duy nhất theo từng test. Không phụ thuộc thứ tự chạy, tài khoản seed hay dữ liệu còn lại từ test khác.
- Kiểm cả response lẫn hậu điều kiện: `jhi_user`, `app_user`, account link token, email delivery job, session registry, farm membership/invitation khi liên quan.
- Google OAuth bên ngoài không được gọi live trong suite. Mock OIDC profile ở unit/service/handler; chỉ kiểm tay live một lần ở môi trường tích hợp nếu client ID, redirect URI và tài khoản test đã được phê duyệt.
- Không commit, push, merge, reset hoặc stash trong lúc thực hiện kế hoạch nếu người dùng chưa yêu cầu.

## Review Focus

Trước khi viết thêm test, phải đối chiếu và chốt bốn lệch hợp đồng đã thấy trong code hiện tại:

1. Link kích hoạt sai/hết hạn hiện redirect `303` tới trang link không hợp lệ, trong khi bảng API của spec mô tả lỗi `MSG-FE01-06`.
2. `GET /api/account/reset-password/validate` hiện trả `200 { valid: false }` cho token sai/hết hạn, trong khi bảng API mô tả lỗi `MSG-FE01-06`.
3. Request kế tiếp của phiên vừa bị suspend hiện có thể trả `403 MSG-FE01-03`; TC-01-26 yêu cầu `401` rồi frontend về SCR-02 với trạng thái suspend.
4. Vượt giới hạn/resend trong cooldown hiện vẫn trả `200 { nextAllowedAt }` và không gửi mail; TC-01-16 ghi “bị từ chối”, còn Q1 chưa chốt mã lỗi.

TC-01-49 cũng cần chốt ranh giới giao dịch: lỗi ghi account hoặc lỗi enqueue email phải rollback; lỗi nhà cung cấp xảy ra sau khi durable email job đã commit thì job được retry, không thể rollback account đã commit. Hai loại lỗi này phải là hai test riêng.

## Planned Test Files

Ưu tiên mở rộng test hiện có, tránh tạo một bộ test trùng lặp:

- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`: chuỗi HTTP chính của UC-01 đến UC-06, CSRF, cookie, session và DB readback.
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/EmailActivationFlowIT.java`: durable email job, link kích hoạt, lỗi enqueue và retry provider.
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/AuthenticateControllerIT.java`: security boundary, revoke session, logout và lockout.
- `backend/src/test/java/vn/edu/fpt/beefcare/service/GoogleIdentityServiceTest.java`: link Google theo subject/email, Google-only, suspended và password lock.
- `backend/src/test/java/vn/edu/fpt/beefcare/service/GoogleReauthenticationIT.java`: cửa sổ 5 phút, cùng session, thêm mật khẩu đầu tiên.
- `backend/src/test/java/vn/edu/fpt/beefcare/security/GoogleOidcSuccessHandlerTest.java` và `GoogleOidcFailureHandlerTest.java`: redirect và lỗi OAuth.
- `frontend/tests/api/authApiContract.test.ts`: method/path/body, CSRF, credentials, status và `{code, params}`.
- `frontend/tests/unit/auth/validation.test.ts`: giá trị biên đăng ký/đăng nhập/đặt lại.
- `frontend/tests/unit/auth/sessionRoles.test.tsx`: thứ tự điều hướng sau đăng nhập.
- `frontend/tests/unit/account/accountApi.test.ts`: profile, đổi mật khẩu, Google reauthentication.
- `frontend/tests/integration/auth/authSessionLifecycle.test.tsx`: login/logout/session-expired và xóa selected farm.
- `docs/analysis/feature-01-api-test-evidence.md`: báo cáo chạy sau này; một dòng cho mỗi test case, không chứa secret.

Không tách `BrowserSessionFlowIT` trong cùng gói kiểm thử này. Nếu file trở nên khó bảo trì, lập kế hoạch refactor test support riêng sau khi toàn bộ coverage đã xanh và có checkpoint ổn định.

## Test Data and Shared State

Tạo fixture có tên theo mục đích, không dùng chung một account cho nhiều nhánh:

| Fixture | Trạng thái tối thiểu | Dùng cho |
|---|---|---|
| `newEmailOwner` | Chưa tồn tại | UC-01 đăng ký email |
| `pendingEmailOwner` | Password `PENDING_VERIFICATION`, link 24h | UC-01, UC-02 AF6 |
| `activePasswordOwner` | ACTIVE, password ACTIVE, chưa hoàn tất owner | Login, profile, password |
| `completedOwnerNoFarm` | ACTIVE, owner completed, không farm/membership/subscription | UC-01 hậu điều kiện, UC-02 AF3 |
| `googleOnlyUser` | ACTIVE, Google subject, password disabled | Google branch, reset, add first password |
| `linkedGooglePasswordUser` | Cả GOOGLE và PASSWORD | Link identity, reauth thay current password |
| `suspendedUser` | SUSPENDED | Login/revoke/reset |
| `technicianOneFarm` | Một farm ACTIVE, TECHNICIAN | Routing SCR-74 |
| `ownerTwoFarms` | Hai farm ACTIVE, OWNER | Routing SCR-09 |
| `platformManager` | Platform role PM, không cần farm | Routing SCR-12/profile |
| `invitedUser` | Pending invitation chưa accept | Login không tự nhận lời mời |

Mỗi test cần các client độc lập `guest`, `currentSession`, `otherSession`; mỗi client giữ cookie jar và CSRF riêng. Test helper chỉ được làm ba việc: lấy CSRF, gửi request và giữ session. Assertion nghiệp vụ phải nằm trong test để người đọc thấy rõ luồng.

## Task 1: Shared Authentication Test Harness and Baseline

**Files:**
- Inspect: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Inspect: `frontend/tests/api/authApiContract.test.ts`
- Create after execution approval: `docs/analysis/feature-01-api-test-evidence.md`

- [ ] Đối chiếu TC-01-01 đến TC-01-49 với test hiện có; ghi `COVERED`, `PARTIAL`, `MISSING`, hoặc `CONTRACT_DRIFT`, kèm `Class#method`.
- [ ] Chạy baseline backend unit cho Google/OIDC trước khi sửa test:

  ```bash
  cd backend
  ./mvnw --batch-mode '-Pdev,!webapp' -Dspotless.skip=true -Djacoco.skip=true -Dtest=GoogleIdentityServiceTest,GoogleOidcSuccessHandlerTest,GoogleOidcFailureHandlerTest test
  ```

- [ ] Chạy baseline backend Failsafe cho luồng Feature 01:

  ```bash
  cd backend
  ./mvnw --batch-mode '-Pdev,!webapp' -Dspotless.skip=true -Djacoco.skip=true -Dit.test=BrowserSessionFlowIT,EmailActivationFlowIT,AuthenticateControllerIT,GoogleReauthenticationIT verify
  ```

- [ ] Chạy baseline frontend đúng các lớp liên quan:

  ```bash
  cd frontend
  node --import tsx --import ./tests/node/setup.ts --test tests/api/authApiContract.test.ts
  ./node_modules/.bin/vitest run --passWithNoTests tests/unit/auth tests/unit/account
  ./node_modules/.bin/vitest run --passWithNoTests tests/integration/auth
  ```

- [ ] Ghi commit/checkpoint, Java/Node version, profile DB, command, số pass/fail và lỗi baseline; không tiếp tục nếu baseline đỏ chưa được phân loại.
- [ ] Xác nhận helper không in request body của password/token và response không có `password`, `passwordHash`, `tokenHash`.

## Task 2: UC-FE01-01 — Register Owner Account

**Luồng email chuẩn:** `GET /api/csrf` → `POST /api/register` → account pending + durable mail → login bị chặn → mở link `GET /api/activate` → session 8h → `GET /api/account/profile` → `POST /api/account/owner-registration` → profile completed.

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/EmailActivationFlowIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/service/GoogleIdentityServiceTest.java`
- Modify: `frontend/tests/api/authApiContract.test.ts`
- Modify: `frontend/tests/unit/auth/validation.test.ts`

- [ ] Khóa hợp đồng frontend: `POST /api/register` gửi đúng `fullName,email,password,confirmPassword,termsAccepted`, có cookie credentials và CSRF; success `201 {email}`; lỗi đọc `{code,params}`.
- [ ] Kiểm TC-01-01..07 bằng bảng dữ liệu: full name 1/2/100/101, whitespace; email sai/255; password 7/8/128/129 và trùng email không phân biệt hoa thường; confirm mismatch; terms false.
- [ ] Luồng TC-01-11: đăng ký email sau trim/lowercase, assert đúng một `jhi_user` + một `app_user`, password là hash, `PENDING_VERIFICATION`, một token 24h chỉ lưu hash, một email job; response không chứa credential.
- [ ] Trước verify, `POST /api/authenticate` trả `MSG-FE01-11` và không tạo session.
- [ ] Kích hoạt link hợp lệ: token chuyển used, password method ACTIVE, email verified, account ACTIVE, tạo session, redirect đúng trang owner registration; link dùng lần hai thất bại và không tạo session mới.
- [ ] Hoàn tất owner registration: trim name/phone, terms true; assert `ownerRegistrationCompleted=true`; không tự tạo farm, membership, platform role, subscription hoặc accept invitation (TC-01-34/35).
- [ ] Duplicate case-insensitive TC-01-12: `A@X.VN` không tạo account thứ hai, không thêm mail/token, trả `MSG-FE01-10`.
- [ ] Link hết 24h TC-01-14 và link cũ sau resend TC-01-15: không activate; link mới vẫn dùng được.
- [ ] Cooldown 60 giây và giới hạn 5 email/giờ TC-01-16/17: API theo quyết định đã chốt; luôn assert số mail/token không tăng khi bị giới hạn.
- [ ] Google branch TC-01-18/19/32: subject trước, email sau; cùng email gắn cùng account; subject không chuyển sang account khác; Google lần đầu tạo ACTIVE Google-only nhưng `ownerRegistrationCompleted=false`, không farm/role.
- [ ] Google trả email chưa verified, user hủy OAuth, account suspended và provider failure: không tạo session/account trái phép, redirect/error đúng hợp đồng.
- [ ] Lỗi lưu/enqueue email: transaction rollback toàn bộ account/token/job. Lỗi provider sau commit: job vẫn PENDING và retry thành SENT; ghi rõ đây là hai failure boundary khác nhau cho TC-01-49.
- [ ] Chạy riêng các method UC-01, rồi chạy lại toàn bộ lớp liên quan; cập nhật evidence theo từng TC.

## Task 3: UC-FE01-02 — Sign In

**Luồng chuẩn:** `GET /api/csrf` → `POST /api/authenticate` → session cookie → lấy CSRF mới → `GET /api/account/profile` → frontend chọn route theo profile/invitation/requested route.

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/AuthenticateControllerIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/service/GoogleIdentityServiceTest.java`
- Modify: `frontend/tests/api/authApiContract.test.ts`
- Modify: `frontend/tests/unit/auth/sessionRoles.test.tsx`

- [ ] Happy path: email được trim/case-normalize, password đúng trả `204`, session dùng lại được ở `/api/account/profile`, `failedPasswordAttempts=0`, `lastSignInAt` cập nhật.
- [ ] TC-01-10: email khác hoa thường vẫn login được.
- [ ] Sai email và sai password trả cùng HTTP/body `MSG-FE01-01`, không lộ account tồn tại và không tạo session (TC-01-24).
- [ ] Sai 4 lần rồi đúng: login thành công và counter về 0 (TC-01-20).
- [ ] Sai lần 5: `423 MSG-FE01-02` kèm `unlockAt/time`; lần sau đúng vẫn bị khóa; sau T+15m+1s login được và counter reset (TC-01-21/23).
- [ ] Google login vẫn thành công trong lúc password lock, nhưng account SUSPENDED bị chặn ở cả password và Google, không có session (TC-01-22/25).
- [ ] Account pending verification trả `MSG-FE01-11`; Google-only qua password trả lỗi generic; không trường hợp nào tạo session.
- [ ] Session idle timeout: không remember = 28,800 giây; remember = 2,592,000 giây. Dùng `maxInactiveInterval`, không chờ thật 8h/30 ngày (TC-01-27/28).
- [ ] Suspend account đang online: request kế tiếp revoke session; expected status theo quyết định contract drift; frontend nhận session-expired, xóa selected farm và về sign-in với lý do suspended (TC-01-26).
- [ ] Frontend routing priority: requested safe path → pending invitation → unfinished owner registration → platform role → đúng một farm ACTIVE → farm chooser → no-farm action.
- [ ] Khóa riêng TC-01-29/30/31/32/33: Technician một farm → SCR-74; Owner hai farm → SCR-09; PM → SCR-12; Google mới không farm → MSG-FE01-15; owner chưa hoàn tất → SCR-07.
- [ ] Pending invitation chỉ ảnh hưởng điều hướng, không tự accept hoặc đổi membership (TC-01-35).
- [ ] Kiểm open redirect: requested path/Google returnTo chỉ nhận đường dẫn nội bộ cho phép.
- [ ] Chạy riêng UC-02 backend + frontend routing tests; lưu response/status/session/DB evidence.

## Task 4: UC-FE01-03 — Sign Out

**Luồng chuẩn:** phiên đang đăng nhập → `GET /api/csrf` → `POST /api/logout` → server invalidates đúng phiên hiện tại + clear cookies → frontend xóa selected farm → mở sign-in.

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/AuthenticateControllerIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Modify: `frontend/tests/api/authApiContract.test.ts`
- Modify: `frontend/tests/integration/auth/authSessionLifecycle.test.tsx`

- [ ] Logout có CSRF trả `204`; `JSESSIONID` và `XSRF-TOKEN` bị clear/expire; session cũ gọi profile trả `401`.
- [ ] Logout thiếu/sai CSRF bị từ chối và session vẫn dùng được.
- [ ] Có hai phiên: logout P1 chỉ hủy P1, P2 vẫn dùng được; tránh vô tình triển khai “logout all”.
- [ ] Gọi logout khi session đã mất được frontend coi là đã logout; không tạo vòng lặp lỗi.
- [ ] Frontend luôn xóa `CURRENT_FARM_KEY`, session profile và trạng thái authenticated; về `/sign-in` ngay cả khi logout API trả 401/403 do phiên đã hết.
- [ ] TC-01-48 được kiểm ở cả API/session và frontend device state; ghi rõ phần xóa selected farm là frontend, không phải backend.

## Task 5: UC-FE01-04 — View and Edit My Profile

**Luồng chuẩn:** session hợp lệ → `GET /api/account/profile` → hiển thị identity/role/farm/sign-in methods → `POST /api/account/profile` → validate/update → GET readback.

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/AuthenticateControllerIT.java`
- Modify: `frontend/tests/unit/account/accountApi.test.ts`
- Modify: `frontend/tests/unit/account/accountMapper.test.ts`
- Modify: `frontend/tests/unit/account/AccountPages.test.tsx`

- [ ] Anonymous GET/POST trả `401`; authenticated user chỉ đọc/sửa chính mình vì route không nhận account ID.
- [ ] Profile response đủ `id,fullName,email,emailVerified,contactPhone,status,ownerRegistrationCompleted,signInMethods,hasPassword,platformRole,farms`; enum/null đúng contract.
- [ ] Assert response ở mọi role không chứa password/hash/token/session ID (một phần TC-01-45).
- [ ] POST hợp lệ trim full name/phone; response và GET sau đó khớp; DB transaction mới đọc lại đúng giá trị.
- [ ] Boundary họ tên và phone dùng TC-01-01/02/08/09; invalid không thay đổi DB.
- [ ] Gửi thêm `email` mới không đổi identity email trong `jhi_user` hoặc `app_user` (TC-01-46).
- [ ] Platform staff thấy platform role và không bị frontend dựng bảng quyền farm giả (TC-01-47).
- [ ] Farm user lấy quyền theo farm/role server trả về; không lấy “vai trò mạnh nhất” ở farm khác.
- [ ] CSRF thiếu/sai không cập nhật. Session vừa hết hoặc bị revoke không lưu thay đổi.
- [ ] Mapper frontend giữ đúng null/empty array/sign-in methods, không tự bật `hasPassword` hoặc quyền.

## Task 6: UC-FE01-05 — Reset Forgotten Password

**Luồng chuẩn:** `GET /api/csrf` → `POST /api/account/reset-password/init` → phản hồi generic → email/token 30 phút nếu đủ điều kiện → `GET .../validate` → `POST .../finish` → hash mới + token used + clear lock + revoke all sessions + notification email.

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/EmailActivationFlowIT.java`
- Modify: `frontend/tests/api/authApiContract.test.ts`
- Modify: `frontend/tests/unit/auth/validation.test.ts`

- [ ] Init với email tồn tại và không tồn tại trả cùng status/body/header; chỉ account password ACTIVE tạo token/mail. Không so timing tuyệt đối dễ flaky; nếu kiểm side-channel thời gian thì dùng benchmark riêng (TC-01-36).
- [ ] Email sai định dạng bị chặn ở boundary; email hợp lệ được trim/case-normalize.
- [ ] Google-only nhận email hướng dẫn Google, không tạo reset token, không bật password hoặc đổi hash (TC-01-37).
- [ ] Token 30 phút, chỉ lưu hash, link mới vô hiệu link cũ, tối đa 5 mail/giờ và cooldown 60 giây.
- [ ] Validate token hợp lệ trả email readonly; token malformed/unknown/used/expired theo contract đã chốt. TC-01-38 dùng T+31 phút không sleep.
- [ ] Finish kiểm password 7/8/128/129, trùng email, confirm mismatch; lỗi không consume token, không đổi hash, không revoke session.
- [ ] Success TC-01-39: password hash đổi, method ACTIVE, link used một lần, counter/lock clear, mọi session cũ 401, old password fail, new password login được, notification mail không chứa password.
- [ ] Replay token sau success thất bại và không đổi password lần hai.
- [ ] Suspended account được reset password nhưng login mới vẫn `MSG-FE01-03` (TC-01-40).
- [ ] CSRF thiếu/sai ở init/finish không tạo token, không đổi hash.
- [ ] Lỗi lưu/enqueue notification rollback đúng boundary; provider failure sau commit giữ job để retry mà không lặp password change.
- [ ] Frontend gửi đúng JSON thực tế `key,newPassword,confirmPassword`; đối chiếu OpenAPI để không dùng nhầm `token`.

## Task 7: UC-FE01-06 — Change Password or Add First Password

**Luồng password chuẩn:** session hiện tại → `POST /api/account/change-password` với current/new/confirm → hash mới → giữ current session → revoke other sessions → notification email.

**Luồng Google-only:** session hiện tại → `POST /api/account/google-reauthentication` → OAuth callback cùng session → trong 5 phút gọi change-password không cần current password → bật password ACTIVE.

**Files:**
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/service/GoogleReauthenticationIT.java`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/security/GoogleOidcSuccessHandlerTest.java`
- Modify: `frontend/tests/unit/account/accountApi.test.ts`
- Modify: `frontend/tests/unit/account/ChangePasswordDialog.test.tsx`

- [ ] Password account: current đúng + new hợp lệ; old password fail, new password login được, DB chỉ có hash, notification không chứa password.
- [ ] New password boundary/trùng email/confirm mismatch trả đúng FE01-08/09 và không đổi hash/session.
- [ ] Current password sai lần 1–4 trả FE01-16; lần 5 khóa password sign-in và trả FE01-02 theo TC-01-42; Google sign-in vẫn độc lập.
- [ ] Có P1/P2: change ở P1 giữ P1, revoke P2, reset failure counter (TC-01-41).
- [ ] CSRF sai, session expired hoặc suspended: không đổi password, không gửi mail, không tạo session mới.
- [ ] Google-only chưa reauth hoặc reauth cũ hơn 5 phút bị yêu cầu xác thực lại (TC-01-43).
- [ ] Reauth phải thuộc cùng server session; timestamp ở session khác không có hiệu lực; callback chỉ chấp nhận Google subject đã link đúng account.
- [ ] Reauth trong 4m59s cho phép thêm mật khẩu đầu tiên; 5m01s từ chối; sau success password method ACTIVE và email/password login được, Google link giữ nguyên (TC-01-44).
- [ ] Account có cả Google và password có thể dùng recent Google reauth thay current password đã quên; password-only không được giả cờ Google để bỏ current password.
- [ ] Frontend mở lại đúng dialog sau OAuth return, gửi `googleReauthenticated=true` theo contract nội bộ và không lưu timestamp reauth ở localStorage.
- [ ] Error response và log không chứa current/new password hoặc hash (phần còn lại của TC-01-45).

## Task 8: Cross-Use-Case Security and Contract Regression

**Files:**
- Modify: `frontend/tests/api/authApiContract.test.ts`
- Modify: `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/BrowserSessionFlowIT.java`
- Inspect: `docs/api/openapi.json`

- [ ] Lập ma trận endpoint gồm method, anonymous/authenticated, CSRF, success status, error status/code, request DTO, response DTO và cookie side effect cho A1–A14 của spec.
- [ ] Với mọi unsafe endpoint, test thiếu CSRF và xác nhận không có side effect.
- [ ] Với mọi authenticated endpoint, test anonymous/expired/revoked session.
- [ ] Quét JSON response của FE-01 để bảo đảm không có `password`, `passwordHash`, `tokenHash`, raw token hoặc session ID (TC-01-45).
- [ ] Kiểm email/account lookup không phân biệt hoa thường và không tạo duplicate ở cả register, Google link, login, resend, reset.
- [ ] Kiểm BOLA theo mô hình Actor–Resource–Action: profile/change-password/logout luôn dùng principal hiện tại, không có request field cho phép chọn account khác.
- [ ] Kiểm redirect/returnTo chỉ dùng internal allow-list, không open redirect sau activate/OAuth/login.
- [ ] So OpenAPI với DTO/controller thực tế, đặc biệt `activate`, `reset-password/validate`, `reset-password/finish`, `verification/resend`, `change-password`.
- [ ] Mỗi contract drift tạo defect record; test normative có thể RED cho tới khi chủ dự án chốt, nhưng không sửa expected theo code chỉ để suite xanh.
- [ ] Kiểm log test không chứa plaintext password/token/cookie; kiểm response của lỗi validation không echo password.

## Task 9: Full Feature 01 Execution and Evidence

- [ ] Chạy focused backend unit:

  ```bash
  cd backend
  ./mvnw --batch-mode '-Pdev,!webapp' -Dspotless.skip=true -Djacoco.skip=true -Dtest=GoogleIdentityServiceTest,GoogleOidcSuccessHandlerTest,GoogleOidcFailureHandlerTest test
  ```

- [ ] Chạy focused backend integration qua Failsafe:

  ```bash
  cd backend
  ./mvnw --batch-mode '-Pdev,!webapp' -Dspotless.skip=true -Djacoco.skip=true -Dit.test=BrowserSessionFlowIT,EmailActivationFlowIT,AuthenticateControllerIT,GoogleReauthenticationIT verify
  ```

- [ ] Ở checkpoint tích hợp đã được duyệt, chạy smoke HTTP quan trọng với PostgreSQL 16: register→activate→profile, login→logout, reset→re-login, change-password→session revocation. Ghi URL/profile/DB version; không dùng H2 pass để thay bằng chứng PostgreSQL.
- [ ] Chạy frontend API/unit/integration:

  ```bash
  cd frontend
  node --import tsx --import ./tests/node/setup.ts --test tests/api/authApiContract.test.ts
  ./node_modules/.bin/vitest run --passWithNoTests tests/unit/auth tests/unit/account
  ./node_modules/.bin/vitest run --passWithNoTests tests/integration/auth
  npm run typecheck
  npm run build
  ```

- [ ] Nếu có thay đổi route/DTO, chạy `OpenApiContractTest`, so diff rồi mới cập nhật `docs/api/openapi.json`; không refresh contract khi chưa có quyết định breaking change.
- [ ] Ghi một hàng evidence cho TC-01-01..49: expected, actual, layer, `Class#method`, command, PASS/FAIL/BLOCKED, DB/session/mail readback và defect link.
- [ ] Kiểm tay Google OAuth live duy nhất khi môi trường cho phép: login Google mới, link cùng email, suspended, cancel. Ghi là manual runtime evidence, không gọi là automated E2E.
- [ ] Chỉ đánh dấu Feature 01 đạt khi toàn bộ Completion Gate bên dưới thỏa hoặc mọi mục còn đỏ có defect/decision owner rõ ràng.

## Coverage Matrix

| Use case | Test case SRS | Trọng tâm |
|---|---|---|
| UC-FE01-01 Register Owner | TC-01-01..09, 11..19, 32, 34, 35, 49 | Field boundary, email/Google registration, verify/resend, owner completion, rollback |
| UC-FE01-02 Sign In | TC-01-10, 13, 20..33, 35 | Credential privacy, lock, session TTL, suspended, Google, routing |
| UC-FE01-03 Sign Out | TC-01-48 | Current session/cookies, selected farm, navigation |
| UC-FE01-04 Profile | TC-01-01, 02, 08, 09, 45..47 | Profile contract, update/readback, immutable email, roles |
| UC-FE01-05 Forgot Password | TC-01-03..06, 36..40, 45 | Enumeration, Google-only, token lifecycle, revoke all sessions |
| UC-FE01-06 Change/Add Password | TC-01-04..06, 41..45 | Current password, lock, session scope, Google reauth 5 phút |

Các mã xuất hiện ở nhiều UC là chủ ý vì cùng một rule phải được chứng minh ở đúng API boundary, không chỉ ở một màn hình.

## Completion Gate

Feature 01 chỉ được coi là kiểm thử đầy đủ khi:

- TC-01-01 đến TC-01-49 đều có test/evidence hoặc có lý do `E-only`/manual rõ ràng.
- Sáu use case đều có ít nhất một chuỗi happy path từ request đầu đến hậu điều kiện cuối.
- Mỗi alternative/exception trong §5 có test hoặc ghi rõ vì sao thuộc external/manual.
- Mọi mutation đã kiểm CSRF và “không side effect khi lỗi”.
- Session 8h/30d, lock 15 phút, reauth 5 phút, reset 30 phút, verify 24h và rate 5/giờ đều được kiểm không dùng sleep.
- Password/token chỉ lưu hash; response/log/mail không lộ secret.
- DB readback chứng minh owner completion không tự tạo farm/membership/subscription/role và reset/change password revoke đúng phạm vi session.
- Frontend routing sau login/logout/session-expired được kiểm độc lập với backend business rules.
- Focused backend/frontend tests, frontend typecheck/build và PostgreSQL smoke ở checkpoint tích hợp đều có kết quả mới.
- Bốn contract drift và TC-01-49 đã được chốt hoặc được ghi defect/blocker; không có “PASS” giả bằng cách đổi expected.

## Execution Handoff

Khi người dùng duyệt kế hoạch, thực hiện tuần tự Task 1 → Task 9. Sau mỗi use case, dừng ở một checkpoint reviewable gồm: test mới/sửa, command vừa chạy, kết quả, test case SRS đã phủ, defect phát hiện và file evidence. Không bắt đầu sửa production bug trong cùng bước; trước hết tạo regression test RED và xin chốt expected nếu nguồn còn mâu thuẫn.
