# FE-03 UC8 — tạm ngưng / khôi phục tài khoản (D32)

Nguồn: SRS 28/10 UC-FE03-08 (dòng 1833–1850), SCR-16 (3154–3174), Permission Matrix (1376,
chú thích 1440), GBR-04, GBR-10, GBR-77, BR-D06, Table III-1, MSG-FE03-14 → 20, D32,
`docs/reviews/FE03_UC08_REVIEW.md`. Các response dưới đây chụp ngày 14/11/2026 từ backend chạy
local (profile `dev,local`, PostgreSQL 16.15, DB riêng `beefcare_uc8` vừa tạo, tài khoản seed của
`LocalDevelopmentSeeder`), đăng nhập session + CSRF. ID, version và thời điểm là của lần chạy đó.
Bản ghi đầy đủ (không có mật khẩu): `.run/fe03-uc08-runtime/http.json` trên máy chạy, không commit.

## Thay đổi hợp đồng

- `POST /api/platform/accounts/{id}/suspend` và `…/restore` (A12) **bắt buộc** header
  `Idempotency-Key`; body `{reason, version}`; phản hồi là `AccountDetail` (A10).
- `AccountDetail` thêm `actions[]`: `SUSPEND` (tài khoản ACTIVE không phải của SA đang gọi),
  `RESTORE` (tài khoản SUSPENDED), rỗng cho tài khoản của chính mình.
- `InternalView` (FE-20) thêm `needsReassignment` (boolean): yêu cầu OPEN có người nhận không còn
  khả dụng. Màn của người nhận (A16) luôn `false`.
- Liquibase `20261114000400`: bảng `app_user_status_change` (lịch sử, có lý do). Audit
  `ACCOUNT_SUSPEND` / `ACCOUNT_RESTORE` chỉ có `statusBefore` / `statusAfter`.
- Frontend cùng nhánh: SCR-16 gọi A12 ở chế độ backend; lệnh UC9 và trang "Quyền nhân sự" vẫn báo
  chưa tích hợp.

## Quyền và thứ tự kiểm

Chỉ tài khoản ACTIVE có quyền SA ACTIVE. Sau khi khóa dòng: COM-01 → COM-08 → dữ liệu (COM-06 /
COM-10) → FE03-17 (chính mình) → FE03-20 (kể cả version cũ) → COM-05 → khi tạm ngưng: SA đang gọi
còn ACTIVE (COM-01) và còn SA ACTIVE khác (FE03-17). Lệnh bị từ chối không ghi gì.

## Tạm ngưng thành công (SA tạm ngưng CS)

```http
POST /api/platform/accounts/1058/suspend
Idempotency-Key: <uuid>
Content-Type: application/json

{"reason": "  Nghi ngờ lộ mật khẩu  ", "version": 5}
```

```json
200
{"id": 1058, "fullName": "Nhân viên hỗ trợ", "email": "cs@beefcare.local", "accountStatus": "SUSPENDED",
 "platformRole": "CS", "platformAccessStatus": "ACTIVE", "platformAccessVersion": 0, "emailVerified": true,
 "signInMethods": ["PASSWORD"], "createdAt": "2026-11-14T15:27:15.328953Z", "lastSignInAt": "2026-11-14T15:34:03.875627Z",
 "ownerRegistrationCompleted": true, "ownerRegistrationCompletedAt": "2026-11-14T15:27:15.328953Z",
 "ownedFarms": [], "farmCount": 0, "farmRoles": [], "version": 6, "actions": ["RESTORE"]}
```

- Vai trò CS vẫn `ACTIVE` (tạm ngưng không thu hồi vai trò, D32 Q1).
- Gửi lại cùng key và body → cùng response 200, không ghi thêm.
- Cùng key, lý do khác → `409 {"code": "MSG-COM-19", "params": {"reason": "key_reused_with_different_request"}}`.
- Dòng lịch sử: `cs@beefcare.local | SUSPEND | ACTIVE | SUSPENDED | Nghi ngờ lộ mật khẩu | sa@beefcare.local`
  (lý do đã bỏ khoảng trắng). Audit: `{"statusBefore":"ACTIVE","statusAfter":"SUSPENDED"}`.
- Phiếu `TK-2202` CS đang phụ trách về hàng đợi trong cùng lệnh: `assignedCsId: null`, `status:
  "IN_PROGRESS"` giữ nguyên; lịch sử `AUTO_REQUEUE` `{"cause":"ACCOUNT_SUSPENDED","actorType":"SYSTEM"}`.

## Tài khoản bị tạm ngưng

- Phiên đang mở của CS: `GET /api/platform/support/tickets` → `401` (phiên đã đăng ký bị hết hạn
  khi tạm ngưng; frontend về màn đăng nhập).
- Đăng nhập lại: `POST /api/authenticate` → `403 {"code": "MSG-FE01-03", "params": {"email":
  "cs@beefcare.local"}}`.

## Khôi phục

```http
POST /api/platform/accounts/1058/restore
Idempotency-Key: <uuid>

{"reason": "Đã đổi mật khẩu", "version": 6}
```

→ `200`, `accountStatus: "ACTIVE"`, `platformAccessStatus: "ACTIVE"`, `version: 7`,
`actions: ["SUSPEND"]`; CS đăng nhập lại được.

## Yêu cầu nội bộ cần đổi người nhận

PM có yêu cầu nội bộ `IR-2552` OPEN của `TK-2202`. Sau khi SA tạm ngưng PM, CS đọc
`GET /api/platform/support/tickets/2202`:

```json
{"internalRequests": [{"id": 2552, "code": "IR-2552", "targetRole": "PM", "recipientId": 1059,
  "recipient": "Local Platform Manager", "status": "OPEN", "version": 1, "needsReassignment": true}]}
```

Khôi phục PM → `needsReassignment: false`.

## Lỗi

| Trường hợp | Request | Response |
|---|---|---|
| PM gọi | `POST …/1058/suspend` | `403 MSG-COM-01` |
| Id không tồn tại (lý do sai) | `POST …/999999999/suspend` `{"reason":"abc"}` | `404 MSG-COM-08` (trước lỗi lý do) |
| Lý do dưới 5 ký tự không phải khoảng trắng | `{"reason":"a b c d"}` | `400 MSG-COM-10 {"field":"reason"}` |
| Thiếu `Idempotency-Key` | — | `400 MSG-COM-06 {"field":"Idempotency-Key"}` |
| Thiếu `version` / lý do trống | — | `400 MSG-COM-06 {"field":"version"}` / `{"field":"reason"}` |
| Tạm ngưng chính mình | `POST …/1060/suspend` | `409 MSG-FE03-17` |
| Khôi phục tài khoản ACTIVE, version cũ | `{"version":14}` | `409 MSG-FE03-20 {"target":"cs@beefcare.local","value":"status"}` |
| Tạm ngưng lần nữa | — | `409 MSG-FE03-20` |
| Version cũ | `{"version":14}` | `409 MSG-COM-05` |
| Hai SA cuối cùng tạm ngưng nhau cùng lúc | — | Lệnh sau chờ khóa rồi `403 MSG-COM-01` (test PostgreSQL) |
