# SPEC FE-06 – Nhập đàn (phiếu nhập)

| | |
|---|---|
| Feature | FE-06 Herd Entry Management |
| Use case | UC-FE06-01 → UC-FE06-05 |
| Người phụ trách | AnNT (BE + FE + test) · Review BE: TuanPQ · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Herd Entry Voucher, Herd Entry, Pre-entry History Declaration, Trading Partner, Voucher Payment), §3.3 (BR-D07, 08, 10, 31, 34, 39), Part II §6, Part III §6 (SCR-23 → SCR-25, SCR-75, 5 popup), MSG-FE06, GBR-20, 21, 23, 25, 26, 29 → 33, 58, 90 → 93, 96, 97 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 04 (Nhập đàn) và Layout 16.
> **Lưu ý:** theo GBR-31 và GBR-93, cha mẹ và dữ liệu sinh của bê sinh tại trại **chỉ đọc** ở phiếu nhập (lấy từ lần đẻ), không được gán lại.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE06-01 | Lập phiếu nhập (mua; hoặc bê sinh tại trại) và ghi sổ để tạo bò | Owner, Manager | SCR-24, SCR-25, popup Dòng bò, popup Nhập từ Excel |
| UC-FE06-02 | Xem phiếu nhập, chi tiết, lịch sử, bê chờ xác nhận | Owner, Manager | SCR-23, SCR-75, SCR-25 |
| UC-FE06-03 | Sửa / hủy bản ghi nhập của một con | Owner, Manager | Popup Sửa / Hủy bản ghi nhập |
| UC-FE06-04 | Ghi / hủy thanh toán cho người bán | Owner, Manager | Popup Ghi thanh toán (dùng chung với FE-13, FE-23) |
| UC-FE06-05 | Hủy cả phiếu nhập | Owner, Manager | Popup Hủy phiếu nhập |

**Liên quan:** "Đăng ký ngay" khi ghi đẻ (FE-12 UC-FE12-04) tự tạo và ghi sổ phiếu FARM_BORN theo logic của gói này; thêm bò vào lịch tiêm (FE-09 UC-FE09-03).

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem, lập, sửa nháp, ghi sổ, hủy nháp | Có | Có | — |
| Sửa / hủy bản ghi nhập một con, hủy phiếu | Có | Có | — |
| Ghi / hủy thanh toán người bán | Có | Có | — |
| Thêm người bán mới ngay trên phiếu | Có | Có | — |

Cần trại ACTIVE, có ít nhất 1 giống, 1 mục đích, 1 chuồng ACTIVE (UC-01 PRE-2).

---

## 3. Dữ liệu

### 3.1 Phiếu nhập (Herd Entry Voucher)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Mã phiếu | `PN-YYYY-nnnn` | Hệ thống | Duy nhất trong trại, theo dãy từng năm, không tái sử dụng | BR-D34 |
| Loại | `PURCHASE` / `FARM_BORN` | Có | Cố định sau lần lưu đầu | §3.2, SCR-24 |
| Ngày nhập | Ngày | Có | Không ở tương lai, không trước ngày sinh của dòng nào (PURCHASE) | SCR-24 |
| Người bán / chủ cũ | Đối tác (vai trò SELLER) | Có (PURCHASE) | Đối tác ACTIVE | SCR-24 |
| Số giấy kiểm dịch | Chuỗi | Không | ≤ 50; trống → cảnh báo MSG-FE06-24, không chặn | SCR-24 |
| Biển số xe | Chuỗi | Không | ≤ 20 | SCR-24 |
| Ghi chú nhận | Chuỗi dài | Không | ≤ 1.000 | SCR-24 |
| Cách tính giá | `PER_KG` / `PER_HEAD` | Có (PURCHASE) | Áp cho mọi dòng; mặc định theo kg | GBR-92 |
| Tiền bò | Số nguyên VND | Suy ra | Σ tiền dòng | GBR-91 |
| Phí vận chuyển | Số nguyên VND | Không | ≥ 0 | SCR-24 |
| Tổng phải trả | Suy ra | — | Tiền bò + phí vận chuyển | GBR-91 |
| Đã trả (lúc lập) | Số nguyên VND | Không | 0 ≤ đã trả ≤ tổng phải trả | SCR-24 |
| Còn nợ | Suy ra | — | Tổng − Σ thanh toán RECORDED | GBR-91 |
| Hình thức thanh toán | `CASH` / `BANK_TRANSFER` | Có khi đã trả > 0 | — | SCR-24 |
| Hạn trả phần còn lại | Ngày | Không | — | SCR-24 |
| Trạng thái thanh toán | Suy ra | — | Chưa trả / Trả một phần / Đã trả | GBR-91 |
| Đính kèm | File | Không | PDF / JPG, ≤ 10 MB mỗi file | SCR-24 |
| Trạng thái | Enum | Có | `DRAFT` → `POSTED` → `VOIDED`; DRAFT có thể bỏ | §3.2 |
| Người tạo, người ghi sổ + thời điểm, lý do / người / thời điểm hủy | — | — | — | §3.2 |
| Phiếu FARM_BORN | — | — | **Không có số tiền** | GBR-93 |

### 3.2 Dòng nhập (Herd Entry – mỗi con một dòng)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Số dòng | Số | Hệ thống | Duy nhất trong phiếu | §3.2 |
| Số tai | Chuỗi | Không | ≤ 30; duy nhất trong bò ACTIVE và các dòng khác; trống = "Gắn tai sau" | Popup Dòng bò |
| Tên | Chuỗi | Không | ≤ 50 | Popup |
| Ảnh | File | Không | JPG / PNG ≤ 5 MB; thành ảnh của bò khi ghi sổ | Popup |
| Màu lông, đặc điểm | Chuỗi | Không | ≤ 255; khuyến nghị khi không có số tai | Popup |
| Giống | Danh mục | Có | ACTIVE | Popup |
| Giới tính | Enum | Có | Đực / Cái | Popup |
| Ngày sinh / tuổi | Ngày, tháng-năm, hoặc tuổi (tháng) | Không | Tuổi 1–240 → tháng sinh = ngày nhập − tuổi, độ chính xác Ước tính | Popup |
| Độ chính xác ngày sinh | Enum | — | Chính xác / Ước tính / Không rõ | Popup |
| Giai đoạn | Enum | Có | Đề xuất từ tuổi lúc nhập theo tham số trại; sửa được | GBR-25 |
| Mục đích | Danh mục | Có | ACTIVE; SIRE chỉ đực, BREEDING chỉ cái | GBR-25 |
| Cân lúc nhập (kg) | Số | Có (bắt buộc khi tính theo kg) | 1–1.500 | Popup, GBR-92 |
| Cơ sở cân | Enum | Có | Đo / Ước tính ("UT") | GBR-92 |
| Chuồng nhận | Chuồng | Có | ACTIVE, đủ chỗ; không đạt tiêu chí → lý do cảnh báo | GBR-20, 21 |
| Đơn giá | Số nguyên VND | Không | ≥ 0 | Popup |
| Tiền dòng | Suy ra | — | Đơn giá × cân (theo kg) hoặc đơn giá (theo con) | GBR-91 |
| Cách ly đến | Ngày | Không | Không trước ngày nhập; chọn nhanh +14 / +21 ngày | Popup |
| Nguồn | Enum | Hệ thống | `EXTERNAL` (mua) / `FARM_BORN` | GBR-29 |
| Kết quả bê (FARM_BORN) | Tham chiếu | — | Mỗi kết quả bê đăng ký tối đa 1 lần | GBR-29, BR-D10 |
| Trạng thái | Enum | — | `VALID` → `VOID` | §3.2 |

### 3.3 Khai báo lịch sử trước khi nhập (chỉ bò mua)

| Nhóm | Trạng thái (bắt buộc) | Chi tiết khi Có thông tin | Ghi khi ghi sổ |
|---|---|---|---|
| Tiêm phòng | Có / Không / Không rõ (mặc định Không rõ) | Dòng: vắc-xin (vắc-xin ACTIVE hoặc chữ tự do), ngày (ngày hoặc tháng, tùy chọn), nguồn thông tin | Bản ghi tiêm nguồn `HISTORICAL`, **không** tạo mũi theo lịch |
| Bệnh đã biết | Có / Không / Không rõ | Mô tả ≤ 1.000 | — |
| Sinh sản (chỉ bò cái) | Có / Không / Không rõ | Số lứa đã đẻ 0–15; mang thai lúc nhập Có / Không / Không rõ; số tháng mang thai ước tính 1–9 (khi Có); mô tả ≤ 1.000 | Số lứa cộng vào số lứa của bò; mang thai khai báo → hiện "Khai báo mang thai ~n tháng (chưa khám)", tạo REM-03, **không** mở giai đoạn mang thai |

"Không rõ" không bao giờ hiển thị như "Không" (GBR-30).

### 3.4 Đối tác (Trading Partner) – thêm nhanh từ phiếu

| Thuộc tính | Ràng buộc |
|---|---|
| Tên | Duy nhất trong trại, không phân biệt hoa thường |
| Vai trò | SELLER / BUYER / SUPPLIER (Owner quản lý người mua; Owner, Manager quản lý người bán và nhà cung cấp) |
| SĐT, khu vực / địa chỉ, ghi chú | Không bắt buộc |
| Trạng thái | ACTIVE ⇄ INACTIVE; đã được phiếu tham chiếu thì không xóa |

### 3.5 Thanh toán phiếu (Voucher Payment – dùng chung)

| Thuộc tính | Ràng buộc |
|---|---|
| Phiếu (nhập / xuất / nhập kho), chiều (`PAY` / `COLLECT`) | — |
| Ngày thanh toán | Không ở tương lai, không trước ngày phiếu |
| Số tiền | Số nguyên VND > 0, không vượt còn nợ |
| Hình thức | Tiền mặt / Chuyển khoản |
| Tham chiếu / nội dung CK | ≤ 100 |
| Đính kèm | PDF / JPG ≤ 10 MB |
| Ghi chú | ≤ 500 |
| Trạng thái | `RECORDED` → `VOIDED` (có lý do); thanh toán sai được hủy rồi ghi lại, **không sửa** |
| Ràng buộc chung | Σ RECORDED ≤ tổng phiếu (BR-D39). Chỉ là sổ sách của trại, không phải hóa đơn thuế, không thuộc tài chính platform |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-06-01 | Phiếu DRAFT chỉ Owner / Manager thấy, sửa được, bỏ được, và **không** tạo bò, đổi chuồng, công nợ hay nhắc việc. | GBR-90 |
| R-06-02 | Ghi sổ: kiểm lại mọi dòng, phần đầu và version, rồi trong **một transaction**: chuyển POSTED, tạo từng bò (Internal ID, mã hiển thị), dòng nhập, khai báo lịch sử (tiêm đã biết → bản ghi HISTORICAL), phân chuồng đầu tiên, thẻ QR ACTIVE, thanh toán ban đầu, audit. Lỗi ở 1 dòng → không ghi gì, phiếu vẫn DRAFT. | GBR-32, GBR-90, UC-01 bước 8, E9 |
| R-06-03 | Ghi sổ lặp lại (cùng khóa) trả kết quả lần đầu; không tạo bò trùng. | GBR-29, GBR-90 |
| R-06-04 | Phiếu ghi sổ phải có ít nhất 1 dòng → MSG-FE06-16. | BR-D34 |
| R-06-05 | Sau ghi sổ, dòng không thêm / bớt được; sửa theo từng con (R-06-12). | GBR-90 |
| R-06-06 | Ngày nhập không ở tương lai, không trước ngày sinh của bất kỳ dòng nào → MSG-FE06-03. | SCR-24 |
| R-06-07 | Chuồng nhận ACTIVE và đủ chỗ cho **tổng** số dòng vào chuồng đó (MSG-FE04-05); không đạt tiêu chí → lý do cảnh báo bắt buộc (MSG-FE04-06); chuồng sẽ đầy sau phiếu → cảnh báo MSG-FE06-17. | GBR-20, 21, AF6 |
| R-06-08 | Số tai / mã thẻ duy nhất (MSG-FE05-02 / MSG-FE12-08). | BR-D08 |
| R-06-09 | Tính tiền: tiền dòng theo kg = đơn giá × cân; theo con = đơn giá; số nguyên VND. Tính theo kg thì mọi dòng phải có cân. Cân ước tính gắn nhãn "UT". | GBR-91, 92 |
| R-06-10 | Đã trả ≤ tổng phải trả (MSG-FE06-13); có tiền đã trả thì bắt buộc hình thức. | GBR-91 |
| R-06-11 | Sau ghi sổ hệ thống **liệt kê** lịch tiêm có tiêu chí khớp bò mới (MSG-FE06-05); **không** tự thêm bò vào lịch. | GBR-32 |
| R-06-12 | Sửa bản ghi nhập 1 con (ngày nhập, thông tin nguồn, cân + cơ sở, đơn giá, giống, giới tính, ngày sinh + độ chính xác, khai báo lịch sử): bắt buộc lý do; lưu giá trị cũ / mới, người, thời điểm (Record Revision); tính lại tổng phiếu; Internal ID không đổi. Ngày nhập của phiếu mua áp cho **mọi** bò của phiếu. | GBR-33 |
| R-06-13 | Sửa không được làm sai thứ tự ngày (ngày nhập không sau sự kiện đã ghi của bò; ngày sinh không sau ngày nhập) và không đổi giới tính bò đã có sự kiện sinh sản → MSG-FE06-07. | UC-03 bước 4, E1 |
| R-06-14 | Hủy bản ghi nhập 1 con chỉ khi bò **không có sự kiện nào** ngoài nhập và lần xếp chuồng đầu → nếu có: MSG-FE06-09. Hủy: dòng VOID, bò VOIDED (cuối cùng), đóng phân chuồng, thẻ RETIRED, bỏ khỏi danh sách / đếm / báo cáo, trừ tiền dòng khỏi tổng phiếu; ID và mã không tái sử dụng. Dòng VALID cuối cùng → chuyển sang hủy cả phiếu. | GBR-33, UC-03 AF1 |
| R-06-15 | Hủy cả phiếu chỉ khi **mọi** bò thỏa R-06-14; có bò không thỏa → nút bị khóa, MSG-FE06-21 nêu tên các bò đó. Hủy: phiếu VOIDED + mọi dòng VOID + bò VOIDED + phân chuồng đóng + thẻ RETIRED + audit trong một transaction; thanh toán đã ghi **giữ trong lịch sử** (hoàn tiền xử lý ngoài hệ thống); bê sinh tại trại quay về PENDING_CONFIRMATION và REM-09 được tạo lại. | GBR-33, UC-05 |
| R-06-16 | Sau sửa / hủy, đã trả > tổng mới → vẫn lưu, hiện MSG-FE06-23 (chênh lệch xử lý ngoài hệ thống). | UC-03 AF2 |
| R-06-17 | Thanh toán: số nguyên > 0, không vượt còn nợ, ngày không ở tương lai và không trước ngày phiếu; hủy thanh toán bắt buộc lý do (MSG-FE06-15); không sửa thanh toán. | GBR-91, BR-D39 |
| R-06-18 | Phiếu FARM_BORN: chỉ bê sống `PENDING_CONFIRMATION` có mẹ trong trại; ngày nhập = ngày sinh; giai đoạn UNWEANED_CALF; cha, mẹ, giống, giới tính, ngày sinh, cân sơ sinh lấy từ lần đẻ và **chỉ đọc**; mục đích mặc định = mục đích ACTIVE đầu tiên loại UNDECIDED; chuồng mặc định = chuồng chọn lúc đẻ; không có số tiền. | GBR-31, GBR-93 |
| R-06-19 | Bê đã đăng ký → MSG-FE06-02; kết quả đẻ không phải LIVE → MSG-FE06-04. | UC-01 E5 |
| R-06-20 | Đánh dấu bê "chết trước khi đăng ký" (có lý do): đóng kết quả bê, giải quyết REM-09; **không** đổi LIVE thành STILLBORN. | GBR-58, GBR-93 |
| R-06-21 | Nhập Excel: mẫu BeefCare, ≤ 200 dòng dữ liệu, ≤ 5 MB; mỗi dòng kiểm như dòng nhập tay; dòng lỗi không được thêm; dòng cảnh báo thêm với giá trị mặc định hiển thị (ví dụ thiếu ngày sinh → Không rõ); dòng đã thêm sửa được trước khi ghi sổ. | GBR-96 |
| R-06-22 | Bò đã rời đàn quay lại → phiếu mua mới, Internal ID mới. | GBR-29 |
| R-06-23 | Mọi thay đổi phiếu đã ghi sổ kiểm `version`; lệch → MSG-COM-05. | BR-D31 |

---

## 5. Luồng xử lý

### UC-FE06-01 Lập phiếu nhập mua
1. SCR-24 hiện mã phiếu kế tiếp, loại Mua, ngày nhập hôm nay.
2. Nhập phần đầu: ngày nhập, người bán (chọn hoặc thêm mới), số giấy kiểm dịch, biển số, ghi chú.
3. Chọn cách tính giá → **+ Thêm bò** → popup Dòng bò (lặp cho từng con).
4. Hệ thống hiện các dòng, tiền dòng, tổng, thay đổi lấp đầy chuồng, kiểm tra trước khi lưu.
5. Đính kèm chứng từ; nhập phí vận chuyển, đã trả, hình thức, hạn trả → hiện tổng phải trả, còn nợ.
6. **Lưu & tạo hồ sơ n con** (tùy chọn In thẻ QR sau khi lưu) → R-06-02 → MSG-FE06-01 → mở SCR-75; có lịch tiêm khớp → MSG-FE06-05 kèm link thêm vào lịch.

AF1 phiếu bê sinh tại trại (SCR-25, R-06-18) · AF2 "Đăng ký ngay" khi ghi đẻ (FE-12) · AF3 nhập từ Excel (R-06-21, MSG-FE06-18 / 19) · AF4 **Lưu nháp** → MSG-FE06-10 · AF5 sửa / xóa dòng · AF6 cảnh báo chuồng · AF7 bê chết trước khi đăng ký (R-06-20) · AF8 bỏ nháp / hủy → MSG-COM-14.
E1 không có dòng → MSG-FE06-16 · E2 ngày sai → MSG-FE06-03 · E3 trùng số tai / mã thẻ → MSG-FE05-02 / MSG-FE12-08 · E4 chuồng ngưng / thiếu chỗ → MSG-FE04-05 · E5 bê đã đăng ký / không sống → MSG-FE06-02 / 04 · E6 đã trả > tổng → MSG-FE06-13 · E7 thiếu người bán / trường bắt buộc → MSG-COM-06 · E8 danh mục ngưng → MSG-FE18-08 · E9 lỗi lưu → MSG-COM-02, phiếu vẫn DRAFT.

### UC-FE06-02 Xem phiếu
SCR-23 (tab trạng thái, lọc, ô tổng hợp, danh sách) → DRAFT mở SCR-24 / 25; POSTED / VOIDED mở SCR-75. Nút "Bê chờ xác nhận (n)" mở SCR-25.

### UC-FE06-03 Sửa / hủy bản ghi nhập một con
Popup → chọn **Sửa bản ghi** (nhập giá trị mới ở các dòng cần sửa) hoặc **Hủy bản ghi** → lý do → **Lưu** → kiểm R-06-13 / R-06-14, thanh toán, version → lưu → MSG-FE06-06 / MSG-FE06-12 (hủy cần xác nhận MSG-FE06-08). R-06-16 nếu đã trả vượt.

### UC-FE06-04 Thanh toán người bán
SCR-75 → **Ghi thanh toán** (khi còn nợ > 0) → popup → lưu → MSG-FE06-14. Hủy thanh toán sai trong danh sách thanh toán → lý do → MSG-FE06-15.

### UC-FE06-05 Hủy cả phiếu
SCR-75 → **Hủy phiếu** → popup hiện từng con: sự kiện sau nhập và kết quả "Hủy được" / "Bị chặn"; danh sách hậu quả → lý do → xác nhận MSG-FE06-20 → kiểm lại → R-06-15 → MSG-FE06-22.

---

## 6. Màn hình và trường

### SCR-23 Danh sách phiếu nhập

| # | Trường | Loại | Nội dung / Ràng buộc |
|---|---|---|---|
| 1 | Pending calves (n) / Bê chờ xác nhận (n) | Nút | Mở SCR-25 |
| 2 | Create entry voucher / Tạo phiếu nhập | Nút | Mở SCR-24 |
| 3 | Status tabs / Tab trạng thái | Tab | Tất cả, Nháp, Đã ghi sổ, Đã hủy – có số đếm |
| 4 | Period / Khoảng thời gian | Khoảng ngày (theo ngày nhập) | Mặc định từ đầu quý trước đến hôm nay |
| 5 | Entry type / Loại | Dropdown | Tất cả, Mua, Bê sinh tại trại |
| 6 | Source / Nguồn | Dropdown | Tất cả hoặc một đối tác |
| 7 | Ô: Posted vouchers / Phiếu đã ghi sổ | Số | Số phiếu trong kỳ; số phiếu nháp chưa ghi sổ |
| 8 | Ô: Cattle entered / Bò đã nhập | Số | Tổng, tách mua / sinh tại trại |
| 9 | Ô: Purchase amount / Tiền mua | Tiền | Tổng phải trả của phiếu mua POSTED, gồm phí vận chuyển |
| 10 | Ô: Owed to sellers / Còn nợ người bán | Tiền | Tổng còn nợ và số phiếu liên quan |
| 11 | Voucher code / Mã phiếu | Cột | PN-YYYY-nnnn (sắp xếp được); link SCR-75 hoặc SCR-24 / 25 |
| 12 | Entry date / Ngày nhập | Cột | Sắp xếp được |
| 13 | Entry type / Loại | Cột | Mua / Bê sinh tại trại |
| 14 | Source / dam / Nguồn / bò mẹ | Cột | Tên người bán + số giấy kiểm dịch, hoặc bò mẹ của các bê |
| 15 | Cattle / Số con | Cột | Số con; số con cân ước tính |
| 16 | Total weight / Tổng cân | Cột | kg |
| 17 | Total amount (đ) / Tổng tiền | Cột | Tổng phải trả; "—" với bê sinh tại trại |
| 18 | Outstanding (đ) / Còn nợ | Cột | — |
| 19 | Status / Trạng thái | Huy hiệu | DRAFT / POSTED / VOIDED (kèm lý do hủy) |
| 20 | Actions / Thao tác | Nút | "Tiếp tục" (DRAFT) / "Xem" |
| 21 | Note / Ghi chú | Chữ chỉ đọc | Nháp không tạo bò, không đổi chuồng / công nợ; phiếu đã ghi sổ sửa theo từng con, hủy cả phiếu chỉ khi mọi bò chưa có sự kiện khác |

### SCR-24 Phiếu nhập – Mua

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Entry type / Loại phiếu | Tab | — | Mua / Bê sinh tại trại; cố định sau lần lưu đầu | Mua | — |
| **1. Thông tin phiếu** | | | | | | |
| 2 | Voucher code / Mã phiếu | Chỉ đọc | — | PN-YYYY-nnnn kế tiếp | — | — |
| 3 | Entry date / Ngày nhập | Ngày | * | Không tương lai, không trước ngày sinh của dòng nào | Hôm nay | MSG-COM-06, MSG-FE06-03 |
| 4 | Seller / previous owner / Người bán | Dropdown có tìm | * | Đối tác ACTIVE kèm SĐT; "+ Thêm nguồn mới" (tên, SĐT, khu vực) | Trống | MSG-COM-06, MSG-COM-08 |
| 5 | Quarantine certificate no. / Số giấy kiểm dịch | Ô chữ | — | ≤ 50 | Trống | Trống → cảnh báo MSG-FE06-24 |
| 6 | Vehicle plate / Biển số xe | Ô chữ | — | ≤ 20 | Trống | MSG-COM-10 |
| 7 | Receiving note / Ghi chú nhận | Ô chữ dài | — | ≤ 1.000 | Trống | MSG-COM-10 |
| **2. Bò trong phiếu** | | | | | | |
| 8 | Import from Excel / Nhập từ Excel | Nút | — | Mở popup Nhập từ Excel | — | — |
| 9 | + Add cattle / Thêm bò | Nút | — | Mở popup Dòng bò | — | — |
| 10 | Pricing basis / Cách tính giá | Radio | * | Theo kg / Theo con, áp mọi dòng | Theo kg | — |
| 11 | # / Ear tag – Số tai | Cột | — | Số dòng; số tai hoặc "Gắn tai sau" | — | — |
| 12 | Breed · sex / Giống · giới tính | Cột | — | — | — | — |
| 13 | Life stage · purpose / Giai đoạn · mục đích | Cột | — | — | — | — |
| 14 | Age / Tuổi | Cột | — | Tuổi ước tính tại ngày nhập | — | — |
| 15 | Weight / Cân | Cột | — | kg; "UT" khi ước tính | — | — |
| 16 | Receiving pen / Chuồng nhận | Dropdown trong dòng | * | Chuồng ACTIVE kèm số con / sức chứa | — | MSG-FE04-05 |
| 17 | Unit price / Đơn giá | Cột | — | đ/kg hoặc đ/con | — | — |
| 18 | Line amount / Tiền dòng | Tính | — | GBR-91 | — | — |
| 19 | ⋯ | Menu | — | Sửa dòng / Xóa | — | — |
| 20 | Totals row / Dòng tổng | Tính | — | Số con, tổng cân, tiền bò | — | — |
| **3. Đính kèm** | | | | | | |
| 21 | Files / Tệp | Tải lên | — | PDF / JPG, ≤ 10 MB mỗi file; xem / xóa | — | MSG-COM-10 |
| **4. Thanh toán** | | | | | | |
| 22 | Cattle amount / Tiền bò | Chỉ đọc | — | Σ tiền dòng | — | — |
| 23 | Transport fee / Phí vận chuyển | Số | — | Số nguyên ≥ 0 | 0 | MSG-COM-10 |
| 24 | Total payable / Tổng phải trả | Chỉ đọc | — | Tiền bò + phí vận chuyển | — | — |
| 25 | Amount paid / Đã trả | Số | — | Số nguyên ≥ 0, ≤ tổng phải trả | 0 | MSG-FE06-13 |
| 26 | Outstanding / Còn nợ | Chỉ đọc | — | Tổng − đã trả | — | — |
| 27 | Payment method / Hình thức | Radio | * khi đã trả > 0 | Tiền mặt / Chuyển khoản | — | MSG-COM-06 |
| 28 | Balance due date / Hạn trả | Ngày | — | — | Trống | — |
| **Bảng tóm tắt bên** | | | | | | |
| 29 | Voucher summary / Tóm tắt phiếu | Chỉ đọc | — | Số con, tổng cân (số con ước tính), chuồng nhận với lấp đầy trước → sau, trạng thái DRAFT | — | — |
| 30 | Checks before saving / Kiểm tra trước khi lưu | Chỉ đọc | — | Số tai duy nhất; tiêu chí chuồng từng dòng; sức chứa đủ; ngày nhập hợp lệ. Cảnh báo: cân ước tính; chuồng sẽ đầy (MSG-FE06-17); không có giấy kiểm dịch (MSG-FE06-24) | — | — |
| 31 | Print QR tags after saving / In thẻ QR sau khi lưu | Checkbox | — | — | Bật | — |
| 32 | Save & create n cattle / Lưu & tạo hồ sơ n con | Nút | — | Ghi sổ | — | MSG-FE06-16, MSG-COM-05, MSG-COM-02; thành công MSG-FE06-01 (+ MSG-FE06-05) → SCR-75 |
| 33 | Save draft / Cancel – Lưu nháp / Hủy | Nút | — | Bỏ được phiếu nháp từ màn hình này | — | MSG-FE06-10 / MSG-COM-14 |

### Popup Dòng bò (phiếu mua nháp)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Ear tag number / Số tai | Ô chữ | — | ≤ 30; duy nhất trong bò ACTIVE và các dòng khác; trống = gắn sau | Trống | MSG-COM-10, MSG-FE05-02 |
| 2 | Name / Tên | Ô chữ | — | ≤ 50 | Trống | MSG-COM-10 |
| 3 | Photo / Ảnh | File | — | JPG / PNG ≤ 5 MB | — | MSG-COM-10 |
| 4 | Colour and markings / Màu lông, đặc điểm | Ô chữ | — | ≤ 255 | Trống | MSG-COM-10 |
| 5 | Breed / Giống | Dropdown | * | Giống ACTIVE | — | MSG-COM-06, MSG-FE18-08 |
| 6 | Sex / Giới tính | Radio | * | Đực / Cái | — | MSG-COM-06 |
| 7 | Birth date or age / Ngày sinh hoặc tuổi | Ngày / tháng-năm / số tháng | — | Tuổi 1–240; hiện tuổi ước tính lúc nhập | — | MSG-COM-10, MSG-FE06-03 |
| 8 | Birth date accuracy / Độ chính xác | Radio | — | Chính xác / Ước tính / Không rõ; nhập tuổi → Ước tính | Không rõ khi trống | — |
| 9 | Life stage / Giai đoạn | Dropdown | * | Đề xuất theo tuổi và tham số trại; sửa được | Đề xuất | MSG-COM-06 |
| 10 | Production purpose / Mục đích | Dropdown | * | Mục đích ACTIVE kèm loại; SIRE chỉ đực, BREEDING chỉ cái | — | MSG-COM-06, MSG-FE05-12 |
| 11 | Entry weight (kg) / Cân lúc nhập | Số | * | 1–1.500 | — | MSG-COM-06, MSG-COM-10 |
| 12 | Weight basis / Cơ sở cân | Radio | * | Đo / Ước tính | — | MSG-COM-06 |
| 13 | Receiving pen / Chuồng nhận | Dropdown | * | Chuồng ACTIVE kèm số con / sức chứa; hiện kết quả kiểm tiêu chí | — | MSG-FE04-05, MSG-FE04-06 |
| 14 | Warning reason / Lý do cảnh báo | Ô chữ dài | * khi không đạt tiêu chí | ≤ 500 | — | MSG-COM-06 |
| 15 | Unit price / Line amount – Đơn giá / Tiền dòng | Số / Tính | — | ≥ 0 / tính tự động | — | MSG-COM-10 |
| 16 | Quarantine until / Cách ly đến | Ngày | — | Không trước ngày nhập; nút nhanh +14, +21 ngày | — | MSG-COM-10 |
| **Lịch sử trước khi nhập** | | | | | | |
| 17 | Vaccination / Tiêm phòng | Radio | * | Có / Không / Không rõ; Có → dòng: vắc-xin (ACTIVE hoặc chữ tự do), ngày (tùy chọn), nguồn thông tin | Không rõ | MSG-COM-06 |
| 18 | Known diseases / Bệnh đã biết | Radio | * | Có / Không / Không rõ; Có → mô tả ≤ 1.000 | Không rõ | MSG-COM-06 |
| 19 | Reproduction / Sinh sản | Radio | * (chỉ bò cái) | Có / Không / Không rõ; Có → số lứa đã đẻ 0–15, mang thai lúc nhập (Có / Không / Không rõ), số tháng 1–9 (khi Có), mô tả ≤ 1.000 | Không rõ | MSG-COM-06, MSG-COM-10 |
| 20 | Remove from voucher / Cancel / Save line | Nút | — | Xóa khỏi phiếu / Hủy / Lưu dòng | — | — |

### Popup Nhập bò từ Excel

| # | Trường | Loại | Bắt buộc | Ràng buộc / Nội dung |
|---|---|---|---|---|
| 1 | Download template / Tải mẫu | Nút | — | .xlsx cột: Số tai, Giống, Giới tính, Ngày sinh hoặc Tuổi (tháng), Độ chính xác, Màu lông, Cân, Cơ sở cân, Chuồng, Mục đích, Đơn giá, Cách ly đến |
| 2 | Select file / Chọn tệp | File | * | .xlsx, ≤ 200 dòng dữ liệu, ≤ 5 MB; hiện tên tệp, số dòng; "Đổi tệp" |
| 3 | Row / Ear tag / Breed · sex / Weight / Pen | Bảng | — | Giá trị đọc từ từng dòng |
| 4 | Result / Kết quả | Cột | — | Hợp lệ / Cảnh báo (kèm giá trị mặc định đã áp) / Lỗi (kèm lý do) |
| 5 | Summary / Tóm tắt | Chữ | — | MSG-FE06-18 |
| 6 | Cancel / Add n cattle to the voucher | Nút | — | Chỉ thêm dòng hợp lệ (gồm cảnh báo); MSG-FE06-19 |

### SCR-25 Phiếu nhập – Bê sinh tại trại

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Voucher code / Mã phiếu | Chỉ đọc | — | PN-YYYY-nnnn kế tiếp | — | — |
| 2 | Voucher date / Ngày phiếu | Ngày | * | Ngày nhập từng bê = ngày sinh | Hôm nay | MSG-COM-06, MSG-COM-07 |
| 3 | Note / Ghi chú | Ô chữ dài | — | ≤ 1.000 | — | MSG-COM-10 |
| 4 | Selection / Chọn | Checkbox mỗi bê | — | Tiêu đề "n / m bê đã chọn" | — | MSG-FE06-16 |
| 5 | Calf · tag / Bê · thẻ | Chỉ đọc | — | Số bê và mã thẻ nhập lúc đẻ, hoặc "Chưa gắn thẻ" (cấp khi ghi sổ) | — | — |
| 6 | Dam · sire / Mẹ · bố | Chỉ đọc | — | Mã mẹ; mã bố, mã tinh hoặc "Không rõ" | — | — |
| 7 | Birth date, Sex, Birth weight / Ngày sinh, Giới tính, Cân sơ sinh | Chỉ đọc | — | Từ lần đẻ; "UT" khi ước tính | — | — |
| 8 | Receiving pen / Chuồng nhận | Dropdown | * | Chuồng ACTIVE | Chuồng chọn lúc đẻ | MSG-FE04-05, MSG-FE04-06 |
| 9 | Production purpose / Mục đích | Dropdown | * | Mục đích ACTIVE; SIRE chỉ đực, BREEDING chỉ cái | Mục đích ACTIVE đầu tiên loại UNDECIDED | MSG-FE05-12 |
| 10 | Mark died before registration / Đánh dấu chết trước khi đăng ký | Thao tác dòng | — | Bắt buộc lý do | — | MSG-COM-06 |
| 11 | Attachments / Đính kèm | File | — | PDF / JPG ≤ 10 MB | — | — |
| 12 | Summary panel / Tóm tắt | Chỉ đọc | — | Số bê, tổng cân sơ sinh, chuồng trước → sau, giai đoạn Bê chưa cai sữa, DRAFT; "Bê sinh tại trại không có giá, không thanh toán" | — | — |
| 13 | Checks before saving / Kiểm tra | Chỉ đọc | — | Bê vẫn PENDING_CONFIRMATION; thẻ duy nhất; chuồng đủ chỗ; mẹ ACTIVE | — | — |
| 14 | Print QR tags after saving | Checkbox | — | — | Bật | — |
| 15 | Save & create n cattle / Save draft / Cancel | Nút | — | — | — | MSG-FE06-02, MSG-FE06-04; MSG-FE06-01 → SCR-75; MSG-FE06-10 → SCR-23 |

### SCR-75 Chi tiết phiếu nhập

| # | Trường | Nội dung / Hành vi |
|---|---|---|
| 1 | Header / Tiêu đề | Mã phiếu, huy hiệu trạng thái; nút "In phiếu", "Hủy phiếu" (chỉ POSTED) |
| 2 | Voucher information / Thông tin phiếu | Ngày nhập, loại, giấy kiểm dịch, người bán + liên hệ, biển số, người tạo / ghi sổ và thời điểm, ghi chú |
| 3 | Cattle code / Ear tag – Mã bò / Số tai | Mã hiển thị (link SCR-19), số tai |
| 4 | Breed · sex, Entry weight, Receiving pen | Từ dòng |
| 5 | Current / Hiện tại | Trạng thái đàn và chuồng hiện tại (ví dụ ACTIVE · B2, EXITED, VOIDED) |
| 6 | Line amount / Tiền dòng | đ |
| 7 | Actions / Thao tác | "Sửa bản ghi nhập" với dòng VALID của bò ACTIVE |
| 8 | Totals row / Dòng tổng | Số con, tổng cân, tiền bò |
| 9 | Attachments / Đính kèm | Danh sách + "Xem" |
| 10 | Payment / Thanh toán | Tiền bò, phí vận chuyển, tổng phải trả, đã trả, còn nợ; danh sách (ngày, hình thức, số tiền, tham chiếu, người ghi; thanh toán VOIDED gạch ngang); "Ghi thanh toán" khi còn nợ > 0; "Hủy" trên từng thanh toán RECORDED |
| 11 | Voucher history / Lịch sử phiếu | Theo thời gian: tạo, ghi sổ (các mã bò được tạo), in QR, ghi / hủy thanh toán, sửa, hủy |

### Popup Sửa / Hủy bản ghi nhập

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Record / Bản ghi | Chỉ đọc | — | Bò, mã phiếu, ngày nhập, người ghi | — |
| 2 | Action / Hành động | Radio | * | Sửa bản ghi (mặc định) / Hủy bản ghi (chỉ hiện khi bò chưa có sự kiện khác) | MSG-FE06-09 |
| 3 | Field / Current value / New value – Trường / Hiện tại / Mới | Bảng | — | Dòng: Ngày nhập (phiếu mua: áp mọi bò của phiếu), Thông tin nguồn, Cân + cơ sở, Đơn giá, Giống, Giới tính, Ngày sinh + độ chính xác, Khai báo lịch sử ("Sửa" mở form lịch sử của popup Dòng bò); chỉ lưu dòng có thay đổi | MSG-FE06-07, MSG-COM-10 |
| 4 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 5 | Cancel / Save | Nút | — | Hủy cần xác nhận MSG-FE06-08 | MSG-COM-05, MSG-COM-02; thành công MSG-FE06-06 / MSG-FE06-12; MSG-FE06-23 |

### Popup Ghi thanh toán (dùng chung FE-06, FE-13, FE-23)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Title / Tiêu đề | Chữ | — | "Ghi thanh toán – PN-…" / "Ghi thanh toán – PNK-…" / "Ghi thu tiền – PX-…" + tên đối tác | — |
| 2 | Total / Paid or collected / Outstanding | Chỉ đọc | — | Tổng, đã trả / đã thu, còn lại | — |
| 3 | Payment date / Ngày thanh toán | Ngày | * | Không tương lai, không trước ngày phiếu | MSG-COM-06, MSG-COM-07, MSG-COM-10 |
| 4 | Amount (đ) / Số tiền | Số | * | Số nguyên > 0, ≤ còn lại | MSG-COM-06, MSG-FE06-13 |
| 5 | Method / Hình thức | Radio | * | Tiền mặt / Chuyển khoản | MSG-COM-06 |
| 6 | Reference / Tham chiếu | Ô chữ | — | ≤ 100 | MSG-COM-10 |
| 7 | Attachment / Đính kèm | File | — | PDF / JPG ≤ 10 MB | MSG-COM-10 |
| 8 | Note / Ghi chú | Ô chữ | — | ≤ 500 | MSG-COM-10 |
| 9 | Information / Thông tin | Chữ | — | Còn lại sau khi lưu; "Thanh toán đã ghi chỉ hủy được kèm lý do và vẫn nằm trong lịch sử. Đây là sổ tiền của trại, không phải hóa đơn thuế." | — |
| 10 | Cancel / Save | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE06-14 |

### Popup Hủy phiếu nhập

| # | Trường | Loại | Bắt buộc | Nội dung |
|---|---|---|---|---|
| 1 | Voucher / Phiếu | Chỉ đọc | — | Mã, loại, ngày nhập, số con, người bán |
| 2 | Cattle / Events after entry / Result | Bảng | — | Mỗi con: sự kiện sau nhập ("Không có" hoặc danh sách); "Hủy được" / "Bị chặn" (MSG-FE06-21) |
| 3 | On confirmation / Khi xác nhận | Chữ | — | Bò thành VOIDED, mã không tái sử dụng; đóng phân chuồng, trả chỗ; thẻ RETIRED; thanh toán n đ giữ trong lịch sử; bê sinh tại trại quay về chờ xác nhận |
| 4 | Void reason / Lý do hủy | Ô chữ dài | * | ≤ 500 (MSG-COM-06) |
| 5 | Close / Void voucher – Đóng / Hủy phiếu | Nút | — | Chỉ bật khi mọi bò "Hủy được"; xác nhận MSG-FE06-20; thành công MSG-FE06-22 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách phiếu | `status?, type?, from?, to?, sellerId?, page, size, sort?` | `{tiles {posted, drafts, cattle, purchased, farmBorn, purchaseAmount, owed, owedVouchers}, counts {all, draft, posted, voided}, items[…cột SCR-23], total}` | COM-03 | `GET /api/farms/{farmId}/entry-vouchers` |
| A2 | Tạo / lưu nháp | Phần đầu + `lines[]` (mục 3.2, 3.3) + thanh toán + `Idempotency-Key` | Phiếu đầy đủ + `version` | COM-06, COM-10, FE06-03, FE05-02, FE12-08, FE05-12, FE18-08 | `POST /api/farms/{farmId}/entry-vouchers` |
| A3 | Sửa nháp | Như A2 + `version` | Phiếu | Như A2 + COM-05 | `PUT /api/farms/{farmId}/entry-vouchers/{id}` |
| A4 | Bỏ nháp | `expectedVersion` + `Idempotency-Key` | — | COM-05 | `DELETE /api/farms/{farmId}/entry-vouchers/{id}` |
| A5 | Kiểm tra trước khi lưu | — | `{errors[], warnings[], penOccupancy[{penId, before, after, capacity}]}` | — | `GET …/entry-vouchers/{id}/checks` |
| A6 | Ghi sổ | `version, printQr` + `Idempotency-Key` | `{voucherCode, cattle[{cattleId, displayCode}], matchingSchedules[{scheduleId, name, count}]}` | FE06-16, FE06-03, FE04-05, FE04-06, FE05-02, FE06-02, FE06-04, FE06-13, COM-05, COM-02 | `POST …/entry-vouchers/{id}/post` |
| A7 | Đề xuất giai đoạn | `birthDate? \| ageMonths?, entryDate` | `{lifeStage}` | — | `GET …/entry-vouchers/life-stage-proposal` |
| A8 | Tải mẫu Excel | — | File .xlsx | — | `GET …/entry-vouchers/import-template` |
| A9 | Nhập Excel | File + `commit` (false = chỉ kiểm, true = thêm dòng hợp lệ) + `Idempotency-Key` | `{total, valid, warnings, errors, rows[{row, earTag, breedSex, weight, pen, result, message}]}` | COM-10 (tệp sai), FE06-18 | `POST …/entry-vouchers/{id}/import` |
| A10 | Chi tiết phiếu | — | Mọi trường SCR-75 | COM-08 | `GET …/entry-vouchers/{id}` |
| A11 | Bê chờ xác nhận | — | `[{calfOutcomeId, calfNo, tagCode, damCode, sire, birthDate, sex, birthWeight, estimated, proposedPenId}]` | — | `GET /api/farms/{farmId}/pending-calves` |
| A12 | Bê chết trước khi đăng ký | `reason` + `Idempotency-Key` | Bê | COM-06 | `POST …/pending-calves/{calfId}/died-before-registration` |
| A13 | Sửa bản ghi nhập một con | `changes {entryDate?, source?, weightKg?, weightBasis?, unitPrice?, breedId?, sex?, birthDate?, birthAccuracy?, declarations?}, reason, version` + `Idempotency-Key` | `{entry, voucherTotals, overpaidBy?}` | FE06-07, COM-06, COM-05, COM-02 | `PATCH /api/farms/{farmId}/herd-entries/{entryId}` |
| A14 | Kiểm tra / hủy bản ghi một con | — / `reason, version` | `{canVoid, events[]}` / `{cattleId, voucherTotals, lastLine}` | FE06-09, COM-06 | `GET …/herd-entries/{entryId}/void-check` · `POST …/void` |
| A15 | Kiểm tra / hủy cả phiếu | — / `reason, version` | `{rows[{cattleId, code, events[], result}], paidAmount}` / phiếu | FE06-21, COM-06, COM-05 | `GET …/entry-vouchers/{id}/void-check` · `POST …/void` |
| A16 | Thanh toán | `paymentDate, amount, method, reference?, note?` + đính kèm + `Idempotency-Key` | `{payments[], total, paid, outstanding}` | FE06-13, COM-07, COM-06 | `GET` / `POST /api/farms/{farmId}/vouchers/ENTRY/{voucherId}/payments` |
| A17 | Hủy thanh toán | `reason, version` + `Idempotency-Key` | Như A16 | COM-06, COM-05 | `POST /api/farms/{farmId}/payments/{paymentId}/void` |
| A18 | Đối tác (thêm nhanh) | `name, roles[SELLER], phone?, area?` | Đối tác | Trùng tên (Q2), COM-06 | `POST /api/farms/{farmId}/trading-partners` |
| A19 | Đính kèm phiếu / ảnh dòng | File | `AttachmentDTO` | COM-10 | `…/entry-vouchers/{voucherId}/attachments` · `…/entry-lines/{entryId}/photo` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE06-01 | Toast thành công | Đã ghi sổ phiếu {voucher_code}: đăng ký {count} con ({first_code} – {last_code}). |
| MSG-FE06-02 | Hộp thoại | Bê này đã được đăng ký là {cattle_code}. [Mở hồ sơ] |
| MSG-FE06-03 | Dưới trường | Ngày nhập không được ở tương lai hoặc trước ngày sinh. |
| MSG-FE06-04 | Trong hộp thoại | Chỉ bê sống mới được đăng ký vào đàn. |
| MSG-FE06-05 | Sau khi lưu | Có {count} lịch tiêm khớp với bò của {voucher_code}. [Thêm vào lịch] |
| MSG-FE06-06 | Toast thành công | Đã sửa dữ liệu nhập của {cattle_code}. Giá trị gốc được giữ trong lịch sử. |
| MSG-FE06-07 | Trong hộp thoại | Không thể sửa: {reason}. |
| MSG-FE06-08 | Hộp thoại xác nhận | Hủy bản ghi nhập của {cattle_code} trên {voucher_code}? Bò sẽ bị bỏ khỏi danh sách đang nuôi và tiền của bò bị trừ khỏi tổng phiếu. |
| MSG-FE06-09 | Trong hộp thoại | Không thể hủy vì {cattle_code} đã có sự kiện được ghi. |
| MSG-FE06-10 | Toast thành công | Đã lưu nháp phiếu {voucher_code}. Chưa có bò nào được tạo. |
| MSG-FE06-11 | Toast thành công | Đã đăng ký bê {cattle_code} từ lần đẻ của {dam_code} (phiếu {voucher_code}). |
| MSG-FE06-12 | Toast thành công | Đã hủy bản ghi nhập của {cattle_code}. |
| MSG-FE06-13 | Dưới trường | Số tiền không được vượt quá {amount} đ. |
| MSG-FE06-14 | Toast thành công | Đã ghi {amount} đ cho {voucher_code}. Còn lại: {outstanding} đ. |
| MSG-FE06-15 | Hộp thoại xác nhận | Hủy khoản thanh toán {amount} đ ngày {date}? Nhập lý do. Khoản này vẫn nằm trong lịch sử phiếu. |
| MSG-FE06-16 | Trên form | Hãy thêm ít nhất một con vào phiếu. |
| MSG-FE06-17 | Trong kiểm tra | Chuồng {pen} sẽ đầy ({count}/{capacity}) sau phiếu này. |
| MSG-FE06-18 | Kết quả nhập | {total} dòng: {valid} hợp lệ ({warnings} có cảnh báo) · {errors} lỗi. Dòng lỗi không được thêm – sửa tệp hoặc thêm tay. |
| MSG-FE06-19 | Toast thành công | Đã thêm {count} con vào {voucher_code}. |
| MSG-FE06-20 | Hộp thoại xác nhận | Hủy phiếu {voucher_code}? {count} hồ sơ bò sẽ bị hủy, trả chỗ chuồng và thu hồi thẻ QR. Khoản đã trả {paid} đ vẫn nằm trong lịch sử. |
| MSG-FE06-21 | Trong hộp thoại | Không thể hủy phiếu {voucher_code}: {cattle_codes} đã có sự kiện khác. Hãy sửa hoặc hủy từng bản ghi. |
| MSG-FE06-22 | Toast thành công | Đã hủy phiếu {voucher_code}. |
| MSG-FE06-23 | Sau khi lưu | Số tiền đã trả vượt tổng mới {amount} đ. Xử lý chênh lệch bên ngoài BeefCare. |
| MSG-FE06-24 | Trong kiểm tra | Chưa nhập giấy kiểm dịch. Vẫn ghi sổ được; đính kèm hoặc nhập giấy sau nếu có. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-06-01 | Phiếu nháp 3 dòng | Lưu nháp | Không có bò, phân chuồng, thẻ, thanh toán nào; số con chuồng không đổi | I | R-06-01 |
| TC-06-02 | Phiếu nháp 3 dòng hợp lệ | Ghi sổ | 3 bò ACTIVE (mã BC liên tiếp), 3 dòng VALID, 3 phân chuồng mở, 3 thẻ ACTIVE, thanh toán ban đầu, 1 audit; phiếu POSTED | I | R-06-02 |
| TC-06-03 | Dòng 3 có số tai trùng bò ACTIVE | Ghi sổ | MSG-FE05-02; không bò nào được tạo; phiếu vẫn DRAFT | I | R-06-02 |
| TC-06-04 | Ghi sổ 2 lần cùng `Idempotency-Key` | — | Cùng kết quả; vẫn 3 bò | I | R-06-03 |
| TC-06-05 | Phiếu không có dòng | Ghi sổ | MSG-FE06-16 | I | R-06-04 |
| TC-06-06 | Ngày nhập ngày mai / dòng có ngày sinh sau ngày nhập | Ghi sổ | MSG-FE06-03 | I | R-06-06 |
| TC-06-07 | Chuồng còn 2 chỗ, 3 dòng vào chuồng đó | Ghi sổ | MSG-FE04-05 | I | R-06-07 |
| TC-06-08 | Chuồng chỉ nhận Cái, dòng Đực, không có lý do cảnh báo | Lưu dòng / ghi sổ | MSG-FE04-06 | I | R-06-07 |
| TC-06-09 | Theo kg: 300 kg × 80.000 đ; phí xe 500.000 | Tính | Tiền dòng 24.000.000; tổng 24.500.000 | U | R-06-09 |
| TC-06-10 | Theo kg, 1 dòng không có cân | Lưu | MSG-COM-06 | U, H | R-06-09 |
| TC-06-11 | Tổng 24.500.000 | Đã trả 25.000.000 | MSG-FE06-13 | U, H | R-06-10 |
| TC-06-12 | Đã trả 1.000.000, không chọn hình thức | Lưu | MSG-COM-06 | U, H | R-06-10 |
| TC-06-13 | Có 2 lịch tiêm khớp bò mới | Ghi sổ | MSG-FE06-05 với 2 lịch; bò **chưa** thuộc lịch nào | I | R-06-11 |
| TC-06-14 | Khai báo tiêm Có (LMLM, 03/2026) | Ghi sổ | 1 bản ghi tiêm HISTORICAL, không có mũi theo lịch | I | §3.3 |
| TC-06-15 | Bò cái khai báo mang thai ~4 tháng, 2 lứa đã đẻ | Ghi sổ | Hồ sơ "Khai báo mang thai ~4 tháng (chưa khám)"; REM-03 được tạo; không có giai đoạn mang thai; số lứa = 2 | I | §3.3 |
| TC-06-16 | Khai báo Không rõ | Mở hồ sơ | Hiện "Không rõ", không hiện "Không" | E | GBR-30 |
| TC-06-17 | Bò đực | Popup Dòng bò | Không có nhóm Sinh sản | E | Popup |
| TC-06-18 | Popup | Tuổi 0 / 241; cân 0 / 1.501; số tai 31 ký tự | MSG-COM-10 | U, H | Popup |
| TC-06-19 | Nhập tuổi 18 tháng, ngày nhập 06/11/2026 | — | Tháng sinh 05/2025, độ chính xác Ước tính | U | Popup |
| TC-06-20 | Tệp Excel 201 dòng / 6 MB / .csv | Tải lên | Bị từ chối | I | R-06-21 |
| TC-06-21 | Excel 10 dòng: 7 hợp lệ, 1 thiếu ngày sinh, 2 trùng số tai | Thêm | MSG-FE06-18 "10 dòng: 8 hợp lệ (1 cảnh báo) · 2 lỗi"; 8 dòng được thêm, dòng thiếu ngày sinh = Không rõ | I | R-06-21 |
| TC-06-22 | Bê sống PENDING, mẹ M, bố từ lần phối | Lập phiếu FARM_BORN | Ngày nhập = ngày sinh; UNWEANED_CALF; mục đích mặc định UNDECIDED đầu tiên; cha mẹ, giới tính, ngày sinh, cân sơ sinh **không sửa được**; không có tiền | I, E | R-06-18 |
| TC-06-23 | Bê đã đăng ký | Đưa vào phiếu khác | MSG-FE06-02 | I | R-06-19 |
| TC-06-24 | Bê chờ xác nhận | Đánh dấu chết trước khi đăng ký có lý do | Rời danh sách chờ; REM-09 giải quyết; kết quả vẫn LIVE | I | R-06-20 |
| TC-06-25 | Bò đã có lần cân ngày 10/11 | Sửa ngày nhập phiếu thành 11/11 | MSG-FE06-07 | I | R-06-13 |
| TC-06-26 | Bò cái có lần phối | Sửa giới tính thành Đực | MSG-FE06-07 | I | R-06-13 |
| TC-06-27 | Sửa cân 300 → 320 (giá theo kg 80.000) | Lưu có lý do | Tiền dòng 25.600.000; tổng phiếu tính lại; revision giữ 300 | I | R-06-12 |
| TC-06-28 | Sửa ngày nhập phiếu mua 3 con | Lưu | Ngày nhập của cả 3 con đổi | I | R-06-12 |
| TC-06-29 | Bò chưa có sự kiện khác | Hủy bản ghi nhập | Bò VOIDED, thẻ RETIRED, phân chuồng đóng, tiền dòng trừ khỏi tổng; không còn trong danh sách ACTIVE | I | R-06-14 |
| TC-06-30 | Bò đã có 1 lần cân | Hủy bản ghi nhập | MSG-FE06-09 | I | R-06-14 |
| TC-06-31 | Đã trả 24.500.000; hủy 1 con giá 8.000.000 | Lưu | MSG-FE06-23 vượt 8.000.000 | I | R-06-16 |
| TC-06-32 | Phiếu 3 con, 1 con đã tiêm | Mở popup hủy phiếu | Con đó "Bị chặn"; nút hủy khóa; MSG-FE06-21 | I, E | R-06-15 |
| TC-06-33 | Phiếu FARM_BORN 2 bê chưa có sự kiện | Hủy phiếu | 2 bò VOIDED; 2 bê quay về PENDING_CONFIRMATION; REM-09 tạo lại | I | R-06-15 |
| TC-06-34 | Phiếu có 2 khoản thanh toán | Hủy phiếu | Thanh toán vẫn RECORDED trong lịch sử | I | R-06-15 |
| TC-06-35 | Còn nợ 5.000.000 | Ghi thanh toán 5.000.001 / ngày mai / trước ngày phiếu / 0 | MSG-FE06-13 / MSG-COM-07 / lỗi / lỗi | I | R-06-17 |
| TC-06-36 | Thanh toán RECORDED | Hủy không lý do / có lý do | MSG-COM-06 / VOIDED, còn nợ tăng lại | I | R-06-17 |
| TC-06-37 | Technician | Gọi bất kỳ API nhập đàn | 403 | H | §2 |
| TC-06-38 | Đối tác "Nguyễn Văn A" đã có | Thêm nhanh "nguyễn văn a" | Bị từ chối trùng tên | I | §3.4 |
| TC-06-39 | Bò mã BC-000010 đã VOIDED | Ghi sổ phiếu mới | Mã mới là BC-000011 trở đi, không dùng lại BC-000010 | I | BR-D07 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | UC-FE06-02, 04 không có đặc tả Part II; luồng suy từ SCR | Chủ dự án xác nhận |
| Q2 | Mã thông báo khi trùng tên đối tác: SRS không có | Thêm MSG riêng hoặc dùng MSG-COM-10 kèm tham số |
| Q3 | Sửa "Ngày nhập" của phiếu mua có cần kiểm với sự kiện của **mọi** bò trong phiếu không? | Có (áp cho mọi bò) |
| Q4 | Chuồng nhận của phiếu FARM_BORN có kiểm tiêu chí chuồng không? | Có, như phiếu mua (GBR-21 áp cho UC-FE06-01) |
| Q5 | "In phiếu" ra định dạng gì? | PDF A4 |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho AnNT duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
