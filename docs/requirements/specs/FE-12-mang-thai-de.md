# SPEC FE-12 – Khám thai, mang thai và đẻ

| | |
|---|---|
| Feature | FE-12 Pregnancy and Calving Recording |
| Use case | UC-FE12-01 → UC-FE12-06 |
| Người phụ trách | TuanPQ (BE + FE + test) · Review BE: AnNT · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Pregnancy Check, Pregnancy Episode, Pregnancy Update, Calving Event, Calf Outcome), §3.3 (BR-D08, 10, 15, 18, 19), §3.4.5 (Table 3.4-5), Part II §12, Part III §12 (SCR-40, 4 popup), MSG-FE12, GBR-08, 25, 31, 49 → 54, 56 → 59; REM-03, 04, 05, 07, 08, 09 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 05.
> SCR-38, SCR-39 (danh sách sinh sản, tab Sinh sản) mô tả ở spec FE-11. Trạng thái sinh sản và điều kiện phối: xem FE-11 §3.3, §3.4.
> **Bê sinh tại trại:** cha, mẹ, ngày sinh lấy từ lần đẻ (GBR-31); phiếu nhập bê ở FE-06 chỉ đọc các trường này.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE12-01 | Xem khám thai, thai hiện tại, ngày đẻ dự kiến, diễn biến thai, lịch sử đẻ | Owner, Manager, Technician | SCR-39 |
| UC-FE12-02 | Ghi kết quả khám thai | Manager | Popup Ghi khám thai |
| UC-FE12-03 | Ghi diễn biến thai (quan sát, biến chứng, sẩy thai) | Manager | Popup Ghi diễn biến thai |
| UC-FE12-04 | Ghi sự kiện đẻ và kết quả từng bê | Manager | SCR-40 |
| UC-FE12-05 | Sửa / hủy kết quả khám thai | Manager | Popup Sửa / Hủy khám thai |
| UC-FE12-06 | Sửa / hủy diễn biến thai, lần đẻ, kết quả bê | Manager | Popup Sửa / Hủy bản ghi thai và đẻ |

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem | Có | Có | Có |
| Ghi, sửa, hủy | — | **Chỉ Manager** | — (có thể là người khám / đỡ đẻ) |
| Xác nhận bê nháp (phiếu FARM_BORN), đánh dấu bê chết trước khi đăng ký | Có | Có | — (ở FE-06) |

---

## 3. Dữ liệu

### 3.1 Khám thai (Pregnancy Check)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Bò cái | Tham chiếu | Có | ACTIVE, đã đăng ký | UC-02 PRE-2 |
| Lần phối liên kết | Tham chiếu | Không | Phối VALID từ lần đẻ cuối; đề xuất lần mới nhất; "Không có" | Popup, GBR-50 |
| Thời điểm khám | Ngày giờ | Có | Không tương lai; không trước lần phối liên kết | Popup |
| Nguồn dữ liệu | Enum | — | Quan sát trực tiếp (mặc định) / Sổ trại / Báo cáo bên ngoài | Popup |
| Kết quả | Enum | Có | `PREGNANT` Có thai / `NOT_PREGNANT` Không có thai / `INCONCLUSIVE` Chưa rõ | Popup |
| Phương pháp | Enum | Không | Siêu âm / Khám qua trực tràng / Khác | Popup |
| Số tháng mang thai ước tính | Số nguyên | Không | 1–9; chỉ khi Có thai | Popup |
| Người khám | Thành viên hoặc chữ tự do | Không | ≤ 100 | Popup |
| Ghi chú | Chuỗi dài | Không | ≤ 500 | Popup |
| Trạng thái | Enum | — | `VALID` → `VOIDED`; sửa giữ VALID + "Đã sửa" | §3.2 |

### 3.2 Giai đoạn mang thai (Pregnancy Episode)

| Thuộc tính | Ràng buộc |
|---|---|
| Bò cái, số thai (thứ tự lứa), lần khám xác nhận, lần phối liên kết | Tối đa **1 thai OPEN** mỗi bò cái (BR-D18) |
| Ngày đẻ dự kiến + cơ sở | `CONFIRMED` (theo phối liên kết) / `ESTIMATED` (theo số tháng ước tính) / không có |
| Trạng thái | `OPEN` → `CALVED` / `LOST` / `DAM_EXITED`; `VOIDED` khi lần khám xác nhận bị hủy mà không có phụ thuộc. Thai đã đóng **không bao giờ mở lại** bằng cập nhật thông thường |
| Thời điểm đóng, lý do đóng | — |

### 3.3 Diễn biến thai (Pregnancy Update)

| Thuộc tính | Ràng buộc |
|---|---|
| Thai | OPEN |
| Loại | `OBSERVATION` Quan sát / `COMPLICATION` Biến chứng / `LOSS` Sẩy thai |
| Thời điểm xảy ra | Không tương lai; không trước lần khám xác nhận |
| Nguồn dữ liệu, chi tiết (≤ 1.000, bắt buộc) | — |
| Ca sức khỏe liên kết | Chỉ khi Biến chứng; ca của cùng bò cái |
| Trạng thái | `VALID` → `VOIDED`; sửa giữ VALID + "Đã sửa" |

### 3.4 Lần đẻ (Calving Event)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Bò mẹ | Tham chiếu | Có | ACTIVE, đã đăng ký | UC-04 |
| Thai liên kết | Tham chiếu | Không | Thai OPEN (mặc định) hoặc "Không có thai được theo dõi" | GBR-57 |
| Thời điểm đẻ | Ngày giờ | Có | Không tương lai | SCR-40 |
| Nguồn dữ liệu | Enum | — | Như §3.1 | UC-04 |
| Người đỡ đẻ | Thành viên hoặc chữ | Không | ≤ 100 | SCR-40 |
| Diễn biến đẻ | Enum | Không | `NORMAL` Bình thường / `ASSISTED` Có hỗ trợ / `CAESAREAN` Mổ | SCR-40 |
| Tình trạng bò mẹ sau đẻ | Enum | Không | `GOOD` Tốt / `NEEDS_MONITORING` Cần theo dõi / `CRITICAL` Nguy kịch | SCR-40 |
| Sót nhau | Boolean | Không | Nhau không ra trong 12 giờ; gợi ý mở ca sức khỏe | SCR-40 |
| Số bê | Suy ra | — | Từ kết quả bê | §3.2 |
| Trạng thái | Enum | — | `VALID` → `VOIDED`; sửa giữ VALID | §3.2 |

Lần đẻ thứ hai của cùng bò mẹ trong vòng 30 ngày → bị gắn cờ (MSG-FE12-12).

### 3.5 Kết quả bê (Calf Outcome)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Số bê | 1, 2, … | Hệ thống | Duy nhất trong lần đẻ; 1–4 bê | SCR-40, BR-D19 |
| Kết quả | Enum | Có | `LIVE` Sống / `STILLBORN` Chết khi sinh | SCR-40 |
| Giới tính | Enum | Không | Đực / Cái; "Không rõ" **chỉ** cho bê chết khi sinh | SCR-40 |
| Cân sơ sinh | Số (1 thập phân) | Không | 1–80 kg; có cân thì bắt buộc cơ sở Đo / Ước tính | SCR-40, GBR-57 |
| Mã thẻ / QR | Chuỗi | Không (bê sống) | Duy nhất trong trại (kể cả thẻ của bò khác) | BR-D08 |
| Chuồng ban đầu | Chuồng | Có (bê sống) | ACTIVE; mặc định chuồng của bò mẹ | SCR-40 |
| Giống | Danh mục | Không (bê sống) | Mặc định giống bò mẹ | SCR-40 |
| Lựa chọn đăng ký | Enum | Có (bê sống) | Lưu bê nháp (mặc định) / Đăng ký ngay | GBR-58 |
| Mục đích | Danh mục | Có khi Đăng ký ngay | ACTIVE; mặc định mục đích ACTIVE đầu tiên loại UNDECIDED; SIRE chỉ đực, BREEDING chỉ cái | SCR-40 |
| Trạng thái đăng ký | Enum | — | Sống: `PENDING_CONFIRMATION` → `REGISTERED`, hoặc `DIED_BEFORE_REGISTRATION`; Đăng ký ngay → REGISTERED luôn. Chết khi sinh không bao giờ đăng ký | §3.2 |
| Bò đã đăng ký | Tham chiếu | — | Tối đa 1 (BR-D10) | §3.2 |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-12-01 | Chỉ khám **CÓ THAI** hợp lệ mới mở (hoặc xác nhận) thai; phối giống không xác lập mang thai. Lần khám đầu không cần thai có sẵn. | GBR-50, GBR-51 |
| R-12-02 | Kết quả khám: CÓ THAI → thai OPEN (hoặc xác nhận thai OPEN đang có), ngày đẻ dự kiến, REM-05. KHÔNG CÓ THAI → bò cái về Chờ phối, hủy ngày tạm tính. CHƯA RÕ → giữ trạng thái, tạo REM-04 (khám + 14 ngày). Mọi kết quả giải quyết REM-03. | GBR-51, UC-02 POST-2 |
| R-12-03 | Ngày đẻ dự kiến: có phối liên kết → **CONFIRMED** = thời điểm phối + thời gian mang thai; không có phối nhưng có số tháng → **ESTIMATED** = ngày khám + thời gian mang thai − số tháng × 30; không có cả hai (hoặc thiếu tham số) → không có ngày (MSG-FE12-11). Lần khám sau có phối liên kết thay ngày ESTIMATED. | GBR-53 |
| R-12-04 | Tối đa 1 thai OPEN mỗi bò cái; thay đổi cạnh tranh cho cùng bò cái được xử lý tuần tự; bằng chứng cũ không ghi đè thai mới độc lập → MSG-FE12-02 / MSG-FE12-12. | GBR-52, BR-D18 |
| R-12-05 | Diễn biến thai chỉ ghi vào thai OPEN (đã đóng → MSG-FE12-12); thời điểm không trước lần khám xác nhận. SẨY THAI: đóng thai LOST, hủy REM-05, bò cái về Chờ phối (hoặc trạng thái của sự kiện sau), tính vào chỉ số sẩy thai; **không** tạo bê. | GBR-56 |
| R-12-06 | Biến chứng có thể liên kết ca sức khỏe **đã có** của cùng bò; mở / điều trị ca dùng FE-10. | GBR-56 |
| R-12-07 | Lần đẻ: lưu trong **một transaction** bò mẹ, thời điểm, nguồn dữ liệu, diễn biến, tình trạng mẹ, kết quả từng bê; đóng thai CALVED; bò mẹ Sau sinh; đăng ký ngay các bê "Đăng ký ngay" theo logic FE-06 (phiếu FARM_BORN); lưu bê nháp PENDING_CONFIRMATION + REM-09 cho Owner, Manager. Lỗi → không lưu gì. | GBR-57, GBR-58, UC-04 bước 7 |
| R-12-08 | Lần đẻ phải có ít nhất 1 kết quả bê → MSG-FE12-06; số bê duy nhất trong lần đẻ; 1–4 bê. | BR-D19, SCR-40 |
| R-12-09 | Có cân sơ sinh thì phải 1–80 kg và có cơ sở → MSG-FE12-07; giới tính / cân không biết để trống. | GBR-57 |
| R-12-10 | Mã thẻ bê sống duy nhất trong trại → MSG-FE12-08. Bê đăng ký ngay: chuồng ACTIVE, đủ chỗ (MSG-FE04-05). | BR-D08, UC-04 E4 |
| R-12-11 | Đẻ không có thai được theo dõi: lưu không liên kết thai; **không** tự tạo sự kiện trước đó. | GBR-57 |
| R-12-12 | Bê đăng ký: giai đoạn UNWEANED_CALF; ngày sinh = thời điểm đẻ; mẹ = bò mẹ; bố = đực giống của lần phối liên kết thai (không có → "Không rõ"); chuồng đề xuất = chuồng chọn lúc đẻ. Bò mẹ chưa ADULT → gợi ý REM-08 chuyển sang ADULT. | GBR-31, UC-04 POST-4 |
| R-12-13 | Bê nháp: không nhận sự kiện nào khác cho đến khi đăng ký; bê chết trước khi đăng ký → DIED_BEFORE_REGISTRATION, **không** đổi LIVE thành STILLBORN. | GBR-58 |
| R-12-14 | Sau đẻ: giải quyết REM-05, tạo REM-07 (đẻ + 45 ngày) nếu có tham số. | UC-04 POST-3 |
| R-12-15 | Sửa / hủy: chỉ Manager, bắt buộc lý do, kèm version, giữ giá trị gốc. Không làm mồ côi / mâu thuẫn bản ghi sau (MSG-FE11-07): khám đã mở thai có diễn biến / lần đẻ / bê đăng ký thì không đổi thành KHÔNG CÓ THAI hay hủy; kết quả bê sống đã đăng ký không hủy và không đổi thành chết khi sinh; không hủy lần đẻ có bê đã đăng ký; hủy SẨY THAI chỉ mở lại thai khi không có thai mới hơn. | GBR-59 |
| R-12-16 | Sửa khám làm mất kết quả CÓ THAI duy nhất của một thai chưa có bản ghi sau → thai VOIDED cùng lúc. Hủy lần đẻ mà mọi bê sống đều là nháp → các bê nháp bị hủy cùng, REM-09 hủy. | UC-05 AF2, UC-06 AF1 |
| R-12-17 | Sau mọi thay đổi: tính lại thai, ngày dự kiến, trạng thái sinh sản, bê nháp, nhắc việc. | UC-05, UC-06 |

---

## 5. Luồng xử lý

### UC-FE12-02 Ghi khám thai
Popup → phối liên kết (đề xuất), thời điểm, nguồn dữ liệu, kết quả, phương pháp, số tháng (Có thai), người khám, ghi chú → hiện ngày đẻ dự kiến (Có thai) → **Lưu kết quả khám** → kiểm, tuần tự hóa theo bò cái → R-12-02, R-12-03 → MSG-FE12-01.
AF1 không có phối → R-12-03 · AF2 đã có thai OPEN → xác nhận thai đó.
E2 xung đột → MSG-FE12-02 · E3 thời gian → MSG-COM-07 / MSG-FE11-10 · E4 bò EXITED → MSG-COM-13.

### UC-FE12-03 Ghi diễn biến thai
Popup (thai: số thai, trạng thái, ngày dự kiến) → loại, thời điểm, chi tiết, ca liên kết (Biến chứng) → **Lưu diễn biến** → MSG-FE12-03; Sẩy thai → R-12-05 → MSG-FE12-04.
E2 thai không còn OPEN → MSG-FE12-12.

### UC-FE12-04 Ghi đẻ
1. SCR-40: bò mẹ, thai liên kết (mặc định thai OPEN).
2. Thời điểm đẻ, người đỡ đẻ, diễn biến, tình trạng mẹ, sót nhau; 1 khối bê mặc định, "+ Thêm bê".
3. Mỗi bê: kết quả, giới tính, cân + cơ sở.
4. Mỗi bê sống: mã thẻ, chuồng, giống, lựa chọn đăng ký; Đăng ký ngay → mục đích.
5. **Lưu sự kiện đẻ** → kiểm R-12-08 → R-12-10, tuần tự hóa → R-12-07 → JOB-01 → MSG-FE12-05 (+ MSG-FE12-09 và / hoặc MSG-FE12-10).
AF1 không có thai theo dõi (R-12-11) · AF2 bê chết khi sinh → không hỏi thẻ, chuồng, đăng ký · AF4 thêm / bớt khối bê.

### UC-FE12-05 / 06 Sửa / hủy
Popup → chọn loại bản ghi (với UC-06), bản ghi, hành động → sửa các trường cho phép → lý do → **Lưu** → R-12-15 → R-12-17 → MSG-FE11-06.

---

## 6. Màn hình và trường

### Popup Ghi khám thai

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Female / Bò cái | Chỉ đọc | — | — | — | — |
| 2 | Linked breeding / Lần phối liên kết | Dropdown | — | Phối VALID từ lần đẻ cuối; "Không có" | Phối mới nhất | — |
| 3 | Checked at / Thời điểm khám | Ngày giờ | * | Không tương lai, không trước phối liên kết | — | MSG-COM-06, MSG-COM-07, MSG-FE11-10 |
| 4 | Data source / Nguồn dữ liệu | Radio (thu gọn) | — | Quan sát trực tiếp / Sổ trại / Báo cáo bên ngoài | Quan sát trực tiếp | — |
| 5 | Result / Kết quả | Radio | * | Có thai / Không có thai / Chưa rõ | — | MSG-COM-06 |
| 6 | Method / Phương pháp | Radio | — | Siêu âm / Khám trực tràng / Khác | — | — |
| 7 | Estimated months pregnant / Số tháng mang thai ước tính | Số nguyên | — | 1–9; chỉ khi Có thai | — | MSG-COM-10 |
| 8 | Examiner / Người khám | Chữ hoặc thành viên | — | ≤ 100 | — | MSG-COM-10 |
| 9 | Expected calving date / Ngày đẻ dự kiến | Chỉ đọc | — | Khi Có thai: CONFIRMED hoặc ESTIMATED | — | MSG-FE12-11 |
| 10 | Note / Ghi chú | Ô chữ dài | — | ≤ 500 | — | MSG-COM-10 |
| 11 | Cancel / Save check result | Nút | — | — | — | MSG-FE12-02, MSG-COM-13, MSG-COM-02; thành công MSG-FE12-01 |

### Popup Ghi diễn biến thai

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Pregnancy / Thai | Chỉ đọc | — | Bò cái, số thai, trạng thái, ngày đẻ dự kiến | — |
| 2 | Update type / Loại | Radio | * | Quan sát / Biến chứng / Sẩy thai | MSG-COM-06 |
| 3 | Occurred at / Thời điểm | Ngày giờ | * | Không tương lai, không trước lần khám xác nhận | MSG-COM-06, MSG-COM-07 |
| 4 | Details / Chi tiết | Ô chữ dài | * | ≤ 1.000 | MSG-COM-06, MSG-COM-10 |
| 5 | Linked health case / Ca sức khỏe liên kết | Dropdown | — | Ca của bò cái; chỉ khi Biến chứng | — |
| 6 | Cancel / Save update | Nút | — | — | MSG-FE12-12, MSG-COM-02; thành công MSG-FE12-03 / MSG-FE12-04 |

### SCR-40 Ghi sự kiện đẻ

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Back to profile / Về hồ sơ | Link | — | SCR-39 | — | — |
| **Thông tin lần đẻ** | | | | | | |
| 2 | Dam / Bò mẹ | Chỉ đọc | — | Mã, số tai, giống, chuồng | — | — |
| 3 | Linked pregnancy / Thai liên kết | Dropdown | — | Thai OPEN / "Không có thai được theo dõi" | Thai OPEN | — |
| 4 | Birth time / Thời điểm đẻ | Ngày giờ | * | Không tương lai | — | MSG-COM-06, MSG-COM-07 |
| 5 | Birth attendant / Người đỡ đẻ | Dropdown hoặc chữ | — | ≤ 100 | — | MSG-COM-10 |
| 6 | Calving course / Diễn biến đẻ | Radio | — | Bình thường / Có hỗ trợ / Mổ | — | — |
| 7 | Dam condition after calving / Tình trạng mẹ | Radio | — | Tốt / Cần theo dõi / Nguy kịch | — | — |
| 8 | Retained placenta / Sót nhau | Checkbox | — | Gợi ý mở ca sức khỏe | Tắt | — |
| **Kết quả bê (mỗi bê một khối)** | | | | | | |
| 9 | Calf number / Số bê | Chỉ đọc | — | 1, 2, …; "+ Thêm bê" / "Bỏ bê" (1–4) | 1 khối | MSG-FE12-06 |
| 10 | Outcome / Kết quả | Radio | * | Sống / Chết khi sinh | — | MSG-COM-06 |
| 11 | Sex / Giới tính | Radio | — | Đực / Cái; "Không rõ" chỉ khi chết khi sinh | — | — |
| 12 | Birth weight / Cân sơ sinh | Số (1 thập phân) + cơ sở | — | 1–80 kg; cơ sở Đo / Ước tính bắt buộc khi có cân | — | MSG-FE12-07 |
| 13 | Tag / QR code / Mã thẻ | Ô chữ | — | Bê sống; duy nhất trong trại | — | MSG-FE12-08 |
| 14 | Initial pen / Chuồng ban đầu | Dropdown | * (bê sống) | Chuồng ACTIVE | Chuồng của bò mẹ | MSG-FE04-05 (Đăng ký ngay) |
| 15 | Breed / Giống | Dropdown | — | Bê sống | Giống bò mẹ | — |
| 16 | Registration / Đăng ký | Radio | * (bê sống) | Lưu bê nháp / Đăng ký ngay | Lưu bê nháp | — |
| 17 | Production purpose / Mục đích | Dropdown | * (Đăng ký ngay) | ACTIVE; SIRE chỉ đực, BREEDING chỉ cái; giai đoạn bê = Bê chưa cai sữa | Mục đích ACTIVE đầu tiên loại UNDECIDED | MSG-FE05-12 |
| 18 | Cancel / Save calving | Nút | — | — | — | MSG-FE12-12, MSG-COM-13, MSG-COM-02; thành công MSG-FE12-05 (+ 09 / 10) |

### Popup Sửa / Hủy khám thai

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Record / Bản ghi | Chỉ đọc | — | Bò cái, thời điểm, kết quả, người ghi | — |
| 2 | Action / Hành động | Radio | * | Sửa / Hủy | — |
| 3 | Field / Current / New | Bảng | — | Kết quả, thời điểm khám, phương pháp, người khám, nguồn dữ liệu | Như popup ghi |
| 4 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 5 | Cancel / Save | Nút | — | — | MSG-FE11-07, MSG-COM-05, MSG-COM-02; thành công MSG-FE11-06 |

### Popup Sửa / Hủy bản ghi thai và đẻ

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Record type / Loại bản ghi | Radio | * | Diễn biến thai / Lần đẻ / Kết quả bê | — |
| 2 | Record / Bản ghi | Dropdown | * | Các bản ghi loại đó của bò cái | — |
| 3 | Action / Hành động | Radio | * | Sửa / Hủy | MSG-FE11-07 |
| 4 | Field / Current / New | Bảng | — | Diễn biến: loại, thời điểm, chi tiết, ca liên kết. Lần đẻ: thời điểm, nguồn dữ liệu, người đỡ, diễn biến, tình trạng mẹ. Kết quả bê: giới tính, cân + cơ sở, mã thẻ của bê nháp | MSG-FE12-07, MSG-FE12-08 |
| 5 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 6 | Cancel / Save | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE11-06 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Dữ liệu tab Sinh sản | — | Xem FE-11 A2 (`currentPregnancy`, `calvings[{calvingId, at, calves[{calfNo, outcome, sex, weight, registration, cattleCode?}]}]`) | — | `GET …/cattle/{cattleId}/reproduction-history` |
| A2 | Ghi khám thai | `linkedBreedingId?, checkedAt, dataSource, result, method?, estimatedMonths?, examinerId? \| examinerName?, note?` + `Idempotency-Key` | `{checkId, result, episode? {episodeId, expectedDate, basis}, reproStatus}` | FE12-02, FE11-10, FE12-11 (thông tin), COM-06, COM-07, COM-13, COM-02 | `POST /api/farms/{farmId}/cattle/{cattleId}/pregnancy-checks` |
| A3 | Ghi diễn biến thai | `type, occurredAt, dataSource, details, healthCaseId?` + `Idempotency-Key` | `{updateId, episodeStatus, reproStatus}` | FE12-12, COM-06, COM-07, COM-02 | `POST /api/farms/{farmId}/pregnancy-episodes/{episodeId}/updates` |
| A4 | Ghi đẻ | `damId, episodeId? \| noTrackedPregnancy, birthAt, dataSource, attendantId? \| attendantName?, course?, damCondition?, retainedPlacenta, calves[{outcome, sex?, birthWeightKg?, weightBasis?, tagCode?, penId?, breedId?, registration: DRAFT\|REGISTER_NOW, purposeId?}]` + `Idempotency-Key` | `{calvingId, calves[{calfNo, outcome, registration, cattleId?, cattleCode?, voucherCode?}], damStatus}` | FE12-06, FE12-07, FE12-08, FE04-05, FE05-12, FE12-12, COM-07, COM-13, COM-02 | `POST /api/farms/{farmId}/calvings` |
| A5 | Sửa / hủy khám thai | `changes?, reason, version` + `Idempotency-Key` | Kết quả + thai / trạng thái mới | FE11-07, COM-06, COM-05 | `POST …/reproduction-events/{eventId}/correction` · `/void` (dùng chung FE-11 – cần xác nhận áp dụng cho khám thai) |
| A6 | Sửa / hủy diễn biến thai | Như A5 | Như A5 | Như A5 | `POST …/pregnancy-updates/{updateId}/correction` · `/void` |
| A7 | Sửa / hủy lần đẻ | Như A5 | Như A5 | + FE11-07 khi có bê đã đăng ký | `POST …/calvings/{calvingId}/correction` · `/void` |
| A8 | Sửa / hủy kết quả bê | Như A5 | Như A5 | + FE12-08; chặn với bê đã đăng ký | `POST …/calf-outcomes/{calfId}/correction` · `/void` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE12-01 | Toast thành công | Đã ghi khám thai cho {cattle_code}: {result}. |
| MSG-FE12-02 | Hộp thoại | Lần khám này mâu thuẫn với lần khám hoặc thai đã có của {cattle_code}. Vui lòng xem lại. |
| MSG-FE12-03 | Toast thành công | Đã ghi diễn biến thai. |
| MSG-FE12-04 | Toast thành công | Đã ghi sẩy thai. Thai đã được đóng. |
| MSG-FE12-05 | Toast thành công | Đã ghi lần đẻ của {dam_code} với {count} kết quả bê. |
| MSG-FE12-06 | Trên form | Hãy thêm ít nhất một kết quả bê. |
| MSG-FE12-07 | Dưới trường | Cân sơ sinh phải từ 1 đến 80 kg và cần cơ sở đo hoặc ước tính. |
| MSG-FE12-08 | Dưới trường | Mã thẻ {code} đã được dùng trong trại. |
| MSG-FE12-09 | Sau khi lưu | Đã lưu {count} bê sống dạng nháp. Chủ trại hoặc Quản lý sẽ đăng ký bằng phiếu nhập bê sinh tại trại. |
| MSG-FE12-10 | Toast thành công | Đã đăng ký bê {code} vào đàn. |
| MSG-FE12-11 | Trong panel | Không có ngày đẻ dự kiến: không có lần phối liên kết, không có số tháng mang thai ước tính hoặc chưa cấu hình thời gian mang thai. |
| MSG-FE12-12 | Hộp thoại | Đã có lần đẻ hoặc thay đổi thai cho {dam_code}. Vui lòng tải lại và xem lại. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-12-01 | Phối 01/11/2026 | Khám CÓ THAI 29/11 liên kết phối | Thai OPEN; ngày đẻ CONFIRMED 11/08/2027; REM-05; REM-03 giải quyết | I | R-12-02, R-12-03 |
| TC-12-02 | Bò mua, không có phối | Khám CÓ THAI ngày 01/11, ước 4 tháng | ESTIMATED = 01/11 + 283 − 120 ngày | U, I | R-12-03 |
| TC-12-03 | Không có phối, không số tháng | Khám CÓ THAI | Thai OPEN không có ngày; MSG-FE12-11 | I | R-12-03 |
| TC-12-04 | Đã phối | Khám KHÔNG CÓ THAI | Chờ phối; ngày tạm tính hủy | I | R-12-02 |
| TC-12-05 | Đã phối | Khám CHƯA RÕ ngày 01/11 | Vẫn Đã phối; REM-04 ngày 15/11 | I | R-12-02 |
| TC-12-06 | Có thai OPEN | Khám CÓ THAI lần 2 | Xác nhận thai đó; không mở thai thứ hai | I | R-12-04 |
| TC-12-07 | Hai Manager cùng ghi khám CÓ THAI cho một bò | Gửi đồng thời | Một thai OPEN; một yêu cầu MSG-FE12-02 hoặc xác nhận thai đó | I | R-12-04 |
| TC-12-08 | Phối 01/11 | Khám lúc 31/10 | MSG-FE11-10 | I | Popup |
| TC-12-09 | Thai OPEN | Ghi Sẩy thai | Thai LOST; REM-05 hủy; Chờ phối; không có bê | I | R-12-05 |
| TC-12-10 | Thai đã CALVED | Ghi diễn biến | MSG-FE12-12 | I | R-12-05 |
| TC-12-11 | SCR-40 | Không có khối bê | MSG-FE12-06 | U, H | R-12-08 |
| TC-12-12 | Khối bê | Cân 0,5 / 80,1 / 25 không cơ sở | MSG-FE12-07 | U, H | R-12-09 |
| TC-12-13 | Bê sống | Giới tính "Không rõ" | Không cho chọn | U | SCR-40 |
| TC-12-14 | Mã thẻ đã dùng cho bò khác | Lưu | MSG-FE12-08 | I | R-12-10 |
| TC-12-15 | 2 bê sống: 1 nháp, 1 Đăng ký ngay | Lưu | 1 bê PENDING + REM-09; 1 bò mới (phiếu FARM_BORN POSTED, UNWEANED_CALF, mẹ = bò mẹ, bố = đực của phối liên kết); thai CALVED; mẹ Sau sinh; REM-05 giải quyết; REM-07 | I | R-12-07, R-12-12 |
| TC-12-16 | Đăng ký ngay vào chuồng đầy | Lưu | MSG-FE04-05; không lưu gì | I | R-12-10 |
| TC-12-17 | Không có thai theo dõi | Lưu đẻ | Không có thai liên kết; không có phối / khám nào được tạo | I | R-12-11 |
| TC-12-18 | Bò mẹ YOUNG_STOCK | Lưu đẻ | REM-08 gợi ý ADULT | I | R-12-12 |
| TC-12-19 | Lần đẻ 01/11 | Ghi lần đẻ thứ hai 15/11 | MSG-FE12-12 | I | §3.4 |
| TC-12-20 | Khám CÓ THAI đã có lần đẻ | Đổi sang KHÔNG CÓ THAI / hủy | MSG-FE11-07 | I | R-12-15 |
| TC-12-21 | Khám CÓ THAI duy nhất, chưa có bản ghi sau | Hủy | Thai VOIDED | I | R-12-16 |
| TC-12-22 | Lần đẻ có 1 bê đã đăng ký | Hủy lần đẻ | MSG-FE11-07 | I | R-12-15 |
| TC-12-23 | Lần đẻ có 2 bê nháp | Hủy lần đẻ | 2 bê nháp hủy; REM-09 hủy; thai trở lại theo quy tắc | I | R-12-16 |
| TC-12-24 | Bê sống đã đăng ký | Đổi sang chết khi sinh / hủy | MSG-FE11-07 | I | R-12-15 |
| TC-12-25 | Sẩy thai, sau đó đã có thai mới | Hủy bản ghi sẩy thai | Thai cũ không mở lại | I | R-12-15 |
| TC-12-26 | Owner / Technician | Gọi ghi khám / đẻ | 403 | H | §2 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | UC-02 POST-2 viết "returns to OPEN" sau KHÔNG CÓ THAI – mâu thuẫn tên trạng thái | Hiểu là Chờ phối (AWAITING_BREEDING) theo Table 3.4-3 |
| Q2 | UC-FE12-01 không có đặc tả Part II | Theo SCR-39 |
| Q3 | Bê "Đăng ký ngay" không có mã thẻ | Hệ thống cấp mã khi ghi sổ phiếu FARM_BORN (như SCR-25) |
| Q4 | Người khám chọn thành viên hay chữ tự do – cần cả hai? | Cả hai, như người thực hiện ở các popup khác |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho TuanPQ duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
