# SPEC FE-09 – Lịch tiêm và ghi nhận tiêm phòng

| | |
|---|---|
| Feature | FE-09 Vaccination Schedule and Recording |
| Use case | UC-FE09-01 → UC-FE09-08 |
| Người phụ trách | TuanPQ (BE + FE + test) · Review BE: AnNT · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Vaccination Schedule, Scheduled Dose, Vaccination Record, Record Revision), §3.3 (BR-D14, BR-D15, BR-D17), Part II §9, Part III §9 (SCR-31 → SCR-35, 2 popup), MSG-FE09, GBR-08, 24, 26, 30, 32, 41 → 44, 46, 47; REM-06; JOB-01 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 05 và Layout 17.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE09-01 | Xem lịch tiêm và các mũi | Owner, Manager, Technician | SCR-31, SCR-34 |
| UC-FE09-02 | Tạo lịch tiêm | Manager | SCR-32 |
| UC-FE09-03 | Sửa lịch tiêm / thêm bớt bò | Manager | SCR-32 |
| UC-FE09-04 | Dừng lịch tiêm | Manager | SCR-32 |
| UC-FE09-05 | Ghi nhận tiêm (một con, cả lô, hoặc tiêm lịch sử) | Manager | SCR-33 |
| UC-FE09-06 | Hoãn mũi tiêm | Manager | Popup Hoãn mũi |
| UC-FE09-07 | Xem lịch sử tiêm | Owner, Manager, Technician | SCR-34, SCR-35 |
| UC-FE09-08 | Sửa / hủy bản ghi tiêm | Manager | Popup Sửa / Hủy bản ghi tiêm |

**Liên quan:** danh mục vắc-xin (FE-18); bản ghi tiêm HISTORICAL tạo khi nhập đàn (FE-06); phản ứng sau tiêm là ca sức khỏe liên kết (FE-10 UC-FE10-02); nhắc REM-06 (FE-14); cách ly thịt hiển thị ở FE-05, cảnh báo ở FE-13.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem lịch, mũi, lịch sử | Có | Có | Có |
| Tạo / sửa / dừng lịch, ghi tiêm, hoãn, sửa / hủy bản ghi | — | **Chỉ Manager** | — (có thể được chọn là người tiêm) |

Cần trại ACTIVE (GBR-08). Bò EXITED / VOIDED / trên phiếu chết PENDING không nhận bản ghi mới (GBR-26).

---

## 3. Dữ liệu

### 3.1 Lịch tiêm (Vaccination Schedule)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Tên lịch | Chuỗi | Có | ≤ 100; duy nhất trong các lịch ACTIVE của trại | SCR-32 |
| Vắc-xin | Danh mục | Có | ACTIVE | SCR-32 |
| Ngày bắt đầu | Ngày | Có | Ngày dự kiến của mũi 1 | SCR-32 |
| Số mũi | Số nguyên | Có | 1–10 | SCR-32 |
| Số ngày giữa các mũi | Số nguyên | Có khi số mũi > 1 | 1–365 | SCR-32 |
| Nhắc lại sau (tháng) | Số nguyên | Không | 1–60 | SCR-32 |
| Đối tượng | Chuồng, nhóm đàn, giai đoạn (kết hợp **VÀ**) + thêm / bớt từng con | Có | **Được chốt thành danh sách bò cụ thể khi lưu**; ít nhất 1 con | GBR-41 |
| Trạng thái | Enum | — | `ACTIVE` → `STOPPED` | §3.2 |
| Người tạo | — | — | — | §3.2 |

### 3.2 Mũi theo lịch (Scheduled Dose)

| Thuộc tính | Ràng buộc |
|---|---|
| Lịch + bò + số mũi (hoặc nhắc lại) | Duy nhất (BR-D17) |
| Ngày dự kiến | Mũi k = ngày bắt đầu + (k − 1) × số ngày giữa các mũi |
| Trạng thái | `PLANNED` → `DONE` / `DEFERRED` (→ PLANNED lại với ngày mới, hoặc DONE) / `CANCELLED` |
| Lý do hoãn, ngày dự kiến mới, bản ghi tiêm hoàn thành mũi | Mỗi mũi được hoàn thành bởi tối đa 1 bản ghi ON_FARM (BR-D17) |
| Tình trạng hạn **suy ra** | Sắp tới (còn > số ngày nhắc trước), Đến hạn (trong số ngày nhắc trước, mặc định 7), Quá hạn (qua ngày mà chưa DONE) (GBR-43) |

### 3.3 Bản ghi tiêm (Vaccination Record)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Bò | Tham chiếu | Có | Mỗi bò một bản ghi | GBR-42 |
| Vắc-xin + tên snapshot | Danh mục | Có | ACTIVE; tên lưu snapshot (sửa danh mục sau không đổi) | §3.2 |
| Thời điểm tiêm | Ngày giờ | Có (ON_FARM) | Không tương lai, không trước ngày nhập đàn (trừ HISTORICAL) | BR-D14 |
| Số lô | Chuỗi | Có (ON_FARM) | ≤ 50 | SCR-33 |
| Liều | Số + đơn vị (ml hoặc liều) | Không | Điền sẵn từ vắc-xin | SCR-33 |
| Đường dùng | Enum | Không | Tiêm bắp / Tiêm dưới da / Uống / Nhỏ mũi / Khác | SCR-33 |
| Ngày ngưng thịt | Số nguyên | Không (chỉ ON_FARM) | 0–365; điền sẵn từ vắc-xin, sửa được | SCR-33 |
| Ngày hết ngưng thịt | Suy ra | — | Ngày tiêm + số ngày (chỉ ON_FARM) | GBR-46 |
| Người tiêm | Thành viên ACTIVE hoặc tên người ngoài | Không | Tên ngoài ≤ 100 | SCR-33 |
| Nguồn | Enum | Có | `ON_FARM` (mặc định) / `HISTORICAL` | GBR-42 |
| Nguồn thông tin | Chuỗi | Không | Cho HISTORICAL | §3.2 |
| Mũi theo lịch | Tham chiếu | Không | Chỉ ON_FARM mới đóng mũi | GBR-42 |
| Thời điểm ghi | Hệ thống | Có | — | BR-D14 |
| Trạng thái | Enum | — | `VALID` → `VOIDED` (có lý do); sửa giữ VALID + "Đã sửa" | GBR-44 |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-09-01 | Đối tượng lịch được chốt thành danh sách bò ACTIVE cụ thể khi lưu; không có bò nào → MSG-FE09-07. Bò mới vào đàn sau đó **không** tự vào lịch; chỉ vào khi Manager thêm (UC-FE09-03). | GBR-41, GBR-32 |
| R-09-02 | Lưu lịch tạo đúng 1 mũi PLANNED cho mỗi bò × số mũi, trong một transaction; sau đó đánh giá REM-06 (JOB-01). | GBR-41, BR-D17 |
| R-09-03 | Tên lịch trùng một lịch ACTIVE → MSG-FE09-10. Vắc-xin ngưng → MSG-FE18-08. | SCR-32, UC-02 E2 |
| R-09-04 | Bò đã tiêm cùng vắc-xin gần đây được đánh dấu trong danh sách; Manager tự quyết giữ hay bỏ. | UC-02 AF1 |
| R-09-05 | Sửa lịch chỉ ảnh hưởng mũi **chưa tiêm** (PLANNED / DEFERRED); mũi DONE không bao giờ đổi. | GBR-41 |
| R-09-06 | Dừng lịch: bắt buộc lý do, xác nhận MSG-FE09-02; mọi mũi PLANNED và DEFERRED → CANCELLED; mũi DONE giữ nguyên; lịch STOPPED. | GBR-41, SCR-32 |
| R-09-07 | Nhắc lại: khi ghi mũi cuối của loạt (hoặc một mũi nhắc lại) và lịch còn ACTIVE → tạo mũi nhắc lại tiếp theo vào ngày tiêm + số tháng nhắc lại. | UC-02 AF3 |
| R-09-08 | Ghi tiêm ON_FARM bắt buộc vắc-xin, số lô (MSG-FE09-05), thời điểm; HISTORICAL có thể thiếu số lô / thời điểm chính xác, **không** đóng mũi theo lịch và **không** tính ngưng thịt. | GBR-42, UC-05 AF2 |
| R-09-09 | Ghi theo lô: mỗi bò "Tiêm" một bản ghi; bò chuyển "Hoãn" áp R-09-12. Tất cả lưu trong **một transaction**: bản ghi, mũi DONE, tính lại ngày mũi kế, hoãn, ngày hết ngưng thịt, dòng thời gian. Lỗi → không lưu gì. | GBR-42, UC-05 bước 7, E6 |
| R-09-10 | Mũi đã DONE cho một bò → MSG-FE09-09, bỏ qua bò đó; bò đã EXITED trong lúc đó → MSG-COM-13, bỏ qua. | UC-05 E3, E5 |
| R-09-11 | Ghi từ hồ sơ một con: bò có mũi PLANNED / DEFERRED khớp vắc-xin → tự liên kết. | UC-05 AF1 |
| R-09-12 | Hoãn mũi: bắt buộc lý do; ngày mới tùy chọn, không trước hôm nay (MSG-FE09-11); mũi DEFERRED; nhắc theo ngày mới; không có ngày mới → nằm ở tab "Đã hoãn". Hoãn lại được nhiều lần. Mũi DONE / CANCELLED → MSG-COM-05. | GBR-43 |
| R-09-13 | Ngày hết ngưng thịt của bò = ngày lớn nhất trong các điều trị VALID và bản ghi tiêm ON_FARM VALID; còn ≥ hôm nay thì hiện "Cách ly thịt đến …". | GBR-46 |
| R-09-14 | Sửa / hủy bản ghi: bắt buộc lý do; giữ giá trị gốc (Record Revision); kiểm version. Hủy bản ghi ON_FARM → mũi quay về PLANNED (hoặc DEFERRED với ngày cũ), trừ khi lịch đã STOPPED; nhắc việc khôi phục. Sau sửa / hủy tính lại ngày hết ngưng thịt. | GBR-44, BR-D15 |
| R-09-15 | Ca sức khỏe phản ứng sau tiêm giữ liên kết khi bản ghi tiêm bị hủy và hiện rằng mũi tiêm đã bị hủy. | UC-08 AF2, GBR-47 |
| R-09-16 | Chỉ Manager ghi / sửa / hủy / hoãn / quản lý lịch. | GBR-08 |

---

## 5. Luồng xử lý

### UC-FE09-02 Tạo lịch
SCR-32 → tên, vắc-xin (hiện bệnh, liều, đường dùng, ngưng thịt tham chiếu), ngày bắt đầu, số mũi, số ngày giữa mũi, nhắc lại → chọn đối tượng (chuồng, nhóm đàn, giai đoạn) → hệ thống hiện số bò khớp và danh sách (bỏ / thêm từng con) → bảng mũi dự kiến → **Lưu lịch** → R-09-01 → R-09-03 → R-09-02 → MSG-FE09-01.

### UC-FE09-03 Sửa lịch
Mở lịch ACTIVE ở SCR-32 → đổi thông tin / đối tượng → **Lưu lịch** → áp R-09-05: bò thêm mới nhận mũi PLANNED; bò bị bỏ → mũi chưa tiêm CANCELLED; đổi ngày / số mũi → tính lại mũi chưa tiêm → MSG-FE09-01.

### UC-FE09-04 Dừng lịch
SCR-32 → **Dừng lịch** → lý do → xác nhận MSG-FE09-02 → R-09-06 → MSG-FE09-03.

### UC-FE09-05 Ghi tiêm
1. SCR-33: lịch và mũi (nếu bắt đầu từ lịch), các bò đã chọn (mã, chuồng).
2. Xác nhận / chọn vắc-xin, nhập số lô, thời điểm (mặc định bây giờ), liều, đường dùng, ngày ngưng thịt (điền sẵn), người tiêm, nguồn "Tiêm tại trại".
3. Mỗi bò mặc định "Tiêm"; chuyển "Hoãn" thì nhập lý do và ngày mới.
4. Tóm tắt (số tiêm, số hoãn) → **Lưu n mũi tiêm** → kiểm → R-09-09 → JOB-01 → MSG-FE09-04.

AF1 một con từ hồ sơ (R-09-11) · AF2 tiêm lịch sử (R-09-08) · AF3 phản ứng sau tiêm → mở ca sức khỏe liên kết (FE-10) · AF4 Hủy.

### UC-FE09-06 Hoãn mũi
Popup → lý do, ngày mới (tùy chọn), ghi chú → **Lưu hoãn** → R-09-12 → MSG-FE09-06.

### UC-FE09-01 / 07 Xem
SCR-31 (thẻ lịch, tab mũi theo tình trạng hạn, danh sách mũi) · SCR-34 (tab hồ sơ) · SCR-35 (lịch sử toàn đàn).

### UC-FE09-08 Sửa / hủy bản ghi
Popup → Sửa (vắc-xin, số lô, thời điểm, liều, đường dùng, ngày ngưng thịt, người tiêm) hoặc Hủy → lý do → **Lưu** → R-09-14 → MSG-FE09-08.

---

## 6. Màn hình và trường

### SCR-31 Lịch tiêm

| # | Trường | Loại | Hiện với | Nội dung |
|---|---|---|---|---|
| 1 | Vaccination history / Lịch sử tiêm | Nút | Tất cả | Mở SCR-35 |
| 2 | Manage schedules / Quản lý lịch | Nút | Manager | Mở SCR-32 |
| 3 | Record vaccination / Ghi nhận tiêm | Nút | Manager | Mở SCR-33 cho các mũi đã chọn |
| 4 | Schedule card / Thẻ lịch | Thẻ | Tất cả | Tên, vắc-xin, số mũi, khoảng cách |
| 5 | Progress / Tiến độ | Chữ | | "Đã tiêm x / y" và "n quá hạn" hoặc "Đúng tiến độ" |
| 6 | Dose tabs / Tab mũi | Tab | | Tất cả, Quá hạn, Đến hạn trong 7 ngày, Sắp tới, Đã hoãn, Đã tiêm – có số |
| 7 | Select / Chọn | Checkbox | Manager | Chọn để ghi theo lô |
| 8 | Cattle / Bò | Cột | | Mã hiển thị, giống, giới tính |
| 9 | Pen / Chuồng | Cột | | Mã – tên |
| 10 | Schedule · Dose / Lịch · Mũi | Cột | | Ví dụ "LMLM 2026 · mũi 2/2" hoặc "nhắc lại" |
| 11 | Planned date / Ngày dự kiến | Cột | | dd/mm/yyyy, sắp xếp được |
| 12 | Status / Tình trạng | Huy hiệu | | Quá hạn n ngày / Đến hạn / Sắp tới / Hoãn đến dd/mm / Đã tiêm dd/mm |
| 13 | Actions / Thao tác | Nút | Manager | "Ghi" → SCR-33 với mũi đó; "Hoãn" → popup |

### SCR-32 Quản lý lịch tiêm

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Schedule name / Tên lịch | Ô chữ | * | ≤ 100; duy nhất trong lịch ACTIVE | MSG-COM-06, MSG-FE09-10 |
| 2 | Vaccine / Vắc-xin | Dropdown | * | Vắc-xin ACTIVE | MSG-COM-06, MSG-FE18-08 |
| 3 | Start date / Ngày bắt đầu | Ngày | * | Ngày dự kiến mũi 1 | MSG-COM-06 |
| 4 | Number of doses / Số mũi | Số nguyên | * | 1–10 | MSG-COM-06, MSG-COM-10 |
| 5 | Days between doses / Số ngày giữa mũi | Số nguyên | * khi số mũi > 1 | 1–365 | MSG-COM-06, MSG-COM-10 |
| 6 | Booster after (months) / Nhắc lại sau (tháng) | Số nguyên | — | 1–60 | MSG-COM-10 |
| 7 | Pens, Herd groups, Life stages / Chuồng, Nhóm đàn, Giai đoạn | Chọn nhiều | — | Kết hợp VÀ | — |
| 8 | Matching cattle / Bò khớp | Danh sách | * (≥ 1 con) | Số con + danh sách ACTIVE; bỏ từng con; "+ Thêm bò"; đánh dấu bò đã tiêm cùng vắc-xin gần đây | MSG-FE09-07 |
| 9 | Planned doses / Mũi dự kiến | Bảng chỉ đọc | — | Mũi / ngày dự kiến / số bò / tình trạng; dòng nhắc lại | — |
| 10 | Vaccine reference / Tham chiếu vắc-xin | Chỉ đọc | — | Bệnh, liều, đường dùng, ngưng thịt | — |
| 11 | Stop schedule / Dừng lịch | Nút (lịch đã có) | — | Bắt buộc lý do (≤ 500, Q1); xác nhận MSG-FE09-02 | MSG-COM-06; thành công MSG-FE09-03 |
| 12 | Save schedule / Lưu lịch | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE09-01 |

### SCR-33 Ghi nhận tiêm

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Title / Tiêu đề | Chữ | — | "Ghi nhận tiêm – lịch · mũi" hoặc "– mã bò" | — | — |
| 2 | Vaccine / Vắc-xin | Dropdown | * | ACTIVE | Từ lịch | MSG-COM-06, MSG-FE18-08 |
| 3 | Batch number / Số lô | Ô chữ | * (Tiêm tại trại) | ≤ 50 | — | MSG-FE09-05 |
| 4 | Administered at / Thời điểm tiêm | Ngày giờ | * | Không tương lai, không trước ngày nhập đàn | Bây giờ | MSG-COM-07, MSG-COM-15 |
| 5 | Dose / Liều | Số + đơn vị | — | ml hoặc liều | Từ vắc-xin | MSG-COM-10 |
| 6 | Route / Đường dùng | Dropdown | — | Tiêm bắp / Tiêm dưới da / Uống / Nhỏ mũi / Khác | Từ vắc-xin | — |
| 7 | Withdrawal (days) / Ngưng thịt (ngày) | Số nguyên | — | 0–365; chỉ Tiêm tại trại; hiện ngày hết (chỉ đọc) | Từ vắc-xin | MSG-COM-10 |
| 8 | Vaccinator / Người tiêm | Dropdown hoặc chữ | — | Thành viên ACTIVE hoặc tên người ngoài ≤ 100 | — | MSG-COM-10 |
| 9 | Data source / Nguồn dữ liệu | Radio | * | Tiêm tại trại / Nhập lịch sử | Tiêm tại trại | — |
| 10 | Cattle, Pen / Bò, Chuồng | Dòng chỉ đọc | — | — | — | — |
| 11 | Result / Kết quả | Radio mỗi dòng | — | Tiêm / Hoãn | Tiêm | MSG-FE09-09, MSG-COM-13 |
| 12 | Deferral reason · new date / Lý do hoãn · ngày mới | Ô chữ + ngày | * lý do khi Hoãn | Lý do ≤ 500; ngày ≥ hôm nay | — | MSG-COM-06, MSG-FE09-11 |
| 13 | Summary / Tóm tắt | Chữ | — | Lịch, mũi, số ghi, số hoãn | — | — |
| 14 | Cancel / Save n vaccinations – Hủy / Lưu n mũi tiêm | Nút | — | — | — | MSG-COM-02; thành công MSG-FE09-04 |

### SCR-34 Tab Tiêm phòng (hồ sơ bò)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Record vaccination / Ghi nhận tiêm | Nút (Manager) → SCR-33 cho bò này |
| 2 | Scheduled doses / Mũi theo lịch | Lịch, mũi, ngày dự kiến, tình trạng (như SCR-31); "Ghi", "Hoãn" (Manager) |
| 3 | Administered at / Thời điểm tiêm | dd/mm/yyyy HH:mm, sắp xếp được |
| 4 | Vaccine · dose / Vắc-xin · mũi | Tên snapshot và số mũi |
| 5 | Batch · amount / Số lô · liều | — |
| 6 | Withdrawal until / Ngưng thịt đến | Ngày hết của bản ghi ON_FARM, hoặc "—" |
| 7 | Source / Nguồn | Tại trại / Lịch sử |
| 8 | Vaccinator / Người tiêm | Tên |
| 9 | Reaction / Phản ứng | Mã ca sức khỏe liên kết, hoặc "—" |
| 10 | Actions / Thao tác | "Sửa · Hủy" (Manager); dòng đã hủy hiện mờ |

### Popup Hoãn mũi

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Dose / Mũi | Chỉ đọc | — | Lịch, số mũi, ngày dự kiến; mã bò, chuồng | — |
| 2 | Reason for not vaccinating / Lý do chưa tiêm | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 3 | New expected date / Ngày dự kiến mới | Ngày | — | ≥ hôm nay | MSG-FE09-11 |
| 4 | Note / Ghi chú | Ô chữ | — | ≤ 255 | MSG-COM-10 |
| 5 | Cancel / Save deferral – Hủy / Lưu hoãn | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE09-06 |

### SCR-35 Lịch sử tiêm (toàn đàn)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Search / Tìm | Mã hiển thị hoặc số tai |
| 2 | Vaccine, Source / Vắc-xin, Nguồn | Dropdown |
| 3 | Period / Khoảng | Theo thời điểm tiêm; mặc định 3 tháng gần nhất |
| 4 | Cột | Thời điểm tiêm, Bò · chuồng, Vắc-xin · mũi, Số lô · liều, Nguồn, Người tiêm, Phản ứng; dòng Lịch sử hiện "Không rõ" cho chi tiết không biết |

### Popup Sửa / Hủy bản ghi tiêm

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Record / Bản ghi | Chỉ đọc | — | Bò, vắc-xin, thời điểm, số lô, người tiêm | — |
| 2 | Action / Hành động | Radio | * | Sửa bản ghi (mặc định) / Hủy bản ghi | — |
| 3 | Field / Current / New | Bảng | — | Vắc-xin, Số lô, Thời điểm tiêm, Liều, Đường dùng, Ngưng thịt (ngày), Người tiêm (chỉ khi Sửa); lưu xong tính lại ngày hết ngưng thịt | MSG-FE09-05, MSG-COM-07 |
| 4 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 5 | Cancel / Save | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE09-08 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách lịch + mũi | `tab? (ALL\|OVERDUE\|DUE_7\|UPCOMING\|DEFERRED\|DONE), scheduleId?, page, size` | `{schedules[{scheduleId, name, vaccine, doses, interval, done, total, overdue, status}], counts{…}, doses[{doseId, cattle, pen, scheduleName, doseNo, booster, plannedDate, newExpectedDate?, status, dueStatus, overdueDays?, version}]}` | COM-03 | `GET /api/farms/{farmId}/vaccination-schedules` (mũi theo tab: chưa có – Q2) |
| A2 | Xem trước bò khớp đối tượng | `penIds[], herdGroups[], lifeStages[]` | `{count, cattle[{cattleId, code, pen, recentSameVaccine}]}` | FE09-07 | chưa có – thêm `POST …/vaccination-schedules/preview` |
| A3 | Tạo lịch | `name, vaccineId, startDate, doses, daysBetween?, boosterMonths?, target {penIds, herdGroups, lifeStages}, cattleIds[] (đã chốt)` + `Idempotency-Key` | `{scheduleId, plannedDoses[{doseNo, date, cattleCount}]}` | FE09-07, FE09-10, FE18-08, COM-06, COM-10, COM-02 | `POST /api/farms/{farmId}/vaccination-schedules` |
| A4 | Sửa lịch | Như A3 + `version` | Như A3 | + COM-05 | `PUT …/vaccination-schedules/{scheduleId}` |
| A5 | Dừng lịch | `reason` + `If-Match` + `Idempotency-Key` | `{status: STOPPED, cancelledDoses}` | COM-06, COM-05 | `POST …/vaccination-schedules/{scheduleId}/stop` (cần thêm `reason`) |
| A6 | Ghi tiêm | `vaccineId, batchNo?, administeredAt, dose?, doseUnit?, route?, withdrawalDays?, vaccinatorId? \| vaccinatorName?, source, scheduleId?, doseNo?, items[{cattleId, doseId?, result: VACCINATE\|DEFER, deferReason?, newDate?, version}]` + `Idempotency-Key` | `{recorded, deferred, skipped[{cattleId, code}], records[{recordId, cattleId, withdrawalUntil?}]}` | FE09-05, FE09-09, FE09-11, FE18-08, COM-07, COM-15, COM-13, COM-17, COM-02 | `POST /api/farms/{farmId}/vaccinations` |
| A7 | Hoãn mũi | `reason, newDate?, note?, version` + `Idempotency-Key` | Mũi | COM-06, FE09-11, COM-05 | `POST /api/farms/{farmId}/scheduled-doses/{doseId}/defer` |
| A8 | Tab tiêm của một con | — | `{doses[…], history[{recordId, administeredAt, vaccineName, doseNo, batchNo, amount, withdrawalUntil, source, vaccinator, reactionCaseCode, status, corrected, version}]}` | COM-08 | chưa có riêng – thêm `GET /api/farms/{farmId}/cattle/{cattleId}/vaccinations` |
| A9 | Lịch sử toàn đàn | `search?, vaccineId?, source?, from?, to?, page, size` | Như A8 history + `cattle, pen` | COM-03 | `GET /api/farms/{farmId}/vaccinations/history` |
| A10 | Sửa bản ghi | `changes{…}, reason, version` + `Idempotency-Key` | Bản ghi + `withdrawalUntil` của bò | FE09-05, COM-06, COM-07, COM-05 | `POST …/vaccinations/{id}/correction` |
| A11 | Hủy bản ghi | `reason, version` + `Idempotency-Key` | Bản ghi + mũi đã khôi phục | COM-06, COM-05 | `POST …/vaccinations/{id}/void` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE09-01 | Toast thành công | Đã lưu lịch {name}: {doses} mũi cho {count} con. |
| MSG-FE09-02 | Hộp thoại xác nhận | Dừng lịch {name}? {count} mũi chưa tiêm hoặc đang hoãn sẽ bị hủy. Mũi đã tiêm được giữ lại. |
| MSG-FE09-03 | Toast thành công | Đã dừng lịch {name}. |
| MSG-FE09-04 | Toast thành công | Đã ghi {recorded} mũi tiêm; hoãn {deferred} mũi. |
| MSG-FE09-05 | Dưới trường | Tiêm tại trại bắt buộc có số lô. |
| MSG-FE09-06 | Toast thành công | Đã hoãn mũi{ đến {date}}. |
| MSG-FE09-07 | Trên form | Không có bò đang nuôi nào khớp đối tượng đã chọn. |
| MSG-FE09-08 | Toast thành công | Bản ghi tiêm đã được {action}. Giá trị gốc được giữ trong lịch sử. |
| MSG-FE09-09 | Trên dòng | {cattle_code} đã tiêm mũi {dose} của lịch này và được bỏ qua. |
| MSG-FE09-10 | Dưới trường | Đã có lịch đang hoạt động tên {name}. |
| MSG-FE09-11 | Dưới trường | Ngày mới phải từ hôm nay trở đi. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-09-01 | SCR-32 | Tên 101 ký tự; số mũi 0 / 11; khoảng 0 / 366; nhắc lại 61 | MSG-COM-10 | U, H | SCR-32 |
| TC-09-02 | Số mũi 2, không có khoảng | Lưu | MSG-COM-06 | U, H | SCR-32 |
| TC-09-03 | Có lịch ACTIVE "LMLM 2026" | Tạo lịch cùng tên / sau khi lịch cũ STOPPED | MSG-FE09-10 / được | I | R-09-03 |
| TC-09-04 | Chuồng A (10 bò) VÀ nhóm Vỗ béo (4 bò trong A) | Xem trước | 4 bò | I | SCR-32 |
| TC-09-05 | Đối tượng không khớp bò nào | Lưu | MSG-FE09-07 | I | R-09-01 |
| TC-09-06 | 4 bò, 2 mũi, bắt đầu 01/11, khoảng 21 ngày | Lưu | 8 mũi PLANNED: 01/11 và 22/11 | I | R-09-02 |
| TC-09-07 | Lịch đã lưu | Nhập đàn bò mới khớp tiêu chí | Bò mới không có mũi nào; MSG-FE06-05 gợi ý | I | R-09-01 |
| TC-09-08 | Lịch 2 mũi, mũi 1 đã DONE cho 4 bò | Đổi khoảng 21 → 28 | Mũi 2 thành 29/11; mũi 1 không đổi | I | R-09-05 |
| TC-09-09 | Như trên | Bỏ 1 bò khỏi đối tượng | Mũi 2 của bò đó CANCELLED; mũi 1 DONE giữ nguyên | I | R-09-05 |
| TC-09-10 | Lịch có 3 PLANNED, 1 DEFERRED, 4 DONE | Dừng có lý do | 4 CANCELLED, 4 DONE giữ; STOPPED; REM-06 tương ứng bị hủy | I | R-09-06 |
| TC-09-11 | Lịch 1 mũi, nhắc lại 6 tháng | Ghi mũi 1 ngày 01/11/2026 | Tạo mũi nhắc lại 01/05/2027 PLANNED | I | R-09-07 |
| TC-09-12 | Như trên, lịch đã STOPPED | Ghi mũi | Không tạo mũi nhắc lại | I | R-09-07 |
| TC-09-13 | Tiêm tại trại | Không có số lô | MSG-FE09-05 | U, H | R-09-08 |
| TC-09-14 | Nhập lịch sử | Không số lô, chỉ có tháng | Lưu được; không đóng mũi; không có ngày hết ngưng thịt | I | R-09-08 |
| TC-09-15 | Chọn 5 bò, 1 bò "Hoãn" có lý do | Lưu | 4 bản ghi, 4 mũi DONE, 1 mũi DEFERRED; MSG-FE09-04 "4 … 1" | I | R-09-09 |
| TC-09-16 | Như trên, lỗi ở bản ghi thứ 3 | Lưu | Không có bản ghi nào, không mũi nào đổi | I | R-09-09 |
| TC-09-17 | 1 trong 5 bò đã DONE mũi đó | Lưu | MSG-FE09-09 cho bò đó, 4 bò còn lại được ghi | I | R-09-10 |
| TC-09-18 | Bò có mũi PLANNED cùng vắc-xin | Ghi từ hồ sơ | Bản ghi liên kết mũi đó, mũi DONE | I | R-09-11 |
| TC-09-19 | Ngưng thịt 21 ngày, tiêm 01/11 | Lưu | Ngày hết 22/11; hồ sơ "Cách ly thịt đến 22/11/2026" | I | R-09-13 |
| TC-09-20 | Bò có điều trị hết ngưng 30/11 và tiêm hết 22/11 | Tính | 30/11 | U | R-09-13 |
| TC-09-21 | Hoãn mũi | Không lý do / ngày mới hôm qua | MSG-COM-06 / MSG-FE09-11 | U, H | R-09-12 |
| TC-09-22 | Mũi DEFERRED không có ngày mới | Mở SCR-31 | Mũi ở tab "Đã hoãn" | E | R-09-12 |
| TC-09-23 | Mũi DONE | Hoãn | MSG-COM-05 | I | R-09-12 |
| TC-09-24 | Bản ghi ON_FARM đóng mũi 2 | Hủy có lý do | Bản ghi VOIDED; mũi 2 về PLANNED; REM-06 khôi phục; ngày ngưng thịt tính lại | I | R-09-14 |
| TC-09-25 | Như trên, lịch đã STOPPED | Hủy | Mũi giữ CANCELLED | I | R-09-14 |
| TC-09-26 | Bản ghi có ca phản ứng liên kết | Hủy bản ghi | Ca vẫn liên kết, hiện "mũi tiêm đã bị hủy" | I | R-09-15 |
| TC-09-27 | Sửa ngưng thịt 21 → 30 | Lưu | Revision giữ 21; ngày hết của bò tính lại | I | R-09-14 |
| TC-09-28 | Owner / Technician | Gọi ghi tiêm / tạo lịch | 403 | H | R-09-16 |
| TC-09-29 | Hôm nay 05/11, nhắc trước 7 ngày | Mũi 10/11 / 13/11 / 04/11 chưa tiêm | Đến hạn / Sắp tới / Quá hạn 1 ngày | U | §3.2 |
| TC-09-30 | Đổi tên vắc-xin trong danh mục | Xem bản ghi cũ | Vẫn tên cũ (snapshot) | I | §3.3 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất | Quyết định (07/11/2026) |
|---|---|---|---|
| Q1 | Độ dài lý do dừng lịch: SRS không ghi | ≤ 500 | Theo đề xuất |
| Q2 | UC-FE09-01, 03, 04, 07 không có đặc tả Part II; luồng suy từ SCR | Chủ dự án xác nhận | Theo các màn hình SCR trong SRS 28/10 |
| Q3 | Sửa lịch đổi **vắc-xin** khi đã có mũi DONE có được không? | Không – dừng lịch và tạo lịch mới | Theo đề xuất |
| Q4 | "Gần đây" ở R-09-04 là bao nhiêu ngày? | Trong khoảng nhắc lại, mặc định 30 ngày | Theo đề xuất |
| Q5 | Mũi nhắc lại khi lịch có số mũi 1 và không có nhắc lại | Không tạo | Theo đề xuất |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS (thay spec mẫu FE-09 cũ); Route theo code hiện có | Claude (cho TuanPQ duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 07/11/2026 | 28/10/2026 | Chốt các câu hỏi mục 10 (cột Quyết định), ghi tại `OPEN_QUESTIONS.md` | Tuấn |
