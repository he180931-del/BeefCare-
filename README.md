# BeefCare- Dự án chăm sóc bò

Tài liệu làm việc hiện tại (cập nhật 07/11/2026). Mục lục đầy đủ của thư mục `docs`: [docs/README.md](docs/README.md).

- **Nguồn yêu cầu (chốt 07/11/2026):** [SRS 28/10](docs/requirements/SRS_2026-10-28.txt) và [23 spec theo feature](docs/requirements/specs/README.md). Xem quyết định D12 trong [REQUIREMENT_DECISIONS](docs/REQUIREMENT_DECISIONS.md).

- [Workflow backend và phân công 4 người](docs/backend-workflow.html): các bước tự kiểm cùng agent, viết test, sửa code, Git và bàn giao FE; không bắt buộc review chéo.
- [Bảng API bàn giao](docs/api-handoff.html): 265 thao tác trong contract hiện tại (sinh lại ngày 07/11/2026), input/output, nguồn UC/BR và trạng thái kiểm chứng. Có xuất/nhập kết quả để tổng hợp.
- [Hướng dẫn agent backend](backend/AGENTS.md).
- [Chạy local](docs/LOCAL_SETUP.md): DB, backend, frontend, tài khoản seed và tích hợp email/Google/SePay.
- Việc còn mở: [câu hỏi cần chốt](docs/requirements/specs/OPEN_QUESTIONS.md) và [phần backend còn thiếu](docs/requirements/specs/MISSING_ROUTES.md).

Clone repo rồi mở hai file HTML trong thư mục `docs` bằng trình duyệt; GitHub hiển thị source HTML. Mỗi người làm nhánh riêng, gộp phần đã kiểm vào `main`; FE dùng bản backend chung đã bàn giao. `production` dành cho sản phẩm cuối. Bảng HTML lưu local trên trình duyệt, cần xuất HTML/JSON để chia sẻ trạng thái với nhóm.

[API contract](docs/api/README.md) là nguồn schema. Bản bàn giao backend ngày 28–29/10 (`HANDOFF_BACKEND.md`) đã được gộp vào các file trên; xem lịch sử git nếu cần bản gốc.
