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
| FE20-01 | Owner tạo ticket | category/scope/description, idempotency, lưu history/outbox | Owner adapter + API tests; smoke `TK-9352` | Đạt; tạo/đọc thật và SQL readback |
| FE20-02 | Owner xem ticket của chính mình | scope theo user/farm, không đọc mock ở backend mode | `tests/unit/support/supportApi.test.ts`; backend `SupportTicketWorkflowTest` | Đạt ở unit/workflow; còn smoke HTTP có auth |
| FE20-03 | Owner trả lời ticket | OPEN/IN_PROGRESS/WAITING_CUSTOMER, version conflict | `supportApi.test.ts`; smoke lifecycle | Đạt qua API thật |
| FE20-04 | Owner xác nhận đã giải quyết | resolution acknowledgement và quyền owner | support domain/workflow tests; smoke lifecycle | Đạt ở workflow/unit |
| FE20-05 | Owner mở lại ticket | lý do, hiệu lực xác nhận và quyền owner | support domain/workflow tests | Đạt ở workflow/unit |
| FE20-06 | CS xem hàng đợi | filter/tab/assignment, claim/handover | `platform-support/supportApi.test.ts` | Đạt; adapter dùng API thật |
| FE20-07 | CS nhận, bàn giao, phân loại, đổi trạng thái | `CS_ONLY` không lộ cho Owner, version/idempotency | platform support tests + backend workflow | Đạt ở unit/workflow |
| FE20-08 | CS trả lời công khai | chỉ CS phụ trách, lifecycle và notification | workflow tests; smoke `TK-9352` | Đạt; full lifecycle thật |
| FE20-09 | CS ghi chú nội bộ | `CS_ONLY`, chỉ CS thấy | platform support tests + backend workflow | Đạt ở unit/workflow |
| FE20-10 | CS ghi kết quả giải quyết | OPEN → IN_PROGRESS ↔ WAITING_CUSTOMER → RESOLVED; reviewed ack | workflow tests; smoke `TK-9352` | Đạt; SQL `CLOSED` version `7` sau bước đóng |
| FE20-11 | CS đóng ticket | cần xác nhận Owner, không IR mở, checkbox review | workflow tests; smoke `TK-9352` | Đạt; full lifecycle thật |
| FE20-12 | CS tạo / đổi người nhận / hủy IR | mỗi role một IR mở, reassign/cancel, history/outbox | support unit/workflow; smoke `IR-9801` | Đạt; mã IR được resolve qua endpoint IR thật |
| FE20-13 | PM/SA xử lý IR được giao | recipient-only, domain result, outcome và version | support unit/workflow; smoke `IR-9801` | Đạt; `OUTSIDE_DOMAIN` → `DONE` version `2` |
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
- Smoke tích hợp FE21 thật đã đạt: `FR-0002`/`FR-0003` tạo/post, SQL/API round-trip khớp, stale discard trả 409 và discard đúng version chuyển `DISCARDED`/version `2`; payment `10201` nhận SePay evidence `10301` thành `PAID`, receipt `RC-26-010201` trả đúng price version/kỳ mua/evidence; replay webhook idempotent.
- Bank-source thật đã đạt với evidence chưa khớp `10302`: `FR-0004` giữ `sourceEvidenceId`, create/post replay không nhân bản, void chuyển `VOID` và giải phóng claim; dùng lại evidence PAID bị `409 MSG-FE21-08`.
- Smoke snapshot thật: `SNAP-10601`/`SNAP-10602` summary và SQL khớp bộ lọc; replay cùng idempotency key trả cùng snapshot; XLSX tải từ snapshot. Notification PAYMENT_PAID được đọc/đánh dấu qua HTTP và SQL.

## Giới hạn phạm vi

Không file nào thuộc Herd Exit được chỉnh sửa trong nhánh này. Mọi kiểm tra/commit tiếp theo phải tiếp tục lọc tên file Herd Exit trước khi bàn giao.
