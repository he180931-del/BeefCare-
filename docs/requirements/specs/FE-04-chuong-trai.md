# SPEC FE-04 – Quản lý chuồng

| | |
|---|---|
| Feature | FE-04 Pen Management |
| Use case | UC-FE04-01 → UC-FE04-05 |
| Người phụ trách | AnNT (BE + FE + test) · Review BE: TuanPQ · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Pen, Pen Reception Criteria), §3.3 (BR-D09, BR-D12), Part II §4, Part III §4 (SCR-17, 3 popup), MSG-FE04, GBR-19 → 22, 24, 26 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 03.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE04-01 | Xem chuồng và mức lấp đầy | Owner, Manager, Technician (chỉ xem) | SCR-17 |
| UC-FE04-02 | Tạo chuồng | Owner, Manager | Popup Tạo / Sửa chuồng |
| UC-FE04-03 | Sửa thông tin chuồng | Owner, Manager | Popup Tạo / Sửa chuồng |
| UC-FE04-04 | Ngưng / dùng lại chuồng | Owner, Manager | Popup Ngưng / Dùng lại chuồng |
| UC-FE04-05 | Chuyển bò sang chuồng khác | Owner, Manager | Popup Chuyển chuồng (mở từ SCR-17, SCR-20, SCR-44) |

**Liên quan:** xếp chuồng lần đầu khi nhập đàn (FE-06, cũng kiểm sức chứa và tiêu chí), lịch sử chuồng của một con (SCR-20, FE-05), gợi ý chuyển chuồng REM-08 (FE-14).

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem chuồng, chi tiết, bò trong chuồng | Có | Có | Có (chỉ xem) |
| Tạo, sửa, ngưng / dùng lại chuồng | Có | Có | — |
| Chuyển chuồng | Có | Có | — |

Mọi thao tác ghi cần trại ACTIVE (GBR-14).

---

## 3. Dữ liệu

### 3.1 Chuồng (Pen)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Mã chuồng | Chuỗi | Có | 1–20 ký tự: chữ, số, `-`; duy nhất trong trại | Popup, GBR-19 |
| Tên chuồng | Chuỗi | Có | ≤ 100 | Popup |
| Sức chứa | Số nguyên | Có | 1–9.999; khi sửa không nhỏ hơn số con hiện tại | Popup, GBR-19 |
| Mô tả | Chuỗi dài | Không | ≤ 500 | Popup |
| Trạng thái | Enum | Có | `ACTIVE ⇄ INACTIVE`, mỗi lần đổi có ngày hiệu lực và lý do; tạo mới mặc định `ACTIVE` | §3.2 |
| Số con hiện tại | Số **suy ra** | — | Số phân chuồng đang mở | §3.2 |
| Phiên bản tiêu chí hiện tại | Tham chiếu | — | — | §3.2 |

Chuồng đã có lịch sử xếp bò **không bao giờ bị xóa**, chỉ chuyển INACTIVE.

### 3.2 Tiêu chí nhận bò (Pen Reception Criteria) – có phiên bản

| Thuộc tính | Ràng buộc |
|---|---|
| Chuồng, số phiên bản (duy nhất trong chuồng), hiệu lực từ, người đổi | Phiên bản mới áp dụng cho lần xếp và gợi ý **sau này** |
| Loại mục đích chấp nhận | Chọn nhiều: Sinh sản, Vỗ béo, Đực giống, Chưa xác định |
| Giai đoạn chấp nhận | Chọn nhiều: Bê chưa cai sữa, Bê đã cai sữa, Bò tơ, Trưởng thành |
| Giới tính | Đực / Cái |
| Tuổi tối thiểu (tháng) | Số nguyên 0–240 |
| Cân tối thiểu (kg) | Số 1–1.500 |

Mỗi loại tiêu chí tối đa 1 lần; không có tiêu chí nào = nhận mọi bò.

### 3.3 Phân chuồng (pen assignment – chi tiết của bò)

| Thuộc tính | Ràng buộc |
|---|---|
| Bò, chuồng, từ ngày, đến ngày (trống = đang mở) | Mỗi bò tối đa 1 phân chuồng đang mở; các khoảng không chồng nhau (BR-D09) |
| Người thực hiện, lý do | Lý do bắt buộc khi chuyển |
| Lý do cảnh báo | Bắt buộc khi bò không đạt tiêu chí chuồng đích |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-04-01 | Mã chuồng duy nhất trong trại; trùng → MSG-FE04-02. | GBR-19 |
| R-04-02 | Sức chứa là số nguyên ≥ 1 và không nhỏ hơn số con hiện tại → MSG-FE04-03. | GBR-19 |
| R-04-03 | Xếp / chuyển vào chuồng INACTIVE hoặc làm vượt sức chứa → **chặn** (MSG-FE04-05). | GBR-20 |
| R-04-04 | Ngưng chuồng không di chuyển bò đang ở trong chuồng. | GBR-20 |
| R-04-05 | Tiêu chí chỉ mang tính **khuyến nghị**: bò không đạt → cảnh báo MSG-FE04-06, người dùng phải nhập lý do mới tiếp tục; lý do lưu theo từng phân chuồng bị ảnh hưởng. | GBR-21 |
| R-04-06 | Sửa tiêu chí tạo phiên bản mới hiệu lực từ hôm nay; không ảnh hưởng phân chuồng đã có. | GBR-21 |
| R-04-07 | Chuyển chuồng: đóng phân chuồng hiện tại tại ngày chuyển và mở phân chuồng mới **trong một transaction**; cập nhật số con hai chuồng và lịch sử; giải quyết REM-08 liên quan. Lỗi → không đổi gì. | GBR-22, UC-05 bước 6, E5 |
| R-04-08 | Ngày chuyển không sớm hơn ngày bắt đầu phân chuồng hiện tại và không sau hôm nay → MSG-FE04-09. | GBR-22 |
| R-04-09 | Chuyển nhầm được sửa bằng một lần chuyển ngược với lý do "Correction" (Sửa nhầm); không sửa / xóa lịch sử cũ. | GBR-22, UC-05 AF2 |
| R-04-10 | Chỉ chuyển bò ACTIVE; bò EXITED / VOIDED chỉ đọc (MSG-COM-13); bò đang trên phiếu chết / mất tích PENDING không chuyển được (MSG-COM-17); bê nháp không chuyển. | GBR-26, UC-05 PRE-2 |
| R-04-11 | Bò đã ở chuồng đích → MSG-FE04-07, bỏ qua con đó, các con khác vẫn chuyển. | UC-05 E3 |
| R-04-12 | Kiểm tra lại ngay trước khi lưu: trạng thái chuồng, chỗ trống, trạng thái từng con, version; khác so với lúc xem → MSG-COM-05. | UC-05 bước 5 |
| R-04-13 | Ngưng / dùng lại chuồng cần ngày hiệu lực (mặc định hôm nay, không ở tương lai) và lý do. | Popup Ngưng / Dùng lại |
| R-04-14 | Bò ACTIVE luôn có đúng một phân chuồng đang mở; bò EXITED / VOIDED không có. | GBR-24 |

---

## 5. Luồng xử lý

### UC-FE04-01 Xem chuồng
SCR-17: tiêu đề tổng, tìm theo mã / tên, lọc trạng thái, danh sách chuồng → bấm chuồng xem chi tiết (sức chứa, số con, chỗ trống, tiêu chí hiện tại, danh sách bò trong chuồng với tình trạng ngắn). Không có kết quả → MSG-COM-04; lỗi tải → MSG-COM-03.

### UC-FE04-02 / 03 Tạo, sửa chuồng
Popup → nhập mã, tên, sức chứa, mô tả, tiêu chí, (tạo mới) trạng thái ban đầu → **Lưu chuồng** → kiểm R-04-01, R-04-02 → lưu (tiêu chí đổi → phiên bản mới, R-04-06) → MSG-FE04-01. Sửa đồng thời → MSG-COM-05.

### UC-FE04-04 Ngưng / dùng lại chuồng
Popup → trạng thái mới (ngược trạng thái hiện tại), ngày hiệu lực, lý do → **Xác nhận** → lưu → MSG-FE04-04. Bò trong chuồng không đổi (R-04-04).

### UC-FE04-05 Chuyển chuồng
1. Popup hiện bò được chọn (mã, giống, giới tính, tuổi, cân gần nhất) và chuồng hiện tại kèm số con / sức chứa.
2. Chọn chuồng đích (chỉ chuồng ACTIVE, không gồm chuồng hiện tại), ngày chuyển (mặc định hôm nay), người thực hiện (mặc định mình), lý do.
3. Hệ thống kiểm tra từng con (bảng kết quả): chuồng đích ACTIVE và đủ chỗ; loại mục đích, giai đoạn, giới tính, tuổi / cân tối thiểu.
4. **Xác nhận chuyển** → kiểm lại R-04-12 → R-04-07 → MSG-FE04-08.

AF1 không đạt tiêu chí → MSG-FE04-06, nhập lý do cảnh báo · AF2 sửa nhầm → chuyển ngược với lý do "Correction" · AF3 hủy → không đổi.
E1 chuồng đích INACTIVE / thiếu chỗ → MSG-FE04-05, nút xác nhận bị khóa · E2 ngày sai → MSG-FE04-09 · E3 bò đã ở chuồng đích → MSG-FE04-07, bỏ qua · E4 bò EXITED / đã đổi → MSG-COM-13 / MSG-COM-05 · E5 lỗi lưu → MSG-COM-02.

---

## 6. Màn hình và trường

### SCR-17 Chuồng

| # | Trường | Loại | Hiện với | Nội dung / Hành vi |
|---|---|---|---|---|
| 1 | Header / Tiêu đề | Chữ | Tất cả | "n chuồng · đang dùng/tổng chỗ" (tổng số con / tổng sức chứa của các chuồng ACTIVE) |
| 2 | Create pen / Tạo chuồng | Nút | Owner, Manager | Mở popup Tạo / Sửa |
| 3 | Search / Tìm | Ô chữ | Tất cả | Khớp mã hoặc tên chuồng |
| 4 | Status / Trạng thái | Dropdown | Tất cả | Tất cả, ACTIVE, INACTIVE |
| **Danh sách** | | | | |
| 5 | Pen / Mã chuồng | Cột | | Sắp xếp được |
| 6 | Name / Tên | Cột | | — |
| 7 | Headcount / Capacity – Số con / Sức chứa | Cột | | Ví dụ 58 / 64; tô nổi khi hết chỗ |
| 8 | Accepts / Nhận | Cột | | Tóm tắt loại mục đích và giai đoạn chấp nhận; "Tất cả" khi không có tiêu chí |
| 9 | Status / Trạng thái | Huy hiệu | | ACTIVE / INACTIVE |
| **Chi tiết chuồng** | | | | |
| 10 | Edit / Stop using (Resume) – Sửa / Ngưng sử dụng (Dùng lại) | Nút | Owner, Manager | Mở popup tương ứng |
| 11 | Capacity, Headcount, Free places / Sức chứa, Số con, Chỗ trống | Số chỉ đọc | | — |
| 12 | Reception criteria / Tiêu chí nhận bò | Chỉ đọc | | Phiên bản, ngày hiệu lực; mỗi tiêu chí 1 dòng (loại, điều kiện, giá trị) |
| 13 | Cattle in pen / Bò trong chuồng | Danh sách | | Mã bò, tình trạng ngắn (ví dụ "Mang thai 5 tháng", "Phối 12 ngày trước", "Đến hạn tiêm"); checkbox chọn (Owner, Manager) |
| 14 | Move selected / Chuyển các con đã chọn | Nút | Owner, Manager | Mở popup Chuyển chuồng |
| 15 | View all n cattle / Xem tất cả n con | Link | | SCR-18 lọc theo chuồng |

### Popup Tạo / Sửa chuồng

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Pen code / Mã chuồng | Ô chữ | * | 1–20; chữ, số, `-`; duy nhất | Trống | MSG-COM-06, MSG-COM-10, MSG-FE04-02 |
| 2 | Pen name / Tên chuồng | Ô chữ | * | ≤ 100 | Trống | MSG-COM-06, MSG-COM-10 |
| 3 | Capacity / Sức chứa | Số nguyên | * | 1–9.999; khi sửa ≥ số con hiện tại | Trống | MSG-COM-06, MSG-FE04-03 |
| 4 | Description / Mô tả | Ô chữ dài | — | ≤ 500 | Trống | MSG-COM-10 |
| **Tiêu chí nhận bò (phiên bản mới từ hôm nay)** | | | | | | |
| 5 | Criterion type / Loại tiêu chí | Dropdown | — | Loại mục đích / Giai đoạn / Giới tính / Tuổi tối thiểu (tháng) / Cân tối thiểu (kg); mỗi loại tối đa 1 lần | — | MSG-COM-10 |
| 6 | Condition / Value – Điều kiện / Giá trị | Theo loại | * (khi đã thêm tiêu chí) | Loại mục đích: chọn nhiều 4 giá trị; Giai đoạn: chọn nhiều 4 giá trị; Giới tính: Đực / Cái; Tuổi: số nguyên 0–240; Cân: 1–1.500 | — | MSG-COM-06, MSG-COM-10 |
| 7 | + Add criterion / Remove – Thêm / Xóa tiêu chí | Nút | — | Không có tiêu chí = nhận mọi bò | — | — |
| 8 | Initial status / Trạng thái ban đầu | Radio | — | Chỉ khi tạo: ACTIVE / INACTIVE | ACTIVE | — |
| 9 | Cancel / Save pen – Hủy / Lưu chuồng | Nút | — | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE04-01 |

### Popup Ngưng / Dùng lại chuồng

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Pen / Chuồng | Chỉ đọc | — | Mã, tên, số con / sức chứa | — | — |
| 2 | Current status / Trạng thái hiện tại | Huy hiệu | — | — | — | — |
| 3 | New status / Trạng thái mới | Chỉ đọc (tự chọn) | * | Ngược trạng thái hiện tại | — | — |
| 4 | Effective date / Ngày hiệu lực | Ngày | * | Không ở tương lai | Hôm nay | MSG-COM-06, MSG-COM-07 |
| 5 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | Trống | MSG-COM-06, MSG-COM-10 |
| 6 | Cancel / Confirm – Hủy / Xác nhận | Nút | — | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE04-04 |

### Popup Chuyển chuồng

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Cattle / Bò | Chỉ đọc | — | 1 con (mã, giống, giới tính, tuổi, cân gần nhất) hoặc danh sách các con đã chọn | — | — |
| 2 | From pen / Chuồng hiện tại | Chỉ đọc | — | Mã – tên, số con / sức chứa | — | — |
| 3 | Destination pen / Chuồng đích | Dropdown | * | Chuồng ACTIVE kèm số con / sức chứa; không gồm chuồng hiện tại | Trống | MSG-COM-06, MSG-FE04-05 |
| 4 | Move date / Ngày chuyển | Ngày | * | Từ ngày bắt đầu phân chuồng hiện tại đến hôm nay | Hôm nay | MSG-FE04-09 |
| 5 | Performed by / Người thực hiện | Dropdown | — | Thành viên ACTIVE của trại | Người dùng | — |
| 6 | Reason / Lý do | Ô chữ dài | * | ≤ 500; "Correction" = chuyển ngược | Trống | MSG-COM-06, MSG-COM-10 |
| **Kiểm tra nhận bò** | | | | | | |
| 7 | Check / Result – Kiểm tra / Kết quả | Bảng chỉ đọc | — | Theo từng con: "Chuồng đích ACTIVE và còn n chỗ", "Loại mục đích phù hợp", "Giai đoạn phù hợp", "Giới tính phù hợp", "Tuổi / cân tối thiểu" – mỗi dòng Đạt / Không đạt / Không áp dụng | — | INACTIVE hoặc thiếu chỗ → MSG-FE04-05, khóa nút xác nhận |
| 8 | Warning reason / Lý do cảnh báo | Ô chữ dài | * (khi có tiêu chí không đạt) | ≤ 500 | Trống | MSG-FE04-06, MSG-COM-06 |
| 9 | Cancel / Confirm move – Hủy / Xác nhận chuyển | Nút | — | — | — | MSG-FE04-07, MSG-COM-13, MSG-COM-17, MSG-COM-05, MSG-COM-02; thành công MSG-FE04-08 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách chuồng | `q?, status?` | `{summary {penCount, usedPlaces, totalPlaces}, items[{penId, code, name, headcount, capacity, freePlaces, acceptsSummary, status}]}` | COM-03 | `GET /api/farms/{farmId}/pens` |
| A2 | Chi tiết chuồng | — | `{…A1 item, description, criteria {versionNo, effectiveFrom, items[{type, values[] / min}]}, cattle[{cattleId, code, situation}], version}` | COM-08 | `GET /api/farms/{farmId}/pens/{penId}` |
| A3 | Tạo chuồng | `code, name, capacity, description?, criteria[{type, values?, min?}], initialStatus` + `Idempotency-Key` | A2 | FE04-02, FE04-03, COM-06, COM-10, COM-02 | `POST /api/farms/{farmId}/pens` |
| A4 | Sửa chuồng | Như A3 (không có `initialStatus`) + `version` | A2 | FE04-02, FE04-03, COM-05, COM-02 | `PUT /api/farms/{farmId}/pens/{penId}` |
| A5 | Ngưng / dùng lại | `newStatus, effectiveDate, reason, version` + `Idempotency-Key` | A2 | COM-06, COM-07, COM-05, COM-02 | `POST /api/farms/{farmId}/pens/{penId}/availability` |
| A6 | Kiểm tra trước khi chuyển | `cattleIds[], destinationPenId, moveDate` | `{destination {active, freePlaces, enough}, rows[{cattleId, code, alreadyInDestination, checks[{criterion, result: MET\|NOT_MET\|NOT_APPLICABLE}]}], warningRequired}` | FE04-05, FE04-09 | `POST /api/farms/{farmId}/pen-moves/check` |
| A7 | Chuyển chuồng | `cattleIds[], destinationPenId, moveDate, performedById?, reason, warningReason?, versions{cattleId: version}` + `Idempotency-Key` | `{moved, skipped[{cattleId, code: MSG-FE04-07}], destinationPen}` | FE04-05, FE04-06 (thiếu lý do cảnh báo), FE04-09, COM-13, COM-17, COM-05, COM-02 | `POST /api/farms/{farmId}/pen-moves` |
| A8 | Lịch sử chuồng của một con (dùng ở SCR-20) | — | `[{penCode, from, to, reason, warningReason, performedBy}]` | COM-08 | `GET /api/farms/{farmId}/cattle/{cattleId}/pen-history` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE04-01 | Toast thành công | Đã lưu chuồng {pen_code}. |
| MSG-FE04-02 | Dưới trường | Mã chuồng {pen_code} đã tồn tại trong trại. |
| MSG-FE04-03 | Dưới trường | Sức chứa phải là số nguyên, tối thiểu {min_capacity}. |
| MSG-FE04-04 | Toast thành công | Chuồng {pen_code} hiện là {status}. Bò đang ở trong chuồng giữ nguyên. |
| MSG-FE04-05 | Trong hộp thoại | {pen_code} không nhận được {count} con: chuồng đã ngưng hoặc chỉ còn {free} chỗ trống. |
| MSG-FE04-06 | Trong hộp thoại | {cattle_code} không đạt tiêu chí nhận bò của {pen_code}: {criteria}. Nhập lý do để tiếp tục. |
| MSG-FE04-07 | Trong hộp thoại | {cattle_code} đã ở {pen_code} và sẽ được bỏ qua. |
| MSG-FE04-08 | Toast thành công | Đã chuyển {moved} con sang {pen_code}. |
| MSG-FE04-09 | Dưới trường | Ngày chuyển phải từ {start_date} đến hôm nay. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-04-01 | Popup | Mã trống / 21 ký tự / `C 01` / `C_01` / `C-01` | Lỗi / Lỗi / Lỗi / Lỗi / OK | U, H | Popup |
| TC-04-02 | Đã có chuồng `C-01` | Tạo `C-01` | MSG-FE04-02 | I | R-04-01 |
| TC-04-03 | Popup | Sức chứa 0 / 1 / 9.999 / 10.000 / 2,5 | Lỗi / OK / OK / Lỗi / Lỗi | U, H | Popup |
| TC-04-04 | Chuồng có 30 con | Sửa sức chứa 29 / 30 | MSG-FE04-03 (min 30) / OK | I | R-04-02 |
| TC-04-05 | Popup | Tuổi tối thiểu 241; cân 0; cân 1.501 | MSG-COM-10 | U, H | Popup |
| TC-04-06 | Popup | Thêm 2 tiêu chí cùng loại Giới tính | Bị chặn | U | Popup |
| TC-04-07 | Chuồng có tiêu chí v1, 10 con | Đổi tiêu chí | Có v2 hiệu lực hôm nay; 10 phân chuồng cũ không đổi | I | R-04-06 |
| TC-04-08 | Chuồng ACTIVE có 10 con | Ngưng chuồng | INACTIVE; 10 con vẫn ở chuồng | I | R-04-04 |
| TC-04-09 | Popup Ngưng | Ngày hiệu lực ngày mai; lý do trống | MSG-COM-07; MSG-COM-06 | U, H | R-04-13 |
| TC-04-10 | Chuồng đích INACTIVE | Chuyển 1 con | MSG-FE04-05, chặn | I | R-04-03 |
| TC-04-11 | Chuồng đích còn 2 chỗ | Chuyển 3 con | MSG-FE04-05 (count 3, free 2), chặn | I | R-04-03 |
| TC-04-12 | Chuồng đích chỉ nhận Cái, bò Đực | Chuyển không có lý do cảnh báo | MSG-FE04-06 | I | R-04-05 |
| TC-04-13 | Như trên | Chuyển có lý do cảnh báo | Chuyển được; lý do lưu với phân chuồng mới | I | R-04-05 |
| TC-04-14 | Bò ở chuồng A từ 01/11 | Chuyển với ngày 31/10 / ngày mai / 01/11 / hôm nay | MSG-FE04-09 / MSG-FE04-09 / OK / OK | I | R-04-08 |
| TC-04-15 | Bò ở A từ 01/11 | Chuyển sang B ngày 05/11 | Phân chuồng A đóng ngày 05/11; B mở ngày 05/11; đúng 1 phân chuồng mở; số con A −1, B +1 | I | R-04-07 |
| TC-04-16 | Lỗi khi mở phân chuồng mới | Chuyển | MSG-COM-02; phân chuồng A vẫn mở | I | R-04-07 |
| TC-04-17 | Chọn 3 con, 1 con đã ở chuồng đích | Chuyển | 2 con chuyển; 1 con trong `skipped` với MSG-FE04-07 | I | R-04-11 |
| TC-04-18 | Bò EXITED | Chuyển | MSG-COM-13 | I | R-04-10 |
| TC-04-19 | Bò trên phiếu chết PENDING | Chuyển | MSG-COM-17 | I | R-04-10 |
| TC-04-20 | Chuyển nhầm A → B | Chuyển B → A với lý do "Correction" | Lịch sử có 3 đoạn A, B, A; không đoạn nào bị xóa | I | R-04-09 |
| TC-04-21 | Có REM-08 gợi ý chuyển con X | Chuyển X | REM-08 được giải quyết | I | R-04-07 |
| TC-04-22 | Hai người cùng chuyển vào chuồng còn 1 chỗ | Gửi đồng thời | Một thành công, một MSG-FE04-05 hoặc MSG-COM-05; số con không vượt sức chứa | I | BR-D09 |
| TC-04-23 | Technician | Gọi tạo chuồng / chuyển chuồng | 403 | H | §2 |
| TC-04-24 | Technician | Mở SCR-17 | Không có nút Tạo, Sửa, Ngưng, checkbox, Chuyển | E | SCR-17 |
| TC-04-25 | 3 chuồng ACTIVE (10/20, 5/10, 0/5) + 1 INACTIVE (3/10) | Mở SCR-17 | Tiêu đề "4 chuồng · 15/35 chỗ" | E | SCR-17 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | UC-FE04-01 → 04 không có đặc tả Part II; luồng suy từ SCR-17 và popup | Chủ dự án xác nhận |
| Q2 | "Tuổi / cân tối thiểu" khi bò chưa có lần cân nào | Kết quả "Không áp dụng" cho tiêu chí cân |
| Q3 | Mã chuồng phân biệt hoa thường không (`c-01` và `C-01`)? | Không phân biệt; lưu chữ hoa |
| Q4 | Ngưng chuồng với ngày hiệu lực trong quá khứ: có chặn các lần xếp đã ghi sau ngày đó không? | Không ảnh hưởng dữ liệu đã có |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho AnNT duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
