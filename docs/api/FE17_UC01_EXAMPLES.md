# FE-17 UC1 — lịch sử audit nền tảng (D34)

Nguồn: SRS 28/10 §3.2 J Audit Log Entry (dòng 870–876), SCR-51 (4647–4667), GBR-86, GBR-88, NFR-S11, bảng
MSG-COM (5925–5935), D34, spec FE-17 §7, `docs/reviews/FE17_UC01_REVIEW.md`. Các response dưới đây chụp ngày
15/11/2026 từ backend chạy local (profile `dev,local`, PostgreSQL 16.15, DB riêng `beefcare_fe17`, seed
`LocalDevelopmentSeeder`) bằng `.run/fe17-examples.mjs`; cookie, CSRF token và mật khẩu không được ghi.

Đăng nhập như các API khác: `GET /api/csrf` → `POST /api/authenticate` (204) → gọi với cookie phiên. Chỉ SA
(quyền nền tảng ACTIVE) đọc được. Không có route sửa / xóa. Mọi response có `X-Request-Id`; client có thể gửi
`X-Request-Id` (8–64 ký tự `[A-Za-z0-9._-]`) để nối log của mình với audit, giá trị khác bị thay bằng UUID.

Thời gian trả về theo UTC (`time`); màn hình hiện theo Asia/Ho_Chi_Minh. `from` / `to` là ngày lịch
Asia/Ho_Chi_Minh, tính cả hai đầu. `page` bắt đầu từ 0.

## Thành công

### A1 default

Mặc định của SCR-51 (7 ngày gồm hôm nay), ở đây `size=3` cho gọn. `actor = null` nghĩa là "Hệ thống"; `actor.role` rỗng với mục ghi trước D34.

`GET /api/platform/audit?from=2026-11-09&to=2026-11-15&size=3` → **200**, header `X-Request-Id: f7f40519-79e9-480e-a5f8-e2460cd7b64a`

```json
{
  "items": [
    {
      "id": 2002,
      "time": "2026-11-14T17:32:12.497807Z",
      "actor": {
        "id": 1060,
        "name": "Local System Administrator",
        "initials": "LA",
        "role": "SA"
      },
      "action": "PLATFORM_ACCESS_REVOKED",
      "targetType": "PLATFORM_ACCESS",
      "targetLabel": "Local Manager 2"
    },
    {
      "id": 2001,
      "time": "2026-11-14T17:32:12.397777Z",
      "actor": {
        "id": 1060,
        "name": "Local System Administrator",
        "initials": "LA",
        "role": "SA"
      },
      "action": "PLATFORM_ACCESS_GRANTED",
      "targetType": "PLATFORM_ACCESS",
      "targetLabel": "Local Manager 2"
    },
    {
      "id": 1756,
      "time": "2026-11-14T17:30:37.303993Z",
      "actor": {
        "id": 1060,
        "name": "Local System Administrator",
        "initials": "LA",
        "role": "SA"
      },
      "action": "ACCOUNT_RESTORED",
      "targetType": "ACCOUNT",
      "targetLabel": "Local Technician 2"
    }
  ],
  "total": 8,
  "page": 0,
  "size": 3
}
```

### A1 filtered

Loại đích PLATFORM_ACCESS và người thực hiện chứa "Local System" (tên hoặc email, không phân biệt hoa thường).

`GET /api/platform/audit?from=2026-11-09&to=2026-11-15&targetType=PLATFORM_ACCESS&actor=Local%20System` → **200**, header `X-Request-Id: 4c4c62f0-fc9e-4a1d-b9fd-e68f179a892f`

```json
{
  "items": [
    {
      "id": 2002,
      "time": "2026-11-14T17:32:12.497807Z",
      "actor": {
        "id": 1060,
        "name": "Local System Administrator",
        "initials": "LA",
        "role": "SA"
      },
      "action": "PLATFORM_ACCESS_REVOKED",
      "targetType": "PLATFORM_ACCESS",
      "targetLabel": "Local Manager 2"
    },
    {
      "id": 2001,
      "time": "2026-11-14T17:32:12.397777Z",
      "actor": {
        "id": 1060,
        "name": "Local System Administrator",
        "initials": "LA",
        "role": "SA"
      },
      "action": "PLATFORM_ACCESS_GRANTED",
      "targetType": "PLATFORM_ACCESS",
      "targetLabel": "Local Manager 2"
    }
  ],
  "total": 2,
  "page": 0,
  "size": 20
}
```

### A2

Chi tiết mục cấp quyền CS. `before` rỗng vì trước đó chưa có quyền (SCR-51 hiện "Vai trò: — → CS"). Lý do "Hỗ trợ ca tối (ví dụ FE-17)" của lệnh không có trong audit. `correlationId` là `X-Request-Id` mà client gửi kèm lệnh cấp quyền.

`GET /api/platform/audit/2001` → **200**, header `X-Request-Id: 8b51ae96-15df-4102-b2bf-9b0094255a2e`

```json
{
  "id": 2001,
  "time": "2026-11-14T17:32:12.397777Z",
  "actor": {
    "id": 1060,
    "name": "Local System Administrator",
    "initials": "LA",
    "role": "SA"
  },
  "farm": null,
  "action": "PLATFORM_ACCESS_GRANTED",
  "targetType": "PLATFORM_ACCESS",
  "targetId": 1054,
  "targetLabel": "Local Manager 2",
  "before": {},
  "after": {
    "role": "CS",
    "status": "ACTIVE"
  },
  "correlationId": "fe17-example-grant-01"
}
```

### A3

Mã của bộ lọc Hành động, theo thứ tự danh mục (30 mã; rút gọn còn 4).

`GET /api/platform/audit/actions` → **200**, header `X-Request-Id: 1710d44f-5e36-4d07-8163-9aac67c27e91`

```json
[
  {
    "code": "ACCOUNT_SUSPENDED",
    "targetType": "ACCOUNT"
  },
  {
    "code": "ACCOUNT_RESTORED",
    "targetType": "ACCOUNT"
  },
  {
    "code": "PLATFORM_ACCESS_GRANTED",
    "targetType": "PLATFORM_ACCESS"
  },
  {
    "code": "PLATFORM_ACCESS_CHANGED",
    "targetType": "PLATFORM_ACCESS"
  }
]
```

### A1 system

Chỉ hành động hệ thống (JOB, webhook). DB runtime chưa có job nào đổi trạng thái nên rỗng; ca có dữ liệu ở `PlatformAuditResourceTest#aJobChangeIsShownAsSystem`.

`GET /api/platform/audit?from=2026-11-09&to=2026-11-15&system=true` → **200**, header `X-Request-Id: f01dfc50-6b7e-4a91-b60f-b73a2646a5b8`

```json
{
  "items": [],
  "total": 0,
  "page": 0,
  "size": 20
}
```

## Lỗi

### 403 PM

Không phải SA.

`GET /api/platform/audit?from=2026-11-09&to=2026-11-15` → **403**, header `X-Request-Id: b729fdff-02b4-403d-a12e-a8d1e840c452`

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Forbidden",
  "status": 403,
  "detail": "MSG-COM-01",
  "instance": "/api/platform/audit",
  "code": "MSG-COM-01",
  "params": {},
  "message": "You do not have permission to perform this action.",
  "path": "/api/platform/audit"
}
```

### 400 missing to

Thiếu `to` (tương tự `from`).

`GET /api/platform/audit?from=2026-11-09` → **400**, header `X-Request-Id: d3d37341-3464-45f8-b08c-8b74264ea59f`

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Bad Request",
  "status": 400,
  "detail": "MSG-COM-06 {field=to}",
  "instance": "/api/platform/audit",
  "code": "MSG-COM-06",
  "params": {
    "field": "to"
  },
  "message": "to is required.",
  "path": "/api/platform/audit"
}
```

### 400 from after to

`from` sau `to`.

`GET /api/platform/audit?from=2026-11-15&to=2026-11-09` → **400**, header `X-Request-Id: 7bf83d88-18b6-4939-ae47-9623ac58363a`

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Bad Request",
  "status": 400,
  "detail": "MSG-COM-11 {field=dateRange}",
  "instance": "/api/platform/audit",
  "code": "MSG-COM-11",
  "params": {
    "field": "dateRange"
  },
  "message": "The start date must not be after the end date.",
  "path": "/api/platform/audit"
}
```

### 400 over 12 months

`to` sau `from` + 12 tháng. Nội dung MSG-COM-10 cố định nên màn hình kèm gợi ý "Tối đa 12 tháng".

`GET /api/platform/audit?from=2025-10-11&to=2026-11-15` → **400**, header `X-Request-Id: 60da1141-4a9b-4570-b4ee-c5435b7c44bb`

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Bad Request",
  "status": 400,
  "detail": "MSG-COM-10 {field=dateRange}",
  "instance": "/api/platform/audit",
  "code": "MSG-COM-10",
  "params": {
    "field": "dateRange"
  },
  "message": "dateRange is not valid.",
  "path": "/api/platform/audit"
}
```

### 400 unknown action

Mã không thuộc danh mục (mã lưu nội bộ như `PEN_MOVE` cũng bị từ chối). `targetType`, `dir`, `actor` dùng cùng `system=true`, tham số sai kiểu (`page=abc`, `from=10/03/2031`) cũng là MSG-COM-10 với tên trường.

`GET /api/platform/audit?from=2026-11-09&to=2026-11-15&action=PEN_MOVE` → **400**, header `X-Request-Id: 0e93936f-171e-4518-86ef-1008cf5584b0`

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Bad Request",
  "status": 400,
  "detail": "MSG-COM-10 {field=action}",
  "instance": "/api/platform/audit",
  "code": "MSG-COM-10",
  "params": {
    "field": "action"
  },
  "message": "action is not valid.",
  "path": "/api/platform/audit"
}
```

### 404 not central

Id không tồn tại; mục audit của dữ liệu trại (ngoài danh mục) trả đúng lỗi này.

`GET /api/platform/audit/999999999` → **404**, header `X-Request-Id: 8c0cf7b1-e6bc-47c0-b768-af31d13991e0`

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Not Found",
  "status": 404,
  "detail": "MSG-COM-08",
  "instance": "/api/platform/audit/999999999",
  "code": "MSG-COM-08",
  "params": {},
  "message": "The selected item is no longer available. Please choose another one.",
  "path": "/api/platform/audit/999999999"
}
```

### 405 delete

Không có route sửa / xóa (PUT, PATCH, DELETE, POST đều 405).

`DELETE /api/platform/audit/2001` → **405**, header `X-Request-Id: f1c29b50-0067-4501-b22f-e0629bdae64e`

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Method Not Allowed",
  "status": 405,
  "detail": "Request method 'DELETE' is not supported",
  "instance": "/api/platform/audit/2001",
  "message": "error.http.405",
  "path": "/api/platform/audit/2001"
}
```
