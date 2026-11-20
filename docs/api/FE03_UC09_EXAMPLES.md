# FE-03 UC9 — quyền nhân viên nền tảng (D33)

Nguồn: SRS 28/10 UC-FE03-09 (dòng 1852–1869), popup "Platform Staff Access" (3179–3190), CS / PM / SA
(497–517), GBR-10, GBR-11, BR-D06, MSG-FE03-17 → 20, D33, `docs/reviews/FE03_UC09_REVIEW.md`. Các
response dưới đây chụp ngày 14/11/2026 từ backend chạy local (profile `dev,local`, PostgreSQL 16.15, DB
riêng `beefcare_uc9` vừa tạo, tài khoản seed của `LocalDevelopmentSeeder`), đăng nhập session + CSRF. ID,
version và thời điểm là của lần chạy đó. Bản ghi đầy đủ (mật khẩu đã che):
`.run/fe03-uc09-runtime/http.json` trên máy chạy, không commit.

## Thay đổi hợp đồng

- `POST /api/platform/accounts/{id}/platform-access` (A13) **bắt buộc** `Idempotency-Key`; body
  `{operation, role?, reason, version}` (`version` = `platformAccessVersion` của A10; `null` khi chưa có
  quyền); phản hồi là `AccountDetail`.
- `GET /api/platform/accounts/{id}/history` (A11) trả `AccessHistoryItem[]` (thay `AuditItem`): `{id,
  action, roleBefore, statusBefore, roleAfter, statusAfter, reason, byName, byEmail, at}`, mới nhất trước,
  tối đa 100; chỉ lịch sử vai trò.
- `AccountDetail` thêm `accessActions[]` (GRANT / CHANGE / REVOKE / RESTORE cho SA đang gọi).
- Mã mới **MSG-FE03-22** (`{email}`): tài khoản bị tạm ngưng chỉ được thu hồi quyền.
- Liquibase `20261114000500`: bảng `platform_access_change`; trên PostgreSQL chép các mục audit
  `PLATFORM_ACCESS_*` cũ. Audit mới chỉ có `fromRole`, `fromStatus`, `toRole`, `toStatus`.
- Frontend cùng nhánh: bỏ trang / mục sidebar "Quyền nhân sự nền tảng"; popup mở trên SCR-16
  (`/nen-tang/tai-khoan/{id}?m=access`), link cũ `/nen-tang/quyen/{id}` chuyển hướng.

## Thứ tự kiểm

COM-01 → COM-08 → dữ liệu (`operation`, `role`, `reason`) → quyền của chính mình (COM-01) → tài khoản
SUSPENDED trừ thu hồi (FE03-22) → email chưa xác minh trừ thu hồi (FE03-18) → trạng thái (FE03-20 khi giá
trị đã có hiệu lực, COM-05 khi quyền đã đổi) → version (COM-05) → SA đang gọi còn ACTIVE (COM-01) → SA cuối
cùng (FE03-17). Lệnh bị từ chối không ghi gì.

## Cấp quyền

```http
GET /api/platform/accounts/1054
→ 200 {"id": 1054, "email": "manager-2@beefcare.local", "platformRole": null, "platformAccessStatus": null,
       "platformAccessVersion": null, "accountStatus": "ACTIVE", "actions": ["SUSPEND"], "accessActions": ["GRANT"], "version": 1, …}

POST /api/platform/accounts/1054/platform-access
Idempotency-Key: <uuid>

{"operation": "GRANT", "role": "CS", "reason": "  Bổ sung nhân sự hỗ trợ ca chiều  ", "version": null}
→ 200 {"id": 1054, "platformRole": "CS", "platformAccessStatus": "ACTIVE", "platformAccessVersion": 0,
       "accessActions": ["CHANGE", "REVOKE"], …}
```

- Gửi lại cùng key và body → cùng response; cùng key, lý do khác → `409 MSG-COM-19`.
- Trước khi cấp, `manager-2` gọi `GET /api/platform/support/tickets` → `403 MSG-COM-01`; ngay sau khi cấp
  → `200` (quyền áp dụng từ request kế tiếp).

## Đổi vai trò, thu hồi, khôi phục

| Request (`version`) | Response |
|---|---|
| `{"operation":"CHANGE","role":"PM","reason":"Chuyển sang nhóm đối soát","version":0}` | `200` PM ACTIVE, version 1; người đó: `/api/platform/support/tickets` → 403, `/api/platform/farms` → 200 |
| `{"operation":"REVOKE","reason":"Hết nhiệm vụ đối soát","version":1}` | `200` PM REVOKED, version 2, `accessActions: ["RESTORE"]`; `/api/platform/farms` → 403 |
| `{"operation":"RESTORE","reason":"Quay lại đối soát","version":2}` | `200` PM ACTIVE, version 3 |

```http
GET /api/platform/accounts/1054/history
→ 200 [
  {"id": 1705, "action": "RESTORE", "roleBefore": "PM", "statusBefore": "REVOKED", "roleAfter": "PM", "statusAfter": "ACTIVE",
   "reason": "Quay lại đối soát", "byName": "Local System Administrator", "byEmail": "sa@beefcare.local", "at": "2026-11-14T16:16:15.751993Z"},
  {"id": 1704, "action": "REVOKE", …}, {"id": 1703, "action": "CHANGE", "roleBefore": "CS", …},
  {"id": 1702, "action": "GRANT", "roleBefore": null, "statusBefore": null, "roleAfter": "CS", "reason": "Bổ sung nhân sự hỗ trợ ca chiều", …}
]
```

Audit tương ứng: `{"fromRole":"NONE","fromStatus":"NONE","toRole":"CS","toStatus":"ACTIVE"}` (không có lý do).

## Tài khoản bị tạm ngưng

- `technician` có CS ACTIVE rồi bị tạm ngưng → A10 `accessActions: ["REVOKE"]`.
- `CHANGE` → `409 {"code": "MSG-FE03-22", "params": {"email": "technician@beefcare.local"}}`.
- `REVOKE` → `200` CS REVOKED, `accountStatus: "SUSPENDED"`, `accessActions: []`.
- `owner-2` bị tạm ngưng, chưa có quyền: `GRANT` → `409 MSG-FE03-22`.

## Mất quyền: phiếu và yêu cầu nội bộ

- Thu hồi PM có yêu cầu nội bộ `IR-2151` OPEN → CS đọc `TK-1901`: `"needsReassignment": true`; khôi phục PM
  → `false`.
- Thu hồi CS đang giữ `TK-1901` → phiếu `assignedCsId: null`, `status: "IN_PROGRESS"` giữ nguyên; lịch sử
  `AUTO_REQUEUE` `{"cause":"CS_ACCESS_REMOVED","actorType":"SYSTEM"}`.

## Lỗi

| Trường hợp | Response |
|---|---|
| Thiếu `Idempotency-Key` | `400 MSG-COM-06 {"field":"Idempotency-Key"}` |
| Lý do `"a b c d"` | `400 MSG-COM-10 {"field":"reason"}` |
| Cấp không có `role` | `400 MSG-COM-06 {"field":"role"}` |
| SA thu hồi quyền của chính mình | `403 MSG-COM-01` |
| PM gọi | `403 MSG-COM-01` |
| Id không tồn tại (operation sai) | `404 MSG-COM-08` (trước lỗi dữ liệu) |
| Đổi vai trò khi chưa có quyền | `409 MSG-COM-05` |
| Cấp lại đúng vai trò đang ACTIVE (version cũ) | `409 MSG-FE03-20 {"target":"manager-2@beefcare.local","value":"role"}` |
| Cấp vai trò khác khi đang có quyền | `409 MSG-COM-05` |
| Thu hồi khi đã REVOKED | `409 MSG-FE03-20 {"value":"status"}` |
| Tài khoản bị tạm ngưng: cấp / đổi / khôi phục | `409 MSG-FE03-22 {"email":…}` |
| Email chưa xác minh: cấp / đổi / khôi phục | `409 MSG-FE03-18` (test HTTP; seed local đều đã xác minh) |
| Hai SA cuối cùng thu hồi quyền SA của nhau | Lệnh sau chờ khóa rồi `403 MSG-COM-01` (test PostgreSQL) |
