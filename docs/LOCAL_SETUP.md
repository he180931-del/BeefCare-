# Chạy BeefCare ở máy local

Tài liệu này gom cách chạy local và cấu hình tích hợp (email, Google, SePay) vào một chỗ. Lệnh chạy test backend xem `backend/AGENTS.md`; cách kiểm UI và lệnh test frontend xem `docs/agent-context/VERIFICATION.md`.

## 1. Chuẩn bị

- JDK 21, Docker, Node.js. Backend dùng Maven Wrapper trong `backend/` (`mvnw.cmd` trên Windows, `./mvnw` trên macOS/Linux).
- Tạo `.env` ở gốc repo từ `.env.example` rồi điền giá trị local. **Không commit `.env`.**
  - `BEEFCARE_DB_PASSWORD`: mật khẩu PostgreSQL local, compose bắt buộc có.
  - `BEEFCARE_DEV_PASSWORD`: mật khẩu chung của các tài khoản seed, tối thiểu 12 ký tự và không bắt đầu bằng `replace-with-`. Thiếu thì backend dừng khi khởi động profile `local`.
  - `BEEFCARE_LINK_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự, chỉ ở server.
  - `BEEFCARE_PUBLIC_URL` (origin frontend), `BEEFCARE_BACKEND_URL` (origin backend, dùng cho link kích hoạt email), `BEEFCARE_CORS_ORIGINS`.
- Profile `local` tự nạp `../.env` (`spring.config.import: optional:file:../.env[.properties]` trong `application-local.yml`), nên chạy backend từ thư mục `backend/`.

## 2. Hạ tầng: PostgreSQL và Mailpit

Từ gốc repo (Docker Compose tự đọc `.env` ở gốc):

```bash
docker compose -f compose.backend.yml up -d --wait
```

| Dịch vụ | Địa chỉ |
|---|---|
| PostgreSQL `postgres:16.15` | `localhost:15432`, database và user `beefcare` |
| Mailpit giao diện | <http://localhost:8025> |
| Mailpit SMTP | `localhost:1025` |
| Backend | <http://localhost:8080> |
| Frontend (Vite) | <http://localhost:5173> mặc định |

Các cổng chỉ bind `127.0.0.1`. Không reset volume `beefcare-base-data` hay xóa checksum Liquibase để che lỗi migration.

## 3. Backend

Windows (PowerShell):

```powershell
cd backend
.\mvnw.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dspring-boot.run.profiles=dev,local' spring-boot:run
```

macOS/Linux:

```bash
cd backend
./mvnw --batch-mode '-Pdev,!webapp' -Dspotless.skip=true -Djacoco.skip=true -Dspring-boot.run.profiles=dev,local spring-boot:run
```

Thêm profile `api-docs` (ví dụ `dev,local,api-docs`) khi cần `/v3/api-docs/beefcare`; endpoint này cần quyền tài liệu, tài khoản `sa@beefcare.local` có sẵn.

Chạy từ file jar đã build: chạy ở gốc repo thì `../.env` không trỏ đúng, nên truyền biến môi trường trực tiếp:

```bash
SPRING_PROFILES_ACTIVE=dev,local,secret-samples,api-docs \
SPRING_DOCKER_COMPOSE_ENABLED=false \
BEEFCARE_DB_PASSWORD="$BEEFCARE_DB_PASSWORD" \
BEEFCARE_DEV_PASSWORD="$BEEFCARE_DEV_PASSWORD" \
BEEFCARE_LINK_SECRET="$BEEFCARE_LINK_SECRET" \
java -jar backend/target/beefcare-0.0.1-SNAPSHOT.jar
```

Lưu ý:

- `-Pdev,!webapp` tránh Maven tải và build webapp JHipster cũ.
- `-Djacoco.skip=true` chỉ tắt coverage (JaCoCo từng làm JVM crash trên đường dẫn Windows có dấu), không bỏ chạy test.
- Nếu Modernizer chặn một bản build hợp lệ, dùng `-Dmodernizer.skip=true` và ghi rõ đã bỏ cổng kiểm này; không sửa hàng loạt code legacy không liên quan.
- Cổng 8080 bận: thêm `'-Dspring-boot.run.arguments=--server.port=8090'`, đặt `BEEFCARE_BACKEND_URL` theo cổng mới, và đổi `target` của proxy trong `frontend/vite.config.js` (đang cố định `127.0.0.1:8080`).
- Biểu thức cron có dấu cách phải truyền qua biến môi trường, không qua `spring-boot.run.arguments`. Ví dụ `BEEFCARE_JOBS_RETENTION_CRON` ứng với `beefcare.jobs.retention-cron`; các khóa khác: `invitation-expiry-cron`, `reminder-reconcile-cron`, `payment-expiry-cron`, `subscription-coverage-cron`, `subscription-notice-cron`.
- `-Dliquibase.analytics.enabled=false` tắt gửi analytics của Liquibase.
- Không chạy nhiều Maven cùng lúc trên một `backend/target`.

## 4. Frontend

```bash
cd frontend
npm install
npm run dev          # chế độ theo frontend/.env (xem bên dưới)
npm run dev:mock     # mọi màn hình chạy bằng dữ liệu mock, không cần backend, cổng 5174
```

Khi cần mở từ thiết bị khác hoặc chạy kiểm runtime: `npm run dev -- --host 0.0.0.0 --port 5174`.

Cấu hình `frontend/.env` (không commit). Vite chỉ đọc `.env`, không đọc `.env.example`; chưa có `.env` thì `npm run dev` chạy adapter local, không gọi backend.

- `VITE_BEEFCARE_DATA_SOURCE=backend` dùng backend thật; giá trị khác hoặc để trống dùng adapter local. `VITE_BEEFCARE_FARM_ID` là ID số của trại trên backend.
- `VITE_BEEFCARE_API_URL` **để trống**: request đi theo đường dẫn tương đối `/api` qua proxy của Vite tới `127.0.0.1:8080`. Đây là cách đúng theo quy tắc dự án (không hardcode origin).
- Nếu đặt `VITE_BEEFCARE_API_URL` (ví dụ `http://localhost:8080`), trình duyệt gọi thẳng backend, bỏ qua proxy, và backend phải cho phép origin của frontend qua `BEEFCARE_CORS_ORIGINS` (mặc định ở profile `local`: `localhost:5173`, `127.0.0.1:5173`, `localhost:3000`).
- Dùng cùng hostname cho frontend và backend: cookie của `localhost` và `127.0.0.1` là khác nhau. Cookie production cần HTTPS.

## 5. Tài khoản và dữ liệu seed

`LocalDevelopmentSeeder` chỉ chạy ở profile `local`. Mỗi lần khởi động, nó tạo lại tài khoản còn thiếu, đặt mật khẩu bằng `BEEFCARE_DEV_PASSWORD` và mở khóa đăng nhập. Đổi biến này thì khởi động lại backend.

| Email | Vai trò | Trại |
|---|---|---|
| `owner@beefcare.local` | Owner | BeefCare Local Farm A |
| `manager@beefcare.local`, `manager-2@beefcare.local` | Manager | Farm A |
| `technician@beefcare.local`, `technician-2@beefcare.local` | Technician | Farm A |
| `owner-2@beefcare.local` | Owner | BeefCare Local Farm C |
| `other-owner@beefcare.local` | Owner | BeefCare Local Farm B (khác chủ, dùng để thử cách ly giữa các trại) |
| `cs@beefcare.local` | CS (nền tảng) | – |
| `pm@beefcare.local` | PM (nền tảng) | – |
| `sa@beefcare.local` | SA (nền tảng), có thêm quyền xem tài liệu API | – |

Ba trại ở trạng thái ACTIVE, múi giờ `Asia/Ho_Chi_Minh`, có danh mục khởi tạo. Không ghi mật khẩu, token, cookie hay nội dung `.env` vào tài liệu hoặc Git. Các tài khoản này chỉ dùng ở local.

## 6. Email

**Local.** Profile `local` chọn adapter SMTP gửi tới Mailpit (`localhost:1025`); xem thư tại <http://localhost:8025>. Mailpit giữ thư tại máy, không gửi ra ngoài. Dùng nó để xem các mẫu tiếng Việt: xác thực, đặt lại mật khẩu, lời mời vào trại, thông báo, kể cả bản plain-text và thời hạn link. Profile `dev` và `testh2` không có `local` dùng `MockEmailDelivery` trong bộ nhớ, trừ khi đặt `beefcare.email.provider=smtp`. Hộp thư local không có API.

**Bảo mật link.** Job gửi email chỉ lưu người nhận, mã mẫu và tham chiếu tới bản ghi nguồn, không lưu link. Bảng token tài khoản và lời mời giữ hash SHA-256 cùng nonce ngẫu nhiên. Link được tạo lúc gửi bằng HMAC-SHA256 với khóa chỉ ở server, đối chiếu với hash rồi gửi sau khi transaction commit. Job lỗi được thử lại với backoff sau khi khởi động lại. Đổi `BEEFCARE_LINK_SECRET` làm mất hiệu lực các link đang chờ; khi đó phải gửi link mới. Backend không được dựng link từ header `Host` của request.

**SMTP production.** Profile `prod` gửi trực tiếp Internet qua Gmail SMTP (`smtp.gmail.com:587`) từ `BeefCare@gmail.com`; Mailpit không được dùng ở production. Đặt `BEEFCARE_EMAIL_PROVIDER=smtp` cùng `BEEFCARE_SMTP_USERNAME=BeefCare@gmail.com`, `BEEFCARE_SMTP_PASSWORD` (Google App Password), `BEEFCARE_SMTP_AUTH=true`, `BEEFCARE_SMTP_STARTTLS_ENABLE=true`, `BEEFCARE_SMTP_STARTTLS_REQUIRED=true`, `BEEFCARE_MAIL_FROM=BeefCare@gmail.com`, `BEEFCARE_PUBLIC_URL`, `BEEFCARE_BACKEND_URL` và `BEEFCARE_LINK_SECRET` trong kho secret của môi trường triển khai. App Password chỉ tạo được sau khi bật xác minh 2 bước; không dùng mật khẩu Gmail chính. Timeout kết nối, đọc và ghi là 5 giây. Adapter thử nhanh 3 lần, sau đó job gửi bền vững thử lại với backoff tăng dần có giới hạn. Địa chỉ gửi lấy từ `jhipster.mail.from` và phải được nhà cung cấp mail cho phép. Tham khảo: [Spring Boot email](https://docs.spring.io/spring-boot/reference/io/email.html).

## 7. Đăng nhập Google

Mặc định tắt. Bật bằng `BEEFCARE_GOOGLE_ENABLED=true` cùng `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID` và `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET` trong kho secret. Scope `openid`, `email`, `profile`. Đăng ký đúng callback `https://<backend-host>/login/oauth2/code/google` với Google, không nhận host tùy ý. Backend yêu cầu email đã xác minh, liên kết theo Google subject đã có hoặc theo email trùng, tạo session BeefCare phía server và không nhận hay lưu mật khẩu Google. Không commit client secret.

## 8. SePay và VietQR

- **Webhook:** `POST /api/webhooks/sepay`. Kiểm chữ ký trên đúng raw body bằng `X-SePay-Timestamp` (giây Unix) và `X-SePay-Signature: sha256=<hex>`, HMAC-SHA256 trên `<timestamp>.<raw-body>`, so sánh constant-time, lệch giờ tối đa 300 giây. Sai chữ ký trả 401 và không lưu dữ liệu ngân hàng. Sự kiện hợp lệ được lưu và đánh giá ngay trong cùng transaction; response có các trường success, duplicate, evidence, review và payment. Môi trường, namespace tài khoản và ảnh chụp tài khoản nhận trong báo giá được kiểm trước khi ghi nhận thanh toán. Mã giao dịch trùng với payload giống hệt thì trả lại kết quả cũ; payload khác thì trả 409. Bằng chứng không khớp an toàn nằm lại hàng chờ PM duyệt.
- **Giả lập local:** `POST /api/dev/sepay/events`, chỉ PM dùng, chỉ có ở profile `dev`, `local`, `testh2` khi môi trường là `MOCK` hoặc `TEST`. Nó đi qua đúng luồng bằng chứng và xác nhận như webhook. Không có ở `prod`. Mặc định `BEEFCARE_SEPAY_ENVIRONMENT=MOCK`, namespace `LOCAL-MOCK`; khi chưa cấu hình tài khoản nhận thì dùng tài khoản giả, không chuyển tiền thật.
- **Tra cứu giao dịch:** dùng `Authorization: Bearer <API_TOKEN>` (`BEEFCARE_SEPAY_API_TOKEN`), giữ token ở server, timeout có giới hạn (`BEEFCARE_SEPAY_API_TIMEOUT`, mặc định 5s). Đổi tài khoản nhận thì đặt namespace mới; báo giá cũ giữ nguyên môi trường, namespace và tài khoản lúc tạo.
- **Job:** JOB-03 cho yêu cầu thanh toán hết hạn mỗi 5 phút, khóa theo trại, gói và thanh toán để không chạy chồng với xác nhận. Sự kiện có giờ chuyển khoản nằm trong cửa sổ báo giá ban đầu vẫn ghi nhận được yêu cầu đã `EXPIRED` nếu webhook đến trễ; chuyển khoản từ lúc hết hạn trở đi thì không. JOB-04 tính lại thời hạn dịch vụ mỗi 15 phút và giữ nguyên trạng thái tạm ngưng do PM đặt.
- **VietQR:** ảnh QR tạo từ ảnh chụp tài khoản, số tiền và nội dung của yêu cầu thanh toán, ví dụ `https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=...` hoặc `https://new.vietqr.app/img`.
- Đọc tài liệu gốc trước khi bật adapter thật: [xác thực webhook](https://developer.sepay.vn/en/sepay-webhooks/xac-thuc), [payload webhook](https://docs.sepay.vn/tich-hop-webhooks.html), [API giao dịch](https://docs.sepay.vn/api-giao-dich.html), [tạo QR](https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code). Các link này là tài liệu tham khảo, không phải cho phép gọi tài khoản thật.

## 9. Kiểm tra an toàn ở local

1. Chạy compose, xác nhận PostgreSQL và Mailpit healthy.
2. Chạy backend với `dev,local`, dùng mật khẩu local tự chọn.
3. Đăng ký một tài khoản thử, mở email xác thực trong Mailpit, xác thực và kiểm session được tạo trên đúng origin backend đã cấu hình.
4. Thử email đặt lại mật khẩu và lời mời với địa chỉ dùng một lần; kiểm link thô không xuất hiện trong DB, log hay response.
5. Dùng giả lập SePay của PM với namespace `MOCK`, thử sự kiện trùng và sự kiện xung đột.
6. Chỉ bật mail hoặc SePay thật sau khi đã cấu hình secret trên server và dùng chế độ test/sandbox của nhà cung cấp.

## 10. Hiện trạng tích hợp

Google OIDC, SMTP thật và SePay LIVE chưa được cấu hình và kiểm thử. Ở local mới dùng Mailpit và SePay `MOCK`. Kết quả kiểm thử local không thay cho kiểm thử với nhà cung cấp thật.
