# FE-03 UC4 — chấp nhận lời mời (D28)

Nguồn: SRS 28/10 UC-FE03-04, SCR-15, UC-FE01-02 bước 6/AF2/AF4, MSG-FE03-04/08/09/10,
GBR-17/64/87, JOB-07/08, D25–D28, `docs/reviews/FE03_UC04_REVIEW.md`. ID, email và
thời điểm dưới đây là ví dụ tổng hợp theo hành vi đã kiểm bằng test ngày 14/11/2026,
không phải capture một server đang chạy.

## Breaking change

- GET trả thêm `status`, `farmId`, `timeZone`, `invitedBy`, `membershipId`; `invitedAt`
  bỏ, thay bằng `sentAt` = lần gửi cuối.
- POST trả `AcceptedInvitation` thay cho `MemberView` (không còn `id`, `email`,
  `fullName`…; dùng `membershipId`, `farmId`).
- MSG-FE03-08 có `params.status` (INVALID/EXPIRED/CANCELLED/ACCEPTED) và
  `params.expiresAt` (trừ INVALID).

## Quyền và điều kiện

- Cần đăng nhập (cookie session; POST cần CSRF). Chưa đăng nhập → 401; frontend
  nhớ link (24 giờ, trong trình duyệt) và mở lại sau đăng nhập mật khẩu/Google hoặc
  xác minh email.
- Thứ tự kiểm: link tồn tại → email đăng nhập trùng email được mời → trạng thái và
  hạn → trại ACTIVE. Email khác luôn là 403 MSG-FE03-09, không có tên trại, vai trò,
  trạng thái hay hạn.
- Không cần Idempotency-Key (D28): token là khóa của ý định; gọi lại trả cùng
  membership khi còn ACTIVE (GBR-17).

## Xem lời mời

```http
GET /api/invitations/accept?token=<token trong email>
```

200 khi lời mời còn chờ:

```json
{
  "status": "PENDING",
  "farmId": 401,
  "farmName": "Trại Ba Vì",
  "timeZone": "Asia/Ho_Chi_Minh",
  "email": "moi@example.test",
  "role": "MANAGER",
  "invitedBy": "Nguyễn Văn Hùng",
  "sentAt": "2026-11-14T02:00:00Z",
  "expiresAt": "2026-11-21T02:00:00Z",
  "membershipId": null
}
```

SCR-15 hiện ngày giờ theo `timeZone` (ví dụ 14/11/2026 09:00) và bảng quyền cố định
của vai trò (Table III-2, có sẵn ở frontend).

200 khi mở lại link đã chấp nhận và membership còn ACTIVE (AF2):
`"status": "ACCEPTED", "membershipId": 501` cùng các field trên. SCR-15 hiện "Bạn đã là
thành viên của Trại Ba Vì với vai trò Quản lý." và nút Vào trại.

## Chấp nhận

```http
POST /api/invitations/accept
Content-Type: application/json

{"token":"<token trong email>"}
```

```json
{"membershipId":501,"farmId":401,"farmName":"Trại Ba Vì","role":"MANAGER","status":"ACTIVE"}
```

- Cùng transaction: 1 membership ACTIVE đúng vai trò, lời mời ACCEPTED, audit
  `MEMBER_ACCEPT`, ý định email báo Owner. Lỗi giữa chừng rollback tất cả.
- JOB-07 gửi email "Thành viên mới đã tham gia trang trại" tới Owner ACTIVE hiện tại
  (tên + email thành viên, trại, vai trò, link `/thanh-vien?farmId=401`), retry tối
  đa 24 giờ; Owner mất quyền → bỏ email.
- Frontend hiện MSG-FE03-10 "Bạn đã tham gia Trại Ba Vì với vai trò Quản lý.", rồi
  vào trại qua kiểm tra của SCR-09 (`GET /api/farms/401/context`), ghi trại cho tab
  và tải lại trang chủ theo vai trò (`/tong-quan` hoặc `/kt`).

## Lỗi

| HTTP / code | Khi nào | SCR-15 |
|---|---|---|
| 400 FE03-08 `{status:"INVALID"}` | Token sai / đã bị thay khi Gửi lại | "Lời mời không còn hiệu lực (Liên kết không hợp lệ)." |
| 400 FE03-08 `{status:"CANCELLED"\|"EXPIRED", expiresAt}` | Đã hủy; quá hạn (cả trước khi JOB-02 chạy) | Kèm nhãn trạng thái và "Hết hạn lúc …", nút Về trang chủ và Liên hệ BeefCare |
| 400 FE03-08 `{status:"ACCEPTED", expiresAt}` | Link đã dùng nhưng membership không còn ACTIVE | Như trên với "Đã chấp nhận" |
| 403 FE03-09 | Email đăng nhập khác email được mời | MSG-FE03-09, ẩn trại; "Đăng xuất để đổi tài khoản" nhớ link trước khi đăng xuất |
| 403 FE03-04 | Trại không ACTIVE; lời mời vẫn PENDING | MSG-FE03-04 + "Lời mời vẫn đang chờ", nút Để sau |
| 409 COM-05 | Hiếm: tài khoản đã có membership trong trại khi lời mời còn chờ | Thông báo lỗi, giữ màn |
| 500 COM-02 | Lỗi lưu | Thông báo lỗi, nút Chấp nhận dùng lại được |

`message` theo `Accept-Language`; UI dựa vào `code` và `params`. Các mã có prefix
`MSG-`. Trạng thái bàn giao xem review UC4; không tự suy READY_FOR_FE từ ví dụ này.
