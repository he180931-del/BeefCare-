# BeefCare – Claude Code Guide

Đọc file này trước khi làm việc. `AGENTS.md` và `RTK.md` là tài liệu quy
định chi tiết hơn; khi có khác biệt, ưu tiên `AGENTS.md`, sau đó `RTK.md`, rồi
đến tài liệu nghiệp vụ/API.

## Mục tiêu làm việc

Xây dựng thay đổi nhỏ nhất nhưng đầy đủ nghiệp vụ, dễ đọc, có test và không
làm mất dữ liệu người dùng.

Claude có thể tự thực hiện việc phân tích, sửa code, chạy test, khởi động
service và review. Không bắt buộc phải phân công Luna, Sol hoặc Tera.

## Trước khi code

1. Xác định feature và phạm vi file cần sửa.
2. Đọc context tương ứng trong `docs/agent-context/README.md`.
3. Đối chiếu theo thứ tự:
   - `docs/REQUIREMENT_DECISIONS.md`;
   - SRS đã chốt `docs/requirements/SRS_2026-10-28.txt` và bộ spec `docs/requirements/specs/` (quyết định D12; không dùng bản SRS khác);
   - `docs/api/openapi.json` và DTO/backend liên quan;
   - business rules, migration và test hiện có;
   - Figma hoặc ảnh giao diện được duyệt.
4. Với thay đổi Entry, payment, farm-born calf hoặc pen, lập ma trận trường:
   tên, kiểu, đơn vị, bắt buộc/tùy chọn, điều kiện kích hoạt, validation, API
   và nơi lưu DB.
5. Với thay đổi backend/API, đọc thêm `backend/AGENTS.md` (quy trình tự kiểm,
   tầng test, tiêu chí READY_FOR_FE); dùng `docs/api-handoff.html` và
   `docs/backend-workflow.html` để đối chiếu scope, evidence và trạng thái
   READY_FOR_FE. Khi DTO hoặc route đổi, cập nhật OpenAPI và API catalog theo
   hướng dẫn tương ứng.

## Quy trình mặc định

```text
Đọc tài liệu → phân tích contract → viết test → viết code → chạy test
→ kiểm tra integration/runtime → review → báo cáo phần đã/chưa kiểm chứng
```

- Feature lớn nên dùng branch/worktree riêng; việc nhỏ có thể làm trực tiếp.
- Không sửa trực tiếp `main` khi chưa được phép.
- Nếu test hoặc runtime lỗi: ghi nhận lỗi cụ thể, thêm regression test khi phù
  hợp, sửa nguyên nhân, rồi chạy lại test liên quan.
- Trước khi push/merge, pull code mới nhất và kiểm tra lại luồng chính.

## Cấu trúc frontend

Mỗi feature nằm trong `frontend/src/features/<feature>/`:

- `components/`: các mảnh giao diện dùng trong feature;
- `pages/`: màn hình và route chính;
- `hooks/`: state, logic dùng lại và side effects;
- `api/`: gọi backend, mapping DTO và xử lý request/response;
- `index.ts`: public boundary của feature.

Không thêm feature-specific code mới vào `frontend/src/pages`.

## Quy tắc dữ liệu và API

- Backend là nguồn dữ liệu chính; không hardcode ID, mã bò, mã phiếu, chuồng,
  tồn kho hoặc tổng tiền.
- Frontend gọi API qua đường dẫn tương đối `/api`; không hardcode origin.
- Backend mode không được tự động fallback sang `localStorage`.
- Mapping DTO phải rõ ràng; không biến mất field hoặc ép field về `null` âm
  thầm.
- Mutation phải giữ `Idempotency-Key` và version theo contract.
- Kiểm tra đủ round-trip: UI → request → DTO/validator → service → DB →
  response → UI.

## Test và kiểm tra

- Unit test: trường dữ liệu, hành vi và điều kiện bắt buộc/conditional.
- Integration/API test: các component, adapter, service và backend phối hợp.
- Sau khi hợp nhất feature: chạy integration, typecheck và build phù hợp.
- Ưu tiên E2E thủ công bằng người dùng. Playwright chỉ là công cụ runtime
  tùy chọn để thu thập snapshot, console, network hoặc overflow evidence; không
  xem là automated E2E mặc định.
- Không báo “đã xong” nếu chưa có output test/runtime mới hoặc còn gap chưa
  được nêu rõ.

## UI và runtime

Khi sửa UI, giữ route, dữ liệu, trạng thái và viewport nhất quán khi so sánh
trước/sau. Kiểm tra loading, empty, error, disabled, responsive và overflow.
Ảnh chụp một mình không đủ chứng minh hành vi nếu cần xác nhận API hoặc DB.

## An toàn workspace

- Bảo toàn dirty changes và file chưa được theo dõi.
- Không tự ý `reset --hard`, xóa DB, xóa branch/worktree, stash, commit, push,
  merge hoặc sửa migration đã áp dụng.
- Không ghi secret, token, cookie, mật khẩu hoặc `.env` vào source/tài liệu.
- Khi thay đổi chưa được kiểm chứng đầy đủ, báo rõ: file đã sửa, lệnh đã chạy,
  kết quả, rủi ro và bước còn lại.

## Lệnh local thường dùng

DB, backend, frontend, tài khoản seed và tích hợp email/Google/SePay chạy theo
`docs/LOCAL_SETUP.md`. Frontend chạy từ `frontend/`; API local dùng proxy `/api`
tới backend local.
