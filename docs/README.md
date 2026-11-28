# Thư mục `docs`

Mục lục tài liệu dự án BeefCare. Khi bắt đầu một việc, đọc theo thứ tự: `REQUIREMENT_DECISIONS.md` → spec FE-xx của feature → SRS → `api/openapi.json` → `FIGMA.md` (nếu là giao diện). Cách chạy máy xem `LOCAL_SETUP.md`.

## Yêu cầu nghiệp vụ

| File | Ý nghĩa |
|---|---|
| [REQUIREMENT_DECISIONS.md](REQUIREMENT_DECISIONS.md) | Quyết định D01–D90 khi SRS mâu thuẫn hoặc chưa rõ, gồm các câu hỏi spec đã chốt. Ưu tiên cao nhất. |
| [requirements/SRS_Report3_v1.2.txt](requirements/SRS_Report3_v1.2.txt) | SRS đã chốt (D90): bản tra cứu của Report 3 v1.2 — UC, SCR, GBR, BR-D, MSG, ma trận quyền. Sinh lại từ file Word mỗi khi Report 3 đổi: `python docs/tools/docx_to_srs_txt.py "<Report3.docx>" docs/requirements/SRS_Report3_v1.2.txt`. |
| [requirements/UC_ID_MAPPING.md](requirements/UC_ID_MAPPING.md) | Đối chiếu mã cũ (SRS 28/10, vẫn dùng trong code, test, spec) với mã Report 3 v1.2: use case (D88) và BR-D (D90). |
| [requirements/BeefCare_Conceptual_ERD.drawio](requirements/BeefCare_Conceptual_ERD.drawio) | ERD mức khái niệm, 10 trang. |
| [requirements/specs/README.md](requirements/specs/README.md) | Mục lục spec, người phụ trách, người review, số test case. |
| `requirements/specs/FE-01` … `FE-23` | Spec từng feature (dữ liệu, quy tắc, luồng, màn hình, contract API, thông báo, test case TC-xx-nn). FE-15 có thêm spec báo cáo thu chi trại (D86); FE-20 có phiếu chốt quyết định `FE-20-DECISION-PACKET.md`. |
| [requirements/specs/OPEN_QUESTIONS.md](requirements/specs/OPEN_QUESTIONS.md) | Câu hỏi chưa chốt, mỗi câu có người chốt; nơi ghi chỗ Report 3 v1.2 nói khác spec (D90). |
| [requirements/specs/MISSING_ROUTES.md](requirements/specs/MISSING_ROUTES.md) | Phần backend còn thiếu: route chưa có, chỗ lệch spec, trường FE cần, phần chưa kiểm chứng. |

SRS 28/10 cũ (`SRS_2026-10-28.txt`) đã bỏ theo D90; xem lại bằng `git show cc64a5ba:docs/requirements/SRS_2026-10-28.txt` khi cần nghĩa của mã NFR-xx, RPT-xx hoặc BR-D cũ.

## Báo cáo đồ án: `Reports/`

| File | Ý nghĩa |
|---|---|
| `Reports/BeefCare_Report1_Project_Introduction_v1.2.docx` | Report 1 – Giới thiệu dự án. |
| `Reports/BeefCare_Report2_Project_Management_Plan_v1.2.docx` | Report 2 – Kế hoạch quản lý dự án. |
| `Reports/BeefCare_Report3_Software Requirement Specification_v1.2.docx` | Report 3 – SRS, bản gốc của `requirements/SRS_Report3_v1.2.txt`. |
| `Reports/BeefCare_Report4_Software_Design_Document_v1.1.docx` | Report 4 – Thiết kế phần mềm. |
| `Reports/Report-5.0_Test_Documentation_BeefCare.docx` | Report 5.0 – Tài liệu kiểm thử. |
| `Reports/BeefCare_Report5.1_Unit_Test.xlsx`, `5.2_Integration_Test.xlsx`, `5.3_System_Test.xlsx` | Report 5.1–5.3 – Kiểm thử đơn vị, tích hợp, hệ thống; dẫn mã UC mới (D88). |

## API

| File | Ý nghĩa |
|---|---|
| [api/openapi.json](api/openapi.json) | Contract API sinh từ code (`OpenApiContractTest`). |
| [api/README.md](api/README.md) | Cách FE đăng nhập, CSRF, idempotency, mã lỗi, điểm tích hợp chính. Trạng thái bàn giao từng API ghi trong PR (D90). |

## Chạy máy, dữ liệu mẫu và giao diện

| File | Ý nghĩa |
|---|---|
| [LOCAL_SETUP.md](LOCAL_SETUP.md) | Chạy DB, backend, frontend; cổng; tài khoản seed; cấu hình email, Google, SePay. |
| [local-demo-seed.md](local-demo-seed.md) | Nạp dữ liệu demo local qua HTTP API sau khi backend `dev,local` đã chạy. |
| [FIGMA.md](FIGMA.md) | File Figma đúng, các tab Redesign, node frame theo từng màn, quy ước dựng màn, chỗ Figma khác SRS. |
| [BeefCare-Bento-Grid.md](BeefCare-Bento-Grid.md) | Quy tắc thiết kế Bento Grid dùng chung cho Figma và React. |
| [FRONTEND_REACT_GUIDE_VI.md](FRONTEND_REACT_GUIDE_VI.md) | Hướng dẫn đọc frontend cho người mới với React. |

## Kiểm thử: `testing/`

| File | Ý nghĩa |
|---|---|
| [testing/COMMANDS.md](testing/COMMANDS.md) | Lệnh chạy test frontend và backend, phiên bản công cụ, kết quả lần kiểm gần nhất. |
| [testing/UNIT_TEST_REPORT_TEMPLATE.md](testing/UNIT_TEST_REPORT_TEMPLATE.md) | Mẫu Report 5.1 – Unit Test: mỗi chủ feature điền case TC-xx-nn, tầng, kết quả, môi trường. |
| [testing/QA_FIXTURES.md](testing/QA_FIXTURES.md) | Bộ dữ liệu QA riêng và cách nạp/reset. |
| [testing/NFR_TEST_PLAN.md](testing/NFR_TEST_PLAN.md) | Kế hoạch kiểm thử NFR và kết quả đo hiệu năng local 16/11; số đo gốc ở `testing/evidence/`. |
| [testing/TAI_ACCEPTANCE.md](testing/TAI_ACCEPTANCE.md) | Kịch bản kiểm tra local cho FE-07, FE-14, FE-15, FE-23, JOB-01, JOB-07. |
| `testing/FE01_AUTH_MANUAL_E2E_SCENARIOS.md`, `FE01_AUTH_MINIMAL_TEST_MATRIX.md` | Kịch bản E2E thủ công và ma trận test xác thực FE-01. |
| [testing/FE20_TARGET_TEST_DESIGN.md](testing/FE20_TARGET_TEST_DESIGN.md) | Thiết kế test FE-20, chờ các quyết định còn mở. |
| [testing/FE21_TEST_STRATEGY_AND_COVERAGE.md](testing/FE21_TEST_STRATEGY_AND_COVERAGE.md) | Kế hoạch kiểm thử và phân tích độ phủ FE-21. |
| [testing/FE23_PHASE1_HANDOFF.md](testing/FE23_PHASE1_HANDOFF.md) | Ma trận trường và bằng chứng kiểm tra FE-23 giai đoạn 1. |

## Bằng chứng triển khai: `superpowers/`

| File | Ý nghĩa |
|---|---|
| `superpowers/specs/2026-11-23-fe01-auth-stability-design.md`, `superpowers/plans/2026-11-23-fe01-auth-stability.md` | Thiết kế và kế hoạch ổn định xác thực FE-01; spec FE-01 dẫn chiếu làm bằng chứng triển khai. |
| `superpowers/plans/2026-11-24-fe20-decision-gate-wbs.md` | WBS chốt quyết định FE-20; phiếu chốt FE-20 và thiết kế test FE-20 dẫn chiếu. |

## Tài liệu đã gỡ

Phiếu review, ví dụ API, `agent-context/`, bảng tra API HTML và các tài liệu một lần khác đã gỡ khỏi repo. Khi tài liệu còn lại dẫn tới chúng, đường dẫn có dạng `<commit>:<đường dẫn>`, ví dụ `879cf0f7^:docs/reviews/FE19_UC05_REVIEW.md` hoặc `cc64a5ba:docs/agent-context/FE-11-12-progress.md`. Mở bằng `git show <commit>:<đường dẫn>` (D90).

Hướng dẫn chung cho agent nằm ở gốc repo: `CLAUDE.md`, `AGENTS.md`, `RTK.md`, `backend/AGENTS.md`.
