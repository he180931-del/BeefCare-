# FE-03 UC1 — contract và cách nối FE

Nguồn: SRS 28/10, D25, `docs/reviews/FE03_UC01_REVIEW.md`.
Từ D26 / UC2 (13/11/2026), GET danh sách trả envelope phân trang thay cho mảng;
UC1 AF1 tra bằng `?invitationId=...`. Xem `FE03_UC02_EXAMPLES.md` cho hợp đồng
đọc hiện tại; dữ liệu và hợp đồng lệnh UC1 bên dưới giữ nguyên.
ID/thời gian bên dưới là ví dụ tổng hợp. Dùng farmId thật từ context đã chọn;
không dùng các ID ví dụ trong ứng dụng.

## Gửi lời mời và đọc lại

Cookie session + CSRF như `docs/agent-context/API_RULES.md`.
Owner của trại ACTIVE; POST cần `Idempotency-Key` do FE giữ cho một ý định.

```http
POST /api/farms/401/invitations
Content-Type: application/json
Idempotency-Key: <UUID của ý định gửi>
X-XSRF-TOKEN: <token CSRF của session>

{"email":"new@example.test","role":"TECHNICIAN","validityDays":7}
```

201 (đã commit lời mời + audit + email intent + replay/outbox):

```json
{
  "id": 501,
  "email": "new@example.test",
  "role": "TECHNICIAN",
  "status": "PENDING",
  "createdAt": "2026-11-11T03:00:00Z",
  "lastSentAt": "2026-11-11T03:00:00Z",
  "expiresAt": "2026-11-18T03:00:00Z",
  "validityDays": 7,
  "version": 1,
  "hasAccount": false
}
```

- `validityDays` chỉ 3/7/14; bỏ/null → 7. `role` không có mặc định, chỉ
  MANAGER/TECHNICIAN. Email trim/lowercase, tối đa 254.
- GET `/api/farms/401/invitations` trả `{items,total,page,size,counts,asOf}`;
  `items` chứa các `InvitationView`, `status?` chọn bốn trạng thái. FE map
  `hasAccount` sang accountHint. Phần UC2 được kiểm riêng theo D26, xem review UC2.
- FE hiển thị “Đã tạo lời mời tới new@example.test. Hệ thống đang gửi email.
  Hết hạn lúc 18/11/2026 10:00.” theo giờ Việt Nam; 201 chưa chứng minh mail tới.
- Response Owner không có token/hash/nonce/trạng thái tài khoản platform.
- Chưa tạo membership. Email job lỗi vẫn PENDING và retry tăng dần ≤24h,
  không gửi sau khi link hết hiệu lực; không rollback lời mời.

## Nhánh lời mời trùng (AF1 → UC3)

409:

```json
{"code":"MSG-FE03-03","params":{"invitationId":501,"email":"pending@example.test"}}
```

Tải đúng dòng qua GET `/api/farms/401/invitations?invitationId=501`, lấy
`items[0]`, hiện email/vai trò/hiệu lực hiện có và đề nghị Gửi lại.
Chỉ sau khi Owner chọn Gửi lại mới POST
`/api/farms/401/invitations/501/resend` với
`{"expectedVersion":1}` và key riêng. Cùng ID/email/role/validityDays, cập
nhật lastSentAt/expiresAt/version, đổi token, hủy mail cũ chưa gửi rồi tạo
intent mới. Giữ key khi thử lại cùng lệnh; không tự lấy version mới trước ghi.

## Nhánh thành viên đã ngưng (AF2 → UC6)

409:

```json
{"code":"MSG-FE03-21","params":{"membershipId":502,"email":"inactive@example.test"}}
```

Không tạo lời mời. FE tải membership trong cùng trại, đề nghị Kích hoạt lại;
chỉ sau khi Owner chọn mới mở popup UC6. Nhập ngày hiệu lực Việt Nam (hôm nay
hoặc quá khứ), lý do không trống ≤500, rồi xác nhận:

```http
PUT /api/farms/401/members/502
Idempotency-Key: <UUID riêng của ý định kích hoạt>
Content-Type: application/json

{"action":"REACTIVATE","effectiveDate":"2026-11-11","reason":"Tiếp tục công việc","expectedVersion":4}
```

Giữ vai trò hiện tại, không lấy vai trò đã chọn ở form mời để đổi membership.
200 trả MemberView ACTIVE. Popup vẫn giữ input khi request lỗi; version cũ
trả 409 MSG-COM-05 và yêu cầu tải lại.

## Các lỗi và trường hợp còn lại

| HTTP / code | Điều kiện |
|---|---|
| 400 COM-06 | Thiếu email/role hoặc header key; UC6 thiếu ngày/lý do |
| 400 COM-10 | Email/role/validityDays không hợp lệ; vượt giới hạn trường |
| 400 COM-07 | UC6 ngày hiệu lực tương lai |
| 403 COM-01 | Không phải Owner của trại ở URL |
| 403 FE03-04 | Trại chưa ACTIVE khi mời/gửi lại/kích hoạt |
| 409 FE03-02 | Email là thành viên ACTIVE (hiện dưới email) |
| 409 FE03-03 / FE03-21 | Đề nghị UC3 / UC6 như trên |
| 409 COM-05 | Dữ liệu cũ/concurrent update; không ghi đè |
| 409 COM-19 | Cùng key nhưng payload khác |
| 500 COM-02 | Lỗi persistence/transaction, thông báo chung không lộ chi tiết DB |

Tài khoản SUSPENDED chưa có membership vẫn được mời theo D25; phản hồi không
tiết lộ SUSPENDED. Việc đăng nhập/chấp nhận tiếp tục bị chặn khi tài khoản bị
ngưng. Bấm Hủy không tạo gì; khi đã nhập, popup yêu cầu xác nhận bỏ thay đổi.

Các mã bảng trên có prefix `MSG-`. Trạng thái bàn giao và bằng chứng mới nhất
xem review UC1; không tự suy READY_FOR_FE từ các ví dụ này.
