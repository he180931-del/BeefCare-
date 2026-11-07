# SPEC FE-05 – Hồ sơ bò, định danh và trạng thái

| | |
|---|---|
| Feature | FE-05 Cattle Profile, Identification and State |
| Use case | UC-FE05-01 → UC-FE05-05 |
| Người phụ trách | AnNT (BE + FE + test) · Review BE: TuanPQ · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Cattle, Cattle Profile Change, Pen Assignment, Cattle QR Tag), §3.3 (BR-D07, BR-D08), §3.4.1 (Table 3.4-1), Part II §5, Part III §5 (SCR-18 → SCR-22, 2 popup), MSG-FE05, GBR-07, 23 → 28; REM-08; OR-02 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN theo Table 3.4-1 và Figma tab 03.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE05-01 | Xem danh sách bò | Owner, Manager, Technician | SCR-18 |
| UC-FE05-02 | Xem hồ sơ bò | Owner, Manager, Technician | SCR-19 (khung các tab), SCR-20, SCR-21 |
| UC-FE05-03 | Cập nhật hồ sơ bò | Owner, Manager (mục đích: chỉ Owner) | Popup Cập nhật hồ sơ bò |
| UC-FE05-04 | Cấp / thay thẻ QR | Owner, Manager | SCR-21, popup Cấp / Thay thẻ QR |
| UC-FE05-05 | Quét mã QR bò | Owner, Manager, Technician | SCR-22 |

**SCR-19 là khung chứa các tab:** Tổng quan (spec này), Dòng thời gian (SCR-50, FE-16), Cân & BCS (SCR-30, FE-08), Tiêm phòng (SCR-34, FE-09), Sức khỏe (SCR-37, FE-10), Sinh sản (SCR-39, FE-11/12, chỉ bò cái), Lịch sử chuồng (SCR-20), Thẻ QR (SCR-21). Nội dung các tab của feature khác nằm trong spec của feature đó.

**Ngoài gói:** tạo bò (nhập đàn FE-06), chuyển chuồng (FE-04), các trạng thái suy ra lấy nguồn từ FE-08 → FE-13.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician | Nguồn |
|---|---|---|---|---|
| Xem danh sách, hồ sơ, quét QR | Có | Có | Có | Role lists |
| Sửa mã tai, ảnh, tên, màu lông, ghi chú, giai đoạn | Có | Có | — | GBR-25 |
| Đổi mục đích sản xuất | **Chỉ Owner** | Xem (MSG-FE05-03) | — | GBR-07, GBR-25 |
| Cấp / thay / in thẻ QR | Có | Có | — | UC-04 |
| Mở link phiếu nhập (SCR-75) từ hồ sơ | Có | Có | — | SCR-19 |
| Bắt đầu phiếu nhập từ danh sách | Có | Có | — | SCR-18 |

Mọi thao tác ghi cần trại ACTIVE và bò ACTIVE.

---

## 3. Dữ liệu

### 3.1 Bò (Cattle) – thuộc tính lưu

| Thuộc tính | Kiểu | Ràng buộc | Sửa ở đâu | Nguồn |
|---|---|---|---|---|
| Internal Cattle ID | Hệ thống tạo | Không đổi, không tái sử dụng; **không hiển thị** (chỉ có "Sao chép mã nội bộ") | — | GBR-23, BR-D07, SCR-19 |
| Mã hiển thị | `BC-nnnnnn` theo dãy số của trại | Duy nhất trong trại, không đổi, không tái sử dụng | — | GBR-23 |
| Số tai (ear tag) | Chuỗi | ≤ 30; duy nhất trong các bò ACTIVE của trại; có thể trống ("Gắn tai sau") | Popup tab Định danh | GBR-23, BR-D08 |
| Tên | Chuỗi | ≤ 50 | Popup | Popup |
| Giới tính | `MALE` / `FEMALE` | Không sửa ở FE-05 | Nhập đàn (FE-06) | §3.2 |
| Giống | Danh mục | Không sửa ở FE-05 | Nhập đàn | §3.2 |
| Ngày sinh + độ chính xác | Ngày / tháng + `EXACT` / `ESTIMATED` / `UNKNOWN` | — | Nhập đàn | §3.2 |
| Màu lông và đặc điểm | Chuỗi | ≤ 255 | Popup | Popup |
| Ảnh | File JPG / PNG | ≤ 5 MB; 1 ảnh hiện tại | Popup | Popup |
| Ghi chú | Chuỗi dài | ≤ 1.000 | Popup | Popup |
| Mục đích sản xuất | Danh mục (có loại mục đích) | Mục đích ACTIVE; SIRE chỉ cho bò đực, BREEDING chỉ cho bò cái | Popup, chỉ Owner | GBR-25 |
| Giai đoạn | `UNWEANED_CALF` / `WEANED_CALF` / `YOUNG_STOCK` / `ADULT` | — | Popup | GBR-25 |
| Trạng thái đàn | `ACTIVE` / `EXITED` / `VOIDED` | Đổi bởi FE-06 / FE-13 | — | Table 3.4-1 |
| Loại xuất + ngày xuất, hoặc lý do hủy nhập | — | — | FE-13 / FE-06 | §3.2 |
| Bò mẹ, bò bố | Bò nội bộ, hoặc mã đực / tinh ngoài, hoặc "Không rõ" | — | FE-06 / FE-12 | §3.2 |

### 3.2 Trạng thái suy ra (không bao giờ sửa trên hồ sơ – GBR-24)

| Chiều | Giá trị (nhãn VN) | Nguồn | Hiện cho |
|---|---|---|---|
| Chờ xuất | Chờ xuất (phiếu bán / loại / khác DRAFT); Chờ xác nhận chết / mất (phiếu chết PENDING) | FE-13 | ACTIVE |
| Nhóm đàn | Bê; Vỗ béo; Đực giống; Bò cái sinh sản; Bò tơ; Khác – lấy nhóm **đầu tiên** khớp theo thứ tự ở R-05-06 | Giai đoạn, loại mục đích, giới tính | ACTIVE |
| Chuồng hiện tại | Mã + tên chuồng | Phân chuồng đang mở (FE-04) | ACTIVE |
| Sức khỏe | Khỏe mạnh / Theo dõi / Đang điều trị | FE-10 (GBR-45) | ACTIVE |
| Cách ly thịt | "Cách ly thịt đến dd/mm/yyyy" hoặc không | Điều trị và tiêm tại trại hợp lệ (GBR-46) | ACTIVE |
| Sinh sản | Chờ phối / Động dục / Đã phối – chờ khám thai / Mang thai (kèm "Sắp đẻ") / Sau sinh / Không áp dụng | FE-11, FE-12 (GBR-54) | Bò cái ACTIVE thuộc diện theo dõi |
| Đủ điều kiện phối | Đủ / Chưa đủ (kèm điều kiện chưa đạt) | Tham số trại (GBR-55) | Bò cái Chờ phối, Động dục, Sau sinh |
| Cân gần nhất, ADG 90 ngày, BCS | Kèm cơ sở (đo / ước tính) | FE-08 (GBR-39) | — |

**Thứ tự huy hiệu** trên danh sách và tiêu đề hồ sơ: trạng thái đàn (hoặc Chờ xuất) → nhóm đàn → sức khỏe → cách ly thịt → sinh sản. Bò EXITED / VOIDED **chỉ** hiện trạng thái đàn kèm loại xuất và ngày, hoặc lý do hủy; không hiện các trạng thái suy ra.

### 3.3 Lịch sử thay đổi hồ sơ (Cattle Profile Change)

Mỗi lần đổi một nhóm trường: bò, nhóm trường, giá trị cũ, giá trị mới, ngày hiệu lực, lý do, người đổi, thời điểm. Bất biến; sắp theo ngày hiệu lực.

### 3.4 Thẻ QR (Cattle QR Tag)

| Thuộc tính | Ràng buộc |
|---|---|
| Bò, mã thẻ | Mã thẻ duy nhất; mỗi bò tối đa 1 thẻ ACTIVE (BR-D08) |
| Trạng thái | `ACTIVE` → `REPLACED` (cấp thẻ mới) hoặc `RETIRED` (hủy nhập); không bao giờ kích hoạt lại. Bò EXITED giữ thẻ ACTIVE |
| Người cấp, thời điểm cấp, lý do thay (`LOST` / `DAMAGED` / `OTHER`), ghi chú (≤ 255), thẻ thay thế | — |
| Mã in trên thẻ | Mã hiển thị in **phía trên** mã QR (OR-02) |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-05-01 | Internal Cattle ID và mã hiển thị tạo một lần, không đổi, không tái sử dụng, kể cả sau khi xuất hoặc hủy nhập. Thay thẻ QR không đổi hai mã này hay lịch sử. | GBR-23, BR-D07, GBR-27 |
| R-05-02 | Số tai duy nhất trong các bò ACTIVE của trại → MSG-FE05-02. | GBR-23, BR-D08 |
| R-05-03 | Chỉ Owner đổi mục đích; Manager thấy tab Mục đích chỉ đọc (MSG-FE05-03). Owner / Manager đổi giai đoạn, số tai, ảnh, tên, màu lông, ghi chú. | GBR-25 |
| R-05-04 | Mục đích loại SIRE chỉ cho bò đực, BREEDING chỉ cho bò cái → MSG-FE05-12. FATTENING / UNDECIDED cho cả hai giới. Quy tắc dùng **loại** mục đích, không dùng tên. | GBR-25 |
| R-05-05 | Đổi mục đích / giai đoạn cần ngày hiệu lực (không ở tương lai → MSG-COM-07, không trước ngày nhập đàn → MSG-COM-15) và lý do; lưu lịch sử. | GBR-25, UC-03 bước 4 |
| R-05-06 | Nhóm đàn của bò ACTIVE = nhóm đầu tiên khớp: (1) Bê nếu giai đoạn UNWEANED_CALF hoặc WEANED_CALF; (2) Vỗ béo nếu loại mục đích FATTENING; (3) Đực giống nếu đực và SIRE; (4) Bò cái sinh sản nếu cái, ADULT và BREEDING; (5) Bò tơ nếu YOUNG_STOCK; (6) Khác. Mỗi con thuộc đúng 1 nhóm, tổng các nhóm = tổng bò ACTIVE. | GBR-24 |
| R-05-07 | Sau khi đổi giai đoạn / mục đích: tính lại nhóm đàn và việc áp dụng theo dõi sinh sản; tính lại nhắc việc phụ thuộc (REM-08). Chuồng, sức khỏe, sự kiện sinh sản **không đổi**. | UC-03 POST-2, bước 6 |
| R-05-08 | Đổi làm bò cái không còn diện theo dõi sinh sản khi không có thai OPEN → hỏi xác nhận MSG-FE05-11; lịch sử sinh sản vẫn giữ. | UC-03 AF3 |
| R-05-09 | Gợi ý REM-08 không tự đổi mục đích, giai đoạn hay chuồng. Mở từ gợi ý: tab Giai đoạn điền sẵn giai đoạn gợi ý, ngày hiệu lực (ngày đạt ngưỡng tuổi hoặc ngày đẻ), lý do; lưu xong thì REM-08 được giải quyết. | GBR-25, UC-03 AF2, POST-3 |
| R-05-10 | Bò EXITED / VOIDED chỉ đọc: không đổi hồ sơ, không cấp thẻ, không thêm sự kiện; vẫn xem đủ lịch sử. Bò trên phiếu chết PENDING: không đổi hồ sơ (MSG-COM-17). | GBR-26 |
| R-05-11 | Giá trị danh mục đã ngưng không được chọn → MSG-FE18-08. | UC-03 E2 |
| R-05-12 | Thẻ: mỗi bò tối đa 1 thẻ ACTIVE; thay thẻ cần lý do; thẻ cũ → REPLACED, thẻ mới ACTIVE, lưu lịch sử trong một transaction. Cấp lần đầu không hỏi lý do. Mã thẻ người dùng nhập (thẻ in sẵn) phải duy nhất → MSG-FE12-08. | GBR-27, BR-D08, UC-04 |
| R-05-13 | In lỗi sau khi đã lưu: thẻ vẫn ACTIVE, in lại từ tab Thẻ QR (MSG-FE05-08). | UC-04 E2 |
| R-05-14 | Có mã QR không phải là có quyền. Quét chỉ trả bò trong trại người dùng được truy cập; bò của trại khác có quyền → hỏi chuyển trại (MSG-FE05-06); mã lạ, mã trại không có quyền, mã VietQR thanh toán → MSG-FE05-09, **không trả bất kỳ dữ liệu bò nào**. Mở link thẻ ngoài ứng dụng phải đăng nhập; không có trang công khai. | GBR-28 |
| R-05-15 | Quét thẻ REPLACED vẫn mở đúng bò, kèm MSG-FE05-05. Quét mã của bê nháp → MSG-FE05-10. Bò EXITED mở hồ sơ chỉ đọc kèm MSG-COM-13. | UC-05 AF2, AF4, E3 |
| R-05-16 | Hồ sơ chỉ hiện các nút mà vai trò được phép; nút ghi bị ẩn với bò EXITED, VOIDED và bò trên phiếu chết PENDING. | SCR-19 |

---

## 5. Luồng xử lý

### UC-FE05-01 Xem danh sách bò
SCR-18: tìm, lọc, tab nhóm đàn có số đếm → bấm dòng mở SCR-19. Mặc định trạng thái đàn = ACTIVE. Không có kết quả → MSG-COM-04.

### UC-FE05-02 Xem hồ sơ bò
SCR-19: tiêu đề (ảnh, mã, tên, dòng tóm tắt, huy hiệu theo thứ tự §3.2), các khối Định danh, Thông tin cá thể, Tóm tắt chăm sóc, Nhắc việc liên quan; các tab. Bò EXITED: chỉ huy hiệu "Đã xuất · loại · ngày" + MSG-COM-13; VOIDED: "Nhập nhầm – đã hủy" + MSG-COM-18; phiếu chết PENDING: MSG-COM-17 kèm link phiếu (Owner: SCR-43).

### UC-FE05-03 Cập nhật hồ sơ bò
1. Popup có 3 tab: Định danh & mô tả · Mục đích sản xuất · Giai đoạn.
2. Người dùng nhập giá trị mới ở một tab.
3. **Lưu thay đổi** → hệ thống kiểm: giá trị, số tai duy nhất, danh mục còn ACTIVE, ngày hiệu lực, quyền (R-05-03), version.
4. Lưu giá trị mới + lịch sử trong một transaction → R-05-07 → MSG-FE05-01.

AF1 Manager mở → tab Mục đích chỉ đọc + MSG-FE05-03 · AF2 mở từ gợi ý REM-08 (R-05-09) · AF3 MSG-FE05-11 (R-05-08) · AF4 Hủy → MSG-COM-14 nếu có dữ liệu chưa lưu.
E1 trùng số tai → MSG-FE05-02 · E2 danh mục ngưng → MSG-FE18-08 · E3 thiếu lý do / ngày, ngày tương lai, ngày trước nhập đàn → MSG-COM-06 / 07 / 15 · E4 bò EXITED → MSG-COM-13 · E5 sửa đồng thời → MSG-COM-05 · E6 lỗi lưu → MSG-COM-02.

### UC-FE05-04 Cấp / thay thẻ QR
1. Popup hiện thẻ hiện tại (mã, trạng thái, tháng cấp) và mã thẻ mới hệ thống tạo (hoặc người dùng nhập mã thẻ in sẵn).
2. Chọn lý do thay (Mất / Hỏng / Khác), ghi chú tùy chọn.
3. **In thử** (không lưu, tùy chọn) → **Xác nhận thẻ mới**.
4. Kiểm trạng thái bò, mã mới duy nhất → R-05-12 → MSG-FE05-04 → đề nghị in.

AF1 cấp lần đầu → không hỏi lý do · AF2 Hủy.
E1 bò EXITED → MSG-COM-13 · E2 in lỗi → MSG-FE05-08 · E3 lỗi lưu → MSG-COM-02.

### UC-FE05-05 Quét QR
1. Mở SCR-22, xin quyền camera khi cần.
2. Đưa camera vào thẻ → hệ thống đọc mã, tìm bò (R-05-14), kiểm bò thuộc trại hiện tại và người dùng được xem.
3. Hiện thẻ tóm tắt bò → **Mở hồ sơ** (SCR-19, chỉ nút theo vai trò) hoặc **Quét lại**.

AF1 **Nhập mã thủ công** (mã hiển thị, số tai hoặc mã thẻ) → xử lý như quét · AF2 thẻ REPLACED → MSG-FE05-05 · AF3 bò của trại khác có quyền → MSG-FE05-06, đồng ý thì chuyển trại (UC-FE02-02) rồi mở hồ sơ · AF4 bò EXITED → hồ sơ chỉ đọc + MSG-COM-13.
E1 camera không dùng được → MSG-FE05-07 + nhập thủ công · E2 mã lạ / VietQR / trại không có quyền → MSG-FE05-09 · E3 mã của bê nháp → MSG-FE05-10.

---

## 6. Màn hình và trường

### SCR-18 Danh sách bò

| # | Trường | Loại | Nội dung / Ràng buộc |
|---|---|---|---|
| 1 | Header / Tiêu đề | Chữ | "n đang nuôi · m đã xuất" (không đếm bò VOIDED) |
| 2 | New entry voucher / Phiếu nhập mới | Nút (Owner, Manager) | Mở SCR-24 |
| 3 | Search / Tìm | Ô chữ | Khớp mã hiển thị, số tai hoặc tên |
| 4 | Breed, Sex, Pen / Giống, Giới tính, Chuồng | Dropdown | Mặc định Tất cả |
| 5 | Purpose / Mục đích | Dropdown | Các mục đích ACTIVE; mặc định Tất cả |
| 6 | Life stage / Giai đoạn | Dropdown | Bê chưa cai sữa, Bê cai sữa, Bò tơ, Trưởng thành; mặc định Tất cả |
| 7 | Health / Sức khỏe | Dropdown | Tất cả, Khỏe mạnh, Theo dõi, Đang điều trị, Đang cách ly thịt |
| 8 | Herd status / Trạng thái đàn | Dropdown | ACTIVE (mặc định), Chờ xuất, EXITED, VOIDED, Tất cả |
| 9 | Herd group tabs / Tab nhóm đàn | Tab có số đếm | Tất cả, Bò cái sinh sản, Bò tơ, Vỗ béo, Bê, Đực giống, Khác, Đã xuất; tab Khác luôn hiện kể cả 0; tổng các nhóm = tổng ACTIVE |
| 10 | Cattle / Bò | Cột | Mã hiển thị + tên (sắp xếp được) |
| 11 | Breed / Giống | Cột | Tên giống |
| 12 | Sex · Age / Giới tính · Tuổi | Cột | Ví dụ "Cái · 4 năm 7 tháng"; "~" khi ước tính |
| 13 | Pen / Chuồng | Cột | Mã + tên chuồng hiện tại |
| 14 | Purpose · Stage / Mục đích · Giai đoạn | Cột | Ví dụ "Bò sinh sản · Trưởng thành"; **không** thay giai đoạn bằng nhóm đàn |
| 15 | Latest weight / Cân gần nhất | Cột | "342 kg · 12/10"; "*" = cân ước tính |
| 16 | Status / Trạng thái | Huy hiệu | Chờ xuất / Chờ xác nhận chết / mất; EXITED: "Đã xuất · loại · ngày"; VOIDED: "Nhập nhầm – đã hủy" |
| 17 | Health / Sức khỏe | Huy hiệu | Chỉ ACTIVE: Khỏe mạnh / Theo dõi / Đang điều trị; "Cách ly thịt đến dd/mm"; "Nghi truyền nhiễm" khi có ca OPEN gắn cờ |
| 18 | Reproduction / Sinh sản | Huy hiệu | Bò cái ACTIVE thuộc diện: Chờ phối / Động dục / Đã phối / Mang thai ("Sắp đẻ") / Sau sinh; còn lại "—" |
| 19 | Open / Mở | Thao tác dòng | Mở SCR-19 |

### SCR-19 Hồ sơ bò – Tổng quan

| # | Trường | Loại | Nội dung / Hành vi |
|---|---|---|---|
| **Tiêu đề** | | | |
| 1 | Photo / Ảnh | Ảnh nhỏ | Ảnh hiện tại hoặc ảnh mặc định; bấm để phóng to |
| 2 | Display code, name / Mã, tên | Chữ | Ví dụ BC-000125 "Hoa Đỏ" |
| 3 | Summary line / Dòng tóm tắt | Chữ | Số tai ("Gắn tai sau" khi trống) · giống · giới tính · tuổi · chuồng hiện tại |
| 4 | Badges / Huy hiệu | Huy hiệu | Theo thứ tự §3.2; quy tắc cho EXITED / VOIDED / phiếu chết PENDING ở mục 5 |
| 5 | Update profile / Reissue QR – Cập nhật hồ sơ / Cấp lại QR | Nút (Owner, Manager) | Ẩn với EXITED, VOIDED, phiếu chết PENDING |
| 6 | More ⋯ › Copy internal ID / Sao chép mã nội bộ | Menu | Sao chép Internal Cattle ID để gửi hỗ trợ; không hiển thị ID |
| **Định danh** | | | |
| 7 | Display code, Ear tag number / Mã hiển thị, Số tai | Chỉ đọc | Thẻ QR hiện tại ở tab Thẻ QR |
| **Thông tin cá thể** | | | |
| 8 | Sex, Breed / Giới tính, Giống | Chỉ đọc | — |
| 9 | Birth date, Age / Ngày sinh, Tuổi | Chỉ đọc | Luôn hiện độ chính xác: ngày chính xác; "~" + "(ước tính)"; "Không rõ" và không có tuổi |
| 10 | Entry source / Nguồn nhập | Chỉ đọc | Mua: ngày nhập, người bán, cân lúc nhập kèm cơ sở, mã phiếu (link SCR-75 cho Owner, Manager); "Cách ly đến dd/mm/yyyy" khi ngày đó ≥ hôm nay. Sinh tại trại: ngày sinh, bò mẹ |
| 11 | Declared at entry / Khai báo khi nhập | Chỉ đọc | Chỉ bò mua: tóm tắt khai báo (tiêm, bệnh, sinh sản: số lứa đã đẻ, mang thai khoảng n tháng); "Không rõ" hiện là không rõ (GBR-30) |
| 12 | Production purpose / Mục đích | Chỉ đọc | Giá trị, loại mục đích, "từ ngày" |
| 13 | Life stage / Giai đoạn | Chỉ đọc | Giá trị, "từ ngày"; gợi ý REM-08 đang chờ hiện dạng gợi ý với nút "Xem xét" (Owner, Manager) mở popup tab Giai đoạn |
| 14 | Current pen / Chuồng hiện tại | Chỉ đọc | Chuồng, "từ ngày" |
| 15 | Dam, Sire / Bò mẹ, Bò bố | Link / chữ | Link bò nội bộ; mã đực / tinh ngoài dạng chữ; "Không rõ" |
| 16 | Name, Description / Tên, Mô tả | Chỉ đọc | — |
| **Tóm tắt chăm sóc** | | | |
| 17 | Latest weight, ADG 90 days, BCS | Chỉ đọc | Từ bản ghi cân hợp lệ, kèm cơ sở |
| 18 | Health / Sức khỏe | Chỉ đọc | Trạng thái; số ca OPEN, CHRONIC kèm chẩn đoán nghi ngờ của từng ca, hoặc "Không có ca đang mở"; "Nghi truyền nhiễm – cách ly" khi có cờ |
| 19 | Meat withdrawal / Cách ly thịt | Chỉ đọc | "Đến dd/mm/yyyy" tô nổi khi còn hiệu lực, không thì "Không" |
| 20 | Reproduction / Sinh sản | Chỉ đọc | Trạng thái, đủ điều kiện phối (Đạt / Chưa đạt), ngày đẻ dự kiến kèm cơ sở; "Không áp dụng" cho bò đực, bê, bò cái ngoài diện |
| 21 | Vaccination / Tiêm phòng | Chỉ đọc | Số mũi quá hạn |
| 22 | Related reminders / Nhắc việc liên quan | Danh sách | Tối đa 5 nhắc việc đang có: tiêu đề, hạn; link SCR-44 |

### SCR-20 Tab Lịch sử chuồng

| # | Trường | Nội dung |
|---|---|---|
| 1 | Current pen / Chuồng hiện tại | Mã – tên, từ ngày, số con / sức chứa, tóm tắt tiêu chí |
| 2 | Move pen / Chuyển chuồng | Nút (Owner, Manager); mở popup Chuyển chuồng (FE-04) |
| 3 | Pen / Chuồng | Mã – tên |
| 4 | From / To – Từ / Đến | Ngày; "—" cho đoạn đang mở |
| 5 | Reason / Lý do | Lý do xếp / chuyển; lý do cảnh báo khi không đạt tiêu chí |
| 6 | Recorded by / Người ghi | Tên thành viên |

### SCR-21 Tab Thẻ QR

| # | Trường | Nội dung |
|---|---|---|
| 1 | Tag code, Status / Mã thẻ, Trạng thái | Chỉ đọc |
| 2 | Code printed on tag / Mã in trên thẻ | Mã hiển thị in phía trên QR (OR-02) |
| 3 | Issued at · by / Cấp lúc · bởi | Chỉ đọc |
| 4 | Print tag / In thẻ | Nút (Owner, Manager) |
| 5 | Replace tag / Thay thẻ | Nút (Owner, Manager); mở popup Cấp / Thay thẻ QR |
| 6 | Tag history / Lịch sử thẻ | Dòng chỉ đọc: mã thẻ, cấp, kết thúc, lý do (Mất / Hỏng / Khác / "Cấp lần đầu"), người làm |

### Popup Cập nhật hồ sơ bò

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| **Tab Định danh & mô tả** | | | | | |
| 1 | Photo / Ảnh | File | — | JPG / PNG, ≤ 5 MB; thay hoặc xóa | MSG-COM-10 |
| 2 | Ear tag number / Số tai | Ô chữ | — | ≤ 30; duy nhất trong bò ACTIVE | MSG-COM-10, MSG-FE05-02 |
| 3 | Name / Tên | Ô chữ | — | ≤ 50 | MSG-COM-10 |
| 4 | Colour and markings / Màu lông, đặc điểm | Ô chữ | — | ≤ 255 | MSG-COM-10 |
| 5 | Notes / Ghi chú | Ô chữ dài | — | ≤ 1.000 | MSG-COM-10 |
| **Tab Mục đích sản xuất** (Manager: chỉ đọc + MSG-FE05-03) | | | | | |
| 6 | Current purpose / Mục đích hiện tại | Chỉ đọc | — | — | — |
| 7 | New purpose / Mục đích mới | Dropdown | * | Mục đích ACTIVE, hiện kèm loại; SIRE chỉ cho đực, BREEDING chỉ cho cái | MSG-COM-06, MSG-FE05-12, MSG-FE18-08 |
| 8 | Effective date / Ngày hiệu lực | Ngày | * | Không ở tương lai, không trước ngày nhập đàn | MSG-COM-06, MSG-COM-07, MSG-COM-15 |
| 9 | Reason / Lý do | Ô chữ dài | * | — (Q1) | MSG-COM-06 |
| **Tab Giai đoạn** | | | | | |
| 10 | Current stage / Giai đoạn hiện tại | Chỉ đọc | — | Kèm "từ ngày" và tuổi | — |
| 11 | New stage / Giai đoạn mới | Dropdown | * | Bê chưa cai sữa / Bê cai sữa / Bò tơ / Trưởng thành; điền sẵn khi mở từ REM-08 | MSG-COM-06; xác nhận MSG-FE05-11 |
| 12 | Effective date / Ngày hiệu lực | Ngày | * | Như #8 | Như #8 |
| 13 | Reason / Lý do | Ô chữ dài | * | — | MSG-COM-06 |
| 14 | Cancel / Save changes – Hủy / Lưu thay đổi | Nút | — | — | MSG-COM-13, MSG-COM-17, MSG-COM-05, MSG-COM-02; thành công MSG-FE05-01 |

### Popup Cấp / Thay thẻ QR

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Current tag / Thẻ hiện tại | Chỉ đọc | — | Mã, trạng thái, tháng cấp; ẩn khi cấp lần đầu | — |
| 2 | Replacement reason / Lý do thay | Dropdown | * (chỉ khi thay) | Mất / Hỏng / Khác | MSG-COM-06 |
| 3 | New tag code / Mã thẻ mới | Chỉ đọc hoặc ô chữ | — | Hệ thống tạo; hoặc nhập mã thẻ in sẵn (duy nhất) | MSG-FE12-08 |
| 4 | Note / Ghi chú | Ô chữ | — | ≤ 255 | MSG-COM-10 |
| 5 | Print test tag / In thử | Nút | — | In không lưu | — |
| 6 | Cancel / Confirm new tag – Hủy / Xác nhận thẻ mới | Nút | — | — | MSG-COM-13, MSG-COM-02; thành công MSG-FE05-04; in lỗi MSG-FE05-08 |

### SCR-22 Quét QR

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | Camera view / Khung camera | Camera | Khung quét; không dùng được → MSG-FE05-07 |
| 2 | Identified cattle card / Thẻ bò đã nhận diện | Chỉ đọc | Mã hiển thị, số tai, giống, giới tính, tuổi, chuồng, trạng thái đàn, sức khỏe, sinh sản |
| 3 | Open profile / Mở hồ sơ | Nút | Mở SCR-19 |
| 4 | Scan again / Quét lại | Nút | Xóa kết quả |
| 5 | Enter code manually / Nhập mã thủ công | Ô chữ | Mã hiển thị, số tai hoặc mã thẻ; xử lý như quét |
| 6 | Messages / Thông báo | — | MSG-FE05-05, 06, 09, 10, MSG-COM-13 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách bò | `q?, breedId?, sex?, penId?, purposeId?, lifeStage?, health? (HEALTHY\|MONITORING\|UNDER_TREATMENT\|WITHDRAWAL), herdStatus? (ACTIVE\|EXIT_PENDING\|EXITED\|VOIDED\|ALL), herdGroup?, page, size, sort?` | `{header {active, exited}, groupCounts {all, breedingFemales, youngStock, fattening, calves, sires, other, exited}, items[{cattleId, displayCode, name, breed, sex, ageText, ageEstimated, pen, purpose, purposeType, lifeStage, latestWeight {kg, date, estimated}, exitPending?, herdStatus, exitInfo?, health?, withdrawalUntil?, contagious, reproStatus?, dueSoon}], total}` | COM-03 | `GET /api/farms/{farmId}/cattle` |
| A2 | Hồ sơ (Tổng quan) | — | Mọi trường SCR-19: `identity, individual, entrySource, declaration, purpose {value, type, since}, lifeStage {value, since, suggestion?}, pen {code, name, since}, dam, sire, careSummary {latestWeight, adg90, bcs, health {state, openCases[], chronicCases[], contagious}, withdrawalUntil, repro {status, eligible, failedConditions[], expectedCalving}, overdueDoses}, reminders[≤5], badges[], allowedActions[], version` (không có Internal ID trong giao diện; có trường riêng cho "Sao chép") | COM-08 | `GET /api/farms/{farmId}/cattle/{id}` |
| A3 | Cập nhật hồ sơ | `group: IDENTIFICATION\|PURPOSE\|LIFE_STAGE`, các trường của nhóm, `effectiveDate?, reason?, confirmReproEnd?, version` + `Idempotency-Key` | A2 | FE05-02, FE05-03, FE05-11 (cần xác nhận), FE05-12, FE18-08, COM-06, COM-07, COM-15, COM-13, COM-17, COM-05, COM-02 | `PUT /api/farms/{farmId}/cattle/{id}/profile` |
| A4 | Tải / xóa ảnh | File (multipart) + `expectedVersion` + `Idempotency-Key` | `{photoUrl}` | COM-10 (loại / dung lượng) | `POST` / `DELETE /api/farms/{farmId}/cattle/{cattleId}/photo` |
| A5 | Lịch sử thẻ | — | `[{tagCode, status, issuedAt, issuedBy, endedAt, reason, note}]` | COM-08 | `GET /api/farms/{farmId}/cattle/{id}/qr-tags` |
| A6 | Cấp / thay thẻ | `reason? (LOST\|DAMAGED\|OTHER), tagCode? (thẻ in sẵn), note?, version` + `Idempotency-Key` | `{tagCode, status, issuedAt, displayCode, qrPayload}` | FE12-08, COM-06, COM-13, COM-05, COM-02 | `POST /api/farms/{farmId}/cattle/{id}/qr-tags` |
| A7 | Nhận diện mã quét / nhập tay | `code` | Thành công: thẻ tóm tắt `{cattleId, displayCode, earTag, breed, sex, ageText, pen, herdStatus, health, reproStatus, replacedTagNotice?}`; bò trại khác có quyền: `{otherFarm {farmId, farmName}}` (không có dữ liệu bò); không hợp lệ: MSG-FE05-09 | FE05-09, FE05-10, COM-13 | `GET /api/farms/{farmId}/cattle/resolve?code=` |
| A8 | Lịch sử chuồng (SCR-20) | — | xem FE-04 A8 | | `GET …/cattle/{cattleId}/pen-history` |
| A9 | Lịch sử thay đổi hồ sơ | — | `[{fieldGroup, oldValue, newValue, effectiveDate, reason, changedBy, changedAt}]` | COM-08 | chưa có riêng – hiện qua dòng thời gian FE-16 (Q2) |

**Nội dung mã QR in trên thẻ:** chỉ chứa mã thẻ (hoặc đường dẫn ứng dụng kèm mã thẻ); không chứa dữ liệu bò (GBR-28).

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE05-01 | Toast thành công | Đã cập nhật hồ sơ {cattle_code}. |
| MSG-FE05-02 | Dưới trường | Số tai {code} đã được dùng cho một bò đang nuôi của trại. |
| MSG-FE05-03 | Trong tab | Chỉ Chủ trại mới đổi được mục đích sản xuất. |
| MSG-FE05-04 | Toast thành công | Thẻ QR {tag_code} đã kích hoạt cho {cattle_code}. |
| MSG-FE05-05 | Kết quả quét | Thẻ này đã được thay ngày {date}. Thẻ hiện tại của {cattle_code} là {tag_code}. |
| MSG-FE05-06 | Hộp thoại | Bò này thuộc {farm_name}. Chuyển sang trại đó để mở? [Chuyển trại] [Hủy] |
| MSG-FE05-07 | Trong khung quét | Không dùng được camera. Hãy nhập mã bò hoặc số tai. |
| MSG-FE05-08 | Toast lỗi | Đã lưu thẻ nhưng chưa in được. Hãy in lại từ tab Thẻ QR. |
| MSG-FE05-09 | Kết quả quét | Mã này không phải thẻ bò của trại bạn được truy cập. |
| MSG-FE05-10 | Kết quả quét | Thẻ này thuộc một con bê đang chờ đăng ký. Có thể đăng ký bằng phiếu nhập bê sinh tại trại. |
| MSG-FE05-11 | Hộp thoại xác nhận | Sau thay đổi này {cattle_code} sẽ không còn được theo dõi sinh sản. Lịch sử sinh sản được giữ lại. Tiếp tục? |
| MSG-FE05-12 | Dưới trường | {purpose} là mục đích loại {purpose_type}, chỉ dùng cho bò {sex}. Hãy chọn mục đích Vỗ béo, Chưa xác định, hoặc mục đích phù hợp giới tính. |
| MSG-FE12-08, MSG-FE18-08, MSG-COM-13, 15, 17, 18 | | Xem bảng của feature tương ứng |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-05-01 | Bò cái ADULT, BREEDING | Tính nhóm đàn | Bò cái sinh sản | U | R-05-06 |
| TC-05-02 | Bò cái WEANED_CALF, BREEDING | Tính nhóm | Bê (giai đoạn bê được xét trước) | U | R-05-06 |
| TC-05-03 | Bò đực ADULT, FATTENING | Tính nhóm | Vỗ béo | U | R-05-06 |
| TC-05-04 | Bò đực ADULT, SIRE | Tính nhóm | Đực giống | U | R-05-06 |
| TC-05-05 | Bò cái YOUNG_STOCK, BREEDING | Tính nhóm | Bò tơ | U | R-05-06 |
| TC-05-06 | Bò cái ADULT, UNDECIDED | Tính nhóm | Khác | U | R-05-06 |
| TC-05-07 | Trại 20 bò ACTIVE, 3 EXITED, 2 VOIDED | Mở SCR-18 | Tiêu đề "20 đang nuôi · 3 đã xuất"; tổng các tab nhóm (trừ Đã xuất) = 20; tab Khác luôn hiện | I, E | SCR-18 |
| TC-05-08 | Bò A số tai `T-01` ACTIVE | Đặt số tai bò B = `T-01` | MSG-FE05-02 | I | R-05-02 |
| TC-05-09 | Bò A số tai `T-01` đã EXITED | Đặt bò B = `T-01` | Được | I | R-05-02 |
| TC-05-10 | Popup | Số tai 31 ký tự; tên 51; màu 256; ghi chú 1.001; ảnh 6 MB / GIF | MSG-COM-10 từng trường | U, H | Popup |
| TC-05-11 | Manager | Gửi đổi mục đích | 403 / MSG-FE05-03 | H | R-05-03 |
| TC-05-12 | Bò đực | Owner chọn mục đích loại BREEDING | MSG-FE05-12 | I | R-05-04 |
| TC-05-13 | Bò cái | Owner chọn mục đích loại FATTENING | Được | I | R-05-04 |
| TC-05-14 | Bò nhập ngày 10/10 | Đổi giai đoạn ngày hiệu lực 09/10 / ngày mai | MSG-COM-15 / MSG-COM-07 | I | R-05-05 |
| TC-05-15 | Đổi giai đoạn hợp lệ | — | Giá trị mới; 1 bản ghi lịch sử (cũ, mới, ngày, lý do, người); nhóm đàn tính lại; chuồng, sức khỏe không đổi | I | R-05-07 |
| TC-05-16 | Bò cái ADULT BREEDING, không có thai OPEN | Owner đổi sang FATTENING | Hỏi MSG-FE05-11; xác nhận → sinh sản "Không áp dụng"; lịch sử sinh sản còn | I, E | R-05-08 |
| TC-05-17 | Có REM-08 gợi ý chuyển sang Bò tơ | Mở từ gợi ý | Tab Giai đoạn điền sẵn Bò tơ, ngày đạt ngưỡng, lý do; lưu → REM-08 được giải quyết | I, E | R-05-09 |
| TC-05-18 | Có REM-08 | Không làm gì | Giai đoạn không tự đổi | I | R-05-09 |
| TC-05-19 | Mục đích đã ngưng | Chọn | MSG-FE18-08 | I | R-05-11 |
| TC-05-20 | Bò EXITED | Cập nhật hồ sơ / cấp thẻ | MSG-COM-13 | I | R-05-10 |
| TC-05-21 | Bò trên phiếu chết PENDING | Cập nhật hồ sơ | MSG-COM-17; nút bị ẩn trên SCR-19 | I, E | R-05-10, R-05-16 |
| TC-05-22 | Bò có thẻ ACTIVE `Q1` | Thay thẻ, lý do Mất | `Q1` REPLACED (lý do LOST), `Q2` ACTIVE; mã hiển thị không đổi; đúng 1 thẻ ACTIVE | I | R-05-12 |
| TC-05-23 | Như trên | Thay thẻ không chọn lý do | MSG-COM-06 | I | R-05-12 |
| TC-05-24 | Bò chưa có thẻ | Cấp lần đầu | Không hỏi lý do; lịch sử ghi "Cấp lần đầu" | I | UC-04 AF1 |
| TC-05-25 | Nhập mã thẻ in sẵn trùng thẻ khác | Xác nhận | MSG-FE12-08 | I | R-05-12 |
| TC-05-26 | Lưu thẻ xong, máy in lỗi | — | MSG-FE05-08; thẻ vẫn ACTIVE; in lại được | E | R-05-13 |
| TC-05-27 | Quét `Q1` (đã thay) | — | Mở đúng bò, MSG-FE05-05 có mã `Q2` | I | R-05-15 |
| TC-05-28 | Người dùng là thành viên trại A, B; đang ở A | Quét thẻ bò của B | MSG-FE05-06; response không có dữ liệu bò; đồng ý → chuyển B → mở hồ sơ | H, E | R-05-14 |
| TC-05-29 | Người dùng chỉ thuộc trại A | Quét thẻ bò của C | MSG-FE05-09; response không có dữ liệu bò | H | R-05-14 |
| TC-05-30 | Quét mã VietQR thanh toán | — | MSG-FE05-09 | H | R-05-14 |
| TC-05-31 | Quét mã của bê nháp | — | MSG-FE05-10 | I | R-05-15 |
| TC-05-32 | Bò EXITED | Quét | Mở hồ sơ chỉ đọc + MSG-COM-13 | E | R-05-15 |
| TC-05-33 | Nhập thủ công số tai `T-01` | — | Như quét thẻ của bò đó | I | UC-05 AF1 |
| TC-05-34 | Từ chối quyền camera | Mở SCR-22 | MSG-FE05-07, hiện ô nhập thủ công | E | UC-05 E1 |
| TC-05-35 | Technician | Mở hồ sơ | Không có nút Cập nhật, Cấp lại QR, Chuyển chuồng, In thẻ | E | R-05-16 |
| TC-05-36 | Bò mua có khai báo "không rõ" về tiêm | Mở hồ sơ | Hiện "Không rõ" (không hiện như "Không") | E | SCR-19 |
| TC-05-37 | Ngày sinh ước tính | Danh sách / hồ sơ | Tuổi có "~"; hồ sơ có "(ước tính)" | E | SCR-18, SCR-19 |
| TC-05-38 | Bò VOIDED | Mở hồ sơ | Chỉ huy hiệu "Nhập nhầm – đã hủy" + MSG-COM-18; không hiện trạng thái suy ra | E | §3.2 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Độ dài tối đa của lý do đổi mục đích / giai đoạn: SRS không ghi | 500 ký tự như các popup khác |
| Q2 | Lịch sử thay đổi hồ sơ xem ở đâu ngoài dòng thời gian? | Chỉ qua dòng thời gian (FE-16, chip "Mục đích / giai đoạn") |
| Q3 | Định dạng mã thẻ do hệ thống tạo | Chuỗi ngẫu nhiên không đoán được, không chứa mã hiển thị |
| Q4 | Đổi số tai có cần ngày hiệu lực và lý do không? (SRS chỉ bắt buộc cho mục đích, giai đoạn) | Không bắt buộc; vẫn lưu lịch sử |
| Q5 | Lọc "Chờ xuất" trong trạng thái đàn có gồm cả phiếu chết PENDING không? | Có (cả 2 loại chờ) |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho AnNT duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
