# SPEC FE-18 – Danh mục trại và tham số tham chiếu

| | |
|---|---|
| Feature | FE-18 Farm Master Data and Reference Configuration |
| Use case | UC-FE18-01 → UC-FE18-17 |
| Người phụ trách | AnNT (BE + FE + test) · Review BE: TuanPQ · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Breed, Vaccine, Medicine, Production Purpose, Farm Parameter Version), BR-D12, BR-D32, Part II §14.1 (UC-FE18-17), Part III §18 (Table III-6, SCR-52 → SCR-56), MSG-FE18-01 → 09, GBR-25, 55, 63, 67, 68, 109 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.
> Danh mục thức ăn (Feed item) thuộc FE-23; FE-18 chỉ tạo sẵn mặt hàng mẫu khi tạo trại (GBR-109).

---

## 1. Phạm vi

| Nhóm | UC | Tên | Màn hình |
|---|---|---|---|
| Giống | UC-FE18-01 → 04 | Xem, tạo, sửa, ngưng / dùng lại giống | SCR-52 |
| Vắc-xin | UC-FE18-05 → 08 | Xem, tạo, sửa, ngưng / dùng lại, xóa vắc-xin chưa dùng | SCR-53 |
| Thuốc tham chiếu | UC-FE18-09 → 12 | Xem, tạo, sửa, ngưng / dùng lại | SCR-54 |
| Mục đích nuôi | UC-FE18-13 → 16 | Xem, tạo, sửa, ngưng / dùng lại | SCR-55 |
| Tham số | UC-FE18-17 | Lưu phiên bản tham số trạng thái và nhắc việc | SCR-56 |

Tất cả nằm trên **một trang** "Danh mục & tham số" với 5 tab, mặc định mở tab Giống. Mỗi danh mục có danh sách, ô tìm, lọc trạng thái (Tất cả / ACTIVE / INACTIVE) và panel chỉnh sửa.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem giống, vắc-xin, thuốc | Có | Có | Có |
| Xem mục đích nuôi, tham số | Có | Có | — (Q1) |
| Tạo, sửa, ngưng / dùng lại, xóa vắc-xin chưa dùng | Có | Có | — |
| Lưu phiên bản tham số | Có | Có | — |

Trại ACTIVE (PRE-1).

---

## 3. Dữ liệu

### 3.1 Giống (Breed)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Mã | Chuỗi | Có | 2–20 ký tự: chữ in hoa, số, "-"; duy nhất trong danh mục trại; chỉ đọc khi đã được tham chiếu | SCR-52, BR-D12 |
| Tên giống | Chuỗi | Có | ≤ 100 | SCR-52 |
| Nhóm | Chuỗi | Không | ≤ 50 (Zebu, Lai, Địa phương…) | SCR-52 |
| Mô tả | Chuỗi dài | Không | ≤ 500 | SCR-52 |
| Trạng thái | Enum | — | `ACTIVE` ⇄ `INACTIVE`; đã tham chiếu → không xóa | §3.2 |
| Số bò đang nuôi | Suy ra | — | Bò ACTIVE thuộc giống | SCR-52 |

### 3.2 Vắc-xin (Vaccine)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| Mã | Chuỗi | Có | Như giống |
| Tên | Chuỗi | Có | ≤ 150 |
| Bệnh phòng | Chuỗi | Có | ≤ 150 |
| Nhà sản xuất | Chuỗi | Không | ≤ 100 |
| Liều tham chiếu | Chuỗi | Không | ≤ 50 (ví dụ "2 ml") |
| Đường tiêm | Enum | Không | Tiêm bắp / Tiêm dưới da / Uống / Nhỏ mũi / Khác |
| Khoảng cách mũi nhắc (ngày) | Số nguyên | Không | 0–730 |
| Ngưng thịt (ngày) | Số nguyên | Không | 0–365; mặc định 0 |
| Trạng thái | Enum | — | `ACTIVE` ⇄ `INACTIVE`; chưa từng tham chiếu → xóa được |
| Đang dùng | Suy ra | — | Số lịch + bản ghi tham chiếu, hoặc "Chưa dùng" |
| Nhãn "Hoàn thiện từ nhãn" | Suy ra | — | Khi thiếu liều hoặc đường tiêm |

### 3.3 Thuốc tham chiếu (Medicine)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| Mã | Chuỗi | Có | Như giống |
| Tên thuốc | Chuỗi | Có | ≤ 150 (Q2) |
| Liều tham chiếu | Chuỗi | Không | ≤ 100 (ví dụ "1 ml/10 kg thể trọng") |
| Đường dùng | Enum | Không | Tiêm bắp / Tiêm dưới da / Tiêm tĩnh mạch / Uống / Bôi ngoài da / Khác |
| Ngưng thịt (ngày) | Số nguyên | **Có** | 0–365 |
| Ghi chú | Chuỗi dài | Không | ≤ 500 |
| Trạng thái | Enum | — | `ACTIVE` ⇄ `INACTIVE`; đã tham chiếu không xóa |

Chỉ tham chiếu: không tồn kho, không mua, không kê đơn.

### 3.4 Mục đích nuôi (Production Purpose)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| Mã | Chuỗi | Có | Như giống |
| Tên mục đích | Chuỗi | Có | ≤ 100 |
| Loại mục đích | Enum | Có | `BREEDING` Sinh sản / `FATTENING` Vỗ béo / `SIRE` Đực giống / `UNDECIDED` Chưa xác định; **cố định khi đã tham chiếu** bởi bò hoặc phiên bản tiêu chí chuồng (BR-D32) |
| Mô tả | Chuỗi dài | Không | ≤ 500 (Q3) |
| Trạng thái | Enum | — | `ACTIVE` ⇄ `INACTIVE`; ngưng chỉ chặn chọn mới |
| Số bò đang nuôi, Chuồng tiếp nhận | Suy ra | — | Chuồng có tiêu chí chấp nhận loại mục đích |

Nhiều mục đích có thể cùng 1 loại.

### 3.5 Phiên bản tham số trại (SCR-56)

| Nhóm | Tham số | Kiểu | Khoảng | Mặc định |
|---|---|---|---|---|
| Giai đoạn | Tuổi cai sữa (tháng) | Số nguyên | 3–12 | 6 |
| | Tuổi bò tơ (tháng) | Số nguyên | 6–24 | 12 |
| | Tuổi trưởng thành (tháng) | Số nguyên | 15–48 | 24 |
| Điều kiện phối | Tuổi tối thiểu phối (tháng) | Số nguyên | 6–36 | 13 |
| | Cân tối thiểu phối (kg) | Số | 100–600 | 230 |
| Mang thai và khám | Thời gian mang thai (ngày) | Số nguyên | 270–300 | 283 |
| | Khám thai sau phối (ngày) | Số nguyên | 25–90 | 28 |
| | Khám lại sau không rõ (ngày) | Số nguyên | 7–60 | 14 |
| | Chuẩn bị đẻ trước (ngày) | Số nguyên | 1–60 | 30 |
| | Khoảng sau đẻ trước khi phối (ngày) | Số nguyên | 20–120 | 45 |
| Cửa sổ phối | Bắt đầu sau động dục (giờ) | Số nguyên | 0–24 | 8 |
| | Kết thúc sau động dục (giờ) | Số nguyên | 1–36, > bắt đầu | 12 |
| | Chu kỳ động dục (ngày) | Số nguyên | 17–25 | 21 |
| Tăng trưởng và tiêm | Thang BCS | Enum | 1–5 bước 0,5 / 1–9 bước 1 | 1–5 |
| | Chu kỳ cân (ngày) | Số nguyên | 7–180 | 30 |
| | Nhắc tiêm trước (ngày) | Số nguyên | 1–30 | 7 |
| | Cân xuất chuồng mục tiêu (kg) | Số, không bắt buộc | 150–900 | 450; để trống → tắt dự báo xuất chuồng và REM-13 |
| Lưu | Ghi chú nguồn | Chuỗi | ≤ 255, bắt buộc | — |
| | Hiệu lực từ | Ngày | Hôm nay hoặc sau | Hôm nay |
| Hệ thống | Số phiên bản, người tạo, thời điểm | — | — | — |

Ràng buộc chéo: tuổi cai sữa < tuổi bò tơ < tuổi trưởng thành; giờ kết thúc > giờ bắt đầu.

### 3.6 Danh mục mẫu khi tạo trại (Table III-6, GBR-109)

| Danh mục | Mã · tên | Loại / nhóm | Giá trị ban đầu |
|---|---|---|---|
| Mục đích | MD-SS · Bò cái sinh sản | BREEDING | ACTIVE |
| Mục đích | MD-VB · Vỗ béo | FATTENING | ACTIVE |
| Mục đích | MD-DG · Đực giống | SIRE | ACTIVE |
| Mục đích | MD-CXD · Chưa xác định | UNDECIDED | ACTIVE; mục đích mặc định của bê sinh tại trại |
| Giống | VANG · Bò Vàng Việt Nam | Địa phương | ACTIVE nếu được chọn là giống chính khi đăng ký trại, ngược lại INACTIVE |
| Giống | LAISIND · Lai Sind | Lai | Như trên |
| Giống | ZEBU-D · Zebu đỏ | Lai Zebu | Như trên |
| Giống | BRAHMAN-D · Brahman đỏ | Zebu | Như trên |
| Giống | BRAHMAN-T · Brahman trắng | Zebu | Như trên |
| Giống | DROUGHT · Droughtmaster | Lai | Như trên |
| Giống | F1-BBB · F1 BBB × Lai Sind | Lai | Như trên |
| Giống | F1-CHA · F1 Charolais × Lai Sind | Lai | Như trên |
| Giống | F1-ANG · F1 Red Angus × Lai Sind | Lai | Như trên |
| Vắc-xin | VX-LMLM · Lở mồm long móng | LMLM | ACTIVE; liều, đường, mũi nhắc trống; ngưng thịt 0 |
| Vắc-xin | VX-THT · Tụ huyết trùng | THT | Như trên |
| Vắc-xin | VX-VDNC · Viêm da nổi cục | VDNC | Như trên |
| Vắc-xin | VX-NT · Nhiệt thán | Nhiệt thán | INACTIVE |
| Thức ăn | TA-01 → TA-09 | — | Theo FE-23 |
| Thuốc | Không tạo sẵn | — | Liều và ngưng thịt phụ thuộc sản phẩm |
| Tham số | Phiên bản 1 | — | Giá trị mặc định §3.5 |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-18-01 | Mã duy nhất trong từng danh mục của trại → MSG-FE18-02. Mã chỉ đọc khi đã được tham chiếu. | GBR-67, BR-D12, SCR-52 |
| R-18-02 | Mục đã tham chiếu chỉ ngưng, không xóa; ngưng mục đã tham chiếu → hộp xác nhận MSG-FE18-03 (số bản ghi). | GBR-67 |
| R-18-03 | Vắc-xin chưa từng tham chiếu → xóa được (MSG-FE18-07); đã dùng → MSG-FE18-04. | GBR-67 |
| R-18-04 | Sửa mục **không** viết lại bản ghi cũ; bản ghi cũ giữ snapshot tên. | GBR-67 |
| R-18-05 | Mục INACTIVE không chọn được cho bản ghi mới → MSG-FE18-08 (áp dụng ở mọi dropdown của FE khác). | GBR-67 |
| R-18-06 | Loại mục đích chỉ đọc khi mục đích đã được bò hoặc phiên bản tiêu chí chuồng tham chiếu → MSG-FE18-09. | GBR-67, BR-D32 |
| R-18-07 | Vắc-xin thiếu liều / đường vẫn dùng được cho lịch và bản ghi; khi đó người dùng nhập liều, đường ở bản ghi; danh sách hiện nhãn "Hoàn thiện từ nhãn". | SCR-53 |
| R-18-08 | Tham số lưu thành **phiên bản mới** có ghi chú nguồn, ngày hiệu lực, người tạo; phiên bản cũ chỉ đọc. | GBR-68, UC-17 |
| R-18-09 | Phiên bản chỉ ảnh hưởng nhắc việc / gợi ý đánh giá sau thời điểm hiệu lực; sự kiện đã ghi **không đổi**. | GBR-68 |
| R-18-10 | Mỗi giá trị trong khoảng §3.5; tuổi giai đoạn tăng dần; giờ kết thúc > giờ bắt đầu → MSG-FE18-06. | UC-17 E1 |
| R-18-11 | Hiệu lực ngay → kích hoạt JOB-01 tính lại nhắc việc tương lai; hiệu lực tương lai → lưu dạng đã lên lịch, JOB-01 áp dụng vào ngày đó. | UC-17 bước 5, AF1 |
| R-18-12 | Để trống cân xuất chuồng mục tiêu → tắt dự báo xuất chuồng và REM-13. | SCR-56, GBR-107 |
| R-18-13 | Gợi ý không bao giờ tự tạo sự kiện hay đổi trạng thái (ghi chú trên SCR-56). | OR-06, GBR-25 |
| R-18-14 | Tạo trại → tạo danh mục mẫu + tham số mặc định; mục mẫu là mục thường của trại, sửa không ảnh hưởng trại khác. | GBR-109 |
| R-18-15 | Lưu dùng Idempotency-Key; sửa / lưu phiên bản dùng version → đổi ở phiên khác MSG-COM-05. | GBR-88, GBR-89 |

---

## 5. Luồng xử lý

### UC-FE18-02 / 06 / 10 / 14 Tạo mục danh mục
1. Owner / Manager chọn **Thêm …** → panel chỉnh sửa trống.
2. Nhập trường → **Lưu** → kiểm R-18-01, độ dài, khoảng.
3. Lưu ACTIVE → MSG-FE18-01.
E1 trùng mã → MSG-FE18-02 · E2 thiếu → MSG-COM-06 · E3 sai định dạng / vượt độ dài → MSG-COM-10.

### UC-FE18-03 / 07 / 11 / 15 Sửa
Chọn dòng → panel với giá trị hiện tại (mã chỉ đọc nếu đã tham chiếu; loại mục đích chỉ đọc nếu đã tham chiếu) → **Lưu** → MSG-FE18-01. Bản ghi cũ giữ snapshot.

### UC-FE18-04 / 08 / 12 / 16 Ngưng / dùng lại / xóa
Đổi trạng thái → nếu đã tham chiếu: MSG-FE18-03 → xác nhận → lưu. Vắc-xin: **Xóa** → chưa dùng: MSG-FE18-07 → xóa; đã dùng: MSG-FE18-04.

### UC-FE18-17 Lưu phiên bản tham số
1. SCR-56 hiện phiên bản hiện tại, nguồn, lịch sử.
2. Người dùng sửa giá trị theo nhóm.
3. Nhập ghi chú nguồn, ngày hiệu lực (mặc định hôm nay) → **Lưu phiên bản mới**.
4. Kiểm R-18-10, version.
5. Lưu; hiệu lực ngay → JOB-01 tính lại.
6. MSG-FE18-05.

AF1 ngày tương lai → lưu dạng đã lên lịch · AF2 xem phiên bản cũ (chỉ đọc) · AF3 hủy → không đổi.
E1 ngoài khoảng / thứ tự sai → MSG-FE18-06 · E2 thiếu ghi chú nguồn → MSG-COM-06 · E3 đổi ở phiên khác → MSG-COM-05 · E4 lỗi → MSG-COM-02.

---

## 6. Màn hình và trường

### SCR-52 Danh mục giống

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Add breed / Thêm giống | Nút (O, M) | — | — | — | — |
| 2 | Search, Status filter / Tìm, Trạng thái | Ô chữ, chip | — | Tất cả / ACTIVE / INACTIVE | Tất cả | — |
| 3 | Code / Mã | Cột | — | — | — | — |
| 4 | Breed name / Tên giống | Cột | — | Kèm mô tả | — | — |
| 5 | Group, Cattle in herd, Status / Nhóm, Bò đang nuôi, Trạng thái | Cột | — | Bò đang nuôi = số bò ACTIVE | — | — |
| **Panel** | | | | | | |
| 6 | Code / Mã | Ô chữ | * | 2–20, `[A-Z0-9-]`; chỉ đọc khi đã tham chiếu | — | MSG-COM-06, MSG-COM-10, MSG-FE18-02 |
| 7 | Breed name / Tên giống | Ô chữ | * | ≤ 100 | — | MSG-COM-06, MSG-COM-10 |
| 8 | Group / Nhóm | Ô chữ | — | ≤ 50 | — | MSG-COM-10 |
| 9 | Description / Mô tả | Ô chữ dài | — | ≤ 500 | — | MSG-COM-10 |
| 10 | Status / Trạng thái | Toggle | — | ACTIVE / INACTIVE | ACTIVE | MSG-FE18-03 |
| 11 | Cancel / Save – Hủy / Lưu | Nút | — | — | — | Thành công MSG-FE18-01 |

### SCR-53 Danh mục vắc-xin

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Add vaccine / Thêm vắc-xin | Nút (O, M) | — | — | — | — |
| 2 | Cột danh sách | Cột | — | Mã, Tên, Bệnh phòng, Liều · đường, Đang dùng (số lịch + bản ghi hoặc "Chưa dùng"), Trạng thái; nhãn "Hoàn thiện từ nhãn" | — | — |
| 3 | Code / Mã | Ô chữ | * | Như giống | — | MSG-FE18-02 |
| 4 | Name / Tên | Ô chữ | * | ≤ 150 | — | MSG-COM-06 |
| 5 | Disease prevented / Bệnh phòng | Ô chữ | * | ≤ 150 | — | MSG-COM-06 |
| 6 | Manufacturer / Nhà sản xuất | Ô chữ | — | ≤ 100 | — | MSG-COM-10 |
| 7 | Reference dose / Liều tham chiếu | Ô chữ | — | ≤ 50 | — | MSG-COM-10 |
| 8 | Route / Đường tiêm | Dropdown | — | Tiêm bắp / Dưới da / Uống / Nhỏ mũi / Khác | — | — |
| 9 | Booster interval (days) / Mũi nhắc sau (ngày) | Số nguyên | — | 0–730 | — | MSG-COM-10 |
| 10 | Withdrawal (days) / Ngưng thịt (ngày) | Số nguyên | — | 0–365 | 0 | MSG-COM-10 |
| 11 | Status / Trạng thái | Toggle | — | — | ACTIVE | MSG-FE18-03 |
| 12 | Delete / Xóa | Nút | — | Chỉ hiện / bật khi chưa tham chiếu | — | MSG-FE18-07 / MSG-FE18-04 |
| 13 | Cancel / Save | Nút | — | Bản ghi cũ giữ snapshot tên | — | MSG-FE18-01 |

### SCR-54 Danh mục thuốc tham chiếu

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Add medicine / Thêm thuốc | Nút (O, M) | — | — | — | — |
| 2 | Cột danh sách | Cột | — | Mã, Tên thuốc, Liều tham chiếu, Đường dùng, Ngưng thịt (ngày), Trạng thái | — | — |
| 3 | Code / Mã | Ô chữ | * | Như giống | — | MSG-FE18-02 |
| 4 | Medicine name / Tên thuốc | Ô chữ | * | ≤ 150 (Q2) | — | MSG-COM-06 |
| 5 | Reference dose / Liều tham chiếu | Ô chữ | — | ≤ 100 | — | MSG-COM-10 |
| 6 | Route / Đường dùng | Dropdown | — | Tiêm bắp / Dưới da / Tĩnh mạch / Uống / Bôi / Khác | — | — |
| 7 | Meat withdrawal (days) / Ngưng thịt (ngày) | Số nguyên | * | 0–365 | — | MSG-COM-06, MSG-COM-10 |
| 8 | Notes / Ghi chú | Ô chữ dài | — | ≤ 500 | — | MSG-COM-10 |
| 9 | Status / Trạng thái | Toggle | — | — | ACTIVE | MSG-FE18-03 |
| 10 | Cancel / Save | Nút | — | — | — | MSG-FE18-01 |

### SCR-55 Danh mục mục đích nuôi

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Add purpose / Thêm mục đích | Nút (O, M) | — | — | — | — |
| 2 | Cột danh sách | Cột | — | Mã, Tên, Loại mục đích, Bò đang nuôi, Chuồng tiếp nhận, Trạng thái | — | — |
| 3 | Code / Mã | Ô chữ | * | Như giống | — | MSG-FE18-02 |
| 4 | Name / Tên mục đích | Ô chữ | * | ≤ 100 | — | MSG-COM-06 |
| 5 | Purpose type / Loại mục đích | Dropdown | * | Sinh sản / Vỗ béo / Đực giống / Chưa xác định; chỉ đọc khi đã tham chiếu | — | MSG-FE18-09 |
| 6 | Description / Mô tả | Ô chữ dài | — | ≤ 500 (Q3) | — | MSG-COM-10 |
| 7 | Status / Trạng thái | Toggle | — | Ngưng chỉ chặn chọn mới | ACTIVE | MSG-FE18-03 |
| 8 | Note / Ghi chú | Chữ | — | Đổi mục đích của từng con do Owner làm trong popup "Cập nhật hồ sơ bò" | — | — |

### SCR-56 Tham số trạng thái và nhắc việc

| # | Trường | Loại | Bắt buộc | Ràng buộc / Mặc định | Lỗi |
|---|---|---|---|---|---|
| 1 | Current version / Phiên bản hiện tại | Chỉ đọc | — | Số phiên bản, ngày hiệu lực, ghi chú nguồn, người tạo | — |
| 2 | Version history / Lịch sử phiên bản | Nút | — | Danh sách chỉ đọc: thay đổi, ngày, người | — |
| 3–19 | 17 tham số | Số / Dropdown | * (trừ cân mục tiêu) | Theo §3.5 | MSG-FE18-06 |
| 20 | Source note / Ghi chú nguồn | Ô chữ | * | ≤ 255 | MSG-COM-06 |
| 21 | Effective from / Hiệu lực từ | Ngày | * | ≥ hôm nay; mặc định hôm nay | MSG-COM-10 |
| 22 | Save new version / Lưu phiên bản mới | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE18-05 |
| 23 | Decision-support note / Ghi chú hỗ trợ quyết định | Chữ | — | "Gợi ý không bao giờ tự tạo sự kiện hay đổi trạng thái." | — |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Tổng hợp danh mục | — | `{breeds[], vaccines[], medicines[], purposes[]}` (dùng cho dropdown FE khác) | — | `GET /api/farms/{farmId}/catalogues` |
| A2 | Giống: danh sách / tạo / sửa | `q?, status?` / `BreedWrite {code, name, group?, description?, status, version?}` + `Idempotency-Key` | `[BreedView {…, cattleInHerd, referenced}]` / `BreedView` | FE18-02, COM-06, COM-10, COM-05 | `GET` / `POST /api/farms/{farmId}/catalogues/breeds` · `PUT …/breeds/{id}` |
| A3 | Vắc-xin: danh sách / tạo / sửa | — / `VaccineCommand {code, name, disease, manufacturer?, referenceDose?, route?, boosterDays?, withdrawalDays, status, version?}` + `Idempotency-Key` | `[CatalogueItem {…, inUse{schedules, records}, completeFromLabel}]` | FE18-02, COM-06, COM-10, COM-05 | `GET` / `POST /api/farms/{farmId}/vaccines` · `PUT …/vaccines/{vaccineId}` |
| A4 | Xóa vắc-xin chưa dùng | `If-Match` (version) + `Idempotency-Key` | `true` | FE18-04, COM-05 | `DELETE /api/farms/{farmId}/vaccines/{vaccineId}` |
| A5 | Thuốc: danh sách / tạo / sửa | — / `MedicineCommand {code, name, referenceDose?, route?, withdrawalDays, notes?, status, version?}` + `Idempotency-Key` | `CatalogueItem` | FE18-02, COM-06, COM-10, COM-05 | `GET` / `POST /api/farms/{farmId}/medicines` · `PUT …/medicines/{medicineId}` |
| A6 | Mục đích: danh sách / tạo / sửa | `q?, status?` / `PurposeWrite {code, name, purposeType, description?, status, version?}` + `Idempotency-Key` | `[PurposeView {…, cattleInHerd, receivingPens[], referenced}]` | FE18-02, FE18-09, COM-06, COM-05 | `GET` / `POST /api/farms/{farmId}/catalogues/production-purposes` · `PUT …/{id}` |
| A7 | Kiểm trước khi ngưng | — | `{referencedCount}` để hiện MSG-FE18-03 | — | Chưa có riêng – trả `referencedCount` trong view A2, A3, A5, A6 |
| A8 | Tham số hiệu lực | `date?` | `{version, effectiveFrom, sourceNote, author, values{…}}` | — | `GET /api/farms/{farmId}/parameters/effective` |
| A9 | Lịch sử phiên bản | — | `[ParameterVersionResult {version, effectiveFrom, sourceNote, author, createdAt, changes[{key, from, to}], scheduled}]` | — | `GET /api/farms/{farmId}/parameters/versions` |
| A10 | Lưu phiên bản mới | `ParameterVersionCommand {values{…17}, sourceNote, effectiveFrom, baseVersion}` + `Idempotency-Key` | `ParameterVersionResult` | FE18-06, COM-06, COM-05, COM-02 | `POST /api/farms/{farmId}/parameters/versions` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE18-01 | Toast thành công | Đã lưu {item}. |
| MSG-FE18-02 | Dưới trường | Mã {code} đã tồn tại trong danh mục này. |
| MSG-FE18-03 | Hộp xác nhận | {item} đang được dùng bởi {count} bản ghi. Mục này sẽ không còn chọn được cho bản ghi mới; các bản ghi hiện có không đổi. |
| MSG-FE18-04 | Trong hộp thoại | Vắc-xin này đã được sử dụng nên không thể xóa. Hãy ngưng sử dụng. |
| MSG-FE18-05 | Toast thành công | Đã lưu phiên bản tham số v{version}, hiệu lực từ {date}. |
| MSG-FE18-06 | Dưới trường | {parameter} phải từ {min} đến {max}. |
| MSG-FE18-07 | Hộp xác nhận | Xóa vắc-xin {item}? Vắc-xin này chưa từng được sử dụng. |
| MSG-FE18-08 | Dưới trường | {item} đã ngưng sử dụng, không thể chọn cho bản ghi mới. |
| MSG-FE18-09 | Dưới trường | Không thể đổi loại mục đích vì mục đích này đang được {count} con bò hoặc tiêu chí chuồng sử dụng. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-18-01 | Technician | Gọi tạo / sửa danh mục, lưu tham số | 403 | H | §2 |
| TC-18-02 | Mã "lai-sind" | Lưu | MSG-COM-10 (phải in hoa) | U, H | R-18-01 |
| TC-18-03 | Mã "A" / 21 ký tự | Lưu | MSG-COM-10 | U | R-18-01 |
| TC-18-04 | Đã có LAISIND | Tạo giống LAISIND | MSG-FE18-02 | I | R-18-01 |
| TC-18-05 | Trại A và trại B | Cùng tạo mã X | Cả hai thành công | I | R-18-01 |
| TC-18-06 | Giống đã có bò | Sửa mã | Mã chỉ đọc / BE từ chối | E, H | R-18-01 |
| TC-18-07 | Giống có 12 bò | Ngưng | MSG-FE18-03 (12); sau xác nhận INACTIVE; 12 bò giữ giống | I, E | R-18-02 |
| TC-18-08 | Giống INACTIVE | Chọn ở phiếu nhập đàn | MSG-FE18-08 | I | R-18-05 |
| TC-18-09 | Đổi tên giống "Lai Sind" → "Lai Sind F1" | Lưu | Bản ghi cũ vẫn hiện "Lai Sind" (snapshot) | I | R-18-04 |
| TC-18-10 | Vắc-xin chưa dùng | Xóa | MSG-FE18-07 → xóa | I | R-18-03 |
| TC-18-11 | Vắc-xin có 1 lịch | Xóa | MSG-FE18-04 | I | R-18-03 |
| TC-18-12 | VX-LMLM thiếu liều | Xem danh sách / dùng trong lịch | Nhãn "Hoàn thiện từ nhãn"; lịch vẫn tạo được | I, E | R-18-07 |
| TC-18-13 | Mũi nhắc 731 / ngưng thịt 366 | Lưu | MSG-COM-10 | U | §3.2 |
| TC-18-14 | Thuốc không có ngưng thịt | Lưu | MSG-COM-06 | U, H | §3.3 |
| TC-18-15 | Mục đích có bò | Đổi loại BREEDING → FATTENING | MSG-FE18-09 | I | R-18-06 |
| TC-18-16 | Mục đích chưa dùng | Đổi loại | Thành công | I | R-18-06 |
| TC-18-17 | Mục đích dùng trong tiêu chí chuồng, chưa có bò | Đổi loại | MSG-FE18-09 | I | R-18-06 |
| TC-18-18 | Tuổi cai sữa 13 | Lưu tham số | MSG-FE18-06 (3–12) | U | R-18-10 |
| TC-18-19 | Cai sữa 12, bò tơ 12 | Lưu | MSG-FE18-06 (thứ tự tăng) | U | R-18-10 |
| TC-18-20 | Giờ bắt đầu 12, kết thúc 10 | Lưu | MSG-FE18-06 | U | R-18-10 |
| TC-18-21 | Thiếu ghi chú nguồn | Lưu | MSG-COM-06 | U, H | UC-17 E2 |
| TC-18-22 | Ngày hiệu lực hôm qua | Lưu | Lỗi | U, H | §3.5 |
| TC-18-23 | Đổi chu kỳ cân 30 → 45, hiệu lực hôm nay | Lưu | v mới; MSG-FE18-05; JOB-01 chạy: REM-01 tương lai theo 45 ngày; cân đã ghi không đổi | I | R-18-09, R-18-11 |
| TC-18-24 | Hiệu lực ngày 01/12 | Lưu | Phiên bản "đã lên lịch"; nhắc việc trước 01/12 vẫn theo bản cũ | I | R-18-11 |
| TC-18-25 | Xóa cân mục tiêu | Lưu | Không còn REM-13 mới, không dự báo xuất chuồng | I | R-18-12 |
| TC-18-26 | 2 người cùng sửa từ v3 | Người sau lưu | MSG-COM-05 | I | R-18-15 |
| TC-18-27 | Tạo trại mới, chọn giống chính LAISIND | Đăng ký trại | 4 mục đích ACTIVE, LAISIND ACTIVE, giống khác INACTIVE, 3 vắc-xin ACTIVE + Nhiệt thán INACTIVE, không có thuốc, tham số v1 mặc định | I | R-18-14 |
| TC-18-28 | Sửa mục mẫu ở trại A | — | Trại B không đổi | I | R-18-14 |
| TC-18-29 | Xem phiên bản cũ | Mở lịch sử | Chỉ đọc | E | UC-17 AF2 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Technician có xem SCR-55, SCR-56 không? (SRS nói SCR-55 "Owner or a Manager"; SCR-52 → 54 "farm members") | Technician chỉ xem giống, vắc-xin, thuốc |
| Q2 | SCR-54 không nêu mã và tên thuốc | Mã như giống; tên ≤ 150 như vắc-xin |
| Q3 | SCR-55 không có trường Mô tả dù entity có | Thêm Mô tả ≤ 500 |
| Q4 | Có xóa giống / thuốc / mục đích chưa dùng không? | Không – SRS chỉ cho xóa vắc-xin chưa dùng |
| Q5 | Tham số "Chuẩn bị đẻ trước" (30) dùng cho REM-05; "Khám thai sau phối" (28) cho REM-03 – xác nhận REM dùng tham số thay hằng số | Có – Table III-3 ghi giá trị mặc định |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho AnNT duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
