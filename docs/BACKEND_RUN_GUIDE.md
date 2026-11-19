# BeefCare — hướng dẫn chạy backend

Tài liệu này là quy trình chuẩn để chạy backend local cùng PostgreSQL, Mailpit
và frontend hiện tại.

## 1. Phiên bản chuẩn

| Thành phần | Phiên bản |
|---|---|
| Node.js | `22.22.2` |
| npm | phiên bản đi kèm Node `22.22.2` |
| Java | JDK 21 hoặc JDK 25 theo Maven Enforcer |
| Spring Boot | `3.5.3` |
| PostgreSQL | `16` |

Node được khai báo đồng nhất tại `.nvmrc`, `frontend/package.json`,
`backend/package.json` và `backend/pom.xml`. Backend dùng Node này cho phần
frontend Webpack khi chạy các profile build có `webapp`; Java vẫn là runtime
chính của Spring Boot.

## 2. Chọn đúng Node

Ở thư mục gốc repository:

```bash
nvm install
nvm use
node --version
```

Kết quả phải là `v22.22.2`. Nếu không dùng nvm, cài Node `22.22.2` bằng
Homebrew hoặc trình quản lý phiên bản Node khác rồi kiểm tra lại.

## 3. Chuẩn bị biến môi trường

Không commit file `.env` hoặc secret thật.

```bash
cp .env.example .env
```

Điền tối thiểu `BEEFCARE_DB_PASSWORD` trong `.env`. Cấu hình local của
backend đọc biến từ file này; các secret mẫu dùng cho profile phát triển chỉ
phục vụ local/test.

## 4. Bật dịch vụ phụ thuộc

Từ thư mục gốc:

```bash
docker compose -f compose.backend.yml up -d db mailpit
docker compose -f compose.backend.yml ps
```

Các cổng chuẩn:

- PostgreSQL: `127.0.0.1:15432`
- Mailpit SMTP: `127.0.0.1:1025`
- Mailpit UI: http://127.0.0.1:8025

Chờ database ở trạng thái `healthy` trước khi chạy Spring Boot.

## 5. Cài dependency frontend của backend

Chỉ cần thực hiện khi build phần Webpack tích hợp của backend:

```bash
cd backend
npm ci
```

Nếu chỉ chạy API Spring Boot, có thể bỏ qua bước này.

## 6. Chạy backend local

Mở terminal tại `backend/` và dùng JDK được Maven Enforcer chấp nhận:

```bash
cd backend
./mvnw -Dspring-boot.run.profiles=dev,local spring-boot:run
```

Phải dùng đồng thời `dev,local`: profile `dev` cung cấp port và cấu hình phát
triển; profile `local` trỏ database/Mailpit local. Chỉ dùng `local` sẽ thiếu
một số property bắt buộc của ứng dụng.

Backend chạy tại http://127.0.0.1:8080.

## 7. Kiểm tra backend đã sẵn sàng

```bash
curl -i http://127.0.0.1:8080/management/health
curl -i http://127.0.0.1:8080/api/authenticate
```

Kết quả mong đợi:

- `/management/health`: HTTP `200`.
- `/api/authenticate` khi chưa đăng nhập: HTTP `401`; đây là phản hồi đúng,
  không phải backend hỏng.

Nếu frontend Vite đang chạy ở cổng `5174`, kiểm tra proxy:

```bash
curl -i http://127.0.0.1:5174/api/authenticate
```

Proxy cũng phải trả `401` khi chưa có phiên đăng nhập.

## 8. Chạy frontend kết nối backend

Ở terminal khác:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
```

Mở http://127.0.0.1:5174.

## 9. Dừng dịch vụ

- Dừng Spring Boot bằng `Ctrl+C`.
- Dừng PostgreSQL và Mailpit từ thư mục gốc:

```bash
docker compose -f compose.backend.yml down
```

Lệnh trên không xóa volume database. Không dùng `down -v` nếu chưa được yêu
cầu rõ ràng.

## 10. Lỗi thường gặp

- **Maven báo sai Java:** dùng JDK 21 hoặc JDK 25; kiểm tra bằng `java -version`.
- **Không kết nối PostgreSQL:** kiểm tra `.env`, cổng `15432` và trạng thái
  `docker compose ... ps`.
- **Thiếu property `server.port` hoặc JWT:** chạy profile `dev,local`, không
  chạy riêng `local`.
- **Frontend báo không kết nối máy chủ xác thực:** kiểm tra backend ở `8080`
  và gọi lại endpoint `/management/health`, sau đó tải lại frontend.
- **npm dùng sai Node:** chạy `nvm use` từ thư mục gốc và xác nhận
  `node --version` là `v22.22.2`.

## 11. Nguyên tắc an toàn

- Không commit `.env`, password, app password, JWT secret hoặc token.
- Không reset database dùng chung để xử lý lỗi migration.
- Không chạy nhiều tiến trình Maven trên cùng một checkout/`target`.
- Khi thay đổi DTO/route, cập nhật OpenAPI và chạy kiểm tra contract trước khi
  bàn giao cho frontend.
