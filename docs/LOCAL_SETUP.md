# Chạy BeefCare ở máy local

Tài liệu này gom cách chạy local và cấu hình tích hợp (email, Google, SePay) vào một chỗ; từ 21/11/2026 thay cho `BACKEND_RUN_GUIDE.md` và `FRONTEND_RUN_GUIDE.md`. Lệnh test frontend và backend xem `docs/testing/COMMANDS.md` và `backend/AGENTS.md`; cách kiểm UI xem `docs/agent-context/VERIFICATION.md`. Bản production deploy qua `.github/workflows/production-deploy.yml` khi push lên nhánh `production` (frontend lên Vercel theo `frontend/vercel.json`), không thuộc phạm vi tài liệu này.

## 1. Chuẩn bị

| Thành phần | Phiên bản | Nơi khai báo |
|---|---|---|
| Java | JDK 21 hoặc JDK 25 (Maven Enforcer chỉ nhận hai dòng này) | `backend/pom.xml` |
| Node.js | `22.22.2`, npm đi kèm | `.nvmrc`, `frontend/package.json`, `backend/package.json`, `backend/pom.xml` |
| Spring Boot | `3.5.3` | `backend/pom.xml` |
| PostgreSQL | `16.15` (chạy bằng Docker) | `compose.backend.yml` |

Backend dùng Maven Wrapper trong `backend/` (`mvnw.cmd` trên Windows, `./mvnw` trên macOS/Linux). Kiểm tra Java bằng `java -version`.

### Chọn đúng Node

macOS/Linux, ở gốc repo (nvm đọc `.nvmrc`):

```bash
nvm install
nvm use
node --version   # phải là v22.22.2
```

Windows dùng nvm-windows (không đọc `.nvmrc`), mở PowerShell hoặc Command Prompt:

```powershell
nvm install 22.22.2
nvm use 22.22.2
node --version
```

Không dùng nvm thì cài đúng Node `22.22.2` từ bộ cài chính thức. `brew install node@22` cài bản patch mới nhất của dòng 22, không đảm bảo đúng `22.22.2`.

### Biến môi trường

- Tạo `.env` ở gốc repo từ `.env.example` rồi điền giá trị local. **Không commit `.env`.**
  - `BEEFCARE_DB_PASSWORD`: mật khẩu PostgreSQL local, compose bắt buộc có.
  - `BEEFCARE_DEV_PASSWORD`: mật khẩu chung của các tài khoản seed, tối thiểu 12 ký tự và không bắt đầu bằng `replace-with-`. Thiếu thì backend dừng khi khởi động profile `local`.
  - `BEEFCARE_LINK_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự, chỉ ở server.
  - `BEEFCARE_PUBLIC_URL` (origin frontend), `BEEFCARE_BACKEND_URL` (origin backend, dùng cho link kích hoạt email), `BEEFCARE_CORS_ORIGINS`.
- Profile `local` tự nạp `../.env` (`spring.config.import: optional:file:../.env[.properties]` trong `application-local.yml`), nên chạy backend từ thư mục `backend/`.

## 2. Hạ tầng: PostgreSQL và Mailpit

Từ gốc repo (Docker Compose tự đọc `.env` ở gốc):

```bash
docker compose -f compose.backend.yml up -d --wait   # chờ db và mailpit healthy
docker compose -f compose.backend.yml ps             # xem trạng thái
docker compose -f compose.backend.yml down           # dừng, giữ nguyên dữ liệu
```

Không dùng `down -v` nếu chưa được yêu cầu rõ: lệnh đó xóa volume database.

| Dịch vụ | Địa chỉ |
|---|---|
| PostgreSQL `postgres:16.15` | `localhost:15432`, database và user `beefcare` |
| Mailpit giao diện | <http://localhost:8025> |
| Mailpit SMTP | `localhost:1025` |
| Backend | <http://localhost:8080> |
| Frontend (Vite) | <http://localhost:5173> mặc định; `npm run dev:mock` ở <http://127.0.0.1:5174> |

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

Phải bật đồng thời `dev,local`: `dev` cung cấp cổng và cấu hình phát triển, `local` trỏ database, Mailpit và seed local. Chỉ bật `local` sẽ thiếu property bắt buộc. Dừng backend bằng `Ctrl+C`.

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

- `-Pdev,!webapp` tránh Maven tải và build webapp JHipster cũ. Vì vậy chạy API không cần `npm ci` trong `backend/`; `backend/package.json` chỉ dùng khi build có profile `webapp`.
- `-Djacoco.skip=true` chỉ tắt coverage (JaCoCo từng làm JVM crash trên đường dẫn Windows có dấu), không bỏ chạy test.
- Nếu Modernizer chặn một bản build hợp lệ, dùng `-Dmodernizer.skip=true` và ghi rõ đã bỏ cổng kiểm này; không sửa hàng loạt code legacy không liên quan.
- Cổng 8080 bận: thêm `'-Dspring-boot.run.arguments=--server.port=8090'`, đặt `BEEFCARE_BACKEND_URL` theo cổng mới, và đổi `target` của proxy trong `frontend/vite.config.js` (đang cố định `127.0.0.1:8080`).
- Biểu thức cron có dấu cách phải truyền qua biến môi trường, không qua `spring-boot.run.arguments`. Ví dụ `BEEFCARE_JOBS_RETENTION_CRON` ứng với `beefcare.jobs.retention-cron`; các khóa khác: `invitation-expiry-cron`, `reminder-reconcile-cron`, `payment-expiry-cron`, `subscription-coverage-cron`, `subscription-notice-cron`.
- `-Dliquibase.analytics.enabled=false` tắt gửi analytics của Liquibase.
- Không chạy nhiều Maven cùng lúc trên một `backend/target`.

### Kiểm tra backend đã sẵn sàng

```bash
curl -i http://localhost:8080/management/health   # 200
curl -i http://localhost:8080/api/authenticate    # 401 khi chưa đăng nhập: đúng, không phải lỗi
curl -i http://localhost:5173/api/authenticate    # qua proxy Vite, cũng 401
```

`GET /api/authenticate` trả 204 khi đã có phiên đăng nhập.

## 4. Frontend

```bash
cd frontend
npm ci               # cài đúng phiên bản trong package-lock.json; chỉ dùng npm install khi thêm hoặc nâng dependency
npm run dev          # chế độ theo frontend/.env (xem bên dưới)
npm run dev:backend  # đăng nhập và dữ liệu từ backend thật, kể cả khi chưa có frontend/.env
npm run dev:mock     # mọi màn hình chạy bằng dữ liệu mock, không cần backend, cổng 5174
```

Khi cần mở từ thiết bị khác hoặc chạy kiểm runtime: `npm run dev -- --host 0.0.0.0 --port 5174`.

Cấu hình `frontend/.env` (không commit). Vite chỉ đọc `.env`, không đọc `.env.example`; chưa có `.env` thì `npm run dev` vẫn gọi backend thật qua proxy `/api`. Muốn chạy bằng dữ liệu mẫu, không cần backend, dùng `npm run dev:mock` (cổng 5174).

- `VITE_BEEFCARE_DATA_SOURCE`: để trống hoặc `backend` là backend thật; chỉ `local` mới dùng adapter dữ liệu mẫu (`npm run dev:mock` và Vitest tự đặt). `vite build` báo lỗi khi gặp `local` hoặc `VITE_BEEFCARE_AUTH_MODE=mock`, nên bản build không thể chạy bằng dữ liệu mẫu. Không có biến chọn trại: trại làm việc là trại đã vào ở màn Chọn trại, giữ riêng cho từng tab.
- `VITE_BEEFCARE_API_URL` **để trống**: request đi theo đường dẫn tương đối `/api` qua proxy của Vite tới `127.0.0.1:8080`. Đây là cách đúng theo quy tắc dự án (không hardcode origin).
- Nếu đặt `VITE_BEEFCARE_API_URL` (ví dụ `http://localhost:8080`), trình duyệt gọi thẳng backend, bỏ qua proxy, và backend phải cho phép origin của frontend qua `BEEFCARE_CORS_ORIGINS` (mặc định ở profile `local`: `localhost:5173`, `127.0.0.1:5173`, `localhost:3000`).
- Dùng cùng hostname cho frontend và backend: cookie của `localhost` và `127.0.0.1` là khác nhau. Cookie production cần HTTPS.

### Kiểm tra và build

```bash
cd frontend
npm run typecheck   # TypeScript của mã nguồn và mã test
npm test            # test:api + test:unit:run + test:integration (không gồm test:integration:ui)
npm run build       # vite build ra frontend/dist/
npx vite preview    # xem thử bản build ở local
```

Trước khi bàn giao frontend, chạy lần lượt `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Lệnh chạy từng nhóm test và kết quả lần kiểm gần nhất xem `docs/testing/COMMANDS.md`. `npm run build` chỉ tạo file tĩnh ở máy, không deploy. Frontend không có script `start`, `preview` hay `lint`; xem thử bản build dùng `npx vite preview`.

### Quét QR bằng camera

Chạy backend rồi chạy `npm run dev:backend` trong `frontend`. Đăng nhập và chọn trại, mở `/quet-qr` hoặc `/kt/quet-qr`, bấm **Bật camera** và cho phép quyền camera. Có thể chọn camera khi thiết bị có nhiều camera. Bộ đọc giải mã hình ảnh camera rồi gọi `GET /api/farms/{farmId}/cattle/resolve?code=...` để tìm bò trên backend. Nút **Quét từ ảnh** đọc ảnh QR trên thiết bị và tra cùng API.

Trên máy chạy frontend, dùng `http://localhost:5173`. Trên điện thoại truy cập qua mạng LAN, camera cần HTTPS. Có thể đặt `BEEFCARE_DEV_HTTPS_CERT` và `BEEFCARE_DEV_HTTPS_KEY` trong `frontend/.env.local` trỏ đến cặp chứng chỉ/khóa local đã được điện thoại tin cậy, phù hợp với hostname/IP truy cập. Khởi động lại bằng `npm run dev:backend -- --host 0.0.0.0`. Chứng chỉ và khóa nằm ngoài Git.

Lấy tem thử từ hồ sơ bò của trại đang chọn, tab **Thẻ QR**, tải PNG hoặc in thẻ ACTIVE. Đưa tem vào khung quét. Mã thẻ chưa được cấp cho bò sẽ bị từ chối khi tra dữ liệu thật. Chế độ `dev:mock` hiển thị nhắc dùng dữ liệu mẫu trên màn hình quét.

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

### Hai bò demo tạm thời và QR đã cấp

Khi chạy backend với profile `dev,local`, `LocalRuntimeCattleLifecycle` chạy sau seed tài khoản và tạo hai bò trong **BeefCare Local Farm A**:

| Bò | Mã tai | Giới tính / mục đích | Nội dung QR |
|---|---|---|---|
| Bò kiểm thử camera QR, mã hiển thị `BC-000001` | `QR-CAMERA-TEST` | Đực, vỗ béo | `QR-1151-000001` — dùng lại ảnh tem đã tạo |
| Bò cái demo QR, mã hiển thị lấy từ bộ đếm của trại | `QR-DEMO-FEMALE` | Cái, trưởng thành, sinh sản (`BREEDING`) | `QR-{farmId}-{số thứ tự 6 chữ số}`, cấp bằng `CodeSequenceService.nextQrTagCode` |

Chọn trại A rồi quét ảnh tem cũ để mở đúng bò đực. Bò cái có sẵn trong danh sách đàn và có thẻ QR riêng. Mã thẻ bò cái được cấp một lần qua bộ sinh mã chung, rồi giữ trong cấu hình local `local_runtime_cattle_qr` để ảnh QR không đổi sau khi khởi động lại; không đặt lại hay giảm bộ đếm. Ví dụ trại `1151` với bộ đếm đang ở `1` sẽ nhận `QR-1151-000002`. Mã thực tế có trong log `Local runtime cattle ready` và tab **Thẻ QR**. Mã thử cũ `QR-LOCAL-DEMO-FEMALE` được dọn nếu còn thuộc bò demo; dùng ảnh mới sau khi cập nhật. Cả hai có cân mẫu và phân chuồng; dữ liệu được lưu trong database thật để dùng các API thông thường.

Khi dừng backend bình thường (Ctrl+C hoặc đóng Spring context), chương trình xóa đúng hai bò demo và các bản ghi phụ thuộc. Tài khoản, trại, danh mục, chuồng cấu hình và bò khác được giữ lại. Tham chiếu cha/mẹ từ bò khác đến bò demo được bỏ, không xóa bò khác. Phiếu chỉ chứa bò demo được dọn; phiếu có cả bò khác giữ lại và tính lại tiền bò sau khi bỏ dòng demo.

Nếu tiến trình bị kill cưỡng bức hoặc máy mất điện, shutdown hook không thể chạy; lần khởi động kế tiếp dọn phần demo còn sót trước khi tạo lại. Dấu nhận diện nằm trên thẻ QR gốc, nên đổi tên, số tai hoặc thay thẻ của bò demo không làm mất khả năng dọn. PostgreSQL có khóa theo phiên để hai backend không cùng chiếm hoặc dọn bộ dữ liệu này.

Đặt `BEEFCARE_LOCAL_RUNTIME_CATTLE_ENABLED=false` rồi khởi động lại để tắt việc tạo demo; tài khoản local vẫn được seed. Tính năng không chạy ngoài profile `local`, và luôn tắt nếu có profile `prod`. Mã QR/mã bò đã thuộc dữ liệu khác sẽ báo lỗi, không ghi đè. Riêng bản ghi thử cũ đúng cặp `BC-000001` / `QR-CAMERA-TEST` gắn với QR mẫu ở trại A được nhận lại và chuyển thành dữ liệu tạm.

### Seed demo FE-07 / FE-14 / FE-15 / FE-23

Sau khi backend `dev,local` đã sẵn sàng, chạy preflight khô (mặc định không ghi)
từ gốc repo:

```powershell
$env:BEEFCARE_DEV_PASSWORD = '<giá trị local trong .env>'
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-v1.ps1
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-v1.ps1 -Apply
```

Đọc kế hoạch và readback đã làm sạch trước khi dùng lệnh `-Apply` để ghi dữ liệu.
Có thể đổi `-BaseUrl`, `-FarmName` hoặc truyền `-FarmId`; script tự khám phá
trại theo phiên đăng nhập. Không đưa mật khẩu vào lệnh đã lưu, log hoặc Git.
Chi tiết sentinel và các tình huống được seed: [docs/local-demo-seed.md](local-demo-seed.md).

## 6. Email

**Local.** Profile `local` chọn adapter SMTP gửi tới Mailpit (`localhost:1025`); xem thư tại <http://localhost:8025>. Mailpit giữ thư tại máy, không gửi ra ngoài. Dùng nó để xem các mẫu tiếng Việt: xác thực, đặt lại mật khẩu, lời mời vào trại, thông báo, kể cả bản plain-text và thời hạn link. Profile `dev` và `testh2` không có `local` dùng `MockEmailDelivery` trong bộ nhớ, trừ khi đặt `beefcare.email.provider=smtp`. Hộp thư local không có API.

**Bảo mật link.** Job gửi email chỉ lưu người nhận, mã mẫu và tham chiếu tới bản ghi nguồn, không lưu link. Bảng token tài khoản và lời mời giữ hash SHA-256 cùng nonce ngẫu nhiên. Link được tạo lúc gửi bằng HMAC-SHA256 với khóa chỉ ở server, đối chiếu với hash rồi gửi sau khi transaction commit. Job lỗi được thử lại với backoff sau khi khởi động lại. Đổi `BEEFCARE_LINK_SECRET` làm mất hiệu lực các link đang chờ; khi đó phải gửi link mới. Backend không được dựng link từ header `Host` của request.

**Resend (khuyến nghị trên Railway Hobby).** Đặt `BEEFCARE_EMAIL_PROVIDER=resend`, `BEEFCARE_RESEND_API_KEY`, `BEEFCARE_MAIL_FROM`, `BEEFCARE_PUBLIC_URL`, `BEEFCARE_BACKEND_URL`, `BEEFCARE_LINK_SECRET` trong kho secret của môi trường triển khai. Backend gọi HTTPS tới Resend (cổng 443), không dùng SMTP. Tạo API key dạng **Sending access** trong Resend, giữ key chỉ ở Railway, và xác minh domain của giá trị `BEEFCARE_MAIL_FROM` trong Resend trước khi gửi tới người dùng thật. Adapter timeout kết nối/đọc sau 5 giây; lỗi API được trả về email queue hiện có để retry với backoff, không làm rollback nghiệp vụ.

**SMTP thật (tuỳ chọn).** Đặt `BEEFCARE_EMAIL_PROVIDER=smtp` cùng `BEEFCARE_SMTP_HOST`, `BEEFCARE_SMTP_PORT`, `BEEFCARE_SMTP_USERNAME`, `BEEFCARE_SMTP_PASSWORD`, `BEEFCARE_PUBLIC_URL`, `BEEFCARE_BACKEND_URL`, `BEEFCARE_LINK_SECRET` trong kho secret của môi trường triển khai (các biến SMTP được đọc trong `application-prod.yml`). Nếu nhà cung cấp yêu cầu xác thực, bật thêm `spring.mail.properties.mail.smtp.auth=true`; hiện chưa có biến `BEEFCARE_*` riêng cho cờ này. Timeout kết nối, đọc và ghi là 5 giây. Adapter thử nhanh 3 lần, sau đó job gửi bền vững thử lại với backoff tăng dần có giới hạn. Địa chỉ gửi lấy từ `jhipster.mail.from` và phải được nhà cung cấp mail cho phép. Tham khảo: [Spring Boot email](https://docs.spring.io/spring-boot/reference/io/email.html).

## 7. Đăng nhập Google

Mặc định tắt. Bật bằng `BEEFCARE_GOOGLE_ENABLED=true` cùng `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID` và `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET` trong kho secret. Ở local, khi Google tắt thì để hai biến client id/secret dạng chú thích (như `.env.example`): giá trị rỗng làm backend không khởi động; thiếu biến thì profile `local` dùng giá trị giữ chỗ `google-login-disabled`, và backend từ chối khởi động nếu bật Google mà vẫn là giá trị này. Scope `openid`, `email`, `profile`. Đăng ký đúng callback `https://<backend-host>/login/oauth2/code/google` với Google, không nhận host tùy ý. Backend yêu cầu email đã xác minh, liên kết theo Google subject đã có hoặc theo email trùng, tạo session BeefCare phía server và không nhận hay lưu mật khẩu Google. Không commit client secret.

## 8. SePay và VietQR

- **Webhook (UC8, D24):** `POST /api/webhooks/sepay`, alias SRS `POST /api/v1/payments/sepay/webhook`. Kiểm HMAC-SHA256 trên đúng `<timestamp>.<raw-body>`, header `X-SePay-Timestamp` (giây Unix), `X-SePay-Signature: sha256=<hex>`, lệch tối đa 300 giây. Sai trả 401, chỉ lưu metadata hạn chế (JOB-08 xóa sau 30 ngày; không lưu được metadata vẫn trả 401), không lưu chứng từ. JSON ≤ 65536 bytes; id phải là số nguyên thật. Trường chữ của giao dịch đã xác thực luôn được lưu đủ, không bị từ chối hay cắt vì độ dài. Giao lặp tăng số lần giao mà không đổi version chứng từ PM đang mở. Chỉ trả `200 {"success":true}` sau khi chứng từ và job cùng commit; JOB-06 xác nhận sau, 200 chưa có nghĩa PAID. Giữ môi trường/namespace/snapshot tài khoản và điều kiện ngân hàng. Giao lặp so dữ liệu nghiệp vụ theo D19/D22 (không theo hash/chữ payload đơn thuần), không tạo job/kỳ thứ hai; cùng ID khác dữ liệu nghiệp vụ trả 409. Mã mâu thuẫn để PM, không chọn mã đầu.
- **Giả lập local:** `POST /api/dev/sepay/events`, chỉ PM dùng, chỉ có ở profile `dev`, `local`, `testh2` khi môi trường là `MOCK` hoặc `TEST`. Nó đi qua đúng luồng bằng chứng và xác nhận như webhook. Không có ở `prod`. Mặc định `BEEFCARE_SEPAY_ENVIRONMENT=MOCK`, namespace `LOCAL-MOCK`.
- **Nút "Giả lập chuyển khoản" trên SCR-59:** khi chạy frontend bằng `npm run dev` hoặc `npm run dev:mock` và yêu cầu còn PENDING, Owner thấy ô này dưới hướng dẫn chuyển khoản. Số tiền điền sẵn đúng số tiền yêu cầu: để nguyên thì thanh toán thành công, nhập số khác thì thử sai số tiền (chứng từ chuyển PM đối soát). Nút gọi `POST /api/dev/sepay/farms/{farmId}/payments/{paymentId}/transfer`, chỉ Owner của trại đó, cùng điều kiện profile và môi trường như trên. Backend lấy mã, tài khoản nhận và ngân hàng từ chính yêu cầu rồi chạy cùng luồng với `/api/dev/sepay/events`. Đây là công cụ thử, không thuộc SRS; bản `npm run build` không có ô này và route không có trong OpenAPI.
- **Tài khoản nhận (bắt buộc từ UC-FE19-02):** tạo yêu cầu thanh toán cần đủ `BEEFCARE_SEPAY_BANK_CODE`, `BEEFCARE_SEPAY_ACCOUNT_NUMBER`, `BEEFCARE_SEPAY_ACCOUNT_NAME`; thiếu thì trả MSG-FE19-04 và không tạo gì. Ở local chép ba giá trị giả trong `.env.example` vào `.env` (profile `local` tự nạp `../.env`). Không dùng tài khoản thật khi môi trường là `MOCK`: QR thật có thể nhận tiền thật nhưng webhook không về được localhost. Với giá trị giả, ảnh QR không tải được và SCR-59 hiện thông tin chuyển khoản dạng chữ. Ngoài ra cần một bảng giá đang hiệu lực do PM công bố (`POST /api/platform/plan-prices`). Merchant ID / Secret Key của Cổng thanh toán SePay không dùng trong luồng này.
- **Tra cứu giao dịch:** dùng `Authorization: Bearer <API_TOKEN>` (`BEEFCARE_SEPAY_API_TOKEN`), giữ token ở server, timeout có giới hạn (`BEEFCARE_SEPAY_API_TIMEOUT`, mặc định 5s). Đổi tài khoản nhận thì đặt namespace mới; báo giá cũ giữ nguyên môi trường, namespace và tài khoản lúc tạo.
- **Job:** JOB-03 cho yêu cầu thanh toán hết hạn mỗi 5 phút; JOB-04 tính bao phủ mỗi 15 phút, giữ SUSPENDED. Cả xác nhận/JOB-04 khóa trại trước khi đọc subscription. JOB-06 đọc queue mỗi giây (`beefcare.sepay.processing-delay-ms`, test gọi chủ động), lease 2 phút, retry 1/5/15 phút rồi mỗi giờ đến 24h từ lỗi đầu; hết hạn chuyển lỗi kỹ thuật cho PM, không mất chứng từ/ghi đè quyết định. D20 vẫn không báo đối soát chiều ra. Giờ ngân hàng trong cửa sổ gốc vẫn nhận EXPIRED đến muộn. Simulator/API-03 dùng cùng processor và giữ kết quả thành công ngay: job được giữ lease cho chính request ngay trong commit lưu, nên JOB-06 không lấy chen vào; lỗi sau lưu còn job retry. Thanh toán PAID ghi một email intent trong queue hiện có; dispatcher gửi tiếng Việt cho Owner hiện tại, retry độc lập ≤ 24h, không rollback tiền/cấp kỳ và không bật consumer outbox của feature khác.
- **Cấu hình SePay khi triển khai:** chọn JSON và HMAC; bật gửi lại khi HTTP ngoài 2xx ở phía SePay. Retry giao webhook của nhà cung cấp độc lập với retry JOB-06 sau khi BeefCare đã lưu. Kiểm chứng ở `docs/reviews/FE19_UC08_REVIEW.md` là MOCK/PostgreSQL/Mailpit, không phải LIVE.
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

## 11. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Maven báo sai phiên bản Java | Dùng JDK 21 hoặc 25; kiểm bằng `java -version`. |
| npm hoặc build báo sai Node | macOS/Linux: `nvm use` ở gốc repo; Windows: `nvm use 22.22.2`. `node --version` phải là `v22.22.2`. |
| Backend không kết nối được PostgreSQL | Kiểm `.env` (`BEEFCARE_DB_PASSWORD`), cổng `15432` và `docker compose -f compose.backend.yml ps`. |
| Backend báo thiếu property khi khởi động | Chạy đủ profile `dev,local`, không chạy riêng `local`. |
| Frontend báo không kết nối được máy chủ hoặc không gọi được API | Kiểm backend bằng `/management/health` ở mục 3; request phải bắt đầu bằng `/api`; proxy trong `frontend/vite.config.js` trỏ `127.0.0.1:8080`; frontend và backend dùng cùng hostname. |
| Build lỗi do dependency | Xóa `frontend/node_modules` rồi chạy lại `npm ci` và `npm run build`. Lệnh xóa: macOS/Linux `rm -rf node_modules`; PowerShell `Remove-Item -Recurse -Force node_modules`; Command Prompt `rmdir /s /q node_modules`. |
# Windows agent and 9Router workflow

For Codex agent shell provisioning, 9Router, Agent Follow, GitNexus on the
Vietnamese Windows path, and focused frontend verification, use
[Windows agent workflow](agent-context/WINDOWS_AGENT_WORKFLOW.md).
