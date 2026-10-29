# Review BE — <UC hoặc gói UC>

## Scope

- Chủ BE / người review chéo / thành viên FE nhận:
- Nhánh / commit gốc / commit đã kiểm:
- Trạng thái: TO_REVIEW / REVIEWING / BE_REVIEWED / READY_FOR_FE / FE_INTEGRATING / FE_VERIFIED / BLOCKED.
- UC trong gói; phần ngoài gói:
- Actor, farm/service state, dữ liệu bắt buộc, endpoint phụ thuộc:
- Nguồn: UC (main/AF/E), GBR/BR-D, permission matrix, SCR, state model, ERD/entity detail, quyết định Dxx. Ghi số/tiêu đề thật; không tự điền mã quy tắc chưa xác nhận.

## Acceptance criteria và bằng chứng

Viết expected theo yêu cầu trước; tên test có thể dùng lại cho nhiều dòng.

| Case | Nguồn yêu cầu | Given / When / Then | API / service | Test và tầng / DB | Kết quả + bằng chứng |
|---|---|---|---|---|---|
| AC-01 | <UC bước...; GBR...> | <actor/state/data → action → response + hậu điều kiện> | <route, command, query> | <Class#method; unit/H2/HTTP/PG> | <PASS/FAIL/PENDING; không ghi PASS nếu chưa chạy> |

Các ca áp dụng: happy/alternative/exception, sai quyền/trại, biên input, stale version, retry/replay, rollback, cạnh tranh có rủi ro, correction/void/dependency, lịch sử và readback. Dòng không áp dụng ghi lý do thay vì tạo test giả.

## Findings và xử lý

| ID | Phân loại | Expected / actual + bước tái hiện | Mức ảnh hưởng / chặn gì | Issue / commit sửa | Kết quả rerun |
|---|---|---|---|---|---|
| | <source bug/test fixture/missing coverage/contract/spec/environment> | | | | |

## Kết quả chạy thực tế

- Command, thời điểm, JDK/profile/DB version:
- Suite chạy; số test/failure/error/skipped; báo cáo:
- HTTP/luồng BE trên bản tích hợp; commit/URL:
- Migration: DB mới / upgrade schema cũ / không thay schema:
- Test chưa chạy, lý do và phạm vi chưa kết luận:
- Reviewer và nhận xét/ca reviewer kiểm lại:

## Handoff FE

- Contract DRAFT hay READY_FOR_FE; phạm vi endpoint được nhận:
- Commit/tag, backend URL, profile/provider mock hay live:
- OpenAPI path/file và thay đổi contract:
- Dữ liệu seed / precondition / vai trò cần dùng (không ghi secret):
- Luồng gọi: login/CSRF → query đầu vào → command → readback; header key/version:
- Ví dụ success, validation/domain error, 401/403, conflict áp dụng:
- Dependency chưa sẵn sàng / known limitation / phần ngoài gói:
- Người FE xác nhận và issue tích hợp:

READY_FOR_FE chỉ được ghi khi đã qua tiêu chí của BACKEND_REVIEW_WORKFLOW.md; có contract dự thảo chưa đồng nghĩa API đã sẵn sàng.
