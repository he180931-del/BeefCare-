# BeefCare- Dự án chăm sóc bò

Tài liệu làm việc hiện tại (29/10/2026):

- [Workflow backend và phân công 4 người](docs/backend-workflow.html): các bước tự kiểm cùng agent, viết test, sửa code, Git và bàn giao FE; không bắt buộc review chéo.
- [Bảng API bàn giao](docs/api-handoff.html): 257 thao tác trong contract hiện tại, input/output, nguồn UC/BR và trạng thái kiểm chứng. Có xuất/nhập kết quả để tổng hợp.
- [Hướng dẫn agent backend](backend/AGENTS.md).

Clone repo rồi mở hai file HTML trong thư mục `docs` bằng trình duyệt; GitHub hiển thị source HTML. Mỗi người làm nhánh riêng, gộp phần đã kiểm vào `main`; FE dùng bản backend chung đã bàn giao. `production` dành cho sản phẩm cuối. Bảng HTML lưu local trên trình duyệt, cần xuất HTML/JSON để chia sẻ trạng thái với nhóm.

[API contract](docs/api/README.md) là nguồn schema. [HANDOFF_BACKEND.md](HANDOFF_BACKEND.md) giữ lịch sử bàn giao, cách chạy và các kết quả trước đó; đọc các cập nhật cuối để tránh dùng thông tin checkpoint cũ.
