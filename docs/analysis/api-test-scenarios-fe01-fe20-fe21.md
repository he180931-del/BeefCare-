# Kịch bản kiểm thử API — Feature 01, 20, 21

Tài liệu này là kế hoạch kiểm thử logic trên nhánh `lamkd2`, chưa phải báo cáo kết quả chạy test. Mỗi kịch bản phải kiểm cả phản hồi HTTP và trạng thái lưu thật; HTTP 2xx chưa đủ nếu dữ liệu, phiên, lịch sử, audit hoặc claim nguồn chưa đúng.

## 1. Phạm vi và quy ước

- `P0`: luồng chính, quyền, chuyển trạng thái và tính toàn vẹn dữ liệu/tiền.
- `P1`: validation, idempotency, version conflict, rollback và đồng thời.
- `P2`: lọc, phân trang, nội dung response và trường hợp biên.
- Mọi API thay đổi dữ liệu gửi cookie phiên, `X-XSRF-TOKEN` và cookie `XSRF-TOKEN` lấy từ `GET /api/csrf`.
- FE20/FE21 còn yêu cầu `Idempotency-Key` trên mọi command thay đổi dữ liệu.
- Khuôn lỗi nghiệp vụ: `{"code":"MSG-...","params":{...}}`.
- HTTP: `400` thiếu/sai dữ liệu; `401` chưa đăng nhập; `403` không có quyền; `404` không được thấy/không tồn tại; `409` conflict state/version; `422` chưa đủ điều kiện nghiệp vụ; `423` khóa đăng nhập; `410` snapshot hết hạn.
- Command lỗi phải không tăng bản ghi, không đổi state/version, không sinh history/audit/notification/outbox dở dang và không chiếm nguồn ngân hàng.

### Quy trình gọi API dùng chung

```text
1. GET /api/csrf
   Lưu cookie XSRF-TOKEN và body.token.

2. POST /api/authenticate
   Header X-XSRF-TOKEN: <body.token>
   Cookie XSRF-TOKEN: <cookie bước 1>
   Body: {"username":"owner.a@example.test","password":"Secret123","rememberMe":false}
   Lưu JSESSIONID.

3. POST/PUT command:
   Cookie: JSESSIONID + XSRF-TOKEN
   Header X-XSRF-TOKEN: <token>
   Header Idempotency-Key: <UUID riêng>   // FE20, FE21

4. Sau command:
   GET detail/list để kiểm readback.
   Đọc DB để kiểm state, version, history, audit, session, claim và outbox.
```

## 2. Chuẩn bị dữ liệu và phiên kiểm thử

| Biến | Dữ liệu cần có |
|---|---|
| `OWNER_A` | ACTIVE, verified, hoàn tất Owner registration, sở hữu `FARM_A` |
| `OWNER_B` | ACTIVE, sở hữu `FARM_B`, không có quyền ở `FARM_A` |
| `OWNER_NO_FARM` | ACTIVE, hoàn tất hồ sơ, không membership |
| `OWNER_PENDING` | Có password nhưng email chưa xác minh |
| `OWNER_GOOGLE` | Chỉ Google, chưa có password |
| `OWNER_SUSPENDED` | `AppUser.accountStatus=SUSPENDED` |
| `MANAGER_A` / `TECH_A` | Membership ACTIVE tại `FARM_A` |
| `CS_1` / `CS_2` | Platform role CS ACTIVE |
| `PM_1` / `PM_2` | Platform role PM ACTIVE |
| `SA_1` | Platform role SA ACTIVE |

Tạo session riêng cho từng user. Không thay role trực tiếp trong DB giữa các bước vì như vậy bỏ qua kiểm tra đăng nhập và thu hồi quyền.

Dữ liệu nghiệp vụ cần seed:

- `FARM_A` dịch vụ ACTIVE; `FARM_SUSPENDED` có chủ trại ACTIVE nhưng dịch vụ trại SUSPENDED.
- FE20: ticket ở `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`; một ticket có 25 PUBLIC message và CS_ONLY note; internal request OPEN cho PM/SA.
- FE21: evidence VERIFIED hướng IN, VERIFIED hướng OUT, có `quoteRef`, đã gắn Payment PAID, chưa verified, đã bị manual record khác claim; record DRAFT, POSTED, VOID, DISCARDED.
- Báo cáo: Payment PAID 1.200.000 ngày 05/11; income POSTED 500.000 ngày 06/11; expense POSTED 300.000 ngày 07/11; thêm một DRAFT và một VOID.
- Clock test phải điều khiển được để kiểm 24 giờ, 30 phút, 15 phút, 30 ngày và biên ngày UTC+07:00.

## 3. Feature 01 — Xác thực và tài khoản

### 3.1 Bản đồ API đang có

| Mã | API | Thành công hiện tại |
|---|---|---|
| F01-A0 | `GET /api/csrf` | `200`, token + cookie `XSRF-TOKEN` |
| F01-A1 | `POST /api/register` | `201 {email}` |
| F01-A2 | `POST /api/account/verification/resend` | `200 {nextAllowedAt}` |
| F01-A3 | `GET /api/activate?token=` | `303` tới `/owner-registration`, tạo session |
| F01-A4 | `GET /oauth2/authorization/google` | Redirect Google; callback tạo/link session |
| F01-A5 | `POST /api/authenticate` | `204`, tạo `JSESSIONID` |
| F01-A6 | `GET /api/authenticate` | `204` có principal, `401` nếu chưa login |
| F01-A7 | `GET /api/account/profile` | `200 ProfileResponse` |
| F01-A8 | `POST /api/account/owner-registration` | `200 OwnerRegistrationResponse` |
| F01-A9 | `POST /api/account/profile` | `200 ProfileResponse` |
| F01-A10 | `GET /api/farms/{farmId}/my-permissions` | `200 {role,permissions[]}` |
| F01-A11 | `POST /api/account/reset-password/init` | `200` cho email tồn tại/không tồn tại |
| F01-A12 | `GET /api/account/reset-password/validate?token=` | `200 {valid,email}` |
| F01-A13 | `POST /api/account/reset-password/finish` | `200` |
| F01-A14 | `POST /api/account/google-reauthentication` | `204` |
| F01-A15 | `POST /api/account/change-password` | `200` |
| F01-A16 | `POST /api/logout` | `204`, hủy session |

### 3.2 Kịch bản validation

| ID | Pri | Gọi API và dữ liệu | Kết quả phải kiểm |
|---|---|---|---|
| TC-01-01 | P1 | F01-A1, `fullName` dài 1/2/100/101 | 1/101: `400 MSG-COM-10 field=fullName`; 2/100 hợp lệ; chỉ request hợp lệ được lưu. |
| TC-01-02 | P1 | F01-A1, `fullName="   "` | `400 MSG-COM-06`; không tạo User/AppUser/token/mail. |
| TC-01-03 | P1 | F01-A1, email `abc`, `a@b`, >254 ký tự | `400 MSG-COM-10 field=email`; không lưu nửa chừng. |
| TC-01-04 | P1 | Password dài 7/8/128/129 | 7/129: `400 MSG-FE01-08`; 8/128 hợp lệ. |
| TC-01-05 | P1 | Password trùng email, khác hoa/thường | `400 MSG-FE01-08 field=password`. |
| TC-01-06 | P1 | `password != confirmPassword` | `400 MSG-FE01-09 field=confirmPassword`. |
| TC-01-07 | P1 | `termsAccepted=false` | `400 MSG-FE01-14 field=termsAccepted`. |
| TC-01-08 | P1 | F01-A8/A9 với `0912345678`, `+84912345678`, số thiếu/thừa | Hai giá trị đầu `200`; còn lại `400 MSG-COM-10 field=contactPhone`. |
| TC-01-09 | P2 | F01-A8/A9, phone null/rỗng | `200`, `contactPhone=null`. |
| TC-01-10 | P0 | Login `Owner@Farm.VN` cho `owner@farm.vn` | `204`, login không phân biệt hoa/thường, chỉ một account. |

### 3.3 Kịch bản luồng và quy tắc

| ID | Pri | Tiền điều kiện và thao tác | HTTP/response | Hậu kiểm logic/DB |
|---|---|---|---|---|
| TC-01-11 | P0 | Email mới; F01-A1 hợp lệ | `201 {email chuẩn hóa}` | Đúng 1 User `activated=false`, 1 AppUser ACTIVE, password method PENDING_VERIFICATION, 1 token 24h, 1 mail job. |
| TC-01-12 | P0 | Đã có `a@x.vn`; đăng ký `A@X.vn` | `409 MSG-FE01-10` | Không account/token/mail thứ hai. |
| TC-01-13 | P0 | `OWNER_PENDING`; F01-A5 | `401 MSG-FE01-11` | Không tạo login session. |
| TC-01-14 | P1 | Mở verification token T+24h+1m | Code hiện tại `303` tới trang link hết hạn | Không consume token; account chưa activated. Đây là redirect, không phải JSON FE01-06. |
| TC-01-15 | P1 | Có link 1; resend tạo link 2; mở link 1 rồi 2 | Link 1 hết hạn; link 2 thành công | Link cũ invalidated, chỉ link 2 consumed. |
| TC-01-16 | P1 | Đã phát 5 mail/giờ; F01-A2 lần 6 | Hiện tại `200 {nextAllowedAt}` | Không token/mail thứ 6. Spec nói “từ chối”; status là drift cần chốt. |
| TC-01-17 | P2 | Gọi F01-A2 lại trong 60 giây | `200`, nextAllowedAt còn tương lai | Không tạo token/mail mới. |
| TC-01-18 | P0 | Account password có sẵn; Google callback cùng email | OAuth thành công | Link Google vào cùng account, không tạo User/AppUser mới. |
| TC-01-19 | P0 | Subject S gắn account A; callback S với email B | OAuth thất bại | Không chuyển S, không sửa email, không tạo account. |
| TC-01-20 | P0 | Sai password 4 lần rồi đúng | 4 lần `401 FE01-01`; lần đúng `204` | Counter=0, lock=null, có session. |
| TC-01-21 | P0 | Sai lần 5 rồi thử đúng ngay | `423 MSG-FE01-02`, có `params.time` | Counter=5, khóa khoảng 15 phút, không session mới. |
| TC-01-22 | P0 | Password đang khóa; login Google | Thành công | Google session dùng được; password lock giữ nguyên. |
| TC-01-23 | P1 | Khóa tại T; login đúng T+15m+1s | `204` | Xóa lock/counter, tạo session. |
| TC-01-24 | P0 | Email không tồn tại và password sai | Cả hai `401 MSG-FE01-01` | Body cùng cấu trúc, không lộ account tồn tại. |
| TC-01-25 | P0 | Account SUSPENDED; password/Google login | `403 MSG-FE01-03` | Không tạo session hợp lệ. |
| TC-01-26 | P0 | Có session; SA suspend; gọi F01-A7 | Code hiện tại `403 MSG-FE01-03` | Session invalidated. Spec ghi 401: ghi nhận drift. |
| TC-01-27 | P1 | Login `rememberMe=false` | `204` | maxInactiveInterval=28800; sau 8h idle trả 401. |
| TC-01-28 | P1 | Login `rememberMe=true` | `204`, cookie max-age 30 ngày | Ngày 29 dùng được; sau 30 ngày hết hạn. |
| TC-01-29 | P2 | Technician có 1 farm; login + F01-A7 | Đúng farm/role/permissions | Không trả quyền Owner/Manager; FE có dữ liệu điều hướng `/kt`. |
| TC-01-30 | P2 | Owner có 2 farm; login + F01-A7 | Đúng 2 farm | Không tự chọn sai farm. |
| TC-01-31 | P2 | PM login + F01-A7 | `platformRole=PM` | Không giả membership farm. |
| TC-01-32 | P0 | Google lần đầu, không farm/platform | OAuth thành công; profile registration=false | Không tạo farm/membership/subscription. |
| TC-01-33 | P2 | Chưa hoàn tất Owner registration; login | Profile registration=false | FE phải mở owner-registration. |
| TC-01-34 | P0 | F01-A8 hợp lệ | `200 completed=true` | Chỉ update profile/consent; số farm/membership/access/subscription không đổi. |
| TC-01-35 | P1 | Có invitation PENDING; login | Thành công | Invitation vẫn PENDING, không tự tạo membership. |
| TC-01-36 | P0 | F01-A11 với email có và không có account | Cả hai `200`, body cùng kiểu | Chỉ account password hợp lệ sinh reset token/mail. |
| TC-01-37 | P1 | F01-A11 cho Google-only | `200` | Gửi mail khuyên dùng Google theo rate limit; không token/password. |
| TC-01-38 | P1 | F01-A12 với reset token T+31m | Hiện tại `200 {valid:false,email:null}` | Không consume token; khác spec FE01-06. |
| TC-01-39 | P0 | Có 2 session; F01-A13 reset hợp lệ | `200` | Cả 2 session invalid; counter/lock xóa; token used; hash đổi; có mail cảnh báo. |
| TC-01-40 | P1 | SUSPENDED reset password rồi login | Reset `200`, login `403 FE01-03` | Hash đổi nhưng vẫn SUSPENDED. |
| TC-01-41 | P0 | Session P1/P2; đổi password ở P1 | `200` | P1 còn dùng; P2 bị từ chối; hash đổi; có mail. |
| TC-01-42 | P0 | F01-A15 sai current password 5 lần | 1–4: `400 FE01-16`; sau khóa: `423 FE01-02` | Counter phải tồn tại dù request lỗi; hash không đổi. |
| TC-01-43 | P0 | Google-only, xác thực Google cách 10 phút; add password | `403 MSG-COM-01`, reason reauth required | Không thêm password. |
| TC-01-44 | P0 | F01-A14 + Google lại ≤5 phút + F01-A15 | `204`, rồi `200` | Password ACTIVE; password login được; Google vẫn linked. |
| TC-01-45 | P0 | Quét mọi response/log FE01 | Không password/passwordHash/raw token | Hash chỉ trong DB; request log che password. |
| TC-01-46 | P1 | F01-A9 gửi thêm `email` mới | `200` hoặc field bị bỏ qua | Email User/AppUser không đổi. |
| TC-01-47 | P2 | Platform staff gọi F01-A7/A10 | Profile có platform role; A10 chỉ thành công nếu có membership | Không suy quyền farm từ platform role. |
| TC-01-48 | P0 | Login; F01-A16 có CSRF; gọi F01-A7 | `204`, sau đó `401` | Session invalid; selected farm xóa trong E2E. |
| TC-01-49 | P0 | Ép mail/outbox lỗi khi register | Non-2xx COM-02 theo spec | Không User/AppUser/token/job mồ côi; nếu mail queue ngoài transaction thì ghi rõ gap. |

### 3.4 Bảo mật FE01

| ID | Thao tác | Mong đợi |
|---|---|---|
| SEC-01-01 | POST login/register/profile/change-password/logout không CSRF | `403`, DB/session không đổi. |
| SEC-01-02 | API account protected không session | `401`. |
| SEC-01-03 | CSRF token session A + cookie/session B | `403`. |
| SEC-01-04 | Kiểm cookie login | `HttpOnly`, SameSite đúng cấu hình, Secure ở production. |

## 4. Feature 20 — Hỗ trợ khách hàng

### 4.1 Payload theo code hiện tại

```json
// Owner tạo ticket
{"category":"PAYMENT","scope":"FARM","farmId":101,"subject":"Thanh toán chưa cập nhật","description":"Đã chuyển khoản nhưng dịch vụ chưa mở."}

// Reply: field là expectedVersion
{"content":"Tôi gửi thêm thông tin.","expectedVersion":3}

// CS xử lý: code dùng recipientId, expectedVersion
{"action":"HANDOVER","recipientId":202,"category":null,"priority":null,"reason":"Chuyển đúng người phụ trách","question":null,"expectedVersion":3}

// Resolution / acknowledgment / reopen / close
{"content":"Đã đối soát và cập nhật.","expectedVersion":5}
{"resolutionVersion":1,"comment":"Đã kiểm tra","expectedVersion":6}
{"reason":"Vẫn chưa thấy dịch vụ","expectedVersion":7}
{"reviewedAcknowledgment":true,"note":"Đã kiểm tra xác nhận mới nhất","expectedVersion":8}

// Internal request
{"targetRole":"PM","recipientId":301,"question":"Kiểm tra giao dịch","context":[{"type":"PAYMENT","id":9001,"label":"PAY-9001"}],"ticketVersion":4}
{"action":"REASSIGN","recipientId":302,"reason":"PM cũ nghỉ phép","expectedVersion":0}
{"outcome":"PERFORMED","result":"Đã ghi nhận nghiệp vụ","domainResultAuditId":7001,"expectedVersion":1}
```

Điểm dễ gửi sai: CS queue dùng query `assignment`, không phải `assignee`; `Resolution` dùng `content`; reopen không nhận `resolutionVersion`; internal request dùng `context`, `ticketVersion`; completion dùng `domainResultAuditId`.

### 4.2 Bản đồ API

| Nhóm | API |
|---|---|
| Owner đọc | `GET /api/support/tickets`, `GET /api/support/tickets/{id}`, `GET /api/support/tickets/{id}/messages` |
| Owner ghi | `POST /api/support/tickets`, `POST .../{id}/replies`, `POST .../{id}/acknowledgments`, `POST .../{id}/reopen` |
| CS đọc | `GET /api/platform/support/tickets`, `GET .../tickets/{id}`, `GET .../tickets/{id}/messages`, `GET .../recipients?role=PM|SA` |
| CS ghi | `POST .../{id}/processing`, `replies`, `internal-notes`, `resolutions`, `close`, `internal-requests`, `internal-requests/{id}/management` |
| PM/SA | `GET /api/platform/internal-requests`, `GET .../{id}`, `GET .../{id}/domain-results`, `POST .../{id}/completion` |

Mọi POST FE20 thành công trả `200` theo resource hiện tại và bắt buộc `Idempotency-Key`.

### 4.3 Kịch bản API đầy đủ

| ID | Pri | Tiền điều kiện và lời gọi | HTTP/logic mong đợi | Hậu kiểm |
|---|---|---|---|---|
| TC-20-01 | P0 | Manager/Technician/CS/PM gọi Owner create | `403 MSG-COM-01` | Không ticket/message/audit. |
| TC-20-02 | P0 | Owner farm SUSPENDED tạo `FARM_SERVICE/FARM` | `200`, `OPEN`, `NORMAL`, code `TK-...` | Message đầu PUBLIC đúng description; requester/farm đúng; notification/history/audit có. |
| TC-20-03 | P0 | `OWNER_A` tạo FARM ticket với `FARM_B` | `403 MSG-COM-01` | Không lộ farm B, không tạo ticket. |
| TC-20-04 | P1 | Subject 151 ký tự; description trắng | `400 COM-10 subject`; `400 COM-06 description` | Không lưu. |
| TC-20-05 | P0 | Owner A GET detail/messages ticket Owner B | `404 MSG-COM-08` | Chống dò ID; list A không có ticket B. |
| TC-20-06 | P0 | Ticket có CS_ONLY + internal request; Owner đọc | `200` | Chỉ PUBLIC; không internal request/note/context nội bộ. |
| TC-20-07 | P0 | CS1/CS2 CLAIM cùng expectedVersion đồng thời | Một `200`, một `409 COM-05` | Một assignee, một history claim, version tăng một lần. |
| TC-20-08 | P0 | CS không assigned gọi process/reply/note/resolve/close/create IR | `403 MSG-FE20-09` | Không đổi ticket/history/message. |
| TC-20-09 | P1 | Assignee HANDOVER thiếu reason | `400 MSG-COM-06` | Assignee/version giữ nguyên. |
| TC-20-10 | P1 | Thu hồi platform access của CS assigned | Ticket giữ status, assignee unavailable | Queue hiện cần chú ý; CS cũ mất quyền; CS khác claim theo rule. |
| TC-20-11 | P0 | WAITING_CUSTOMER; Owner reply đúng version | `200`, thành `IN_PROGRESS` | PUBLIC message, history/version/notification đúng. |
| TC-20-12 | P0 | RESOLVED; Owner reply | `200`, vẫn `RESOLVED` | Không tự reopen, resolution/ack giữ nguyên. |
| TC-20-13 | P0 | Có IR OPEN PM; tạo PM thứ hai rồi SA | PM: `409 FE20-16`; SA: `200` | Tối đa một OPEN mỗi targetRole. |
| TC-20-14 | P1 | Ticket OPEN chưa claim; tạo IR | `409 MSG-COM-05` | Không IR/outbox. |
| TC-20-15 | P0 | Có IR OPEN; CS resolve/close | `422 MSG-FE20-12` | Ticket/resolution/ack không đổi. |
| TC-20-16 | P0 | PM/SA đúng recipient GET IR | `200 InternalView` | Không hội thoại Owner-CS, CS_ONLY hay context ngoài quyền. |
| TC-20-17 | P0 | Reassign IR PM1→PM2; PM1 GET/complete | `403 MSG-FE20-19` | PM1 mất quyền ngay; cache replay không cấp lại dữ liệu. |
| TC-20-18 | P0 | Complete PERFORMED thiếu/sai audit ID | `404 MSG-COM-08` | IR vẫn OPEN, không history/notice completion. |
| TC-20-19 | P0 | Recipient complete hợp lệ | `200`, IR `DONE` | Ticket status không tự đổi; CS nhận notice; có IR_COMPLETED history. |
| TC-20-20 | P0 | Resolve v1, ack v1, resolve v2; close | `422 MSG-FE20-13` | Ack v1 không dùng cho v2; ticket RESOLVED. |
| TC-20-21 | P0 | Owner giữ v1 nhưng đã có v2; ack v1 | `409 MSG-FE20-05` | Không tạo ack cũ. |
| TC-20-22 | P1 | Ack hai lần cùng key; rồi key khác cùng version | Same key replay; key khác không tạo ack thứ hai | Một EFFECTIVE ack/version. |
| TC-20-23 | P0 | RESOLVED đã ack; Owner reopen có reason | `200`, thành `OPEN`, giữ assignee | Ack SUPERSEDED; reason là PUBLIC message; history/notice đúng. |
| TC-20-24 | P1 | Close đủ điều kiện nhưng reviewed=false | `422 MSG-COM-16` | Không close. |
| TC-20-25 | P0 | RESOLVED, latest ack EFFECTIVE, không IR OPEN; close | `200`, `CLOSED` | History, audit, Owner notification, version đúng. |
| TC-20-26 | P1 | RESOLVED nhiều ngày, Owner không ack | Không job tự close | Ticket không tự CLOSED. |
| TC-20-27 | P0 | CLOSED; Owner reply/reopen | `409 MSG-FE20-06` | Không message/version/history mới. |
| TC-20-28 | P0 | Create hai lần cùng key/body; cùng key khác body | Hai lần đầu cùng Ticket; body khác `409` | Một ticket/message/history/notification. |
| TC-20-29 | P0 | 25 PUBLIC + CS_ONLY; detail + page trước | Owner chỉ PUBLIC; CS cả hai; size 1..100 | Ghép trang không trùng/mất; order và nextBeforeId/hasMore đúng. |
| TC-20-30 | P0 | Category/scope theo D40 | ACCOUNT_ACCESS→ACCOUNT; PAYMENT/FARM_SERVICE→FARM; SYSTEM_USAGE/OTHER→cả hai | Sai ma trận `400`; FARM thiếu farm và ACCOUNT có farm đều lỗi; không lưu. |
| TC-20-31 | P1 | expectedVersion cũ trên mọi command | `409 MSG-COM-05` | Không side effect; replay cũ không ghi đè state mới. |
| TC-20-32 | P1 | Thiếu Idempotency-Key trên từng POST | `400` | Không mutate. |
| TC-20-33 | P2 | List theo q/category/tab/date/farm/priority/assignment/page | `200` | Counts và items theo toàn bộ filter, không vượt quyền, page ổn định. |
| TC-20-34 | P1 | Handover/reassign/cancel/release/classify với action/recipient sai | `400/404/409` đúng code | Rollback assignee/status/history/outbox. |

## 5. Feature 21 — Thu chi nền tảng

### 5.1 Payload theo code hiện tại

```json
// Tạo nháp: code bọc dữ liệu trong fields
{
  "fields": {
    "type": "INCOME",
    "category": "OTHER_INCOME",
    "amountVnd": 500000,
    "occurredOn": "2026-11-06",
    "scope": "GENERAL",
    "farmId": null,
    "documentNumber": "PT-001",
    "description": "Thu khác",
    "sourceType": "MANUAL"
  },
  "sourceEvidenceId": null
}

// Sửa nháp
{"fields":{"type":"EXPENSE","category":"SERVER_STORAGE","amountVnd":300000,"occurredOn":"2026-11-07","scope":"GENERAL","farmId":null,"documentNumber":"PC-001","description":"Máy chủ","sourceType":"MANUAL"},"sourceEvidenceId":null,"version":0}

// Post/discard/void/replacement
{"version":0,"reason":null,"amountVnd":null,"description":null}

// Báo cáo
{"dateFrom":"2026-11-01","dateTo":"2026-11-30","farmId":null,"sourceFilter":"ALL"}
```

`scope=GENERAL|FARM`; `sourceType=MANUAL|BANK_TRANSACTION`. Chọn nguồn ngân hàng thì gửi `sourceEvidenceId`; service lấy amount/date từ evidence và claim bằng `sourceReference`.

### 5.2 Bản đồ API

| Nhóm | API | Thành công |
|---|---|---|
| Biên lai | `GET /api/platform/finance/receipts`, `GET .../receipts/{paymentId}` | `200`, chỉ đọc |
| Danh mục/nguồn | `GET /api/platform/finance/categories`, `GET .../bank-transactions` | `200` |
| Khoản thu chi | `GET .../records`, `GET .../records/{id}`, `POST .../records`, `PUT .../records/{id}` | Create `201`, update `200` |
| Chuyển trạng thái | `POST .../{id}/discard`, `/post`, `/void`, `/replacement` | Replacement `201`, còn lại `200` |
| Báo cáo | `POST .../reports`, `GET .../reports/{id}`, `GET .../reports/latest`, `GET .../reports/{id}/xlsx` | Create `201`, GET `200` |

Mọi endpoint FE21 chỉ PM ACTIVE được dùng. POST/PUT bắt buộc CSRF và `Idempotency-Key`.

### 5.3 Kịch bản API đầy đủ

| ID | Pri | Tiền điều kiện và lời gọi | HTTP/logic mong đợi | Hậu kiểm |
|---|---|---|---|---|
| TC-21-01 | P0 | Anonymous/Owner/Manager/Tech/CS/SA gọi từng endpoint | Anonymous `401`; đã login không phải PM `403 COM-01` | Không lộ list/detail/XLSX, không mutate. |
| TC-21-02 | P1 | INCOME dùng category EXPENSE và ngược lại | `400 MSG-FE21-10 field=category` | Không record/history/audit. |
| TC-21-03 | P1 | amount 0, -5, 1000.5 | `400 MSG-FE21-09 field=amountVnd` | Chỉ số nguyên VND >0. |
| TC-21-04 | P1 | occurredOn ngày mai theo UTC+07 | `400 MSG-COM-10 field=occurredOn` | Không phụ thuộc ngày UTC. |
| TC-21-05 | P1 | FARM thiếu farmId; GENERAL có farmId | `400 MSG-COM-10 field=farmId` | Không lưu scope/farm lệch. |
| TC-21-06 | P0 | Evidence đã gắn Payment PAID/có quoteRef; tạo bank record | `409 MSG-FE21-08` | Không manual record/claim. |
| TC-21-07 | P0 | Evidence đã được record khác claim/POSTED dùng | `409 MSG-FE21-08` | Một sourceReference chỉ một owner. |
| TC-21-08 | P0 | DRAFT; PUT sửa rồi discard | `200`; cuối `DISCARDED` | History CREATE/EDIT/DISCARD, audit đúng; report không tính; claim giải phóng. |
| TC-21-09 | P0 | PUT record POSTED/VOID/DISCARDED | `409 MSG-COM-05` | Không sửa content/version/history. |
| TC-21-10 | P1 | Void POSTED thiếu reason hoặc >500 ký tự | `400 COM-06/COM-10` | Vẫn POSTED. |
| TC-21-11 | P0 | Void POSTED có bank source | `200`, `VOID` | Actor/time/reason/history/audit đúng; xóa claim; nguồn dùng lại được. |
| TC-21-12 | P0 | Replacement từ VOID | `201`, record mới `DRAFT` | Copy fields, link replacement; source mới MANUAL, record cũ giữ VOID. |
| TC-21-13 | P0 | Hai PM POST cùng DRAFT/version đồng thời | Một `200`, một `409 COM-05` | Một history POST, một audit FINANCE_RECORD_POSTED. |
| TC-21-14 | P0 | 1.2m receipt + 0.5m income + 0.3m expense + DRAFT + VOID; report | `201`; income=1.7m, expense=0.3m, net=1.4m | Snapshot criteria/summary/details bất biến. |
| TC-21-15 | P1 | Bank paid 23:30 31/10 giờ VN; report từ 01/11 | Không có dòng | Ngày nghiệp vụ UTC+07. |
| TC-21-16 | P0 | Có GENERAL + FARM_A; report farm A | Chỉ dữ liệu FARM_A | Không cộng GENERAL; totals/byScope khớp details. |
| TC-21-17 | P0 | Payment PENDING hoặc evidence HOLD/chưa ACCEPTED | Không tính | Receipt chỉ PAID+ACCEPTED; manual chỉ POSTED. |
| TC-21-18 | P0 | S1 có X; void X; tạo S2 | S1 vẫn có X, S2 loại X | JSON snapshot S1 không đổi theo live data. |
| TC-21-19 | P0 | Export S1 | `200`, MIME XLSX, Content-Disposition đúng | Mở được; đúng số S1; sheet Summary + Details. |
| TC-21-20 | P0 | Snapshot >30 ngày hoặc purged; GET/export | `410 MSG-FE21-12` | Không dựng file từ live data. |
| TC-21-21 | P1 | Kỳ không dữ liệu; run + export | `201`, totals 0; XLSX `200` | Đủ sheet/header, không lỗi list rỗng. |
| TC-21-22 | P1 | Kỳ >24 tháng, from>to, to tương lai | `400 MSG-COM-10 field=dateRange` | Không snapshot/audit. |
| TC-21-23 | P0 | GET receipt list/detail | `200`, Payment PAID | Không command sửa/hủy; payment/evidence không đổi. |
| TC-21-24 | P0 | POST DRAFT hợp lệ | `200`, `POSTED` | History POST + audit FINANCE_RECORD_POSTED đúng actor/target/farm. |
| TC-21-25 | P0 | Create/update bank DRAFT với IN/OUT hợp lệ | `201/200` | Amount/date lấy từ evidence; direction khớp; sourceReference/claim đúng. |
| TC-21-26 | P1 | Evidence unverified/quoted; IN→EXPENSE; OUT→INCOME | `409 MSG-FE21-08` | Không claim nguồn. |
| TC-21-27 | P1 | Version cũ trên update/discard/post/void/replacement | `409 MSG-COM-05` | Không đổi record/history/audit/claim. |
| TC-21-28 | P0 | Cùng idempotency key/body cho mọi command | Replay response đầu | Không trùng code/record/snapshot/history/audit. |
| TC-21-29 | P1 | Cùng key nhưng body khác | `409` | Không chạy body thứ hai. |
| TC-21-30 | P1 | Thiếu key hoặc CSRF trên POST/PUT | Thiếu key `400`; thiếu CSRF `403` | Không mutate. |
| TC-21-31 | P2 | GET records với mọi filter/page | `200 Page` | `state=VOID` gộp VOID+DISCARDED theo code; size 1..100; sort occurredOn/id desc. |
| TC-21-32 | P2 | GET bank-transactions | Chỉ VERIFIED, không quoteRef/Payment/claim | Sau discard/void nguồn xuất hiện lại. |
| TC-21-33 | P2 | GET receipts lọc q/farm/bankFrom/bankTo/page | Tiles theo toàn tập; items theo trang | bankTo<bankFrom `400`; sort bankPaidAt desc; detail non-PAID `404 COM-08`. |
| TC-21-34 | P1 | Ép lỗi sau save record trước history/audit/claim xong | Non-2xx | Rollback record/claim/history/audit; không draft mồ côi. |

## 6. Kịch bản xuyên Feature 01 → 20 → 21

### E2E-ALL-01 — Owner báo thanh toán, CS nhờ PM xử lý, PM ghi nhận kết quả

1. Đăng ký Owner bằng F01-A1, lấy verification link từ test mail store, gọi F01-A3 và giữ session sau redirect.
2. Hoàn tất F01-A8. Kiểm không có farm tự tạo; seed/gắn `FARM_A` cho phần nghiệp vụ.
3. Owner tạo ticket PAYMENT/FARM. Kiểm OPEN, PUBLIC message đầu, notification CS.
4. CS1 login qua CSRF, CLAIM ticket. Kiểm IN_PROGRESS và assignedCs=CS1.
5. CS1 lấy recipients role=PM, tạo internal request cho PM1 với context PAYMENT/FARM đúng ticket.
6. PM2 mở request phải `403 FE20-19`; PM1 mở được nhưng không thấy hội thoại Owner-CS.
7. PM1 tạo finance DRAFT và POST; kiểm audit FINANCE_RECORD_POSTED.
8. PM1 gọi domain-results, chọn audit ID vừa tạo, complete `PERFORMED`.
9. Kiểm IR DONE nhưng ticket vẫn IN_PROGRESS; CS1 nhận completion notice.
10. CS1 resolve v1; Owner đọc và acknowledge v1.
11. CS1 close với `reviewedAcknowledgment=true`, latest version.
12. Cuối luồng: ticket CLOSED; finance record POSTED; history đủ CLAIM/IR_CREATED/IR_COMPLETED/RESOLVED/CLOSED; Owner không thấy IR/CS_ONLY; actor đúng từng bước.

Nhánh sai bắt buộc:

- PM complete PERFORMED bằng audit của người khác/trước lúc IR tạo → `404 COM-08`, IR vẫn OPEN.
- CS resolve khi IR OPEN → `422 FE20-12`.
- CS close trước ack hoặc ack resolution cũ → `422 FE20-13`.
- Owner bị SUSPENDED giữa flow → request sau `403 FE01-03`, session bị hủy; ticket/finance không mất.

## 7. Kiểm tra dữ liệu sau API

| Feature | Đối tượng cần đọc lại | Điều phải chứng minh |
|---|---|---|
| FE01 | User, AppUser, link token, email job, HTTP session/session registry | Email chuẩn hóa, method state, token one-time/expiry, counter/lock, session invalidation, không lộ hash |
| FE20 | Ticket, message, resolution, acknowledgment, internal request, support history, audit, notification/outbox, idempotency command | State/version đúng một lần, audience/assignee/recipient đúng, transaction nguyên tử |
| FE21 | Finance record/history, bank claim, evidence/payment, snapshot, audit, idempotency command | State machine, claim duy nhất, snapshot bất biến, tổng tiền và actor đúng |

Case concurrency phải chạy hai request thật sự đồng thời bằng barrier/latch; gọi tuần tự không chứng minh khóa DB. Với report phải cộng lại từng `lines` rồi so `summary`, không chỉ so `netCashFlow`.

## 8. Thứ tự tự động hóa đề xuất

1. Helper CSRF + login + cookie store và fixture role/account.
2. P0 FE01: register/activate, login/lock, reset/change password, session invalidation.
3. State machine FE20 + quyền ẩn dữ liệu; sau đó idempotency, stale version, concurrency.
4. State machine FE21 + bank claim + snapshot math; sau đó XLSX/expiry.
5. `E2E-ALL-01` như integration suite xuyên feature.
6. P1/P2, contract drift và regression; báo cáo kèm request/response + DB readback.

Phân tầng: unit/service cho validation, transition, timezone, report math; MockMvc+DB cho session/CSRF/role/status/idempotency/history/audit; PostgreSQL integration cho lock/unique claim/concurrency; E2E/manual cho Google redirect, email link, cookie browser, XLSX.

## 9. Chênh lệch spec ↔ code cần giữ thành test contract

| Vấn đề | Spec | Code hiện tại | Cách test tạm thời |
|---|---|---|---|
| FE01 activation lỗi | JSON FE01-06 | `303` tới trang link hết hạn | Assert redirect + không mutate; mở issue contract nếu FE cần JSON |
| FE01 reset validate lỗi | FE01-06 | `200 {valid:false,email:null}` | Assert hiện tại và đánh dấu drift |
| FE01 request sau suspend | `401` | `403 MSG-FE01-03` | Assert 403 + invalid session; chốt tài liệu |
| FE01 resend quá giới hạn | “bị từ chối” | `200 nextAllowedAt`, không mail | Assert không mail; status là drift |
| FE20 queue filter | `assignee` | `assignment` | Collection dùng `assignment` |
| FE20 version | `version` | `expectedVersion`/`ticketVersion` | Gửi theo DTO code |
| FE20 field names | `toCsId`, `text`, `reviewedAck`, `contextRefs`, `domainRef` | `recipientId`, `content`, `reviewedAcknowledgment`, `context`, `domainResultAuditId` | Dùng code; thêm contract test chống drift |
| FE20 reopen | Có `resolutionVersion` | Chỉ reason + expectedVersion | Test stale ticket version; cần quyết định nếu phải khóa resolution |
| FE21 body | Mô tả phẳng | Bọc `fields` | Collection dùng body lồng |
| FE21 state VOID | Hiểu là chỉ VOID | Gộp VOID + DISCARDED | Assert code và xác nhận UX |

Không sửa kỳ vọng để “cho test xanh” khi gặp các dòng trên. Phải báo riêng lỗi triển khai, lỗi OpenAPI hoặc quyết định nghiệp vụ chưa thống nhất.

## 10. Nguồn đối chiếu

- `docs/REQUIREMENT_DECISIONS.md`: D39 (UTC+07), D40 (category/scope FE20).
- `docs/requirements/specs/FE-01-xac-thuc-tai-khoan.md` §7–9.
- `docs/requirements/specs/FE-20-ho-tro-khach-hang.md` §7–9.
- `docs/requirements/specs/FE-21-thu-chi-nen-tang.md` §7–9.
- `docs/api/openapi.json`.
- Code: `AccountResource`, `AuthenticateController`, `IdentityService`, `OwnerSupportResource`, `CsSupportResource`, `AssignedInternalSupportResource`, `SupportTicketCommandService`, `InternalSupportRequestService`, `PlatformSubscriptionResource`, `PlatformFinanceResource`, `PlatformFinanceService`.
- Test hiện có: `AuthenticateControllerIT`, `GoogleIdentityServiceTest`, `SupportTicketWorkflowTest`, `PlatformFinanceWorkflowTest`, `PlatformFinanceResourceTest`, `PlatformFinanceWorkbookTest`.
