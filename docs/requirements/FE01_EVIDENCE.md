# FE-01 — ma trận bằng chứng triển khai

Ngày kiểm tra: 08/11/2026 · nhánh `lamkd2`

Tài liệu nguồn: `docs/requirements/specs/FE-01-xac-thuc-tai-khoan.md`.

## Bằng chứng tự động

| Phạm vi | Bằng chứng | Kết quả |
|---|---|---|
| Backend identity/OIDC/session/reset/owner/OpenAPI | `GoogleIdentityServiceTest`, `GoogleOidcSuccessHandlerTest`, `GoogleOidcFailureHandlerTest`, `GoogleReauthenticationIT`, `AuthenticateControllerIT`, `BrowserSessionFlowIT`, `OpenApiContractTest` | 37 tests, 0 lỗi |
| OpenAPI | `OpenApiContractTest`; catalog được sinh lại từ `backend/target/beefcare-openapi.json` | Pass; `AccountProfileUpdate` có `fullName, contactPhone` |
| Frontend unit | `npm run test:unit:run` | 114 files, 754 tests pass |
| Frontend integration | `npm run test:integration:ui` | 9 files, 15 tests pass |
| Frontend static/build | `npm run typecheck`, `npm run build` | Pass |

Ghi chú phạm vi: lần chạy toàn bộ backend Maven suite có 513 test và còn 17 lỗi ở
các test Herd Entry/Farm-born không thuộc FE01 (các lỗi xoay quanh
`earTagNumber`/mã nghiệp vụ FE06). Vì vậy kết quả trên được báo theo focused
FE01 suite; không coi toàn repo là xanh khi các module ngoài phạm vi còn lỗi.

## Đối chiếu use case và quy tắc

| Use case / nhóm quy tắc | Mã bằng chứng |
|---|---|
| UC-FE01-01: đăng ký, điều khoản, trạng thái pending, xác minh link, Owner completion | `BrowserSessionFlowIT`, `AuthenticateControllerIT`, `OwnerRegistrationPage.test.tsx`; runtime DB/Mailpit smoke |
| UC-FE01-02/03: đăng nhập, session, đăng xuất, CSRF | `BrowserSessionFlowIT`, `authSessionLifecycle.test.tsx` |
| UC-FE01-04: profile, `contactPhone`, quyền theo server | `BrowserSessionFlowIT`, `accountApi.test.ts`, `AccountPages.test.tsx` |
| UC-FE01-05: reset 30 phút/one-time, privacy response, thu hồi session | `BrowserSessionFlowIT`; runtime reset smoke với PostgreSQL/Mailpit |
| UC-FE01-06: đổi/thêm mật khẩu, Google re-auth, giữ phiên hiện tại | `GoogleReauthenticationIT`, `BrowserSessionFlowIT`, `AccountPages.test.tsx`; runtime change-password smoke |
| R-01-01…R-01-06 | Identity/Google service tests và browser flow; token hash, expiry, single-use, method state |
| R-01-07…R-01-12 | Reset/privacy, suspended/session, profile/permission tests |
| R-01-13…R-01-15 | Google re-auth tests, password change tests, transactional mail/outbox implementation |

## Bằng chứng runtime dữ liệu thật

Với tài khoản smoke riêng, đã xác minh:

1. `POST /api/register` tạo bản ghi trong PostgreSQL (`terms_accepted=true`, `password_method_status=PENDING_VERIFICATION`) và email xác minh từ `BeefCare@gmail.com` xuất hiện trong Mailpit.
2. Mở link email trả `303` tới `/owner-registration`, tạo phiên server; profile trả `emailVerified=true`.
3. `POST /api/account/owner-registration` với `contactPhone` cập nhật PostgreSQL; `termsAccepted=false` vẫn hợp lệ khi điều khoản đã ghi nhận ở SCR-03.
4. Reset password qua link Mailpit trả `valid=true`, hoàn tất reset làm phiên cũ nhận `401`; DB chuyển method sang `ACTIVE` và reset bộ đếm lỗi.
5. Đăng nhập lại và đổi mật khẩu thành công; profile cùng phiên vẫn truy cập được, DB có `password_last_used_at` và `failed_password_attempts=0`.

## Ngoại lệ cần ghi rõ

- Redirect URI backend được sinh đúng theo host backend: `http://localhost:8080/login/oauth2/code/google` (và tương ứng `127.0.0.1`).
- Vite OAuth proxy hiện rewrite tới backend `localhost:8080`; kiểm tra runtime qua cổng frontend cho thấy `redirect_uri=http://localhost:8080/login/oauth2/code/google`, khớp URI backend đã đăng ký trên Google Console.
- Đã gọi endpoint Google thật và nhận trang `Sign in with Google`; không còn `redirect_uri_mismatch`. Handler, proxy và service Google đã được kiểm thử tự động. Bước chọn tài khoản/consent/callback cuối cùng cần thao tác bằng tài khoản Google của người kiểm thử.
