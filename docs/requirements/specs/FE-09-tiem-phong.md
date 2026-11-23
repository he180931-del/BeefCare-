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
| UC-FE09-02 | Tạo lịch tiêm | Owner, Manager | SCR-32 |
| UC-FE09-03 | Sửa lịch tiêm / thêm bớt bò | Owner, Manager | SCR-32 |
| UC-FE09-04 | Dừng lịch tiêm | Owner, Manager | SCR-32 |
| UC-FE09-05 | Ghi nhận tiêm (một con, cả lô, hoặc tiêm lịch sử) | Owner, Manager | SCR-33 |
| ~~UC-FE09-06~~ | ~~Hoãn mũi tiêm~~ – bỏ theo D46 (bò chưa tiêm được thì sửa lịch để bỏ con đó ra) | — | — |
| UC-FE09-07 | Xem lịch sử tiêm | Owner, Manager, Technician | SCR-34, SCR-35 |
| UC-FE09-08 | Sửa / xóa bản ghi tiêm | Owner, Manager | Popup Sửa bản ghi tiêm, popup Xóa mũi tiêm (D53) |

**Liên quan:** danh mục vắc-xin (FE-18); bản ghi tiêm HISTORICAL tạo khi nhập đàn (FE-06); phản ứng sau tiêm là ca sức khỏe liên kết (FE-10 UC-FE10-02); nhắc REM-06 (FE-14); cách ly thịt hiển thị ở FE-05, cảnh báo ở FE-13.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem lịch, mũi, lịch sử | Có | Có | Có |
| Tạo / sửa / dừng lịch, ghi tiêm, sửa / xóa bản ghi | Có (D41) | Có | — (có thể được chọn là người tiêm) |

Cần trại ACTIVE (GBR-08). Bò EXITED / VOIDED / trên phiếu chết PENDING không nhận bản ghi mới (GBR-26).

---

## 3. Dữ liệu

### 3.1 Lịch tiêm (Vaccination Schedule)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Tên lịch | Chuỗi | Có | ≤ 100; duy nhất trong các lịch ACTIVE của trại | SCR-32 |
| Vắc-xin | Danh mục | Có | ACTIVE | SCR-32 |
| Ngày tiêm (D50, trước là "Ngày bắt đầu") | Ngày | Có | Ngày dự kiến của mũi 1 | SCR-32 |
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
| Ngày dự kiến | Mũi k = ngày tiêm + (k − 1) × số ngày giữa các mũi |
| Trạng thái | `PLANNED` (chờ tiêm) → `DONE` / `CANCELLED`. Không còn `DEFERRED` (D46); dữ liệu hoãn cũ đã chuyển về PLANNED với hạn = ngày hẹn mới |
| Bản ghi tiêm hoàn thành mũi | Mỗi mũi được hoàn thành bởi tối đa 1 bản ghi ON_FARM (BR-D17) |
| Tình trạng hạn **suy ra** | Đến hạn (trong số ngày nhắc trước – tham số trại VACCINATION_LEAD_DAYS, mặc định 7), Quá hạn (qua hạn mà chưa DONE), còn lại là chưa đến hạn (không có tab riêng – D46) (GBR-43) |

### 3.3 Bản ghi tiêm (Vaccination Record)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Bò | Tham chiếu | Có | Mỗi bò một bản ghi | GBR-42 |
| Vắc-xin + tên snapshot | Danh mục | Có | ACTIVE; tên lưu snapshot (sửa danh mục sau không đổi) | §3.2 |
| Thời điểm tiêm | Ngày giờ | Có (ON_FARM) | Không tương lai, không trước ngày nhập đàn (trừ HISTORICAL) | BR-D14 |
| ~~Số lô~~ | — | — | Bỏ khỏi giao diện (D44); cột `batch_no` giữ dữ liệu cũ, API nhận tùy chọn ≤ 50 | — |
| Liều | Số + đơn vị (ml hoặc liều) | Không | Điền sẵn từ vắc-xin | SCR-33 |
| Đường dùng | Enum | Không | Tiêm bắp / Tiêm dưới da / Uống / Nhỏ mũi / Khác | SCR-33 |
| Ngày ngưng thịt | Số nguyên | Không (chỉ ON_FARM) | 0–365; điền sẵn từ vắc-xin, sửa được | SCR-33 |
| Ngày hết ngưng thịt | Suy ra | — | Ngày tiêm + số ngày (chỉ ON_FARM) | GBR-46 |
| Người tiêm | Thành viên ACTIVE hoặc tên người ngoài | Không | Tên ngoài ≤ 100 | SCR-33 |
| Nguồn | Enum | Có | `ON_FARM` (mặc định) / `HISTORICAL` | GBR-42 |
| Nguồn thông tin | Chuỗi | Không | Cho HISTORICAL | §3.2 |
| Mũi theo lịch | Tham chiếu | Không | Chỉ ON_FARM mới đóng mũi | GBR-42 |
| Thời điểm ghi | Hệ thống | Có | — | BR-D14 |
| Trạng thái | Enum | — | `VALID` → `VOIDED` khi xóa (xóa mềm, không cần lý do – D53); sửa giữ VALID + "Đã sửa" | GBR-44 |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-09-01 | Đối tượng lịch được chốt thành danh sách bò ACTIVE cụ thể khi lưu; không có bò nào → MSG-FE09-07. Bò mới vào đàn sau đó **không** tự vào lịch; chỉ vào khi Owner hoặc Manager thêm (UC-FE09-03). | GBR-41, GBR-32 |
| R-09-02 | Lưu lịch tạo đúng 1 mũi PLANNED cho mỗi bò × số mũi, trong một transaction; sau đó đánh giá REM-06 (JOB-01). | GBR-41, BR-D17 |
| R-09-03 | Tên lịch trùng một lịch ACTIVE → MSG-FE09-10. Vắc-xin ngưng → MSG-FE18-08. | SCR-32, UC-02 E2 |
| R-09-04 | Bò đã tiêm cùng vắc-xin gần đây được đánh dấu trong danh sách; Manager tự quyết giữ hay bỏ. | UC-02 AF1 |
| R-09-05 | Sửa lịch chỉ ảnh hưởng mũi **chưa tiêm** (PLANNED); mũi DONE không bao giờ đổi. Khóa (D46): lịch **đã hoàn thành** (ACTIVE nhưng không còn mũi PLANNED) hoặc STOPPED không sửa được gì; lịch đã có mũi DONE không đổi vắc-xin, ngày bắt đầu, khoảng cách giữa mũi; số mũi không giảm dưới mũi đã tiêm. Bò thêm vào lịch có ngày bắt đầu đã qua: mũi 1 hạn hôm nay. | GBR-41, D46 |
| R-09-06 | Dừng lịch: bắt buộc lý do, xác nhận MSG-FE09-02; mọi mũi PLANNED → CANCELLED; mũi DONE giữ nguyên; lịch STOPPED. | GBR-41, SCR-32 |
| R-09-07 | Nhắc lại: khi ghi mũi cuối của loạt (hoặc một mũi nhắc lại) và lịch còn ACTIVE → tạo mũi nhắc lại tiếp theo vào ngày tiêm + số tháng nhắc lại. | UC-02 AF3 |
| R-09-08 | Ghi tiêm ON_FARM bắt buộc vắc-xin, thời điểm (không có số lô – D44); HISTORICAL có thể thiếu thời điểm chính xác, **không** đóng mũi theo lịch và **không** tính ngưng thịt. | GBR-42, UC-05 AF2, D44 |
| R-09-09 | Ghi theo lô: mỗi bò được chọn một bản ghi (không còn lựa chọn "Hoãn" – D46). Tất cả lưu trong **một transaction**: bản ghi, mũi DONE, tính lại ngày mũi kế, ngày hết ngưng thịt, dòng thời gian. Lỗi → không lưu gì. | GBR-42, UC-05 bước 7, E6 |
| R-09-10 | Mũi đã DONE cho một bò → MSG-FE09-09, bỏ qua bò đó; bò đã EXITED trong lúc đó → MSG-COM-13, bỏ qua. | UC-05 E3, E5 |
| R-09-11 | Ghi từ hồ sơ một con: bò có mũi PLANNED khớp vắc-xin → tự liên kết. | UC-05 AF1 |
| ~~R-09-12~~ | Bỏ theo D46: không còn hoãn mũi. Bò chưa tiêm được thì sửa lịch để bỏ con đó ra (mũi chưa tiêm CANCELLED) hoặc tạo lịch mới cho nhóm đó. | D46 |
| R-09-13 | Ngày hết ngưng thịt của bò = ngày lớn nhất trong các điều trị VALID và bản ghi tiêm ON_FARM VALID; còn ≥ hôm nay thì hiện "Cách ly thịt đến …". | GBR-46 |
| R-09-14 | Sửa / xóa bản ghi (D53): sửa có ghi chú không bắt buộc (≤ 500), xóa chỉ cần xác nhận; giữ giá trị gốc (Record Revision); kiểm version. Bản ghi đã xóa (VOIDED) không còn trong lịch sử tiêm (SCR-34, SCR-35). Xóa bản ghi ON_FARM → mũi quay về PLANNED, trừ khi lịch đã STOPPED (khi đó CANCELLED); nhắc việc khôi phục. Sau sửa / xóa tính lại ngày hết ngưng thịt. | GBR-44, BR-D15 |
| R-09-15 | Ca sức khỏe phản ứng sau tiêm giữ liên kết khi bản ghi tiêm bị xóa và hiện rằng mũi tiêm đã bị hủy. | UC-08 AF2, GBR-47 |
| R-09-16 | Owner và Manager ghi / sửa / xóa bản ghi / quản lý lịch (D41); Technician xem. | GBR-08 |

---

## 5. Luồng xử lý

### UC-FE09-02 Tạo lịch
SCR-32 → tên, vắc-xin (hiện bệnh, liều, đường dùng, ngưng thịt tham chiếu), ngày tiêm, số mũi, số ngày giữa mũi, nhắc lại → chọn đối tượng (chuồng, nhóm đàn, giai đoạn) → hệ thống hiện số bò khớp và danh sách (bỏ / thêm từng con) → bảng mũi dự kiến → **Lưu lịch** → R-09-01 → R-09-03 → R-09-02 → MSG-FE09-01.

### UC-FE09-03 Sửa lịch
Mở lịch ACTIVE chưa hoàn thành ở SCR-32 → đổi thông tin / đối tượng → **Lưu lịch** → áp R-09-05: bò thêm mới nhận mũi PLANNED (mũi 1 hạn hôm nay nếu ngày bắt đầu đã qua); bò bị bỏ → mũi chưa tiêm CANCELLED; đổi ngày / khoảng cách (chỉ khi chưa có mũi tiêm) hoặc số mũi → tính lại mũi chưa tiêm → MSG-FE09-01. Lịch đã hoàn thành chỉ xem (D46).

### UC-FE09-04 Dừng lịch
SCR-32 → **Dừng lịch** → lý do → xác nhận MSG-FE09-02 → R-09-06 → MSG-FE09-03.

### UC-FE09-05 Ghi tiêm
1. SCR-33: lịch và mũi (nếu bắt đầu từ lịch), các bò đã chọn (mã, chuồng).
2. Xác nhận / chọn vắc-xin, thời điểm (mặc định bây giờ), liều, đường dùng, ngày ngưng thịt (điền sẵn), người tiêm, nguồn "Tiêm tại trại".
3. Mọi bò được chọn đều ghi "Tiêm"; con nào chưa tiêm được thì bỏ chọn (D46).
4. Tóm tắt (số tiêm) → **Lưu n mũi tiêm** → kiểm → R-09-09 → JOB-01 → MSG-FE09-04.

AF1 một con từ hồ sơ (R-09-11) · AF2 tiêm lịch sử (R-09-08) · AF3 phản ứng sau tiêm → mở ca sức khỏe liên kết (FE-10) · AF4 Hủy.

### ~~UC-FE09-06 Hoãn mũi~~
Bỏ theo D46.

### UC-FE09-01 / 07 Xem
SCR-31 (thẻ lịch, tab mũi theo tình trạng hạn, danh sách mũi) · SCR-34 (tab hồ sơ) · SCR-35 (lịch sử toàn đàn).

### UC-FE09-08 Sửa / xóa bản ghi (D53)
- **Sửa** → popup Sửa bản ghi tiêm (vắc-xin, thời điểm, liều, đường dùng, ngày ngưng thịt, người tiêm, ghi chú không bắt buộc) → **Lưu** → R-09-14 → MSG-FE09-08.
- **Xóa** → popup xác nhận "Xóa mũi tiêm?" → **Xóa** → bản ghi rời lịch sử tiêm, mũi theo lịch quay lại chưa tiêm (R-09-14).

---

## 6. Màn hình và trường

### SCR-31 Lịch tiêm

| # | Trường | Loại | Hiện với | Nội dung |
|---|---|---|---|---|
| 1 | Vaccination history / Lịch sử tiêm | Nút | Tất cả | Mở SCR-35 |
| 2 | Manage schedules / Quản lý lịch | Nút | Owner, Manager | Mở SCR-32 |
| 3 | Record vaccination / Ghi nhận tiêm | Nút | Owner, Manager | Mở SCR-33 cho các mũi đã chọn |
| 4 | Schedule card / Thẻ lịch | Thẻ | Tất cả | Tên, vắc-xin, số mũi, khoảng cách. Chỉ lịch **đang chạy**; lịch đã hoàn thành gom vào mục đóng / mở "Lịch đã hoàn thành (n)", chọn thẻ để xem lại mũi đã tiêm. Chưa chọn lịch thì danh sách mũi không gồm lịch đã hoàn thành (D48) |
| 5 | Progress / Tiến độ | Chữ | | "Đã tiêm x / y" và "n quá hạn" hoặc "Đúng tiến độ" |
| 6 | Dose tabs / Tab mũi | Tab | | Tất cả, Quá hạn, Đến hạn trong N ngày (N = tham số trại "Thời gian nhắc tiêm"), Đã tiêm – có số. Bỏ Sắp tới và Đã hoãn (D46) |
| 6a | Filters / Bộ lọc | Ô chữ + 2 dropdown | Tất cả | Như màn chọn bò vào phiếu (D47): Tìm kiếm (mã / tên bò), Chuồng, Nhóm đàn – kết hợp VÀ; áp cho bảng và số đếm trên tab; bỏ lọc bằng "Tất cả chuồng" / "Tất cả nhóm" |
| 7 | Select / Chọn | Checkbox | Owner, Manager | Chọn từng mũi để ghi theo lô. Ô đầu cột **Chọn tất cả** (D47): chọn mọi mũi chưa tiêm khớp lịch + tab + bộ lọc, kể cả trang chưa xem; chỉ bật khi các mũi đó cùng một vắc-xin (đang xem tất cả lịch thì tắt, gợi ý chọn một lịch). Chọn tay lẫn vắc-xin thì báo và khóa nút Ghi nhận; có "Bỏ chọn" |
| 8 | Cattle / Bò | Cột | | Mã hiển thị, giống, giới tính |
| 9 | Pen / Chuồng | Cột | | Mã – tên |
| 10 | Schedule · Dose / Lịch · Mũi | Cột | | Ví dụ "LMLM 2026 · mũi 2/2" hoặc "nhắc lại" |
| 11 | Planned date / Ngày dự kiến | Cột | | dd/mm/yyyy, sắp xếp được |
| 12 | Status / Tình trạng | Huy hiệu | | Quá hạn n ngày / Đến hạn dd/mm / Sắp tới / Đã tiêm dd/mm |
| 13 | Actions / Thao tác | Nút | Owner, Manager | "Ghi" → SCR-33 với mũi đó. Thẻ lịch hiện "Đã hoàn thành" khi không còn mũi chờ tiêm (D46) |

### SCR-32 Quản lý lịch tiêm

Đầu màn (D48): dropdown "Lịch tiêm" (nhóm Đang chạy / Đã hoàn thành, chỉ hiện nhóm có lịch; chưa chọn → "Chọn lịch tiêm") + nút "⊕ Tạo lịch mới" cùng cỡ, cùng hàng; tạo mới tiêu đề "Tạo lịch tiêm", nút "Lưu lịch"; sửa → "Lưu thay đổi"; lịch đã hoàn thành chỉ xem, ẩn nút lưu và Dừng.

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Schedule name / Tên lịch | Ô chữ | * | ≤ 100; duy nhất trong lịch ACTIVE | MSG-COM-06, MSG-FE09-10 |
| 2 | Vaccine / Vắc-xin | Dropdown | * | Vắc-xin ACTIVE | MSG-COM-06, MSG-FE18-08 |
| 3 | Start date / Ngày tiêm | Ngày | * | Ngày dự kiến mũi 1 (D50) | MSG-COM-06 |
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
| 3 | ~~Batch number / Số lô~~ | — | — | Bỏ theo D44 | — | — |
| 4 | Administered at / Thời điểm tiêm | Ngày giờ | * | Không tương lai, không trước ngày nhập đàn | Bây giờ | MSG-COM-07, MSG-COM-15 |
| 5 | Dose / Liều | Số + đơn vị | — | Số dương (dấu chấm hoặc phẩy), đơn vị ml hoặc liều; từ chối 0, số âm, chữ, khoảng "1-2" (D45) | Từ vắc-xin | MSG-COM-10 |
| 6 | Route / Đường dùng | Dropdown | — | Tiêm bắp / Tiêm dưới da / Uống / Nhỏ mũi / Khác; chọn **Khác** thì hiện ô "Đường tiêm khác" **bắt buộc**, ≤ 255 ký tự, lưu đúng mô tả đã nhập (D45) | Từ vắc-xin | MSG-COM-06 |
| 7 | Withdrawal (days) / Ngưng thịt (ngày) | Số nguyên | — | 0–365, không nhận số thập phân; **để trống = 0 ngày** (D45); chỉ Tiêm tại trại; hiện ngày hết (chỉ đọc) | Từ vắc-xin | MSG-COM-10 |
| 8 | Vaccinator / Người tiêm | Dropdown hoặc chữ | — | Thành viên ACTIVE hoặc tên người ngoài ≤ 100 | — | MSG-COM-10 |
| 9 | Data source / Nguồn dữ liệu | Radio | * | Tiêm tại trại / Nhập lịch sử | Tiêm tại trại | — |
| 10 | Cattle, Pen / Bò, Chuồng | Dòng chỉ đọc | — | — | — | — |
| 11 | Dose / Mũi | Chữ mỗi dòng | — | Lịch · mũi của con đó, hoặc "Ngoài lịch" (không còn lựa chọn Hoãn – D46) | — | MSG-FE09-09, MSG-COM-13 |
| 12 | ~~Deferral reason · new date~~ | — | — | Bỏ theo D46 | — | — |
| 13 | Summary / Tóm tắt | Chữ | — | Lịch, mũi, số ghi | — | — |
| 14 | Cancel / Save n vaccinations – Hủy / Lưu n mũi tiêm | Nút | — | — | — | MSG-COM-02; thành công MSG-FE09-04 |

### SCR-34 Tab Tiêm phòng (hồ sơ bò)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Record vaccination / Ghi nhận tiêm | Nút (Owner, Manager) → SCR-33 cho bò này |
| 2 | Scheduled doses / Mũi theo lịch | Lịch, mũi, hạn tiêm, tình trạng (như SCR-31); "Ghi" (Owner, Manager) |
| 3 | Administered at / Thời điểm tiêm | dd/mm/yyyy HH:mm, sắp xếp được |
| 4 | Vaccine · dose / Vắc-xin · mũi | Tên snapshot và số mũi |
| 5 | Amount / Liều | — |
| 6 | Withdrawal until / Ngưng thịt đến | Ngày hết của bản ghi ON_FARM, hoặc "—" |
| 7 | Source / Nguồn | Tại trại / Lịch sử |
| 8 | Vaccinator / Người tiêm | Tên |
| 9 | Reaction / Phản ứng | Mã ca sức khỏe liên kết, hoặc "—" |
| 10 | Actions / Thao tác | Hai nút "Sửa" và "Xóa" (Owner, Manager), như lịch sử đo FE-08; bản ghi đã xóa không hiện (D53) |

### ~~Popup Hoãn mũi~~

Bỏ theo D46.

### SCR-35 Lịch sử tiêm (toàn đàn)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Search / Tìm | Mã hiển thị hoặc số tai |
| 2 | Vaccine, Source / Vắc-xin, Nguồn | Dropdown |
| 3 | Period / Khoảng | Theo thời điểm tiêm; mặc định 3 tháng gần nhất |
| 4 | Cột | Thời điểm tiêm, Bò · chuồng, Vắc-xin · mũi, Liều, Nguồn, Người tiêm, Phản ứng; dòng Lịch sử hiện "Không rõ" cho chi tiết không biết; bản ghi đã xóa không hiện (D53) |

### Popup Sửa bản ghi tiêm (D53)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Record / Bản ghi | Chỉ đọc | — | Bò, vắc-xin, thời điểm, người tiêm | — |
| 2 | Field / Current / New | Bảng | — | (ràng buộc Liều, Đường dùng, Ngưng thịt như popup ghi – D45) Vắc-xin, Thời điểm tiêm, Liều, Đường dùng, Ngưng thịt (ngày), Người tiêm; lưu xong tính lại ngày hết ngưng thịt | MSG-COM-07 |
| 3 | Note / Ghi chú | Ô chữ dài | — | ≤ 500; điền sẵn ghi chú của lần sửa gần nhất | MSG-COM-10 |
| 4 | Cancel / Save | Nút | — | — | MSG-COM-05, MSG-COM-02 (popup – D49); thành công MSG-FE09-08 |

### Popup Xóa mũi tiêm (D53)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Title / Tiêu đề | "Xóa mũi tiêm?" · mã bò · thời điểm · vắc-xin, mũi · liều |
| 2 | Message / Nội dung | "Mũi tiêm này sẽ không còn trong lịch sử tiêm (và mũi theo lịch quay lại chưa tiêm)." |
| 3 | Cancel / Delete | "Hủy" / "Xóa" (nút đỏ); lỗi MSG-COM-05 hiện popup (D49); thành công "Đã xóa bản ghi tiêm." |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách lịch + mũi | `tab? (ALL\|OVERDUE\|DUE\|DONE), scheduleId?, page, size` (D46) | `{schedules[{scheduleId, name, vaccine, doses, interval, done, total, overdue, status}], counts{…}, doses[{doseId, cattle, pen, scheduleName, doseNo, booster, plannedDate, status, dueStatus, overdueDays?, version}]}`; lịch có `completed` (D46) | COM-03 | `GET /api/farms/{farmId}/vaccination-schedules` (mũi theo tab: chưa có – Q2) |
| A2 | Xem trước bò khớp đối tượng | `penIds[], herdGroups[], lifeStages[]` | `{count, cattle[{cattleId, code, pen, recentSameVaccine}]}` | FE09-07 | chưa có – thêm `POST …/vaccination-schedules/preview` |
| A3 | Tạo lịch | `name, vaccineId, startDate, doses, daysBetween?, boosterMonths?, target {penIds, herdGroups, lifeStages}, cattleIds[] (đã chốt)` + `Idempotency-Key` | `{scheduleId, plannedDoses[{doseNo, date, cattleCount}]}` | FE09-07, FE09-10, FE18-08, COM-06, COM-10, COM-02 | `POST /api/farms/{farmId}/vaccination-schedules` |
| A4 | Sửa lịch | Như A3 + `version` | Như A3 | + COM-05 (`reason`: schedule_completed, start_date_locked_after_done, interval_locked_after_done, vaccine_change_after_done – D46) | `PUT …/vaccination-schedules/{scheduleId}` |
| A5 | Dừng lịch | `reason` + `If-Match` + `Idempotency-Key` | `{status: STOPPED, cancelledDoses}` | COM-06, COM-05 | `POST …/vaccination-schedules/{scheduleId}/stop` (body `{reason}`, phiên bản qua `If-Match`; lý do lưu ở `stopReason`) |
| A6 | Ghi tiêm | `vaccineId, administeredAt, dose?, doseUnit?, route?, withdrawalDays?, vaccinatorId? \| vaccinatorName?, source, scheduleId?, doseNo?, items[{cattleId, doseId?, version}]` + `Idempotency-Key` | `{recorded, skipped[{cattleId, code}], records[{recordId, cattleId, withdrawalUntil?}]}` | FE09-09, FE18-08, COM-07, COM-15, COM-13, COM-17, COM-02 | `POST /api/farms/{farmId}/vaccinations` |
| ~~A7~~ | ~~Hoãn mũi~~ – bỏ theo D46 (route trả 404) | — | — | — | — |
| A8 | Tab tiêm của một con | — | `{doses[…], history[{recordId, administeredAt, vaccineName, doseNo, batchNo, amount, withdrawalUntil, source, vaccinator, reactionCaseCode, status, corrected, version}]}` | COM-08 | chưa có riêng – thêm `GET /api/farms/{farmId}/cattle/{cattleId}/vaccinations` |
| A9 | Lịch sử toàn đàn | `search?, vaccineId?, source?, from?, to?, page, size` | Như A8 history + `cattle, pen` | COM-03 | `GET /api/farms/{farmId}/vaccinations/history` |
| A10 | Sửa bản ghi | `changes{…}, reason?` (ghi chú ≤ 500, có thể null – D53)`, version` + `Idempotency-Key` | Bản ghi + `withdrawalUntil` của bò | FE09-05, COM-07, COM-10, COM-05 | `POST …/vaccinations/{id}/correction` |
| A11 | Xóa bản ghi (xóa mềm) | `version` (`reason` không bắt buộc – D53) + `Idempotency-Key` | Bản ghi + mũi đã khôi phục | COM-05 | `POST …/vaccinations/{id}/void` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE09-01 | Toast thành công | Đã lưu lịch {name}: {doses} mũi cho {count} con. |
| MSG-FE09-02 | Hộp thoại xác nhận | Dừng lịch {name}? {count} mũi chưa tiêm sẽ bị hủy. Mũi đã tiêm được giữ lại. |
| MSG-FE09-03 | Toast thành công | Đã dừng lịch {name}. |
| MSG-FE09-04 | Toast thành công | Đã ghi nhận {recorded} mũi tiêm. |
| MSG-FE09-05 | — | Bỏ theo D44 (không còn số lô). |
| MSG-FE09-06 | — | Bỏ theo D46. |
| MSG-FE09-07 | Trên form | Không có bò đang nuôi nào khớp đối tượng đã chọn. |
| MSG-FE09-08 | Toast thành công | Bản ghi tiêm đã được {action}. Giá trị gốc được giữ trong lịch sử. |
| MSG-FE09-09 | Trên dòng | {cattle_code} đã tiêm mũi {dose} của lịch này và được bỏ qua. |
| MSG-FE09-10 | Dưới trường | Đã có lịch đang hoạt động tên {name}. |
| MSG-FE09-11 | — | Bỏ theo D46. |

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
| TC-09-08 | Lịch 2 mũi chưa ai tiêm / mũi 1 đã DONE cho 4 bò | Đổi khoảng 21 → 28 | Chưa tiêm: mũi 2 dời theo khoảng mới / Đã tiêm: MSG-COM-05 (`interval_locked_after_done`), không đổi gì | I | R-09-05, D46 |
| TC-09-09 | Như trên | Bỏ 1 bò khỏi đối tượng | Mũi 2 của bò đó CANCELLED; mũi 1 DONE giữ nguyên | I | R-09-05 |
| TC-09-10 | Lịch có 4 PLANNED, 4 DONE | Dừng có lý do | 4 CANCELLED, 4 DONE giữ; STOPPED; REM-06 tương ứng bị hủy | I | R-09-06 |
| TC-09-11 | Lịch 1 mũi, nhắc lại 6 tháng | Ghi mũi 1 ngày 01/11/2026 | Tạo mũi nhắc lại 01/05/2027 PLANNED | I | R-09-07 |
| TC-09-12 | Như trên, lịch đã STOPPED | Ghi mũi | Không tạo mũi nhắc lại | I | R-09-07 |
| TC-09-13 | Tiêm tại trại | Không nhập số lô (màn ghi không còn ô số lô) | Ghi thành công; bản ghi lưu số lô rỗng | U, H | R-09-08, D44 |
| TC-09-14 | Nhập lịch sử | Chỉ có tháng | Lưu được; không đóng mũi; không có ngày hết ngưng thịt | I | R-09-08 |
| TC-09-15 | Chọn 5 bò ở màn ghi tiêm | Lưu | 5 bản ghi, 5 mũi DONE; MSG-FE09-04 "5"; không có lựa chọn Hoãn | I | R-09-09, D46 |
| TC-09-16 | Như trên, lỗi ở bản ghi thứ 3 | Lưu | Không có bản ghi nào, không mũi nào đổi | I | R-09-09 |
| TC-09-17 | 1 trong 5 bò đã DONE mũi đó | Lưu | MSG-FE09-09 cho bò đó, 4 bò còn lại được ghi | I | R-09-10 |
| TC-09-18 | Bò có mũi PLANNED cùng vắc-xin | Ghi từ hồ sơ | Bản ghi liên kết mũi đó, mũi DONE | I | R-09-11 |
| TC-09-19 | Ngưng thịt 21 ngày, tiêm 01/11 | Lưu | Ngày hết 22/11; hồ sơ "Cách ly thịt đến 22/11/2026" | I | R-09-13 |
| TC-09-20 | Bò có điều trị hết ngưng 30/11 và tiêm hết 22/11 | Tính | 30/11 | U | R-09-13 |
| TC-09-21 | Lịch đã tiêm xong hết (không còn mũi PLANNED) | Mở SCR-32 / gửi sửa lịch | Nhãn "Đã hoàn thành", ô bị khóa / MSG-COM-05 (`schedule_completed`) | U, I | R-09-05, D46 |
| TC-09-22 | Lịch bắt đầu 01/10, hôm nay 23/11 | Thêm 1 bò vào lịch | Mũi 1 của bò đó hạn 23/11 (không quá hạn ngay) | I | R-09-05, D46 |
| TC-09-23 | Dữ liệu cũ có mũi DEFERRED hẹn 24/11 | Chạy migration D46 | Mũi PLANNED, hạn 24/11, version tăng | I | D46 |
| TC-09-24 | Bản ghi ON_FARM đóng mũi 2 | Xóa (chỉ xác nhận) | Bản ghi VOIDED, không còn trong lịch sử tiêm; mũi 2 về PLANNED; REM-06 khôi phục; ngày ngưng thịt tính lại | I | R-09-14 |
| TC-09-25 | Như trên, lịch đã STOPPED | Hủy | Mũi giữ CANCELLED | I | R-09-14 |
| TC-09-26 | Bản ghi có ca phản ứng liên kết | Xóa bản ghi | Ca vẫn liên kết, hiện "mũi tiêm đã bị hủy" | I | R-09-15 |
| TC-09-27 | Sửa ngưng thịt 21 → 30 | Lưu | Revision giữ 21; ngày hết của bò tính lại | I | R-09-14 |
| TC-09-28 | Technician | Gọi ghi tiêm / tạo lịch | 403 | H | R-09-16 |
| TC-09-29 | Hôm nay 05/11, tham số nhắc trước 10 ngày | Mũi 12/11 / 22/11 / 01/11 chưa tiêm | Đến hạn (tab "Đến hạn trong 10 ngày") / chỉ ở Tất cả / Quá hạn 4 ngày | U | §3.2, D46 |
| TC-09-30 | Đổi tên vắc-xin trong danh mục | Xem bản ghi cũ | Vẫn tên cũ (snapshot) | I | §3.3 |
| TC-09-31 | Owner, trại ACTIVE | Tạo lịch, ghi tiêm một con và theo lô, sửa / xóa bản ghi tiêm | Thành công như Manager; người ghi = Owner | H, I, E | R-09-16, D41 |

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
| 22/11/2026 | 28/10/2026 | D44: bỏ số lô khỏi ghi tiêm, popup sửa, bảng lịch sử và hợp đồng A6; gỡ MSG-FE09-05; viết lại TC-09-13 | Tuấn |
| 23/11/2026 | 28/10/2026 | D45: liều số dương, đường tiêm "Khác" bắt buộc mô tả, ngưng thịt để trống = 0 và không nhận số thập phân | Tuấn |
| 23/11/2026 | 28/10/2026 | D46: bỏ hoãn mũi (UC-FE09-06, R-09-12, popup Hoãn, A7, MSG-FE09-06/11); lịch đã hoàn thành bị khóa; khóa vắc-xin / ngày bắt đầu / khoảng cách khi đã có mũi tiêm; bò thêm vào lịch đã bắt đầu có mũi 1 từ hôm nay; tab còn Tất cả · Quá hạn · Đến hạn trong N ngày · Đã tiêm | Tuấn |
| 23/11/2026 | 28/10/2026 | D47: SCR-31 thêm bộ lọc (tìm kiếm, chuồng, nhóm đàn) và "Chọn tất cả" mũi chưa tiêm theo bộ lọc; chặn ghi lẫn vắc-xin | Tuấn |
| 23/11/2026 | 28/10/2026 | D48: lịch đã hoàn thành rời hàng thẻ SCR-31, gom vào mục "Lịch đã hoàn thành"; SCR-32 tách nhóm Đang chạy / Đã hoàn thành | Tuấn |
| 23/11/2026 | 28/10/2026 | D50: SCR-32 "Ngày bắt đầu" → "Ngày tiêm"; ô số (Số mũi, Cách giữa mũi, Nhắc lại sau, Ngưng thịt) gõ sai báo lỗi dưới ô, không coi là trống | Tuấn |
