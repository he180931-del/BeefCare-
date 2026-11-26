# Bản thử kịch bản API — UC-FE01-01 Đăng ký tài khoản Chủ trại

## 1. Mục tiêu và phạm vi

Kiểm thử trọn luồng một khách đăng ký bằng email và mật khẩu, chưa được đăng nhập trước khi xác minh email, mở liên kết xác minh, nhận phiên đăng nhập, hoàn tất hồ sơ Chủ trại và đọc lại trạng thái cuối.

```text
Lấy CSRF
→ Đăng ký
→ Thử đăng nhập trước xác minh và phải bị từ chối
→ Lấy liên kết từ email
→ Xác minh email
→ Đọc profile
→ Hoàn tất hồ sơ Owner
→ Đọc lại profile và DB
```

Use case kết thúc khi tài khoản có thể đăng nhập bằng password, `ownerRegistrationCompleted=true`, nhưng chưa tự có farm, membership, platform role hoặc subscription. Đăng xuất thuộc UC-FE01-03 nên không đưa vào luồng chính này.

## 2. Dữ liệu và tiền điều kiện

### Tài khoản thử

```text
fullName       = Nguyễn Văn A
email          = owner.uc01.<timestamp>@example.test
password       = Secret123
contactPhone   = 0900 000.000
normalizedPhone= 0900000000
```

Dùng email có timestamp để mỗi lần chạy độc lập. Trước bước đầu, xác nhận email chưa có trong `User` và `AppUser`.

### Biến được truyền giữa các bước

```text
{{xsrfToken}}          Token lấy từ GET /api/csrf
{{xsrfCookie}}         Cookie XSRF-TOKEN
{{email}}              Email đăng ký đã chuẩn hóa
{{verificationToken}}  Token lấy từ email test
{{sessionCookie}}      JSESSIONID được tạo sau activate
```

### Số liệu DB trước khi chạy

Ghi lại số lượng `User`, `AppUser`, verification token, email job, farm, farm membership, platform staff access và subscription. Các số liệu này dùng để chứng minh hệ thống không tạo thêm dữ liệu ngoài phạm vi UC.

## 3. Luồng API chính

### Bước 1 — Lấy CSRF cho request đăng ký

```http
GET /api/csrf
```

Mong đợi:

- HTTP `200`.
- Body có `token`; response có cookie `XSRF-TOKEN`.
- Lưu token vào `{{xsrfToken}}`, giữ cookie trong cookie jar.

Nếu không lấy được token thì dừng use case; không gửi request đăng ký không có CSRF rồi coi `403` là lỗi nghiệp vụ đăng ký.

### Bước 2 — Đăng ký tài khoản

```http
POST /api/register
Content-Type: application/json
X-XSRF-TOKEN: {{xsrfToken}}
Cookie: XSRF-TOKEN={{xsrfCookie}}

{
  "fullName": "Nguyễn Văn A",
  "email": "{{email}}",
  "password": "Secret123",
  "confirmPassword": "Secret123",
  "termsAccepted": true
}
```

Mong đợi response:

- HTTP `201`.
- Body chỉ cần trả `{"email":"{{email đã chuẩn hóa}}"}`.
- Không có `password`, `passwordHash`, token thô hoặc dữ liệu quyền.

Mong đợi DB ngay sau bước này:

- Tăng đúng một `User`; email được chuẩn hóa chữ thường; `activated=false`; password lưu dạng hash, không bằng chuỗi `Secret123`.
- Tăng đúng một `AppUser`; `accountStatus=ACTIVE`; `passwordLoginEnabled=true`; `passwordMethodStatus=PENDING_VERIFICATION`.
- `termsAccepted=true`, có thời điểm chấp nhận điều khoản.
- Có đúng một verification token chưa dùng, thời hạn khoảng 24 giờ.
- Có đúng một email job/link xác minh cho email này.
- Chưa có farm, membership, platform access hoặc subscription mới.

Lưu `response.email` vào `{{email}}` để các bước sau dùng đúng giá trị server trả về.

### Bước 3 — Chứng minh chưa được đăng nhập trước khi xác minh

Lấy CSRF nếu cookie hiện tại không còn hợp lệ, sau đó gọi:

```http
POST /api/authenticate
Content-Type: application/json
X-XSRF-TOKEN: {{xsrfToken}}

{
  "username": "{{email}}",
  "password": "Secret123",
  "rememberMe": false
}
```

Mong đợi:

- HTTP `401`.
- `code=MSG-FE01-11`.
- Không có authenticated session/JSESSIONID dùng được.
- `GET /api/account/profile` không được trả profile của tài khoản mới.
- User vẫn `activated=false`; verification token vẫn chưa dùng.

Bước này quan trọng: nếu bỏ qua, test chỉ chứng minh “đăng ký lưu được” nhưng chưa chứng minh quy tắc “phải xác minh email trước khi đăng nhập”.

### Bước 4 — Lấy liên kết xác minh từ email test

Đọc email job hoặc hộp thư test, lấy URL xác minh rồi tách query parameter `token` thành `{{verificationToken}}`.

Không tạo endpoint production để đọc token. Trong integration test Java có thể đọc email job/token fixture trực tiếp; trong Postman chạy tay thì copy link từ hộp thư test.

Kiểm tra nội dung email:

- Đúng người nhận `{{email}}`.
- Có đúng một link xác minh.
- Link không ghi password hoặc password hash.

### Bước 5 — Xác minh email

Tắt tự động follow redirect để kiểm đúng response đầu tiên:

```http
GET /api/activate?token={{verificationToken}}
```

Mong đợi response theo code hiện tại:

- HTTP `303 See Other`.
- Header `Location` kết thúc bằng `/owner-registration`.
- Server tạo session và trả JSESSIONID; lưu thành `{{sessionCookie}}`.

Mong đợi DB:

- `User.activated=true`.
- `AppUser.passwordMethodStatus=ACTIVE`.
- Verification token có `usedAt`; không dùng lại được.
- Counter đăng nhập sai bằng 0 và không còn thời điểm khóa.

### Bước 6 — Lấy CSRF trong session vừa được tạo

```http
GET /api/csrf
Cookie: JSESSIONID={{sessionCookie}}
```

Mong đợi `200`. Lưu token/cookie mới để dùng cho owner-registration. Không giả định CSRF của anonymous session trước activate còn hợp lệ với session mới.

### Bước 7 — Đọc profile sau xác minh

```http
GET /api/account/profile
Cookie: JSESSIONID={{sessionCookie}}
```

Mong đợi HTTP `200` và các điều kiện:

```text
email                         = {{email}}
emailVerified                 = true
passwordSignInEnabled         = true
hasPassword                   = true
signInMethods                 chứa PASSWORD
ownerRegistrationCompleted    = false
status                        = ACTIVE
platformRole                  = null
farms                         = []
```

Response không được chứa password/hash/token. Đây là trạng thái frontend dùng để mở màn hình hoàn tất hồ sơ, không phải dashboard farm.

### Bước 8 — Hoàn tất hồ sơ Chủ trại

```http
POST /api/account/owner-registration
Content-Type: application/json
X-XSRF-TOKEN: {{xsrfToken}}
Cookie: JSESSIONID={{sessionCookie}}; XSRF-TOKEN={{xsrfCookie}}

{
  "fullName": "Nguyễn Văn A",
  "contactPhone": "0900 000.000",
  "termsAccepted": true
}
```

Mong đợi:

- HTTP `200`.
- `email={{email}}`, `fullName=Nguyễn Văn A`, `contactPhone=0900000000`, `completed=true`.
- AppUser có `ownerRegistrationCompleted=true` và thời điểm hoàn tất.
- Không tạo farm, membership, platform role hoặc subscription.

### Bước 9 — Đọc lại trạng thái cuối

```http
GET /api/account/profile
Cookie: JSESSIONID={{sessionCookie}}
```

Mong đợi:

```text
emailVerified              = true
ownerRegistrationCompleted = true
contactPhone               = 0900000000
hasPassword                = true
signInMethods              = [PASSWORD]
platformRole               = null
farms                      = []
```

Cuối bước này mới kết luận luồng đăng ký hoàn tất.

## 4. Các nhánh kiểm thử trong use case

Các nhánh dùng cùng cấu trúc “chuẩn bị → gọi đúng bước bị ảnh hưởng → kiểm response → chứng minh không có side effect ngoài mong đợi”.

### Nhánh A — Validation form đăng ký

Chạy data-driven ở Bước 2:

| Dữ liệu | Kết quả |
|---|---|
| fullName 1 ký tự / 101 ký tự | `400 MSG-COM-10`, field `fullName` |
| fullName toàn khoảng trắng | `400 MSG-COM-06`, field `fullName` |
| email sai định dạng | `400 MSG-COM-10`, field `email` |
| password 7 / 129 ký tự | `400 MSG-FE01-08` |
| password trùng email, kể cả khác hoa thường | `400 MSG-FE01-08` |
| confirmPassword khác password | `400 MSG-FE01-09` |
| termsAccepted=false | `400 MSG-FE01-14` |

Sau mỗi dòng, số User/AppUser/token/mail không đổi.

### Nhánh B — Email đã tồn tại hoặc hai request đăng ký đồng thời

- Đăng ký email `A@X.vn` khi đã có `a@x.vn` → `409 MSG-FE01-10`.
- Gửi đồng thời hai request hợp lệ cùng email → chỉ một request `201`; request còn lại `409`; DB chỉ có một User và một AppUser.

### Nhánh C — Gửi lại email xác minh

1. Sau Bước 2, gọi `POST /api/account/verification/resend` với email vừa đăng ký.
2. Nếu còn trong 60 giây, response hiện tại vẫn `200 {nextAllowedAt}` nhưng không tạo token/mail mới.
3. Sau cooldown, resend tạo token mới và invalid token cũ.
4. Mở token cũ → redirect link hết hạn; mở token mới → activate thành công.
5. Sau 5 email trong một giờ, lần tiếp theo không tạo email mới; code hiện tại trả `200 nextAllowedAt` dù spec mô tả “bị từ chối”. Ghi đây là contract drift, không đổi kỳ vọng âm thầm.

### Nhánh D — Token hết hạn, token đã dùng

- Dịch clock tới sau 24 giờ rồi gọi Bước 5 → `303` tới trang link không còn hiệu lực; User vẫn chưa activated.
- Sau khi activate thành công, gọi lại cùng token → không tạo session/activation lần hai.

### Nhánh E — CSRF và session

- Bước 2 hoặc Bước 8 thiếu/sai CSRF → `403`; DB không đổi.
- Bước 8 không có authenticated session → `401`.
- Dùng CSRF token của session khác → `403`.

### Nhánh F — Lỗi transaction/email

Ép lỗi khi lưu AppUser, tạo token hoặc queue email. Request phải non-2xx và không để lại User, AppUser, token hay email job dở dang. Nếu hạ tầng email gửi ngoài transaction, ghi rõ phần nào có thể retry thay vì giả định rollback toàn bộ.

## 5. Hậu kiểm dữ liệu

| Đối tượng | Trước đăng ký | Sau Bước 2 | Sau Bước 5 | Sau Bước 9 |
|---|---|---|---|---|
| User | Không có | Có, activated=false | activated=true | activated=true |
| AppUser | Không có | ACTIVE, password PENDING_VERIFICATION | password ACTIVE | ownerRegistrationCompleted=true |
| Verification token | Không có | Một token chưa dùng | usedAt có giá trị | Giữ lịch sử, không tái sử dụng |
| Email job | Không có | Một email xác minh | Không tăng do activate | Không tăng do hoàn tất profile |
| Session | Không authenticated | Không authenticated | Có session đã login | Session vẫn dùng được |
| Farm | 0 liên quan | 0 | 0 | 0 |
| Membership | 0 liên quan | 0 | 0 | 0 |
| Platform access | 0 liên quan | 0 | 0 | 0 |
| Subscription | 0 liên quan | 0 | 0 | 0 |

## 6. Điều kiện use case đạt

Use case chỉ đạt khi đồng thời thỏa tất cả điều kiện:

- Luồng chính từ Bước 1 đến Bước 9 chạy đúng thứ tự và đúng status/body/header/cookie.
- Không thể login trước xác minh; login/session có hiệu lực sau xác minh.
- Profile trung gian và profile cuối phản ánh đúng hai giai đoạn `ownerRegistrationCompleted=false → true`.
- Password không xuất hiện ở response/log và DB không lưu plaintext.
- Không có farm, membership, platform role hoặc subscription được tạo ngầm.
- Các nhánh validation, duplicate, resend, token hết hạn, CSRF và rollback không để side effect dở dang.
- Mọi chênh lệch giữa spec và code được báo thành contract drift, không sửa expected chỉ để test xanh.

## 7. Gợi ý tự động hóa

```text
Postman folder: UC-FE01-01 Register Owner
  00 Baseline / health
  01 Get CSRF
  02 Register
  03 Login before verification — expect fail
  04 Activate email
  05 Get CSRF authenticated
  06 Get profile before owner completion
  07 Complete owner registration
  08 Get final profile
```

Postman phù hợp để đọc và chạy luồng. MockMvc integration test chịu trách nhiệm assert route, JSON, CSRF, session và error code. Service/PostgreSQL integration test chịu trách nhiệm DB readback, rollback và hai request đăng ký đồng thời.

Ví dụ post-response script ở request Register:

```javascript
pm.test("đăng ký trả 201", () => pm.response.to.have.status(201));
const body = pm.response.json();
pm.expect(body.email).to.eql(pm.iterationData.get("expectedEmail"));
pm.expect(body).not.to.have.property("password");
pm.expect(body).not.to.have.property("passwordHash");
pm.collectionVariables.set("registeredEmail", body.email);
```

DB assertions không đặt trong Postman production collection. Chúng nằm trong integration test hoặc test-only inspection có kiểm soát.
