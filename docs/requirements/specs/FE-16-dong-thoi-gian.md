# SPEC FE-16 – Dòng thời gian hoạt động của bò

| | |
|---|---|
| Feature | FE-16 Cattle Activity Timeline |
| Use case | UC-FE16-01 |
| Người phụ trách | AnNT (BE + FE + test) · Review BE: TuanPQ · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 J (Record Revision), Part III §16 (SCR-50), MSG-FE16-01, GBR-26, GBR-37; Business flow bước 10 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.
> FE-16 **không có đặc tả Part II**; luồng suy từ Part III + GBR-37 (Q1).

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE16-01 | Xem sự kiện đã ghi của một con bò theo thứ tự ngày, lọc, mở chi tiết theo quyền | Owner, Manager, Technician | SCR-50 (tab Dòng thời gian trong SCR-19) |

**Mở từ SCR-50 nhưng thuộc FE khác:** popup sửa / loại / hủy của FE-08 (cân), FE-09 (tiêm), FE-11 (động dục, phối), FE-12 (khám thai, thai và đẻ).

**Không phải sự kiện dòng thời gian:** lịch tiêm, mũi sắp tới, nhắc việc (GBR-37).

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem dòng thời gian, lọc, bật "Hiện chỉnh sửa" | Có | Có | Có |
| Mở chi tiết nguồn | Theo quyền xem của màn hình nguồn | Theo quyền xem | Theo quyền xem; **phiếu xuất chỉ hiện trạng thái, ngày, loại** |
| Sửa / Hủy từ dòng thời gian | Theo quyền ở FE nguồn (Q2) | Có – sự kiện chăm sóc / sinh sản khi bật "Hiện chỉnh sửa" | — |

Bò EXITED / VOIDED: vẫn xem đủ lịch sử (GBR-26).

---

## 3. Dữ liệu

FE-16 **không lưu dữ liệu riêng**: dòng thời gian dựng từ bản ghi nguồn của FE-04 → FE-06, FE-08 → FE-13, không sao chép, không tạo / sửa sự kiện (GBR-37).

### 3.1 Nhóm sự kiện (chip lọc)

| Chip | Nguồn |
|---|---|
| Identification & QR / Định danh & QR | FE-05: đăng ký, đổi số tai / tên, cấp / thay thẻ QR |
| Purpose / stage / Mục đích / giai đoạn | FE-05: đổi mục đích, giai đoạn |
| Pen / Chuồng | FE-04: phân chuồng, chuyển chuồng |
| Weight & BCS / Cân & BCS | FE-08 |
| Vaccination / Tiêm phòng | FE-09 (tiêm tại trại, lịch sử) |
| Health / Sức khỏe | FE-10: ca, điều trị, đóng ca |
| Reproduction / Sinh sản | FE-11, FE-12: động dục, phối, khám thai, thai, đẻ |
| Entry & exit / Nhập & xuất | FE-06, FE-13 |

### 3.2 Một mục dòng thời gian

| Thuộc tính | Ràng buộc |
|---|---|
| Loại sự kiện, nhóm | Theo §3.1 |
| Tiêu đề + giá trị chính | Ví dụ "Cân 342 kg · BCS 3,5" |
| Nhãn cơ sở | Đo / Ước tính / Lịch sử / Tại trại – khi có nghĩa |
| Chi tiết | Phương pháp, lô, thuốc, kết quả, lý do… |
| Thời điểm xảy ra, thời điểm ghi, người ghi | Luôn hiện cả hai thời điểm |
| Trạng thái bản ghi | VALID; VALID + "Đã sửa"; EXCLUDED; VOIDED |
| Lý do sửa / loại / hủy | Từ Record Revision |
| Nguồn | Loại + ID để mở chi tiết |

### 3.3 Record Revision (đọc)

Lịch sử trước / sau bất biến của mỗi lần sửa / loại / hủy: loại bản ghi + ID, hành động (CORRECT / EXCLUDE / VOID), lý do, giá trị trước, giá trị sau, người, thời điểm. Một revision cho mỗi lệnh sửa được chấp nhận.

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-16-01 | Chỉ đọc; không lưu bản sao; không tạo / sửa sự kiện. | GBR-37 |
| R-16-02 | Sắp theo **thời điểm xảy ra** (mới nhất trước – Q3), nhóm theo tháng; hiện cả thời điểm xảy ra và thời điểm ghi. | GBR-37 |
| R-16-03 | Bản ghi đã sửa hiện giá trị hiệu lực + nhãn "Đã sửa". | GBR-37 |
| R-16-04 | Bản ghi bị loại / hủy ẩn mặc định; bật "Hiện chỉnh sửa" → hiện bản gốc đã sửa, bản ghi loại / hủy tô xám kèm lý do. | GBR-37 |
| R-16-05 | Lịch tiêm, mũi sắp tới, nhắc việc **không** có trên dòng thời gian. | GBR-37 |
| R-16-06 | Mở chi tiết: mở bản ghi nguồn trong tab hồ sơ (SCR-20, 29, 43, 49, 54, 60) hoặc chi tiết phiếu (SCR-75, SCR-76) nếu vai trò được xem; nếu không → MSG-FE16-01. Technician: xuất đàn chỉ hiện trạng thái, ngày, loại. | SCR-50 |
| R-16-07 | Sửa / Hủy: chỉ hiện với Manager trên sự kiện chăm sóc / sinh sản khi bật "Hiện chỉnh sửa"; mở popup của FE nguồn; quy tắc lưu theo FE nguồn (lý do, version, Idempotency-Key). | SCR-50, GBR-88, GBR-89 |
| R-16-08 | Bò EXITED / VOIDED vẫn hiện đủ lịch sử; bò trên phiếu chết PENDING vẫn sửa / hủy được bản ghi cũ. | GBR-26 |
| R-16-09 | Chỉ dữ liệu của trại hiện tại; bò trại khác → không tìm thấy. | Tenant |

---

## 5. Luồng xử lý

### UC-FE16-01 Xem dòng thời gian
1. Thành viên mở SCR-19 → tab **Dòng thời gian**.
2. Hệ thống dựng danh sách sự kiện từ bản ghi nguồn, nhóm theo tháng, chip mặc định "Tất cả", "Hiện chỉnh sửa" tắt.
3. Chọn chip → lọc theo nhóm.
4. Bật "Hiện chỉnh sửa" → hiện bản gốc, bản ghi loại / hủy tô xám kèm lý do; Manager thấy nút Sửa / Hủy.
5. **Mở chi tiết** → kiểm quyền → mở nguồn, hoặc MSG-FE16-01.
6. (Manager) **Sửa / Hủy** → popup FE nguồn → sau khi lưu, dòng thời gian tải lại.

E1 bò không thuộc trại → MSG-COM-08 · E2 lỗi tải → MSG-COM-02.

---

## 6. Màn hình và trường

### SCR-50 Tab hồ sơ – Dòng thời gian

| # | Trường | Loại | Nội dung / Ràng buộc | Mặc định |
|---|---|---|---|---|
| 1 | Event filter / Lọc sự kiện | Chip | Tất cả, Định danh & QR, Mục đích / giai đoạn, Chuồng, Cân & BCS, Tiêm phòng, Sức khỏe, Sinh sản, Nhập & xuất | Tất cả |
| 2 | Show corrections / Hiện chỉnh sửa | Toggle | Hiện bản gốc đã sửa, bản ghi loại / hủy (tô xám + lý do) | Tắt |
| 3 | Month group / Nhóm tháng | Tiêu đề | Ví dụ "THÁNG 10 2026" | — |
| 4 | Event / Sự kiện | Chữ | Tiêu đề + giá trị chính | — |
| 5 | Basis tag / Nhãn cơ sở | Tag | Đo / Ước tính / Lịch sử / Tại trại | — |
| 6 | Corrected marker / Nhãn đã sửa | Tag | "Đã sửa"; bản ghi loại / hủy: "Đã loại" / "Đã hủy" + lý do | — |
| 7 | Details / Chi tiết | Chữ | Phương pháp, lô, thuốc, kết quả, lý do… | — |
| 8 | Times and recorder / Thời gian và người ghi | Chữ | "Xảy ra dd/mm HH:mm · ghi dd/mm HH:mm · bởi tên" | — |
| 9 | Open details / Xem chi tiết | Nút | R-16-06; MSG-FE16-01 | — |
| 10 | Correct / Void – Sửa / Hủy | Nút (Manager) | Khi bật "Hiện chỉnh sửa", trên sự kiện chăm sóc / sinh sản: mở popup "Sửa / Loại bản ghi tăng trưởng", "Sửa / Hủy tiêm phòng", "Sửa / Hủy động dục hoặc phối", "Sửa / Hủy khám thai", "Sửa / Hủy bản ghi thai và đẻ" | — |
| 11 | Empty state / Trống | Chữ | "Chưa có sự kiện" (Q4) | — |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Dòng thời gian | `category?` (enum §3.1), `showCorrections` (bool), `page?, size?` | `[{id, category, type, title, keyValues, basis?, details, occurredAt, recordedAt, recordedBy, status (VALID \| CORRECTED \| EXCLUDED \| VOIDED), reason?, originalValues?, source{type, id, screen}, canOpen, canCorrect}]` | COM-08, COM-03 | `GET /api/farms/{farmId}/cattle/{id}/timeline` |
| A2 | Mở chi tiết | Route chi tiết của FE nguồn; BE kiểm quyền | Bản ghi nguồn hoặc 403 → MSG-FE16-01 | FE16-01 | Route các FE nguồn |
| A3 | Sửa / Hủy | Route sửa / hủy của FE-08, 09, 11, 12 với `reason, version` + `Idempotency-Key` | — | Theo FE nguồn | Route các FE nguồn |

Ghi chú: `canOpen`, `canCorrect` do BE tính theo vai trò để FE ẩn / hiện nút; BE vẫn kiểm lại khi gọi A2, A3.

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE16-01 | Trong chi tiết | Vai trò của bạn không được xem chi tiết sự kiện này. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-16-01 | Bò có cân, tiêm, chuyển chuồng | Mở tab | Sự kiện theo thời điểm xảy ra, nhóm theo tháng, đủ 2 thời điểm + người ghi | I, E | R-16-02 |
| TC-16-02 | Cân xảy ra 01/10, ghi 05/10; tiêm xảy ra 03/10, ghi 03/10 | Xem | Thứ tự theo ngày xảy ra (03/10 trước 01/10 nếu mới nhất trước) | U | R-16-02 |
| TC-16-03 | Cân 342 kg sửa thành 324 kg | Xem, toggle tắt | Hiện 324 kg + "Đã sửa" | I | R-16-03 |
| TC-16-04 | Cân bị loại (outlier), tiêm bị hủy | Toggle tắt / bật | Ẩn / hiện tô xám + lý do | I, E | R-16-04 |
| TC-16-05 | Bò có lịch tiêm, mũi PLANNED, REM-01 | Xem | Không có các mục này | I | R-16-05 |
| TC-16-06 | Chip "Sinh sản" | Chọn | Chỉ động dục, phối, khám, thai, đẻ | I | §3.1 |
| TC-16-07 | Technician, sự kiện xuất đàn | Xem / mở | Chỉ trạng thái, ngày, loại; không có số tiền, người mua | I, E | R-16-06 |
| TC-16-08 | Technician mở chi tiết phiếu nhập | Mở | MSG-FE16-01 (nếu không có quyền xem SCR-75) | E | R-16-06 |
| TC-16-09 | Manager, toggle bật, sự kiện cân | Xem | Có nút Sửa / Hủy → popup FE-08 | E | R-16-07 |
| TC-16-10 | Technician, toggle bật | Xem | Không có nút Sửa / Hủy | E, H | R-16-07 |
| TC-16-11 | Manager sửa từ dòng thời gian với version cũ | Lưu | MSG-COM-05 | I | GBR-89 |
| TC-16-12 | Bò EXITED | Mở tab | Hiện đủ lịch sử | I | R-16-08 |
| TC-16-13 | Bò của trại khác | Gọi A1 | 404 / MSG-COM-08 | H | R-16-09 |
| TC-16-14 | Gọi A1 nhiều lần | — | Không tạo / sửa bản ghi nào | I | R-16-01 |
| TC-16-15 | Bò thay thẻ QR | Chip Định danh & QR | Có sự kiện thay thẻ + lý do | I | §3.1 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Không có đặc tả UC ở Part II | Dùng Part III + GBR-37 |
| Q2 | SRS chỉ nói Manager có Sửa / Hủy trên dòng thời gian; Owner thì sao? | Owner theo quyền sửa của FE nguồn (đề xuất có, đồng nhất với tab nguồn) |
| Q3 | Thứ tự mới nhất trước hay cũ nhất trước | Mới nhất trước |
| Q4 | Trạng thái rỗng, phân trang | "Chưa có sự kiện"; tải thêm theo tháng |
| Q5 | Sự kiện điều trị / đóng ca (FE-10) có Sửa / Hủy từ dòng thời gian? | Không – SRS chỉ liệt kê 5 popup |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho AnNT duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
