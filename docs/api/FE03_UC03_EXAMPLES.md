# FE-03 UC3 — gửi lại / hủy lời mời đang chờ (D27)

Nguồn: SRS 28/10 UC-FE03-03, SCR-14, MSG-FE03-04/05/06/07/08, GBR-14/16/86/88/89,
D25/D26/D27, `docs/reviews/FE03_UC03_REVIEW.md`. ID, email và thời điểm dưới
đây là ví dụ tổng hợp theo hành vi đã kiểm bằng test ngày 14/11/2026, không
phải capture một server đang chạy. Không đổi route hay DTO so với UC1/UC2.

## Quyền và điều kiện chung

- Cookie session như `docs/agent-context/API_RULES.md`; POST cần CSRF,
  `Idempotency-Key` và `expectedVersion` (version của dòng mà Owner đã thấy).
- Chỉ ACTIVE account có ACTIVE Owner membership của trại ở URL. Manager,
  Technician, Owner trại khác: 403 MSG-COM-01.
- Gửi lại cần dịch vụ trại ACTIVE; Hủy được ở mọi trạng thái dịch vụ (GBR-14).
- Cả hai chỉ áp dụng lời mời PENDING chưa hết hạn tại clock của lần gọi.
- Thứ tự kiểm: COM-01 → FE03-04 (chỉ Gửi lại) → COM-08 → FE03-08 → COM-05.
  Lời mời đã kết thúc luôn báo FE03-08 kèm trạng thái, kể cả khi version cũ.

## Gửi lại

```http
POST /api/farms/401/invitations/501/resend
Idempotency-Key: <UUID riêng của ý định gửi lại>
Content-Type: application/json

{"expectedVersion":1}
```

200 trả InvitationView (cùng dạng item của GET danh sách):

```json
{
  "id": 501,
  "email": "new@example.test",
  "role": "MANAGER",
  "status": "PENDING",
  "createdAt": "2026-10-28T03:00:00Z",
  "lastSentAt": "2026-11-01T03:00:00Z",
  "expiresAt": "2026-11-08T03:00:00Z",
  "validityDays": 7,
  "version": 2,
  "hasAccount": true
}
```

- Cùng `id`, `email`, `role`, `validityDays`, `createdAt`. `lastSentAt` = lúc
  gửi lại, `expiresAt` = `lastSentAt` + `validityDays` ngày (gửi ngày 1, gửi lại
  ngày 5, hiệu lực 7 ngày → hết hạn ngày 12).
- Token mới: link trong email trước không còn mở được lời mời (D27). Email cũ
  chưa gửi bị bỏ, xếp một email mới; HTTP 200 không có nghĩa email đã tới.
- Gọi lại cùng key và body trả đúng kết quả đầu, không thêm email. Không có
  giới hạn số lần gửi lại (D27); UI khóa nút khi đang gửi.
- UI hiện MSG-FE03-05: "Đã cập nhật lời mời tới {email}. Hệ thống đang gửi
  email. Hết hạn lúc {expiresAt theo múi giờ trại}." rồi tải lại danh sách.

## Hủy

UI hỏi trong hộp thoại MSG-FE03-06: "Hủy lời mời gửi {email}? Link sẽ không còn
tác dụng." với nút Quay lại / Hủy lời mời. Quay lại không gọi API. Hộp thoại
giữ version đã thấy khi mở, kể cả khi danh sách vừa được làm mới.

```http
POST /api/farms/401/invitations/501/cancel
Idempotency-Key: <UUID riêng của ý định hủy>
Content-Type: application/json

{"expectedVersion":2}
```

200 trả InvitationView với `"status":"CANCELLED"` và version mới. Link của lời
mời không còn cấp gì (chấp nhận bằng link đó → 400 MSG-FE03-08); email chưa gửi
bị bỏ; không tạo membership. UI hiện MSG-FE03-07 "Đã hủy lời mời." và tải lại.
Hiện SCR-15 mở link đã hủy báo "Liên kết không hợp lệ"; việc hiện "Đã hủy" kèm
hạn để UC4 (FE-03 Q6).

## Lỗi

409 lời mời không còn chờ:

```json
{"code":"MSG-FE03-08","params":{"status":"ACCEPTED"},"message":"Lời mời này không còn hiệu lực (ACCEPTED)."}
```

`message` theo `Accept-Language` (ví dụ trên là `vi`); UI dựa vào `code` và
`params`. `params.status` là ACCEPTED, CANCELLED hoặc EXPIRED. PENDING đã quá hạn nhưng
JOB-02 chưa chạy được báo EXPIRED; lệnh bị từ chối không ghi trạng thái, version,
audit hay email. UI hiện "Lời mời không còn hiệu lực (Đã chấp nhận)." và tải lại.

| HTTP / code | Điều kiện | UI SCR-14 |
|---|---|---|
| 400 COM-06 | Thiếu `expectedVersion` hoặc header key | Không xảy ra từ UI (adapter chặn trước) |
| 403 COM-01 | Không phải Owner của trại ở URL | Thông báo lỗi |
| 403 FE03-04 | Gửi lại khi trại không ACTIVE | Thông báo + tải lại (nút Gửi lại bị khóa) |
| 404 COM-08 | ID lời mời không thuộc trại ở URL | Thông báo + tải lại |
| 409 FE03-08 | Không còn PENDING / đã hết hạn | Thông báo kèm trạng thái + tải lại |
| 409 COM-05 | Version cũ (phiên khác vừa sửa) | Thông báo + tải lại; không tự thử lại bằng version mới |
| 409 COM-19 | Cùng key nhưng payload khác | Thông báo lỗi |
| 500 COM-02 | Lỗi lưu / transaction | Giữ hộp thoại Hủy và cùng key để thử lại |

Các mã có prefix `MSG-`. Trạng thái bàn giao xem review UC3; không tự suy
READY_FOR_FE từ các ví dụ này.
