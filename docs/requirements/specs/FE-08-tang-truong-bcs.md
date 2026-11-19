# SPEC FE-08 – Tăng trưởng và điểm thể trạng (BCS)

| | |
|---|---|
| Feature | FE-08 Growth and BCS Monitoring |
| Use case | UC-FE08-01 → UC-FE08-03 |
| Người phụ trách | TuanPQ (BE + FE + test) · Review BE: AnNT · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Growth Assessment, Record Revision), §3.3 (BR-D14, BR-D15), Part II §8, Part III §8 (SCR-29, SCR-30, 2 popup), MSG-FE08, GBR-08, 26, 38 → 40, 89, 107; REM-01, REM-08, REM-13 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 05.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE08-01 | Ghi cân và / hoặc BCS | Manager | Popup Ghi cân & BCS (từ SCR-30 hoặc REM-01) |
| UC-FE08-02 | Xem tăng trưởng đàn và của một con | Owner, Manager, Technician | SCR-29, SCR-30 |
| UC-FE08-03 | Sửa / loại trừ bản ghi cân | Manager | Popup Sửa / Loại trừ bản ghi (từ SCR-30 hoặc SCR-50) |

**Liên quan:** nhắc cân REM-01, gợi ý REM-08, đạt cân xuất chuồng REM-13 (FE-14); hiệu quả vỗ béo RPT-07 (FE-15); cân ở phiếu nhập / xuất **không phải** bản ghi tăng trưởng (GBR-92).

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem SCR-29, SCR-30 | Có | Có | Có |
| Ghi, sửa, loại trừ | — | **Chỉ Manager** | — (có thể được chọn là người đo) |

Cần trại ACTIVE, bò ACTIVE, không phải bê nháp (GBR-08, GBR-26).

---

## 3. Dữ liệu – Lần đánh giá tăng trưởng (Growth Assessment)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Bò | Tham chiếu | Có | ACTIVE, đã đăng ký | UC-01 PRE-2 |
| Thời điểm đo | Ngày giờ | Có | Không ở tương lai, không trước ngày nhập đàn | GBR-38, BR-D14 |
| Thời điểm ghi | Ngày giờ hệ thống | Có | Lưu riêng với thời điểm đo | BR-D14 |
| Người đo | Thành viên ACTIVE | Có | Mặc định người ghi; có thể là Technician | UC-01 AF3 |
| Người ghi | Manager | Có | Người dùng hiện tại | GBR-08 |
| Phương pháp | `ELECTRONIC_SCALE` / `TAPE` / `OTHER_ESTIMATE` | Có khi có cân | — | GBR-38 |
| Vòng ngực (cm) | Số | Chỉ khi TAPE | 50–300 | Popup |
| Dài thân (cm) | Số | Chỉ khi TAPE | 30–250 | Popup |
| Cân (kg) | Số, 1 chữ số thập phân | Có khi không có BCS | 1–1.500 | Popup |
| Cơ sở | `MEASURED` / `ESTIMATED` **suy ra** từ phương pháp | — | Cân điện tử → MEASURED; thước dây, ước lượng khác → ESTIMATED | GBR-38 |
| BCS + phiên bản thang | Số | Có khi không có cân | Theo thang của trại (mặc định 1,0–5,0, bước 0,5) | GBR-38 |
| Ghi chú | Chuỗi dài | Không | ≤ 500 | Popup |
| Trạng thái | Enum | — | `VALID` → `EXCLUDED` (loại trừ) hoặc `VOIDED`; sửa giữ VALID kèm dấu "Đã sửa" | §3.2, GBR-40 |

**Lịch sử sửa (Record Revision):** loại bản ghi + ID, hành động (`CORRECT` / `EXCLUDE` / `VOID`), lý do, giá trị trước / sau, người, thời điểm; bất biến.

**Chỉ số suy ra:**

| Chỉ số | Công thức | Nguồn |
|---|---|---|
| Cân hiện tại | Cân VALID **MEASURED** mới nhất; nếu không có thì cân VALID ESTIMATED mới nhất; luôn hiện cơ sở | GBR-39 |
| Cân theo thước dây | 88,4 × vòng ngực (m)² × dài thân (m), người dùng ghi đè được | GBR-39 |
| ADG của một khoảng | (cân VALID cuối − cân VALID đầu trong khoảng) ÷ số ngày giữa hai lần; chỉ hiện khi hai lần cách nhau ≥ 14 ngày | GBR-39 |
| ADG từng dòng lịch sử | kg/ngày so với lần cân VALID trước | SCR-30 |
| Dự kiến đạt cân xuất chuồng (bò FATTENING có cân mục tiêu) | Ngày cân VALID mới nhất + (cân mục tiêu − cân mới nhất) ÷ ADG 60 ngày; không hiện khi không có mục tiêu, không có 2 lần cân cách ≥ 14 ngày, hoặc ADG ≤ 0; ≥ mục tiêu → "Đạt cân mục tiêu" (REM-13) | GBR-107 |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-08-01 | Mỗi lần đánh giá có cân, BCS hoặc cả hai; không có cả hai → MSG-FE08-02. | GBR-38 |
| R-08-02 | Cân 1–1.500 kg → ngoài khoảng MSG-FE08-03. BCS phải thuộc thang của trại. | GBR-38, Popup |
| R-08-03 | Thời điểm đo không ở tương lai (MSG-COM-07), không trước ngày nhập đàn (MSG-COM-15). | GBR-38 |
| R-08-04 | Cơ sở luôn suy ra từ phương pháp, người dùng không chọn. | GBR-38 |
| R-08-05 | Cân mới chênh hơn 20 % so với cân VALID gần nhất trong vòng 30 ngày → hỏi xác nhận MSG-FE08-04 trước khi lưu. | UC-01 AF1 |
| R-08-06 | Chỉ số chỉ dùng bản ghi VALID; EXCLUDED / VOIDED không vào tính toán và không vẽ trên biểu đồ. | GBR-39, GBR-40 |
| R-08-07 | Sửa / loại trừ bắt buộc lý do; giữ giá trị gốc, người, thời điểm (Record Revision) trong cùng transaction; kiểm version (MSG-COM-05). | GBR-40, BR-D15, GBR-89 |
| R-08-08 | Sau ghi / sửa / loại trừ: tính lại cân hiện tại, ADG, dự kiến xuất chuồng; giải quyết REM-01 (khi ghi); đánh giá lại REM-08, REM-13. | UC-01 POST-2, UC-03 POST-3 |
| R-08-09 | Chỉ Manager ghi / sửa / loại trừ; Owner và Technician xem. | GBR-08 |
| R-08-10 | Bò EXITED / VOIDED: không ghi mới (MSG-COM-13). Bò trên phiếu chết PENDING: không ghi mới (MSG-COM-17) nhưng vẫn sửa / loại trừ được bản ghi cũ. | GBR-26 |

---

## 5. Luồng xử lý

### UC-FE08-01 Ghi cân & BCS
1. Popup: bò (chỉ đọc), thời điểm đo (mặc định bây giờ), người đo (mặc định mình).
2. Chọn phương pháp, nhập cân (thước dây: nhập vòng ngực, dài thân → hệ thống tính cân); hiện nhãn cơ sở.
3. Chọn BCS và / hoặc ghi chú → **Lưu**.
4. Kiểm R-08-01 → R-08-03, trạng thái bò; R-08-05 nếu cần.
5. Lưu + dòng thời gian → R-08-08 → MSG-FE08-01.

AF2 chỉ BCS → không cần trường cân · AF3 người đo là Technician · AF4 Hủy.

### UC-FE08-02 Xem
SCR-29 (danh sách đàn, ô tổng hợp, lọc) → mở SCR-30 của một con (chỉ số, biểu đồ, lịch sử đo).

### UC-FE08-03 Sửa / loại trừ
Popup → chọn **Sửa giá trị** (cân, vòng ngực + dài thân, BCS, phương pháp, thời điểm đo) hoặc **Loại trừ bản ghi** → lý do → **Lưu** → kiểm như UC-01 + version → R-08-07 → R-08-08 → MSG-FE08-05.

---

## 6. Màn hình và trường

### SCR-29 Tăng trưởng & BCS (đàn)

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | Search / Tìm | Ô chữ | Mã hiển thị hoặc số tai |
| 2 | Pen, Herd group, Life stage / Chuồng, Nhóm đàn, Giai đoạn | Dropdown | — |
| 3 | Period / Khoảng ADG | Chọn | 30 / 90 (mặc định) / 180 ngày |
| 4 | Ô: Weighing overdue / Quá hạn cân | Số | Bò ACTIVE không có cân VALID trong chu kỳ cân (tham số, mặc định 30 ngày) |
| 5 | Ô: ADG below pen average / ADG thấp hơn TB chuồng | Số | Bò có ADG < ADG trung bình của chuồng trong khoảng |
| 6 | Ô: BCS below 2.5 / BCS dưới 2,5 | Số | BCS mới nhất < 2,5 |
| 7 | Ô: Weighings in 30 days / Số lần cân 30 ngày | Số | Số lần cân VALID trong 30 ngày qua |
| 8 | Cattle / Bò | Cột | Mã hiển thị, giống, giới tính |
| 9 | Pen / Chuồng | Cột | Mã – tên |
| 10 | Latest weight / Cân gần nhất | Cột | kg kèm cơ sở |
| 11 | Weighed on / Ngày cân | Cột | Sắp xếp được |
| 12 | ADG | Cột | kg/ngày theo khoảng đã chọn; "—" khi không tính được |
| 13 | BCS | Cột | BCS gần nhất |
| 14 | Status / Tình trạng | Huy hiệu | Quá hạn cân / ADG thấp / BCS thấp / Bình thường |
| 15 | Open / Mở | Thao tác dòng | Mở SCR-30 |

### SCR-30 Tab Cân & BCS

| # | Trường | Hiện với | Nội dung |
|---|---|---|---|
| 1 | Record weight & BCS / Ghi cân & BCS | Manager | Mở popup |
| 2 | Latest weight / Cân gần nhất | Tất cả | kg, ngày, cơ sở |
| 3 | ADG 90 days | | kg/ngày |
| 4 | Finishing projection / Dự kiến xuất chuồng | Bò FATTENING có cân mục tiêu | "Mục tiêu 450 kg · dự kiến dd/mm/yyyy (n ngày) theo ADG 60 ngày" / "Đạt cân mục tiêu" / "Chưa đủ số lần cân" |
| 5 | Latest BCS / BCS gần nhất | | Giá trị / thang (ví dụ "3,0 / 5 · thang trại v1") |
| 6 | Number of measurements / Số lần đo | | Số lần, kèm "n đã sửa" |
| 7 | Weight chart / Biểu đồ cân | | Cân VALID theo thời gian; đo và ước tính dùng ký hiệu khác nhau; không vẽ bản ghi loại trừ |
| 8 | Measured at / Thời điểm đo | | dd/mm/yyyy HH:mm, sắp xếp được |
| 9 | Weight, Method / Cân, Phương pháp | | kg; cân điện tử / thước dây (vòng ngực × dài) / ước lượng khác, kèm cơ sở |
| 10 | BCS | | — |
| 11 | ADG | | kg/ngày so với lần cân VALID trước |
| 12 | Measured by / Người đo | | Tên |
| 13 | Status / Trạng thái | | VALID (kèm "Đã sửa"), EXCLUDED, VOIDED (dòng mờ) |
| 14 | Actions / Thao tác | Manager | "Sửa · Loại trừ" |
| 15 | Next weighing / Lần cân tới | | Hạn từ REM-01 |

### Popup Ghi cân & BCS

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Cattle / Bò | Chỉ đọc | — | Mã, tên, giống, giới tính, chuồng | — | — |
| 2 | Measured at / Thời điểm đo | Ngày giờ | * | Không tương lai, không trước ngày nhập đàn | Bây giờ | MSG-COM-06, MSG-COM-07, MSG-COM-15 |
| 3 | Measured by / Người đo | Dropdown | — | Thành viên ACTIVE | Người dùng | — |
| 4 | Method / Phương pháp | Radio | * khi có cân | Cân điện tử / Thước dây / Ước lượng khác; nhãn cơ sở chỉ đọc cạnh ô cân | — | MSG-COM-06 |
| 5 | Heart girth (cm) / Vòng ngực | Số | — | Chỉ hiện với Thước dây; 50–300 | — | MSG-COM-10 |
| 6 | Body length (cm) / Dài thân | Số | — | Chỉ hiện với Thước dây; 30–250 | — | MSG-COM-10 |
| 7 | Weight (kg) / Cân | Số (1 chữ số thập phân) | * khi không có BCS | 1–1.500; thước dây tự tính, ghi đè được | — | MSG-FE08-02, MSG-FE08-03 |
| 8 | BCS | Bộ chọn | * khi không có cân | Thang trại (mặc định 1,0–5,0 bước 0,5) | — | MSG-FE08-02 |
| 9 | Note / Ghi chú | Ô chữ dài | — | ≤ 500 | — | MSG-COM-10 |
| 10 | Cancel / Save assessment – Hủy / Lưu | Nút | — | — | — | MSG-FE08-04 (xác nhận), MSG-COM-13, MSG-COM-17, MSG-COM-02; thành công MSG-FE08-01 |

### Popup Sửa / Loại trừ bản ghi cân

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Record / Bản ghi | Chỉ đọc | — | Giá trị, phương pháp, người đo | — |
| 2 | Action / Hành động | Radio | * | Sửa giá trị (mặc định) / Loại trừ bản ghi | — |
| 3 | Field / Current / New | Bảng | — | Dòng: Cân, Vòng ngực + dài thân, BCS, Phương pháp, Thời điểm đo (chỉ khi Sửa); ràng buộc như popup ghi | MSG-FE08-02, MSG-FE08-03, MSG-COM-07, MSG-COM-15 |
| 4 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 5 | Cancel / Save | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE08-05 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách tăng trưởng đàn | `q?, penId?, herdGroup?, lifeStage?, windowDays (30\|90\|180), page, size, sort?` | `{tiles {weighingOverdue, adgBelowPenAverage, bcsBelow25, weighings30d}, items[{cattleId, displayCode, breed, sex, pen, latestWeight {kg, basis, date}, adg?, bcs?, status}], total}` | COM-03 | `GET /api/farms/{farmId}/growth` |
| A2 | Tăng trưởng một con | `windowDays?` | `{latestWeight {kg, date, basis}, adg90, finishing {target?, projectedDate?, days?, reached, insufficient}, latestBcs {value, scale}, count, correctedCount, chart[{at, kg, basis}], history[{id, measuredAt, weightKg, method, girthCm?, lengthCm?, basis, bcs, adg?, measuredBy, status, corrected, version}], nextWeighingDue}` | COM-08 | `GET /api/farms/{farmId}/cattle/{cattleId}/growth` |
| A3 | Ghi | `measuredAt, measuredById?, method?, girthCm?, lengthCm?, weightKg?, bcs?, note?, confirmLargeChange?` + `Idempotency-Key` | Bản ghi | FE08-02, FE08-03, FE08-04 (cần `confirmLargeChange`), COM-07, COM-15, COM-13, COM-17, COM-02 | `POST /api/farms/{farmId}/cattle/{cattleId}/growth` |
| A4 | Sửa / loại trừ | `action: CORRECT\|EXCLUDE, changes?, reason, version` + `Idempotency-Key` | Bản ghi | FE08-02, FE08-03, COM-06, COM-07, COM-05, COM-02 | `POST /api/farms/{farmId}/cattle/{cattleId}/growth/{id}/correction` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE08-01 | Toast thành công | Đã lưu đánh giá cho {cattle_code}. |
| MSG-FE08-02 | Trên form | Hãy nhập cân, BCS hoặc cả hai. |
| MSG-FE08-03 | Dưới trường | Cân phải từ 1 đến 1.500 kg. |
| MSG-FE08-04 | Hộp thoại xác nhận | Cân mới ({new} kg) chênh hơn 20 % so với lần cân trước ({last} kg ngày {date}). Vẫn lưu? |
| MSG-FE08-05 | Toast thành công | Bản ghi đã được {action}. Giá trị gốc được giữ trong lịch sử. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-08-01 | Popup | Không có cân, không có BCS | MSG-FE08-02 | U, H | R-08-01 |
| TC-08-02 | Popup | Cân 0 / 1 / 1.500 / 1.500,1 | Lỗi / OK / OK / Lỗi | U, H | R-08-02 |
| TC-08-03 | Thang 1–5 bước 0,5 | BCS 3,3 / 5,5 | Lỗi | U, H | R-08-02 |
| TC-08-04 | Bò nhập 10/10 | Đo lúc 09/10 / ngày mai | MSG-COM-15 / MSG-COM-07 | I | R-08-03 |
| TC-08-05 | Thước dây 180 cm × 150 cm | Tính | 88,4 × 1,8² × 1,5 = 429,6 kg, cơ sở ESTIMATED | U | GBR-39 |
| TC-08-06 | Phương pháp Cân điện tử | Lưu | Cơ sở MEASURED; client không gửi được cơ sở | U, H | R-08-04 |
| TC-08-07 | Cân VALID 300 kg ngày 01/11 | Ghi 370 kg ngày 10/11 | Hỏi MSG-FE08-04; không xác nhận → không lưu | I, E | R-08-05 |
| TC-08-08 | Cân VALID 300 kg cách 31 ngày | Ghi 370 kg | Không hỏi | I | R-08-05 |
| TC-08-09 | MEASURED 320 (01/11), ESTIMATED 330 (05/11) | Cân hiện tại | 320 kg (MEASURED ưu tiên) | U | GBR-39 |
| TC-08-10 | 300 kg (01/10), 330 kg (31/10) | ADG 90 ngày | 1,0 kg/ngày | U | GBR-39 |
| TC-08-11 | 2 lần cân cách 10 ngày | ADG | "—" | U | GBR-39 |
| TC-08-12 | Loại trừ 1 bản ghi | Tính ADG, biểu đồ | Bản ghi đó không được dùng, không được vẽ | I | R-08-06 |
| TC-08-13 | Sửa 340 → 342 | Lưu có lý do | Hiện 342 + "Đã sửa"; revision giữ 340; trạng thái VALID | I | R-08-07 |
| TC-08-14 | Sửa / loại trừ | Không lý do | MSG-COM-06 | U, H | R-08-07 |
| TC-08-15 | Hai Manager cùng sửa | Người thứ hai lưu version cũ | MSG-COM-05 | I | R-08-07 |
| TC-08-16 | Có REM-01 cho bò | Ghi cân | REM-01 được giải quyết | I | R-08-08 |
| TC-08-17 | Bò FATTENING mục tiêu 450, ADG 60 ngày 1,0, cân 400 ngày 01/11 | Dự kiến | 20/12 (50 ngày) | U | GBR-107 |
| TC-08-18 | Bò FATTENING cân 455, mục tiêu 450 | — | "Đạt cân mục tiêu"; có REM-13 | I | GBR-107 |
| TC-08-19 | Owner / Technician | Gọi ghi cân | 403 | H | R-08-09 |
| TC-08-20 | Manager chọn Technician làm người đo | Lưu | Người đo = Technician, người ghi = Manager | I | UC-01 AF3 |
| TC-08-21 | Bò trên phiếu chết PENDING | Ghi mới / loại trừ bản ghi cũ | MSG-COM-17 / được | I | R-08-10 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất | Quyết định (07/11/2026) |
|---|---|---|---|
| Q1 | Trạng thái VOIDED của bản ghi cân xuất hiện khi nào? (UC-03 chỉ có Sửa và Loại trừ) | Chỉ khi hủy nhập / hủy phiếu (hệ thống), người dùng không chọn | Theo đề xuất |
| Q2 | "Ngưỡng 20 %" và "30 ngày" có là tham số trại không? | Hằng số | Theo đề xuất |
| Q3 | Thang BCS 1–9 thì ô tổng hợp "BCS dưới 2,5" tính thế nào? | Quy đổi theo tỷ lệ thang, hoặc chỉ hiện với thang 1–5 | Quy đổi theo tỷ lệ thang: thang 1–9 dùng ngưỡng dưới 4,0 (tương đương 2,5 trên thang 1–5) |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho TuanPQ duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 07/11/2026 | 28/10/2026 | Chốt các câu hỏi mục 10 (cột Quyết định), ghi tại `OPEN_QUESTIONS.md` | Tuấn |
