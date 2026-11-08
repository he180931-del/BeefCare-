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
| FE20 Owner (danh sách, tạo, chi tiết, phản hồi, xác nhận, mở lại) | Đã nối adapter thật | `frontend/src/features/support/api/supportApi.ts`; test support API 12 cases |
| FE20 CS (queue, claim/handover, phân loại, phản hồi công khai, ghi chú, resolve/close) | Đã nối adapter thật | `frontend/src/features/platform-support/api/supportApi.ts`; test platform-support 11 cases |
| FE20 PM/SA (yêu cầu nội bộ được giao, domain result, hoàn thành) | Đã nối adapter thật | `frontend/src/features/platform-support/api/supportApi.ts`; route `/nen-tang/yeu-cau/*` |
| FE21-01 biên nhận gói chỉ đọc | Đã nối adapter thật | `financeBackendApi.listReceipts/getReceipt` |
| FE21-02..07 thu chi thủ công | Đã nối adapter thật | CRUD/action adapter, optimistic version và idempotency command |
| FE21-08..09 snapshot dòng tiền/XLSX | Đã nối adapter thật | `reports/latest`, run/get/export adapter; snapshot retention do backend kiểm soát |
| FE22-01 landing | Đã nối adapter thật | `/api/public/landing`, 6 features, 5 FAQ, email/phone và giá công khai |

## Kiểm thử đã chạy

- `npm run typecheck` — đạt.
- `npm run build` — đạt (chỉ còn cảnh báo chunk lớn của Vite).
- Frontend focused: `financeBackendApi`, `platformFinanceApi`, `platform-support/supportApi`, Owner `supportApi`, `accountApi` — **52 tests passed**.
- Backend workflow/domain: `SupportTicketWorkflowTest`, `PlatformFinanceWorkflowTest`, `SupportTicketTest`, `TicketMessageTest`, `InternalRequestTest`, `ManualFinanceRecordTest` — Maven chạy đạt với Byte Buddy agent trên Java 24.
- Smoke HTTP: `/api/public/landing` trả HTTP 200 trên backend `lamkd2` với PostgreSQL thật; payload có 6 feature và 5 FAQ.
- `git diff --check` — đạt.

## Còn cần kiểm tra ở môi trường tích hợp

- Chạy smoke HTTP có xác thực trên đúng worktree `lamkd2` (đăng nhập PM/CS/Owner, tạo dữ liệu và đọc lại DB); smoke public landing đã đạt.
- Bổ sung fixture biên nhận PAID nếu database local chưa có payment/evidence tương ứng.
- Kiểm tra trực tiếp stale-version/idempotency và quyền Owner/CS/PM/SA trong ma trận API.
- Testcontainers hiện phụ thuộc Docker Desktop socket của máy; nếu runner trả HTTP 400 thì ghi nhận là lỗi môi trường, không chuyển sang mock nghiệp vụ.
