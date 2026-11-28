# BeefCare- Dự án chăm sóc bò

Tài liệu làm việc hiện tại (cập nhật 28/11/2026). Mục lục đầy đủ của thư mục `docs`: [docs/README.md](docs/README.md).

- **Nguồn yêu cầu (từ 28/11/2026):** [SRS Report 3 v1.2](docs/requirements/SRS_Report3_v1.2.txt) và [23 spec theo feature](docs/requirements/specs/README.md). Xem quyết định D90 trong [REQUIREMENT_DECISIONS](docs/REQUIREMENT_DECISIONS.md); mã cũ đối chiếu tại [UC_ID_MAPPING](docs/requirements/UC_ID_MAPPING.md).

- [Hướng dẫn backend](backend/AGENTS.md): các bước tự kiểm cùng agent, viết test, sửa code, Git, scope 4 người và bàn giao FE; không bắt buộc review chéo.
- [Báo cáo đồ án](docs/README.md#báo-cáo-đồ-án-reports): Report 1–5 trong `docs/Reports/`.
- [Chạy local](docs/LOCAL_SETUP.md): DB, backend, frontend, tài khoản seed và tích hợp email/Google/SePay.
- Việc còn mở: [câu hỏi cần chốt](docs/requirements/specs/OPEN_QUESTIONS.md) và [phần backend còn thiếu](docs/requirements/specs/MISSING_ROUTES.md).

Mỗi người làm nhánh riêng, gộp phần đã kiểm vào `main`; FE dùng bản backend chung đã bàn giao. `production` dành cho sản phẩm cuối. Trạng thái bàn giao từng API ghi trong PR.

[API contract](docs/api/README.md) là nguồn schema. Bản bàn giao backend ngày 28–29/10 (`HANDOFF_BACKEND.md`) đã được gộp vào các file trên; xem lịch sử git nếu cần bản gốc.
