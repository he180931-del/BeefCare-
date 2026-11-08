# SPEC FE-02 – Trang trại và dịch vụ trại

| | |
|---|---|
| Feature | FE-02 Farm Workspace and Service Management |
| Use case | UC-FE02-01 → UC-FE02-05 |
| Người phụ trách | DucNV (BE + FE + test) · Review BE: TaiDX · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Farm, Farm Membership, Farm Service Change, Subscription), §3.3 (BR-D04, BR-D29), Part II §2, Part III §2 (SCR-09 → SCR-12, popup Tạm ngưng / Khôi phục), Table III-6, MSG-FE02, GBR-05, 07, 09, 11 → 15, 64, 66, 86, 88, 109 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có (`main@dec155d`) chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn tiếng Việt đối chiếu Figma tab 02 / 09.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE02-01 | Đăng ký trại | Owner | SCR-10 (→ SCR-58) |
| UC-FE02-02 | Xem và chọn trại được phép | Owner, Manager, Technician | SCR-09 |
| UC-FE02-03 | Cập nhật thông tin trại | Owner | SCR-11 |
| UC-FE02-04 | Tổng quan dịch vụ các trại | Platform Manager | SCR-12 |
| UC-FE02-05 | Tạm ngưng / khôi phục dịch vụ trại | Platform Manager | SCR-12, popup Tạm ngưng / Khôi phục |

**Liên quan, không thuộc gói:** chọn gói và thanh toán (FE-19, SCR-57/58), tham số mặc định (FE-18), danh mục khởi tạo được **tạo** ở đây nhưng **quản lý** ở FE-18 / FE-23.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician | PM | Nguồn |
|---|---|---|---|---|---|
| Đăng ký trại | Có (đã hoàn tất đăng ký Owner) | — | — | — | UC-01, GBR-05 |
| Xem danh sách trại của mình, chọn trại | Có | Có | Có | — | UC-02 |
| Vào trại không ACTIVE | Có, chỉ: thông tin trại, gói & thanh toán, hỗ trợ, hủy lời mời, ngưng thành viên | **Không** (thẻ bị khóa) | **Không** | — | GBR-14 |
| Xem / sửa thông tin trại | Có, ở mọi trạng thái dịch vụ | Không | Không | — | GBR-07, SCR-11 |
| Xem tổng quan dịch vụ các trại | — | — | — | Có (không thấy dữ liệu bò / chăm sóc) | GBR-11, SCR-12 |
| Tạm ngưng / khôi phục | — | — | — | Có | UC-05 |

Mọi request kiểm lại quyền, membership và trạng thái dịch vụ (GBR-09). Dữ liệu của trại này không bao giờ hiện trong ngữ cảnh trại khác (GBR-12).

---

## 3. Dữ liệu

### 3.1 Trại (Farm)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Farm ID | Số, hệ thống tạo | Có | Định danh duy nhất | §3.2 |
| Tên trại | Chuỗi | Có | 2–150 ký tự; **không cần duy nhất** | SCR-10 |
| Tỉnh / thành phố | Chuỗi (tên tỉnh) | Có | Một trong 34 tỉnh / thành phố trực thuộc TW (sau sáp nhập 2025); lưu tên, tên ngoài danh sách → MSG-COM-10 | SCR-10, Q3 |
| Xã / phường | Chuỗi | Có | ≤ 150 | SCR-10 |
| Địa chỉ chi tiết | Chuỗi | Không | ≤ 255 | SCR-10 |
| Người liên hệ | Chuỗi | Không | ≤ 100; mặc định họ tên Owner | SCR-10 |
| SĐT liên hệ | Chuỗi | Không | `0` + 9 số hoặc `+84` + 9 số; mặc định SĐT Owner | SCR-10 |
| Thông tin giấy đăng ký | Chuỗi | Không | ≤ 255 (số, nơi cấp, ngày cấp) | SCR-10 |
| Quy mô dự kiến | Enum | Không | `UNDER_50`, `50_149`, `150_300`, `OVER_300` | SCR-10 |
| Giống chính | Danh sách giống khởi tạo | Không | Chọn nhiều từ Table III-6 | SCR-10, GBR-109 |
| Múi giờ | Chuỗi IANA | Có | Mặc định `Asia/Ho_Chi_Minh` | SCR-11, GBR-66 |
| Giờ bắt đầu ca sáng | Giờ `HH:mm` | Không | — | SCR-11 |
| Ghi chú vận hành | Chuỗi dài | Không | ≤ 1.000 | SCR-11 |
| Cờ tạm ngưng | Boolean (+ ngày, PM) | Có | Mặc định `false` | §3.2 |
| Trạng thái dịch vụ | Enum **suy ra** | — | `PENDING_PAYMENT`, `ACTIVE`, `EXPIRED`, `SUSPENDED` (mục 4) | GBR-13 |
| Thời điểm tạo | Thời điểm | Có | — | §3.2 |

Không bao giờ xóa trại đã có lịch sử.

### 3.2 Thành viên trại (Farm Membership)

| Thuộc tính | Ràng buộc | Nguồn |
|---|---|---|
| Tài khoản + trại | Cặp duy nhất (BR-D04) | §3.2 |
| Vai trò | `OWNER`, `MANAGER`, `TECHNICIAN`; **đúng 1 OWNER mỗi trại**, tạo cùng trại, không bao giờ đổi | §3.2, BR-D04 |
| Trạng thái | `ACTIVE ⇄ INACTIVE` (chỉ Owner thao tác, ở FE-03) | §3.2 |
| Lời mời nguồn, thời điểm tham gia, lần đổi cuối (ngày hiệu lực, lý do) | — | §3.2 |

### 3.3 Lịch sử thay đổi dịch vụ (Farm Service Change)

| Thuộc tính | Ràng buộc |
|---|---|
| Trại, hành động (`SUSPEND` / `RESTORE`), trạng thái trước, trạng thái sau, lý do (≤ 500), PM, thời điểm | Bất biến sau khi lưu; sắp theo thời gian; Owner được thông báo sau mỗi lần |

### 3.4 Dữ liệu tạo kèm khi đăng ký trại (GBR-109, Table III-6)

| Nhóm | Tạo gì |
|---|---|
| Tham số trại | Phiên bản 1 với giá trị mặc định (chi tiết ở FE-18) |
| Mục đích sản xuất | 4 mục, mỗi loại một mục, ACTIVE |
| Giống | Các giống phổ biến ở Việt Nam (gồm "Zebu đỏ"); giống được chọn làm giống chính → ACTIVE, còn lại INACTIVE |
| Vắc-xin | Theo bệnh, để trống liều và đường dùng (bổ sung từ nhãn) |
| Thức ăn | Các loại thông dụng, chưa có tồn kho |
| Thuốc tham chiếu | **Không** tạo sẵn |

Danh mục khởi tạo thuộc riêng trại đó; sửa không ảnh hưởng trại khác.

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-02-01 | Chỉ tài khoản đã hoàn tất đăng ký Owner mới đăng ký trại; chưa xong → MSG-FE02-02 và mở SCR-07. | GBR-05, UC-01 E1 |
| R-02-02 | Một lần đăng ký tạo tối đa một trại: gửi lặp / tải lại trang với cùng khóa yêu cầu trả lại trại đã tạo, không tạo trại hay membership thứ hai. | GBR-88, UC-01 AF2 |
| R-02-03 | Đăng ký trại tạo **trong một transaction**: trại `PENDING_PAYMENT`, múi giờ `Asia/Ho_Chi_Minh`, membership OWNER, tham số mặc định, danh mục khởi tạo, bản ghi audit. Lỗi ở bất kỳ phần nào → không tạo gì. | UC-01 bước 4, E3 |
| R-02-04 | Đăng ký trại **không** tạo subscription, yêu cầu thanh toán hay kỳ dịch vụ; các trại khác của Owner không đổi. | UC-01 POST-3 |
| R-02-05 | Trạng thái dịch vụ suy ra: `SUSPENDED` khi có cờ tạm ngưng (bất kể thanh toán); nếu không: `PENDING_PAYMENT` từ lúc đăng ký đến khi có thanh toán đầu tiên được chấp nhận; `ACTIVE` khi có kỳ đã mua bao phủ thời điểm hiện tại; `EXPIRED` khi đã hết. | GBR-13 |
| R-02-06 | Thao tác nghiệp vụ trại yêu cầu `ACTIVE`. Khi không ACTIVE, Owner vẫn: chọn trại, xem / sửa thông tin trại, quản lý gói và thanh toán, gửi hỗ trợ, hủy lời mời đang chờ, ngưng thành viên. Manager / Technician không vào được. | GBR-14 |
| R-02-07 | Tạm ngưng và thanh toán độc lập: thanh toán không gỡ tạm ngưng; khôi phục không tạo hay kéo dài kỳ dịch vụ. Sau khôi phục, trạng thái suy ra lại theo R-02-05. | GBR-15 |
| R-02-08 | Tạm ngưng chỉ khi trại chưa SUSPENDED; khôi phục chỉ khi đang SUSPENDED; cả hai bắt buộc lý do. Đã ở trạng thái yêu cầu → MSG-FE02-09, không tạo bản ghi mới. | UC-05 PRE-2, E3 |
| R-02-09 | Tạm ngưng / khôi phục lưu cờ, bản ghi lịch sử dịch vụ và audit trong cùng transaction; sau đó thông báo Owner (JOB-07). Lỗi gửi thông báo không làm mất thay đổi; gửi lại không trùng. | UC-05 bước 5–6, GBR-64, GBR-86, BR-D29 |
| R-02-10 | Sau tạm ngưng, thành viên mất quyền thao tác trại ở **request kế tiếp**. | UC-05 POST-1, GBR-09 |
| R-02-11 | PM chỉ thấy thông tin dịch vụ (tên trại, Owner, trạng thái, hạn, tạm ngưng, số bò ACTIVE); không thấy dữ liệu bò, chăm sóc, sinh sản. | GBR-11, SCR-12 |
| R-02-12 | Đổi trại hiện tại: xóa dữ liệu và bộ lọc của trại trước rồi mới đặt trại mới. | UC-02 bước 5 |
| R-02-13 | Ngày giờ của trại tính theo múi giờ trại. | GBR-66 |

---

## 5. Luồng xử lý

### UC-FE02-01 Đăng ký trại
1. Hệ thống hiện SCR-10 (bước 2 của onboarding).
2. Owner nhập tên trại, tỉnh, xã, và tùy chọn: địa chỉ chi tiết, người liên hệ, SĐT, giấy đăng ký, quy mô, giống chính → **Tạo trại và tiếp tục**.
3. Hệ thống kiểm tra trường và khóa yêu cầu (R-02-02).
4. Tạo trại theo R-02-03.
5. MSG-FE02-01 → mở SCR-58 chọn gói cho trại vừa tạo.

AF1 bấm "Để sau" ở SCR-58 → trại ở `PENDING_PAYMENT`, hiện ở SCR-09 với nút "Thanh toán để kích hoạt" · AF2 gửi lặp → trả trại đã tạo · AF3 quay lại / hủy trước bước 2 → không tạo gì.
E1 chưa hoàn tất đăng ký Owner → MSG-FE02-02 · E2 thiếu / sai trường → MSG-COM-06 / MSG-COM-10 · E3 lỗi lưu → MSG-COM-02.

### UC-FE02-02 Xem và chọn trại
1. Mở SCR-09.
2. Hệ thống liệt kê mọi trại mà người dùng có membership ACTIVE (thẻ: tên, địa chỉ, trạng thái dịch vụ, vai trò, số bò ACTIVE, ngày hết dịch vụ). Owner thấy thêm trại của mình đang `PENDING_PAYMENT`, `EXPIRED`, `SUSPENDED`.
3. Bấm **Vào trại** ở trại ACTIVE.
4. Hệ thống kiểm lại membership, vai trò, trạng thái dịch vụ.
5. Xóa dữ liệu trại trước, đặt trại hiện tại, mở trang chủ: Owner / Manager → SCR-48, Technician → SCR-74.

AF1 Owner chọn trại `PENDING_PAYMENT` / `EXPIRED` → nút "Thanh toán để kích hoạt" / "Gia hạn", mở SCR-57 kèm MSG-FE02-03 · AF2 Owner chọn trại `SUSPENDED` → nút "Gửi phiếu hỗ trợ", MSG-FE02-03 · AF3 Manager / Technician ở trại không ACTIVE → thẻ bị khóa, MSG-FE02-04 · AF4 chỉ có 1 trại khả dụng → mở thẳng · AF5 không có trại → MSG-FE01-15; Owner thấy "Đăng ký trại mới".
E1 membership bị ngưng / đổi vai trò sau khi danh sách đã hiện → MSG-COM-01 và tải lại danh sách · E2 lỗi tải → MSG-COM-03.

### UC-FE02-03 Cập nhật thông tin trại
Owner mở SCR-11 (ở mọi trạng thái dịch vụ) → sửa nhóm "Đăng ký và liên hệ", "Vận hành" → **Lưu thay đổi** → kiểm tra → lưu → MSG-FE02-05. Khối "Tóm tắt dịch vụ" chỉ đọc. Manager / Technician không truy cập được (MSG-COM-01). Sửa đồng thời → MSG-COM-05.

### UC-FE02-04 Tổng quan dịch vụ các trại (PM)
PM mở SCR-12 → ô đếm theo trạng thái (bấm để lọc), tìm theo tên trại / email Owner, lọc trạng thái, danh sách có sắp xếp → hành động Tạm ngưng / Khôi phục, Xem gói (SCR-61). Không có dữ liệu → MSG-COM-04.

### UC-FE02-05 Tạm ngưng / khôi phục
1. PM bấm Tạm ngưng hoặc Khôi phục.
2. Popup hiện trại, Owner, trạng thái hiện tại, kỳ đã mua; khi khôi phục còn hiện trạng thái sau khôi phục và lý do tạm ngưng trước.
3. PM nhập lý do, xác nhận (MSG-FE02-06 / MSG-FE02-07).
4. Hệ thống kiểm lại quyền PM, trạng thái trại, version.
5. Lưu theo R-02-09, suy ra trạng thái mới.
6. Thông báo Owner, MSG-FE02-08.

AF1 Hủy → không đổi · AF2 khôi phục khi không có kỳ hiện tại → `EXPIRED` hoặc `PENDING_PAYMENT`, không phải `ACTIVE`.
E1 không phải PM ACTIVE → MSG-COM-01 · E2 lý do trống → MSG-COM-06 · E3 đã ở trạng thái yêu cầu → MSG-FE02-09 · E4 sửa đồng thời → MSG-COM-05 · E5 lỗi lưu → MSG-COM-02 · E6 lỗi thông báo → giữ thay đổi, gửi lại không trùng.

---

## 6. Màn hình và trường

### SCR-09 Chọn trại

| # | Trường (SRS / VN) | Loại | Ràng buộc / Nội dung | Hành vi |
|---|---|---|---|---|
| 1 | User / Người dùng | Chữ chỉ đọc | Họ tên, email; link đăng xuất | — |
| 2 | Register new farm / Đăng ký trại mới | Nút (chỉ Owner) | — | Mở SCR-10; mở SCR-07 trước nếu chưa xong đăng ký Owner |
| **Thẻ trại (mỗi trại một thẻ)** | | | | |
| 3 | Farm name, address / Tên trại, địa chỉ | Chữ | Xã, tỉnh | — |
| 4 | Service status / Trạng thái dịch vụ | Huy hiệu | ACTIVE, PENDING_PAYMENT, EXPIRED, SUSPENDED | — |
| 5 | Your role / Vai trò của bạn | Chữ | Chủ trại / Quản lý / Kỹ thuật viên | — |
| 6 | Herd size / Số bò | Số | Số bò ACTIVE | — |
| 7 | Service / Dịch vụ | Chữ | "Đến dd/mm/yyyy", "Chưa có kỳ dịch vụ" hoặc "Đang tạm ngưng" | — |
| 8 | Card action / Nút trên thẻ | Nút | Theo bảng dưới | — |

| Vai trò + trạng thái | Nút | Đi đến |
|---|---|---|
| Bất kỳ + ACTIVE | Vào trại | SCR-48 (Owner, Manager) / SCR-74 (Technician) |
| Owner + PENDING_PAYMENT | Thanh toán để kích hoạt | SCR-58 |
| Owner + EXPIRED | Gia hạn | SCR-58 |
| Owner + SUSPENDED | Gửi phiếu hỗ trợ | SCR-65 |
| Manager / Technician + không ACTIVE | Thẻ bị khóa, "Chủ trại quản lý gói dịch vụ" | MSG-FE02-04 |

### SCR-10 Đăng ký trại

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Onboarding steps / Các bước | Thanh bước chỉ đọc | — | ✓ Hồ sơ · 2 Trại · 3 Gói | — | — |
| 2 | Farm name / Tên trại | Ô chữ | * | 2–150, không cần duy nhất | Trống | MSG-COM-06, MSG-COM-10 |
| 3 | Province / City / Tỉnh / Thành phố | Dropdown | * | Danh mục tỉnh / thành VN | Trống | MSG-COM-06 |
| 4 | Commune / Ward / Xã / Phường | Ô chữ | * | ≤ 150 | Trống | MSG-COM-06, MSG-COM-10 |
| 5 | Detailed address / Địa chỉ chi tiết | Ô chữ | — | ≤ 255 | Trống | MSG-COM-10 |
| 6 | Contact person / Người liên hệ | Ô chữ | — | ≤ 100 | Họ tên Owner | MSG-COM-10 |
| 7 | Contact phone / SĐT liên hệ | Ô chữ | — | `0` + 9 số / `+84` + 9 số | SĐT Owner | MSG-COM-10 |
| 8 | Registration certificate information / Giấy đăng ký | Ô chữ | — | ≤ 255 | Trống | MSG-COM-10 |
| 9 | Expected herd size / Quy mô dự kiến | Dropdown | — | Dưới 50 / 50–149 / 150–300 / Trên 300 con | Trống | — |
| 10 | Main breeds / Giống chính | Chọn nhiều | — | Từ giống khởi tạo (Table III-6) | Trống | — |
| 11 | Back / Quay lại | Nút | — | Về SCR-07 hoặc SCR-09 | — | — |
| 12 | Create farm and continue / Tạo trại và tiếp tục | Nút | — | Gửi kèm khóa yêu cầu | — | MSG-FE02-02, MSG-COM-02; thành công MSG-FE02-01 → SCR-58 |

### SCR-11 Thông tin trại (chỉ Owner)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi / Hành vi |
|---|---|---|---|---|---|
| **Đăng ký và liên hệ** | | | | | |
| 1–7 | Tên trại*, Tỉnh*, Xã*, Địa chỉ chi tiết, Người liên hệ, SĐT, Giấy đăng ký | Như SCR-10 | Như SCR-10 | Như SCR-10 | Như SCR-10 |
| **Thông tin vận hành** | | | | | |
| 8 | Time zone / Múi giờ | Dropdown | * | Mặc định Asia/Ho_Chi_Minh; dùng cho mọi ngày của trại | — |
| 9 | Morning shift start / Giờ bắt đầu ca sáng | Giờ HH:mm | — | Dùng hiển thị nhắc việc "hôm nay" | MSG-COM-10 |
| 10 | Operating notes / Ghi chú vận hành | Ô chữ dài | — | ≤ 1.000 | MSG-COM-10 |
| 11 | Save changes / Lưu thay đổi | Nút | — | Kèm version | MSG-COM-05, MSG-COM-02; thành công MSG-FE02-05 |
| **Tóm tắt dịch vụ (chỉ đọc)** | | | | | |
| 12 | Service status / Trạng thái dịch vụ | Huy hiệu | — | — | — |
| 13 | Current period until / Kỳ hiện tại đến | Ngày | — | dd/mm/yyyy hoặc "—" | — |
| 14 | Renewal opens from / Mở gia hạn từ | Ngày | — | 90 ngày trước ngày hết đã xác nhận cuối cùng (GBR-71) | — |
| 15 | Suspended / Tạm ngưng | Chữ | — | Không / Có kèm ngày | — |
| 16 | Days remaining / Số ngày còn lại | Số | — | Đến hết kỳ hiện tại | — |
| 17 | View subscription / Xem gói dịch vụ | Link | — | — | Mở SCR-57 |
| 18 | Owner / Chủ trại | Chữ | — | Email Owner | — |

### SCR-12 Tổng quan dịch vụ các trại (PM)

| # | Trường | Loại | Nội dung | Hành vi |
|---|---|---|---|---|
| 1 | Summary tiles / Ô tổng hợp | 5 ô | Tổng số trại, ACTIVE (kèm %), PENDING_PAYMENT, EXPIRED, SUSPENDED | Bấm ô → lọc danh sách |
| 2 | Search farm / Owner / Tìm trại / chủ trại | Ô chữ | Khớp tên trại hoặc email Owner | — |
| 3 | Service status / Trạng thái | Dropdown | Tất cả, ACTIVE, PENDING_PAYMENT, EXPIRED, SUSPENDED | — |
| 4 | Farm / Trại | Cột | Tên trại (sắp xếp được) | — |
| 5 | Owner / Chủ trại | Cột | Tên Owner | — |
| 6 | Service / Dịch vụ | Cột | Huy hiệu (sắp xếp được) | — |
| 7 | Coverage end / Hết hạn | Cột | Ngày hết đã xác nhận cuối hoặc "—" (sắp xếp được) | — |
| 8 | Suspended / Tạm ngưng | Cột | Không / Có · ngày | — |
| 9 | Herd size / Số bò | Cột | Số bò ACTIVE | — |
| 10 | Actions / Thao tác | Nút | "Tạm ngưng" hoặc "Khôi phục"; "Xem gói" | Popup; SCR-61 |

### Popup Tạm ngưng / Khôi phục dịch vụ

| # | Trường | Loại | Bắt buộc | Ràng buộc | Hiện khi |
|---|---|---|---|---|---|
| 1 | Farm / Trại | Chỉ đọc | — | Tên trại, Owner, số bò | Luôn |
| 2 | Current status / Trạng thái hiện tại | Huy hiệu | — | — | Luôn |
| 3 | Suspended since / Tạm ngưng từ | Chỉ đọc | — | Ngày và PM | Khôi phục |
| 4 | Previous suspension reason / Lý do tạm ngưng | Chỉ đọc | — | — | Khôi phục |
| 5 | Purchased period / Kỳ đã mua | Chỉ đọc | — | Kèm ghi chú "không thay đổi" | Luôn |
| 6 | Status after restore / Trạng thái sau khôi phục | Chỉ đọc | — | Suy ra từ subscription | Khôi phục |
| 7 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | Luôn |
| 8 | Cancel / Suspend service / Restore service – Hủy / Tạm ngưng / Khôi phục | Nút | — | Xác nhận MSG-FE02-06 / 07; thành công MSG-FE02-08; lỗi MSG-COM-06, MSG-FE02-09, MSG-COM-05, MSG-COM-02 | Luôn |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Đăng ký trại | `name, province, commune, detailedAddress?, contactPerson?, contactPhone?, registrationCertificateInfo?, expectedHerdSize?, mainBreedCodes[]?` + header `Idempotency-Key`; trường tùy chọn để chuỗi rỗng = không nhập | Trại (A3) | FE02-02, COM-06, COM-10, COM-02 | `POST /api/farms` |
| A2 | Danh sách trại của tôi | — | `[{farmId, name, commune, province, serviceStatus, myRole, activeCattle, serviceEndDate?, actions[]}]` | COM-03 | `GET /api/farms` |
| A3 | Chi tiết thông tin trại | — | Mọi thuộc tính mục 3.1 + `serviceSummary {status, currentPeriodEnd, renewalOpensFrom, suspended, suspendedAt, daysRemaining}, ownerEmail, version` | COM-01 | `GET /api/farms/{farmId}` |
| A4 | Sửa thông tin trại | Các trường SCR-11 + `version` + `Idempotency-Key` | A3 | COM-01, COM-05, COM-06, COM-10, COM-02 | `PUT /api/farms/{farmId}` |
| A5 | Chọn trại (ngữ cảnh) | — | `{farmId, name, myRole, serviceStatus, timeZone, allowedAreas[]}` | COM-01, FE02-04 | `GET /api/farms/{farmId}/context` |
| A6 | Tổng quan dịch vụ (PM) | `q?, status?, page, size, sort?` | `{tiles {total, active, activePercent, pendingPayment, expired, suspended}, items[{farmId, name, ownerName, ownerEmail, serviceStatus, coverageEnd, suspended, suspendedAt, activeCattle}], total}` | COM-01 | `GET /api/platform/farms` |
| A7 | Xem trước popup | — | `{farm, ownerName, activeCattle, currentStatus, suspendedSince, suspendedBy, previousReason, purchasedPeriod, statusAfterRestore, version}` | COM-01 | chưa có riêng – thêm `GET /api/platform/farms/{farmId}` |
| A8 | Tạm ngưng | `reason, version` + `Idempotency-Key` | `{farmId, serviceStatus, suspended, suspendedAt}` | COM-01, COM-06, FE02-09, COM-05, COM-02 | `POST /api/platform/farms/{farmId}/suspend` |
| A9 | Khôi phục | `reason, version` + `Idempotency-Key` | như A8 | như A8 | `POST /api/platform/farms/{farmId}/restore` |

---

## 8. Thông báo

| Mã | Kiểu | Khi nào | Nội dung VN (đề xuất) |
|---|---|---|---|
| MSG-FE02-01 | Toast thành công | Đăng ký trại xong | Đã đăng ký trại {farm_name}. Hãy chọn gói để kích hoạt. |
| MSG-FE02-02 | Hộp thoại | Đăng ký trại khi chưa xong hồ sơ Owner | Vui lòng hoàn tất hồ sơ Chủ trại trước khi đăng ký trại. |
| MSG-FE02-03 | Banner | Owner mở trại không ACTIVE | {farm} đang ở trạng thái {status}. Chỉ dùng được thông tin trại, gói dịch vụ và hỗ trợ. |
| MSG-FE02-04 | Trên thẻ | Manager / Technician chọn trại không ACTIVE | {farm} không khả dụng vì dịch vụ đang {status}. Vui lòng liên hệ Chủ trại. |
| MSG-FE02-05 | Toast thành công | Lưu thông tin trại | Đã cập nhật thông tin trại. |
| MSG-FE02-06 | Hộp thoại xác nhận | PM tạm ngưng | Tạm ngưng dịch vụ của {farm}? Thành viên sẽ mất quyền thao tác trại; Chủ trại vẫn dùng được gói dịch vụ và hỗ trợ. |
| MSG-FE02-07 | Hộp thoại xác nhận | PM khôi phục | Khôi phục dịch vụ của {farm}? Trạng thái sẽ theo gói dịch vụ: {new_status}. |
| MSG-FE02-08 | Toast thành công | Đã tạm ngưng / khôi phục | Dịch vụ của {farm} hiện là {status}. Đã thông báo cho Chủ trại. |
| MSG-FE02-09 | Trong hộp thoại | Đã ở trạng thái yêu cầu | {farm} đã ở trạng thái {status}. |
| MSG-FE01-15, MSG-COM-01 → 06, 10 | | Xem bảng chung (spec FE-01 mục 8) | |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-02-01 | SCR-10 | Tên trại 1 / 2 / 150 / 151 ký tự | Lỗi / OK / OK / Lỗi | U, H | SCR-10 |
| TC-02-02 | SCR-10 | Bỏ trống tỉnh hoặc xã | MSG-COM-06 | U, H | SCR-10 |
| TC-02-03 | SCR-10 | Xã 151 ký tự; địa chỉ 256; người liên hệ 101; giấy đăng ký 256 | MSG-COM-10 từng trường | U, H | SCR-10 |
| TC-02-04 | SCR-10 | SĐT `0912345678` / `+84912345678` / `12345` | OK / OK / Lỗi | U, H | SCR-10 |
| TC-02-05 | Owner đã có trại "Trại A" | Đăng ký trại tên "Trại A" | Thành công (tên không cần duy nhất) | I | SCR-10 |
| TC-02-06 | Chưa xong đăng ký Owner | Đăng ký trại | MSG-FE02-02; không tạo trại | I | R-02-01 |
| TC-02-07 | Đăng ký hợp lệ | — | 1 trại `PENDING_PAYMENT`, múi giờ `Asia/Ho_Chi_Minh`, 1 membership OWNER, tham số v1, 4 mục đích ACTIVE, giống chính ACTIVE và giống khác INACTIVE, vắc-xin không liều / đường dùng, thức ăn không tồn, 0 thuốc, 1 audit; **không** có subscription / yêu cầu thanh toán | I | R-02-03, R-02-04, GBR-109 |
| TC-02-08 | Gửi đăng ký 2 lần cùng `Idempotency-Key` | — | Cùng một trại; 1 membership | I | R-02-02 |
| TC-02-09 | Cùng key nhưng dữ liệu khác | Gửi lần 2 | Bị từ chối | I | GBR-88 |
| TC-02-10 | Lỗi khi tạo danh mục khởi tạo | Đăng ký | MSG-COM-02; không còn trại, membership hay tham số nào | I | R-02-03 |
| TC-02-11 | Người dùng có 1 trại ACTIVE + 1 trại EXPIRED (là Manager) | Mở SCR-09 | Thẻ EXPIRED bị khóa, MSG-FE02-04 | E | AF3 |
| TC-02-12 | Owner có trại SUSPENDED | Mở SCR-09 | Thẻ có nút "Gửi phiếu hỗ trợ" | E | SCR-09 |
| TC-02-13 | Owner trại EXPIRED | Vào trại, gọi API thông tin trại / gói / hỗ trợ | Được | H | R-02-06 |
| TC-02-14 | Owner trại EXPIRED | Gọi API tạo chuồng / ghi cân | Bị chặn (MSG-COM-12) | H | R-02-06 |
| TC-02-15 | Manager trại EXPIRED | Gọi bất kỳ API của trại | 403 | H | R-02-06 |
| TC-02-16 | Đang ở trại A với bộ lọc | Chuyển sang trại B | Không còn dữ liệu / bộ lọc của A | E | R-02-12 |
| TC-02-17 | Manager | Mở SCR-11 / gọi `PUT /api/farms/{id}` | MSG-COM-01 / 403 | H | GBR-07 |
| TC-02-18 | SCR-11 | Ghi chú vận hành 1.001 ký tự; giờ ca sáng `25:00` | MSG-COM-10 | U, H | SCR-11 |
| TC-02-19 | Hai người cùng mở SCR-11 | Người thứ hai lưu với version cũ | MSG-COM-05 | I | UC-03 |
| TC-02-20 | Trại ACTIVE có kỳ còn hạn | PM tạm ngưng có lý do | `SUSPENDED`; có bản ghi lịch sử + audit; Owner có thông báo | I | R-02-09 |
| TC-02-21 | Trại vừa bị tạm ngưng | Technician đang mở app gọi request kế tiếp | Bị chặn | H | R-02-10 |
| TC-02-22 | Trại SUSPENDED | Owner thanh toán thành công | Vẫn `SUSPENDED`; kỳ dịch vụ được tạo | I | R-02-07 |
| TC-02-23 | Trại SUSPENDED, kỳ còn hạn | PM khôi phục | `ACTIVE`; kỳ dịch vụ không đổi | I | R-02-07 |
| TC-02-24 | Trại SUSPENDED, chưa thanh toán bao giờ | PM khôi phục | `PENDING_PAYMENT` | I | AF2 |
| TC-02-25 | Trại SUSPENDED, kỳ đã hết | PM khôi phục | `EXPIRED` | I | AF2 |
| TC-02-26 | Trại `PENDING_PAYMENT` | PM tạm ngưng | Được (`SUSPENDED`) | I | R-02-08 |
| TC-02-27 | Trại đã SUSPENDED | PM tạm ngưng lần nữa | MSG-FE02-09; không có bản ghi mới | I | R-02-08 |
| TC-02-28 | Popup | Lý do trống; 501 ký tự | MSG-COM-06; MSG-COM-10 | U, H | Popup |
| TC-02-29 | Dịch vụ thông báo lỗi | PM tạm ngưng | Tạm ngưng vẫn lưu; thông báo gửi lại sau, chỉ 1 lần | I | R-02-09 |
| TC-02-30 | CS hoặc SA | Gọi API tạm ngưng / tổng quan | 403 | H | UC-05 E1 |
| TC-02-31 | PM | Gọi tổng quan dịch vụ | Response không có trường bò / chăm sóc nào | H | R-02-11 |
| TC-02-32 | 10 trại: 6 ACTIVE, 2 EXPIRED, 1 PENDING, 1 SUSPENDED | Mở SCR-12 | Ô: 10 / 6 (60%) / 1 / 2 / 1; bấm ô EXPIRED → 2 dòng | E | SCR-12 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | UC-FE02-03 và UC-FE02-04 không có đặc tả Part II; luồng ở mục 5 suy từ Part I và SCR-11 / 12 | Chủ dự án xác nhận |
| Q2 | Đổi múi giờ trại khi đã có dữ liệu: dữ liệu cũ hiển thị lại theo múi giờ mới? | Chỉ cho đổi khi trại chưa có bò, hoặc cảnh báo |
| Q3 | Danh mục tỉnh / thành: theo danh mục sau sáp nhập 2025 (34 tỉnh) hay 63 tỉnh cũ? | 34 tỉnh, lưu mã |
| Q4 | "Số ngày còn lại" khi đang SUSPENDED có hiện không? | Vẫn hiện (kỳ dịch vụ không đổi khi tạm ngưng) |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho DucNV duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 08/11/2026 | 28/10/2026 | Chốt Q3: tỉnh lưu **tên**, thuộc 34 tỉnh / thành (mục 3.1). A1 dùng tên trường như code (`province`, `detailedAddress`, `registrationCertificateInfo`); không đổi dữ liệu hay hành vi | DucNV |
