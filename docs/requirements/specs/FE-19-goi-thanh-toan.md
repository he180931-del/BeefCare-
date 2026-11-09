# SPEC FE-19 – Gói dịch vụ và thanh toán

| | |
|---|---|
| Feature | FE-19 Subscription and Payment Management |
| Use case | UC-FE19-01 → UC-FE19-08 |
| Người phụ trách | DucNV (BE + FE + test, gồm JOB-03 → 06, API-01 → 03) · Review BE: TaiDX · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Plan Price Version, Subscription, Payment Request + Purchased Period, Bank Transfer Evidence + Evidence Review, Subscription Receipt), BR-D23 → 25, 28, Part II §15 (UC-FE19-02, 06, 07, 08), Part III §19 (SCR-57 → SCR-63), MSG-FE19-01 → 16, GBR-07, 13, 15, 66, 69 → 75, 84; API-01 → 03; JOB-03 → 07 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Nguồn nghiệp vụ là SRS 28/10/2026; các điểm làm rõ đã được chủ feature chốt được ghi tại `docs/REQUIREMENT_DECISIONS.md` và `OPEN_QUESTIONS.md`. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. DucNV xác nhận triển khai luồng UC-FE19-01 tại mục 5, gồm backend và nối SCR-57, ngày 09/11/2026; cách tính số ngày còn lại theo D14.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE19-01 | Xem gói và trạng thái dịch vụ của trại | Owner | SCR-57 |
| UC-FE19-02 | Tạo / mở lại yêu cầu thanh toán 24 giờ với VietQR | Owner | SCR-58, SCR-59 |
| UC-FE19-03 | Xem lịch sử và chi tiết thanh toán | Owner | SCR-60, SCR-59 |
| UC-FE19-04 | Xem gói của các trại | PM | SCR-61 |
| UC-FE19-05 | Xem yêu cầu thanh toán và chứng từ ngân hàng | PM | SCR-62 |
| UC-FE19-06 | Đối soát: chấp nhận / giữ / từ chối chứng từ; khóa hoàn trả | PM | SCR-62 |
| UC-FE19-07 | Công bố bảng giá mới (ngay hoặc lên lịch); rút phiên bản đã lên lịch | PM | SCR-63 |
| UC-FE19-08 | Xác nhận thanh toán tự động từ webhook SePay | SePay (hệ thống) | — (API-02, JOB-06) |

**Liên quan:** tạm ngưng / khôi phục trại (FE-02, UC-FE02-05); biên lai và thu chi (FE-21); bảng giá trang công khai (FE-22); thông báo gói (FE-14, JOB-05).

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager / Technician | PM | Khác |
|---|---|---|---|---|
| SCR-57, 58, 59, 60 (trại mình sở hữu) | **Chỉ Owner** (GBR-07) | — | — | — |
| SCR-61, 62, 63 | — | — | Có (PM ACTIVE) | — |
| Webhook SePay | — | — | — | SePay, xác thực HMAC |

PM chỉ thấy dữ liệu gói / thanh toán, **không** thấy dữ liệu vận hành trại.

---

## 3. Dữ liệu

### 3.1 Phiên bản bảng giá (Plan Price Version)

| Thuộc tính | Ràng buộc |
|---|---|
| Số phiên bản | Duy nhất; đúng 1 phiên bản hiệu lực tại mỗi thời điểm |
| Giá 1 / 2 / 3 năm (VND) | Số nguyên 1.000 – 1.000.000.000; đủ cả 3 (BR-D25). Giá ban đầu 1.200.000 / 2.160.000 / 3.060.000 (GBR-69) |
| Mô tả điều khoản | ≤ 500 |
| Hiệu lực từ | Ngay hoặc tương lai (Asia/Ho_Chi_Minh) |
| Người công bố, thời điểm | Hệ thống |
| Trạng thái | `SCHEDULED` → `EFFECTIVE` → `SUPERSEDED`; `SCHEDULED` → `WITHDRAWN` (có lý do). Không sửa sau công bố |

### 3.2 Subscription (mỗi trại tối đa 1)

Trại, kỳ hiện tại (suy ra), kỳ tương lai (suy ra), ngày kết thúc đã xác nhận mới nhất, ngày mở gia hạn (= kết thúc − 90 ngày), mốc kỷ niệm. Tạo cùng yêu cầu thanh toán đầu tiên.

### 3.3 Yêu cầu thanh toán (Payment Request)

| Thuộc tính | Ràng buộc |
|---|---|
| Mã thanh toán | Duy nhất, ví dụ `BCF7K2Q9`; là nội dung chuyển khoản |
| Trại, subscription, người yêu cầu | — |
| Phiên bản giá, kỳ hạn (1/2/3 năm), số tiền | **Bất biến** |
| Ngân hàng nhận, số TK, tên TK | Snapshot khi tạo |
| Tạo lúc, hết hạn | Hết hạn = tạo + 24 giờ |
| Trạng thái | `PENDING` → `PAID` / `EXPIRED`; `EXPIRED` → `PAID` chỉ khi tiền vào trong cửa sổ gốc |
| Giờ ngân hàng ghi nhận, giờ nhận, giờ xác nhận, nguồn xác nhận (SEPAY / PM) | — |
| Kỳ đã mua (detail) | Bắt đầu, kết thúc, kỳ hạn; 1 kỳ / yêu cầu PAID; bất biến |

Mỗi trại tối đa 1 yêu cầu PENDING chưa hết hạn (BR-D23).

### 3.4 Chứng từ ngân hàng (Bank Transfer Evidence)

| Thuộc tính | Ràng buộc |
|---|---|
| Nhà cung cấp, môi trường, namespace tài khoản, mã giao dịch | Bộ 4 duy nhất (BR-D24) |
| Ngân hàng, TK nhận, chiều (vào / ra), số tiền, nội dung, mã thanh toán trích được, mã tham chiếu NH, giờ NH ghi nhận, lần nhận đầu, số lần giao | — |
| Trạng thái khớp | `RECEIVED` → `MATCHED` (đã phân bổ, cuối) hoặc `UNMATCHED` / `NEEDS_REVIEW` → `ACCEPTED` / `HELD` / `REJECTED` / `LOCKED_FOR_RETURN` |
| Thanh toán được phân bổ | 1 chứng từ ↔ tối đa 1 yêu cầu |
| Lịch sử đối soát (detail) | Quyết định ACCEPT / HOLD / REJECT / LOCK / UNLOCK / RETURN_VERIFIED, lý do (≤ 1.000), tham chiếu, PM, thời điểm; bất biến |

### 3.5 Biên lai (Subscription Receipt) – suy ra, chỉ đọc
Mã RC-yy-nnnn, mã thanh toán, trại, kỳ hạn, phiên bản giá, số tiền, giờ NH, giờ xác nhận, kỳ đã mua, chứng từ. 1 biên lai / yêu cầu PAID (hiển thị ở FE-21).

### 3.6 Trạng thái dịch vụ trại (suy ra, GBR-13)
`PENDING_PAYMENT` (từ đăng ký đến thanh toán đầu tiên) · `ACTIVE` (có kỳ bao phủ hiện tại) · `EXPIRED` (hết bao phủ) · `SUSPENDED` (PM tạm ngưng, bất kể thanh toán).

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-19-01 | Chỉ Owner quản lý gói và thanh toán của trại mình. | GBR-07 |
| R-19-02 | Một gói duy nhất, 1 / 2 / 3 năm; chuyển khoản do Owner khởi tạo; không tự trừ, không tự gia hạn, không giá theo tháng / theo con. | GBR-69 |
| R-19-03 | Yêu cầu bất biến, hiệu lực 24 giờ; mỗi trại tối đa 1 PENDING chưa hết hạn – bấm thanh toán lại thì **mở lại** yêu cầu đó (MSG-FE19-01). | GBR-70, BR-D23 |
| R-19-04 | Giá hiệu lực đổi kể từ lúc Owner xem → phải xem lại (MSG-FE19-02) trước khi tạo. | GBR-70 |
| R-19-05 | Mua lần đầu: bất kỳ lúc nào. Gia hạn: chỉ trong 90 ngày cuối của bao phủ đã xác nhận, hoặc sau khi hết bao phủ (MSG-FE19-03). Trại SUSPENDED: không tạo yêu cầu (MSG-FE19-09 + gửi ticket). | GBR-71 |
| R-19-06 | PAID **chỉ** qua thao tác xác nhận dùng chung (webhook SePay và PM chấp nhận): chứng từ đã xác thực, chiều vào, đúng số tiền, đúng TK nhận, giờ NH trong [tạo, hết hạn), chưa phân bổ, xác định đúng 1 yêu cầu (tự động: mã chính xác trong nội dung; PM: chọn rõ 1 ứng viên + lý do khi gõ sai mã). Không gộp / tách tiền, không suy kỳ hạn từ số tiền. Xác nhận theo từng trại tuần tự; xác nhận lặp trả kết quả cũ. | GBR-72 |
| R-19-07 | Kỳ đã mua bắt đầu = max(giờ xác nhận, kết thúc đã xác nhận mới nhất), dài 1 / 2 / 3 năm lịch (Asia/Ho_Chi_Minh), nửa mở [start, end), bất biến. Gia hạn liên tục giữ ngày kỷ niệm (29/02 → 28/02 năm không nhuận); có khoảng trống → đặt lại mốc. Trước khi xác nhận mọi ngày là ước tính. | GBR-73, BR-D25 |
| R-19-08 | Mọi giao dịch đã xác thực đều lưu thành chứng từ, khử trùng theo bộ 4. Chứng từ chưa chấp nhận không cấp dịch vụ, không tạo biên lai. BeefCare không hoàn tiền; tiền cần trả lại ngoài hệ thống → khóa để không bao giờ cấp vốn cho yêu cầu. | GBR-74 |
| R-19-09 | Quyết định PM: ACCEPT (chạy lại R-19-06), HOLD (còn mở), REJECT – đều cần lý do. | GBR-74, UC-06 |
| R-19-10 | Một giao dịch không được vừa là biên lai gói vừa là thu thủ công POSTED; chấp nhận kiểm thu thủ công trên cùng giao dịch. | GBR-84, BR-D28 |
| R-19-11 | Thanh toán không bao giờ gỡ tạm ngưng; khôi phục không tạo / kéo dài kỳ. Trại SUSPENDED nhận tiền → PAID + tạo kỳ, vẫn SUSPENDED. | GBR-15, UC-08 AF4 |
| R-19-12 | Bảng giá công bố là phiên bản đầy đủ (3 kỳ hạn), hiệu lực ngay hoặc tương lai, bất biến; không trùng thời điểm với phiên bản đã lên lịch khác; yêu cầu đã phát hành và kỳ đã mua không đổi. | GBR-75, BR-D25 |
| R-19-13 | Webhook: xác minh HMAC trên `timestamp + "." + raw body`, sai lệch ≤ 300 giây; sai → 401, không lưu chứng từ. Lưu chứng từ + job rồi mới trả `200 {"success": true}`. | UC-08 |
| R-19-14 | JOB-03 (5 phút): PENDING quá hạn → EXPIRED. JOB-04 (15 phút): tính lại trạng thái dịch vụ. JOB-05 (07:00 hằng ngày): thông báo mở gia hạn, sắp hết hạn, đã hết hạn. JOB-06: xử lý chứng từ, retry. JOB-07: thông báo + email cho Owner. | JOB-03 → 07 |
| R-19-15 | Mọi chấp nhận thanh toán, quyết định chứng từ, công bố giá ghi audit cùng transaction. | GBR-86 |
| R-19-16 | Số ngày còn lại tính theo kỳ đang bao phủ thời điểm hiện tại: `floor((end - now) / 24 giờ)`, tối thiểu 0. Còn 23 giờ hiển thị 0 ngày; dịch vụ vẫn ACTIVE tới đúng `end` nếu không bị tạm ngưng. Không có kỳ hiện tại thì giá trị không có (`null`), hiển thị "—"; SUSPENDED vẫn đếm theo kỳ hiện tại. | SCR-57; D14 (DucNV, 09/11/2026); FE-02 Q4 |

---

## 5. Luồng xử lý

### UC-FE19-01 Xem gói và trạng thái dịch vụ của trại

**Trạng thái luồng:** DucNV xác nhận triển khai ngày 09/11/2026 (Q3, riêng UC-01), gồm backend và nối SCR-57; bổ sung từ SRS Part I §4.2.19, Part III §19.1.1 SCR-57, GBR-07, 09, 12 → 15, 69 → 71, 73, 75. R-19-16 theo D14. Bằng chứng chạy test và ma trận đủ 14 mục được ghi riêng tại `docs/reviews/FE19_UC01_REVIEW.md`; danh sách TC ở đây là tiêu chí nghiệp vụ.

**Tác nhân / kích hoạt:** Owner mở Gói dịch vụ của một trại mình sở hữu, hoặc chuyển sang trại khác mình sở hữu trên SCR-57.

**Tiền điều kiện:** tài khoản ACTIVE, đã đăng nhập; Owner còn quyền sở hữu trại tại thời điểm request. Không yêu cầu trại ACTIVE hoặc đã có Subscription.

**Luồng chính:**

1. Owner chọn trại và mở SCR-57.
2. Hệ thống kiểm lại tài khoản, quyền Owner và đúng trại; lấy tổng quan qua A1.
3. Hệ thống xác định trạng thái dịch vụ tại thời điểm đọc; lấy các kỳ đã mua từ thanh toán PAID, kỳ hiện tại, kỳ tương lai, ngày kết thúc đã xác nhận mới nhất, ngày mở gia hạn và thông tin tạm ngưng.
4. Hệ thống lấy yêu cầu PENDING chưa hết hạn và bảng giá đang hiệu lực; hiển thị đủ 14 mục SCR-57. Ngày mở gia hạn vẫn hiển thị khi cửa sổ đã mở.
5. Owner có thể mở Lịch sử thanh toán → SCR-60 (UC-03); mở hướng dẫn của yêu cầu đang chờ → SCR-59 (UC-02); hoặc chọn Thanh toán để kích hoạt / Gia hạn → SCR-58 (UC-02), theo điều kiện thanh toán.
6. Khi chuyển trại, hệ thống kiểm lại quyền và tải dữ liệu của trại mới; dữ liệu hiển thị thuộc đúng trại đã chọn.

**Nhánh / lỗi:**

- AF1 chưa có Subscription hoặc chưa có kỳ PAID: vẫn xem được SCR-57; kỳ hiện tại, ngày kết thúc và ngày mở gia hạn là "—", các danh sách kỳ rỗng. Việc xem không tự tạo Subscription.
- AF2 đang ngoài cửa sổ gia hạn: vẫn xem được tổng quan; tắt nút Gia hạn và hiển thị MSG-FE19-03. Khi đã tới cửa sổ hoặc đã hết bao phủ, cho đi tiếp theo GBR-71.
- AF3 SUSPENDED: vẫn hiển thị các kỳ, ngày còn lại và thông tin tạm ngưng; tắt nút tạo yêu cầu, hiển thị MSG-FE19-09 và đường dẫn hỗ trợ. Lịch sử và hướng dẫn yêu cầu đang chờ vẫn có thể mở; việc mở không cấp kỳ hoặc gỡ tạm ngưng.
- AF4 không có yêu cầu PENDING còn hiệu lực: trường Yêu cầu đang chờ là "—". Yêu cầu đã tới thời điểm hết hạn không được hiển thị như yêu cầu còn hiệu lực, kể cả JOB-03 chưa chạy.
- E1 không có quyền Owner của trại: từ chối MSG-COM-01; không trả dữ liệu gói của trại.
- E2 không lấy được bảng giá: vùng giá hiển thị MSG-FE19-04 + Thử lại; phần tổng quan đã lấy được vẫn hiển thị, không dùng giá mặc định để thay giá thiếu.
- E3 không tải được tổng quan: MSG-COM-02 + Thử lại; không thay bằng dữ liệu demo.

**Hậu điều kiện:** chỉ đọc tổng quan; không tạo / thay đổi Subscription, yêu cầu thanh toán, kỳ đã mua, chứng từ hoặc biên lai, không cấp thêm dịch vụ hay thay đổi tạm ngưng. Trạng thái hiển thị được suy ra theo GBR-13.

**Quy ước dữ liệu để nghiệm thu:**

| Dữ liệu | Quy tắc | Nguồn |
|---|---|---|
| Kỳ hiện tại | Kỳ PAID có `start <= now < end`; không có thì `null` / "—". | GBR-13, 73; SCR-57 |
| Kỳ tương lai / đã qua | Tương lai khi `start > now`; đã qua khi `end <= now`. Mỗi kỳ xuất hiện một lần trong bảng Các kỳ đã mua. | GBR-73; SCR-57 |
| Ngày kết thúc đã xác nhận | `max(end)` trên các kỳ PAID, gồm cả kỳ tương lai; chưa có kỳ thì `null` / "—". | SCR-57 |
| Mở gia hạn từ | Ngày kết thúc đã xác nhận trừ 90 ngày lịch theo Asia/Ho_Chi_Minh; có ngày kết thúc thì luôn có mốc này, kể cả khi đã qua mốc. | GBR-71; SCR-57 |
| Số ngày còn lại | R-19-16; không lấy ngày kết thúc kỳ tương lai để đếm cho kỳ hiện tại. | D14; SCR-57 |
| Yêu cầu đang chờ | Chỉ PENDING có `now < expiresAt`; mở hướng dẫn dùng lại yêu cầu đó. | GBR-70; SCR-57 |
| Bảng giá | Đúng phiên bản đang hiệu lực tại thời điểm đọc; phiên bản tương lai chưa được dùng. | GBR-75; SCR-57 |

### UC-FE19-02 Tạo yêu cầu thanh toán

Người dùng xác nhận 09/11/2026 (D15): triển khai backend + SCR-58/SCR-59, gồm API đọc lại chi tiết. SCR-59 tự tải trạng thái mỗi 5 giây khi PENDING, không gọi chồng; dừng khi PAID/EXPIRED/rời màn, vẫn giữ Kiểm tra lại và kiểm tra một lần ở mốc hết hạn. Bước nhận giao dịch hoàn thành khi chứng từ đã xác thực, chiều vào, đúng môi trường/namespace/TK/mã; sai số tiền vẫn là đã nhận, chưa PAID/cấp kỳ. Mã sai không tự gắn. Giờ ngân hàng, giờ nhận đầu tiên và giờ xác nhận là ba mốc riêng từ dữ liệu backend; dữ liệu lịch sử thiếu mốc thì hiện "—".

Mở lại PENDING dùng snapshot cũ, không phụ thuộc giá/TK cấu hình mới hoặc điều kiện tạo mới (kể cả tạm ngưng); vẫn kiểm Owner hiện tại. Ngay `now >= expiresAt`, SCR-59 ẩn QR và hiển thị hết hạn dù JOB-03 chưa chạy; không cản nhánh EXPIRED→PAID của giao dịch có giờ NH trong cửa sổ gốc. Kỳ trước xác nhận luôn là ước tính; UC2 không có nút tự đánh dấu đã trả.
1. SCR-58: 3 kỳ hạn + giá từ phiên bản hiệu lực, điều khoản, trạng thái trại.
2. Owner chọn kỳ hạn → xem lại: trại, kỳ hạn, số tiền, kỳ dịch vụ ước tính, phiên bản giá.
3. **Tạo yêu cầu thanh toán**.
4. Kiểm sở hữu, trạng thái, cửa sổ gia hạn, không có PENDING chưa hết hạn, phiên bản giá còn hiệu lực.
5. Tạo yêu cầu (mã duy nhất, hết hạn +24 h, snapshot TK nhận); tạo Subscription nếu chưa có.
6. SCR-59: VietQR (API-01), PENDING, đếm ngược, thông tin chuyển khoản + nút sao chép, tiến trình, MSG-FE19-05.

AF1 có PENDING → MSG-FE19-01 · AF2 giá đổi → MSG-FE19-02, quay lại bước 2 · AF3 Để sau / Đóng → vẫn PENDING · AF4 Kiểm tra lại → PAID: MSG-FE19-06 · AF5 hết hạn → MSG-FE19-07.
E1 không phải Owner → MSG-COM-01 · E2 ngoài cửa sổ → MSG-FE19-03 · E3 SUSPENDED → MSG-FE19-09 · E4 không có giá / TK → MSG-FE19-04 · E5 không tạo được ảnh QR → vẫn hiện thông tin dạng chữ · E6 lỗi → MSG-COM-02.

### UC-FE19-03 Xem lịch sử và chi tiết thanh toán

Người dùng xác nhận 09/11/2026 (D16): backend + SCR-60, dùng lại SCR-59 theo D15. Căn cứ SRS I.4.2.19, III Table III-1 và III.19.1.3–4; GBR-07/09/12/14/70/72/73. Ma trận trường và bằng chứng tại `docs/reviews/FE19_UC03_REVIEW.md`.

**Tiền điều kiện:** đã đăng nhập, tài khoản ACTIVE, Owner hiện tại của trại tại mỗi request. Trại PENDING_PAYMENT/ACTIVE/EXPIRED/SUSPENDED đều được xem; chưa có Subscription vẫn mở được.

1. Owner mở Lịch sử thanh toán từ SCR-57 hoặc SCR-59; hệ thống kiểm quyền và đúng trại.
2. Tải danh sách yêu cầu của trại, gồm cả yêu cầu do người khác tạo trước đây. Tìm chứa một phần mã không phân biệt hoa/thường, trim, tối đa 100 ký tự; ô tìm gửi một request sau khi ngừng gõ 300 ms. Mặc định tất cả trạng thái và không giới hạn ngày, mới nhất theo requestedAt trước.
3. Lọc theo trạng thái hiệu lực tại thời điểm đọc và ngày tạo. From/to nhận độc lập, bao gồm trọn ngày theo Asia/Ho_Chi_Minh; from > to báo MSG-COM-11 ngay dưới ô "Tạo đến" (inline under field), không gọi API và giữ kết quả hợp lệ gần nhất; BE vẫn trả 400 MSG-COM-11 nếu nhận khoảng sai. Sắp xếp requestedAt/expiresAt tăng/giảm, tie-break id cùng chiều. BE lọc/count/sort trước phân trang 20 dòng (page 0..107374182, ngoài khoảng 400 MSG-COM-10); giữ bộ lọc theo tài khoản/trại trong phiên, đổi filter/sort về trang đầu. Khi tải lại, bảng cũ vẫn hiện (aria-busy) thay vì bị thay bằng khối đang tải.
4. PENDING còn hiệu lực → Mở lại SCR-59 của đúng yêu cầu, dùng numeric id trong backend mode và snapshot cũ. Đóng hướng dẫn quay lại SCR-60, giữ filter và tải mới. Không tạo yêu cầu mới khi chỉ mở lại.
5. PAID/EXPIRED → Xem panel chi tiết ngay dưới danh sách và phân trang, đủ SCR-60 #9; mở panel thì cuộn tới panel và chuyển focus vào tiêu đề. Ba mốc thời gian độc lập đến giây; null lịch sử hiện “—”. Chỉ kỳ đã xác nhận mới là kỳ đã mua.
6. Làm mới khi vào màn, đổi filter/trang, quay lại từ SCR-59 hoặc bấm Làm mới; SCR-60 không polling. SCR-59 tiếp tục polling 5 giây theo D15. Đọc lại chi tiết trước khi quyết định mở hướng dẫn hoặc panel để nhận trạng thái mới.

**Nhánh/lỗi:** chưa có yêu cầu → “Chưa có thanh toán” + Xem gói; không khớp filter → MSG-COM-04 + Xóa bộ lọc; tải danh sách lỗi → MSG-COM-03 + Thử lại; lỗi detail có Thử lại; không đúng Owner → MSG-COM-01; id không thuộc trại/không tồn tại → MSG-COM-08, không lộ dữ liệu trại khác. Đúng expiresAt thì PENDING được hiển thị/lọc như EXPIRED dù JOB-03 chưa chạy; GET không ghi state. Xác nhận đến muộn theo GBR-72 vẫn có thể làm lần đọc sau trả PAID.

**Hậu điều kiện:** chỉ đọc lịch sử/chi tiết; không tạo/sửa Subscription, Payment, kỳ đã mua, chứng từ, biên lai, audit hoặc trạng thái dịch vụ. Việc tạo mới từ SCR-59 thuộc UC2.

**Hiệu năng đọc chứng từ (review 09/11/2026):** mỗi trang đọc chứng từ bằng 2 query theo lô (theo payment id và theo `upper(quote_ref)`), không còn 2 query mỗi dòng. Changeset `20261109000200` thêm index `ix_evidence_quote_ref_upper` (chỉ PostgreSQL, không thêm cột/dữ liệu) cho phép tra mã không phân biệt hoa/thường dùng index; SCR-57 và SCR-59 (đọc lại 5 giây) cũng hưởng index này.

### UC-FE19-08 Xác nhận từ SePay
1. SePay gửi giao dịch kèm chữ ký HMAC + timestamp.
2. Xác minh chữ ký (≤ 300 s).
3. Lưu chứng từ theo bộ 4 (trùng → dùng lại) + job; trả 200.
4. JOB-06: kiểm chiều vào, TK nhận, mã khớp đúng 1 yêu cầu, đúng số tiền, giờ NH trong cửa sổ, chưa phân bổ.
5. Phân bổ, PAID, tạo kỳ, tính trạng thái dịch vụ, audit – 1 transaction.
6. Thông báo + email Owner; biên lai hiện ở FE-21.

AF1 giao lặp → không tạo kỳ / thông báo mới · AF2 không đủ điều kiện → NEEDS_REVIEW + thông báo đối soát PM · AF3 yêu cầu EXPIRED nhưng giờ NH trong cửa sổ → PAID · AF4 trại SUSPENDED → PAID, vẫn SUSPENDED.
E1 chữ ký sai → 401 · E2 lỗi lưu trước bước 3 → không trả thành công (SePay gửi lại) · E3 lỗi sau khi lưu → JOB-06 retry.

### UC-FE19-06 Đối soát
1. SCR-62: chứng từ cần xem (mã không khớp, yêu cầu hết hạn, không có yêu cầu, sai số tiền) + chi tiết.
2. PM chọn ứng viên (khi gõ sai mã), quyết định ACCEPT, lý do và tham chiếu.
3. **Kiểm tra và chấp nhận** → R-19-06 + R-19-10, tuần tự theo trại.
4. Phân bổ, PAID, tạo kỳ, trạng thái dịch vụ, lưu quyết định + audit – 1 transaction; thông báo Owner.
5. MSG-FE19-10.

AF1 HOLD · AF2 REJECT · AF3 Khóa hoàn trả → sau đó Ghi hoàn trả (mã NH chiều ra, ngày, kết quả) hoặc Mở khóa (lý do) · AF4 Tra cứu SePay (API-03) → lưu thành chứng từ 1 lần.
E1 bị chặn → MSG-FE19-11 · E2 chưa chọn ứng viên → MSG-FE19-11 · E3 thiếu lý do → MSG-COM-06 · E4 đã đổi (ví dụ SePay vừa xác nhận) → MSG-COM-05 · E5 lỗi → MSG-COM-02.

### UC-FE19-07 Công bố bảng giá
1. SCR-63: phiên bản hiệu lực + lịch sử.
2. PM nhập giá 3 kỳ hạn, chọn Áp dụng ngay / Lên lịch (ngày giờ), mô tả điều khoản.
3. **Công bố phiên bản** → kiểm giá, thời điểm, không trùng lịch.
4. Lưu + audit → MSG-FE19-12.

AF1 rút phiên bản SCHEDULED (lý do) → WITHDRAWN · AF2 hủy chỉnh sửa.
E1 giá sai → MSG-FE19-13 · E2 thời điểm quá khứ → MSG-FE19-14 · E3 trùng lịch → MSG-FE19-15 · E4 lỗi → MSG-COM-02.

---

## 6. Màn hình và trường

### SCR-57 Gói dịch vụ của trại (Owner)

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | Farm / Trại | Chỉ đọc + chuyển trại | Cho Owner nhiều trại |
| 2 | Payment history / Lịch sử thanh toán | Nút | SCR-60 |
| 3 | Renew plan / Pay to activate – Gia hạn gói / Thanh toán để kích hoạt | Nút | SCR-58; tắt ngoài cửa sổ (MSG-FE19-03) hoặc SUSPENDED (MSG-FE19-09) |
| 4 | Service status / Trạng thái dịch vụ | Huy hiệu | GBR-13 |
| 5 | Current period / Kỳ hiện tại | Chỉ đọc | Bắt đầu → kết thúc, hoặc "—" |
| 6 | Days remaining / Số ngày còn lại | Số | R-19-16: số ngày tròn 24 giờ, làm tròn xuống; còn 23 giờ → 0 ngày; không có kỳ hiện tại → "—" |
| 7 | Confirmed end date / Ngày kết thúc đã xác nhận | Ngày | Mới nhất trên mọi kỳ |
| 8 | Renewal opens from / Mở gia hạn từ | Ngày | Kết thúc − 90 ngày |
| 9 | Suspended / Tạm ngưng | Chỉ đọc | Không / Có (từ ngày) |
| 10 | Pending request / Yêu cầu đang chờ | Link | Mã + "Mở hướng dẫn", hoặc "—" |
| 11 | Effective price list / Bảng giá hiệu lực | Chỉ đọc | Phiên bản, ngày hiệu lực |
| 12 | Future periods / Kỳ tương lai | Chỉ đọc | Hoặc "—" |
| 13 | Price cards / Thẻ giá 1 / 2 / 3 năm | Thẻ | Tổng giá VND; lỗi MSG-FE19-04 + Thử lại |
| 14 | Purchased periods / Kỳ đã mua | Bảng | Kỳ, mã thanh toán, kỳ hạn, số tiền, trạng thái Hiện tại / Tương lai / Đã qua |

### SCR-58 Chọn kỳ hạn và xem lại

| # | Trường | Loại | Bắt buộc | Nội dung / Lỗi |
|---|---|---|---|---|
| 1 | Farm status / Trạng thái trại | Chỉ đọc | — | Trạng thái + kỳ hiện tại ("Chưa có" với trại mới) |
| 2 | Term / Kỳ hạn | Thẻ chọn | * | 1 / 2 / 3 năm + tổng giá; **không mặc định** |
| 3 | Plan terms / Điều khoản | Chỉ đọc | — | Chức năng như nhau cho mọi kỳ hạn; một lần thanh toán / trại bằng chuyển khoản; không tự gia hạn; yêu cầu hiệu lực 24 giờ |
| 4 | Farm, Term, Amount / Trại, Kỳ hạn, Số tiền | Chỉ đọc | — | — |
| 5 | Estimated service period / Kỳ dịch vụ ước tính | Chỉ đọc | — | Tính như R-19-07, nhãn "ước tính" |
| 6 | Price version / Phiên bản giá | Chỉ đọc | — | Số + ngày hiệu lực |
| 7 | Create payment request / Tạo yêu cầu thanh toán | Nút | — | Tạo hoặc mở lại → SCR-59; MSG-FE19-02 / MSG-FE19-01 / MSG-FE19-03 / MSG-FE19-09 / MSG-FE19-04 / MSG-COM-02 |
| 8 | Back / Later – Quay lại / Để sau | Nút | — | Để sau: trại giữ trạng thái |

### SCR-59 Hướng dẫn chuyển khoản

| # | Trường | Nội dung |
|---|---|---|
| 1 | Title / Tiêu đề | "Mã yêu cầu · kỳ hạn · trại" |
| 2 | VietQR | Ảnh QR (API-01): ngân hàng, TK, số tiền, nội dung; ẩn khi EXPIRED; lỗi tạo ảnh → vẫn hiện chữ |
| 3 | Status / Trạng thái | PENDING / PAID / EXPIRED |
| 4 | Valid for / Còn hiệu lực | Đếm ngược hh:mm:ss |
| 5 | Expires at / Hết hạn lúc | dd/mm/yyyy HH:mm |
| 6 | Receiving bank, Account number, Account name, Amount, Transfer content | Chỉ đọc + nút "Sao chép"; nội dung = mã thanh toán; MSG-FE19-05 |
| 7 | Progress / Tiến trình | Đã tạo yêu cầu (giờ, Xong); Đã nhận giao dịch NH (giờ hoặc —, Đang chờ); Đã xác nhận và cấp kỳ (giờ hoặc —, Chưa / Xong + kỳ) |
| 8 | Check again / Kiểm tra lại | Làm mới; lỗi MSG-FE19-08; PAID → MSG-FE19-06 |
| 9 | View history / Close instructions | SCR-60 / quay lại màn nguồn (SCR-57, SCR-60, SCR-09), không đổi gì |
| 10 | Enter farm / Back to subscription | Khi PAID: lần đầu → SCR-48; gia hạn → SCR-57 |
| 11 | Expired / Hết hạn | MSG-FE19-07 + "Tạo yêu cầu mới" |

### SCR-60 Lịch sử và chi tiết thanh toán

| # | Trường | Nội dung |
|---|---|---|
| 1 | Search payment code / Tìm mã | Ô chữ |
| 2 | Status / Trạng thái | Tất cả, PENDING, PAID, EXPIRED |
| 3 | Created from / to / Tạo từ – đến | Khoảng ngày (MSG-COM-11) |
| 4 | Code, Term, Amount | Cột |
| 5 | Created at, Expires at | dd/mm/yyyy HH:mm, sắp xếp được |
| 6 | Status | Huy hiệu |
| 7 | Confirmed at · period | Với PAID |
| 8 | Actions / Thao tác | PENDING: "Mở lại" (SCR-59); khác: "Xem" (panel chi tiết) |
| 9 | Chi tiết | Mã, trạng thái, trại, phiên bản giá, kỳ hạn, số tiền; giờ NH ghi nhận, giờ nhận, giờ xác nhận (đến giây); kỳ đã mua |
| 10 | Empty state | "Chưa có thanh toán" + "Xem gói dịch vụ" |

### SCR-61 Gói của các trại (PM)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Search / Tìm | Tên trại hoặc mã subscription |
| 2 | Coverage / Bao phủ | Tất cả, Hiện tại, Chỉ tương lai, Không có |
| 3 | Service / suspension / Dịch vụ / tạm ngưng | Lọc trạng thái |
| 4 | Coverage end from / to | Khoảng ngày |
| 5 | Danh sách | Trại, Owner, Dịch vụ, Kỳ hiện tại, Xác nhận đến (sắp xếp được) |
| 6 | Chi tiết | Mã subscription, dịch vụ + tạm ngưng, kỳ hiện tại, mở gia hạn, lần mua mới nhất (kỳ hạn, mã thanh toán) |
| 7 | Purchased periods | Kỳ, kỳ hạn, xác nhận lúc, "Xem thanh toán nguồn" → SCR-62 |
| 8 | Farm without subscription | "Chưa có gói: không có kỳ hay ngày kết thúc." |

### SCR-62 Thanh toán và đối soát (PM)

| # | Trường | Loại | Bắt buộc | Ràng buộc / Lỗi |
|---|---|---|---|---|
| 1 | Summary tiles / Ô tổng hợp | Số | — | Yêu cầu PENDING, Chứng từ cần xem, HOLD, Khóa hoàn trả |
| 2 | Tabs | Tab | — | Chứng từ ngân hàng, Yêu cầu thanh toán |
| 3 | Review status / Trạng thái xem xét | Lọc | — | Tất cả, Cần xem, HOLD, REJECTED, ACCEPTED, Đã khóa |
| 4 | Bank date / Ngày NH | Khoảng ngày | — | MSG-COM-11 |
| 5 | Look up transaction / Tra cứu giao dịch | Ô tìm | — | Mã giao dịch hoặc khoảng (API-03) |
| 6 | Evidence list | Cột | — | Mã giao dịch (che), Số tiền, Nội dung, Giờ NH, Kết quả khớp (Tự động xác nhận · PAID / Mã không khớp / Yêu cầu hết hạn / Không có yêu cầu / Sai số tiền / Chuyển ra) |
| 7 | Provider · environment · namespace | Chỉ đọc | — | Ví dụ SePay · LIVE · beefcare-main |
| 8 | Transaction ID, Amount · direction, Receiving account (✓/✗), Bank time (trusted) | Chỉ đọc | — | — |
| 9 | Candidate requests / Yêu cầu ứng viên | Radio | * khi ACCEPT và mã không chính xác | Mã, số tiền, hết hạn |
| 10 | Decision / Quyết định | Radio | * | ACCEPT / HOLD / REJECT |
| 11 | Reason and evidence references / Lý do và tham chiếu | Ô chữ dài | * | ≤ 1.000; MSG-COM-06 |
| 12 | Check and accept / Save HOLD / Save REJECT | Nút | — | MSG-FE19-11; MSG-COM-05; thành công MSG-FE19-10 |
| 13 | Lock for return / Khóa hoàn trả | Nút | — | Lý do bắt buộc; MSG-FE19-16. Sau đó "Ghi hoàn trả" (mã NH chiều ra, ngày, kết quả) hoặc "Mở khóa" (lý do) |
| 14 | Evidence history / Lịch sử chứng từ | Bảng | — | Quyết định, sự kiện, PM, thời điểm |
| 15 | Payment request list | Cột | — | Mã, Trại, Kỳ hạn, Số tiền, Tạo lúc, Hết hạn, Trạng thái, Chứng từ (link khi đã phân bổ) |

### SCR-63 Bảng giá (PM)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Effective version / Phiên bản hiệu lực | Chỉ đọc | — | Số, hiệu lực từ, người + thời điểm công bố, giá 1 / 2 / 3 năm | — |
| 2 | Price 1 / 2 / 3 years (VND) | Số nguyên | * | 1.000 – 1.000.000.000 | MSG-FE19-13 |
| 3 | Terms / Kỳ hạn | Chỉ đọc | — | 1, 2, 3 năm | — |
| 4 | Application / Áp dụng | Radio | * | Áp dụng ngay / Lên lịch | — |
| 5 | Effective from / Hiệu lực từ | Ngày giờ | * (Lên lịch) | Asia/Ho_Chi_Minh, ≥ hiện tại; ẩn khi Áp dụng ngay | MSG-FE19-14 |
| 6 | Supported terms text / Mô tả điều khoản | Ô chữ | — | ≤ 500 | MSG-COM-10 |
| 7 | Publish version / Công bố phiên bản | Nút | — | — | MSG-FE19-15, MSG-COM-02; thành công MSG-FE19-12 |
| 8 | Publication history / Lịch sử công bố | Bảng | — | Phiên bản, trạng thái (SCHEDULED / EFFECTIVE / SUPERSEDED / WITHDRAWN), hiệu lực từ, giá, người + thời điểm; "Rút" cho SCHEDULED (lý do bắt buộc) | MSG-COM-06 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Tổng quan gói | `farmId` ở path; không body | `SubscriptionOverview {farmId, farmName, serviceStatus, entitlementStatus, currentPeriod?, daysRemaining?, latestEnd?, renewalOpensAt?, suspended, suspendedSince?, pendingPayment?, currentPrices?, futurePeriods[], periods[], eligibility{ok, reason?, opensAt?}}`; các khóa có `?` vẫn hiện trong JSON với null khi không có dữ liệu. Tên JSON theo DTO/OpenAPI, đối chiếu 14 mục tại ma trận UC-01 | COM-01; thiếu giá: currentPrices=null, eligibility.reason=PRICE_UNAVAILABLE, vùng giá hiện FE19-04 | `GET /api/farms/{farmId}/subscription` |
| A2 | Tạo / mở lại yêu cầu | `{durationYears (1\|2\|3), reviewedPriceVersion}` (đều bắt buộc) + `Idempotency-Key` | `PaymentDTO {id, quoteRef, durationYears, amountVnd, priceVersionId, bankCode, accountNumber, accountName, qrImageUrl, requestedAt, expiresAt, state, reopened, bankPaidAt?, receivedAt?, confirmedAt?, confirmationSource?, purchasedStart?, purchasedEnd?, receiptCode?}`; nội dung CK = quoteRef; null giữ khóa JSON | FE19-01 (reopened=true, UI mời mở lại), FE19-02, FE19-03, FE19-09, FE19-04, COM-01, COM-02 | `POST /api/farms/{farmId}/subscription/payments` |
| A3 | Lịch sử / chi tiết (Kiểm tra lại) | `q?, status?, from?, to?, sort=requestedAt, dir=desc, page=0`; ngày ISO, page zero-based 0..107374182, size cố định 20 / — | `PaymentHistoryPage {content: PaymentDTO[], number, size, totalElements, totalPages}` / `PaymentDTO` như A2; đây là thay đổi từ array sang page cho UC3. FE suy tiến trình/kỳ từ các field thực, không lưu trùng. Detail path dùng numeric id | COM-11 khoảng ngày; COM-10 filter/page/sort không hợp lệ; COM-01 quyền; COM-08 detail không tồn tại; list lỗi COM-03; kiểm tra SCR-59 lỗi FE19-08 | `GET …/subscription/payments` · `GET …/subscription/payments/{paymentId}` |
| A4 | VietQR (API-01) | Ngân hàng, TK, số tiền, nội dung | URL ảnh | — | Trong `qrImageUrl` của A2 (gọi dịch vụ QR SePay) |
| A5 | Gói các trại (PM) | `q, coverage, serviceStatus, endFrom, endTo, page, size` / — | `PageSubscriptionRow` / `SubscriptionDetail` | COM-03 | `GET /api/platform/subscriptions` · `GET …/{farmId}` |
| A6 | Ô tổng hợp | — | `PaymentTiles {pending, toReview, held, locked}` | — | `GET /api/platform/payments/summary` |
| A7 | Danh sách chứng từ | `status?, bankFrom?, bankTo?` | `[EvidenceDTO]` | COM-11 | `GET /api/platform/payments/evidence` |
| A8 | Ứng viên | — | `[PaymentCandidate {code, amount, expiresAt}]` | — | `GET …/evidence/{evidenceId}/candidates` |
| A9 | Quyết định | `Review {decision, candidatePaymentId?, reason, references?, version}` + `Idempotency-Key` | `EvidenceDTO` | FE19-11, COM-06, COM-05, COM-02 | `POST …/evidence/{evidenceId}/review` |
| A10 | Khóa / ghi hoàn trả / mở khóa | `ReturnChange {reason}` / `ReturnResult {outgoingRef, date, result}` + `Idempotency-Key` | `EvidenceDTO` | COM-06, COM-05 | `POST …/lock-return` · `…/record-return` · `…/unlock-return` |
| A11 | Tra cứu SePay (API-03) | `transactionId` (hoặc khoảng – Q2) | `WebhookResult` | — | `POST /api/platform/payments/lookup/{transactionId}` |
| A12 | Danh sách yêu cầu (PM) | `state?, q?, page, size` / — | `PagePlatformPayment` / `PlatformPayment` | — | `GET /api/platform/payments` · `GET …/{paymentId}` |
| A13 | Bảng giá | — / `PublishPriceRequest {price1, price2, price3, applyNow, effectiveFrom?, termsText?}` + `Idempotency-Key` | `[PriceVersion]` / `PriceVersion` | FE19-13, FE19-14, FE19-15, COM-02 | `GET` / `POST /api/platform/plan-prices` |
| A14 | Rút phiên bản đã lên lịch | `{reason}` + `Idempotency-Key` | `PriceVersion` WITHDRAWN | COM-06, COM-05 | Chưa có – đề xuất `POST /api/platform/plan-prices/{version}/withdraw` |
| A15 | Webhook SePay (API-02) | Header chữ ký + timestamp, raw body | `200 {"success": true}` / 401 | — | `POST /api/webhooks/sepay` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE19-01 | Hộp thoại | Bạn đã có yêu cầu thanh toán còn hiệu lực {code} (hết hạn {expiry}). [Mở hướng dẫn] [Quay lại] |
| MSG-FE19-02 | Hộp thoại | Giá đã thay đổi từ {old} thành {new} (phiên bản {version}). Vui lòng xem lại giá mới. |
| MSG-FE19-03 | Trên trang | Mở gia hạn từ {date}, 90 ngày trước ngày kết thúc đã xác nhận {end}. |
| MSG-FE19-04 | Trên trang | Hiện chưa lấy được bảng giá. [Thử lại] |
| MSG-FE19-05 | Trên trang | Chuyển khoản chính xác {amount} VND với nội dung {code} trước {expiry}. Dịch vụ được kích hoạt tự động sau khi giao dịch được xác nhận. |
| MSG-FE19-06 | Toast thành công | Đã xác nhận thanh toán {code}. Kỳ dịch vụ {start} – {end}. |
| MSG-FE19-07 | Hộp thoại | Yêu cầu thanh toán {code} đã hết hạn lúc {time}. [Tạo yêu cầu mới] |
| MSG-FE19-08 | Trên trang | Không lấy được kết quả thanh toán mới nhất. Trạng thái gần nhất: {status}. [Thử lại] |
| MSG-FE19-09 | Hộp thoại | {farm} đang bị tạm ngưng. Hiện không thể tạo yêu cầu thanh toán. [Gửi yêu cầu hỗ trợ] |
| MSG-FE19-10 | Toast thành công | Đã lưu quyết định {decision} cho giao dịch {transaction}. |
| MSG-FE19-11 | Trong panel | Không thể chấp nhận chứng từ này: {reason}. |
| MSG-FE19-12 | Toast thành công | Đã công bố bảng giá v{version}, hiệu lực {time}. |
| MSG-FE19-13 | Dưới trường | Giá phải là số nguyên VND từ 1.000 đến 1.000.000.000. |
| MSG-FE19-14 | Dưới trường | Thời điểm hiệu lực không được ở quá khứ. |
| MSG-FE19-15 | Trên form | Phiên bản v{version} đã được lên lịch vào {time}. |
| MSG-FE19-16 | Toast thành công | Giao dịch {transaction} đã khóa để hoàn trả và không thể dùng cho thanh toán nào. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-19-01 | Manager | Gọi A1, A2 | 403 / MSG-COM-01 | H | R-19-01 |
| TC-19-02 | Trại mới PENDING_PAYMENT | Tạo yêu cầu 1 năm | PENDING, hết hạn +24 h, mã duy nhất, số tiền 1.200.000, tạo Subscription | I | R-19-03 |
| TC-19-03 | Đã có PENDING chưa hết hạn | Tạo yêu cầu | MSG-FE19-01; không tạo mới | I | R-19-03 |
| TC-19-04 | Owner xem giá v1, PM công bố v2 ngay | Tạo yêu cầu với v1 | MSG-FE19-02 | I | R-19-04 |
| TC-19-05 | Kết thúc đã xác nhận 31/12, hôm nay 01/10 | Tạo yêu cầu gia hạn | MSG-FE19-03 (mở từ 02/10) | U, I | R-19-05 |
| TC-19-06 | Trại SUSPENDED | Tạo yêu cầu | MSG-FE19-09 | I | R-19-05 |
| TC-19-07 | Webhook chữ ký sai / timestamp lệch 301 s | Gửi | 401; không có chứng từ | I | R-19-13 |
| TC-19-08 | Giao dịch đúng mã, đúng tiền, trong cửa sổ | Webhook | 200; JOB-06 → PAID; kỳ tạo; ACTIVE; thông báo + email; audit | I | R-19-06 |
| TC-19-09 | Giao dịch gửi 2 lần | Webhook | 1 chứng từ, 1 kỳ, 1 thông báo | I | R-19-06, R-19-08 |
| TC-19-10 | Sai số tiền 1 đồng | Webhook | NEEDS_REVIEW, thông báo PM; không PAID | I | R-19-06 |
| TC-19-11 | Yêu cầu EXPIRED; giờ NH trong cửa sổ | Webhook đến muộn | PAID | I | UC-08 AF3 |
| TC-19-12 | Giờ NH sau hết hạn | Webhook | NEEDS_REVIEW | I | R-19-06 |
| TC-19-13 | Trại SUSPENDED nhận tiền | Webhook | PAID, có kỳ, vẫn SUSPENDED | I | R-19-11 |
| TC-19-14 | Kỳ hiện tại kết thúc 15/03/2027; xác nhận 01/02/2027, 1 năm | Xác nhận | Kỳ mới 15/03/2027 → 15/03/2028 | U | R-19-07 |
| TC-19-15 | Kỳ hết 29/02/2028, gia hạn liên tục 1 năm | Xác nhận | Kết thúc 28/02/2029 | U | R-19-07 |
| TC-19-16 | Hết hạn từ 01/01, xác nhận 10/02 | Xác nhận | Kỳ từ 10/02 (đặt lại mốc) | U | R-19-07 |
| TC-19-17 | Chứng từ gõ sai mã, PM không chọn ứng viên | ACCEPT | MSG-FE19-11 | I | R-19-06 |
| TC-19-18 | PM chọn 1 ứng viên + lý do, mọi điều kiện đạt | ACCEPT | PAID, nguồn PM, MSG-FE19-10 | I | R-19-06 |
| TC-19-19 | Giao dịch đã ghi thu thủ công POSTED | ACCEPT | MSG-FE19-11 | I | R-19-10 |
| TC-19-20 | SePay vừa xác nhận chứng từ PM đang xem | ACCEPT | MSG-COM-05 | I | UC-06 E4 |
| TC-19-21 | HOLD / REJECT không lý do | Lưu | MSG-COM-06 | U, H | R-19-09 |
| TC-19-22 | Chứng từ LOCKED_FOR_RETURN | ACCEPT | Bị chặn | I | R-19-08 |
| TC-19-23 | Giá 999 / 1.000.000.001 / 1500,5 | Công bố | MSG-FE19-13 | U | R-19-12 |
| TC-19-24 | Lên lịch thời điểm quá khứ | Công bố | MSG-FE19-14 | U | R-19-12 |
| TC-19-25 | Đã có v3 lên lịch 01/01 00:00 | Công bố v4 cùng thời điểm | MSG-FE19-15 | I | R-19-12 |
| TC-19-26 | v3 SCHEDULED | Rút có lý do | WITHDRAWN | I | UC-07 AF1 |
| TC-19-27 | Yêu cầu đã phát hành theo v1; v2 hiệu lực | Xem yêu cầu | Số tiền vẫn theo v1 | I | R-19-12 |
| TC-19-28 | PENDING quá 24 h | JOB-03 | EXPIRED; SCR-59 ẩn QR, MSG-FE19-07 | I | R-19-14 |
| TC-19-29 | 2 chứng từ cùng trại xác nhận đồng thời | — | Xử lý tuần tự, không tạo 2 kỳ chồng | I | R-19-06 |
| TC-19-30 | PM | Xem SCR-61 | Không có dữ liệu bò / vận hành | H | §2 |
| TC-19-31 | API-01 lỗi | Mở SCR-59 | Vẫn hiện thông tin chuyển khoản dạng chữ | E | UC-02 E5 |
| TC-19-32 | Owner của trại, lần lượt PENDING_PAYMENT / ACTIVE / EXPIRED / SUSPENDED | Đọc A1 | Được xem tổng quan đúng trại và trạng thái tại thời điểm đọc; việc xem không tạo / thay đổi dữ liệu thương mại hoặc tạm ngưng | I, H | UC-01; GBR-07, 09, 13, 14 |
| TC-19-33 | Manager / Technician / người chỉ có vai trò PM; Owner của trại khác | Đọc A1 của trại không sở hữu | 403 / MSG-COM-01; không lộ dữ liệu gói | H | R-19-01; GBR-09, 12 |
| TC-19-34 | Trại mới, chưa có Subscription | Đọc A1 | Kỳ hiện tại, số ngày còn lại, ngày kết thúc và mở gia hạn là null; danh sách kỳ rỗng; đọc lại DB không có Subscription / Payment mới | I, H | UC-01 AF1; §3.2; SCR-57 |
| TC-19-35 | Có các kỳ PAID đã qua / hiện tại / tương lai và các yêu cầu PENDING / EXPIRED | Đọc A1 | Đủ các kỳ PAID, đúng phân loại [start, end), đúng số tiền / kỳ hạn / mã; ngày kết thúc mới nhất gồm cả kỳ tương lai; không đưa yêu cầu chưa PAID vào kỳ đã mua | U, I | UC-01; R-19-07; SCR-57 |
| TC-19-36 | Kỳ hiện tại còn 24 giờ / 23 giờ; hoặc không có kỳ hiện tại; có và không có tạm ngưng | Đọc A1 với clock cố định | Lần lượt 1 / 0 / null ngày; còn 23 giờ vẫn có bao phủ, SUSPENDED không ngừng đếm; đúng end thì kỳ thành Đã qua | U, I | R-19-16; D14; GBR-13, 15, 73 |
| TC-19-37 | Có ngày kết thúc đã xác nhận; ngay trước / đúng mốc mở gia hạn và sau khi hết bao phủ | Đọc A1 | Mốc mở gia hạn luôn bằng kết thúc − 90 ngày; chặn trước mốc, cho phép từ mốc nếu không SUSPENDED; SUSPENDED vẫn bị chặn | U, I | UC-01 AF2, AF3; R-19-05; SCR-57 |
| TC-19-38 | Yêu cầu PENDING còn hiệu lực / expiresAt đúng now nhưng JOB-03 chưa chạy | Đọc A1 | Chỉ trường hợp còn hiệu lực có yêu cầu đang chờ; trường hợp đã tới hết hạn không được hiển thị như còn hiệu lực | U, I | UC-01 AF4; R-19-03; GBR-70 |
| TC-19-39 | Có bảng giá hiện tại và phiên bản lên lịch; hoặc không có bảng giá hiệu lực | Đọc A1 / xem SCR-57 | Đúng 3 giá và phiên bản hiện tại; không dùng giá tương lai; thiếu giá → MSG-FE19-04 + Thử lại tại vùng giá, phần tổng quan đã lấy được vẫn xem được | I, H | UC-01 E2; R-19-12; SCR-57 |

---

### Nghiệm thu UC-FE19-03 (D16)

| Mã | Given / When | Then | Tầng / bằng chứng |
|---|---|---|---|
| TC-19-40 | Owner hiện tại đọc lịch sử trại, gồm yêu cầu do người khác tạo; mọi trạng thái dịch vụ | Đủ lịch sử đúng trại; chỉ đọc, không thay Subscription/Payment/trạng thái dịch vụ | H2 + PostgreSQL: currentOwnerSeesFarmHistoryRegardlessOfRequesterAndServiceStateWithoutWrites |
| TC-19-41 | Tìm một phần mã khác hoa/thường, khoảng ngày tại 00:00 và cuối ngày Việt Nam, hoặc chỉ một đầu ngày | Kết quả kết hợp đúng; ký tự %/_ là chữ tìm literal; không cắt bỏ ngày đến | H2 + PostgreSQL: combinesLiteralCaseInsensitiveSearchAndInclusiveVietnamCreatedDates |
| TC-19-42 | Có 23 yêu cầu cùng thời điểm tạo | Trang đầu 20, trang sau 3; thứ tự ổn định; sort hai cột thời gian đúng | H2 + PostgreSQL: pagesAfterFilteringAndUsesStableSortingForBothTimestampColumns; FE pagination |
| TC-19-43 | PENDING đúng expiresAt, JOB-03 chưa chạy; lọc trạng thái | Xuất hiện trong EXPIRED, không trong PENDING; stored state vẫn PENDING sau GET | H2 + PostgreSQL: filtersByEffectiveExpiryBeforePagingWithoutUpdatingStoredState |
| TC-19-44 | Sai khoảng ngày, enum/sort/page (kể cả page vượt 107374182), quá 100 ký tự; sai role/trại hoặc mất quyền | Từ chối đúng code/quyền (page tràn là 400 MSG-COM-10, không phải 500); không lộ dữ liệu; FE báo MSG-COM-11 dưới ô "Tạo đến", không gọi HTTP, giữ danh sách hợp lệ gần nhất | H2 + PostgreSQL: rejectsInvalidRangesEnumsSortPageAndLongSearch, guardsListsAndDetailsAgainstRolesOtherFarmsAndRevokedMembership; FE validation |
| TC-19-45 | PAID/EXPIRED và dữ liệu cũ thiếu mốc ngân hàng | Panel chỉ đọc đủ trường, ba mốc đến giây độc lập; null hiện “—”; numeric id cho API | H2 + PostgreSQL: detailAndListPreserveStoredSecondsSnapshotsAndNullLegacyFields; FE detail |
| TC-19-46 | Owner tìm mã → Mở lại SCR-59 → Đóng hướng dẫn về SCR-60 | Đúng yêu cầu/trại, giữ filter, tải lại danh sách; đổi trại không dùng filter/dữ liệu trại cũ | FE subscriptionHistoryBackend.test.tsx; runtime MOCK ghi riêng trong review |
| TC-19-47 | Để SCR-60 đứng yên, bấm Làm mới; danh sách rỗng/lỗi | Không polling; có manual refresh/retry; phân biệt chưa có thanh toán và không khớp filter; không fallback demo | FE subscriptionHistoryBackend.test.tsx; OpenApiContractTest cho schema page |
| TC-19-48 | Trang 20 dòng, mỗi dòng có chứng từ riêng (đã phân bổ, chưa phân bổ khác hoa/thường, sai tài khoản) | Mỗi dòng nhận đúng mốc của chứng từ của mình, list = detail; số câu SQL của trang 20 dòng không tăng so với 3 dòng; PostgreSQL có và dùng được `ix_evidence_quote_ref_upper` | H2 + PostgreSQL: listReadsEvidenceInOneBatchAndMatchesEachRowToItsOwnEvidence; PostgreSQL: upperQuoteRefIndexServesTheBatchedEvidenceLookup |
| TC-19-49 | Gõ nhanh nhiều ký tự; bấm Làm mới; mở Xem ở trang 20 dòng | Một request sau khi ngừng gõ; bảng giữ nguyên khi tải lại; panel chi tiết được cuộn tới và nhận focus | FE subscriptionHistoryBackend.test.tsx |

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Rút phiên bản đã lên lịch chưa có route | Thêm A14 |
| Q2 | Tra cứu SePay theo khoảng thời gian (SRS nêu "ID or period"), code chỉ có theo ID | Bổ sung tham số `from, to` |
| Q3 | UC-FE19-01, 03, 04, 05 không có đặc tả Part II | UC-01 đã chốt theo Part III + GBR; UC-03 chốt luồng mục 5 theo D16 ngày 09/11/2026. UC-04, 05 chưa chốt |
| Q4 | Độ dài lý do khóa / mở khóa / rút phiên bản | ≤ 1.000 như quyết định |
| Q5 | Email cho Owner khi PAID – mẫu nội dung | Theo MSG-FE19-06 |
| Q6 | Cách làm tròn số ngày còn lại trên SCR-57 | Đã chốt DucNV 09/11/2026 (D14): làm tròn xuống theo số ngày tròn 24 giờ; còn 23 giờ → 0 ngày, vẫn có bao phủ tới end; không có kỳ hiện tại → "—" |
| Q7 | Khi đúng mã/TK nhưng sai số tiền, bước nhận giao dịch SCR-59 có hoàn thành không? | Đã chốt trong phiên 09/11/2026 (D15): hiện đã nhận khi chứng từ xác thực, IN, đúng env/namespace/TK/mã; chưa PAID/cấp kỳ khi sai tiền. Mốc nhận và xác nhận tách biệt |
| Q8 | SCR-59 có tự cập nhật trạng thái không? | Đã chốt trong phiên 09/11/2026 (D15): đọc lại 5 giây khi PENDING, không request chồng; dừng PAID/EXPIRED/rời màn, kiểm một lần tại expiry, giữ nút Kiểm tra lại. Scope backend + SCR-58/SCR-59 |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho DucNV duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 09/11/2026 | 28/10/2026 | Ghi quyết định cách tính số ngày còn lại (D14, Q6); bổ sung dự thảo luồng UC-01, quy ước dữ liệu và TC-19-32 → 39 để chốt trước triển khai. Q3 vẫn chờ xác nhận luồng | DucNV chốt Q6; agent soạn dự thảo UC-01 |
| 09/11/2026 | 28/10/2026 | DucNV xác nhận làm UC-01 và cả backend + nối SCR-57; chốt phần UC-01 của Q3. A1 dùng tên JSON thực tế của DTO; ma trận và bằng chứng tại `docs/reviews/FE19_UC01_REVIEW.md` | DucNV |
