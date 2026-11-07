# Route còn thiếu so với spec

Các thao tác trong mục 7 của spec mà code tại `main` chưa có route riêng. Route ghi ở đây là **đề xuất**; chủ feature chốt route thật, cập nhật `docs/api/openapi.json` và sửa cột Route trong spec khi làm xong.

Tổng: 18 mục.

| FE | Mã | Thao tác | Ghi chú / route đề xuất | Chủ feature | Trạng thái |
|---|---|---|---|---|---|
| FE-01 | A10 | Bảng quyền trong trại hiện tại | chưa có riêng – thêm vào A7 hoặc `GET /api/farms/{farmId}/my-permissions` | LamKD | Chưa làm |
| FE-02 | A7 | Xem trước popup | chưa có riêng – thêm `GET /api/platform/farms/{farmId}` | DucNV | Chưa làm |
| FE-05 | A9 | Lịch sử thay đổi hồ sơ | chưa có riêng – hiện qua dòng thời gian FE-16 (Q2) | AnNT | Chưa làm |
| FE-07 | A2 | Chi tiết | chưa có riêng – thêm `GET …/announcements/{id}` | TaiDX | Chưa làm |
| FE-07 | A5 | Xem trước người nhận khi đăng | chưa có riêng – có thể trả trong A4 | TaiDX | Chưa làm |
| FE-09 | A1 | Danh sách lịch + mũi | `GET /api/farms/{farmId}/vaccination-schedules` (mũi theo tab: chưa có – Q2) | TuanPQ | Chưa làm |
| FE-09 | A2 | Xem trước bò khớp đối tượng | chưa có – thêm `POST …/vaccination-schedules/preview` | TuanPQ | Chưa làm |
| FE-09 | A8 | Tab tiêm của một con | chưa có riêng – thêm `GET /api/farms/{farmId}/cattle/{cattleId}/vaccinations` | TuanPQ | Chưa làm |
| FE-14 | A2 | Chi tiết nhắc việc | Chưa có riêng – đề xuất `GET /api/farms/{farmId}/reminders/{id}` | TaiDX | Chưa làm |
| FE-14 | A4 | Trang chủ Technician | Chưa có riêng – đề xuất `GET /api/farms/{farmId}/technician-home` (hoặc ghép A1 + FE-07 + A3) | TaiDX | Chưa làm |
| FE-14 | A8 | Số chưa đọc (chuông) | Chưa có riêng – đề xuất `GET /api/notifications/unread-count` | TaiDX | Chưa làm |
| FE-15 | A3 | Đóng panel Bắt đầu | Chưa có – đề xuất `POST /api/farms/{farmId}/dashboard/getting-started/dismiss` | TaiDX | Chưa làm |
| FE-17 | A3 | Danh sách mã hành động | Chưa có – đề xuất `GET /api/platform/audit/actions` (hoặc enum cố định ở FE) | DucNV | Chưa làm |
| FE-18 | A7 | Kiểm trước khi ngưng | Chưa có riêng – trả `referencedCount` trong view A2, A3, A5, A6 | AnNT | Chưa làm |
| FE-19 | A14 | Rút phiên bản đã lên lịch | Chưa có – đề xuất `POST /api/platform/plan-prices/{version}/withdraw` | DucNV | Chưa làm |
| FE-23 | A5 | Bỏ nháp phiếu nhập | Chưa có – đề xuất `DELETE …/feed/receipts/{receiptId}` | TaiDX | Chưa làm |
| FE-23 | A10 | Hủy phiên bản lên lịch / dừng khẩu phần | Chưa có – đề xuất `POST …/feed/rations/{rationId}/versions/{v}/cancel` · `POST …/feed/rations/{rationId}/stop` | TaiDX | Chưa làm |
| FE-23 | A12 | Dữ liệu mở popup (kế hoạch theo chuồng, bữa) | Chưa có riêng – đề xuất `GET …/feed/feeding-records/plan` | TaiDX | Chưa làm |
