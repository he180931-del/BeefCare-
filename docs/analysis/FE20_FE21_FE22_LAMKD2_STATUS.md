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
| FE20 Owner (danh sách, tạo, chi tiết, phản hồi, xác nhận, mở lại) | Đã nối adapter thật | `frontend/src/features/support/api/supportApi.ts`; test support API |
| FE20 CS (queue, claim/handover, phân loại, phản hồi công khai, ghi chú, resolve/close) | Đã nối adapter thật | `frontend/src/features/platform-support/api/supportApi.ts`; test platform-support 11 cases |
| FE20 PM/SA (yêu cầu nội bộ được giao, domain result, hoàn thành) | Đã nối adapter thật | `frontend/src/features/platform-support/api/supportApi.ts`; route `/nen-tang/yeu-cau/*` |
| FE21-01 biên nhận gói chỉ đọc | Đã nối adapter thật | `financeBackendApi.listReceipts/getReceipt`; trang chi tiết gọi GET theo `paymentId` và giữ `priceVersion`, evidence, kỳ áp dụng |
| FE21-02..07 thu chi thủ công | Đã nối adapter thật | CRUD/action adapter, optimistic version và idempotency command |
| FE21-08..09 snapshot dòng tiền/XLSX | Đã nối adapter thật | `reports/latest`, run/get/export adapter; snapshot retention do backend kiểm soát |
| FE22-01 landing | Đã nối adapter thật | `/api/public/landing`, 6 features, 5 FAQ, email/phone và giá công khai |

## Kiểm thử đã chạy

- `npm run typecheck` — đạt.
- `npm run build` — đạt (chỉ còn cảnh báo chunk lớn của Vite).
- Frontend focused adapters/notifications: `supportApi`, `financeBackendApi`, `platformFinanceApi`, `notificationsApi` — **60 tests passed**.
- Frontend local landing/demo contract: `PublicLandingAndMock.test.tsx` với `VITE_BEEFCARE_DATA_SOURCE=local` — **11 tests passed**.
- Frontend API contract suite: `npm run test:api` — **100 tests passed**.
- Backend workflow/domain: `SupportTicketWorkflowTest`, `PlatformFinanceWorkflowTest`, `SupportTicketTest`, `TicketMessageTest`, `InternalRequestTest`, `ManualFinanceRecordTest` — Maven đạt với Byte Buddy agent trên Java 24.
- Smoke HTTP/DB thật trên backend `dev,local`: `/api/public/landing` HTTP 200 (6 feature); Owner/CS/PM/SA login trả đúng ma trận quyền; ticket `TK-8751` đọc khớp API và PostgreSQL (`OPEN`, version `1`).
- Workflow FE20 thật trên PostgreSQL: Owner tạo `TK-9352`; CS claim → `IN_PROGRESS`, hỏi khách → `WAITING_CUSTOMER`, Owner phản hồi → `IN_PROGRESS`, CS resolve → `RESOLVED`, Owner xác nhận, CS close → `CLOSED` version `7` (SQL readback khớp). CS tạo `IR-9801`; PM đọc/tra domain result và hoàn thành `OUTSIDE_DOMAIN` → `DONE` version `2` (SQL readback khớp).
- Workflow FE21 thật: `FR-0003` tạo/post thành công (`654321` VND, `POSTED`, version `2`); snapshot `SNAP-10101` tạo với `MANUAL_ONLY`, TTL 30 ngày, SQL summary khớp; XLSX tải được và có đúng hai sheet `Summary`/`Details`.
- Backend `RecordDTO` trả lại `sourceEvidenceId` từ `BankTransferEvidence` và adapter dùng evidence ID (không dùng provider transaction number); test workflow xác nhận round-trip ID.
- `git diff --check` — đạt.

## Còn cần kiểm tra ở môi trường tích hợp

- Bổ sung fixture biên nhận PAID nếu database local chưa có payment/evidence tương ứng; hiện database local không có payment PAID nên chưa thể chứng minh UI biên nhận bằng dữ liệu thanh toán thật.
- Smoke mutation FE21 manual record đã đạt: tạo `FR-0002` (201), đọc lại API/SQL khớp amount `123456`, state `DRAFT`, version `1`; stale discard trả `409 MSG-COM-05`; discard đúng version trả `DISCARDED`, version `2`.
- Bank-source mutation và idempotency replay trực tiếp trên PostgreSQL vẫn cần fixture evidence/payment hợp lệ; workflow/unit đã kiểm tra claim, giải phóng khi void và version conflict.
- Testcontainers hiện phụ thuộc Docker Desktop socket của máy; nếu runner trả HTTP 400 thì ghi nhận là lỗi môi trường, không chuyển sang mock nghiệp vụ.
