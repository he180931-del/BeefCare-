# SPEC FE-13 – Xuất đàn (phiếu xuất)

| | |
|---|---|
| Feature | FE-13 Herd Exit Recording |
| Use case | UC-FE13-01 → UC-FE13-04 |
| Người phụ trách | AnNT (BE + FE + test) · Review BE: TuanPQ · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Herd Exit Voucher, Herd Exit, Voucher Payment), §3.3 (BR-D09, 11, 34, 35, 39), §3.4.6 (Table 3.4-6), Part II §13, Part III §13 (SCR-41 → SCR-43, SCR-76, 2 popup + popup Ghi thanh toán dùng chung), MSG-FE13, GBR-07, 26, 34 → 36, 46, 91, 92, 94, 95, 97; REM-12, REM-13 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 04 (Xuất đàn).
> Popup **Ghi thanh toán** (ở đây là "Ghi thu tiền") dùng chung, mô tả đầy đủ trong spec FE-06 §6.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE13-01 | Lập và xác nhận phiếu xuất (bán, loại thải, khác); xác nhận / bỏ phiếu chết chờ duyệt; ghi chết trực tiếp | Owner | SCR-42, SCR-43, popup Chọn bò |
| UC-FE13-02 | Xem phiếu xuất | Owner, Manager (chỉ xem) | SCR-41, SCR-76 |
| UC-FE13-03 | Hủy phiếu xuất đã xác nhận | Owner | Popup Hủy phiếu xuất |
| UC-FE13-04 | Ghi / hủy khoản thu từ người mua | Owner | Popup Ghi thanh toán (chế độ thu tiền) |

**Liên quan:** phiếu chết PENDING được tạo khi đóng ca sức khỏe Chết / Mất tích (FE-10); cảnh báo ngưng thịt (FE-09, FE-10); REM-12, REM-13 (FE-14); A03 trên dashboard (FE-15).

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem danh sách, chi tiết phiếu | Có | Có (chỉ xem) | — |
| Lập, sửa, bỏ nháp, xác nhận, bỏ phiếu chết, hủy, ghi thu tiền | **Chỉ Owner** | — | — |
| Thêm người mua mới | **Chỉ Owner** | — | — |

Cần trại ACTIVE (GBR-07, GBR-34, GBR-94).

---

## 3. Dữ liệu

### 3.1 Phiếu xuất (Herd Exit Voucher)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Mã phiếu | `PX-YYYY-nnnn` | Hệ thống | Duy nhất trong trại, theo năm, không tái sử dụng | BR-D34 |
| Loại xuất | Enum | Có | `SALE` Bán / `CULL` Loại thải / `DEATH` Chết – mất / `OTHER` Khác; cố định sau lần lưu đầu | SCR-42 |
| Ngày xuất | Ngày | Có | Không tương lai; không trước ngày nhập đàn hoặc sự kiện mới nhất của bất kỳ con nào trên phiếu | GBR-34 |
| Người mua / thương lái | Đối tác (BUYER) | Có (Bán, Loại thải) | Đối tác ACTIVE; "+ Thêm người mua" | SCR-42, GBR-97 |
| Nơi đến | Chuỗi | Có (Khác) | ≤ 150 | SCR-42 |
| Giấy kiểm dịch vận chuyển | Chuỗi | Không | ≤ 50 | SCR-42 |
| Biển số xe | Chuỗi | Không | ≤ 20 | SCR-42 |
| Ghi chú | Chuỗi dài | Không | ≤ 1.000 | SCR-42 |
| Loại mất (DEATH) | Enum | — | `DIED` Chết / `MISSING` Mất tích | SCR-43 |
| Nguyên nhân / ghi chú (DEATH) | Chuỗi dài | Có | ≤ 1.000 | SCR-43 |
| Xử lý xác (DEATH, chỉ Chết) | Enum | Có | Tiêu hủy hoặc chôn tại trại / Giao thú y địa phương / Khác (chữ) | SCR-43 |
| Ca sức khỏe nguồn | Tham chiếu | — | Khi tạo từ FE-10 | GBR-95 |
| Cách tính giá | Enum | Có (Bán, Loại thải) | Theo kg (mặc định) / Theo con | GBR-92 |
| Tiền bò | Suy ra | — | Σ tiền dòng | GBR-91 |
| Khấu trừ | Số nguyên VND | Không | ≥ 0, ≤ tiền bò (hao hụt, phí môi giới) | SCR-42 |
| Tổng phải thu | Suy ra | — | Tiền bò − khấu trừ | GBR-91 |
| Đã thu (đặt cọc) | Số nguyên VND | Không | ≥ 0, ≤ tổng phải thu | SCR-42 |
| Còn phải thu | Suy ra | — | Tổng − Σ khoản thu RECORDED | GBR-91 |
| Hình thức, hạn thu | — | Không | Tiền mặt / Chuyển khoản; ngày | SCR-42 |
| Đính kèm | File | Không | PDF / JPG ≤ 10 MB | SCR-42 |
| Người báo (phiếu chết), người xác nhận + thời điểm, lý do bỏ / hủy + người + thời điểm | — | — | — | §3.2 |
| Trạng thái | Enum | — | `DRAFT` → `CONFIRMED` → `VOIDED`; `PENDING` → `CONFIRMED` / `DISMISSED`; DRAFT có thể bỏ (xóa) | Table 3.4-6 |

Phiếu DEATH **không có số tiền** (GBR-95).

### 3.2 Dòng xuất (Herd Exit)

| Thuộc tính | Ràng buộc |
|---|---|
| Phiếu, số dòng, bò | Bò ACTIVE, không nằm trên dòng DRAFT / PENDING / CONFIRMED nào khác (BR-D35); tối đa 1 lần xuất PENDING / CONFIRMED mỗi bò (BR-D11) |
| Cân xuất + cơ sở | Mặc định cân VALID mới nhất với cơ sở ESTIMATED ("UT"); nhập cân thực tế → MEASURED |
| Đơn giá, tiền dòng | ≥ 0; tính theo GBR-91 |
| Kết quả kiểm trước khi xác nhận | Ngưng thịt, ca OPEN / CHRONIC, mũi tiêm / nhắc việc tương lai, thai đang có, bê nháp của bò mẹ |
| Chuồng cuối, trạng thái | Theo phiếu |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-13-01 | Chỉ Owner lập, sửa, xác nhận, bỏ, hủy phiếu xuất và ghi thu tiền. | GBR-34, GBR-91, GBR-94 |
| R-13-02 | Chỉ thêm được bò ACTIVE không nằm trên dòng DRAFT / PENDING / CONFIRMED khác → MSG-FE13-08. Thêm bằng danh sách lọc hoặc quét QR. | GBR-94, BR-D35 |
| R-13-03 | DRAFT / PENDING không có hiệu lực: bò vẫn ACTIVE. Bò trên phiếu DRAFT không thêm được vào phiếu khác. | GBR-94, UC-01 AF3 |
| R-13-04 | Ngày xuất trong [ngày nhập đàn hoặc sự kiện mới nhất của mọi con trên phiếu, hôm nay] → ngoài khoảng MSG-FE13-03. | GBR-34 |
| R-13-05 | Bán / Loại thải bắt buộc người mua; Khác bắt buộc nơi đến; Chết bắt buộc nguyên nhân và (với Chết) xử lý xác. | GBR-34, SCR-42, SCR-43 |
| R-13-06 | Kiểm tra trước khi xác nhận, theo từng con: ngưng thịt còn hiệu lực sau ngày xuất (với Bán / Loại thải → tô nổi MSG-FE13-07), ca OPEN / CHRONIC, mũi tiêm và nhắc việc tương lai sẽ bị hủy, thai đang có, bê nháp của bò mẹ. **Cảnh báo không chặn**; Owner phải tick xác nhận (MSG-COM-16). | GBR-35, GBR-94, GBR-46 |
| R-13-07 | Xác nhận: kiểm lại; nếu **bất kỳ** con nào không còn ACTIVE → không xác nhận gì (MSG-COM-05). Trong **một transaction** cho mọi con: EXITED; đóng phân chuồng tại ngày xuất; hủy mũi tiêm và nhắc việc sau ngày xuất; đóng ca OPEN / CHRONIC với kết quả CLOSED_BY_EXIT; đóng thai đang có là DAM_EXITED; audit. Bê nháp của bò mẹ **vẫn chờ**. | GBR-35, GBR-94 |
| R-13-08 | Bò EXITED chỉ đọc, giữ đủ lịch sử. | GBR-26 |
| R-13-09 | Phiếu chết PENDING (từ FE-10): Owner hoàn thiện nguyên nhân, xử lý xác (Chết), đính kèm bằng chứng → xác nhận (R-13-07); hoặc **bỏ** với lý do bắt buộc → DISMISSED, bò vẫn ACTIVE, ca giữ kết quả. Trong lúc PENDING bò hiện "Chờ xác nhận chết / mất", không nhận sự kiện mới; REM-12 nhắc Owner. | GBR-95, GBR-26 |
| R-13-10 | Owner ghi chết trực tiếp (không qua ca sức khỏe): chọn loại Chết, làm như phiếu chết. | UC-01 AF6 |
| R-13-11 | Tiền: tiền dòng theo kg = đơn giá × cân xuất; theo con = đơn giá; khấu trừ ≤ tiền bò; đã thu ≤ tổng phải thu (MSG-FE06-13). | GBR-91, GBR-92 |
| R-13-12 | Hủy phiếu CONFIRMED: bắt buộc lý do; phiếu VOIDED (không bao giờ xóa, không hủy hai lần); mọi con ACTIVE lại với phân chuồng mới từ ngày hủy ở chuồng cuối; chuồng cuối ngưng / thiếu chỗ → Owner chọn chuồng ACTIVE còn chỗ cho từng con (MSG-FE13-09; không đạt tiêu chí cần lý do cảnh báo). Kiểm: không con nào đang trên dòng xuất mở khác. Các mục đã đóng / hủy do xuất (mũi, nhắc việc, ca, thai) **không tự khôi phục**, chỉ liệt kê để xem lại; khoản thu giữ trong lịch sử. | GBR-36, UC-03 |
| R-13-13 | Khoản thu: số nguyên > 0, ≤ còn phải thu, ngày không tương lai và không trước ngày phiếu; hủy khoản thu bắt buộc lý do; không sửa. | GBR-91, BR-D39 |
| R-13-14 | Bỏ nháp → xóa phiếu nháp, bò không có hiệu lực xuất nào. | Table 3.4-6 |

---

## 5. Luồng xử lý

### UC-FE13-01 Lập và xác nhận phiếu xuất (Bán / Loại thải / Khác)
1. SCR-42: mã kế tiếp, loại Bán, ngày hôm nay.
2. Chọn loại; nhập ngày xuất, người mua (hoặc nơi đến), giấy kiểm dịch vận chuyển, biển số, ghi chú.
3. **+ Chọn bò** (popup) hoặc **Quét QR**.
4. Mỗi con một dòng: cân xuất mặc định = cân mới nhất (UT), kết quả kiểm.
5. Cách tính giá, đơn giá, cân thực tế (nếu có) → tiền dòng, tổng.
6. Đính kèm; khấu trừ, đặt cọc, hình thức, hạn thu → tổng phải thu, còn phải thu.
7. Bảng kiểm trước khi xác nhận (R-13-06).
8. Tick xác nhận → **Xác nhận xuất n con** → R-13-04, R-13-07 → MSG-FE13-02 → SCR-76.

AF1 xác nhận phiếu chết PENDING (SCR-43) · AF2 bỏ phiếu chết → MSG-FE13-04 · AF3 **Lưu nháp** → MSG-FE13-06 · AF4 bỏ dòng · AF5 có cảnh báo → MSG-FE13-01 (không chặn) · AF6 ghi chết trực tiếp · AF7 bỏ nháp / hủy → MSG-COM-14.
E1 ngày → MSG-FE13-03 · E2 bò đã trên phiếu khác → MSG-FE13-08 · E3 không có dòng → MSG-FE06-16 · E4 đặt cọc > tổng → MSG-FE06-13 · E5 thiếu trường → MSG-COM-06 · E6 chưa tick → MSG-COM-16 · E7 bò không còn ACTIVE / phiếu đã đổi → MSG-COM-05 · E8 lỗi → MSG-COM-02.

### UC-FE13-03 Hủy phiếu
SCR-76 → **Hủy phiếu** → popup hiện hậu quả, chuồng cho từng con nếu cần → lý do → **Hủy phiếu** → R-13-12 → MSG-FE13-05 kèm danh sách mục đã đóng / hủy do xuất.

### UC-FE13-04 Thu tiền
SCR-76 → **Ghi thu tiền** (khi còn phải thu) → popup dùng chung → MSG-FE06-14. Hủy khoản thu → lý do → MSG-FE06-15.

---

## 6. Màn hình và trường

### SCR-41 Danh sách phiếu xuất

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | Create exit voucher / Tạo phiếu xuất | Nút (Owner) | Mở SCR-42 |
| 2 | Status tabs | Tab có số | Tất cả, Nháp, Chờ xác nhận, Đã xác nhận, Đã hủy / Đã bỏ |
| 3 | Period / Khoảng | Khoảng ngày xuất | Mặc định từ đầu quý trước đến hôm nay |
| 4 | Exit type / Loại xuất | Dropdown | Tất cả, Bán, Loại thải, Chết, Khác |
| 5 | Ô: Cattle exited / Bò đã xuất | Số | Số con trên phiếu CONFIRMED trong kỳ, theo loại |
| 6 | Ô: Sales revenue / Doanh thu bán | Tiền | Tổng phải thu của phiếu Bán, Loại thải CONFIRMED |
| 7 | Ô: To collect / Còn phải thu | Tiền | Tổng còn phải thu + số phiếu liên quan |
| 8 | Ô: Awaiting the Owner / Chờ Chủ trại | Số | Số phiếu PENDING từ ca sức khỏe |
| 9 | Voucher code / Mã phiếu | Cột | PX-YYYY-nnnn (sắp xếp được); link SCR-76 / SCR-42 (DRAFT) / SCR-43 (PENDING) |
| 10 | Exit date / Ngày xuất | Cột | Sắp xếp được |
| 11 | Exit type / Loại | Cột | — |
| 12 | Buyer / reason / Người mua / lý do | Cột | Người mua + giấy vận chuyển, hoặc ca nguồn + nguyên nhân; các chuồng liên quan |
| 13 | Cattle, Total weight / Số con, Tổng cân | Cột | kg ("~" khi ước tính) |
| 14 | Total amount, To collect (đ) | Cột | "—" với phiếu chết |
| 15 | Status / Trạng thái | Huy hiệu | DRAFT / PENDING / CONFIRMED / VOIDED / DISMISSED (kèm lý do) |
| 16 | Actions / Thao tác | Nút | Owner: "Tiếp tục" (DRAFT), "Xem & xác nhận" (PENDING), "Xem". Manager: "Xem" |
| 17 | Note / Ghi chú | Chữ | Phiếu từ ca sức khỏe giữ bò ACTIVE đến khi Owner xác nhận; hủy phiếu đã xác nhận đưa mọi con về ACTIVE |

### SCR-42 Phiếu xuất (Bán / Loại thải / Khác)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Exit type / Loại xuất | Tab | * | Bán / Loại thải / Chết – mất (SCR-43) / Khác; cố định sau lần lưu đầu | Bán | — |
| **1. Thông tin phiếu** | | | | | | |
| 2 | Voucher code / Mã phiếu | Chỉ đọc | — | PX-YYYY-nnnn kế tiếp | — | — |
| 3 | Exit date / Ngày xuất | Ngày | * | R-13-04 | Hôm nay | MSG-COM-06, MSG-FE13-03 |
| 4 | Buyer / trader / Người mua | Dropdown có tìm | * (Bán, Loại thải) | Đối tác ACTIVE + SĐT; "+ Thêm người mua" | — | MSG-COM-06 |
| 5 | Destination / Nơi đến | Ô chữ | * (Khác) | ≤ 150 | — | MSG-COM-06, MSG-COM-10 |
| 6 | Transport quarantine certificate / Giấy kiểm dịch vận chuyển | Ô chữ | — | ≤ 50 | — | MSG-COM-10 |
| 7 | Vehicle plate / Biển số | Ô chữ | — | ≤ 20 | — | MSG-COM-10 |
| 8 | Note / Ghi chú | Ô chữ dài | — | ≤ 1.000 | — | MSG-COM-10 |
| **2. Bò trong phiếu** | | | | | | |
| 9 | Scan QR / + Select cattle – Quét QR / + Chọn bò | Nút | — | Quét thêm bò ACTIVE; Chọn bò mở popup | — | MSG-FE13-08 |
| 10 | Pricing basis / Cách tính giá | Radio | * | Theo kg / Theo con | Theo kg | — |
| 11 | # / Cattle code · ear tag | Cột | — | Số dòng, mã, số tai | — | — |
| 12 | Breed · sex | Cột | — | Kèm tuổi, nhóm đàn | — | — |
| 13 | Pen / Chuồng | Cột | — | Chuồng hiện tại | — | — |
| 14 | Exit weight / Cân xuất | Số | * (theo kg) | Mặc định cân mới nhất (UT); nhập → Đo | Cân mới nhất | MSG-COM-10 |
| 15 | Unit price, Line amount / Đơn giá, Tiền dòng | Số / Tính | — | ≥ 0 | — | MSG-COM-10 |
| 16 | Check / Kiểm | Chữ | — | "OK" hoặc cảnh báo (ví dụ "Ngưng thịt → 25/10", ca đang mở) | — | — |
| 17 | ⋯ | Menu | — | Bỏ khỏi phiếu | — | — |
| 18 | Totals row / Dòng tổng | Tính | — | Số con, tổng cân, tiền bò | — | — |
| 19 | Withdrawal notice / Cảnh báo ngưng thịt | Chữ | — | MSG-FE13-07 cho từng con | — | — |
| **3. Đính kèm** | | | | | | |
| 20 | Files / Tệp | Tải lên | — | Hợp đồng, phiếu cân, giấy; PDF / JPG ≤ 10 MB | — | MSG-COM-10 |
| **4. Thanh toán** | | | | | | |
| 21 | Cattle amount / Tiền bò | Chỉ đọc | — | Σ tiền dòng | — | — |
| 22 | Deductions / Khấu trừ | Số | — | ≥ 0, ≤ tiền bò | 0 | MSG-COM-10 |
| 23 | Total receivable / Tổng phải thu | Chỉ đọc | — | Tiền bò − khấu trừ | — | — |
| 24 | Collected (deposit) / Đã thu (đặt cọc) | Số | — | ≥ 0, ≤ tổng phải thu | 0 | MSG-FE06-13 |
| 25 | To collect / Còn phải thu | Chỉ đọc | — | — | — | — |
| 26 | Method, Collection due date / Hình thức, Hạn thu | Radio + ngày | * hình thức khi đã thu > 0 | Tiền mặt / Chuyển khoản | — | MSG-COM-06 |
| **Bảng bên** | | | | | | |
| 27 | Summary panel / Tóm tắt | Chỉ đọc | — | Số con, tổng cân xuất (số con ước tính), chuồng trước → sau, trạng thái | — | — |
| 28 | Checks before confirmation / Kiểm tra trước khi xác nhận | Bảng | — | Mục / kết quả: ngưng thịt (bò, ngày hết), ca OPEN / CHRONIC, mũi và nhắc việc tương lai (số, sẽ hủy), thai đang có, bê nháp của bò mẹ | — | MSG-FE13-01 |
| 29 | I have reviewed … and confirm the exit / Tôi đã xem các mục trên và xác nhận xuất | Checkbox | * | — | Không tick | MSG-COM-16 |
| 30 | Confirm exit of n cattle / Xác nhận xuất n con | Nút | — | Hiện tóm tắt hậu quả GBR-35 bên dưới | — | MSG-FE06-16, MSG-COM-05, MSG-COM-02; thành công MSG-FE13-02 → SCR-76 |
| 31 | Save draft / Cancel | Nút | — | Bỏ nháp được | — | MSG-FE13-06 / MSG-COM-14 |

### SCR-43 Phiếu chết / mất tích

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Voucher code, Status | Chỉ đọc | — | PENDING khi đề xuất từ ca | — |
| 2 | Date of death / loss / Ngày chết / mất | Ngày | * | Mặc định ngày đóng ca; giới hạn như ngày xuất | MSG-FE13-03 |
| 3 | Loss kind / Loại | Radio | — | Chết / Mất tích (từ kết quả ca; sửa được khi ghi trực tiếp) | — |
| 4 | Proposed from / Đề xuất từ | Chỉ đọc | — | Mã ca + kết quả (link), hoặc "Chủ trại ghi trực tiếp" | — |
| 5 | Reported by / Người báo | Chỉ đọc | — | Tên + thời điểm | — |
| 6 | Cause / notes / Nguyên nhân | Ô chữ dài | * | ≤ 1.000 | MSG-COM-06 |
| 7 | Carcass disposal / Xử lý xác | Radio + chữ | * (Chết) | Tiêu hủy / chôn tại trại; Giao thú y địa phương; Khác (chữ); ẩn khi Mất tích | MSG-COM-06 |
| 8 | Cattle in the voucher / Bò | Chỉ đọc | — | Mã, số tai, giống, giới tính, tuổi, chuồng, cân gần nhất, ca + kết quả | — |
| 9 | Attachments / Đính kèm | File | — | Ảnh, biên bản tiêu hủy, xác nhận thú y; PDF / JPG ≤ 10 MB | — |
| 10 | Summary panel / Tóm tắt | Chỉ đọc | — | Số con, chuồng trước → sau; "Phiếu chết không có giá và thanh toán" | — |
| 11 | Checks before confirmation | Bảng | — | Ca nguồn (đã đóng, kết quả), ca OPEN / CHRONIC khác, mũi tương lai (sẽ hủy), thai đang có, bê nháp của bò mẹ | — |
| 12 | Confirmation checkbox | Checkbox | * | — | MSG-COM-16 |
| 13 | Confirm exit / Dismiss proposal / Close – Xác nhận xuất / Bỏ đề xuất / Đóng | Nút | — | Bỏ đề xuất cần lý do (≤ 500, Q1) | MSG-COM-06; thành công MSG-FE13-02 → SCR-76 / MSG-FE13-04 → SCR-41 |

### Popup Chọn bò cho phiếu xuất

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | Search / Tìm | Ô chữ | Mã hoặc số tai |
| 2 | Pen, Herd group, Minimum latest weight / Chuồng, Nhóm đàn, Cân tối thiểu | Lọc | — |
| 3 | Selection / Chọn | Checkbox | Chỉ bò ACTIVE không trên phiếu mở khác |
| 4 | Cattle code · ear tag, Herd group · life stage, Pen, Age | Cột | — |
| 5 | Latest weight / Cân gần nhất | Cột | kg, ngày, cơ sở |
| 6 | Warning / Cảnh báo | Cột | Ngưng thịt (ngày hết), mã ca OPEN, hoặc "—"; không chặn |
| 7 | Selected / Đã chọn | Chữ | "n con · ~kg theo cân gần nhất" |
| 8 | Cancel / Add n cattle to the voucher | Nút | — |

### Popup Hủy phiếu xuất

| # | Trường | Loại | Bắt buộc | Nội dung / Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Voucher / Phiếu | Chỉ đọc | — | Mã, loại, ngày xuất, số con, người mua | — |
| 2 | On confirmation / Khi xác nhận | Chữ | — | Mọi con về ACTIVE, mở lại chuồng cuối (chuồng, lấp đầy trước → sau); phiếu giữ trong lịch sử là VOIDED; mũi và nhắc việc đã hủy không khôi phục; khoản thu giữ trong lịch sử | — |
| 3 | Pen for each cattle / Chuồng cho từng con | Dropdown | * khi chuồng cuối ngưng / thiếu chỗ | Chuồng ACTIVE còn chỗ; lý do cảnh báo khi không đạt tiêu chí | MSG-FE13-09, MSG-FE04-06 |
| 4 | Void reason / Lý do hủy | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 5 | Close / Void voucher | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE13-05 |

### SCR-76 Chi tiết phiếu xuất

| # | Trường | Nội dung |
|---|---|---|
| 1 | Header / Tiêu đề | Mã, trạng thái; "In phiếu", "Hủy phiếu" (Owner, chỉ CONFIRMED) |
| 2 | Voucher information / Thông tin phiếu | Ngày xuất, loại, giấy vận chuyển, người mua + liên hệ (hoặc nơi đến, nguyên nhân, xử lý xác), biển số, người tạo / xác nhận + thời điểm, ghi chú |
| 3 | Cattle in the voucher / Bò | Mã (link SCR-19), số tai, giống, giới tính, cân xuất + cơ sở, chuồng cuối, trạng thái đàn, tiền dòng; dòng tổng |
| 4 | Read-only notice / Lưu ý | Bò đã xuất chỉ đọc, giữ đủ lịch sử; hủy phiếu đưa mọi con về ACTIVE |
| 5 | Attachments / Đính kèm | Danh sách + "Xem" |
| 6 | Payment / Thanh toán | Tiền bò, khấu trừ, tổng phải thu, đã thu, còn phải thu; danh sách khoản thu (ngày, hình thức, số tiền, tham chiếu, người ghi); "Ghi thu tiền" (Owner) khi còn phải thu |
| 7 | Voucher history / Lịch sử phiếu | Tạo, xác nhận, mũi và nhắc việc bị hệ thống hủy, khoản thu ghi / hủy, hủy hoặc bỏ kèm lý do |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách phiếu | `status?, type?, from?, to?, page, size` | `{tiles {exitedByType, salesRevenue, toCollect, toCollectVouchers, pending}, counts{…}, items[…cột SCR-41], total}` | COM-03 | `GET /api/farms/{farmId}/exit-vouchers` |
| A2 | Bò chọn được | `q?, penId?, herdGroup?, minWeightKg?` | `[{cattleId, code, earTag, herdGroup, lifeStage, pen, age, latestWeight {kg, date, basis}, warnings[]}]` | — | `GET …/exit-vouchers/selectable-cattle` |
| A3 | Tạo / lưu nháp | Phần đầu + `lines[{cattleId, exitWeightKg?, weightBasis, unitPrice?}]` + thanh toán + `Idempotency-Key` | Phiếu + `version` | FE13-03, FE13-08, COM-06, COM-10, FE06-13 | `POST /api/farms/{farmId}/exit-vouchers` |
| A4 | Sửa nháp / phiếu PENDING (nguyên nhân, xử lý xác) | Như A3 + `version` | Phiếu | + COM-05 | `PUT …/exit-vouchers/{id}` |
| A5 | Thêm bò (quét QR) | `cattleIds[] \| code` + `Idempotency-Key` | Phiếu | FE13-08, FE05-09 | `POST …/exit-vouchers/{id}/lines` |
| A6 | Bỏ nháp | `expectedVersion` + `Idempotency-Key` | — | COM-05 | `DELETE …/exit-vouchers/{id}` |
| A7 | Kiểm tra trước khi xác nhận | — | `{rows[{cattleId, withdrawalUntil?, openCases[], futureDoses, futureReminders, openPregnancy, draftCalves}], penOccupancy[]}` | — | `GET …/exit-vouchers/{id}/checks` |
| A8 | Xác nhận | `reviewedChecks: true, version` + `Idempotency-Key` | `{voucherCode, exited, cancelledItems {doses, reminders, cases, pregnancies}}` | COM-16, FE06-16, FE13-03, COM-05, COM-02 | `POST …/exit-vouchers/{id}/confirm` |
| A9 | Bỏ phiếu chết PENDING | `reason, version` + `Idempotency-Key` | Phiếu DISMISSED | COM-06, COM-05 | `POST …/exit-vouchers/{id}/dismiss` |
| A10 | Kiểm / hủy phiếu | — / `reason, pens[{cattleId, penId, warningReason?}], version` + `Idempotency-Key` | `{rows[{cattleId, lastPen, available, needsPen}]}` / `{voided, reopened[], itemsToReview[]}` | FE13-09, FE04-06, COM-06, COM-05 | `GET …/exit-vouchers/{id}/void-check` · `POST …/void` |
| A11 | Chi tiết | — | Mọi trường SCR-76 | COM-08 | `GET …/exit-vouchers/{id}` |
| A12 | Thu tiền | Như FE-06 A16 với `type = EXIT` | — | FE06-13, COM-07 | `GET` / `POST /api/farms/{farmId}/vouchers/EXIT/{voucherId}/payments` · `POST /payments/{paymentId}/void` |
| A13 | Đính kèm | File | `AttachmentDTO` | COM-10 | `…/exit-vouchers/{voucherId}/attachments` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE13-01 | Trong bảng kiểm | {cattle_code}: {warnings}. Hãy xem lại trước khi xác nhận xuất. |
| MSG-FE13-02 | Toast thành công | Đã xác nhận phiếu {voucher_code}: {count} con đã rời đàn. |
| MSG-FE13-03 | Dưới trường | Ngày xuất phải từ {earliest_date} đến hôm nay. |
| MSG-FE13-04 | Toast thành công | Đã bỏ phiếu {voucher_code}. {cattle_code} vẫn ở trong đàn. |
| MSG-FE13-05 | Toast thành công | Đã hủy phiếu {voucher_code}. {count} con đã trở lại đàn. Các mục bị hủy do xuất được liệt kê để xem lại. |
| MSG-FE13-06 | Toast thành công | Đã lưu nháp phiếu {voucher_code}. Bò vẫn ở trong đàn cho đến khi bạn xác nhận. |
| MSG-FE13-07 | Cảnh báo dòng | {cattle_code} đang trong thời gian ngưng thịt đến {date}. Bán giết mổ trước ngày này vi phạm an toàn thực phẩm – hãy đổi ngày xuất hoặc bỏ con này. |
| MSG-FE13-08 | Trong hộp thoại | {cattle_code} đã có trên phiếu {voucher_code}. |
| MSG-FE13-09 | Trong hộp thoại | Chuồng {pen} không khả dụng hoặc không đủ chỗ. Hãy chọn chuồng cho từng con trước khi hủy. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-13-01 | Manager | Gọi tạo / xác nhận / hủy phiếu / thu tiền | 403 | H | R-13-01 |
| TC-13-02 | Bò A trên phiếu DRAFT X | Thêm A vào phiếu Y | MSG-FE13-08 | I | R-13-02 |
| TC-13-03 | Phiếu DRAFT có bò A | — | A vẫn ACTIVE, ở chuồng cũ | I | R-13-03 |
| TC-13-04 | Bò A có lần cân ngày 05/11 | Ngày xuất 04/11 / ngày mai | MSG-FE13-03 | I | R-13-04 |
| TC-13-05 | Loại Bán, không người mua; loại Khác, không nơi đến | Lưu | MSG-COM-06 | U, H | R-13-05 |
| TC-13-06 | Bò ngưng thịt đến 25/11, ngày xuất 20/11, loại Bán | Xem kiểm | Dòng có MSG-FE13-07 tô nổi; vẫn xác nhận được sau khi tick | I, E | R-13-06 |
| TC-13-07 | Không tick xác nhận | Xác nhận | MSG-COM-16 | U, H | R-13-06 |
| TC-13-08 | Phiếu 3 con: có ca OPEN, mũi tương lai, thai đang có | Xác nhận | 3 con EXITED; phân chuồng đóng ngày xuất; mũi và nhắc việc sau ngày xuất CANCELLED; ca CLOSED_BY_EXIT; thai DAM_EXITED; 1 audit | I | R-13-07 |
| TC-13-09 | 1 trong 3 con vừa bị phiếu khác xác nhận xuất | Xác nhận | MSG-COM-05; không con nào EXITED | I | R-13-07 |
| TC-13-10 | Bò mẹ có bê nháp | Xác nhận xuất bò mẹ | Bê nháp vẫn PENDING_CONFIRMATION | I | R-13-07 |
| TC-13-11 | Bò EXITED | Gọi ghi cân / chuyển chuồng | MSG-COM-13 | H | R-13-08 |
| TC-13-12 | Ca đóng Chết → phiếu PENDING | Owner nhập nguyên nhân, xử lý xác, xác nhận | CONFIRMED; bò EXITED; REM-12 giải quyết | I | R-13-09 |
| TC-13-13 | Phiếu PENDING | Bỏ không lý do / có lý do | MSG-COM-06 / DISMISSED; bò ACTIVE; ca giữ kết quả Chết | I | R-13-09 |
| TC-13-14 | Phiếu chết, loại Mất tích | Xem SCR-43 | Không có trường Xử lý xác | E | SCR-43 |
| TC-13-15 | Theo kg: 450 kg × 70.000; khấu trừ 500.000; đặt cọc 10.000.000 | Tính | Tiền bò 31.500.000; phải thu 31.000.000; còn 21.000.000 | U | R-13-11 |
| TC-13-16 | Khấu trừ > tiền bò; đặt cọc > tổng | Lưu | Lỗi; MSG-FE06-13 | U, H | R-13-11 |
| TC-13-17 | Phiếu CONFIRMED 2 con, chuồng cuối còn chỗ | Hủy có lý do | VOIDED; 2 con ACTIVE, phân chuồng mới từ ngày hủy; mũi đã hủy **không** khôi phục; MSG-FE13-05 có danh sách mục cần xem lại | I | R-13-12 |
| TC-13-18 | Chuồng cuối đã ngưng | Hủy không chọn chuồng | MSG-FE13-09 | I | R-13-12 |
| TC-13-19 | Phiếu đã VOIDED | Hủy lần nữa | MSG-COM-05 | I | R-13-12 |
| TC-13-20 | Phiếu có 2 khoản thu | Hủy phiếu | Khoản thu vẫn RECORDED | I | R-13-12 |
| TC-13-21 | Còn phải thu 5.000.000 | Thu 6.000.000 | MSG-FE06-13 | I | R-13-13 |
| TC-13-22 | Phiếu DEATH | Xem SCR-76 | Không có phần thanh toán | E | §3.1 |
| TC-13-23 | Quét QR bò EXITED / bò trại khác | Thêm vào phiếu | Bị từ chối | I | R-13-02 |
| TC-13-24 | Owner ghi chết trực tiếp (loại Chết) | Xác nhận | Như phiếu PENDING; "Chủ trại ghi trực tiếp" | I | R-13-10 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Độ dài lý do bỏ đề xuất phiếu chết | ≤ 500 |
| Q2 | UC-FE13-02, 04 không có đặc tả Part II | Theo SCR-41, SCR-76 và popup dùng chung |
| Q3 | Phiếu PENDING có được thêm bò khác không? | Không – mỗi phiếu chết gắn đúng 1 con (GBR-95) |
| Q4 | REM-13 nhắc "đạt cân xuất chuồng": có nút tạo phiếu xuất từ nhắc việc không? | Có, mở SCR-42 với bò đó (SRS: "Owner may start an exit voucher") |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho AnNT duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
