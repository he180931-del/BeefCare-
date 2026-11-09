# Trạng thái FE20–FE22 trên nhánh `lamkd2`

Ngày kiểm tra: 2026-11-09 (Asia/Ho_Chi_Minh)

## Phạm vi và nguyên tắc

- Chỉ thay đổi luồng FE20 Hỗ trợ khách hàng, FE21 Thu chi nền tảng và FE22 Trang giới thiệu.
- Không sửa hoặc di chuyển bất kỳ file nào thuộc Herd Exit.
- Backend mode gọi API thật qua `BackendTransport`; local mode mới dùng demo store.
- Các command thay đổi dữ liệu dùng `BackendTransport.command`, vì vậy vẫn gửi CSRF và `Idempotency-Key`.

## UC status

| Nhóm | Trạng thái trên `lamkd2` | Bằng chứng |
| --- | --- | --- |
| FE20 Owner (danh sách, tạo, chi tiết, phản hồi, xác nhận, mở lại) | Đã nối adapter thật | `frontend/src/features/platform-support/api/supportApi.ts`; test support API |
| FE20 CS (queue, claim/handover, phân loại, phản hồi công khai, ghi chú, resolve/close) | Đã nối adapter thật | `frontend/src/features/platform-support/api/supportApi.ts`; test platform-support 11 cases |
| FE20 PM/SA (yêu cầu nội bộ được giao, domain result, hoàn thành) | Đã nối adapter thật | `frontend/src/features/platform-support/api/supportApi.ts`; route `/nen-tang/yeu-cau/*` |
| FE21-01 biên nhận gói chỉ đọc | Đã nối adapter thật | `financeBackendApi.listReceipts/getReceipt`; trang chi tiết gọi GET theo `paymentId` và giữ `priceVersion`, evidence, kỳ áp dụng |
| FE21-02..07 thu chi thủ công | Đã nối adapter thật | CRUD/action adapter, optimistic version và idempotency command |
| FE21-08..09 snapshot dòng tiền/XLSX | Đã nối adapter thật | `reports/latest`, run/get/export adapter; snapshot retention do backend kiểm soát |
| FE22-01 landing | Đã nối adapter thật | `/api/public/landing`, 6 features, 5 FAQ, email/phone và giá công khai |

## Kiểm thử đã chạy

- `npm run typecheck` — đạt.
- `npm run build` — đạt (chỉ còn cảnh báo chunk lớn của Vite).
- Frontend focused adapters/notifications: `supportApi`, `financeBackendApi`, `platformFinanceApi`, `notificationsApi` — **62 tests passed** after the farm/evidence/XLSX adapter checks.
- Frontend local landing/demo contract: `PublicLandingAndMock.test.tsx` với `VITE_BEEFCARE_DATA_SOURCE=local` — **11 tests passed**.
- Frontend API contract suite: `npm run test:api` — **100 tests passed**.
- Backend workflow/domain: `SupportTicketWorkflowTest`, `PlatformFinanceWorkflowTest`, `SupportTicketTest`, `TicketMessageTest`, `InternalRequestTest`, `ManualFinanceRecordTest` — Maven đạt với Byte Buddy agent trên Java 24.
- Smoke HTTP/DB thật trên backend `dev,local`: `/api/public/landing` HTTP 200 (6 feature); Owner/CS/PM/SA login trả đúng ma trận quyền; ticket `TK-8751` đọc khớp API và PostgreSQL (`OPEN`, version `1`). Landing còn có contact mặc định chính thức `tuanpqhe181869@fpt.edu.vn`, `0386 671 863` khi chưa cấu hình biến môi trường.
- Workflow FE20 thật trên PostgreSQL: Owner tạo `TK-9352`; CS claim → `IN_PROGRESS`, hỏi khách → `WAITING_CUSTOMER`, Owner phản hồi → `IN_PROGRESS`, CS resolve → `RESOLVED`, Owner xác nhận, CS close → `CLOSED` version `7` (SQL readback khớp). CS tạo `IR-9801`; PM đọc/tra domain result và hoàn thành `OUTSIDE_DOMAIN` → `DONE` version `2` (SQL readback khớp).
- Workflow FE21 thật: `FR-0003` tạo/post thành công (`654321` VND, `POSTED`, version `2`); snapshot `SNAP-10101` tạo với `MANUAL_ONLY`, TTL 30 ngày, SQL summary khớp; XLSX tải được và có đúng hai sheet `Summary`/`Details`.
- Backend `RecordDTO` trả lại `sourceEvidenceId` từ `BankTransferEvidence` và adapter dùng evidence ID (không dùng provider transaction number); test workflow xác nhận round-trip ID.
- Smoke thanh toán/bank thật trên PostgreSQL: payment `10201` nhận SePay evidence `10301` → `PAID`, receipt `RC-26-010201` API/SQL khớp `priceVersionId=8601`, kỳ mua và masked transaction; replay event trả `duplicate=true`. Evidence chưa khớp `10302` tạo `FR-0004` bằng `sourceEvidenceId`, idempotent create/post, void giải phóng claim; dùng lại evidence PAID bị `409 MSG-FE21-08`.
- Smoke snapshot/notification thật: `SNAP-10601` (ALL) và `SNAP-10602` (MANUAL_ONLY) có summary khớp; replay idempotency trả cùng snapshot; notification PAYMENT_PAID của Owner đọc/đánh dấu qua API và SQL.
- `git diff --check` — đạt.
- Rà soát bổ sung: ngày mặc định dùng múi giờ `Asia/Ho_Chi_Minh`; báo cáo chưa có snapshot vẫn cho phép chạy bản chốt đầu tiên; hàng đợi CS loại ticket đã đóng và tách đúng `UNASSIGNED`/`UNAVAILABLE`; resolution chọn theo version mới nhất; danh mục lỗi không rơi về mã mock trong backend mode; landing giữ đủ 6 tính năng và 5 FAQ trên mobile.

## Giới hạn môi trường

- Testcontainers vẫn phụ thuộc Docker Desktop socket của máy; nếu runner trả HTTP 400 thì ghi nhận là lỗi môi trường, không chuyển sang mock nghiệp vụ.
