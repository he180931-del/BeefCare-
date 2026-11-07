# Thư mục `docs`

Mục lục tài liệu dự án BeefCare. Khi bắt đầu một việc, đọc theo thứ tự: `REQUIREMENT_DECISIONS.md` → spec FE-xx của feature → SRS → `api/openapi.json` → `FIGMA.md` (nếu là giao diện). Cách chạy máy xem `LOCAL_SETUP.md`.

## Yêu cầu nghiệp vụ

| File | Ý nghĩa |
|---|---|
| [REQUIREMENT_DECISIONS.md](REQUIREMENT_DECISIONS.md) | Quyết định D01–D12 khi SRS mâu thuẫn hoặc chưa rõ. Ưu tiên cao nhất. |
| [requirements/SRS_2026-10-28.txt](requirements/SRS_2026-10-28.txt) | SRS đã chốt (D12): UC, SCR, GBR, MSG, ma trận quyền. |
| [requirements/BeefCare_Report3_SRS_2026-10-28.docx](requirements/BeefCare_Report3_SRS_2026-10-28.docx) | Bản Word gốc của SRS; tra cứu dùng bản `.txt`. |
| [requirements/BeefCare_Conceptual_ERD.drawio](requirements/BeefCare_Conceptual_ERD.drawio) | ERD mức khái niệm, 10 trang. |
| [requirements/DB_V2_Delta_2026-10-28.md](requirements/DB_V2_Delta_2026-10-28.md) | Hướng dẫn thay đổi DB theo SRS; chỉ tham khảo, không chạy nguyên SQL (D02). |
| [requirements/specs/README.md](requirements/specs/README.md) | Mục lục 23 spec, người phụ trách, người review, số test case. |
| `requirements/specs/FE-01` … `FE-23` | Spec từng feature (11 mục: dữ liệu, quy tắc, luồng, màn hình, contract API, thông báo, test case TC-xx-nn). |
| [requirements/specs/OPEN_QUESTIONS.md](requirements/specs/OPEN_QUESTIONS.md) | Câu hỏi chưa chốt, mỗi câu có người chốt. |
| [requirements/specs/MISSING_ROUTES.md](requirements/specs/MISSING_ROUTES.md) | Phần backend còn thiếu: route chưa có, chỗ lệch spec, trường FE cần, phần chưa kiểm chứng. |

## API và bàn giao backend → frontend

| File | Ý nghĩa |
|---|---|
| [api/openapi.json](api/openapi.json) | Contract API sinh từ code (`OpenApiContractTest`). |
| [api/README.md](api/README.md) | Cách FE đăng nhập, CSRF, idempotency, mã lỗi, điểm tích hợp chính. |
| [api-handoff.html](api-handoff.html) | Bảng tra mọi thao tác API: input/output, UC/BR, trạng thái kiểm chứng. Mở bằng trình duyệt. |
| [backend-workflow.html](backend-workflow.html) | Workflow 7 bước và scope của 4 người backend. Mở bằng trình duyệt. |
| [tools/generate_api_catalog.py](tools/generate_api_catalog.py) | Sinh lại dữ liệu cho `api-handoff.html` sau khi `openapi.json` đổi: `python docs/tools/generate_api_catalog.py`. |
| [templates/BACKEND_UC_REVIEW_TEMPLATE.md](templates/BACKEND_UC_REVIEW_TEMPLATE.md) | Mẫu phiếu ghi bằng chứng kiểm tra và bàn giao một gói UC. |

## Chạy máy và giao diện

| File | Ý nghĩa |
|---|---|
| [LOCAL_SETUP.md](LOCAL_SETUP.md) | Chạy DB, backend, frontend; cổng; tài khoản seed; cấu hình email, Google, SePay. |
| [FIGMA.md](FIGMA.md) | File Figma đúng, các tab Redesign, node frame theo từng màn, quy ước dựng màn, chỗ Figma khác SRS. |

## Ngữ cảnh ngắn cho agent: `agent-context/`

| File | Ý nghĩa |
|---|---|
| [agent-context/README.md](agent-context/README.md) | Chỉ đường: loại việc nào đọc file nào; thứ tự nguồn sự thật. |
| [agent-context/ARCHITECTURE.md](agent-context/ARCHITECTURE.md) | Kiến trúc FE/BE; ánh xạ thư mục feature với FE-xx. |
| [agent-context/API_RULES.md](agent-context/API_RULES.md) | Quy tắc gọi API: proxy `/api`, session/CSRF, idempotency, chế độ backend hay mock. |
| [agent-context/VERIFICATION.md](agent-context/VERIFICATION.md) | Lệnh test frontend/backend; cách lấy bằng chứng UI bằng Playwright. |
| `agent-context/FEATURE_HERD_ENTRY.md`, `FEATURE_HERD_EXIT.md`, `FEATURE_CATTLE.md`, `FEATURE_PEN_MANAGEMENT.md` | Bản đồ code của 4 feature: route, component, adapter, resource, test. |
| [agent-context/PROMPT_TEMPLATE.md](agent-context/PROMPT_TEMPLATE.md) | Mẫu prompt khi giao việc code cho agent. |

## Chỉ để tham khảo lịch sử

| File | Ý nghĩa |
|---|---|
| `superpowers/specs/` (3 file) | Spec cũ về chuồng, nhập, xuất viết trước D12. Không dùng để triển khai hay nghiệm thu; giữ lại theo D12 và vì một migration đã chạy có trỏ tới. |

Hướng dẫn chung cho agent nằm ở gốc repo: `CLAUDE.md`, `AGENTS.md`, `RTK.md`, `backend/AGENTS.md`.
