# Rà soát use case FE20–FE22 trên `lamkd2`

Ngày: 2026-11-09 (Asia/Ho_Chi_Minh)

## Nguồn đã đối chiếu

- `docs/requirements/specs/FE-20-ho-tro-khach-hang.md` (§4–§11, UC-FE20-01…13).
- `docs/requirements/specs/FE-21-thu-chi-nen-tang.md` (§4–§11, UC-FE21-01…09).
- `docs/requirements/specs/FE-22-trang-gioi-thieu.md` (§3–§9, UC-FE22-01).
- SRS 28/10/2026, `docs/REQUIREMENT_DECISIONS.md`, `docs/api/openapi.json` và các DTO/resource backend tương ứng.

## Ma trận UC và kiểm tra bắt buộc

| UC | Luồng và quyền | Pre/post-condition/rule đã kiểm tra | Test hiện có trên nhánh | Kết quả |
| --- | --- | --- | --- | --- |
| FE20-01 | Owner xem ticket của chính mình | scope theo user/farm, không đọc mock ở backend mode | `tests/unit/support/supportApi.test.ts`; backend `SupportTicketWorkflowTest` | Đạt ở unit/workflow; còn smoke HTTP có auth |
| FE20-02 | Owner tạo ticket | category/scope/description, idempotency, lưu history/outbox | Owner adapter + API tests; smoke `TK-9352` | Đạt; tạo/đọc thật và SQL readback |
| FE20-03 | Owner xem chi tiết/lịch sử | public message, version, closed read-only | support API tests; smoke `TK-9352` | Đạt qua API thật; ticket đóng version `7` |
| FE20-04 | Owner phản hồi | OPEN/IN_PROGRESS/WAITING_CUSTOMER, version conflict | `supportApi.test.ts` | Đạt ở workflow/unit |
| FE20-05 | Owner xác nhận resolve/reopen | resolution acknowledgement và quyền owner | support domain/workflow tests | Đạt ở workflow/unit |
| FE20-06 | CS xử lý queue | filter/tab/assignment, claim/handover | `platform-support/supportApi.test.ts` | Đạt; adapter dùng API thật |
| FE20-07 | CS phản hồi/ghi chú nội bộ | `CS_ONLY` không lộ cho Owner, version/idempotency | platform support tests + backend workflow | Đạt ở unit/workflow |
| FE20-08 | CS phân loại/giải quyết/đóng | OPEN → IN_PROGRESS ↔ WAITING_CUSTOMER → RESOLVED → CLOSED; reviewed ack | workflow tests; smoke `TK-9352` | Đạt; full lifecycle thật, SQL `CLOSED` version `7` |
| FE20-09 | CS tạo/quản lý IR | mỗi role một IR mở, reassign/cancel, history/outbox | support unit/workflow | Đạt; mã IR được resolve qua endpoint IR thật |
| FE20-10 | PM/SA xem IR được giao | recipient-only, không đọc IR của người khác | support unit/workflow; smoke `IR-9801` | Đạt; PM đọc đúng yêu cầu được giao |
| FE20-11 | PM/SA tra domain result | domain audit reference hợp lệ | support unit/workflow | Đạt ở test; cần smoke auth |
| FE20-12 | PM/SA hoàn thành IR | PERFORMED/UNABLE/OUTSIDE_DOMAIN, optimistic version | support unit/workflow; smoke `IR-9801` | Đạt; `OUTSIDE_DOMAIN` → `DONE` version `2` |
| FE20-13 | Notification hỗ trợ | recipient-scoped, mark one/all, target access | notification/platform-support unit; authenticated smoke | Đạt; Owner/CS/PM nhận notification theo scope |
| FE21-01 | PM xem biên nhận gói | read-only, search/farm/date, không tạo receipt giả | finance adapter/unit; `ReceiptRoutes` detail test | Đạt adapter; fixture PAID local chưa có |
| FE21-02 | PM tạo nháp | field matrix: type/category/amount/date/scope/farm/source | finance domain + adapter tests; `FR-0003` | Đạt; API/SQL round-trip |
| FE21-03 | PM sửa nháp | chỉ DRAFT, source claim được thay thế | finance workflow + adapter | Đạt; adapter resolve recordCode → numeric id |
| FE21-04 | PM bỏ nháp | chỉ DRAFT, state DISCARDED hiển thị nhóm VOID | backend search + adapter; stale smoke `FR-0002` | Đạt; state lưu `DISCARDED`, UI nhóm `VOID`, version conflict đúng |
| FE21-05 | PM ghi sổ | version, source claim, history/audit/outbox | `PlatformFinanceWorkflowTest` | Đạt ở workflow |
| FE21-06 | PM hủy khoản đã ghi sổ | reason bắt buộc, giữ record gốc, giải phóng bank claim | finance workflow | Đạt ở workflow |
| FE21-07 | PM tạo khoản thay thế | liên kết replacement, kế thừa field, idempotency | finance workflow + adapter | Đạt; endpoint dùng numeric id |
| FE21-08 | PM snapshot dòng tiền | date ≤24 tháng, source/farm filter, immutable snapshot | workflow + latest-report adapter; `SNAP-10101` | Đạt; SQL summary/TTL 30 ngày khớp |
| FE21-09 | PM xem/export snapshot | TTL 30 ngày theo JOB-08, XLSX không tạo số liệu mới | backend export/report tests; XLSX smoke | Đạt; file thật có `Summary` và `Details`, cùng snapshot ID |
| FE22-01 | Guest xem landing | không token; 6 features, 4 steps, 5 FAQ, contact, 3 giá hiệu lực | `PublicLandingAndMock.test.tsx`; public HTTP smoke | Public endpoint 200; Google CTA/anchor đã bổ sung |

## Field/adapter audit trọng điểm

- Finance `recordCode` là mã hiển thị; backend resource nhận `Long id`. Adapter phải list để resolve mã → ID trước `GET/PUT/POST /records/{id}`. Không gửi `FR-*` trực tiếp.
- Filter trại FE21 gửi `scope=FARM&farmId=<number>`; `GENERAL` không gửi farmId.
- Backend state `DISCARDED` được gom vào tab UI `VOID`, nhưng dữ liệu lưu vẫn giữ state gốc.
- Notification backend trả category/targetType khác enum UI. Adapter ánh xạ `SUPPORT_TICKET → TICKET`, `subscription → SUBSCRIPTION_PAYMENT`; platform notices mở ticket/IR bằng numeric target id.
- Không dùng localStorage/sessionStorage cho nghiệp vụ FE20/FE21/FE22 ở backend mode; demo store chỉ được dùng khi `VITE_BEEFCARE_DATA_SOURCE` không phải `backend`.

## Bằng chứng kiểm thử sau thay đổi

- `npm run typecheck` và `npm run build` — đạt (Vite chỉ cảnh báo chunk lớn).
- Frontend focused adapters/notifications — **60 tests passed**; landing local contract — **11 tests passed**; `npm run test:api` — **100 tests passed**.
- Backend package và workflow/domain — đạt với Byte Buddy agent trên Java 24; `RecordDTO.sourceEvidenceId` được kiểm tra bằng workflow test.
- Smoke thật trên `dev,local`: public landing HTTP 200; Owner/CS/PM/SA login và endpoint authorization đúng; ticket FE20 `TK-8751` đã round-trip API → PostgreSQL → API.
- Smoke tích hợp FE21 manual record đã đạt: `FR-0002`/`FR-0003` tạo/post, SQL/API round-trip khớp, stale discard trả 409 và discard đúng version chuyển `DISCARDED`/version `2`.
- Smoke snapshot đã đạt: `SNAP-10101` lưu SQL với `MANUAL_ONLY`, expiry 30 ngày; XLSX thật tải được và workbook có `Summary`/`Details`.
- Còn thiếu có điều kiện môi trường: fixture biên nhận PAID và bank-source/idempotency replay trực tiếp cần payment/evidence hợp lệ (database local hiện không có bản ghi PAID). Unit/workflow đã bao phủ các rule này.

## Giới hạn phạm vi

Không file nào thuộc Herd Exit được chỉnh sửa trong nhánh này. Mọi kiểm tra/commit tiếp theo phải tiếp tục lọc tên file Herd Exit trước khi bàn giao.
