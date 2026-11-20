# FE-03 UC6 — đổi vai trò / ngưng / kích hoạt lại thành viên (D30)

Nguồn: SRS 28/10 UC-FE03-06 (dòng 1817–1830), popup (3115–3130), MSG-FE03-11/12/13/20,
Table III-1 (2789, 2795), GBR-18/86/88/89, D30, `docs/reviews/FE03_UC06_REVIEW.md`.
ID, email và thời điểm dưới đây là ví dụ tổng hợp theo hành vi đã kiểm bằng test ngày
14/11/2026, không phải capture một server đang chạy.

## Thay đổi so với trước D30

- Route, body và dạng trả về giữ nguyên (dòng A1 của UC5). Không phải breaking change
  về dạng dữ liệu, nhưng có **quy tắc mới**:
  - lý do 5–500 ký tự, ít nhất 5 không phải khoảng trắng → ngoài khoảng là MSG-COM-10;
  - đổi vai trò người INACTIVE → MSG-COM-10 (`params.field = action`), trước đây được phép;
  - đã đúng vai trò/trạng thái → MSG-FE03-20 **trước** khi kiểm version;
  - `CHANGE_ROLE` thiếu `role` → MSG-COM-06 (`field = role`).
- Mỗi lệnh thành công ghi 1 dòng `farm_membership_change` (bảng mới) và audit có giá trị
  trước/sau.

## Quyền và điều kiện

- Cookie session + CSRF, `Idempotency-Key` bắt buộc; cùng key và body trả kết quả đầu,
  cùng key khác body → 409 MSG-COM-19.
- Chỉ Owner của trại. Ngưng: mọi trạng thái dịch vụ. Đổi vai trò, kích hoạt lại: trại
  ACTIVE. Membership Owner không đổi được.
- Ngày hiệu lực chỉ để ghi lịch sử; quyền mới áp dụng từ request kế tiếp của thành viên.

## Ngưng

```http
PUT /api/farms/401/members/1202
Idempotency-Key: 3c1d…
Content-Type: application/json

{ "action": "DEACTIVATE", "effectiveDate": "2026-11-14", "reason": "Nghỉ việc cuối tháng", "expectedVersion": 1 }
```

```json
{ "id": 1202, "userId": 902, "fullName": "Trần Quốc Long", "email": "long@example.test", "role": "MANAGER", "status": "INACTIVE", "joinedAt": "2024-05-02T02:00:00Z", "version": 2, "actions": ["REACTIVATE"] }
```

Dòng lịch sử được ghi:

| action | role_before → role_after | status_before → status_after | effective_date | reason | changed_by | changed_at |
|---|---|---|---|---|---|---|
| DEACTIVATE | MANAGER → MANAGER | ACTIVE → INACTIVE | 2026-11-14 | Nghỉ việc cuối tháng | Owner | lúc lưu |

## Đổi vai trò

```json
{ "action": "CHANGE_ROLE", "role": "TECHNICIAN", "effectiveDate": "2026-11-04", "reason": "Chuyển sang khu chuồng C", "expectedVersion": 0 }
```

Trả về dòng có `"role": "TECHNICIAN"`. Ngày 04/11 trong quá khứ vẫn hợp lệ; quyền
Technician áp dụng ngay từ request kế tiếp.

## Kích hoạt lại

```json
{ "action": "REACTIVATE", "effectiveDate": "2026-11-14", "reason": "Quay lại làm việc", "expectedVersion": 2 }
```

Giữ vai trò hiện tại; trại phải ACTIVE.

## Lỗi (theo thứ tự kiểm)

| Trường hợp | HTTP | Body |
|---|---|---|
| Không phải Owner | 403 | `{ "code": "MSG-COM-01" }` |
| Membership không thuộc trại trong URL | 404 | `{ "code": "MSG-COM-08" }` |
| Đích là membership Owner | 403 | `{ "code": "MSG-COM-01" }` |
| Lý do trống | 400 | `{ "code": "MSG-COM-06", "params": { "field": "reason" } }` |
| Lý do `"a b c d"` hoặc > 500 | 400 | `{ "code": "MSG-COM-10", "params": { "field": "reason" } }` |
| Ngày mai (theo múi giờ trại) | 400 | `{ "code": "MSG-COM-07", "params": { "field": "effectiveDate" } }` |
| Đổi vai trò người INACTIVE | 400 | `{ "code": "MSG-COM-10", "params": { "field": "action" } }` |
| Đổi vai trò / kích hoạt lại khi trại không ACTIVE | 403 | `{ "code": "MSG-FE03-04" }` |
| Đã đúng trạng thái/vai trò (kể cả version cũ) | 409 | `{ "code": "MSG-FE03-20", "params": { "target": "long@example.test", "value": "status" } }` |
| Version cũ cho một thay đổi thật | 409 | `{ "code": "MSG-COM-05" }` |

Lệnh bị từ chối không ghi membership, lịch sử hay audit.
