# SPEC FE-23 – Quản lý thức ăn

| | |
|---|---|
| Feature | FE-23 Feed Management |
| Use case | UC-FE23-01 → UC-FE23-11 |
| Người phụ trách | TaiDX (BE + FE + test) · Review BE: DucNV · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Feed Item, Feed Receipt + Line, Stock Adjustment + Line, Ration + Component, Feeding Record + Line, Stock Movement), BR-D15, 34, 36 → 39, Part II §18 (UC-FE23-02, 06, 08, 09), Part III §23 (SCR-77 → SCR-86, 2 popup + popup Ghi thanh toán dùng chung), MSG-FE23-01 → 20, GBR-14, 63, 66, 91, 97 → 105, 109; REM-10, REM-11 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.
> Popup **Ghi thanh toán** dùng chung, mô tả đầy đủ trong spec FE-06 §6.

---

## 1. Phạm vi

Trang "Quản lý thức ăn" trong menu Chăm sóc, các tab: Tồn kho, Phiếu nhập, Kiểm kho, Khẩu phần, Nhật ký cho ăn, Danh mục, Báo cáo.

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE23-01 | Xem tồn kho, thẻ kho | Owner, Manager | SCR-77, SCR-78 |
| UC-FE23-02 | Lập phiếu nhập kho, ghi trả NCC | Owner, Manager | SCR-79, popup Ghi thanh toán |
| UC-FE23-03 | Hủy phiếu nhập | Owner, Manager | SCR-78 |
| UC-FE23-04 | Kiểm kho / điều chỉnh | Owner, Manager | SCR-80 |
| UC-FE23-05 | Xem khẩu phần | Owner, Manager, Technician | SCR-81, SCR-86 |
| UC-FE23-06 | Tạo / sửa khẩu phần (phiên bản) | Owner, Manager | SCR-82 |
| UC-FE23-07 | Xem nhật ký cho ăn | Owner, Manager, Technician | SCR-83, SCR-86 |
| UC-FE23-08 | Ghi bữa ăn | **Manager** | Popup Ghi bữa ăn |
| UC-FE23-09 | Sửa / hủy bản ghi cho ăn | **Manager** | Popup Sửa / Hủy bản ghi cho ăn |
| UC-FE23-10 | Danh mục thức ăn và nhà cung cấp | Owner, Manager | SCR-84 |
| UC-FE23-11 | Báo cáo tiêu thụ và chi phí | Owner, Manager | SCR-85 |

**Không thuộc FE-23:** thuốc trộn vào thức ăn → ghi điều trị ở FE-10. Nhắc việc REM-10, REM-11 hiển thị ở FE-14.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Tồn kho, phiếu nhập, trả NCC, kiểm kho, khẩu phần, danh mục, báo cáo | Có | Có | — |
| Xem khẩu phần (SCR-81 / SCR-86), nhật ký cho ăn | Có | Có | Có (chỉ xem) |
| Ghi / sửa / hủy bản ghi cho ăn | — (chỉ xem) | **Chỉ Manager** | — (có thể là "người cho ăn") |

Cần trại ACTIVE (GBR-14, GBR-103).

---

## 3. Dữ liệu

### 3.1 Mặt hàng thức ăn (Feed Item)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| Mã | `TA-nn` | Có | Duy nhất trong trại; **không đổi** sau phát sinh tồn đầu tiên (MSG-FE23-18) |
| Tên | Chuỗi | Có | ≤ 100 |
| Nhóm | Enum | Có | `GREEN_ROUGHAGE` Thô xanh / `DRY_ROUGHAGE` Thô khô / `CONCENTRATE` Tinh / `TMR` Khẩu phần trộn / `MINERAL_ADDITIVE` Khoáng – phụ gia / `CALF_FEED` Thức ăn bê |
| Đơn vị tồn | Enum | Có | kg; không đổi sau phát sinh tồn |
| Đơn vị mua / kg mỗi đơn vị mua | Chuỗi / Số | Không | Số > 0 (ví dụ bao 25 kg) |
| Mức tồn tối thiểu (kg) | Số | Không | ≥ 0; tồn ≤ mức → REM-10 |
| Ghi chú dinh dưỡng | Chuỗi | Không | ≤ 500 |
| Trạng thái | Enum | — | `ACTIVE` ⇄ `INACTIVE`; có phát sinh → chỉ ngưng, không xóa |
| Suy ra | — | — | Tồn hiện tại, giá vốn bình quân gia quyền, giá trị tồn, dùng bình quân 7 ngày, số ngày đủ dùng |

Danh mục mẫu khi tạo trại: TA-01 → TA-09 (FE-18 §3.6), ACTIVE, không tồn, không mức tối thiểu; TA-05, TA-09 đơn vị mua bao 25 kg.

### 3.2 Nhà cung cấp
Đối tác (role SUPPLIER) của trại: Tên * (duy nhất), điện thoại, khu vực / địa chỉ, ghi chú, trạng thái. Đã được phiếu tham chiếu → chỉ ngưng (GBR-97).

### 3.3 Phiếu nhập kho (Feed Receipt)

| Thuộc tính | Bắt buộc | Ràng buộc |
|---|---|---|
| Mã | Hệ thống | `PNK-YYYY-nnnn`, duy nhất trong trại (BR-D34) |
| Ngày nhập | Có | Không tương lai (MSG-COM-07) |
| Nhà cung cấp | Có | ACTIVE; "+ Thêm NCC" |
| Số hóa đơn / phiếu giao | Không | ≤ 50 |
| Người nhận | Không | Thành viên hoặc chữ ≤ 100 |
| Nơi lưu | Không | ≤ 100 |
| Ghi chú | Không | ≤ 1.000 |
| Dòng: mặt hàng | Có | ACTIVE |
| Dòng: số lô · hạn dùng | Không | ≤ 30 · sau ngày nhập (MSG-FE23-03) |
| Dòng: số lượng | Có | > 0 |
| Dòng: đơn vị | Có | Đơn vị mua hoặc kg |
| Dòng: quy đổi kg | Suy ra | Số lượng × kg / đơn vị mua |
| Dòng: đơn giá | Có | Số nguyên VND ≥ 0 / đơn vị mua |
| Dòng: thành tiền | Suy ra | — |
| Tiền hàng, phí vận chuyển, tổng phải trả, đã trả, còn nợ, hình thức, hạn trả | — | Tổng = tiền hàng + phí VC; đã trả ≤ tổng (GBR-91) |
| Đính kèm | Không | PDF / JPG ≤ 10 MB |
| Trạng thái | — | `DRAFT` → `POSTED` → `VOIDED`; DRAFT không đổi tồn |
| Người ghi sổ, thời điểm; lý do hủy, người, thời điểm | — | — |

### 3.4 Phiếu điều chỉnh kho (Stock Adjustment)

| Thuộc tính | Bắt buộc | Ràng buộc |
|---|---|---|
| Mã | Hệ thống | `ĐCK-YYYY-nnnn` |
| Ngày kiểm | Có | Không tương lai |
| Loại | Có | `PERIODIC_COUNT` Kiểm định kỳ / `LOSS` Hao hụt / `SPOILAGE` Hư hỏng / `OTHER` Khác |
| Người kiểm | Không | ≤ 200 |
| Dòng (mỗi mặt hàng ACTIVE): tồn hệ thống tại ngày kiểm, tồn thực tế (≥ 0), chênh lệch, lý do (bắt buộc khi ≠ 0), giá trị = chênh × giá vốn BQ | — | 1 dòng / mặt hàng |
| Đính kèm | Không | Biên bản, ảnh |
| Trạng thái | — | `DRAFT` → `POSTED`; POSTED bất biến; sai → phiếu mới |

### 3.5 Khẩu phần (Ration)

| Thuộc tính | Bắt buộc | Ràng buộc |
|---|---|---|
| Mã | Hệ thống | `KP-nn`; mã + phiên bản duy nhất |
| Tên | Có | ≤ 100 |
| Nhóm đàn | Không | Bê, Vỗ béo, Đực giống, Cái sinh sản, Bò tơ, Khác (tham khảo) |
| Chuồng | Có | Chuồng ACTIVE; mỗi chuồng tối đa 1 phiên bản hiệu lực / ngày (BR-D38) |
| Hiệu lực từ | Có | ≥ ngày mai (MSG-FE23-10) |
| Hiệu lực đến | — | Đặt khi có phiên bản mới hoặc dừng |
| Cơ sở / nguồn | Không | ≤ 500 |
| Số bữa / ngày + giờ | Có | 1 / 2 / 3; mặc định 06:30, 16:30 |
| Thành phần | Có (≥ 1) | Mặt hàng ACTIVE; kg / con cho từng bữa ≥ 0, ít nhất 1 bữa > 0 |
| Trạng thái | — | `SCHEDULED` → `EFFECTIVE` → `ENDED`; SCHEDULED hủy được |
| Suy ra | — | kg và chi phí ước tính / con / ngày; lượng và chi phí kế hoạch / ngày |

### 3.6 Bản ghi cho ăn (Feeding Record)

| Thuộc tính | Bắt buộc | Ràng buộc |
|---|---|---|
| Chuồng, ngày, bữa (`MORNING` / `AFTERNOON` / `EVENING`) | Có | Duy nhất trong bản ghi VALID (BR-D37); ngày không tương lai |
| Giờ cho ăn | Không | Mặc định giờ bữa |
| Phiên bản khẩu phần | Hệ thống | Hoặc rỗng nếu không có |
| Số con lúc cho ăn | Hệ thống | — |
| Dòng: mặt hàng, kế hoạch kg (= kg / con × số con), thực tế kg (≥ 0, ≤ tồn), trong khẩu phần (cờ), đơn giá + chi phí theo giá vốn BQ | — | 1 dòng / mặt hàng |
| Thừa (kg) | Không | ≥ 0 |
| Người cho ăn | Không | Thành viên (Manager / Technician), mặc định người dùng |
| Ghi chú | Không | ≤ 500 |
| Trạng thái | — | `VALID` → `VOIDED` (lý do); sửa giữ VALID + "Đã sửa" + Record Revision |

### 3.7 Thẻ kho (Stock Movement)
Mặt hàng, thời điểm, loại (`RECEIPT` / `RECEIPT_VOID` / `ADJUSTMENT` / `FEEDING` / `FEEDING_CORRECTION` / `FEEDING_VOID`), số lượng kg (+/−), đơn giá, giá trị, dòng nguồn, tồn sau. Chỉ thêm; tồn = tổng phát sinh, **không bao giờ âm** (BR-D36).

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-23-01 | Quyền theo §2; trại ACTIVE. | GBR-103, GBR-14 |
| R-23-02 | Mã TA-nn duy nhất; mã và đơn vị tồn không đổi sau phát sinh tồn; có phát sinh → chỉ ngưng; INACTIVE không dùng cho phiếu nhập, khẩu phần, cho ăn mới; sửa mặt hàng không đổi chứng từ cũ. | GBR-98 |
| R-23-03 | Tồn chỉ đổi qua phát sinh từ: ghi sổ / hủy phiếu nhập, ghi sổ điều chỉnh, lưu / sửa / hủy bản ghi cho ăn. Tồn không âm. | GBR-99, BR-D36 |
| R-23-04 | Ghi sổ phiếu nhập: cộng kg từng dòng; giá vốn BQ = (giá trị tồn + giá trị nhập) ÷ (tồn + kg nhập); ghi khoản trả đầu; audit – 1 transaction; giải quyết REM-10 nếu tồn > mức. | GBR-99, UC-02 |
| R-23-05 | Hủy phiếu POSTED: có lý do; chỉ khi tồn từng mặt hàng ≥ số lượng đã nhập (MSG-FE23-05) – nếu không dùng điều chỉnh kho; thanh toán giữ trong lịch sử. | GBR-99 |
| R-23-06 | Trả NCC: theo GBR-91 (số nguyên > 0, ≤ còn nợ, ngày không tương lai và không trước ngày phiếu, Tiền mặt / Chuyển khoản; hủy có lý do, không sửa). Owner và Manager được ghi. Không phải hóa đơn / kế toán. | GBR-91, BR-D39 |
| R-23-07 | Điều chỉnh: so sánh tồn thực tế với tồn hệ thống tại ngày kiểm; chênh ≠ 0 cần lý do (MSG-FE23-08), tạo 1 phát sinh theo giá vốn BQ; POSTED bất biến, không đổi phiếu nhập hay bản ghi cho ăn. | GBR-100 |
| R-23-08 | Khẩu phần: kg / con / mặt hàng / bữa (1–3 bữa). Sửa = phiên bản mới hiệu lực từ ngày mai trở đi; phiên bản trước kết thúc ngày hôm trước; mỗi chuồng tối đa 1 phiên bản hiệu lực / ngày (MSG-FE23-11 nếu không tự kết thúc được). SCHEDULED hủy được; EFFECTIVE dừng từ ngày mai trở đi. Không đổi bản ghi cho ăn đã có. | GBR-101, BR-D38 |
| R-23-09 | Cảnh báo mặt hàng không đủ 1 ngày khi lưu khẩu phần – **không chặn**. | UC-06 AF3 |
| R-23-10 | Cho ăn: 1 bản ghi / chuồng / ngày / bữa (MSG-FE23-13); không tương lai; kế hoạch = kg / con × số con lúc ghi; thực tế ≥ 0, ≤ tồn (MSG-FE23-14); lưu trừ kho theo giá vốn BQ; giải quyết REM-11; đánh giá REM-10. | GBR-102, BR-D37 |
| R-23-11 | Sửa / hủy bản ghi cho ăn: chỉ Manager, có lý do, giữ giá trị cũ (Record Revision), điều chỉnh tồn theo chênh lệch; hủy trả toàn bộ về kho; REM-11 đánh giá lại. | GBR-102, BR-D15 |
| R-23-12 | Không có khẩu phần hiệu lực → MSG-FE23-20, chỉ nhập thực tế. Hết hàng → thực tế 0 + lý do trong ghi chú. | UC-08 AF1, AF2 |
| R-23-13 | REM-10: mặt hàng ACTIVE tồn ≤ mức tối thiểu, cho Owner + Manager. REM-11: bữa của khẩu phần hiệu lực hôm nay của chuồng có bò chưa có bản ghi VALID sau giờ bữa + 2 giờ, cho Manager + Technician. | GBR-104 |
| R-23-14 | Công thức: chi phí bản ghi = Σ kg thực tế × giá vốn BQ lúc ghi; số ngày đủ dùng = tồn ÷ dùng BQ 7 ngày; giá trị tồn = Σ tồn × giá vốn BQ; đầu con BQ = số con BQ / ngày từ phân chuồng; chênh lệch so khẩu phần = (thực tế − kế hoạch) ÷ kế hoạch trên bữa đã ghi; hao hụt điều chỉnh tách riêng, không phân bổ nhóm đàn; khẩu phần hiện chi phí ước tính theo giá vốn hiện tại. | GBR-105 |
| R-23-15 | Lệnh có Idempotency-Key; cập nhật có version → MSG-COM-05. | GBR-88, GBR-89 |

---

## 5. Luồng xử lý

### UC-FE23-02 Lập phiếu nhập kho
1. SCR-79: mã kế tiếp, ngày hôm nay. 2. Nhập NCC, ngày, số HĐ, người nhận, nơi lưu, ghi chú. 3. **+ Thêm mặt hàng**: mặt hàng, lô, hạn, số lượng + đơn vị, đơn giá → quy đổi kg, thành tiền. 4. Tổng, tồn trước → sau, kiểm trước khi lưu. 5. Đính kèm; phí VC, đã trả, hình thức, hạn trả → tổng phải trả, còn nợ. 6. **Lưu & cộng kho**. 7. Kiểm lại + version → R-23-04 (1 transaction). 8. MSG-FE23-01; REM-10.
AF1 Lưu nháp → MSG-FE23-02 · AF2 Ghi trả sau → popup Ghi thanh toán (MSG-FE06-13, 14) · AF3 Hủy khoản trả (MSG-FE06-15) · AF4 Thêm NCC (tên, SĐT) · AF5 Bỏ nháp / Hủy → MSG-COM-14.
E1 hạn ≤ ngày nhập → MSG-FE23-03 · E2 ngày tương lai → MSG-COM-07 · E3 thiếu → MSG-COM-06 · E4 đã trả > tổng → MSG-FE06-13 · E5 mặt hàng ngưng → MSG-COM-08 · E6 → MSG-COM-05 · E7 → MSG-COM-02.

### UC-FE23-03 Hủy phiếu nhập
SCR-78 → **Hủy phiếu** → MSG-FE23-04 + lý do → kiểm tồn → RECEIPT_VOID cho từng dòng → MSG-FE23-06. Không đủ tồn → MSG-FE23-05.

### UC-FE23-04 Kiểm kho
SCR-80 → ngày, loại, người kiểm → nhập tồn thực tế từng mặt hàng → lý do cho dòng chênh → **Ghi sổ** → ADJUSTMENT → MSG-FE23-07 (hoặc Lưu nháp → MSG-FE23-02).

### UC-FE23-06 Tạo / sửa khẩu phần
1. SCR-82: mã + v1 (mới) hoặc giá trị hiện tại + phiên bản kế tiếp. 2. Tên, nhóm đàn, chuồng, hiệu lực từ (≥ ngày mai), cơ sở. 3. Số bữa + giờ; thêm mặt hàng + kg / con / bữa. 4. Tính kg / con / ngày, giá vốn, đ / con / ngày (so với phiên bản trước), lượng + chi phí / ngày cho số con hiện tại, số ngày đủ dùng. 5. Kiểm. 6. **Lưu khẩu phần**. 7. Lưu; kết thúc phiên bản trước (hoặc khẩu phần khác của cùng chuồng) ngày hôm trước → MSG-FE23-09.
AF1 Hủy phiên bản lên lịch · AF2 Dừng (ngày kết thúc ≥ ngày mai) · AF3 cảnh báo tồn – không chặn · AF4 Hủy → MSG-COM-14.
E1 → MSG-FE23-10 · E2 → MSG-FE23-11 · E3 không thành phần / kg ≤ 0 → MSG-COM-06 / MSG-COM-10 · E4 → MSG-COM-05 · E5 → MSG-COM-02.

### UC-FE23-08 Ghi bữa ăn
1. Popup với ngày (mặc định hôm nay), chuồng, bữa. 2. Chọn chuồng, bữa → giờ, khẩu phần hiệu lực, số con, từng mặt hàng: kg / con, kế hoạch, tồn. 3. Nhập thực tế hoặc **Điền theo kế hoạch** rồi chỉnh; thêm mặt hàng ngoài khẩu phần, thừa, người cho ăn, ghi chú. 4. **Lưu & trừ kho**. 5. Kiểm R-23-10. 6. Lưu + phát sinh FEEDING (1 transaction), REM-11, REM-10. 7. MSG-FE23-12.
AF1 → MSG-FE23-20 · AF2 hết hàng → 0 + ghi chú · AF3 Hủy.
E1 → MSG-FE23-13 · E2 → MSG-FE23-14 · E3 → MSG-COM-07 · E4 → MSG-COM-06 · E5 → MSG-COM-02, không trừ kho.

### UC-FE23-09 Sửa / hủy bản ghi cho ăn
1. Popup: chuồng, bữa, ngày, người ghi, thời điểm; lựa chọn Sửa số lượng / Hủy bản ghi. 2. Nhập kg mới → hiện chênh lệch tồn. 3. Lý do → **Lưu thay đổi**. 4. Kiểm ≥ 0, tồn không âm, version. 5. Lưu sửa + Record Revision + FEEDING_CORRECTION → MSG-FE23-15.
AF1 Hủy → lý do → MSG-FE23-16 → VOIDED + FEEDING_VOID → MSG-COM-09.
E1 → MSG-FE23-14 · E2 → MSG-COM-06 · E3 → MSG-COM-05.

---

## 6. Màn hình và trường

### SCR-77 Tồn kho thức ăn

| # | Trường | Nội dung |
|---|---|---|
| 1 | Stock count / adjustment / Kiểm kho | Nút → SCR-80 |
| 2 | Create feed receipt / Tạo phiếu nhập kho | Nút → SCR-79 |
| 3 | Updated at / Cập nhật lúc | Thời điểm phát sinh mới nhất |
| 4 | Ô: Feeds in use / Đang dùng | Số mặt hàng ACTIVE theo nhóm |
| 5 | Ô: Low / out of stock / Sắp hết / hết | Số + tên mặt hàng tồn ≤ mức (REM-10) |
| 6 | Ô: Stock value / Giá trị tồn | Σ tồn × giá vốn BQ |
| 7 | Ô: Average use (7 days) / Dùng BQ 7 ngày | kg / ngày, kg / con / ngày |
| 8 | Search, Group, Status | Lọc; trạng thái Đủ / Sắp hết / Hết |
| 9 | Code / Feed / Group | TA-nn, tên, nhóm |
| 10 | Current stock / Tồn | kg + quy đổi đơn vị mua (≈ 44,8 bao 25 kg) |
| 11 | Minimum level / Tối thiểu | kg |
| 12 | Average per day (7 days) | kg |
| 13 | Days of cover / Số ngày đủ dùng | Tồn ÷ BQ / ngày |
| 14 | Lot near expiry / Lô sắp hết hạn | Lô + hạn gần nhất trong 30 ngày, hoặc "—" |
| 15 | Status | Đủ / Sắp hết / Hết |
| 16 | Actions | "Nhập kho" (SCR-79 có sẵn mặt hàng), "Xem" (thẻ kho: thời điểm, loại, số lượng, đơn giá, tồn sau, chứng từ nguồn) |
| 17 | Banner REM-10 | MSG-FE23-19 + "Tạo phiếu nhập kho" |
| 18 | Note | Giải thích mức tối thiểu, số ngày đủ dùng, REM-10 |

### SCR-78 Phiếu nhập kho

| # | Trường | Nội dung |
|---|---|---|
| 1 | Status tabs | Tất cả, Nháp, Đã ghi sổ, Đã hủy – có số |
| 2 | Period, Supplier | Lọc theo ngày nhập, mặc định tháng này và tháng trước |
| 3 | Summary tiles | Nhập tháng này (kg, số phiếu, tiền); nợ NCC (tiền, số phiếu); NCC đang hoạt động |
| 4 | Receipt code | PNK-YYYY-nnnn; link SCR-79 (DRAFT sửa được, khác chỉ đọc) |
| 5 | Receipt date, Supplier | Kèm số HĐ / phiếu giao |
| 6 | Items | Tên các mặt hàng |
| 7 | Total weight, Total amount, Outstanding | kg; tổng phải trả; còn nợ |
| 8 | Status | DRAFT / POSTED / VOIDED (+ lý do) |
| 9 | Actions | "Tiếp tục" (DRAFT), "Xem", "Ghi thanh toán" (popup dùng chung), "Hủy phiếu" (POSTED: lý do *; MSG-FE23-04 / 05 / 06) |

### SCR-79 Phiếu nhập kho (form)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Receipt code | Chỉ đọc | — | PNK-YYYY-nnnn kế tiếp | — |
| 2 | Receipt date / Ngày nhập | Ngày | * | Không tương lai | MSG-COM-06, MSG-COM-07 |
| 3 | Supplier / Nhà cung cấp | Dropdown có tìm | * | NCC ACTIVE + SĐT; "+ Thêm NCC" | MSG-COM-06 |
| 4 | Invoice / delivery note no. | Ô chữ | — | ≤ 50 | MSG-COM-10 |
| 5 | Received by / Người nhận | Chọn / chữ | — | ≤ 100 | MSG-COM-10 |
| 6 | Storage location / Nơi lưu | Ô chữ | — | ≤ 100 | MSG-COM-10 |
| 7 | Note | Ô chữ dài | — | ≤ 1.000 | MSG-COM-10 |
| 8 | + Add item | Nút | — | Thêm dòng | — |
| 9 | Feed / Mặt hàng | Dropdown | * | ACTIVE (tên, nhóm, mã) | MSG-COM-06, MSG-COM-08 |
| 10 | Lot no. · Expiry date | Chữ · ngày | — | ≤ 30 · > ngày nhập | MSG-FE23-03 |
| 11 | Quantity / Số lượng | Số | * | > 0 | MSG-COM-10 |
| 12 | Unit / Đơn vị | Chọn | * | Đơn vị mua hoặc kg | — |
| 13 | Conversion / Quy đổi | Chỉ đọc | — | kg | — |
| 14 | Unit price / Đơn giá | Số nguyên | * | ≥ 0 / đơn vị mua | MSG-COM-10 |
| 15 | Line amount, Totals row | Tính | — | Số mặt hàng, tổng kg, tiền hàng | — |
| 16 | Attachments | Tải lên | — | PDF / JPG ≤ 10 MB | MSG-COM-10 |
| 17 | Payment / Thanh toán | Số + chọn | — | Tiền hàng, phí VC, tổng, đã trả (≤ tổng), còn nợ, hình thức, hạn trả | MSG-FE06-13 |
| 18 | Summary panel | Chỉ đọc | — | Số mặt hàng, tổng kg, tồn trước → sau, trạng thái; báo khi mặt hàng thoát Sắp hết | — |
| 19 | Checks before saving | Bảng | — | ACTIVE; SL > 0, giá ≥ 0; hạn > ngày nhập; ngày không tương lai | — |
| 20 | Save & add to stock / Save draft / Cancel | Nút | — | Sau lưu → SCR-78 | MSG-FE23-01 / MSG-FE23-02 / MSG-COM-14 |

### SCR-80 Kiểm kho / điều chỉnh

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Adjustment code | Chỉ đọc | — | ĐCK-YYYY-nnnn | — |
| 2 | Count date / Ngày kiểm | Ngày | * | Không tương lai | MSG-COM-07 |
| 3 | Adjustment type / Loại | Dropdown | * | Kiểm định kỳ / Hao hụt / Hư hỏng / Khác | MSG-COM-06 |
| 4 | Counted by / Người kiểm | Chữ | — | ≤ 200 | MSG-COM-10 |
| 5 | Feed / System stock | Chỉ đọc | — | 1 dòng / mặt hàng ACTIVE; tồn tại ngày kiểm | — |
| 6 | Counted stock / Tồn thực tế | Số | * | ≥ 0 kg | MSG-COM-10 |
| 7 | Difference / Chênh lệch | Tính | — | Thực tế − hệ thống | — |
| 8 | Reason / Lý do | Ô chữ | * khi chênh ≠ 0 | — | MSG-FE23-08 |
| 9 | Value (đ) | Tính | — | Chênh × giá vốn BQ | — |
| 10 | Totals row | Tính | — | Tổng chênh kg, giá trị | — |
| 11 | Attachments | Tải lên | — | Biên bản / ảnh | — |
| 12 | Summary panel | Chỉ đọc | — | Mặt hàng có chênh, tổng chênh, giá trị, trạng thái; lưu ý không đổi phiếu nhập / bản ghi cho ăn cũ | — |
| 13 | Post adjustment / Save draft / Cancel | Nút | — | Sau lưu → SCR-77 | MSG-FE23-07 / MSG-FE23-02 |

### SCR-81 Khẩu phần

| # | Trường | Nội dung |
|---|---|---|
| 1 | Create ration | Nút → SCR-82 |
| 2 | Status | Hiệu lực & lên lịch (mặc định), Đã kết thúc, Tất cả |
| 3 | Summary tiles | Khẩu phần hiệu lực (chuồng, số con); lượng kế hoạch / ngày (kg, kg / con); chi phí kế hoạch / ngày (đ, đ / con); chuồng chưa có khẩu phần |
| 4 | Ration | Mã, tên, phiên bản |
| 5 | Applies to | Nhóm đàn, chuồng |
| 6 | Head | Số con hiện tại |
| 7 | Components | Mặt hàng + kg / con / ngày |
| 8 | kg/head/day, đ/head/day | Tính |
| 9 | Effective | Từ – đến |
| 10 | Status | Lên lịch / Hiệu lực / Đã kết thúc |
| 11 | Actions | "Sửa" (phiên bản mới), "Hủy phiên bản" (Lên lịch), "Dừng" (Hiệu lực, ngày kết thúc ≥ ngày mai) |
| 12 | Note | Mỗi chuồng 1 khẩu phần / ngày; kế hoạch bữa = khẩu phần × số con |

### SCR-82 Soạn khẩu phần

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Code / Version | Chỉ đọc | — | KP-nn; phiên bản kế tiếp + phiên bản đang hiệu lực | — |
| 2 | Ration name / Tên | Ô chữ | * | ≤ 100 | MSG-COM-06 |
| 3 | Herd group / Nhóm đàn | Dropdown | — | Tham khảo | — |
| 4 | Pens / Chuồng | Chọn nhiều | * | Chuồng ACTIVE + số con | MSG-COM-06, MSG-FE23-11 |
| 5 | Effective from / Hiệu lực từ | Ngày | * | ≥ ngày mai | MSG-FE23-10 |
| 6 | Basis / source / Cơ sở | Ô chữ | — | ≤ 500 | MSG-COM-10 |
| 7 | Sessions per day / Số bữa | Radio + giờ | * | 1 / 2 / 3; mặc định 06:30, 16:30 | — |
| 8 | + Add feed | Nút | — | — | — |
| 9 | Feed / Mặt hàng | Dropdown | * | ACTIVE | MSG-COM-08 |
| 10 | Session columns / Cột bữa | Số | * | kg / con ≥ 0; ít nhất 1 > 0 | MSG-COM-10 |
| 11 | Total per head per day, Average cost, đ/head/day | Tính | — | — | — |
| 12 | Totals row | Tính | — | kg, đ / con / ngày | — |
| 13 | Summary panel | Chỉ đọc | — | kg + chi phí / con / ngày (so với phiên bản trước); lượng + chi phí / ngày của các chuồng; số ngày đủ dùng | — |
| 14 | Checks before saving | Bảng | — | ACTIVE, > 0; 1 khẩu phần / chuồng / ngày; cảnh báo không đủ 1 ngày | — |
| 15 | Save ration / Cancel | Nút | — | → SCR-81 | MSG-FE23-09, MSG-COM-05, MSG-COM-02 |

### SCR-86 Khẩu phần hôm nay (Technician, điện thoại, chỉ đọc)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Date | Hôm nay; số chuồng |
| 2 | Session tabs | 1 tab / bữa kèm giờ |
| 3 | Feeding log | Link SCR-83 (chỉ đọc, hôm nay) |
| 4 | Pen card | Chuồng, số con, mã khẩu phần; "Chưa ghi" / "Đã ghi hh:mm"; kg kế hoạch từng mặt hàng cho bữa (đánh dấu hết hàng); tổng bữa |
| 5 | Notice | "Chỉ xem – Quản lý ghi bữa ăn. Báo Quản lý khi thiếu thức ăn." |

### SCR-83 Nhật ký cho ăn

| # | Trường | Nội dung |
|---|---|---|
| 1 | Record feeding session | Nút (Manager) → popup; "Điền nhanh theo khẩu phần" cho các bữa trống đã chọn để xem lại |
| 2 | Date | Chọn ngày, mặc định hôm nay; xem Theo ngày / Theo tuần |
| 3 | Session, Pen | Lọc |
| 4 | Summary tiles | Thực tế hôm nay / kế hoạch (kg); bữa đã ghi / dự kiến + chuồng chưa ghi (REM-11); chênh lệch bữa đã ghi (%); giá trị đã trừ kho hôm nay |
| 5 | Pen / Head | Chuồng, số con, mã + phiên bản khẩu phần |
| 6 | Session columns | Kế hoạch → thực tế kg, giờ + người cho ăn, hoặc "Chưa ghi"; ghi chú (ví dụ hết hàng) |
| 7 | Whole day | Thực tế / kế hoạch kg |
| 8 | Recorded by | Tên |
| 9 | ⋯ | Manager: "Sửa" / "Hủy" (popup) |
| 10 | Totals row | Chuồng, số con, thực tế / kế hoạch |
| 11 | Consumption by feed today | Mặt hàng, kg thực tế, tồn còn, trạng thái |
| 12 | Notices | REM-11; REM-10 + link SCR-79; "Thuốc trộn thức ăn ghi trong ca sức khỏe (FE-10). Chủ trại và Kỹ thuật viên chỉ xem." |

### Popup Ghi bữa ăn

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Date / Ngày | Chỉ đọc | — | Từ nhật ký; không tương lai | MSG-COM-07 |
| 2 | Pen / Chuồng | Dropdown | * | Chuồng ACTIVE + số con | MSG-COM-06 |
| 3 | Session / Bữa | Dropdown | * | Sáng / Chiều / Tối (bữa của khẩu phần) | MSG-COM-06, MSG-FE23-13 |
| 4 | Feeding time / Giờ cho ăn | Giờ | — | Mặc định giờ bữa | — |
| 5 | Effective ration / Khẩu phần | Chỉ đọc | — | Mã + tên, hoặc MSG-FE23-20 | — |
| 6 | Fed by / Người cho ăn | Dropdown | — | Manager / Technician; mặc định người dùng | — |
| 7 | Feed / Mặt hàng | Chỉ đọc | — | Tên, mã, kg / con | — |
| 8 | Planned / Kế hoạch | Chỉ đọc | — | kg = kg / con × số con | — |
| 9 | Actual / Thực tế | Số | * | ≥ 0, ≤ tồn | MSG-FE23-14 |
| 10 | Stock available / Tồn | Chỉ đọc | — | kg | — |
| 11 | Session total | Tính | — | Kế hoạch, thực tế | — |
| 12 | + Add feed outside the ration | Nút | — | Dòng mới, kế hoạch 0 | — |
| 13 | Leftover (kg) / Thừa | Số | — | ≥ 0 | MSG-COM-10 |
| 14 | Note | Ô chữ | — | ≤ 500 | MSG-COM-10 |
| 15 | Rules notice | Chữ | — | Không trùng chuồng + ngày + bữa; không tương lai; thực tế ≤ tồn; "Lưu sẽ trừ n kg khỏi kho" | — |
| 16 | Fill from plan / Cancel / Save & deduct stock | Nút | — | — | MSG-FE23-12, MSG-COM-02 |

### Popup Sửa / Hủy bản ghi cho ăn

| # | Trường | Loại | Bắt buộc | Nội dung | Lỗi |
|---|---|---|---|---|---|
| 1 | Record / Bản ghi | Chỉ đọc | — | Chuồng, bữa, ngày + giờ, người ghi, thời điểm ghi | — |
| 2 | Action / Thao tác | Radio | * | Sửa số lượng (mặc định) / Hủy bản ghi | — |
| 3 | Feed / Recorded / New value / Stock difference | Bảng | — | 1 dòng / mặt hàng; giá trị mới ≥ 0; "trừ thêm n kg" / "trả lại n kg" | MSG-FE23-14 |
| 4 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 5 | Notice | Chữ | — | Tồn điều chỉnh theo chênh lệch; bản gốc + lý do giữ trong lịch sử; hủy trả toàn bộ về kho | — |
| 6 | Close / Save changes | Nút | — | — | MSG-FE23-15; hủy: MSG-FE23-16 → MSG-COM-09; MSG-COM-05 |

### SCR-84 Danh mục thức ăn và nhà cung cấp

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Tabs | Tab có số | — | Mặt hàng (n) / Nhà cung cấp (n) | — |
| 2 | Add feed item / Add supplier | Nút | — | Mở form bên | — |
| 3 | Search, Group, Status | Lọc | — | — | — |
| 4 | Feed item list | Cột | — | Mã, tên, nhóm, đơn vị tồn, đơn vị mua, mức tối thiểu, giá vốn BQ, trạng thái; "Sửa" | — |
| 5 | Code / Mã | Ô chữ | * | TA-nn, duy nhất; khóa sau phát sinh | MSG-FE23-18, MSG-FE18-02 (Q1) |
| 6 | Name / Tên | Ô chữ | * | ≤ 100 | MSG-COM-06 |
| 7 | Group / Nhóm | Dropdown | * | 6 nhóm §3.1 | MSG-COM-06 |
| 8 | Stock unit / Đơn vị tồn | Chọn | * | kg; khóa sau phát sinh | MSG-FE23-18 |
| 9 | Purchase unit / kg per purchase unit | Chữ / Số | — | Số > 0 | MSG-COM-10 |
| 10 | Minimum stock level (kg) | Số | — | ≥ 0 | MSG-COM-10 |
| 11 | Nutrition note | Ô chữ | — | ≤ 500 | MSG-COM-10 |
| 12 | Inactive / Ngưng | Checkbox | — | Có phát sinh → chỉ ngưng | — |
| 13 | Cancel / Save | Nút | — | — | MSG-FE23-17 |
| 14 | Supplier form | Form | Tên * | Tên duy nhất, SĐT, khu vực / địa chỉ, ghi chú, trạng thái (GBR-97) | MSG-COM-06, MSG-FE23-17 |

### SCR-85 Báo cáo tiêu thụ và chi phí

| # | Trường | Nội dung |
|---|---|---|
| 1 | Period * / Kỳ | Mặc định đầu tháng → hôm nay (GBR-66); MSG-COM-11 |
| 2 | Group by / Nhóm theo | Nhóm đàn (mặc định) / Chuồng / Mặt hàng |
| 3 | Print report / In | Bố cục in của kết quả đang hiển thị |
| 4 | Summary tiles | Tổng tiêu thụ (kg, ngày, con-ngày); chi phí (đ); BQ đ và kg / con / ngày; nhập trong kỳ (kg, phiếu, tiền) |
| 5 | Group | Nhóm đàn / chuồng / mặt hàng |
| 6 | Average head | Số con BQ / ngày |
| 7 | Consumption (kg), kg/head/day | Từ bản ghi VALID |
| 8 | Cost (đ), đ/head/day | Thực tế × giá vốn BQ lúc cho ăn |
| 9 | Versus ration | (thực tế − kế hoạch) ÷ kế hoạch các bữa đã ghi + ghi chú |
| 10 | Totals row | — |
| 11 | Cost by feed | Mặt hàng + chi phí |
| 12 | Calculation notes | Định nghĩa GBR-105; hao hụt điều chỉnh tách riêng |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Tồn kho | `q?, group?, status?` | `[StockView {feedId, code, name, group, stockKg, purchaseEq, minKg, avgDaily7, daysOfCover, nearExpiryLot?, status}]` + tiles | — | `GET /api/farms/{farmId}/feed/stock` |
| A2 | Thẻ kho | — | `[MovementView {at, type, qtyKg, unitCost, value, balanceAfter, source{type, code}}]` | — | `GET …/feed/stock/{feedId}/movements` |
| A3 | Phiếu nhập: danh sách / tạo / sửa nháp | — / `CreateReceiptRequest {date, supplierId, invoiceNo?, receivedBy?, location?, note?, lines[{feedId, lot?, expiry?, qty, unit, unitPrice}], transportFee, paid?, method?, dueDate?, post: bool}` / `UpdateDraftReceiptRequest {…, version}` + `Idempotency-Key` | `[ReceiptView]` / `ReceiptView` | FE23-03, COM-07, COM-06, FE06-13, COM-08, COM-05 | `GET` / `POST /api/farms/{farmId}/feed/receipts` · `PUT …/receipts/{receiptId}/draft` |
| A4 | Ghi sổ / hủy phiếu nhập | `VersionRequest {version}` / `VoidReceiptRequest {reason, version}` + `Idempotency-Key` | `ReceiptView` | FE23-05, COM-06, COM-05 | `POST …/receipts/{receiptId}/post` · `…/void` |
| A5 | Bỏ nháp phiếu nhập | `version` + `Idempotency-Key` | — | COM-05 | Chưa có – đề xuất `DELETE …/feed/receipts/{receiptId}` |
| A6 | Trả NCC | Như FE-06 A16 | `PaymentResultDTO` | FE06-13, COM-07 | `GET` / `POST …/receipts/{receiptId}/payments` · hủy: `POST /api/farms/{farmId}/payments/{paymentId}/void` |
| A7 | Đính kèm phiếu nhập / điều chỉnh | File | `AttachmentDTO` | COM-10 | `…/receipts/{id}/attachments` · `…/adjustments/{id}/attachments` (GET / POST / DELETE) |
| A8 | Điều chỉnh: danh sách / tạo / sửa nháp / ghi sổ | — / `StockAdjustmentRequest {countDate, type, countedBy?, lines[{feedId, countedKg, reason?}], post}` / `{…, version}` / `VersionRequest` + `Idempotency-Key` | `AdjustmentView {…, lines[{systemKg, countedKg, diffKg, value}]}` | FE23-08, COM-07, COM-06, COM-05 | `GET` / `POST …/feed/adjustments` · `GET …/{adjustmentId}` · `PUT …/{adjustmentId}/draft` · `POST …/{adjustmentId}/post` |
| A9 | Khẩu phần: danh sách / lưu phiên bản | `status?` / `SaveRationRequest {rationId?, name, herdGroup?, penIds[], effectiveFrom, basis?, sessions[{key, time}], components[{feedId, kgPerSession[]}], baseVersion?}` + `Idempotency-Key` | `[RationView]` / `RationView {code, version, prevEndsOn?, perHeadDayKg, perHeadDayCost, dailyKg, dailyCost, coverWarnings[]}` | FE23-10, FE23-11, COM-06, COM-10, COM-05 | `GET` / `POST /api/farms/{farmId}/feed/rations` |
| A10 | Hủy phiên bản lên lịch / dừng khẩu phần | `{version}` / `{endDate, version}` + `Idempotency-Key` | `RationView` | FE23-10, COM-05 | Chưa có – đề xuất `POST …/feed/rations/{rationId}/versions/{v}/cancel` · `POST …/feed/rations/{rationId}/stop` |
| A11 | Nhật ký cho ăn | `from*, to*, session?, penId?` | `[FeedingView]` + tiles + kế hoạch các bữa chưa ghi | — | `GET …/feed/feeding-records` |
| A12 | Dữ liệu mở popup (kế hoạch theo chuồng, bữa) | `penId, date, session` | `{ration?{code, name, version}, headcount, lines[{feedId, kgPerHead, plannedKg, stockKg}], existingRecordId?}` | FE23-20 | Chưa có riêng – đề xuất `GET …/feed/feeding-records/plan` |
| A13 | Ghi bữa ăn | `RecordFeedingRequest {penId, date, session, time?, fedBy?, lines[{feedId, actualKg}], leftoverKg?, note?}` + `Idempotency-Key` | `FeedingView` | FE23-13, FE23-14, COM-07, COM-06, COM-02 | `POST …/feed/feeding-records` |
| A14 | Sửa / hủy bản ghi | `FeedingCorrectionRequest {lines[{feedId, newKg}], reason, version}` / `FeedingVoidRequest {reason, version}` + `Idempotency-Key` | `FeedingView` | FE23-14, COM-06, COM-05 | `POST …/feeding-records/{recordId}/correct` · `…/void` |
| A15 | Danh mục: danh sách / tạo / sửa | — / `FeedItemRequest {code, name, group, stockUnit, purchaseUnit?, kgPerPurchaseUnit?, minKg?, nutritionNote?, active, version?}` + `Idempotency-Key` | `[FeedItemView]` / `FeedItemView` | FE23-18, COM-06, COM-10, COM-05 | `GET` / `POST …/feed/catalogue` · `PUT …/catalogue/{feedId}` |
| A16 | Nhà cung cấp | Như đối tác (FE-06), `role = SUPPLIER` | — | COM-06 | Route đối tác dùng chung (FE-06) |
| A17 | Báo cáo | `ConsumptionReportRequest {from, to, groupBy}` | `ConsumptionReport {tiles, rows[{group, avgHead, kg, kgPerHeadDay, cost, costPerHeadDay, variancePct, notes}], total, costByFeed[], adjustmentLosses}` | COM-11 | `POST …/feed/reports/consumption` |
| A18 | Nhắc việc thức ăn | — | REM-10 / REM-11 theo vai trò | — | `GET …/feed/reminders` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE23-01 | Toast thành công | Đã ghi sổ phiếu {receipt_code}. Đã cộng {total_kg} kg vào kho. |
| MSG-FE23-02 | Toast thành công | Đã lưu nháp {document_code}. Tồn kho chưa thay đổi. |
| MSG-FE23-03 | Dưới trường | Hạn dùng phải sau ngày nhập. |
| MSG-FE23-04 | Hộp xác nhận | Hủy phiếu {receipt_code}? {total_kg} kg sẽ bị trừ khỏi kho. Các khoản thanh toán vẫn giữ trong lịch sử. |
| MSG-FE23-05 | Trong hộp thoại | Không thể hủy phiếu {receipt_code}: tồn của {feed} ({stock} kg) nhỏ hơn số lượng đã nhập. Hãy lập phiếu điều chỉnh kho. |
| MSG-FE23-06 | Toast thành công | Đã hủy phiếu {receipt_code}. |
| MSG-FE23-07 | Toast thành công | Đã ghi sổ phiếu điều chỉnh {document_code}: {difference} kg ({value} đ). |
| MSG-FE23-08 | Trên dòng | Nhập lý do cho mỗi mặt hàng có chênh lệch. |
| MSG-FE23-09 | Toast thành công | Đã lưu khẩu phần {ration_code} v{version}, hiệu lực từ {date}. Phiên bản trước kết thúc ngày {end_date}. |
| MSG-FE23-10 | Dưới trường | Ngày hiệu lực phải từ ngày mai trở đi. |
| MSG-FE23-11 | Trên form | Chuồng {pen} đã có khẩu phần {ration_code} vào ngày {date}. |
| MSG-FE23-12 | Toast thành công | Đã lưu bữa ăn của {pen} ({session}). Đã trừ {total_kg} kg khỏi kho. |
| MSG-FE23-13 | Trong hộp thoại | {pen} đã có bản ghi bữa {session} ngày {date}. [Mở bản ghi] |
| MSG-FE23-14 | Trên dòng | {feed}: chỉ còn {stock} kg trong kho. |
| MSG-FE23-15 | Toast thành công | Đã sửa bản ghi cho ăn. Tồn kho điều chỉnh {difference} kg. |
| MSG-FE23-16 | Hộp xác nhận | Hủy bản ghi bữa {session} của {pen} ngày {date}? {total_kg} kg sẽ được trả lại kho. |
| MSG-FE23-17 | Toast thành công | Đã lưu {name}. |
| MSG-FE23-18 | Dưới trường | Không thể đổi mã và đơn vị tồn vì {feed} đã có phát sinh kho. |
| MSG-FE23-19 | Banner | {count} mặt hàng đang ở mức tối thiểu hoặc thấp hơn: {feeds}. [Tạo phiếu nhập kho] |
| MSG-FE23-20 | Trong hộp thoại | {pen} không có khẩu phần hiệu lực ngày {date}. Chỉ nhập lượng thực tế. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-23-01 | Technician | Gọi tạo phiếu nhập / khẩu phần / ghi bữa | 403 | H | R-23-01 |
| TC-23-02 | Owner | Gọi ghi bữa ăn | 403 | H | R-23-01 |
| TC-23-03 | Mặt hàng có phát sinh | Đổi mã / đơn vị tồn | MSG-FE23-18 | I | R-23-02 |
| TC-23-04 | Mặt hàng INACTIVE | Chọn trong phiếu nhập | MSG-COM-08 | I | R-23-02 |
| TC-23-05 | Phiếu DRAFT 500 kg | Lưu nháp | Tồn không đổi | I | R-23-03 |
| TC-23-06 | Tồn 100 kg @ 10.000; nhập 100 kg @ 12.000 | Ghi sổ | Tồn 200 kg; giá vốn BQ 11.000 | U, I | R-23-04 |
| TC-23-07 | 10 bao × 25 kg | Nhập | Quy đổi 250 kg | U | §3.3 |
| TC-23-08 | Hạn dùng = ngày nhập | Lưu | MSG-FE23-03 | U | §3.3 |
| TC-23-09 | Tổng 5.000.000, đã trả 6.000.000 | Lưu | MSG-FE06-13 | U, H | R-23-06 |
| TC-23-10 | Tồn 50 kg < 100 kg đã nhập | Hủy phiếu | MSG-FE23-05 | I | R-23-05 |
| TC-23-11 | Tồn đủ | Hủy phiếu có lý do | VOIDED; RECEIPT_VOID; thanh toán giữ | I | R-23-05 |
| TC-23-12 | Kiểm: hệ thống 200, thực tế 190, không lý do | Ghi sổ | MSG-FE23-08 | U | R-23-07 |
| TC-23-13 | Kiểm có lý do | Ghi sổ | ADJUSTMENT −10 kg × giá vốn; phiếu nhập cũ không đổi | I | R-23-07 |
| TC-23-14 | Khẩu phần hiệu lực từ hôm nay | Lưu | MSG-FE23-10 | U | R-23-08 |
| TC-23-15 | KP-01 v1 hiệu lực; lưu v2 từ 10/11 | Lưu | v1 kết thúc 09/11; MSG-FE23-09 | I | R-23-08 |
| TC-23-16 | Chuồng B1 có KP-02 lên lịch từ 10/11 | Lưu KP-01 cho B1 từ 10/11 | MSG-FE23-11 | I | R-23-08 |
| TC-23-17 | Mặt hàng không đủ 1 ngày | Lưu khẩu phần | Cảnh báo, vẫn lưu | I, E | R-23-09 |
| TC-23-18 | Khẩu phần 5 kg / con / bữa, chuồng 12 con | Mở popup | Kế hoạch 60 kg | U | R-23-10 |
| TC-23-19 | Đã có bữa sáng B1 hôm nay | Ghi lại | MSG-FE23-13 | I | R-23-10 |
| TC-23-20 | Tồn 40 kg | Thực tế 50 kg | MSG-FE23-14 | U, I | R-23-10 |
| TC-23-21 | Ngày mai | Ghi bữa | MSG-COM-07 | U, H | R-23-10 |
| TC-23-22 | Ghi bữa hợp lệ | Lưu | FEEDING trừ kho theo giá vốn BQ; REM-11 RESOLVED; REM-10 nếu tồn ≤ mức | I | R-23-10, R-23-13 |
| TC-23-23 | Chuồng không có khẩu phần | Mở popup | MSG-FE23-20; vẫn ghi thực tế được | E | R-23-12 |
| TC-23-24 | Bản ghi 60 kg sửa thành 50 kg | Lưu có lý do | FEEDING_CORRECTION +10 kg; Record Revision; "Đã sửa" | I | R-23-11 |
| TC-23-25 | Sửa thành số làm tồn âm | Lưu | MSG-FE23-14 | I | R-23-11 |
| TC-23-26 | Hủy bản ghi 60 kg | Xác nhận | VOIDED; FEEDING_VOID +60 kg; REM-11 đánh giá lại | I | R-23-11 |
| TC-23-27 | Bữa 06:30 chưa ghi | 08:31 | REM-11 cho Manager, Technician | I | R-23-13 |
| TC-23-28 | Tồn 300 kg, dùng 7 ngày 420 kg | Xem SCR-77 | BQ 60 kg / ngày; đủ 5 ngày | U | R-23-14 |
| TC-23-29 | Chuồng 4 con, 10 ngày, có 1 phiếu điều chỉnh hao hụt | Báo cáo theo nhóm đàn | Con-ngày 40; hao hụt hiện riêng, không phân bổ | I | R-23-14 |
| TC-23-30 | Kế hoạch 60, thực tế 54 | Báo cáo | Chênh lệch −10 % | U | R-23-14 |
| TC-23-31 | 2 Manager cùng sửa 1 bản ghi | Đồng thời | Người sau MSG-COM-05 | I | R-23-15 |
| TC-23-32 | Technician mở SCR-86 | Xem | Chỉ đọc; thẻ chuồng "Chưa ghi"/"Đã ghi hh:mm"; không có nút ghi | E | §6 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Mã lỗi khi trùng mã TA-nn | Dùng nội dung như MSG-FE18-02 |
| Q2 | Bỏ nháp phiếu nhập / điều chỉnh, hủy phiên bản khẩu phần, dừng khẩu phần chưa có route | Thêm A5, A10 |
| Q3 | API kế hoạch khi mở popup ghi bữa | Thêm A12 |
| Q4 | "Điền nhanh theo khẩu phần" cho nhiều bữa: lưu 1 lần hay từng bữa? | Mở lần lượt từng popup đã điền sẵn để Manager xác nhận |
| Q5 | UC-FE23-01, 03, 04, 05, 07, 10, 11 không có đặc tả Part II | Theo Part III + GBR |
| Q6 | Giá vốn khi tồn về 0 rồi nhập lại | Giá vốn BQ = đơn giá của lần nhập mới |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho TaiDX duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
