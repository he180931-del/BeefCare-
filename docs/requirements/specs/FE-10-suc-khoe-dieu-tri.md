# SPEC FE-10 – Ca sức khỏe và điều trị

| | |
|---|---|
| Feature | FE-10 Health Case and Treatment Management |
| Use case | UC-FE10-01 → UC-FE10-05 |
| Người phụ trách | TuanPQ (BE + FE + test) · Review BE: AnNT · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Health Case, Health Observation, Treatment), §3.3 (BR-D14, 15, 20, 33), §3.4.4 (Table 3.4-4), Part II §10, Part III §10 (SCR-36, SCR-37, 5 popup), MSG-FE10, GBR-08, 26, 34, 45 → 47, 95 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 05.
> **BeefCare không chẩn đoán, không kê đơn** (GBR-46): chẩn đoán nghi ngờ và cờ truyền nhiễm là đánh giá của người dùng.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE10-01 | Xem ca sức khỏe và lịch sử điều trị | Owner, Manager, Technician | SCR-36, SCR-37 |
| UC-FE10-02 | Mở ca sức khỏe (luôn mở ca mới – D54; phản ứng sau tiêm) | Owner, Manager | Popup Mở ca sức khỏe |
| UC-FE10-03 | Cập nhật ca bệnh: ghi theo dõi, chuyển OPEN ⇄ CHRONIC, đóng ca trong một lần lưu (D54) | Owner, Manager | Popup Cập nhật ca bệnh |
| UC-FE10-04 | Ghi điều trị | Owner, Manager | Popup Ghi điều trị |
| UC-FE10-05 | Sửa / hủy điều trị hoặc lần theo dõi | Owner, Manager | Popup Sửa / Hủy điều trị hoặc theo dõi |

**Liên quan:** đóng ca Chết / Mất tích tạo phiếu chết PENDING cho Owner (FE-13, REM-12); xác nhận xuất đàn đóng ca với kết quả CLOSED_BY_EXIT (FE-13); danh mục thuốc (FE-18); cách ly thịt hiển thị ở FE-05.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem ca, theo dõi, điều trị | Có | Có | Có |
| Mở ca, theo dõi, điều trị, đổi trạng thái, đóng ca, sửa / hủy | Có (D41) | Có | — (có thể được chọn là người quan sát / thực hiện) |

Cần trại ACTIVE. Bò EXITED / VOIDED / bê nháp không nhận bản ghi mới; bò trên phiếu chết PENDING không nhận bản ghi mới nhưng vẫn sửa / hủy được (GBR-26, BR-D20).

---

## 3. Dữ liệu

### 3.1 Ca sức khỏe (Health Case)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Mã ca | `HC-nnnn` | Hệ thống | Duy nhất trong trại | §3.2 |
| Bò | Tham chiếu | Có | Một bò có thể có nhiều ca | GBR-45 |
| Thời điểm mở | Ngày giờ | Có | = thời điểm quan sát mở ca | §3.2 |
| Dấu hiệu chính | Chuỗi | Có | Từ quan sát mở ca | §3.2 |
| Chẩn đoán nghi ngờ | Chuỗi | Không | ≤ 100; gợi ý từ các ca trước của trại; sửa được sau | Popup |
| Nghi truyền nhiễm – cách ly | Boolean | Không | Hiện huy hiệu trên hồ sơ và danh sách | Popup |
| Mức độ | Enum | Có | `MILD` / `MODERATE` / `SEVERE` (Nhẹ / Vừa / Nặng) | §3.2 |
| Trạng thái | Enum | — | `OPEN` ⇄ `CHRONIC` → `CLOSED` | GBR-45 |
| Mãn tính từ | Ngày | Khi CHRONIC | — | §3.2 |
| Kết quả | Enum | Khi CLOSED | `RECOVERED` / `DIED` / `MISSING` / `CLOSED_BY_EXIT` (đúng 1 kết quả khi CLOSED; OPEN / CHRONIC không có kết quả) | BR-D33 |
| Thời điểm đóng, người xác nhận | — | Khi CLOSED | Không trước bản ghi cuối của ca | BR-D33 |
| Mũi tiêm liên kết (phản ứng) | Tham chiếu | Không | — | GBR-47 |

### 3.2 Quan sát (Health Observation) – mở ca hoặc theo dõi

| Thuộc tính | Ràng buộc |
|---|---|
| Ca, thời điểm quan sát | Không tương lai; không trước ngày nhập đàn (mở ca); không trước bản ghi trước của ca (theo dõi) |
| Thân nhiệt (°C) | 35,0–43,0, 1 chữ số thập phân, không bắt buộc |
| Dấu hiệu / mô tả | ≤ 1.000; bắt buộc |
| Diễn biến (chỉ theo dõi) | `IMPROVED` / `UNCHANGED` / `WORSENED` (Tốt hơn / Không đổi / Xấu hơn); bắt buộc |
| Người quan sát, người ghi, thời điểm ghi | Người quan sát mặc định người ghi |
| Trạng thái | `VALID` → `VOIDED` (chỉ lần theo dõi); quan sát mở ca chỉ sửa, không hủy |

### 3.3 Điều trị (Treatment)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Ca | Tham chiếu | Có | OPEN hoặc CHRONIC | UC-04 |
| Thuốc + tên snapshot | Danh mục | Có | ACTIVE | Popup |
| Liều | Chuỗi | Có | ≤ 50 (ví dụ "30 ml"); gợi ý từ liều tham chiếu | Popup |
| Đường dùng | Enum | Có | Tiêm bắp / Tiêm dưới da / Tĩnh mạch / Uống / Bôi / Khác | Popup |
| Thời điểm dùng lần đầu | Ngày giờ | Có | Không tương lai, không trước thời điểm mở ca | Popup |
| Số ngày liệu trình | Số nguyên | Không | 1–30, mặc định 1 | Popup |
| Ngày ngưng thịt | Số nguyên | Không | 0–365; điền sẵn từ thuốc, sửa được | Popup |
| Ngày hết ngưng thịt | Suy ra | — | Ngày dùng cuối (ngày dùng đầu + số ngày − 1) + ngày ngưng thịt | GBR-46 |
| Người thực hiện | Thành viên hoặc tên ngoài (bác sĩ thú y) | Không | Tên ngoài ≤ 100 | Popup |
| Tư vấn thú y | Chuỗi dài | Không | ≤ 500 | Popup |
| Người ghi, thời điểm ghi | — | — | — | BR-D14 |
| Trạng thái | Enum | — | `VALID` → `VOIDED`; sửa giữ VALID + "Đã sửa" | §3.2 |

Đổi thuốc, liều hoặc đường dùng sau đó = **ghi một điều trị mới**, không sửa điều trị cũ (§3.2, UC-04 AF1).

### 3.4 Trạng thái suy ra của bò

| Chỉ số | Quy tắc | Nguồn |
|---|---|---|
| Sức khỏe | `UNDER_TREATMENT` khi có ca OPEN có ít nhất 1 điều trị VALID; nếu không `MONITORING` khi có ca OPEN hoặc CHRONIC; nếu không `HEALTHY`. Không hiện cho bò EXITED / VOIDED | GBR-45 |
| Ngày hết ngưng thịt | Ngày lớn nhất trong các điều trị VALID và bản ghi tiêm ON_FARM VALID; ≥ hôm nay → "Cách ly thịt đến dd/mm/yyyy" | GBR-46 |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-10-01 | Quan sát bất thường mở **ca mới** (một bò có thể có nhiều ca cho các vấn đề khác nhau). Diễn biến của ca OPEN / CHRONIC ghi qua "Cập nhật ca bệnh"; ca đã CLOSED → MSG-COM-05 (D54). | GBR-45, UC-02 E5 |
| R-10-02 | Mở ca tạo mã HC-nnnn + quan sát mở ca trong một transaction; sức khỏe ít nhất là Theo dõi. | UC-02 |
| R-10-03 | Phản ứng sau tiêm: mở ca từ bản ghi tiêm → liên kết bản ghi đó với ca. | GBR-47 |
| R-10-04 | Thân nhiệt ngoài 35,0–43,0 → MSG-FE10-06. | Popup |
| R-10-05 | Thời gian: không tương lai (MSG-COM-07); mở ca không trước ngày nhập đàn (MSG-COM-15); theo dõi / điều trị không trước lúc mở ca hoặc bản ghi mới nhất của ca → MSG-FE10-07; đóng ca không trước bản ghi mới nhất. | UC-02, 03, 04 |
| R-10-06 | Chuyển trạng thái: OPEN → CHRONIC (Manager, ghi ngày); CHRONIC → OPEN (Manager, hoặc khi ghi điều trị với ô "Chuyển ca về Đang mở" được chọn – mặc định chọn; bỏ chọn cho điều trị duy trì thì ca giữ CHRONIC – D55); OPEN / CHRONIC → CLOSED với kết quả. | GBR-45, Table 3.4-4 |
| R-10-07 | Đóng ca Chết / Mất tích: **trong cùng transaction** tạo 1 phiếu xuất PENDING (loại DEATH; Mất tích là OTHER với lý do "Missing") liên kết ca, thông báo Owner, tạo REM-12; bò **vẫn ACTIVE** đến khi Owner xác nhận / bỏ. Hiện MSG-FE10-05. | GBR-47, GBR-95, UC-03 AF4 |
| R-10-08 | Xác nhận xuất đàn (FE-13) đóng các ca OPEN / CHRONIC với kết quả CLOSED_BY_EXIT. | Table 3.4-4 |
| R-10-09 | Ghi điều trị: lưu điều trị + dòng thời gian; tính lại ngày hết ngưng thịt và sức khỏe; ca CHRONIC trở về OPEN trong cùng transaction, trừ khi người dùng bỏ chọn "Chuyển ca về Đang mở" (D55). | UC-04, GBR-46 |
| R-10-10 | Sửa / hủy điều trị hoặc theo dõi: bắt buộc lý do; giữ giá trị gốc (Record Revision); kiểm thứ tự thời gian trong ca và version; tính lại ngày hết ngưng thịt và sức khỏe trong cùng transaction; ngày hết ngưng thịt đổi → MSG-FE10-12. | GBR-46, BR-D15 |
| R-10-11 | Quan sát mở ca chỉ sửa, **không hủy** → MSG-FE10-13; ca mở nhầm thì đóng có lý do (UC-03). | UC-05 AF3 |
| R-10-12 | Hủy điều trị cuối của ca OPEN → sức khỏe về Theo dõi nếu không còn ca OPEN nào có điều trị. | UC-05 AF2 |
| R-10-13 | Không sửa / hủy bản ghi thuộc ca CLOSED_BY_EXIT. | UC-05 PRE-2 |
| R-10-14 | Owner và Manager ghi, đổi trạng thái, sửa, hủy (D41); Technician xem. | GBR-08 |

---

## 5. Luồng xử lý

### UC-FE10-02 Mở ca
Popup → thời điểm (mặc định bây giờ), thân nhiệt, dấu hiệu, chẩn đoán nghi ngờ, cờ truyền nhiễm, mức độ, người quan sát → **Mở ca** → kiểm → R-10-02 → MSG-FE10-01.
Bò đang có ca OPEN / CHRONIC: popup nhắc mã ca và có nút "Cập nhật ca …" chuyển sang popup Cập nhật ca bệnh của ca đó (D54).
E1 thiếu dấu hiệu / mức độ → MSG-COM-06 · E2 thân nhiệt → MSG-FE10-06 · E3 thời gian → MSG-COM-07 / 15 · E4 bò EXITED → MSG-COM-13.

### UC-FE10-03 Cập nhật ca bệnh (D54)
Một popup thay cho "Ghi theo dõi" và "Cập nhật / Đóng ca": thời điểm, thân nhiệt, diễn biến, mô tả, chẩn đoán / cờ truyền nhiễm, trạng thái ca → **Lưu cập nhật**. Phần theo dõi và trạng thái lưu trong **một giao dịch**, cùng thời điểm.
- Giữ trạng thái → phần theo dõi bắt buộc (diễn biến + mô tả) → MSG-FE10-02.
- Chuyển theo dõi dài hạn (từ OPEN) → CHRONIC, "từ ngày" = ngày của thời điểm → MSG-FE10-08.
- Chuyển về đang mở (từ CHRONIC) → OPEN → MSG-FE10-09.
- Đóng ca → kết quả, người xác nhận; thời điểm đóng = thời điểm → MSG-FE10-04 (+ R-10-07 nếu Chết / Mất tích).
- Đổi trạng thái / đóng ca: phần theo dõi tùy chọn; có nhập mô tả, diễn biến hoặc thân nhiệt thì cần đủ diễn biến và mô tả (D35).
- Thời điểm không tương lai, không trước bản ghi mới nhất của ca (MSG-COM-07, MSG-FE10-07).

### UC-FE10-04 Ghi điều trị
Popup → thuốc (điền sẵn liều, đường dùng, ngưng thịt tham chiếu), liều, đường dùng, thời điểm, số ngày, ngày ngưng thịt, người thực hiện, tư vấn → hiện ngày hết ngưng thịt → **Lưu** → R-10-09 → MSG-FE10-03.
E2 thuốc ngưng → MSG-FE18-08 · E3 thời gian → MSG-COM-07 / MSG-FE10-07 · E4 ca CLOSED / bò EXITED → MSG-COM-05 / 13.

### UC-FE10-05 Sửa / hủy
Popup → loại bản ghi; chọn Sửa (trường theo loại) hoặc Hủy; hiện ngày hết ngưng thịt trước → sau → lý do → **Lưu** → R-10-10 → MSG-FE10-11 (+ MSG-FE10-12).

### UC-FE10-01 Xem
SCR-36 (danh sách ca toàn đàn theo tab) → SCR-37 (tab Sức khỏe của bò).

---

## 6. Màn hình và trường

### SCR-36 Ca sức khỏe (đàn)

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | Tabs | Tab | Đang mở (n), Mãn tính (n), Đã đóng (n), Tất cả |
| 2 | Search / Tìm | Ô chữ | Mã hiển thị hoặc mã ca |
| 3 | Severity, Pen / Mức độ, Chuồng | Dropdown | — |
| 4 | Period / Khoảng | Khoảng ngày mở ca | Mặc định 30 ngày gần nhất; tab Đang mở bỏ qua khoảng |
| 5 | Case code / Mã ca | Cột | HC-nnnn, sắp xếp được |
| 6 | Cattle / Bò | Cột | Mã hiển thị, giống, giới tính |
| 7 | Pen / Chuồng | Cột | Mã – tên |
| 8 | Suspected diagnosis · signs / Chẩn đoán nghi ngờ · dấu hiệu | Cột | Chẩn đoán nghi ngờ, hoặc dấu hiệu chính khi không có; huy hiệu "Truyền nhiễm" |
| 9 | Severity / Mức độ | Cột | Nhẹ / Vừa / Nặng |
| 10 | Opened at / Ngày mở | Cột | Sắp xếp được |
| 11 | Status / Trạng thái | Cột | OPEN · ngày n / CHRONIC · từ dd/mm/yyyy / CLOSED · kết quả |
| 12 | Open / Mở | Thao tác dòng | Mở SCR-37 tại ca đó |

### SCR-37 Tab Sức khỏe (hồ sơ bò)

| # | Trường | Hiện với | Nội dung |
|---|---|---|---|
| 1 | Health state / Sức khỏe | Tất cả | Khỏe mạnh / Theo dõi / Đang điều trị |
| 2 | Open health case / Mở ca sức khỏe | Owner, Manager | Mở popup |
| **Thẻ ca (mỗi ca OPEN hoặc CHRONIC)** | | | |
| 3 | Case / Ca | | Mã và dấu hiệu chính |
| 4 | Status / Trạng thái | | OPEN · ngày n / CHRONIC · từ dd/mm/yyyy |
| 5 | Severity, Opened at, Number of treatments | | Chỉ đọc |
| 6 | Meat withdrawal until / Cách ly thịt đến | | Ngày hết ngưng thịt của bò (điều trị + tiêm tại trại) hoặc "—" |
| 7 | Record treatment / Update case / Ghi điều trị, Cập nhật ca bệnh | Owner, Manager | Mở popup tương ứng (D54: bỏ nút "Ghi theo dõi" và "Cập nhật trạng thái") |
| 8 | Time, Type, Details, Recorded by / Thời điểm, Loại, Chi tiết, Người ghi | | Theo thời gian: Mở ca (dấu hiệu, thân nhiệt), Theo dõi (diễn biến, mô tả), Điều trị (thuốc, liều, đường dùng, ngưng thịt); "Đã sửa" / dòng hủy mờ |
| 9 | Actions / Thao tác | Owner, Manager | "Sửa · Hủy" trên dòng theo dõi và điều trị; "Sửa" trên quan sát mở ca |
| **Ca trước đây** | | | |
| 10 | Case code, Signs, Outcome · month | | Chỉ đọc |

### Popup Mở ca sức khỏe

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Cattle / Bò | Chỉ đọc | — | Mã, giống, giới tính, tuổi, chuồng | — | — |
| 2 | Observed at / Thời điểm quan sát | Ngày giờ | * | Không tương lai, không trước ngày nhập đàn | Bây giờ | MSG-COM-06, 07, 15 |
| 3 | Body temperature (°C) / Thân nhiệt | Số (1 thập phân) | — | 35,0–43,0 | — | MSG-FE10-06 |
| 4 | Signs / description / Dấu hiệu | Ô chữ dài | * | ≤ 1.000 | — | MSG-COM-06, MSG-COM-10 |
| 5 | Suspected diagnosis / Chẩn đoán nghi ngờ | Ô chữ + gợi ý | — | ≤ 100; gợi ý từ ca trước của trại | — | MSG-COM-10 |
| 6 | Suspected contagious – isolate / Nghi truyền nhiễm – cách ly | Checkbox | — | — | Tắt | — |
| 7 | Severity / Mức độ | Radio | * | Nhẹ / Vừa / Nặng | — | MSG-COM-06 |
| 8 | Existing cases / Ca đang có | Ghi chú | — | Khi bò có ca OPEN / CHRONIC: mã ca + nút "Cập nhật ca …" (D54; bỏ lựa chọn "Thêm vào ca đang có") | — | — |
| 9 | Observer / Người quan sát | Dropdown | — | Thành viên ACTIVE | Người dùng | — |
| 10 | Linked vaccination / Mũi tiêm liên kết | Chỉ đọc | — | Khi mở từ bản ghi tiêm | — | — |
| 11 | Cancel / Open case / Hủy, Mở ca | Nút | — | — | — | MSG-COM-13, MSG-COM-02 (popup – D49); thành công MSG-FE10-01 |

### ~~Popup Ghi theo dõi~~

Gộp vào popup Cập nhật ca bệnh (D54).

### Popup Ghi điều trị

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Health case / Ca | Chỉ đọc | — | — | — | — |
| 2 | Medicine / Thuốc | Dropdown | * | Thuốc ACTIVE | — | MSG-COM-06, MSG-FE18-08 |
| 3 | Dose / Liều | Ô chữ | * | ≤ 50 | Gợi ý từ liều tham chiếu | MSG-COM-06, MSG-COM-10 |
| 4 | Route / Đường dùng | Dropdown | * | Tiêm bắp / Tiêm dưới da / Tĩnh mạch / Uống / Bôi / Khác | Từ thuốc | MSG-COM-06 |
| 5 | Administered at / Thời điểm dùng lần đầu | Ngày giờ | * | Không tương lai, không trước lúc mở ca | Bây giờ | MSG-COM-07, MSG-FE10-07 |
| 6 | Course (days) / Liệu trình (ngày) | Số nguyên | — | 1–30 | 1 | MSG-COM-10 |
| 7 | Withdrawal (days) / Ngưng thịt (ngày) | Số nguyên | — | 0–365 | Từ thuốc | MSG-COM-10 |
| 8 | Withdrawal end / Hết ngưng thịt | Chỉ đọc | — | (ngày dùng đầu + số ngày − 1) + ngày ngưng | — | — |
| 9 | Return to open / Chuyển ca về Đang mở | Checkbox | — | Chỉ hiện khi ca CHRONIC; bỏ chọn khi chỉ điều trị duy trì (ca giữ theo dõi dài hạn) – D55 | Chọn | — |
| 10 | Performed by / Người thực hiện | Dropdown hoặc chữ | — | Thành viên ACTIVE hoặc tên ngoài ≤ 100 | — | MSG-COM-10 |
| 11 | Veterinary advice / Tư vấn thú y | Ô chữ dài | — | ≤ 500 | — | MSG-COM-10 |
| 12 | Cancel / Save treatment | Nút | — | — | — | MSG-COM-05, MSG-COM-13, MSG-COM-02; thành công MSG-FE10-03 |

### Popup Cập nhật ca bệnh (D54)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Case / Ca sức khỏe | Chỉ đọc | — | Mã, dấu hiệu, bò; tiêu đề phụ: ngày mở, Đang mở · ngày n / Theo dõi dài hạn · từ ngày | — |
| 2 | Time / Thời điểm | Ngày giờ | * | Mặc định bây giờ; không tương lai, không trước bản ghi mới nhất của ca; dùng cho lần theo dõi, ngày bắt đầu theo dõi dài hạn và lúc đóng ca | MSG-COM-07, MSG-FE10-07 |
| 3 | Body temperature (°C) / Thân nhiệt | Số (1 thập phân) | — | 35,0–43,0; gõ sai báo dưới ô | MSG-FE10-06 |
| 4 | Progress / Diễn biến | Radio | * khi có phần theo dõi | Tốt hơn / Không đổi / Xấu hơn; không chọn sẵn, không tự điền (D35) | MSG-COM-06 |
| 5 | Description / Mô tả | Ô chữ dài | * khi có phần theo dõi | ≤ 1.000 | MSG-COM-06, MSG-COM-10 |
| 6 | Suspected diagnosis, Contagious | Như popup Mở ca | — | — | — |
| 7 | Case status / Trạng thái ca | Radio | * | Đang mở: Giữ đang mở (mặc định) / Chuyển theo dõi dài hạn / Đóng ca. Theo dõi dài hạn: Giữ theo dõi dài hạn (mặc định) / Chuyển về đang mở / Đóng ca | — |
| 8 | Outcome / Kết quả | Radio | * khi Đóng ca | Khỏi / Chết / Mất tích; Chết, Mất tích → ghi chú phiếu xuất chờ trước khi lưu | MSG-COM-06 |
| 9 | Confirmed by / Người xác nhận | Dropdown | — | Khi Đóng ca; thành viên ACTIVE, mặc định người dùng | — |
| 10 | Cancel / Save update | Nút | — | "Xác nhận đóng ca" (đỏ) khi Chết / Mất tích | MSG-COM-05, MSG-COM-02 (popup – D49); thành công MSG-FE10-02 / 04 / 08 / 09 |

"Có phần theo dõi" = Giữ trạng thái, hoặc có nhập mô tả, diễn biến hay thân nhiệt.

### Popup Sửa / Hủy điều trị hoặc theo dõi

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Record / Bản ghi | Chỉ đọc | — | Loại (Điều trị / Theo dõi), mã ca, thời điểm, người ghi | — |
| 2 | Action / Hành động | Radio | * | Sửa (mặc định) / Hủy; quan sát mở ca chỉ Sửa | MSG-FE10-13 |
| 3 | Field / Current / New | Bảng | — | Điều trị: thuốc, liều, đường dùng, thời điểm dùng đầu, liệu trình, ngưng thịt, người thực hiện. Theo dõi: thời điểm, thân nhiệt, diễn biến, mô tả, người quan sát. Kiểm như popup ghi | MSG-COM-07, MSG-FE10-06, MSG-FE10-07 |
| 4 | Meat withdrawal until / Cách ly thịt đến | Chỉ đọc | — | "trước → sau"; tô nổi khi đổi | — |
| 5 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 6 | Cancel / Save | Nút | — | — | MSG-COM-13, MSG-COM-18, MSG-COM-05, MSG-COM-02; thành công MSG-FE10-11 (+ MSG-FE10-12) |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách ca | `tab, search?, severity?, penId?, from?, to?, page, size, sort?` | `{counts{open, chronic, closed}, items[{caseId, caseCode, cattle, pen, suspectedDiagnosis, signs, contagious, severity, openedAt, status, dayN?, chronicSince?, outcome?}], total}` | COM-03 | `GET /api/farms/{farmId}/health-cases` |
| A2 | Tab sức khỏe của bò | — | `{healthState, withdrawalUntil, openCases[{caseId, code, signs, status, dayN, chronicSince, severity, openedAt, treatmentCount, timeline[{recordId, type: OPENING\|FOLLOW_UP\|TREATMENT, at, details, recordedBy, corrected, status, version}], version}], previousCases[{code, signs, outcome, month}]}` | COM-08 | `GET /api/farms/{farmId}/health-cases/cattle/{cattleId}` |
| A3 | Mở ca | `cattleId, observedAt, temperature?, signs, suspectedDiagnosis?, contagious, severity, observerId?, vaccinationId?` + `Idempotency-Key` (`existingCaseId` vẫn được backend nhận nhưng giao diện không dùng – D54) | `{caseId, caseCode, healthState}` | COM-06, FE10-06, COM-07, COM-15, COM-13, COM-17, COM-05, COM-02 | `POST /api/farms/{farmId}/health-cases` |
| A4 | Ghi theo dõi (giao diện không dùng từ D54 – thay bằng A5) | `observedAt, temperature?, progress, description, version` + `Idempotency-Key` | Ca | COM-06, FE10-06, FE10-07, COM-05 | `POST …/health-cases/{caseId}/observations` |
| A5 | Cập nhật ca bệnh (D54) | `action: KEEP\|TO_CHRONIC\|TO_OPEN\|CLOSE, observedAt?, temperatureC?, latestProgress? (mô tả), progress? (IMPROVED\|UNCHANGED\|WORSENED), suspectedDiagnosis?, contagious?, outcome?, confirmedById?, version` + `Idempotency-Key`. Phần theo dõi bắt buộc khi KEEP hoặc có `latestProgress` / `progress` / `temperatureC` – khi đó cần cả `latestProgress` và `progress`, không tự điền (D35). `observedAt` thiếu → `closedAt` (bản cũ) → hiện tại | `{case, healthState, observationId?, pendingExitVoucherId?}` | COM-06, FE10-06, COM-07, COM-15, FE10-07, COM-05, COM-13 | `POST …/health-cases/{caseId}/status` |
| A6 | Ghi điều trị | `medicineId, dose, route, administeredAt, courseDays?, withdrawalDays?, performerId? \| performerName?, vetAdvice?, version` + `Idempotency-Key` | `{treatmentId, withdrawalEnd, cattleWithdrawalUntil, healthState, caseStatus}` | COM-06, FE18-08, COM-07, FE10-07, COM-05, COM-13 | `POST …/health-cases/{caseId}/treatments` |
| A7 | Sửa / hủy điều trị | `changes?, reason, version` + `Idempotency-Key` | `{status, withdrawalBefore, withdrawalAfter, healthState}` | COM-06, FE10-07, COM-05, COM-13, COM-18 | `POST /api/farms/{farmId}/treatments/{id}/correction` · `/void` |
| A8 | Sửa / hủy theo dõi | Như A7 | Như A7 | + FE10-13 (hủy quan sát mở ca), FE10-06 | `POST /api/farms/{farmId}/health-observations/{id}/correction` · `/void` |

Ghi chú: code có thêm `POST …/health-cases/{caseId}/closure-correction` (sửa việc đóng ca) – **SRS không có UC này**; cần chủ dự án quyết giữ hay bỏ (Q3).

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE10-01 | Toast thành công | Đã {mở/cập nhật} ca {case_code} cho {cattle_code}. |
| MSG-FE10-02 | Toast thành công | Đã ghi theo dõi cho {case_code}. |
| MSG-FE10-03 | Toast thành công | Đã ghi điều trị. Cách ly thịt đến {date}. |
| MSG-FE10-04 | Toast thành công | Đã đóng ca {case_code} với kết quả {outcome}. |
| MSG-FE10-05 | Hộp thoại thông tin | Đã tạo phiếu xuất chờ Chủ trại xác nhận. {cattle_code} vẫn đang nuôi cho đến khi Chủ trại xác nhận. |
| MSG-FE10-06 | Dưới trường | Thân nhiệt phải từ 35,0 đến 43,0 °C. |
| MSG-FE10-07 | Dưới trường | Thời điểm không được sớm hơn {date}, bản ghi mới nhất của ca này. |
| MSG-FE10-08 | Toast thành công | Ca {case_code} đã chuyển sang theo dõi dài hạn. |
| MSG-FE10-09 | Toast thành công | Ca {case_code} đã chuyển về đang mở. |
| MSG-FE10-10 | Trong hộp thoại | Thay bằng ô chọn "Chuyển ca về Đang mở (bỏ chọn nếu chỉ điều trị duy trì)" – D55. |
| MSG-FE10-11 | Toast thành công | Đã {sửa/hủy} {loại bản ghi}. Thay đổi và lý do được giữ trong lịch sử. |
| MSG-FE10-12 | Sau khi lưu | Cách ly thịt của {cattle_code} đổi từ {old_date} thành {new_date}. |
| MSG-FE10-13 | Trong hộp thoại | Không thể hủy quan sát mở ca. Hãy sửa nó, hoặc đóng ca kèm lý do. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-10-01 | Popup Mở ca | Thân nhiệt 34,9 / 35,0 / 43,0 / 43,1 | Lỗi / OK / OK / Lỗi | U, H | R-10-04 |
| TC-10-02 | Popup Mở ca | Không dấu hiệu; không mức độ | MSG-COM-06 | U, H | UC-02 E1 |
| TC-10-03 | Bò khỏe | Mở ca mới | HC-nnnn; sức khỏe Theo dõi | I | R-10-02 |
| TC-10-04 | Bò có ca OPEN | Mở popup Mở ca; mở thêm ca cho vấn đề khác | Popup nhắc ca đang có + nút "Cập nhật ca …"; lưu tạo ca mới thứ hai (D54) | U, I | R-10-01 |
| TC-10-05 | Ca đã CLOSED | Cập nhật ca | MSG-COM-05 | I | R-10-01 |
| TC-10-06 | Mở từ bản ghi tiêm | Lưu | Ca liên kết bản ghi tiêm | I | R-10-03 |
| TC-10-07 | Ca mở 01/11 10:00 | Cập nhật ca lúc 01/11 09:00 | MSG-FE10-07 dưới ô Thời điểm | I | R-10-05 |
| TC-10-08 | Ca OPEN chưa điều trị | Ghi điều trị | Sức khỏe Đang điều trị | I | GBR-45 |
| TC-10-09 | Điều trị dùng 01/11, 3 ngày, ngưng 7 ngày | Lưu | Hết ngưng thịt 10/11 (01 + 3 − 1 = 03; + 7) | U | GBR-46 |
| TC-10-10 | Ca CHRONIC | Ghi điều trị, giữ ô "Chuyển ca về Đang mở" / bỏ chọn | Ca OPEN, Đang điều trị / ca giữ CHRONIC, sức khỏe Theo dõi, ngưng thịt vẫn tính | I, E | R-10-06, D55 |
| TC-10-11 | Ca OPEN có điều trị | Chuyển theo dõi dài hạn | CHRONIC; sức khỏe Theo dõi (nếu không ca OPEN khác có điều trị) | I | R-10-06 |
| TC-10-12 | Ca CHRONIC | Chuyển về đang mở | OPEN; MSG-FE10-09 | I | R-10-06 |
| TC-10-13 | Ca OPEN | Đóng, kết quả Hồi phục | CLOSED; sức khỏe Khỏe mạnh nếu không còn ca nào | I | GBR-45 |
| TC-10-14 | Ca OPEN | Đóng, kết quả Chết | CLOSED; có 1 phiếu xuất PENDING loại DEATH liên kết ca; REM-12; bò vẫn ACTIVE; MSG-FE10-05 | I | R-10-07 |
| TC-10-15 | Ca OPEN | Đóng, kết quả Mất tích | Phiếu PENDING loại OTHER lý do "Missing" | I | R-10-07 |
| TC-10-16 | Đóng ca thất bại khi tạo phiếu | — | Ca vẫn OPEN, không có phiếu | I | R-10-07 |
| TC-10-17 | Đóng ca | Thời điểm trước lần theo dõi cuối | MSG-FE10-07 | I | R-10-05 |
| TC-10-18 | Bò trên phiếu chết PENDING | Mở ca mới / sửa điều trị cũ | MSG-COM-17 / được | I | GBR-26 |
| TC-10-19 | Điều trị hết ngưng 10/11 | Sửa ngưng thịt 7 → 14 | Hết 17/11; MSG-FE10-12 "10/11 → 17/11"; revision giữ 7 | I | R-10-10 |
| TC-10-20 | Điều trị duy nhất của ca OPEN | Hủy có lý do | VOIDED; sức khỏe về Theo dõi; ngày ngưng thịt tính lại | I | R-10-12 |
| TC-10-21 | Quan sát mở ca | Hủy | MSG-FE10-13 | I | R-10-11 |
| TC-10-22 | Sửa / hủy | Không lý do | MSG-COM-06 | U, H | R-10-10 |
| TC-10-23 | Ca CLOSED_BY_EXIT | Sửa điều trị | Bị chặn | I | R-10-13 |
| TC-10-24 | Technician | Gọi mở ca / ghi điều trị | 403 | H | R-10-14 |
| TC-10-25 | Thuốc ngưng | Ghi điều trị | MSG-FE18-08 | I | UC-04 E2 |
| TC-10-26 | 3 ca OPEN, 1 CHRONIC, 2 CLOSED (tháng trước) | Mở SCR-36, tab Đang mở | 3 dòng, bỏ qua khoảng ngày | E | SCR-36 |
| TC-10-27 | Popup Cập nhật ca bệnh | Giữ trạng thái để trống; đổi trạng thái chỉ nhập thân nhiệt; Đóng ca có mô tả không chọn diễn biến; Đóng ca phần theo dõi trống | Lỗi dưới ô Diễn biến và Mô tả / lỗi dưới Diễn biến và Mô tả / lỗi dưới Diễn biến / lưu được, không tạo theo dõi; lưu đúng diễn biến và thân nhiệt đã nhập | U, H | D35, D54 |
| TC-10-28 | A5 | Có `latestProgress`, thiếu `progress` | 400 MSG-COM-06 `{field: progress}`; ca không đổi; backend không tự điền | H | D35 |
| TC-10-29 | Owner, trại ACTIVE | Mở ca, cập nhật ca, ghi điều trị, đóng ca, sửa / hủy điều trị | Thành công như Manager; người ghi = Owner | H, I, E | R-10-14, D41 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất | Quyết định (07/11/2026) |
|---|---|---|---|
| Q1 | "Diễn biến mới nhất" ở popup Cập nhật / Đóng ca có bắt buộc không? UC-03 E1 nói thiếu "progress, description" → MSG-COM-06 | Bắt buộc khi Giữ trạng thái; không bắt buộc khi Đóng / đổi trạng thái | Theo đề xuất; D54 giữ nguyên quy tắc trong popup Cập nhật ca bệnh |
| Q2 | UC-FE10-01 không có đặc tả Part II | Theo SCR-36, SCR-37 | Theo SCR-36, SCR-37 |
| Q3 | Code có "sửa việc đóng ca" (closure-correction) – SRS không có | Bỏ, hoặc bổ sung UC vào SRS | Bỏ: không làm chức năng sửa việc đóng ca (không có trong SRS); gỡ route hiện có khi làm FE-10 |
| Q4 | Chẩn đoán nghi ngờ có danh mục chuẩn không? | Không – chữ tự do + gợi ý từ dữ liệu trại | Theo đề xuất |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho TuanPQ duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 07/11/2026 | 28/10/2026 | Chốt các câu hỏi mục 10 (cột Quyết định), ghi tại `OPEN_QUESTIONS.md` | Tuấn |
| 14/11/2026 | 28/10/2026 | D35: popup Cập nhật / Đóng ca thêm ô chọn Diễn biến (mục 6 dòng 3), A5 thêm `progress?` (mục 7), TC-10-27/28; bỏ cách tự suy diễn biến từ kết quả | Tuấn |
| 23/11/2026 | 28/10/2026 | D54: gộp popup Ghi theo dõi và Cập nhật / Đóng ca thành "Cập nhật ca bệnh" (một thời điểm, có thân nhiệt; UC-FE10-03, SCR-37 dòng 7, mục 6, A5); popup Mở ca bỏ "Thêm vào ca đang có", nhắc và dẫn sang ca đang có (UC-FE10-02, R-10-01, A3); TC-10-04/05/07/27/29 | Tuấn |
| 23/11/2026 | 28/10/2026 | D55: ghi điều trị cho ca CHRONIC có ô "Chuyển ca về Đang mở" (mặc định chọn; bỏ chọn = điều trị duy trì, ca giữ CHRONIC) – R-10-06, R-10-09, popup Ghi điều trị dòng 9, MSG-FE10-10, TC-10-10. D56: giao diện tiếng Việt cho trạng thái ca – Đang mở / Theo dõi dài hạn / Đã đóng (thay OPEN / CHRONIC / CLOSED và "mạn tính"); hành động "Chuyển theo dõi dài hạn", "Chuyển về đang mở" | Tuấn |
