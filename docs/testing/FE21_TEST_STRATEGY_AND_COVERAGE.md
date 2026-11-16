# Kế hoạch kiểm thử và phân tích độ phủ FE21

> Feature: FE-21 — Thu chi và báo cáo dòng tiền nền tảng
> Phạm vi: UC-FE21-01 đến UC-FE21-09, SCR-70 đến SCR-73
> Nguồn yêu cầu: SRS ngày 28/10/2026 theo quyết định D12
> Loại tài liệu: kế hoạch + baseline phân tích tĩnh; không phải biên bản xác nhận FE21 đã đạt
> Baseline code đã đọc: nhánh `lamkd2`, commit `b8e69b32b1ad`
> Ngày lập: 11/11/2026

## 1. Mục tiêu và giới hạn

Tài liệu này xác định cách kiểm thử FE21 theo ba chiều độc lập:

1. Phủ yêu cầu và hợp đồng dữ liệu từ giao diện đến database.
2. Phủ code và phủ nhánh ở frontend, backend, API, transaction và file XLSX.
3. Kiểm thử chức năng bằng thao tác trực tiếp trên giao diện thật, dùng API thật và database thật.

Không dùng `localStorage`, mock store hoặc dữ liệu demo làm bằng chứng nghiệm thu. Mock chỉ phù hợp với unit test cô lập. Kết quả thành công ở UI hoặc HTTP chưa đủ chứng minh dữ liệu đã lưu; các ca ghi dữ liệu phải có API/database readback.

Tài liệu không thay đổi mã nguồn, không sửa dữ liệu và không khẳng định tỷ lệ coverage khi chưa sinh báo cáo coverage thực tế.

## 2. Nguồn đối chiếu

| Nhóm | Nguồn |
|---|---|
| Yêu cầu chuẩn | `docs/requirements/SRS_2026-10-28.txt`, phần FE21, GBR-66, GBR-82 đến GBR-89, BR-D27, BR-D28, BR-D30, JOB-08 |
| Đặc tả feature | `docs/requirements/specs/FE-21-thu-chi-nen-tang.md` |
| Quyết định | `docs/REQUIREMENT_DECISIONS.md`, đặc biệt D12 |
| Điểm chưa chốt | `docs/requirements/specs/OPEN_QUESTIONS.md`, mục FE21 |
| Route còn thiếu/chưa chứng minh | `docs/requirements/specs/MISSING_ROUTES.md`, mục FE21 |
| Hợp đồng API | `docs/api/openapi.json`, resource/DTO/service hiện tại |
| Frontend | `frontend/src/features/platform-finance/` |
| Backend | `PlatformFinanceResource`, `PlatformSubscriptionResource`, `PlatformFinanceService`, entity/repository/migration FE21 |
| Test hiện có | `frontend/tests/unit/platform-finance/`, `PlatformFinanceWorkflowTest` và các resource test liên quan |

## 3. Kết quả ba vòng rà soát

### Vòng 1 — phủ yêu cầu, trạng thái và hợp đồng

- FE21 gồm 9 use case, không chỉ phần báo cáo: biên lai chỉ đọc; tạo, xem, sửa, bỏ, ghi sổ, hủy khoản thủ công; chạy và xuất báo cáo.
- Chỉ tài khoản có quyền nền tảng `PM` đang ACTIVE được sử dụng FE21. Owner, Manager, Technician, CS, SA, PM bị thu hồi và người chưa đăng nhập phải bị chặn ở backend, không chỉ ẩn menu.
- Vòng đời khoản thủ công là `DRAFT → POSTED → VOID`; nháp có thể bị `DISCARDED`. Chỉ DRAFT được sửa, POSTED bất biến, VOID tạo được nháp thay thế.
- Nguồn ngân hàng là nhánh có rủi ro cao: phải là evidence xác thực, đúng chiều, không phải giao dịch gói và chưa được nguồn khác nhận. Claim phải duy nhất kể cả hai transaction đồng thời.
- Báo cáo là snapshot bất biến. Mỗi lần chạy tạo snapshot mới; xuất phải lấy đúng snapshot đang hiển thị, không tính lại từ dữ liệu hiện hành.
- SRS JOB-08 quy định snapshot cũ hơn 30 ngày bị EXPIRED/xóa dòng. Đề xuất 24 giờ trong `OPEN_QUESTIONS.md` chưa phải quyết định cao hơn SRS.

### Vòng 2 — phủ code, phủ nhánh và bằng chứng tự động

- Frontend hiện có 43 test FE21 ở ba file: 21 test domain/demo API, 9 test backend adapter và 13 test page/component.
- Backend có 12 test workflow chính trong `PlatformFinanceWorkflowTest`; ngoài ra có resource/entity test sinh từ JHipster nhưng không được tính là bằng chứng đầy đủ cho workflow FE21 nếu không đi qua service thật.
- Baseline đã quan sát: 43/43 frontend test qua khi ép `VITE_BEEFCARE_DATA_SOURCE=local`. Khi chạy theo `.env` backend, 13 page test phụ thuộc demo bị lỗi; đây là vấn đề cô lập môi trường test.
- Backend workflow hiện chưa tạo được baseline xanh trên máy kiểm tra: JDK 25 cần cấu hình Mockito agent; sau khi vượt bước đó, H2 dừng vì migration đăng ký thiếu cột `google_last_used_at` trong `master.xml`. Đây là blocker tích hợp repository, không phải bằng chứng 12 rule FE21 sai.
- Chưa có báo cáo JaCoCo/Vitest coverage được sinh và kiểm chứng trong lần rà này. Các ngưỡng ở mục 9 là tiêu chí đề xuất, không phải số đo hiện tại.

### Vòng 3 — phủ tương tác giao diện và round-trip thật

- Cần kiểm bốn màn SCR-70 đến SCR-73 ở hai viewport chuẩn `1440×900` và `1180×820`.
- Mỗi thao tác ghi phải lưu bằng chứng gồm: trạng thái UI, request/response, bản ghi DB, history, audit và version sau thao tác.
- Phải dùng tài khoản thật theo role và session thật. Không sửa role/farm ID trong frontend để giả lập quyền.
- Screenshot chỉ chứng minh hình ảnh; phải ghép với accessibility/page snapshot, console, request status và DB/API readback.
- Repo hiện chưa có bộ Playwright E2E chuẩn hoặc baseline visual được duyệt; vì vậy các ca ở mục 12 là manual runtime test, không được báo cáo là automated E2E.

## 4. Kiến trúc và đường đi dữ liệu cần chứng minh

```text
SCR-70..73
  → financeApi (chọn backend mode)
  → financeBackendApi (map UI ↔ contract)
  → apiTransport (session, CSRF, idempotency)
  → PlatformSubscriptionResource / PlatformFinanceResource
  → PlatformAccessService + IdempotencyCommandService
  → PlatformFinanceService
  → repository/entity + transaction
  → PostgreSQL
  → DTO / XLSX bytes
  → adapter → React state → UI
```

Điểm chấp nhận quan trọng:

- Không có dữ liệu nghiệp vụ FE21 lấy từ `localStorage` trong backend mode.
- Role và ownership được quyết định ở backend.
- `Idempotency-Key` được xử lý ở command boundary; cùng key/cùng body trả lại cùng kết quả, cùng key/khác body bị từ chối.
- Version do backend trả về và được gửi lại ở mọi thao tác thay đổi record.
- History và audit được commit cùng transaction với thay đổi trạng thái.

## 5. Ma trận trường khoản thu chi

| Trường | Kiểu / giới hạn | Bắt buộc | Nhánh phải test | Nguồn chuẩn |
|---|---|---:|---|---|
| `recordCode` | `FR-nnnn`, duy nhất | Hệ thống | tuần tự, không trùng khi đồng thời | SRS §3.2 |
| `type` | `INCOME`, `EXPENSE` | Có | hợp lệ, null, enum lạ | GBR-83 |
| `category` | enum theo type | Có | đúng loại, sai loại, mã lạ, thay type | GBR-83, MSG-FE21-10 |
| `amountVnd` | số nguyên, ≥1 | Có | null, 0, âm, 1, thập phân, giá trị lớn | BR-D27, MSG-FE21-09 |
| `occurredOn` | ngày VN, không tương lai | Có | hôm qua, hôm nay, ngày mai, biên nửa đêm | SCR-72, GBR-66 |
| `scope` | `GENERAL`, `FARM` | Có | GENERAL không farm; FARM có/thiếu/sai farm | BR-D27 |
| `farmId` | ID farm | Khi FARM | tồn tại, không tồn tại, null, trại ngưng | BR-D27 |
| `documentNumber` | chuỗi ≤100 | Không | 0, 100, 101 ký tự; Unicode | SCR-72 |
| `description` | chuỗi ≤500 | Không | 0, 500, 501 ký tự; Unicode và ký tự XML | SCR-72 |
| `sourceType` | `MANUAL`, `BANK_TRANSACTION` | Có | manual/bank/enum lạ | SRS §3.2 |
| `sourceEvidenceId` | ID evidence | Khi BANK | đúng chiều, sai chiều, đã claim, giao dịch gói, không VERIFIED | GBR-84 |
| `state` | DRAFT/POSTED/VOID; internal DISCARDED | Hệ thống | mọi chuyển trạng thái hợp lệ và bị cấm | GBR-83 |
| `version` | khóa lạc quan | Khi thay đổi | hiện tại, cũ, null, hai PM đồng thời | GBR-89 |
| `reason` | lý do hủy ≤500 theo đề xuất Q3 | Khi VOID | trống, khoảng trắng, 500, 501 | UC-FE21-07 |

Danh mục backend hiện quan sát:

- Thu: `OTHER_INCOME`, `REFUND`, `INTEREST`.
- Chi: `OPERATIONS`, `MARKETING`, `SOFTWARE`, `BANK_FEE`, `OTHER_EXPENSE`.

Danh sách này phải được product xác nhận vì Q1 vẫn mở. Test không được đóng đinh danh mục demo khác với API thật.

## 6. Ma trận quyền

| Actor/session | Mở route UI | GET dữ liệu | Command ghi | XLSX | Kỳ vọng |
|---|---:|---:|---:|---:|---|
| PM ACTIVE | Có | Có | Có | Có | 2xx theo nghiệp vụ |
| PM đã thu hồi | Không | Không | Không | Không | 403 từ request kế tiếp |
| Owner | Không | Không | Không | Không | 403, không lộ số liệu |
| CS | Không | Không | Không | Không | 403 |
| SA | Không | Không | Không | Không | 403 |
| Manager/Technician | Không | Không | Không | Không | 403 |
| Chưa đăng nhập/session hết hạn | Chuyển đăng nhập | Không | Không | Không | 401/redirect theo security contract |

Kiểm quyền phải gọi trực tiếp API; việc menu không xuất hiện không đủ chứng minh.

## 7. Ma trận trạng thái và thao tác

| Trạng thái hiện tại | Sửa | Bỏ nháp | Ghi sổ | Hủy | Tạo thay thế | Vào báo cáo |
|---|---:|---:|---:|---:|---:|---:|
| DRAFT | Có | Có | Có | Không | Không | Không |
| POSTED | Không | Không | Không | Có | Không | Có |
| VOID | Không | Không | Không | Không | Có | Không ở snapshot mới |
| DISCARDED | Không | Không | Không | Không | Không | Không |

Ngoài happy path, gọi mọi action không hợp lệ bằng API trực tiếp và xác nhận DB/history/audit không đổi.

## 8. Truy vết 24 test chuẩn của spec

| TC spec | Nội dung | Bằng chứng hiện có | Phần còn phải bổ sung/chứng minh |
|---|---|---|---|
| TC-21-01 | role khác PM → 403 | Backend workflow có guard service | HTTP security đủ role và route, UI direct URL |
| TC-21-02 | category sai type | FE rule + backend validation | HTTP payload thật và thông báo VN |
| TC-21-03 | tiền 0/âm/thập phân | FE rule + backend validation | boundary lớn, JSON decimal |
| TC-21-04 | ngày tương lai | Backend validation | UI/API và timezone boundary |
| TC-21-05 | FARM thiếu farm | FE + backend validation | farm không tồn tại |
| TC-21-06 | transfer của gói | Backend workflow | transaction đã PAID thật |
| TC-21-07 | bank source đã POSTED | Backend workflow | hai transaction đồng thời |
| TC-21-08 | sửa/bỏ DRAFT | FE demo + backend workflow | HTTP/DB/history/audit |
| TC-21-09 | sửa POSTED bị chặn | FE demo + backend workflow | HTTP status/code |
| TC-21-10 | VOID thiếu lý do | FE demo + backend workflow | 500/501 ký tự |
| TC-21-11 | VOID giải phóng bank source | FE demo + backend workflow | PostgreSQL claim readback |
| TC-21-12 | tạo nháp thay thế | FE demo + backend workflow | field copy, liên kết hai chiều |
| TC-21-13 | hai PM cùng post | test hiện tại tuần tự | concurrency thật bằng hai transaction/session |
| TC-21-14 | tổng báo cáo chuẩn | FE demo + backend workflow | API/PostgreSQL deterministic fixture |
| TC-21-15 | receipt sát nửa đêm | Chưa đủ | timezone Asia/Ho_Chi_Minh |
| TC-21-16 | lọc farm bỏ GENERAL | FE demo + backend workflow | UI bảng không có dòng Chung |
| TC-21-17 | PENDING/HOLD bị loại | Một phần ở service test | đủ state payment/evidence |
| TC-21-18 | snapshot S1 bất biến | FE demo + backend workflow | source version trong dòng snapshot |
| TC-21-19 | XLSX đúng S1, 2 sheet | adapter chỉ kiểm blob | mở workbook và đối chiếu nội dung |
| TC-21-20 | snapshot EXPIRED | FE demo + backend workflow | HTTP 410 và UI banner |
| TC-21-21 | báo cáo rỗng | FE demo | file XLSX rỗng hợp lệ |
| TC-21-22 | kỳ 25 tháng | FE + backend validation | boundary lệch ngày FE/BE |
| TC-21-23 | receipt chỉ đọc | FE page test một phần | UI thật + API không có mutation route |
| TC-21-24 | audit POSTED | Backend có audit | Tên action hiện lệch spec |

## 9. Chiến lược code coverage và branch coverage

### 9.1 Ngưỡng đề xuất

| Phạm vi | Line coverage | Branch coverage | Ghi chú |
|---|---:|---:|---|
| FE domain rules + adapters | ≥95% | ≥90% | mapping, validation, date/source/status branches |
| FE pages/components FE21 | ≥85% | ≥80% | trạng thái loading/error/empty/success/dialog |
| BE `PlatformFinanceService` | ≥95% | ≥90% | tiền, quyền, state, bank claim, report, expiry |
| BE resource/idempotency/XLSX | ≥90% | ≥85% | HTTP code/header/blob/error |
| Tổng code thuộc FE21 | ≥90% | ≥85% | Không dùng test getter/setter để nâng số |

Đây là gate đề xuất. Chỉ báo cáo đạt khi đính kèm JaCoCo và Vitest coverage từ đúng commit.

### 9.2 Danh mục nhánh bắt buộc

| ID | Nhánh |
|---|---|
| BR21-SEC-01 | PM ACTIVE / PM revoked / role khác / anonymous |
| BR21-VAL-01 | INCOME / EXPENSE / enum sai |
| BR21-VAL-02 | category hợp / không hợp / thiếu |
| BR21-VAL-03 | amount null / ≤0 / nguyên / thập phân |
| BR21-VAL-04 | ngày thiếu / quá khứ / hôm nay / tương lai |
| BR21-VAL-05 | GENERAL+null farm / GENERAL+farm / FARM+farm / FARM+null |
| BR21-SRC-01 | MANUAL / BANK / evidence thiếu / evidence không tồn tại |
| BR21-SRC-02 | VERIFIED/không VERIFIED; IN/OUT; quoteRef trống/có |
| BR21-SRC-03 | chưa claim / cùng record / record khác / race claim |
| BR21-STATE-01 | action hợp lệ và từng action sai state |
| BR21-LOCK-01 | version đúng / cũ / null / race hai PM |
| BR21-IDEM-01 | key mới / replay cùng body / cùng key khác body |
| BR21-RPT-01 | BOTH / RECEIPTS_ONLY / MANUAL_ONLY / enum sai |
| BR21-RPT-02 | all farms / một farm / farm không tồn tại |
| BR21-RPT-03 | DRAFT/POSTED/VOID/DISCARDED; payment PAID/PENDING; evidence ACCEPTED/HOLD |
| BR21-RPT-04 | rỗng / chỉ thu / chỉ chi / thu và chi / ròng âm |
| BR21-DATE-01 | from=to / from>to / đúng 24 tháng / vượt 24 tháng / sát nửa đêm |
| BR21-SNAP-01 | snapshot còn hạn / hết hạn / không tồn tại / JSON hỏng |
| BR21-XLSX-01 | có dòng / rỗng / Unicode / ký tự XML / lỗi ghi file |
| BR21-UI-01 | loading / success / empty / validation / 401 / 403 / 409 / 410 / 5xx |

### 9.3 Lệnh đo coverage dự kiến

Frontend hiện chưa khai báo provider coverage trong `package.json`; cần chốt dependency/config trước khi lấy số chính thức. Không tự cài dependency trong đợt phân tích này.

Backend dùng JaCoCo trong Maven. Khi baseline database đã xanh, chạy test FE21 và lấy report HTML/XML từ `backend/target/site/jacoco*`. Ghi chính xác JDK, profile, DB và commit. Không gộp coverage của entity-generated test để che thiếu nhánh workflow.

## 10. Test tự động cần có

### 10.1 Frontend unit/component

- `financeRules`: mọi boundary ở BR21-VAL, BR21-DATE và tính tổng theo source/scope/state.
- `financeBackendApi`: mapping enum, decimal, page, farm filter, evidence ID, error code, blob XLSX và scope tổng nền tảng.
- SCR-70: loading, filter, empty, detail chỉ đọc, trace source, lỗi API.
- SCR-71: filter kết hợp, tab/count, phân trang, mã danh mục tiếng Việt, trạng thái DISCARDED.
- SCR-72: create/edit/post/discard/void/replacement; form validation; stale version; bank source; loading/error/busy.
- SCR-73: no snapshot, run/refresh, filter, detail, expired, empty, export success/fail.
- Tách rõ test local fixture và backend adapter. Page test không được phụ thuộc `.env` ngoài ý muốn.

### 10.2 Backend unit/service integration

- Validation table-driven cho toàn bộ field và boundary.
- State transition, history, audit, rollback trong một transaction.
- Claim/release bank source và unique constraint trên PostgreSQL.
- Idempotency cho từng command.
- Optimistic lock bằng hai transaction độc lập; đúng một request thành công.
- Snapshot totals, source/farm/date filters, immutability và expiry.
- Receipt derived view: một receipt cho mỗi PAID payment; bank time là cash date.
- Audit action đúng catalogue; không tạo audit/history khi transaction lỗi.

### 10.3 HTTP/API integration

- Security chain thật với session/CSRF và từng role.
- Header `Idempotency-Key` thiếu/rỗng/trùng.
- Response status, body, message code, params và content type.
- Create trả 201; update/action trả contract thống nhất.
- `/reports/latest` có trong OpenAPI và hành vi no snapshot/expired được chốt.
- XLSX trả đúng MIME, filename, bytes mở được.

### 10.4 Database round-trip

Sau mỗi command, đối chiếu tối thiểu:

| Nghiệp vụ | Bảng/readback |
|---|---|
| Tạo/sửa nháp | `manual_finance_record`, `manual_finance_history`, version |
| Bank source | `manual_finance_bank_claim`, `bank_transfer_evidence` |
| Post/void/discard | record state/timestamps/actor, history, `audit_log`, claim |
| Replacement | record mới và liên kết khoản gốc |
| Run report | `cash_report_snapshot.criteria_json`, `summary_json`, `details_json`, `expires_at` |
| Receipt | payment/evidence/subscription/purchased period readback |

Kiểm rollback bằng cách gây lỗi sau khi bắt đầu command: không được còn record, claim, history hoặc audit mồ côi.

## 11. Kiểm thử XLSX

Không chỉ kiểm `Blob` khác rỗng. Với mỗi file:

1. Mở bằng thư viện đọc XLSX hoặc Excel/LibreOffice.
2. Xác nhận có đúng hai sheet `Summary` và `Details`.
3. Đối chiếu snapshot ID, kỳ, source filter, farm filter, timezone, thời điểm tạo.
4. Đối chiếu tổng receipt, thu khác, chi, ròng và từng dòng với JSON snapshot.
5. Kiểm báo cáo rỗng vẫn có header và tổng 0.
6. Kiểm tiếng Việt, ký tự `& < > "`, mô tả dài và số VND không bị đổi thành scientific notation.
7. Hủy record sau khi tạo S1 rồi xuất lại S1: file phải giữ dữ liệu S1.
8. Snapshot hết hạn phải trả MSG-FE21-12/410, không sinh file mới.

## 12. Kịch bản kiểm thử trực tiếp trên giao diện

### 12.1 Thiết lập chung

- Backend, frontend và PostgreSQL chạy từ cùng commit; frontend ở backend data mode.
- Một PM ACTIVE, một PM thứ hai, Owner, CS, SA và một PM đã thu hồi.
- Dữ liệu riêng có mã dễ truy vết; không dùng dữ liệu cá nhân thật.
- Viewport: `1440×900` và `1180×820`; ghi browser/version.
- Mở DevTools Network + Console; lưu request/response đã loại cookie/token.
- Với thao tác ghi, chuẩn bị câu lệnh readback chỉ đọc hoặc API GET tương ứng.

### 12.2 SCR-70 — Biên nhận gói

| ID | Thao tác | Kết quả mong đợi | Bằng chứng |
|---|---|---|---|
| UI21-70-01 | Mở danh sách bằng PM | Tile, danh sách và thứ tự bank time đúng API | ảnh + GET + DB |
| UI21-70-02 | Tìm receipt/payment code; lọc farm/date | Query server-side, count/total đúng | network + UI |
| UI21-70-03 | Mở chi tiết | Đủ payment, price version, bank/confirm time, purchased period, evidence | UI + API |
| UI21-70-04 | Kiểm thao tác | Không có sửa/hủy; direct mutation route không tồn tại | UI + HTTP |
| UI21-70-05 | Date range sai/rỗng | Lỗi tiếng Việt, không gửi request sai | UI + network |
| UI21-70-06 | Owner/CS/SA mở direct URL/API | Không lộ danh sách, 403 | route + HTTP |

### 12.3 SCR-71/72 — Khoản thủ công

| ID | Thao tác | Kết quả mong đợi | Bằng chứng |
|---|---|---|---|
| UI21-71-01 | Lọc type/category/date/scope/tab | Kết quả/count/phân trang khớp API | UI + GET |
| UI21-72-01 | Thử lưu form thiếu/sai boundary | Lỗi đúng field, tiếng Việt, không ghi DB | UI + network + DB |
| UI21-72-02 | Tạo DRAFT MANUAL hợp lệ | Toast, code FR, history CREATE, audit, version | UI + POST + DB |
| UI21-72-03 | Sửa DRAFT | Chỉ field đổi, history EDIT, version tăng | UI + PUT + DB |
| UI21-72-04 | Bỏ DRAFT | Xác nhận; biến khỏi report; claim được giải phóng | UI + API + DB |
| UI21-72-05 | Post DRAFT | Form thành read-only; POSTED vào snapshot mới; audit đúng | UI + API + DB |
| UI21-72-06 | Void thiếu/có reason | Thiếu bị chặn; hợp lệ thành VOID và giải phóng claim | UI + API + DB |
| UI21-72-07 | Tạo nháp thay thế | DRAFT mới điền sẵn, liên kết khoản VOID | UI + API + DB |
| UI21-72-08 | Chọn bank evidence | Auto-fill amount/date; loại giao dịch gói, sai chiều, đã claim | UI + API + DB |
| UI21-72-09 | Hai PM post cùng version | Đúng một thành công, request kia MSG-COM-05 | 2 session + DB |
| UI21-72-10 | Replay request cùng key | Không thêm record/history/audit; trả cùng kết quả | network + DB |
| UI21-72-11 | Đổi nguồn bank A→B trên DRAFT | B được claim, A giải phóng, không lỗi unique | UI + DB |
| UI21-72-12 | Refresh/back/forward khi đang sửa | Không giả lưu dữ liệu; tải lại từ backend | UI + network |

### 12.4 SCR-73 — Báo cáo và xuất

| ID | Thao tác | Kết quả mong đợi | Bằng chứng |
|---|---|---|---|
| UI21-73-01 | Mở khi chưa có snapshot | Empty state rõ ràng, không số liệu demo | UI + GET latest |
| UI21-73-02 | Chạy fixture TC-21-14 | Thu 1.700.000; chi 300.000; ròng 1.400.000 | UI + POST + DB |
| UI21-73-03 | Lọc một farm | Không có GENERAL, tổng chỉ farm đó | UI + snapshot JSON |
| UI21-73-04 | Chọn từng source filter | Tổng và detail chỉ gồm nguồn chọn | UI + JSON |
| UI21-73-05 | Chạy lại | Snapshot ID mới; snapshot cũ không đổi | UI + DB |
| UI21-73-06 | Mở detail | Mọi dòng/tổng khớp snapshot; nhãn tiếng Việt | UI + JSON |
| UI21-73-07 | Xuất snapshot đang xem | File đúng S1, hai sheet, nội dung đối chiếu được | file + JSON |
| UI21-73-08 | Báo cáo rỗng | Tổng 0, chart/table không lỗi, XLSX hợp lệ | UI + file |
| UI21-73-09 | Snapshot expired | Banner MSG-FE21-12, yêu cầu chạy lại | UI + HTTP 410 |
| UI21-73-10 | Kỳ biên 24 tháng/25 tháng | FE và BE thống nhất chấp nhận/từ chối | UI + HTTP |
| UI21-73-11 | Kỳ sát 00:00 giờ Việt Nam | Receipt/manual thuộc đúng ngày | UI + DB timestamps |

### 12.5 UX, responsive và accessibility

- Không tràn ngang ở hai viewport chuẩn; table có cách đọc/scroll rõ ràng.
- Tất cả input có label; dialog có focus trap, Escape/close và trả focus đúng chỗ.
- Có thể thao tác bằng bàn phím; trạng thái focus nhìn thấy.
- Nút destructive có xác nhận; nút busy chống double-click.
- Loading, empty, validation, conflict, expired và server error phân biệt rõ.
- Mã kỹ thuật không thay nội dung tiếng Việt cho người dùng, trừ mã record/receipt cần thiết.
- Màu không là tín hiệu duy nhất cho thu/chi/trạng thái.

## 13. Rủi ro và sai lệch phát hiện qua phân tích tĩnh

Các mục dưới đây là finding cần được test chứng minh trước khi sửa; chưa tự động kết luận là lỗi production nếu chưa chạy round-trip thật.

| ID | Mức | Phát hiện / rủi ro | Test xác nhận |
|---|---|---|---|
| F21-01 | Blocker test | `master.xml` hiện thiếu một số migration đăng ký/thanh toán mới; H2 workflow dừng ở cột `google_last_used_at` | clean DB migration + backend workflow |
| F21-02 | Cao | Update DRAFT bank A→B claim B trước khi xóa claim A; unique `record_id` có thể làm đổi nguồn thất bại | UI21-72-11 + PostgreSQL |
| F21-03 | Cao | Audit dùng `FINANCE_RECORD_POST`/`VOID`, trong khi SRS catalogue nêu `POSTED`/`VOIDED` | TC-21-24 readback |
| F21-04 | Cao | Snapshot line không thể hiện source version dù BR-D30 yêu cầu source reference + version | TC-21-18/19 |
| F21-05 | Cao | Test concurrency hiện là chuỗi tuần tự, chưa phải hai transaction độc lập | TC-21-13 |
| F21-06 | Trung bình | FE coi scope tổng là `TOTAL`, backend trả `PLATFORM`; adapter cast che lệch type | UI21-73-02/06 |
| F21-07 | Trung bình | FE và BE có thể khác nhau ở boundary đúng 24 tháng khi khác ngày trong tháng | UI21-73-10 |
| F21-08 | Trung bình | OpenAPI chưa có `GET /reports/latest`; create response contract có thể lệch runtime 201 | contract diff + HTTP test |
| F21-09 | Trung bình | List/form có thể hiện raw category code thay vì tiếng Việt thống nhất | UI21-71-01/73-06 |
| F21-10 | Trung bình | `DISCARDED` bị map vào VOID ở UI/list, có thể làm sai nghĩa “bỏ nháp” và “hủy đã ghi sổ” | UI21-72-04/06 |
| F21-11 | Trung bình | Danh sách bank transaction có thể hiện transfer có `quoteRef` nhưng khi lưu lại bị từ chối | UI21-72-08 |
| F21-12 | Trung bình | Frontend page tests phụ thuộc data-source env; backend mode làm test demo fail | tách config và chạy hai mode |
| F21-13 | Trung bình | XLSX mới được test ở mức blob, chưa kiểm workbook/sheet/content | mục 11 |
| F21-14 | Thấp/hiệu năng | Báo cáo manual dùng `findAll()` rồi lọc trong memory | dataset lớn + query/performance |

## 14. Thứ tự chạy đề xuất

1. Chốt Q1 danh mục và xác nhận retention theo SRS JOB-08.
2. Làm xanh migration trên database sạch và baseline backend.
3. Unit/domain validation và adapter.
4. Service + PostgreSQL integration, gồm transaction/concurrency.
5. HTTP security/idempotency/contract.
6. XLSX content test.
7. UI manual ở `1440×900`, sau đó `1180×820`.
8. Chạy regression FE19 receipt/payment vì FE21 phụ thuộc nguồn này.
9. Sinh coverage từ đúng commit, rà từng nhánh bắt buộc thay vì chỉ nhìn phần trăm.

## 15. Tiêu chí vào và ra

### Tiêu chí vào

- Spec/Q1 cần thiết đã chốt; OpenAPI và DB migration đồng bộ.
- Backend/frontend/PostgreSQL cùng commit, backend data mode.
- Có fixture deterministic và tài khoản đủ role.
- Baseline unit/integration xanh hoặc blocker đã được ghi rõ.

### Tiêu chí ra

- 24 TC chuẩn và các nhánh mục 9 có bằng chứng Pass hoặc issue được chấp nhận.
- Không còn lỗi Critical/High; blocker migration/contract đã đóng.
- Coverage đạt gate đã thống nhất và report gắn với commit.
- Round-trip thật chứng minh record, claim, history, audit và snapshot trong DB.
- Concurrency/idempotency chạy bằng request/transaction độc lập.
- XLSX mở được, đúng snapshot và đúng hai sheet.
- UI qua hai viewport, không có console error nghiêm trọng, lỗi hiển thị tiếng Việt.
- Không dùng local/mock data làm bằng chứng nghiệm thu.

## 16. Mẫu ghi bằng chứng

| Trường | Giá trị |
|---|---|
| Test ID |  |
| Commit / branch |  |
| Ngày, người chạy |  |
| Môi trường | Browser, viewport, JDK, profile, PostgreSQL version |
| Actor / precondition | Không ghi mật khẩu/token |
| Dữ liệu fixture | Mã record/payment/evidence không chứa PII |
| Bước |  |
| Expected |  |
| Actual |  |
| API evidence | Method, URL, status, message code, sanitized body |
| DB readback | Bảng/cột và giá trị liên quan |
| UI evidence | Screenshot/snapshot/console/network |
| Coverage | File report + line/branch của module liên quan |
| Kết quả | Pass / Fail / Blocked |
| Issue | ID + mức độ + cách tái hiện |

## 17. Kết luận baseline

Baseline phân tích ban đầu đã được dùng để sửa các sai lệch FE–BE–SRS. Kết quả xác minh thực thi mới nhất được ghi ở mục 18; mục này không còn là kết luận trạng thái hiện tại.

## 18. Bằng chứng thực thi ngày 13/11/2026

### 18.1 Kết quả tự động

| Phạm vi | Kết quả | Bằng chứng chính |
|---|---:|---|
| Frontend FE21 unit/component | 46/46 Pass | chạy rõ `VITE_BEEFCARE_DATA_SOURCE=local`; rules, API adapter, flash navigation, SCR-70/71/72/73 |
| Frontend typecheck | Pass | `npm run typecheck` |
| Frontend production build | Pass | `npm run build`; chỉ có cảnh báo kích thước bundle |
| Backend FE21 gộp | 17/17 Pass | 13 workflow + 2 HTTP/resource + 1 XLSX + 1 OpenAPI |
| PostgreSQL 16.15 round-trip | 2/2 Pass | Testcontainers; HTTP → service → database → response/readback |
| Kiểm tra diff | Pass | `git diff --check` không phát hiện whitespace error |

Round-trip PostgreSQL xác nhận create/replay idempotency, POSTED, chạy snapshot, tải XLSX, VOID, history và snapshot S1 bất biến. HTTP test cũng xác nhận thiếu idempotency key trả 400, CS trả 403 và anonymous trả 401.

### 18.2 Finding đã đóng bằng code và test

- F21-02: đổi bank source A→B thực hiện giải phóng claim cũ trước khi claim nguồn mới trong cùng transaction.
- F21-03: audit action thống nhất `FINANCE_RECORD_POSTED` và `FINANCE_RECORD_VOIDED`.
- F21-04: snapshot line và XLSX có `sourceVersion`.
- F21-06: scope tổng thống nhất `PLATFORM`.
- F21-07: boundary 24 tháng của frontend khớp phép `LocalDate.minusMonths` của backend.
- F21-09/F21-10: category và trạng thái `DISCARDED` hiển thị đúng nghĩa tiếng Việt.
- F21-11: nguồn chuyển khoản có `quoteRef` không còn xuất hiện để người dùng chọn cho thu/chi nền tảng.
- F21-13: workbook được mở và kiểm tra hai sheet `Summary`, `Details`, Unicode và phiên bản nguồn.

### 18.3 Bằng chứng Playwright runtime

Đã chạy manual Playwright CLI với frontend backend-mode, backend thật và PostgreSQL thật tại checkpoint `829aa78949b6` cộng working tree FE21 ngày 13/11/2026. Trình duyệt là Headless Chrome 157, ngôn ngữ `vi-VN`.

| Use case | Kết quả thực thi |
|---|---|
| UC-FE21-01 | Pass: danh sách và chi tiết biên nhận đọc từ API, không có thao tác sửa/xóa |
| UC-FE21-02 | Pass: tạo nháp `FR-0005`, POST trả 201 |
| UC-FE21-03 | Pass: danh sách, bộ lọc trạng thái, số lượng và mã trạng thái tiếng Việt |
| UC-FE21-04 | Pass: sửa nháp, PUT trả 200, số tiền/diễn giải tải lại đúng |
| UC-FE21-05 | Pass: nháp thay thế `FR-0006` được bỏ và chuyển sang `DISCARDED` |
| UC-FE21-06 | Pass: ghi sổ nháp; `FR-0007` xác nhận lại thông báo mới và trạng thái chỉ đọc |
| UC-FE21-07 | Pass: hủy khoản đã ghi sổ có lý do, xem được lịch sử và tạo nháp thay thế |
| UC-FE21-08 | Pass: tạo snapshot `SNAP-15351`, tổng thu 2.400.000, tổng chi 777.777, ròng 1.622.223 |
| UC-FE21-09 | Pass sau sửa: tải `beefcare-cash-report-15351.xlsx`; file ZIP hợp lệ và có hai worksheet |

Playwright đã phát hiện và khóa hồi quy hai lỗi frontend:

1. XLSX từng trả 406 vì transport gửi `Accept: application/json`; adapter nay gửi MIME XLSX và có unit test kiểm header.
2. Thông báo “đã lưu nháp” từng còn lại sau khi ghi sổ/hủy trên cùng component; `useFlash` nay đồng bộ flash mới từ navigation và có test hồi quy.

Các route SCR-70, SCR-71, SCR-72 và SCR-73 đã được kiểm ở `1440×900` và `1180×820`; `scrollWidth === clientWidth`, không có tràn ngang. Console có 0 error; còn 2 cảnh báo future flag của React Router. Screenshot, file tải và runtime evidence nằm tại `/tmp/beefcare-ui-evidence/fe21-20261113-829aa78/`; đây là bằng chứng tạm thời, không phải baseline visual tự động.

### 18.4 Phần chưa được tuyên bố là bằng chứng nghiệm thu

- Chưa đo phần trăm line/branch coverage vì lượt chạy JDK 25 phải bỏ JaCoCo để tránh xung đột agent; không suy diễn coverage từ số test.
- Playwright dùng phiên đăng nhập email/password local thật; chưa lặp lại cùng bộ test qua Google OAuth bên ngoài.
- Chưa có test đồng thời bằng hai request/session độc lập cho TC-21-13; hiện đã có optimistic locking, unique claim và kiểm tra stale version tuần tự.
- Lệnh frontend tổng `npm test` hiện có 137/138 API test Pass và một lỗi baseline ngoài FE21 tại `tests/api/migrationBoundary.test.ts`; không dùng kết quả focused FE21 để tuyên bố toàn bộ frontend regression xanh.

Vì vậy phần triển khai và các contract FE21 đã hoàn tất theo các finding nêu trên, nhưng nghiệm thu cuối chỉ nên ký sau khi bổ sung ba bằng chứng còn lại nếu dự án bắt buộc toàn bộ tiêu chí ra ở mục 15.
