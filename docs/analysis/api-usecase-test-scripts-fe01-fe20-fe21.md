# Kịch bản kiểm thử API theo Use Case — Feature 01, 20, 21

## 1. Cách chạy kịch bản

Đây là tài liệu chạy test theo luồng nghiệp vụ, không phải danh sách endpoint rời. Mỗi use case phải chạy từ trên xuống. Dữ liệu trả về ở bước trước được lưu thành biến cho bước sau; sau API cuối phải đọc lại DB và gọi API GET để chứng minh trạng thái cuối.

Quy ước biến: `{{baseUrl}}`, `{{csrfToken}}`, `{{sessionCookie}}`, `{{idempotencyKey}}`, `{{farmId}}`, `{{ticketId}}`, `{{ticketVersion}}`, `{{resolutionVersion}}`, `{{internalRequestId}}`, `{{recordId}}`, `{{recordVersion}}`, `{{snapshotId}}`.

```text
LOGIN(role)
1. GET /api/csrf
   Lưu body.token → {{csrfToken}} và cookie XSRF-TOKEN.
2. POST /api/authenticate
   Header X-XSRF-TOKEN: {{csrfToken}}
   Body: {username, password, rememberMe:false}
   Mong đợi: 204; lưu JSESSIONID → {{sessionCookie}}.
3. GET /api/account/profile bằng {{sessionCookie}}
   Mong đợi: 200; kiểm đúng account, platformRole, farms và permissions.
```

Mọi POST/PUT dùng CSRF. Command FE20/FE21 còn phải có `Idempotency-Key`. Mỗi nhánh sai phải kiểm không có bản ghi, history, audit, notification, outbox hoặc claim nguồn phát sinh dở dang.

## 2. Feature 01 — Xác thực và tài khoản

### UC-FE01-01 — Đăng ký tài khoản Chủ trại

**Mục tiêu:** khách tạo tài khoản password, xác minh email, hoàn tất hồ sơ Owner. Kết thúc UC này tài khoản đăng nhập được nhưng chưa tự có trại, membership, platform role hay subscription.

**Kịch bản chính**

1. `GET /api/csrf`; lưu token và cookie.
2. `POST /api/register` với CSRF:

   ```json
   {"fullName":"Nguyễn Văn A","email":"Owner.A@Example.test","password":"Secret123","confirmPassword":"Secret123","termsAccepted":true}
   ```

   Mong đợi `201 {"email":"owner.a@example.test"}`. DB có đúng một User chưa activated, một AppUser ACTIVE với password method `PENDING_VERIFICATION`, một token 24 giờ và một email job.
3. Ngay sau đăng ký, thử `POST /api/authenticate` bằng email/password vừa tạo. Mong đợi `401 MSG-FE01-11`; chưa được có login session vì email chưa xác minh.
4. Lấy verification token từ test mail store, gọi `GET /api/activate?token={{verificationToken}}`. Mong đợi `303` tới `/owner-registration` và có JSESSIONID mới. Token được đánh dấu đã dùng, User activated, password method ACTIVE.
5. Dùng session vừa tạo gọi `GET /api/account/profile`. Mong đợi `200`, `emailVerified=true`, `ownerRegistrationCompleted=false`, `hasPassword=true`, chưa có farm/platform role.
6. Lấy CSRF mới trong session rồi `POST /api/account/owner-registration`:

   ```json
   {"fullName":"Nguyễn Văn A","contactPhone":"0900 000.000","termsAccepted":true}
   ```

   Mong đợi `200`, phone chuẩn hóa `0900000000`, `completed=true`.
7. Gọi lại `GET /api/account/profile`. Mong đợi `ownerRegistrationCompleted=true`; số farm, membership, platform access và subscription vẫn bằng 0.

**Nhánh API bắt buộc**

- Đăng ký lại email khác hoa/thường → `409 MSG-FE01-10`, không tài khoản thứ hai.
- Full name, email, password, confirm password, terms sai biên → đúng `MSG-COM-06/10`, `MSG-FE01-08/09/14`; DB không lưu nửa chừng.
- Verification token quá 24 giờ hoặc token cũ sau resend → redirect link hết hạn; token mới vẫn dùng được.
- Resend trong 60 giây hoặc quá 5 lần/giờ → response có `nextAllowedAt`, không tạo mail/token vượt giới hạn.
- Ép lỗi lưu/mail trong transaction → không còn User/AppUser/token/job mồ côi.

### UC-FE01-02 — Đăng nhập

**Mục tiêu:** xác thực thành công, tạo session đúng thời hạn, sau đó đọc profile để frontend biết phải đi màn hình nào.

**Kịch bản chính**

1. Tài khoản đã verified và ACTIVE. `GET /api/csrf`.
2. `POST /api/authenticate` với email có thể khác hoa/thường:

   ```json
   {"username":"Owner.A@Example.test","password":"Secret123","rememberMe":false}
   ```

   Mong đợi `204`; lưu JSESSIONID. Session timeout là 28.800 giây.
3. `GET /api/authenticate` bằng session mới → `204`.
4. `GET /api/account/profile` → `200`. Sau đăng nhập bắt buộc kiểm response này, không điều hướng chỉ dựa vào dữ liệu client cũ.
5. Chọn luồng từ profile:
   - `ownerRegistrationCompleted=false` → frontend mở Owner registration.
   - Có `platformRole=PM|CS|SA` → frontend mở khu vực nền tảng tương ứng.
   - Có nhiều farm → frontend mở chọn farm.
   - Có một farm với role Technician → frontend mở khu vực kỹ thuật viên.
   - Không farm, không platform role → hiện trạng thái chưa gắn trại; không tự tạo/chấp nhận membership.
6. Nếu chọn một farm, gọi `GET /api/farms/{{farmId}}/my-permissions`; dùng role/permission từ server để mở chức năng.

**Nhánh API bắt buộc**

- Email không tồn tại và password sai đều `401 MSG-FE01-01`, body cùng kiểu để chống dò tài khoản.
- Email chưa verified → `401 MSG-FE01-11`, không session.
- Sai password 4 lần rồi đúng → login thành công, counter về 0.
- Sai lần 5 → `423 MSG-FE01-02` có thời điểm mở; nhập đúng trước 15 phút vẫn bị khóa.
- Sau 15 phút nhập đúng → `204`, xóa counter/lock.
- Trong lúc password bị khóa, Google sign-in vẫn thành công.
- Account SUSPENDED → `403 MSG-FE01-03`, không session; một session đang hoạt động cũng bị invalid ở request tiếp theo sau khi suspend.
- `rememberMe=true` → cookie/session tối đa 30 ngày; ngày 29 còn dùng được.
- Google lần đầu → tạo/link đúng một account, `ownerRegistrationCompleted=false`; một Google subject không được chuyển sang account khác.

### UC-FE01-03 — Đăng xuất

1. Thực hiện `LOGIN(OWNER_A)` và xác nhận `GET /api/account/profile` trả `200`.
2. Lấy CSRF trong cùng session; `POST /api/logout` → `204`.
3. Dùng lại JSESSIONID gọi `GET /api/authenticate` và `GET /api/account/profile` → `401`.
4. Kiểm server session/session registry không còn phiên. Trong E2E, selected farm phía client phải được xóa và quay về màn đăng nhập.
5. Nhánh sai: logout thiếu CSRF → `403`, session vẫn còn dùng được; logout không session → `401`.

### UC-FE01-04 — Xem và sửa hồ sơ của tôi

1. `LOGIN(OWNER_A)`; `GET /api/account/profile`, lưu email, farm roles và permissions trước sửa.
2. `POST /api/account/profile`:

   ```json
   {"fullName":"Nguyễn Văn A Mới","contactPhone":"+84912345678","email":"attacker@example.test"}
   ```

   Mong đợi `200`; fullName/phone đổi, email không đổi dù client gửi thêm field.
3. `GET /api/account/profile` lại để xác nhận readback; kiểm DB User/AppUser đồng bộ tên, email giữ nguyên, không có credential field.
4. Với từng farm trong profile, gọi `GET /api/farms/{farmId}/my-permissions`; chỉ membership ACTIVE mới `200`. Farm người khác → `403 MSG-COM-01`.
5. Nhánh validation: fullName trắng/1/101 ký tự, phone sai → `400` đúng field; profile cũ giữ nguyên toàn bộ.

### UC-FE01-05 — Đặt lại mật khẩu đã quên

1. Chuẩn bị account có hai session P1/P2 và password đang có counter/lock.
2. Không cần login: lấy CSRF rồi `POST /api/account/reset-password/init`:

   ```json
   {"email":"owner.a@example.test"}
   ```

   Mong đợi `200`. Gọi thêm với email không tồn tại cũng phải cùng status/body kiểu; chỉ account tồn tại mới có reset token/mail.
3. Lấy reset token từ test mail store; `GET /api/account/reset-password/validate?token={{resetToken}}` → `200 {valid:true,email}`.
4. `POST /api/account/reset-password/finish` với CSRF:

   ```json
   {"key":"{{resetToken}}","newPassword":"NewSecret123","confirmPassword":"NewSecret123"}
   ```

   Mong đợi `200`; token used, hash đổi, counter/lock xóa, email cảnh báo được tạo.
5. Dùng P1/P2 gọi profile → cả hai bị từ chối. Đặt lại mật khẩu phải kết thúc mọi session.
6. Login bằng password cũ → `401`; login bằng password mới → `204`.

**Nhánh API bắt buộc**

- Token quá 30 phút/đã dùng → validate trả `{valid:false,email:null}`; finish trả `400 MSG-FE01-06`; hash không đổi.
- Password mới sai rule hoặc confirm lệch → `400 FE01-08/09`; token chưa được consume để người dùng sửa và thử lại theo contract mong muốn.
- Google-only request reset → `200`, chỉ mail hướng dẫn Google, không tạo password/reset token.
- Account SUSPENDED reset thành công nhưng login mới vẫn `403 FE01-03`.
- Gửi init lặp trong 60 giây/quá 5 lần giờ → không phát mail/token vượt giới hạn.

### UC-FE01-06 — Đổi mật khẩu hoặc thêm mật khẩu đầu tiên

**Đổi password đang có**

1. Tạo hai session P1/P2 của cùng account; dùng P1 gọi profile để lấy trạng thái hiện tại.
2. Lấy CSRF P1; `POST /api/account/change-password`:

   ```json
   {"currentPassword":"Secret123","newPassword":"NewSecret123","confirmPassword":"NewSecret123"}
   ```

   Mong đợi `200`; hash đổi, counter/lock xóa, mail cảnh báo được tạo.
3. P1 gọi profile vẫn `200`; P2 gọi profile bị từ chối. Đổi password chỉ giữ session hiện tại.
4. Login mới: password cũ thất bại, password mới thành công.
5. Sai current password 4 lần → `400 MSG-FE01-16`; lần tiếp theo phải khóa password sign-in và trả `423 FE01-02`. Không được rollback counter.

**Thêm password đầu tiên cho Google-only**

1. `LOGIN(OWNER_GOOGLE)` qua Google; profile cho `hasPassword=false`, signInMethods chỉ GOOGLE.
2. `POST /api/account/google-reauthentication` với `{returnTo:"/ho-so"}` → `204`; hoàn tất OAuth Google lại trong ≤5 phút.
3. Trong cùng session, `POST /api/account/change-password` với `currentPassword=null`, password mới + confirm → `200`.
4. Profile mới có GOOGLE và PASSWORD; logout rồi login bằng email/password phải thành công.
5. Nếu Google reauthentication cách >5 phút hoặc chưa làm → `403 MSG-COM-01 reason=google_reauthentication_required`; không thêm password.

## 3. Feature 20 — Hỗ trợ khách hàng

### UC-FE20-01 — Owner tạo ticket

### UC-FE20-02 — Owner xem ticket của mình

### UC-FE20-03 — Owner trả lời ticket

### UC-FE20-04 — Owner xác nhận đã giải quyết

### UC-FE20-05 — Owner mở lại ticket đã giải quyết

### UC-FE20-06 — CS xem hàng đợi

### UC-FE20-07 — CS nhận, bàn giao, phân loại và đổi trạng thái

### UC-FE20-08 — CS trả lời công khai

### UC-FE20-09 — CS ghi chú nội bộ

### UC-FE20-10 — CS ghi kết quả giải quyết

### UC-FE20-11 — CS đóng ticket

### UC-FE20-12 — CS tạo, đổi người nhận hoặc hủy yêu cầu nội bộ

### UC-FE20-13 — PM hoặc SA xử lý yêu cầu nội bộ được giao

## 4. Feature 21 — Thu chi nền tảng

### UC-FE21-01 — Xem biên lai gói và truy nguồn

### UC-FE21-02 — Tạo khoản thu hoặc chi thủ công

### UC-FE21-03 — Xem và lọc khoản thủ công

### UC-FE21-04 — Sửa nháp

### UC-FE21-05 — Bỏ nháp

### UC-FE21-06 — Ghi sổ

### UC-FE21-07 — Hủy khoản đã ghi sổ và tạo bản thay thế

### UC-FE21-08 — Chạy báo cáo dòng tiền

### UC-FE21-09 — Xuất XLSX từ snapshot đang hiển thị

## 5. Kịch bản xuyên Feature 01 → 20 → 21

## 6. Kiểm tra chung sau mỗi use case

## 7. Nguồn đối chiếu
