# FE-03 UC5 — xem thành viên trại (D29)

Nguồn: SRS 28/10 UC-FE03-05 (dòng 1112), SCR-13 (3043–3059), Table III-1/III-2,
GBR-09/14/18, Part I §3.2 Farm Membership ("joined time"), D29,
`docs/reviews/FE03_UC05_REVIEW.md`. ID, email và thời điểm dưới đây là ví dụ tổng hợp
theo hành vi đã kiểm bằng test ngày 14/11/2026, không phải capture một server đang chạy.

## Breaking change

- `GET /api/farms/{farmId}/members` trả object `{farmName, timeZone, serviceStatus,
  counts, items}` thay cho mảng.
- Mỗi dòng có thêm `joinedAt` (instant) và `actions[]`; bỏ `effectiveDate`, `reason`.
- `PUT /api/farms/{farmId}/members/{membershipId}` trả một dòng cùng dạng (có `joinedAt`,
  `actions`, không có `reason`/`effectiveDate`). Body và lỗi của lệnh không đổi.
- Frontend cùng nhánh đã đổi: SCR-13, popup Mời (MSG-FE03-21), FE-08 chọn người cân
  (đọc được cả `items`).

## Quyền và điều kiện

- Cookie session. Owner có membership ACTIVE: mọi trạng thái dịch vụ (GBR-14, D29).
  Manager: chỉ khi trại ACTIVE, nếu không → 403 MSG-COM-12. Technician, Owner trại
  khác, membership INACTIVE → 403 MSG-COM-01; tài khoản SUSPENDED → 403 MSG-FE01-03;
  chưa đăng nhập → 401.
- GET không ghi gì; không có Idempotency-Key.

## Owner, trại ACTIVE

```http
GET /api/farms/401/members
```

```json
{
  "farmName": "Trại bò Yên Bài – Ba Vì",
  "timeZone": "Asia/Ho_Chi_Minh",
  "serviceStatus": "ACTIVE",
  "counts": { "all": 4, "managers": 1, "technicians": 1, "inactive": 1 },
  "items": [
    { "id": 1207, "userId": 907, "fullName": "Bùi Văn Khoa", "email": "khoa.bv@example.test", "role": "TECHNICIAN", "status": "INACTIVE", "joinedAt": "2024-06-02T02:00:00Z", "version": 2, "actions": ["REACTIVATE"] },
    { "id": 1201, "userId": 901, "fullName": "Nguyễn Văn Hùng", "email": "owner@example.test", "role": "OWNER", "status": "ACTIVE", "joinedAt": "2024-03-01T01:00:00Z", "version": 0, "actions": [] },
    { "id": 1203, "userId": 903, "fullName": "Lê Thị Mai", "email": "mai@example.test", "role": "TECHNICIAN", "status": "ACTIVE", "joinedAt": "2024-05-02T02:00:00Z", "version": 0, "actions": ["CHANGE_ROLE", "DEACTIVATE"] },
    { "id": 1202, "userId": 902, "fullName": "Trần Quốc Long", "email": "long@example.test", "role": "MANAGER", "status": "ACTIVE", "joinedAt": "2024-05-02T02:00:00Z", "version": 1, "actions": ["CHANGE_ROLE", "DEACTIVATE"] }
  ]
}
```

- `counts.all` = mọi dòng trả về; `managers` / `technicians` = người ACTIVE của vai
  trò; `inactive` = INACTIVE. Một người chỉ thuộc một trong Owner / Quản lý / Kỹ thuật
  viên / Đã ngưng.
- Thứ tự: tên tiếng Việt A→Z, không phân biệt hoa thường (Đ sau D); chưa có tên thì
  theo email; bằng nhau theo id. Frontend tự đảo chiều và chia 20 dòng/trang.
- `joinedAt` hiển thị mm/yyyy theo `timeZone` (dòng Owner trên: 03/2024).

## Owner, trại không ACTIVE

Cùng request trên trại `EXPIRED` (tương tự `PENDING_PAYMENT`, `SUSPENDED`): `serviceStatus`
là trạng thái đó; dòng ACTIVE chỉ có `["DEACTIVATE"]`, dòng INACTIVE và dòng Owner `[]`.

## Manager

```json
{
  "farmName": "Trại bò Yên Bài – Ba Vì",
  "timeZone": "Asia/Ho_Chi_Minh",
  "serviceStatus": "ACTIVE",
  "counts": { "all": 3, "managers": 1, "technicians": 1 },
  "items": [
    { "id": 1201, "userId": 901, "fullName": "Nguyễn Văn Hùng", "email": "owner@example.test", "role": "OWNER", "status": "ACTIVE", "joinedAt": "2024-03-01T01:00:00Z", "version": 0, "actions": [] }
  ]
}
```

(`items` rút gọn.) Không có dòng INACTIVE, không có `counts.inactive`, mọi `actions` rỗng.

## Lỗi

```json
{ "status": 403, "code": "MSG-COM-01", "params": {}, "message": "…" }
```

```json
{ "status": 403, "code": "MSG-COM-12", "params": { "farm": "Trại bò Yên Bài – Ba Vì", "status": "EXPIRED" }, "message": "…" }
```

## Đổi vai trò (UC6, chỉ để thấy dạng trả về)

```http
PUT /api/farms/401/members/1202
Idempotency-Key: 6f0b…
Content-Type: application/json

{ "action": "CHANGE_ROLE", "role": "TECHNICIAN", "effectiveDate": "2026-11-14", "reason": "Sắp xếp lại công việc", "expectedVersion": 1 }
```

```json
{ "id": 1202, "userId": 902, "fullName": "Trần Quốc Long", "email": "long@example.test", "role": "TECHNICIAN", "status": "ACTIVE", "joinedAt": "2024-05-02T02:00:00Z", "version": 2, "actions": ["CHANGE_ROLE", "DEACTIVATE"] }
```

`joinedAt` không đổi sau đổi vai trò, ngưng hay kích hoạt lại.
