# SPEC FE-15 – Dashboard và báo cáo quản lý trại

| | |
|---|---|
| Feature | FE-15 Farm Dashboard and Reports |
| Use case | UC-FE15-01, UC-FE15-02 |
| Người phụ trách | TaiDX (BE + FE + test) · Review BE: DucNV · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part III §15 (Table III-4 M01 → M09, A01 → A04; Table III-5 RPT-01 → RPT-07; SCR-48, SCR-49), MSG-FE15, GBR-24, 39, 65, 66, 105, 106, 107 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.
> FE-15 **không có đặc tả Part II**; luồng suy từ Part III + GBR (Q1).

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE15-01 | Xem dashboard vận hành trại: chỉ số đàn, sức khỏe, tiêm, sinh sản, tăng trưởng, danh sách cần chú ý; drill-down | Owner, Manager | SCR-48 |
| UC-FE15-02 | Xem báo cáo quản lý RPT-01 → RPT-07 theo kỳ và bộ lọc | Owner, Manager | SCR-49 |

**Không thuộc FE-15:** báo cáo thu chi platform (FE-21), báo cáo thức ăn riêng (FE-23), xuất file (SRS không yêu cầu – Q3).

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem SCR-48, SCR-49 | Có | Có | **Không** (403) |
| Thao tác trên A03 (phiếu chết chờ duyệt) | Có | Chỉ xem | — |
| Bước "Mời thành viên" trong Bắt đầu | Có | Ẩn | — |

GBR-65; trại phải còn quyền truy cập (trại SUSPENDED theo FE-02 / FE-19).

---

## 3. Dữ liệu

FE-15 **không có entity riêng**; mọi số liệu tính từ dữ liệu nguồn tại thời điểm xem (GBR-65).

### 3.1 Chỉ số dashboard (Table III-4)

| Mã | Chỉ số VN | Định nghĩa | Cơ sở |
|---|---|---|---|
| M01 | Bò đang nuôi | Số bò ACTIVE đã đăng ký; tách theo giống | Tại thời điểm |
| M02 | Bò cần chú ý sức khỏe | Trạng thái sức khỏe Đang điều trị hoặc Theo dõi (GBR-45); trong đó Đang điều trị; trong đó đang ngưng thịt | Tại thời điểm |
| M03 | Mũi tiêm đến hạn | Mũi đến hạn trong 7 ngày; trong đó quá hạn | Tại thời điểm |
| M04 | Dự sinh | Cái có ngày dự sinh trong 30 ngày; trong đó trong 7 ngày | Tại thời điểm |
| M05 | Cơ cấu đàn | Bò ACTIVE theo nhóm đàn (GBR-24): Cái sinh sản (trong đó CÓ THAI), Bò tơ, Vỗ béo, Bê, Đực giống, Khác; tổng = M01 | Tại thời điểm |
| M06 | Tăng trọng bình quân ngày | ADG trung bình của bò tính được ADG trong kỳ, theo chuồng và nhóm đàn (GBR-39) | Kỳ |
| M07 | Quá hạn cân | Bò có REM-01 quá hạn | Tại thời điểm |
| M08 | Lấp đầy chuồng | Số con / sức chứa mỗi chuồng ACTIVE và tổng | Tại thời điểm |
| M09 | Sinh sản tóm tắt | Khoảng cách lứa đẻ trung bình, tỷ lệ thụ thai chung 12 tháng gần nhất, cái quá hạn thụ thai (GBR-106) | 12 tháng / tại thời điểm |
| A01 | Cần chú ý hôm nay | Mũi quá hạn, cửa sổ phối hôm nay, khám thai đến hạn, đẻ trong 7 ngày, ca mở / nặng lên hôm nay | Tại thời điểm |
| A02 | Bê nháp chờ xác nhận | Kết quả bê PENDING_CONFIRMATION | Tại thời điểm |
| A03 | Phiếu xuất chờ duyệt | Phiếu chết PENDING chờ Owner (GBR-95, REM-12) | Tại thời điểm |
| A04 | Đạt cân xuất chuồng | Bò FATTENING ≥ cân mục tiêu (REM-13), kèm chuồng, cân mới nhất | Tại thời điểm |

### 3.2 Báo cáo (Table III-5)

| Mã | Báo cáo | Nội dung | Đơn vị / kỳ |
|---|---|---|---|
| RPT-01 | Tổng hợp đàn | Số con theo nhóm đàn, chuồng, giống, mục đích, giai đoạn tại ngày cuối; nhập / xuất trong kỳ theo nguồn và loại | Con; tại ngày cuối + kỳ |
| RPT-02 | Tăng trưởng | Số lần cân VALID, cân trung bình, ADG theo chuồng, nhóm đàn, giai đoạn; tỷ lệ cân ước tính | Lần, kg, kg/ngày; kỳ |
| RPT-03 | Tuân thủ tiêm phòng | Theo lịch và mũi: kế hoạch, đã tiêm, hoãn, quá hạn; tiêm tại trại theo vắc-xin | Mũi; kỳ |
| RPT-04 | Sức khỏe và điều trị | Ca mở, chuyển theo dõi mãn tính, đóng theo kết quả và mức độ; ca CHRONIC tại ngày cuối; điều trị theo thuốc; bò đang ngưng thịt (từ điều trị hoặc tiêm) tại ngày cuối | Ca, lượt, con; kỳ |
| RPT-05 | Hiệu quả sinh sản | Cái theo dõi (GBR-54) theo trạng thái; lần phối theo phương pháp; khám theo kết quả; lần đẻ, bê sống, chết lúc sinh; chỉ số GBR-106 kèm n; danh sách cái quá hạn thụ thai | Con, lần; kỳ |
| RPT-06 | Biến động đàn | Nhập theo nguồn, xuất theo loại, chuyển chuồng theo chuồng | Sự kiện; kỳ |
| RPT-07 | Hiệu quả vỗ béo | Bò FATTENING theo chuồng và tổng (GBR-107): đầu con bình quân, số bò tính, cân đầu / cuối trung bình, tổng tăng, ADG, thức ăn dùng, thức ăn / kg tăng, chi phí thức ăn / kg tăng, số bò đạt cân mục tiêu, số ngày dự kiến đến mục tiêu trung bình; "Thiếu số liệu cân (n con)" | Con, kg, kg/ngày, kg TA/kg tăng, đ/kg tăng; kỳ |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-15-01 | Chỉ Owner, Manager; Technician 403. | GBR-65 |
| R-15-02 | Mọi chỉ số dùng trại hiện tại; mỗi bò đếm **1 lần mỗi chỉ số**; bê nháp **không** tính vào đàn đang nuôi. | GBR-65 |
| R-15-03 | Chỉ số tồn (as-of) dùng 1 ngày tham chiếu; chỉ số sự kiện dùng thời điểm xảy ra trong [from, to). | GBR-65 |
| R-15-04 | Khoảng ngày người dùng chuyển thành [đầu ngày đầu, đầu ngày sau ngày cuối) theo múi giờ trại. | GBR-66 |
| R-15-05 | Luôn hiện thời điểm tính và bộ lọc đang áp dụng. | GBR-65 |
| R-15-06 | Nhóm đàn theo thứ tự khớp đầu tiên: Bê (UNWEANED / WEANED_CALF) → Vỗ béo (FATTENING) → Đực giống (đực, SIRE) → Cái sinh sản (cái, ADULT, BREEDING) → Bò tơ (YOUNG_STOCK) → Khác. Tổng M05 = M01. | GBR-24 |
| R-15-07 | Tăng trưởng chỉ dùng cân VALID; ADG = (cân cuối − cân đầu) ÷ số ngày, chỉ khi 2 lần cân cách ≥ 14 ngày; hiện cơ sở đo / ước tính. | GBR-39 |
| R-15-08 | Chỉ số sinh sản: chỉ sự kiện VALID, hiện kèm n; n < 3 → "Chưa đủ dữ liệu". Định nghĩa (1)–(8) theo GBR-106; INCONCLUSIVE bị loại khỏi tỷ lệ thụ thai; quá hạn thụ thai mặc định 108 ngày (45 + 3 × 21). | GBR-106 |
| R-15-09 | Vỗ béo: nội suy cân tuyến tính giữa 2 lần cân VALID trong 60 ngày, hoặc lần cân gần nhất trong 7 ngày, nếu không → chưa biết. Thức ăn chuồng / ngày chia đều cho bò trong chuồng ngày đó. Ngày dự kiến đạt mục tiêu chỉ hiện khi có mục tiêu, 2 lần cân cách ≥ 14 ngày, ADG 60 ngày > 0. **Không** tính giá mua, giá bán, lợi nhuận. | GBR-107, GBR-105 |
| R-15-10 | Kỳ báo cáo: from ≤ to (MSG-COM-11), tối đa 24 tháng. | SCR-49 |
| R-15-11 | Dữ liệu thiếu cho một phần → hiển thị riêng "Chưa đủ dữ liệu (n con)" (MSG-FE15-01). Tính lỗi → MSG-FE15-02 + Thử lại. | SCR-49, SCR-48 |
| R-15-12 | Drill-down: chọn ô / dòng mở danh sách đã lọc tương ứng (bò, ca, mũi, cái), SCR-18 theo tab nhóm đàn, SCR-44, SCR-30, SCR-49. | SCR-48 |
| R-15-13 | Panel "Bắt đầu" chỉ hiện cho trại mới đến khi xong mọi bước hoặc người dùng đóng. | SCR-48 |

---

## 5. Luồng xử lý

### UC-FE15-01 Xem dashboard
1. Owner / Manager mở SCR-48.
2. Hệ thống tính M01 → M09, A01 → A04 cho trại hiện tại, kỳ mặc định 30 ngày, hiện thời điểm tính.
3. Người dùng đổi kỳ (7 / 30 / 90 / tùy chọn) hoặc lọc chuồng, nhóm đàn, giai đoạn → tính lại các chỉ số tương thích.
4. Chọn ô / dòng → drill-down (R-15-12).

E1 tính lỗi → MSG-FE15-02 · E2 Technician → 403.

### UC-FE15-02 Xem báo cáo
1. Mở SCR-49; chọn loại báo cáo *, kỳ *, bộ lọc phù hợp.
2. **Xem báo cáo** → kiểm R-15-10 → tính → ô tóm tắt (kèm tử số, mẫu số, n), bảng kết quả + dòng tổng, biểu đồ, thời điểm tính, bộ lọc.
3. Phần thiếu dữ liệu tách riêng (MSG-FE15-01).

E1 kỳ sai → MSG-COM-11 · E2 > 24 tháng → MSG-COM-10 (Q2) · E3 lỗi → MSG-FE15-02.

---

## 6. Màn hình và trường

### SCR-48 Dashboard trại

| # | Trường | Loại | Nội dung / Ràng buộc |
|---|---|---|---|
| 1 | Header / Tiêu đề | Chỉ đọc | Tên trại · số bò đang nuôi · trạng thái dịch vụ và ngày hết hạn |
| 2 | Getting started / Bắt đầu | Panel (O, M; trại mới) | Bước: Tạo chuồng (SCR-17); Xem giống và mục đích (SCR-52, SCR-55); Hoàn thiện mũi vắc-xin từ nhãn (SCR-53); Thêm thuốc tham chiếu (SCR-54); Kiểm tra tham số trại (SCR-56); Mời thành viên (SCR-13, chỉ Owner); Lập phiếu nhập đàn đầu tiên (SCR-24). Mỗi bước "Xong" hoặc link; nút đóng panel |
| 3 | Period / Kỳ | Chip + khoảng ngày | 7, 30 (mặc định), 90 ngày, tùy chọn; áp dụng cho chỉ số theo kỳ (M06) |
| 4 | Pen, Herd group, Life stage / Chuồng, Nhóm đàn, Giai đoạn | Dropdown | Áp dụng cho mọi chỉ số tương thích |
| 5 | Ô M01 → M04 | Ô số | Giá trị + giá trị phụ; chọn → danh sách lọc tương ứng |
| 6 | Needs attention today / Cần chú ý hôm nay | Bảng | Cột Bò, Chuồng, Vấn đề, Trạng thái; dòng từ A01, A02, A03, A04; chip Quá hạn, Sắp đẻ, Nên phối, Đang điều trị, Đến hạn khám, Chờ xác nhận. A03 chỉ Owner thao tác; A04 mở SCR-30. "Xem tất cả" → SCR-44 |
| 7 | Herd structure / Cơ cấu đàn | Bảng | Nhóm đàn / Số con / Trong đó có thai (chỉ Cái sinh sản); chọn dòng → SCR-18 tab nhóm đàn |
| 8 | More indicators / Chỉ số khác | Thẻ | M06, M07, M08, M09 có drill-down; M09 → SCR-49 với RPT-05 |
| 9 | Generated at / Tính lúc | Chỉ đọc | Thời điểm tính; lỗi → MSG-FE15-02 |

### SCR-49 Báo cáo quản lý

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Report type / Loại báo cáo | Dropdown | * | RPT-01 → RPT-07 | — | MSG-COM-06 |
| 2 | Period / Kỳ | Khoảng ngày | * | Theo múi giờ trại; from ≤ to; tối đa 24 tháng | 30 ngày gần nhất (Q4) | MSG-COM-11, MSG-COM-10 |
| 3 | Pens, Breeds, Herd groups, Life stages / Chuồng, Giống, Nhóm đàn, Giai đoạn | Chọn nhiều | — | Chỉ hiện bộ lọc có nghĩa với báo cáo (Q5) | Tất cả | — |
| 4 | View report / Xem báo cáo | Nút | — | — | — | MSG-FE15-02 |
| 5 | Summary tiles / Ô tóm tắt | Ô số | — | Kèm tử số, mẫu số, n (ví dụ RPT-05: khoảng cách lứa, ngày trống, số lần phối / thụ thai, tỷ lệ thụ thai, tỷ lệ sẩy; RPT-07: ADG, TA / kg tăng, chi phí TA / kg tăng) | — | "Chưa đủ dữ liệu" khi n < 3 |
| 6 | Result table / Bảng kết quả | Bảng | — | Dòng theo chuồng (hoặc lịch / thuốc tùy báo cáo), cột theo §3.2, dòng tổng | — | MSG-FE15-01 |
| 7 | Chart / Biểu đồ | Biểu đồ | — | Theo báo cáo (ví dụ tỷ lệ thụ thai theo tháng) | — | — |
| 8 | Generated at, Filters / Tính lúc, Bộ lọc | Chỉ đọc | — | Hiện trên kết quả | — | — |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Dashboard | `from, to, penId?, herdGroup?, lifeStage?` | `{header{farmName, activeCattle, serviceStatus, endDate}, gettingStarted{steps[{key, done, link}], dismissed}, tiles{M01…M04 {value, sub[], breakdown?}}, attention[{rule, cattleId, code, pen, issue, status, actionable}], herdStructure[{group, head, pregnant?}], more{M06, M07, M08[{pen, head, capacity}], M09{calvingInterval{v, n}, conceptionRate{v, n}, overdue}}, generatedAt, filters}` | COM-03, FE15-02 | `GET /api/farms/{farmId}/dashboard` |
| A2 | Báo cáo | `ReportRequest {type, from, to, penIds[], breedIds[], herdGroups[], lifeStages[]}` | `ReportView {type, tiles[{key, value, numerator?, denominator?, n}], columns[], rows[], total, insufficient[{item, count}], chart{series[]}, generatedAt, filters}` | COM-11, COM-10, COM-03, FE15-02 | `POST /api/farms/{farmId}/dashboard/reports` |
| A3 | Đóng panel Bắt đầu | `Idempotency-Key` | — | — | Chưa có – đề xuất `POST /api/farms/{farmId}/dashboard/getting-started/dismiss` |
| A4 | Drill-down | Dùng route danh sách của FE nguồn với bộ lọc tương ứng (FE-05 danh sách bò, FE-09 mũi, FE-10 ca, FE-12 cái) | — | — | Route các FE nguồn |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE15-01 | Trong kết quả | Chưa đủ dữ liệu cho {item} ({count} con); các con này được hiển thị riêng. |
| MSG-FE15-02 | Trên trang | Không tính được số liệu. [Thử lại] |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-15-01 | Technician | Gọi A1 / A2 | 403 | H | R-15-01 |
| TC-15-02 | 10 bò ACTIVE + 2 bê nháp + 1 EXITED | Xem M01 | 10 | I | R-15-02 |
| TC-15-03 | 10 bò ACTIVE đủ loại | Xem M05 | Tổng nhóm = 10; mỗi bò 1 nhóm theo thứ tự GBR-24 | U, I | R-15-06 |
| TC-15-04 | Bò đực SIRE nhưng giai đoạn WEANED_CALF | Phân nhóm | Bê (khớp trước) | U | R-15-06 |
| TC-15-05 | Bò có 2 lần cân cách 10 ngày | Tính ADG | Không có ADG | U | R-15-07 |
| TC-15-06 | Cân 300 kg ngày 01/10, 330 kg ngày 31/10 | ADG | 1,0 kg/ngày | U | R-15-07 |
| TC-15-07 | 2 lần đẻ được tính trong kỳ | RPT-05 khoảng cách lứa | "Chưa đủ dữ liệu" (n < 3) | U | R-15-08 |
| TC-15-08 | 4 lần phối: 2 PREGNANT, 1 NOT_PREGNANT, 1 INCONCLUSIVE | Tỷ lệ thụ thai chung | 2 / 3 = 66,7 % (n = 3) | U | R-15-08 |
| TC-15-09 | Cái đẻ 120 ngày trước, chưa có thai, tham số mặc định | M09 | Quá hạn thụ thai | U | R-15-08 |
| TC-15-10 | Bò vỗ béo cân 10/10 (300) và 30/10 (340), kỳ đến 20/10 | Cân ngày 20/10 | Nội suy 320 kg | U | R-15-09 |
| TC-15-11 | Chuồng 4 con, 40 kg thức ăn / ngày | RPT-07 | 10 kg / con / ngày | U | R-15-09 |
| TC-15-12 | Bò vỗ béo thiếu cân đầu kỳ | RPT-07 | Tính vào "Thiếu số liệu cân (n con)" + MSG-FE15-01 | I | R-15-09, R-15-11 |
| TC-15-13 | RPT-07 | Xem | Không có cột giá mua, giá bán, lợi nhuận | E | R-15-09 |
| TC-15-14 | Kỳ từ 10/11 đến 01/11 | Xem báo cáo | MSG-COM-11 | U, H | R-15-10 |
| TC-15-15 | Kỳ 25 tháng | Xem báo cáo | Lỗi tối đa 24 tháng | U, H | R-15-10 |
| TC-15-16 | Sự kiện 23:30 giờ VN ngày 31/10 (16:30 UTC) | Báo cáo kỳ 01/11 → 30/11 | Không tính | I | R-15-04 |
| TC-15-17 | Mũi PLANNED trong 3 ngày + 1 quá hạn | M03 | 2; trong đó quá hạn 1 | I | M03 |
| TC-15-18 | Manager | A03 trong Cần chú ý | Không có nút thao tác | E | §2 |
| TC-15-19 | Trại mới, đã tạo chuồng | Xem | Bước Tạo chuồng "Xong"; Manager không thấy bước Mời thành viên | E | R-15-13 |
| TC-15-20 | Lỗi tính toán | Xem dashboard | MSG-FE15-02 + Thử lại | E | R-15-11 |
| TC-15-21 | Chọn dòng Cái sinh sản ở Cơ cấu đàn | — | Mở SCR-18 tab Cái sinh sản | E | R-15-12 |
| TC-15-22 | Mọi chỉ số | Xem | Có "Tính lúc" và bộ lọc | E | R-15-05 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Không có đặc tả UC ở Part II | Dùng Part III + GBR |
| Q2 | Mã lỗi khi kỳ > 24 tháng | MSG-COM-10 với nội dung "tối đa 24 tháng" |
| Q3 | Có xuất báo cáo (Excel / PDF) không? | SRS không yêu cầu – ngoài phạm vi |
| Q4 | Kỳ mặc định SCR-49 | 30 ngày như SCR-48 |
| Q5 | Bộ lọc nào áp dụng cho từng RPT | RPT-03: bỏ giống / giai đoạn; RPT-07: chỉ chuồng; còn lại đủ 4 |
| Q6 | Cache dashboard | Tính tại thời điểm xem; nếu cache phải hiện thời điểm tính thực |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho TaiDX duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
