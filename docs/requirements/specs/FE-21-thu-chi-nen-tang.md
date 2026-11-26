# SPEC FE-21 – Thu chi và báo cáo dòng tiền nền tảng

| | |
|---|---|
| Feature | FE-21 Platform Cash Records and Reports |
| Use case | UC-FE21-01 → UC-FE21-09 |
| Người phụ trách | LamKD (BE + FE + test) · Review BE: DucNV · Review FE: AnNT |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Manual Finance Record, Subscription Receipt, Cash Report Snapshot), BR-D27, 28, 30, Part II §17 (UC-FE21-02, 06, 07, 09), Part III §21 (SCR-70 → SCR-73), MSG-FE21-01 → 14, GBR-66, 82 → 86 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.
> Đây là sổ thu chi cơ bản của nền tảng, **không phải** kế toán theo luật định.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE21-01 | Xem biên lai gói (chỉ đọc), truy nguồn | PM | SCR-70 |
| UC-FE21-02 | Tạo khoản thu / chi thủ công (DRAFT) | PM | SCR-72 |
| UC-FE21-03 | Xem và lọc khoản thủ công | PM | SCR-71 |
| UC-FE21-04 | Sửa nháp | PM | SCR-72 |
| UC-FE21-05 | Bỏ nháp | PM | SCR-72 |
| UC-FE21-06 | Ghi sổ | PM | SCR-72 |
| UC-FE21-07 | Hủy (VOID) khoản đã ghi sổ | PM | SCR-72 |
| UC-FE21-08 | Chạy báo cáo dòng tiền (snapshot) | PM | SCR-73 |
| UC-FE21-09 | Xuất XLSX từ snapshot đang hiển thị | PM | SCR-73 |

---

## 2. Vai trò và quyền

Chỉ **PM** có quyền ACTIVE (MSG-COM-01 / 403 cho mọi vai trò khác). Biên lai: không có thao tác sửa / hủy.

---

## 3. Dữ liệu

### 3.1 Khoản thu chi thủ công (Manual Finance Record)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Mã | `FR-nnnn` | Hệ thống | Duy nhất | §3.2 |
| Loại | Enum | Có | `INCOME` Thu / `EXPENSE` Chi | GBR-83 |
| Danh mục | Enum | Có | Phù hợp với loại (MSG-FE21-10); danh sách từ API danh mục (Q1) | GBR-83 |
| Số tiền (VND) | Số nguyên | Có | ≥ 1 (MSG-FE21-09) | BR-D27 |
| Ngày phát sinh | Ngày | Có | Không tương lai | SCR-72 |
| Phạm vi | Enum | Có | `GENERAL` Chung nền tảng / `FARM` Gắn với trại | GBR-83 |
| Trại | Tham chiếu | Có khi FARM | GENERAL không có trại | BR-D27 |
| Số chứng từ | Chuỗi | Không | ≤ 100 | SCR-72 |
| Mô tả | Chuỗi dài | Không | ≤ 500 | SCR-72 |
| Nguồn | Enum | Có | `MANUAL` Nhập tay / `BANK_TRANSACTION` Giao dịch NH | §3.2 |
| Giao dịch NH | Tham chiếu | Có khi nguồn NH | Giao dịch đã xác thực; không phải chuyển khoản gói; chưa được ghi nhận (MSG-FE21-08) | GBR-84, BR-D28 |
| Trạng thái | Enum | — | `DRAFT` → `POSTED` → `VOID`; DRAFT có thể bỏ | GBR-83 |
| Người / thời điểm tạo, ghi sổ, hủy; lý do hủy; khoản thay thế | — | — | — | §3.2 |
| Lịch sử | — | — | Tạo, sửa (trường đổi), ghi sổ, hủy (lý do), bỏ | SCR-72 |
| Version | — | — | Khóa lạc quan | GBR-89 |

### 3.2 Biên lai gói (Subscription Receipt) – suy ra, chỉ đọc

Mã `RC-yy-nnnn`, mã thanh toán, trại, kỳ hạn, phiên bản giá, số tiền, giờ NH ghi nhận (= ngày dòng tiền), giờ xác nhận + nguồn (SePay tự động / PM ACCEPT), kỳ đã mua, chứng từ. 1 biên lai / yêu cầu PAID. Không sửa, không hủy, không nhập lại thành thu thủ công (GBR-82).

### 3.3 Snapshot báo cáo dòng tiền

| Thuộc tính | Ràng buộc |
|---|---|
| Mã snapshot | Duy nhất |
| Người yêu cầu, thời điểm tạo | — |
| Kỳ | Asia/Ho_Chi_Minh, tối đa 24 tháng |
| Lọc trại | Tất cả / 1 trại |
| Lọc nguồn | Biên lai + thủ công (mặc định) / Chỉ biên lai / Chỉ thủ công |
| Dòng | Kèm tham chiếu nguồn + version |
| Tổng | Biên lai, thu khác, chi, ròng – theo phạm vi |
| Trạng thái | `AVAILABLE` → `EXPIRED` (sau thời gian lưu – Q2); làm mới = snapshot mới |

Snapshot bất biến (BR-D30).

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-21-01 | Chỉ PM tạo khoản thủ công: INCOME / EXPENSE, danh mục phù hợp, số nguyên VND > 0, ngày phát sinh, phạm vi GENERAL hoặc 1 trại. | GBR-83, BR-D27 |
| R-21-02 | DRAFT sửa / bỏ được; POSTED bất biến và vào báo cáo; POSTED → VOID chỉ với lý do. Sai sau ghi sổ → hủy + tạo khoản mới (có nút "Tạo nháp thay thế" điền sẵn). | GBR-83 |
| R-21-03 | Một giao dịch NH chỉ được ghi nhận 1 lần: không vừa là biên lai gói vừa là thu thủ công POSTED. Chuyển khoản gói đã biết bị từ chối làm thu thủ công khi tạo, sửa, ghi sổ (MSG-FE21-08). Không tự hủy / phân bổ. | GBR-84, BR-D28 |
| R-21-04 | Hủy khoản đã ghi sổ → giải phóng giao dịch NH mà khoản đó đã nhận. | UC-07 POST-2 |
| R-21-05 | Biên lai chỉ đọc, ngày dòng tiền = giờ NH ghi nhận. Biên lai = 1 thanh toán PAID có chứng từ ACCEPTED (lấy chứng từ ACCEPTED đầu tiên); trang Biên lai gói và báo cáo dùng cùng quy tắc nên tổng khớp nhau. PAID không có chứng từ ACCEPTED không phải biên lai. | GBR-82 |
| R-21-06 | Dòng tiền ròng = biên lai (theo giờ NH) + thu thủ công POSTED − chi thủ công POSTED (theo ngày phát sinh). Lọc 1 trại → chỉ nguồn của trại đó; GENERAL chỉ ở tổng nền tảng. Loại trừ DRAFT, VOID, yêu cầu chưa trả, chứng từ chưa chấp nhận. Nhãn "không phải lợi nhuận theo luật định". | GBR-85 |
| R-21-07 | Mỗi lần chạy tạo snapshot; xuất dùng **snapshot đang hiển thị**; snapshot hết hạn → MSG-FE21-12, phải chạy lại. Snapshot cũ giữ khoản đã hủy sau đó như tại thời điểm tạo. | GBR-85, BR-D30, UC-07 POST-1 |
| R-21-08 | Kỳ theo Asia/Ho_Chi_Minh, [đầu ngày đầu, đầu ngày sau ngày cuối); tối đa 24 tháng; ngày cuối được ở tương lai (vd. cả tháng hiện tại), chỉ cần ngày đầu ≤ ngày cuối. Áp dụng cho báo cáo và lọc danh sách khoản. | GBR-66, SCR-73 |
| R-21-09 | Ghi sổ, hủy ghi audit cùng transaction. | GBR-86 |
| R-21-10 | Lệnh có Idempotency-Key; sửa / ghi sổ / hủy / bỏ có version → MSG-COM-05. | GBR-88, GBR-89 |

---

## 5. Luồng xử lý

### UC-FE21-02 Tạo khoản
1. SCR-72 mới. 2. PM chọn loại, danh mục phù hợp, số tiền, ngày phát sinh, phạm vi (+ trại), số chứng từ, mô tả, nguồn. 3. **Lưu nháp**. 4. Kiểm trường, loại–danh mục, nguồn NH (R-21-03). 5. Lưu DRAFT + lịch sử → MSG-FE21-01.
AF1 nguồn NH → chọn giao dịch đã xác thực, đề xuất số tiền + ngày · AF2 Hủy.
E1 thiếu → MSG-COM-06 · E2 số tiền → MSG-FE21-09 · E3 danh mục → MSG-FE21-10 · E4 xung đột nguồn → MSG-FE21-08 · E5 lỗi → MSG-COM-02.

### UC-FE21-04 / 05 Sửa / bỏ nháp
Sửa: như tạo, có version → MSG-FE21-01. Bỏ: MSG-FE21-06 → xác nhận → MSG-FE21-07; nháp không xuất hiện ở báo cáo nào.

### UC-FE21-06 Ghi sổ
1. **Ghi sổ** → MSG-FE21-03. 2. Xác nhận. 3. Kiểm lại mọi trường, nguồn, version. 4. POSTED + người + thời điểm, lịch sử, audit – 1 transaction. 5. MSG-FE21-02.
E1 → MSG-FE21-09 / 10 · E2 → MSG-FE21-08 · E3 → MSG-COM-05 · E4 → MSG-COM-02.

### UC-FE21-07 Hủy
1. **Hủy** → MSG-FE21-04 + ô lý do. 2. Nhập lý do, xác nhận. 3. Kiểm trạng thái, version. 4. VOID, giải phóng nguồn, lịch sử, audit. 5. MSG-FE21-05 + "Tạo nháp thay thế".
E1 thiếu lý do → MSG-COM-06 · E2 đã VOID / đổi → MSG-COM-05.

### UC-FE21-08 Chạy báo cáo
Chọn Từ ngày *, Đến ngày *, trại, nguồn trên một hàng lọc → **Chạy báo cáo** (cuối hàng lọc) → tạo snapshot → MSG-FE21-11 → hiện dòng thông tin bản chốt, 3 ô tổng, biểu đồ, bảng **Dòng tiền theo trại**. Đổi bộ lọc mà chưa chạy lại → nhắc "Bộ lọc đã đổi". Snapshot không có giao dịch → báo ngay trên trang (không mở hộp thoại).

AF1 xem theo trại: bấm tên trại trong bảng → hộp thoại **Giao dịch của {trại}**: 3 ô Tổng thu / Tổng chi / Ròng trên một hàng; hàng lọc gồm ô tìm (mã, nguồn, danh mục), Loại (Thu & chi / Thu / Chi), Danh mục (chỉ danh mục có trong trại) và nút **Tìm** — chỉ áp dụng khi bấm Tìm hoặc Enter; danh sách giao dịch phân trang. Bấm một dòng → hộp thoại **Chi tiết {mã}** (ô chỉ đọc): loại giao dịch, số tiền, ngày dòng tiền, danh mục, phạm vi, trạng thái, nguồn (thanh toán / chứng từ hoặc diễn giải), phiên bản nguồn.

### UC-FE21-09 Xuất XLSX
1. **Xuất báo cáo** → hộp thoại **Xem trước báo cáo**: mô phỏng bảng tính (tiêu đề cột A, B, C…, số dòng, thẻ sheet phía dưới) đúng nội dung tệp sẽ tải. 2. **Tải xuống XLSX** → kiểm quyền PM, snapshot còn hiệu lực. 3. Tệp gồm 4 sheet, nhãn tiếng Việt, số tiền VND, giờ Việt Nam:
   - **Tổng hợp** (không lặp nội dung các sheet sau): thông tin báo cáo (kỳ, trại / nguồn đang lọc, mã bản chốt + giờ tạo, đơn vị); kết quả chính (Tổng thu – trong đó thu từ gói đăng ký, thu khác; Tổng chi; Dòng tiền ròng; Tỷ lệ chi / thu); theo tháng (mỗi tháng trong kỳ, kể cả tháng trống: thu, chi, ròng, ròng lũy kế); theo danh mục (thu và chi, số tiền + tỷ trọng); điểm nổi bật (số giao dịch thu, số giao dịch chi, trại thu nhiều nhất, danh mục chi lớn nhất).
   - **Theo trại**: trại, thu từ gói đăng ký, thu khác, tổng thu, chi, ròng; dòng Chung nền tảng và dòng tổng.
   - **Thu** / **Chi**: mỗi giao dịch một dòng (ngày, mã, loại nguồn, danh mục, trại, số tiền, trạng thái, nguồn, phiên bản nguồn) + dòng tổng có số giao dịch.
4. Trả file → MSG-FE21-13.
AF1 báo cáo rỗng → file có đủ 4 sheet, tổng 0 và hàng tiêu đề.
Ghi chú triển khai: FE `buildWorkbookPreview` và BE `PlatformFinanceWorkbook` dùng cùng bố cục. Tệp có định dạng: tiêu đề in đậm, hàng tiêu đề nền xanh, dòng tổng in đậm, số tiền dạng `#,##0` (âm màu đỏ), độ rộng cột cố định; danh mục và trạng thái hiển thị nhãn tiếng Việt; giao dịch sắp theo ngày.
E1 hết hạn → MSG-FE21-12 · E2 lỗi xuất → MSG-FE21-14 · E3 không phải PM → MSG-COM-01.

---

## 6. Màn hình và trường

### SCR-70 Biên lai gói

| # | Trường | Nội dung |
|---|---|---|
| 1 | Search / Tìm | Mã biên lai hoặc mã thanh toán |
| 2 | Farm / Trại | Dropdown |
| 3 | Bank date / Ngày NH | Khoảng ngày (Asia/Ho_Chi_Minh); MSG-COM-11 |
| 4 | Summary tiles | Số biên lai trong kỳ, Tổng tiền (theo giờ NH) |
| 5 | Open report / Mở báo cáo | Link SCR-73 |
| 6 | Receipt code, Farm, Term, Amount, Bank time | Cột chỉ đọc, sắp theo giờ NH |
| 7 | Chi tiết: Payment | Mã + PAID |
| 8 | Price version · term, Amount | Chỉ đọc |
| 9 | Bank paid at, Confirmed at | Kèm nguồn xác nhận (SePay tự động / PM ACCEPT) |
| 10 | Purchased period | Bắt đầu → kết thúc |
| 11 | Trace / Truy nguồn | Trại, mã chứng từ; "Mở thanh toán / chứng từ nguồn" (SCR-62). **Không có** nút sửa / hủy |

### SCR-71 Khoản thu chi thủ công

| # | Trường | Nội dung |
|---|---|---|
| 1 | Add record / Thêm khoản | SCR-72 |
| 2 | Type / Loại | Thu & chi / Thu / Chi |
| 3 | Category / Danh mục | Dropdown |
| 4 | Occurrence date / Ngày phát sinh | Khoảng ngày |
| 5 | Scope / Phạm vi | Tất cả / Chung / 1 trại |
| 6 | Tabs | Tất cả, Nháp, Đã ghi sổ, Đã hủy – có số |
| 7 | Occurrence date, Type, Category, Scope, Description | Cột |
| 8 | Amount / Số tiền | +số tiền (thu), −số tiền (chi), VND |
| 9 | Status | DRAFT / POSTED / VOID |

### SCR-72 Form khoản thu chi

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Header | Chỉ đọc | — | Mã + trạng thái | — |
| 2 | Actions / Thao tác | Nút | — | DRAFT: Bỏ nháp (MSG-FE21-06 / 07), Lưu nháp (MSG-FE21-01), Ghi sổ (MSG-FE21-03 / 02). POSTED: Hủy (MSG-FE21-04 / 05). VOID: Tạo nháp thay thế | MSG-COM-05, MSG-COM-02 |
| 3 | Type / Loại | Radio | * | Thu / Chi; chỉ sửa khi DRAFT | MSG-COM-06 |
| 4 | Category / Danh mục | Dropdown | * | Lọc theo loại | MSG-FE21-10 |
| 5 | Amount (VND) / Số tiền | Số nguyên | * | ≥ 1 | MSG-FE21-09 |
| 6 | Occurrence date / Ngày phát sinh | Ngày | * | Không tương lai | MSG-COM-06, MSG-COM-10 |
| 7 | Scope / Phạm vi | Radio | * | Chung nền tảng / Gắn với trại | MSG-COM-06 |
| 8 | Farm / Trại | Dropdown | * khi Gắn với trại | — | MSG-COM-06 |
| 9 | Document number / Số chứng từ | Ô chữ | — | ≤ 100 | MSG-COM-10 |
| 10 | Description / Mô tả | Ô chữ dài | — | ≤ 500 | MSG-COM-10 |
| 11 | Source / Nguồn | Radio | * | Nhập tay / Giao dịch NH | — |
| 12 | Bank transaction / Giao dịch NH | Chọn | * khi nguồn NH | Giao dịch đã xác thực; đề xuất số tiền + ngày | MSG-FE21-08 |
| 13 | History / Lịch sử | Bảng | — | Thời điểm / Hành động / Người | — |
| 14 | Note / Lưu ý | Chữ | — | "Sổ thu chi cơ bản của nền tảng, không phải kế toán theo luật định." | — |
| 15 | Save at bottom / Lưu cuối phiếu | Nút | — | Nút **Lưu nháp** thứ hai ở cuối biểu mẫu, cùng việc với nút đầu trang (DRAFT / mới) | MSG-FE21-01 |

Bố cục SCR-72 từ trên xuống: **Loại** (kèm **Danh mục** bên dưới) cạnh **Nguồn khoản** (kèm nút **Chọn chứng từ ngân hàng**: sáng khi nguồn là Giao dịch NH, mờ khi Nhập tay); hàng **Gắn với trại (Không / Có) – Trang trại (mờ khi Không) – Số chứng từ**; **Số tiền** và **Ngày phát sinh** (luôn hiện; mờ và không nhập được khi nguồn là giao dịch NH vì lấy theo giao dịch); **Diễn giải**; nút **Lưu nháp** ở cuối. Ghi sổ chỉ dùng bản đã lưu: có thay đổi chưa lưu thì khóa Ghi sổ và nhắc Lưu nháp.

### SCR-73 Báo cáo dòng tiền nền tảng

| # | Trường | Loại | Bắt buộc | Ràng buộc / Nội dung | Lỗi |
|---|---|---|---|---|---|
| 1 | Period / Kỳ | Khoảng ngày | * | Asia/Ho_Chi_Minh, ≤ 24 tháng | MSG-COM-11, MSG-COM-10 |
| 2 | Farm / Trại | Dropdown | — | Tất cả (mặc định) / 1 trại | — |
| 3 | Sources / Nguồn | Radio | — | Biên lai + thủ công (mặc định) / Chỉ biên lai / Chỉ thủ công | — |
| 4 | Run report / Chạy báo cáo | Nút | — | Cuối hàng lọc; tạo snapshot mới; MSG-FE21-11 | MSG-COM-02 |
| 5 | Snapshot info / Thông tin bản chốt | Chỉ đọc | — | Một dòng: mã snapshot, thời điểm chốt, kỳ, trại, múi giờ, VND. Thông báo (lỗi / hết hạn / bộ lọc đã đổi) gom một chỗ | MSG-FE21-12 |
| 6 | Total income / Tổng thu | Số | — | Biên lai + thu khác POSTED, có tách | — |
| 7 | Total expense / Tổng chi | Số | — | Chi POSTED | — |
| 8 | Net cash flow / Dòng tiền ròng | Số | — | Thu − chi; ghi chú dưới số: "Thu − chi · không phải lợi nhuận theo luật định" | — |
| 9 | Charts / Biểu đồ | Biểu đồ | — | Tính từ dòng của snapshot: Thu và chi theo ngày (cột đôi); Xu hướng dòng tiền ròng (đường lũy kế); Cơ cấu thu theo danh mục; Chi theo danh mục; Thu theo trại (thanh xếp hạng có %) | — |
| 10 | Cash flow by farm / Dòng tiền theo trại | Bảng | — | Cột Trại / Thu từ gói đăng ký / Thu khác / Chi / Ròng. Dòng: Chung nền tảng, từng trại có nguồn, trại khác (gộp), Tổng nền tảng. Lọc 1 trại → chỉ trại đó, không có Chung, dòng tổng ghi "Tổng cộng" (không ghi "Toàn nền tảng"). Dòng "trại khác (gộp)" chưa làm (Q6). Bấm trại → UC-FE21-08 AF1 | — |
| 11 | Export report / Xuất báo cáo | Nút | — | Mở Xem trước báo cáo (mô phỏng Excel, 4 sheet) → Tải xuống XLSX (UC-FE21-09) | MSG-FE21-13 / MSG-FE21-14 / MSG-FE21-12 |

Không có nút "Xem chi tiết giao dịch" toàn snapshot và không có thẻ "Phạm vi tính"; giao dịch xem qua từng trại.

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Biên lai: danh sách / chi tiết | `q, farmId, bankFrom, bankTo, page, size` / — | `ReceiptPage {tiles{count, total}, items[{code, farm, term, amount, bankPaidAt}]}` / `ReceiptDetail` | COM-11, COM-01 | `GET /api/platform/finance/receipts` · `GET …/receipts/{paymentId}` |
| A2 | Danh mục thu chi | — | `FinanceCategories {INCOME[], EXPENSE[]}` | — | `GET /api/platform/finance/categories` |
| A3 | Giao dịch NH chọn được | — | `[BankTransactionChoice {id, amount, bankPaidAt, content, recognizedAs?}]` | — | `GET /api/platform/finance/bank-transactions` |
| A4 | Danh sách khoản | `type, state, category, scope, farmId, from, to, page, size` | `PageRecordDTO {counts{tab}, items[]}` | COM-11 | `GET /api/platform/finance/records` |
| A5 | Tạo nháp | `CreateRecord {type, category, amount, occurredOn, scope, farmId?, documentNo?, description?, source, bankTransactionId?}` + `Idempotency-Key` | `RecordDTO` | COM-06, FE21-09, FE21-10, FE21-08, COM-02 | `POST /api/platform/finance/records` |
| A6 | Chi tiết | — | `RecordDetail {…, history[], version}` | COM-08 | `GET …/records/{id}` |
| A7 | Sửa nháp | `VersionedRecord {…A5, version}` + `Idempotency-Key` | `RecordDTO` | Như A5 + COM-05 | `PUT …/records/{id}` |
| A8 | Bỏ / ghi sổ / hủy / tạo thay thế | `VersionedAction {version, reason?}` + `Idempotency-Key` | `RecordDTO` | COM-05, COM-06, FE21-08, FE21-09, FE21-10 | `POST …/records/{id}/discard` · `…/post` · `…/void` · `…/replacement` |
| A9 | Chạy báo cáo | `ReportRequest {from, to, farmId?, sources}` + `Idempotency-Key` | `CashReport {snapshotCode, generatedAt, timeZone, totals{income{receipts, other}, expense, net}, byDay[], byScope[], details[]?, status}` | COM-11, COM-10, COM-02 | `POST /api/platform/finance/reports` |
| A10 | Xem snapshot | — | `CashReport` / 410 khi EXPIRED | FE21-12 | `GET …/reports/{id}` |
| A11 | Xuất XLSX | — | File XLSX 4 sheet: Tổng hợp, Theo trại, Thu, Chi (UC-FE21-09) | FE21-12, FE21-14, COM-01 | `GET …/reports/{id}/xlsx` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE21-01 | Toast thành công | Đã lưu nháp khoản {code}. |
| MSG-FE21-02 | Toast thành công | Đã ghi sổ khoản {code}. |
| MSG-FE21-03 | Hộp xác nhận | Ghi sổ {code}? Khoản đã ghi sổ không sửa được; muốn sửa phải hủy. |
| MSG-FE21-04 | Hộp xác nhận | Hủy {code}? Nhập lý do. Các báo cáo tạo sau sẽ loại trừ khoản này. |
| MSG-FE21-05 | Toast thành công | Đã hủy khoản {code}. [Tạo nháp thay thế] |
| MSG-FE21-06 | Hộp xác nhận | Bỏ nháp {code}? Nháp sẽ không xuất hiện trong báo cáo nào. |
| MSG-FE21-07 | Toast thành công | Đã bỏ nháp {code}. |
| MSG-FE21-08 | Trên form | Giao dịch ngân hàng này đã được ghi nhận là {target}. Không thể ghi là thu khác. |
| MSG-FE21-09 | Dưới trường | Số tiền phải là số nguyên VND lớn hơn 0. |
| MSG-FE21-10 | Dưới trường | Danh mục {category} không dùng được cho {type}. |
| MSG-FE21-11 | Toast thành công | Đã làm mới báo cáo {code} lúc {time}. |
| MSG-FE21-12 | Banner | Kết quả báo cáo đã hết hạn. Hãy chạy lại báo cáo. |
| MSG-FE21-13 | Toast thành công | File xuất {file} đã sẵn sàng. |
| MSG-FE21-14 | Toast lỗi | Không xuất được báo cáo. [Thử lại] |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-21-01 | CS / SA / Owner | Gọi mọi API FE-21 | 403 | H | §2 |
| TC-21-02 | Thu, danh mục chi | Lưu | MSG-FE21-10 | U, H | R-21-01 |
| TC-21-03 | Số tiền 0 / −5 / 1.000,5 | Lưu | MSG-FE21-09 | U | R-21-01 |
| TC-21-04 | Ngày phát sinh ngày mai | Lưu | Lỗi | U, H | §3.1 |
| TC-21-05 | Phạm vi Gắn với trại, không chọn trại | Lưu | MSG-COM-06 | U | BR-D27 |
| TC-21-06 | Giao dịch là chuyển khoản gói đã PAID | Chọn làm nguồn thu | MSG-FE21-08 | I | R-21-03 |
| TC-21-07 | Giao dịch đã có thu thủ công POSTED khác | Ghi sổ khoản thứ 2 | MSG-FE21-08 | I | R-21-03 |
| TC-21-08 | DRAFT | Sửa / bỏ | Thành công; bỏ → không có trong báo cáo | I | R-21-02 |
| TC-21-09 | POSTED | Gọi PUT | Bị từ chối | H | R-21-02 |
| TC-21-10 | POSTED | Hủy không lý do | MSG-COM-06 | U, H | R-21-02 |
| TC-21-11 | POSTED có nguồn NH | Hủy | VOID; giao dịch được giải phóng, khoản mới dùng lại được | I | R-21-04 |
| TC-21-12 | VOID | Tạo nháp thay thế | DRAFT mới điền sẵn từ khoản cũ | I | UC-07 |
| TC-21-13 | 2 PM cùng ghi sổ 1 nháp | Đồng thời | 1 thành công; người kia MSG-COM-05 | I | R-21-10 |
| TC-21-14 | Biên lai 1.200.000 (NH 05/11), thu khác 500.000 (06/11), chi 300.000 (07/11), 1 nháp, 1 VOID | Báo cáo 01/11 – 30/11 | Thu 1.700.000; chi 300.000; ròng 1.400.000 | I | R-21-06 |
| TC-21-15 | Biên lai NH 23:30 ngày 31/10 giờ VN | Báo cáo 01/11 – 30/11 | Không tính | U | R-21-08 |
| TC-21-16 | Khoản GENERAL + khoản trại A | Lọc trại A | Chỉ khoản trại A; không có dòng Chung | I | R-21-06 |
| TC-21-17 | Yêu cầu PENDING, chứng từ HOLD | Báo cáo | Không tính | I | R-21-06 |
| TC-21-18 | Snapshot S1 chứa khoản X; sau đó X bị hủy | Xem S1 / chạy S2 | S1 vẫn có X; S2 không có | I | R-21-07 |
| TC-21-19 | Đang xem S1 | Xuất XLSX | File đúng số của S1, 4 sheet khớp bản xem trước | I, E | R-21-07 |
| TC-21-20 | S1 EXPIRED | Xuất | MSG-FE21-12 | I | UC-09 E1 |
| TC-21-21 | Kỳ không có dữ liệu | Xuất | File có tiêu đề, tổng 0 | I | UC-09 AF1 |
| TC-21-22 | Kỳ 25 tháng | Chạy | Lỗi tối đa 24 tháng | U, H | R-21-08 |
| TC-21-23 | Biên lai | Xem chi tiết | Không có nút sửa / hủy | E | R-21-05 |
| TC-21-24 | Ghi sổ | — | Có audit FINANCE_RECORD_POSTED | I | R-21-09 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Danh sách danh mục thu / chi | Cấu hình cố định qua A2; cần chốt danh sách |
| Q2 | Thời gian lưu snapshot trước khi EXPIRED | 24 giờ |
| Q3 | Độ dài lý do hủy | ≤ 500 |
| Q4 | UC-FE21-01, 03, 04, 05, 08 không có đặc tả Part II | Theo Part III + GBR |
| Q5 | Mã lỗi khi kỳ > 24 tháng | MSG-COM-10 |
| Q6 | SRS SCR-73 có dòng "other farms (aggregated)" nhưng không nói gộp theo tiêu chí nào (ngưỡng số trại? trại không có nguồn?) | Chưa làm; bảng liệt kê đủ từng trại có nguồn, có tìm / lọc / phân trang. Cần nhóm chốt tiêu chí gộp |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho LamKD duyệt) |
| 26/11/2026 | 28/10/2026 | Bố cục SCR-72 mới (luồng Loại → Nguồn → Gắn trại), ô Số tiền / Ngày mờ khi nguồn là giao dịch NH, nút Lưu cuối phiếu | Claude (theo yêu cầu LamKD) |
| 26/11/2026 | 28/10/2026 | SCR-73: hàng lọc có nút Chạy báo cáo, 5 biểu đồ từ snapshot, bảng "Dòng tiền theo trại", hộp thoại giao dịch theo trại (lọc + nút Tìm) và chi tiết giao dịch; bỏ "Xem chi tiết giao dịch", "Phạm vi tính" và các hộp thoại Đã làm mới / Báo cáo rỗng. UC-FE21-09: nút Xuất báo cáo mở bản xem trước mô phỏng Excel; tệp 4 sheet Tổng hợp / Theo trại / Thu / Chi; backend xuất XLSX theo đúng mẫu này (`PlatformFinanceWorkbook`) | Claude (theo yêu cầu LamKD) |
| 26/11/2026 | 28/10/2026 | R-21-05: biên lai = PAID + chứng từ ACCEPTED, một biên lai mỗi thanh toán, trang Biên lai và báo cáo cùng quy tắc. R-21-08: cho phép ngày cuối ở tương lai. Dòng tổng khi lọc 1 trại ghi "Tổng cộng". Thêm Q6 (trại khác gộp) | Claude (theo yêu cầu LamKD) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
