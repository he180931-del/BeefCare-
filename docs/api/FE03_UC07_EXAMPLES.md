# FE-03 UC7 — xem tài khoản người dùng (D31)

Nguồn: SRS 28/10 UC-FE03-07 (dòng 1114), SCR-16 (3150–3177), Permission Matrix (1375),
User Account (461–468), GBR-09/10/11, Table III-1, D31, `docs/reviews/FE03_UC07_REVIEW.md`.
Các response dưới đây chụp ngày 14/11/2026 từ backend chạy local (profile `dev,local`,
PostgreSQL 16.15, DB riêng `beefcare_uc7` vừa tạo, tài khoản seed của `LocalDevelopmentSeeder`),
đăng nhập bằng `sa@beefcare.local`. ID và thời điểm là của lần chạy đó.

## Breaking change

- `GET /api/platform/accounts` trả `{items, total, page, size}` thay cho `Page` của Spring
  (`content`, `totalElements`, …). `page` bắt đầu từ 0, `size` mặc định 20 (1–100).
- Thêm tham số `platformRole` (`NONE` | `CS` | `PM` | `SA`), `sort` (chỉ `name`), `dir`
  (`asc` | `desc`). Tìm `q` chỉ theo tên hoặc email (không còn SĐT).
- Dòng danh sách: `{id, fullName, email, accountStatus, platformRole, platformAccessStatus,
  emailVerified, farmCount, farmRoles[]}`. Chi tiết `AccountDetail` thêm `signInMethods`,
  `createdAt`, `lastSignInAt`, `ownerRegistrationCompletedAt`, `ownedFarms`; bỏ `phone`.
- `POST …/{id}/suspend`, `…/restore`, `…/platform-access` trả `AccountDetail` (UC8/UC9 chưa
  chứng nhận; chỉ đổi dạng phản hồi).
- Frontend cùng nhánh đã đổi: SCR-16 đọc A9/A10 ở chế độ backend; các lệnh UC8/UC9 và trang
  "Quyền nhân sự" vẫn báo chưa tích hợp ở chế độ backend.

## Quyền và điều kiện

- Cookie session (`/api/csrf` → `/api/authenticate`). Chỉ tài khoản ACTIVE có quyền SA
  ACTIVE. CS, PM, SA đã thu hồi, Owner/thành viên trại → 403 MSG-COM-01; tài khoản bị tạm
  ngưng → 403 MSG-FE01-03; chưa đăng nhập → 401.
- GET không ghi gì; không có Idempotency-Key.

## Danh sách, tìm và phân trang

```http
GET /api/platform/accounts?q=owner&size=2
```

```json
{
  "items": [
    {"id": 1051, "fullName": "Local Owner", "email": "owner@beefcare.local", "accountStatus": "ACTIVE",
     "platformRole": null, "platformAccessStatus": null, "emailVerified": true, "farmCount": 1, "farmRoles": ["OWNER"]},
    {"id": 1052, "fullName": "Local Owner 2", "email": "owner-2@beefcare.local", "accountStatus": "ACTIVE",
     "platformRole": null, "platformAccessStatus": null, "emailVerified": true, "farmCount": 1, "farmRoles": ["OWNER"]}
  ],
  "total": 3,
  "page": 0,
  "size": 2
}
```

- `total` là số sau lọc (3 email chứa "owner"); trang sau: `page=1`.
- Thứ tự: tên tiếng Việt A→Z, không phân biệt hoa thường (chưa có tên thì theo email), rồi
  email, rồi id; `dir=desc` đảo cả ba. Với seed: "Local Manager" … "Local Technician 2",
  "Nhân viên hỗ trợ", "Other Farm Owner".
- `farmCount` / `farmRoles` chỉ tính membership ACTIVE; vai trò theo thứ tự OWNER, MANAGER,
  TECHNICIAN.

## Lọc vai trò platform

```http
GET /api/platform/accounts?platformRole=CS
```

```json
{"items": [{"id": 1058, "fullName": "Nhân viên hỗ trợ", "email": "cs@beefcare.local", "accountStatus": "ACTIVE",
  "platformRole": "CS", "platformAccessStatus": "ACTIVE", "emailVerified": true, "farmCount": 0, "farmRoles": []}],
 "total": 1, "page": 0, "size": 20}
```

- `CS` / `PM` / `SA` chỉ ra người có vai trò đó đang ACTIVE. `NONE` = không có vai trò
  ACTIVE, gồm cả người bị thu hồi. Một dòng bị thu hồi vẫn trả `platformRole: "CS"`,
  `platformAccessStatus: "REVOKED"` để UC9 khôi phục; màn hình hiện "Không có" kèm "CS đã thu hồi".

## Chi tiết tài khoản

```http
GET /api/platform/accounts/1051
```

```json
{
  "id": 1051, "fullName": "Local Owner", "email": "owner@beefcare.local", "accountStatus": "ACTIVE",
  "platformRole": null, "platformAccessStatus": null, "platformAccessVersion": null,
  "emailVerified": true, "signInMethods": ["PASSWORD"],
  "createdAt": "2026-11-14T05:31:08.693660Z", "lastSignInAt": "2026-11-14T05:31:55.732626Z",
  "ownerRegistrationCompleted": true, "ownerRegistrationCompletedAt": "2026-11-14T05:31:08.690833Z",
  "ownedFarms": ["BeefCare Local Farm A"], "farmCount": 1, "farmRoles": ["OWNER"], "version": 1
}
```

- `emailVerified`: có Google subject hoặc identity cùng email đã kích hoạt; tài khoản đăng ký
  mật khẩu chưa bấm link xác minh vẫn có trong danh sách với `false`.
- `lastSignInAt`: mới hơn giữa lần đăng nhập bằng mật khẩu và bằng Google; `null` nếu chưa
  đăng nhập. Màn hình hiện giờ Asia/Ho_Chi_Minh (ví dụ trên: 14/11/2026 12:31).
- `platformAccessVersion` là `null` khi chưa từng có quyền platform (gửi lại ở UC9).
- Không có `phone`, mật khẩu, Google subject, dữ liệu vận hành trại (GBR-11).

## Lỗi

```http
GET /api/platform/accounts?status=BLOCKED
```

```json
{"status": 400, "code": "MSG-COM-10", "params": {"field": "status"}, "message": "status is not valid."}
```

```http
GET /api/platform/accounts?page=abc
```

```json
{"status": 400, "code": "MSG-COM-10", "params": {"field": "page"}, "message": "page is not valid."}
```

```http
GET /api/platform/accounts/999999999
```

```json
{"status": 404, "code": "MSG-COM-08", "params": {},
 "message": "The selected item is no longer available. Please choose another one."}
```

Các trường `type`, `title`, `instance`, `detail`, `path` của Problem Details được lược bớt.
Cùng kiểu 400 cho `platformRole=STAFF`, `size=0|101`, `sort=email`, `dir=up`, `q` dài hơn 100
ký tự. Lỗi DB khi đọc → 500 MSG-COM-03.
