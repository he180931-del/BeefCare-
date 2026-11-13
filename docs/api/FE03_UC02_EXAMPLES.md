# FE-03 UC2 — danh sách lời mời (D26)

Nguồn: SRS 28/10 Table III-1 / SCR-14, D26,
`docs/reviews/FE03_UC02_REVIEW.md`, OpenAPI đã export sau test ngày 13/11/2026.
Các ID, email và thời điểm dưới đây là ví dụ tổng hợp về hợp đồng, không phải
capture một server đang chạy. Dùng farmId từ context đã xác thực.

## Breaking change và quyền

GET trước trả mảng; hiện trả `{items,total,page,size,counts,asOf}`. Mọi nơi gọi,
kể cả UC1 AF1, phải cập nhật. Frontend trong cùng checkout đã được cập nhật.
Không trộn demo/localStorage khi đang ở backend mode.

- Cookie session như `docs/agent-context/API_RULES.md`; GET không cần CSRF,
  Idempotency-Key hoặc expectedVersion. Lệnh Gửi lại/Hủy vẫn cần cả ba.
- Chỉ ACTIVE account có ACTIVE Owner membership của đúng trại. Manager,
  Technician, Owner trại khác: 403 COM-01; chưa đăng nhập: 401.
- Owner xem được ở ACTIVE/PENDING_PAYMENT/EXPIRED/SUSPENDED. Khi dịch vụ
  không ACTIVE, chỉ còn Hủy lời mời PENDING chưa hết hạn.

## Đọc một trang

```http
GET /api/farms/123/invitations?status=PENDING&page=0&size=20&sort=lastSentAt&dir=desc
```

```json
{
  "items": [{
    "id": 456,
    "email": "new@example.test",
    "role": "TECHNICIAN",
    "status": "PENDING",
    "createdAt": "2026-11-12T03:00:00Z",
    "lastSentAt": "2026-11-12T03:00:00Z",
    "expiresAt": "2026-11-19T03:00:00Z",
    "validityDays": 7,
    "version": 0,
    "hasAccount": false
  }],
  "total": 1,
  "page": 0,
  "size": 20,
  "counts": {"PENDING": 1, "ACCEPTED": 2, "EXPIRED": 1, "CANCELLED": 0},
  "asOf": "2026-11-13T00:00:00Z"
}
```

`status` optional: bỏ trống/rỗng = tất cả, trim và không phân biệt hoa/thường;
UI mặc định PENDING. `page` zero-based, 0..21474836; `size` 1..100, mặc định
20 và UI cố định 20. `sort` chỉ lastSentAt; `dir` asc/desc, mặc định desc.
Khi lastSentAt bằng nhau, id giảm dần ở cả hai chiều để phân trang ổn định.

`counts` luôn là toàn trại, trước status/ID/page; `total` sau status/ID, trước
page. Trang ngoài phạm vi trả items rỗng với total/counts thật. UI chuyển về
trang còn tồn tại nếu lệnh Hủy làm rỗng trang cuối.

Tất cả timestamps API là instant. UI đổi theo farm.timeZone, mặc định
Asia/Ho_Chi_Minh; ví dụ lastSentAt ở trên hiển thị 12/11/2026 10:00 ở Việt Nam.

## Tra chính xác lời mời cho UC1

```http
GET /api/farms/123/invitations?invitationId=456
```

Trả cùng envelope, tối đa một item, kể cả khi lời mời nằm ngoài trang đầu của
danh sách thông thường. ID không thuộc trại không trả item; không tiết lộ trại
hay trạng thái của ID đó. Owner xác nhận Gửi lại bằng **version của item đã
hiển thị**, không lấy version mới ngay trước lệnh.

## Hết hạn, dữ liệu tài khoản và lỗi

- Tại `expiresAt == asOf`, PENDING được đọc/lọc/đếm thành EXPIRED. GET không
  lưu trạng thái EXPIRED, tăng version, ghi audit hay gửi email. JOB-02 tiếp
  tục cập nhật trạng thái lưu; quyền dùng link vẫn được kiểm thời gian thật.
- hasAccount là tồn tại AppUser theo email không phân biệt hoa/thường tại lần
  đọc, kể cả tài khoản SUSPENDED; không có trường accountStatus, token/nonce,
  password hoặc thông tin xác minh trong danh sách.
- Query sai: 400, ví dụ excerpt `{"code":"MSG-COM-10","params":{"field":"page"}}`.
  Lỗi đọc DB: 500 COM-03, không có chi tiết SQL. Các field khác của
  ProblemDetail và message dịch đi theo cấu hình ngôn ngữ hiện có.
- Không có kết quả: 200, items rỗng, total=0; cả bốn counts vẫn có mặt.

## Bằng chứng và giới hạn

`FarmInvitationListResourceTest` và `FarmInvitationListPostgresIT` kiểm JSON,
security/tenant, query/count/page/sort, biên hết hạn và dữ liệu lưu không đổi.
Các test UC1 đọc lại qua envelope mới. PostgreSQL được assert là 16.15, dùng
schema kiểm thử riêng. Browser đã kiểm UI bằng dữ liệu local demo; chưa kiểm
toàn luồng browser → server thật hoặc deployment đã tích hợp. Chưa READY_FOR_FE.
