# SPEC FE-03 – Thành viên, vai trò và quyền

| | |
|---|---|
| Feature | FE-03 User Role and Permission Management |
| Use case | UC-FE03-01 → UC-FE03-09 |
| Người phụ trách | DucNV (BE + FE + test) · Review BE: TaiDX · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Farm Invitation, Farm Membership, Customer Support, Platform Manager, System Admin), §3.3 (BR-D04, 05, 06, 13), Part II §3, Part III §3 (SCR-13 → SCR-16, 3 popup, Table III-2), MSG-FE03, GBR-04, 06, 07, 10, 11, 14, 16, 17, 18, 77, 86; JOB-02 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 theo SRS 28/10 (quyết định D12); từ 28/11/2026 đối chiếu `docs/requirements/SRS_Report3_v1.2.txt` (D90) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 02 / 09.

> UC-FE03-01 được làm rõ theo D25 (người dùng xác nhận 11/11/2026): FE03-21
> mở popup kích hoạt lại; tài khoản SUSPENDED chưa có membership vẫn nhận lời
> mời; thông báo thành công xác nhận đã lưu và đang gửi email, không xác nhận
> email đã tới. Phần cấp quyền platform của Q4 chưa được chốt.

> UC-FE03-02 được làm rõ theo D26 (người dùng xác nhận 12/11/2026): backend +
> SCR-14, Owner xem được ở mọi trạng thái dịch vụ; PENDING mặc định, lần gửi
> cuối mới nhất trước, 20 dòng/trang, giữ lựa chọn theo trại trong phiên;
> số lượng toàn trại, hết hạn tính tại lần đọc; làm mới theo thao tác, không polling.

> UC-FE03-03 được làm rõ theo D27 (người dùng xác nhận 14/11/2026): Gửi lại
> thay link cũ bằng link mới, không giới hạn số lần; xác nhận Hủy là hộp thoại
> [Quay lại] [Hủy lời mời]; cách SCR-15 hiển thị link đã hủy để sang UC4 (Q6).

> UC-FE03-04 được làm rõ theo D28 (người dùng xác nhận 14/11/2026): link lời mời
> được giữ qua đăng nhập Google / xác minh email; SCR-07 chỉ cho tài khoản chưa có
> trại; báo Owner bằng email qua JOB-07; mở lại link đã chấp nhận hiện membership;
> lệnh Chấp nhận không dùng Idempotency-Key; link đã hủy/hết hạn báo trạng thái (Q6).

> UC-FE03-05 được làm rõ theo D29 (người dùng xác nhận 14/11/2026): Owner xem SCR-13
> ở mọi trạng thái dịch vụ (GBR-14), Manager chỉ khi ACTIVE, Technician không; tab
> Quản lý/Kỹ thuật viên chỉ người ACTIVE; thêm thời điểm tham gia; A1 trả cả danh
> sách kèm số đếm và thao tác, bỏ lý do lần đổi; bảng quyền đủ Table III-2.

> UC-FE03-06 được làm rõ theo D30 (người dùng xác nhận 14/11/2026): lưu lịch sử ở bảng
> `farm_membership_change`, audit có giá trị trước/sau; ngày hiệu lực chỉ để ghi lịch sử;
> lý do 5–500 ký tự; xác nhận cả khi kích hoạt lại; thứ tự kiểm FE03-20 trước COM-05.

> UC-FE03-07 được làm rõ theo D31 (người dùng xác nhận 14/11/2026): A9/A10 + SCR-16; hiện cả
> tài khoản chưa xác minh; tìm tên/email giữ dấu; lọc vai trò platform ACTIVE ("Không có" gồm
> vai trò đã thu hồi); xếp theo tên tiếng Việt, 20 dòng/trang; trại tham gia = membership
> ACTIVE; thêm `created_at`; bỏ SĐT khỏi phản hồi tài khoản; giờ Asia/Ho_Chi_Minh.

> UC-FE03-08 được làm rõ theo D32 (người dùng xác nhận 14/11/2026): tạm ngưng chỉ chặn đăng nhập,
> không thu hồi vai trò / membership; lịch sử ở bảng `app_user_status_change`, audit không ghi lý do;
> lý do 5–500 ký tự; khôi phục được cả tài khoản chưa xác minh; phiếu của CS về hàng đợi ngay trong
> lệnh; yêu cầu nội bộ OPEN có `needsReassignment` tính lúc đọc; A10 trả `actions[]`.

> UC-FE03-09 được làm rõ theo D33 (người dùng xác nhận 14/11/2026): quyền nền tảng là popup trên SCR-16, bỏ
> trang "Quyền nhân sự" (Q5); lịch sử ở bảng `platform_access_change` (chép audit cũ khi nâng cấp), audit không
> ghi lý do; tài khoản bị tạm ngưng chỉ còn Thu hồi, mã mới MSG-FE03-22 (Q4); SA không đổi quyền của chính
> mình; giá trị đã có → FE03-20, quyền đã đổi → COM-05; A10 trả `accessActions[]`.

> Múi giờ theo D39 (người dùng xác nhận 17/11/2026): mọi ngày giờ của FE-03 (ngày hiệu lực, hạn lời mời,
> gửi lần cuối, ngày tham gia) hiển thị và kiểm "không ở tương lai" theo UTC+07:00 cố định, đổi ngày lúc
> 17:00 UTC; mã múi giờ còn lưu ở trại không ảnh hưởng. A1 / A7 vẫn trả `timeZone`, luôn là `Asia/Ho_Chi_Minh`.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE03-01 | Gửi lời mời thành viên | Owner | SCR-13, SCR-14, popup Mời thành viên |
| UC-FE03-02 | Xem lời mời của trại | Owner | SCR-14 |
| UC-FE03-03 | Gửi lại / hủy lời mời đang chờ | Owner | SCR-14 |
| UC-FE03-04 | Chấp nhận lời mời | Người được mời | SCR-15 |
| UC-FE03-05 | Xem thành viên trại | Owner (đầy đủ), Manager (chỉ xem danh sách) | SCR-13 |
| UC-FE03-06 | Đổi vai trò / ngưng / kích hoạt lại thành viên | Owner | SCR-13, popup Đổi vai trò / Ngưng thành viên |
| UC-FE03-07 | Xem tài khoản người dùng (platform) | System Admin | SCR-16 |
| UC-FE03-08 | Tạm ngưng / khôi phục tài khoản | System Admin | SCR-16 |
| UC-FE03-09 | Quản lý quyền nhân viên platform (CS, PM, SA) | System Admin | SCR-16, popup Quyền nhân viên platform |

**Job nền:** JOB-02 (mỗi 15 phút) chuyển lời mời `PENDING` quá hạn sang `EXPIRED`.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician | SA | Nguồn |
|---|---|---|---|---|---|
| Mời, gửi lại lời mời | Có, chỉ khi trại ACTIVE | — | — | — | GBR-16 |
| Hủy lời mời đang chờ | Có, ở mọi trạng thái dịch vụ | — | — | — | UC-03 PRE-3, GBR-14 |
| Xem lời mời | Có, mọi trạng thái dịch vụ | — | — | — | SCR-14, D26 |
| Xem thành viên | Đầy đủ (kể cả tab Đã ngưng, nút thao tác), mọi trạng thái dịch vụ | Chỉ danh sách ACTIVE, không thao tác, không tab Đã ngưng, không lời mời; chỉ khi trại ACTIVE | — | — | SCR-13, Table III-2, GBR-14, D29 |
| Đổi vai trò, kích hoạt lại | Có, chỉ khi trại ACTIVE | — | — | — | GBR-18 |
| Ngưng thành viên | Có, ở mọi trạng thái dịch vụ | — | — | — | GBR-18 |
| Xem tài khoản, tạm ngưng / khôi phục, cấp quyền platform | — | — | — | Có | GBR-10 |

Không có quyền theo từng người; mỗi vai trò có bộ quyền cố định (GBR-06, Table III-2 ở mục 3.4). SA không thấy dữ liệu nghiệp vụ trại, nội dung phiếu hỗ trợ hay thông tin mật khẩu (SCR-16, GBR-11).

---

## 3. Dữ liệu

### 3.1 Lời mời (Farm Invitation)

| Thuộc tính | Kiểu | Ràng buộc | Nguồn |
|---|---|---|---|
| Trại | Tham chiếu | — | §3.2 |
| Email người nhận | Chuỗi | Định dạng email, ≤ 254; so sánh không phân biệt hoa thường | §3.2, popup Mời |
| Vai trò | Enum | `MANAGER` / `TECHNICIAN` | GBR-16 |
| Người mời | Tham chiếu tài khoản | Owner của trại | §3.2 |
| Thời điểm gửi, gửi lần cuối | Thời điểm | — | §3.2 |
| Hiệu lực | Số ngày | 3, 7 (mặc định), 14 | GBR-16 |
| Hết hạn lúc | Thời điểm | = gửi lần cuối + hiệu lực | GBR-16 |
| Trạng thái | Enum | `PENDING` → `ACCEPTED` / `CANCELLED` / `EXPIRED` (đều là cuối) | §3.2 |
| Token của link | Chuỗi | Dùng 1 lần, chỉ lưu hash | §3.2 |
| Tài khoản và membership đã chấp nhận | Tham chiếu | Có khi `ACCEPTED` | §3.2 |

Duy nhất: tối đa 1 lời mời `PENDING` cho mỗi cặp trại + email (BR-D05).

### 3.2 Thành viên trại (Farm Membership)

| Thuộc tính | Ràng buộc |
|---|---|
| Tài khoản + trại | Duy nhất (BR-D04) |
| Vai trò | `OWNER` / `MANAGER` / `TECHNICIAN`; đúng 1 OWNER mỗi trại, không đổi |
| Trạng thái | `ACTIVE ⇄ INACTIVE`; không bao giờ xóa (BR-D13) |
| Lời mời nguồn | — |
| Thời điểm tham gia (`joined_at`) | Ghi một lần khi tạo membership (đăng ký trại / chấp nhận lời mời); đổi vai trò, ngưng, kích hoạt lại không đổi (D29) |
| Lịch sử thay đổi | Bảng `farm_membership_change`, chỉ thêm: mỗi lần đổi vai trò / ngưng / kích hoạt lại lưu hành động, vai trò và trạng thái cũ / mới, ngày hiệu lực, lý do (5–500), người làm, thời điểm; cùng transaction với membership và audit (D30) |

### 3.3 Quyền nhân viên platform (CS / PM / SA)

| Thuộc tính | Ràng buộc |
|---|---|
| Tài khoản, vai trò platform, trạng thái quyền (`ACTIVE ⇄ REVOKED`), lý do, người đổi, thời điểm | Mỗi tài khoản tối đa 1 vai trò platform ACTIVE; luôn còn ít nhất 1 SA ACTIVE (BR-D06); độc lập với membership trại; lưu lịch sử mọi lần đổi |
| Lịch sử quyền (`platform_access_change`, D33) | Chỉ thêm: hành động GRANT / CHANGE / REVOKE / RESTORE, vai trò và trạng thái trước / sau (trước là trống ở lần cấp đầu), lý do (5–500), SA thực hiện, thời điểm; cùng transaction với quyền và audit. Migration `20261114000500` chép các mục audit `PLATFORM_ACCESS_*` cũ (người làm có thể trống) |

### 3.4 Bảng quyền theo vai trò trại (Table III-2 – hiển thị ở SCR-08, SCR-13, popup Mời, SCR-15)

> D41 (người dùng xác nhận 18/11/2026): Chủ trại có toàn bộ quyền của Quản lý và Kỹ thuật viên; các ô của Chủ trại ở tăng trưởng, tiêm phòng, sức khỏe, sinh sản, danh mục, nhắc việc và sổ cho ăn đổi theo. Quyền của Quản lý và Kỹ thuật viên không đổi.

| Nhóm quyền | Chủ trại | Quản lý | Kỹ thuật viên |
|---|---|---|---|
| Hồ sơ bò và thẻ QR | Quản lý (cả mục đích) | Quản lý (trừ mục đích) | Xem |
| Chuồng và chuyển chuồng | Quản lý | Quản lý | Xem |
| Phiếu nhập, thanh toán, đăng ký bê | Quản lý | Quản lý | — |
| Tăng trưởng và BCS | Ghi và sửa | Ghi và sửa | Xem |
| Tiêm phòng | Lập lịch, ghi và sửa | Lập lịch, ghi và sửa | Xem |
| Sức khỏe và điều trị | Ghi và sửa | Ghi và sửa | Xem |
| Sinh sản | Ghi và sửa | Ghi và sửa | Xem |
| Danh mục và tham số | Quản lý tất cả | Quản lý tất cả | Xem giống, vắc-xin, thuốc |
| Thông báo trại | Viết cho Quản lý và Kỹ thuật viên | Viết cho Kỹ thuật viên | Đọc thông báo nhận được |
| Nhắc việc | Xem tất cả | Xem tất cả | Xem (trừ bê nháp và thức ăn sắp hết) |
| Dashboard và báo cáo | Xem | Xem | — |
| Thành viên và vai trò | Quản lý | Xem danh sách | — |
| Phiếu xuất và thu tiền | Ghi, xác nhận, bỏ, hủy | Xem phiếu | — |
| Kho thức ăn, phiếu nhập kho, khẩu phần, danh mục thức ăn | Quản lý | Quản lý | Xem khẩu phần |
| Sổ cho ăn | Ghi và sửa | Ghi và sửa | Xem |
| Gói dịch vụ và thanh toán | Quản lý | — | — |
| Thông tin trại | Quản lý | — | — |

### 3.5 Tài khoản người dùng (User Account – SCR-16, D31)

| Thuộc tính | Ràng buộc / nguồn |
|---|---|
| Email | Duy nhất, không phân biệt hoa thường (Part I §3.2) |
| Họ tên | Có thể trống: SCR-16 hiện "Chưa có tên" và xếp theo email |
| Trạng thái | `ACTIVE ⇄ SUSPENDED` (SA, có lý do – UC8). Tạm ngưng chỉ chặn đăng nhập, không đổi vai trò platform hay membership (D32) |
| Lịch sử trạng thái | Bảng `app_user_status_change`, chỉ thêm: hành động SUSPEND / RESTORE, trạng thái trước / sau, lý do (5–500), SA thực hiện, thời điểm; cùng transaction với tài khoản và audit (D32, migration `20261114000400`) |
| Xác minh email | Đã xác minh khi có Google subject hoặc identity cùng email đã kích hoạt; tài khoản đăng ký mật khẩu chưa bấm link vẫn hiện "Chưa xác minh" (D31) |
| Cách đăng nhập | `PASSWORD` và/hoặc `GOOGLE` |
| Thời điểm tạo (`created_at`) | Ghi một lần khi tạo dòng tài khoản (D31, migration `20261114000300`) |
| Đăng nhập cuối | Giá trị mới hơn giữa lần dùng mật khẩu và lần dùng Google gần nhất; chưa có → "Chưa đăng nhập" |
| Đăng ký Chủ trại | Có / Không và thời điểm; tên các trại sở hữu |
| SĐT liên hệ | Có trong tài khoản nhưng **không** hiện ở SCR-16 và không trả trong A9/A10 (GBR-11, D31) |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-03-01 | Chỉ Owner mời, chỉ khi trại ACTIVE, chỉ vai trò Manager / Technician. | GBR-16 |
| R-03-02 | Tối đa 1 lời mời `PENDING` mỗi trại + email (không phân biệt hoa thường). Đã có → MSG-FE03-03 đề nghị Gửi lại, không tạo lời mời thứ hai. | BR-D05, UC-01 AF1 |
| R-03-03 | Email đã là thành viên ACTIVE → MSG-FE03-02. Email của thành viên INACTIVE → MSG-FE03-21 kèm membershipId/email, đề nghị Kích hoạt lại (UC-06), không gửi lời mời. Tài khoản SUSPENDED chưa có membership vẫn được mời, chưa được đăng nhập/chấp nhận khi còn bị ngưng. | UC-01 E4, AF2; D25 |
| R-03-04 | Hiệu lực tính từ lần gửi cuối. Gửi lại giữ **cùng** lời mời (email, vai trò, số ngày không đổi), đặt lại hiệu lực; link mới thay link cũ; không giới hạn số lần gửi lại. | GBR-16, D27 |
| R-03-05 | `ACCEPTED`, `CANCELLED`, `EXPIRED` là trạng thái cuối; thao tác trên đó → MSG-FE03-08. | GBR-16 |
| R-03-06 | Lời mời chưa tạo membership trước khi được chấp nhận. Lưu lời mời/audit/mail intent cùng giao dịch, sau đó gửi email; thông báo là đã tạo lời mời, email đang gửi. Lỗi gửi email: lời mời vẫn `PENDING`, retry tăng dần tối đa 24 giờ, chỉ gửi khi link còn hiệu lực. | UC-01 POST-3, AF4; JOB-07; D25 |
| R-03-07 | Chấp nhận chỉ khi: đã đăng nhập, email đã xác minh **bằng** email được mời, lời mời `PENDING` và chưa hết hạn, trại ACTIVE. Email khác → MSG-FE03-09 và **không hiện thông tin trại**. | GBR-17 |
| R-03-08 | Chấp nhận tạo đúng 1 membership; chấp nhận lặp lại (cùng token, không cần Idempotency-Key) trả membership đã có khi còn ACTIVE. Tạo membership + đổi lời mời sang `ACCEPTED` + audit + ý định email báo Owner trong một transaction; JOB-07 gửi sau. | GBR-17, GBR-64, UC-04 bước 7–8, D28 |
| R-03-09 | Chấp nhận lời mời không cấp quyền Owner hay quyền platform. | UC-04 POST-3 |
| R-03-10 | Membership OWNER không đổi, không ngưng được. | GBR-18 |
| R-03-11 | Đổi vai trò (Manager ⇄ Technician, chỉ thành viên ACTIVE), ngưng, kích hoạt lại đều cần ngày hiệu lực (mặc định hôm nay theo UTC+07:00, không ở tương lai) và lý do 5–500 ký tự không tính khoảng trắng. Ngưng luôn được phép; đổi vai trò và kích hoạt lại cần trại ACTIVE. Vai trò / trạng thái đã đúng như yêu cầu → MSG-FE03-20. Ngày hiệu lực chỉ để ghi lịch sử (Q3). | GBR-18, UC-06, Table III-1, D30 |
| R-03-12 | Thay đổi có hiệu lực từ request kế tiếp của thành viên; bản ghi người đó đã tạo giữ nguyên tác giả. Ngưng một Manager có thông báo nháp → nháp vẫn riêng tư với tác giả và không sửa được nữa. | UC-06 POST-2, AF2 |
| R-03-13 | Không bao giờ xóa membership, tài khoản. | BR-D13 |
| R-03-14 | Quyền platform chỉ do SA cấp / đổi / thu hồi / khôi phục, chỉ cho tài khoản đã tồn tại và đã xác minh email (người đó phải đăng nhập ít nhất 1 lần); chưa xác minh → MSG-FE03-18, không gửi lời mời. Tài khoản SUSPENDED chỉ được thu hồi (Cấp / Đổi / Khôi phục → MSG-FE03-22). SA không đổi / thu hồi quyền của chính mình (MSG-COM-01). Thu hồi vẫn làm được với tài khoản chưa xác minh hoặc bị tạm ngưng. | GBR-10, UC-09 E2, D33 |
| R-03-15 | Mỗi tài khoản tối đa 1 vai trò platform ACTIVE; luôn còn ít nhất 1 SA ACTIVE (SA ACTIVE = quyền SA ACTIVE trên tài khoản ACTIVE); SA không tự tạm ngưng tài khoản mình → MSG-FE03-17. Hai SA tạm ngưng nhau hoặc thu hồi quyền SA của nhau cùng lúc: lệnh sau chờ khóa dòng rồi bị từ chối (D32, D33). | BR-D06, GBR-10 |
| R-03-16 | Tạm ngưng tài khoản chặn mọi cách đăng nhập (MSG-FE01-03), phiên đang mở bị từ chối ở request kế tiếp (phiên đã đăng ký hết hạn → 401; còn lại → 403 MSG-FE01-03). Tạm ngưng không thu hồi vai trò platform hay membership; khôi phục đưa tài khoản về ACTIVE và không trả lại vai trò / membership đã bị thu hồi hoặc ngưng riêng (D32). Tạm ngưng / khôi phục được cả tài khoản chưa xác minh email. | GBR-04, D32 |
| R-03-17 | Khi một CS bị tạm ngưng hoặc mất quyền CS: phiếu hỗ trợ chưa CLOSED của họ về hàng đợi chưa giao (trạng thái phiếu không đổi; UC8 / UC9 làm ngay trong lệnh, job làm lưới an toàn). Khi người nhận PM / SA mất quyền hoặc bị tạm ngưng: yêu cầu nội bộ OPEN giao cho họ có `needsReassignment=true` (tính lúc đọc, hết khi người đó khả dụng lại) để CS đổi người nhận. | GBR-77, UC-08 bước 6, UC-09 bước 6, D32 |
| R-03-18 | Mọi thay đổi lời mời, membership, tài khoản, quyền platform đều ghi audit trong cùng transaction. | GBR-86 |
| R-03-19 | JOB-02 mỗi 15 phút chuyển `PENDING` đã quá hạn sang `EXPIRED`. Kể cả trước khi job chạy, chấp nhận lời mời đã quá hạn vẫn bị chặn. | JOB-02, GBR-17 |

---

## 5. Luồng xử lý

### UC-FE03-01 Gửi lời mời
1. Popup Mời thành viên hiện tên trại.
2. Owner nhập email, chọn vai trò, chọn hiệu lực (3 / 7 / 14 ngày, mặc định 7); hệ thống hiện bảng quyền của vai trò.
3. **Gửi lời mời** → hệ thống kiểm lại quyền Owner, trại ACTIVE, email hợp lệ, R-03-02, R-03-03.
4. Tạo lời mời `PENDING` (token lưu hash) + audit → gửi email (API-04) → MSG-FE03-01.

E1 không phải Owner → MSG-COM-01 · E2 trại không ACTIVE → MSG-FE03-04 · E3 email trống / sai → MSG-COM-06 / 10 · E4 đã là thành viên → MSG-FE03-02 · E5 lỗi lưu → MSG-COM-02.

### UC-FE03-02 Xem lời mời (D26)
1. Owner mở SCR-14 của trại mình; xem được ở mọi trạng thái dịch vụ. Vai trò khác / khác trại → MSG-COM-01.
2. Lần đầu chọn PENDING, lastSentAt giảm dần; bằng thời điểm thì id giảm dần. Giữ tab/chiều sắp xếp theo trại và tài khoản trong phiên.
3. API trả một trang 20 dòng và số lượng cả bốn trạng thái trên toàn trại. Đổi tab/chiều sắp xếp về trang đầu; cột Gửi lần cuối cho đảo tăng/giảm.
4. PENDING có expiresAt <= clock của lần đọc được hiển thị/đếm EXPIRED ngay, không đợi JOB-02. GET không ghi trạng thái hay tác dụng phụ.
5. Hiển thị đủ trường SCR-14, ngày giờ theo UTC+07:00. hasAccount phản ánh tồn tại tài khoản tại lần đọc, không tiết lộ accountStatus.
6. Tải khi vào/quay lại, đổi tab/trang/sắp xếp, sau Mời/Gửi lại/Hủy hoặc Làm mới; không polling. Rỗng → MSG-COM-04 + Xóa bộ lọc; lỗi tải → MSG-COM-03 + Thử lại.

### UC-FE03-03 Gửi lại, hủy lời mời (D27)
1. SCR-14, chỉ dòng PENDING chưa hết hạn có nút. Owner bấm **Gửi lại** (không hỏi xác nhận) hoặc **Hủy** (hộp thoại MSG-FE03-06 [Quay lại] [Hủy lời mời]; Quay lại không đổi gì).
2. Hệ thống khóa dòng lời mời rồi kiểm theo thứ tự: Owner của trại (COM-01) → trại ACTIVE, chỉ với Gửi lại (FE03-04) → lời mời thuộc trại ở URL (COM-08) → PENDING chưa hết hạn theo clock của lần gọi (FE03-08 kèm trạng thái hiện tại, kể cả khi version cũ) → version (COM-05). Lệnh bị từ chối không ghi gì; PENDING quá hạn chỉ được báo EXPIRED, JOB-02 vẫn chuyển trạng thái lưu.
3. **Gửi lại**: cùng lời mời, email, vai trò, số ngày; gửi lần cuối = now, hạn = now + số ngày; token mới, link cũ hết tác dụng; bỏ email cũ chưa gửi và xếp email mới (retry tối đa 24 giờ) + audit trước/sau → MSG-FE03-05. Không giới hạn số lần.
4. **Hủy** (mọi trạng thái dịch vụ): `CANCELLED`, ghi thời điểm hủy, xóa hash link, bỏ email chưa gửi + audit → MSG-FE03-07. Không tạo membership.
5. Thành công: tải lại danh sách. Lỗi FE03-08 / FE03-04 / COM-05 / COM-08: hiện lý do (FE03-08 kèm trạng thái), đóng hộp thoại, tải lại danh sách; không tự thử lại bằng version mới. Lỗi lưu / mạng: giữ hộp thoại và cùng Idempotency-Key để thử lại.

E1 không phải Owner → MSG-COM-01 · E2 lời mời không còn `PENDING` → MSG-FE03-08 · E3 gửi lại khi trại không ACTIVE → MSG-FE03-04 · E4 sửa đồng thời → MSG-COM-05 · E5 lỗi lưu → MSG-COM-02.

### UC-FE03-04 Chấp nhận lời mời (D28)
1. Mở link từ email.
2. Chưa đăng nhập → đăng nhập / đăng ký (FE-01) bằng email được mời; trình duyệt nhớ link (24 giờ) và mở lại sau đăng nhập bằng mật khẩu, Google hoặc sau xác minh email.
3. Hệ thống kiểm theo thứ tự: link tồn tại (không → MSG-FE03-08 `INVALID`) → email đăng nhập bằng email được mời (không → MSG-FE03-09, không lộ trại/trạng thái) → trạng thái và hạn (MSG-FE03-08 kèm trạng thái, hạn) → trại ACTIVE (MSG-FE03-04) → hiện SCR-15 với trại, vai trò, người mời, gửi lần cuối, hạn (UTC+07:00), hai email, quyền của vai trò.
4. **Chấp nhận và vào trại** → kiểm lại (khóa dòng lời mời) → R-03-08 → MSG-FE03-10 → vào trại qua kiểm tra của SCR-09 (quyền, dịch vụ) → trang chủ theo vai trò (Manager: SCR-48, Technician: SCR-74) với phiên được tải lại.

AF1 **Để sau** → lời mời vẫn `PENDING`, mở SCR-09 · AF2 mở lại link sau khi đã chấp nhận → cùng email và membership còn ACTIVE thì hiện "đã tham gia" + Vào trại; membership đã ngưng → MSG-FE03-08 (ACCEPTED).
Tài khoản chưa đăng ký Chủ trại nhưng đã có trại (Manager/Technician) vào trại của mình; SCR-07 chỉ là đích khi chưa có trại và chưa có vai trò platform (UC-FE01-02 AF4).
E1 lời mời hết hạn / hủy / đã dùng / link sai → trạng thái "Lời mời không còn hiệu lực" (MSG-FE03-08) · E2 email khác → MSG-FE03-09 · E3 trại không ACTIVE → MSG-FE03-04, lời mời vẫn `PENDING` · E4 tài khoản bị tạm ngưng → không đăng nhập được.

### UC-FE03-05 Xem thành viên (D29)
1. Owner mở SCR-13 của trại mình ở mọi trạng thái dịch vụ; Manager chỉ khi trại ACTIVE (không → MSG-COM-12); Technician, người ngoài trại, membership INACTIVE → MSG-COM-01; tài khoản bị tạm ngưng → MSG-FE01-03.
2. A1 trả cả danh sách của trại kèm tên trại, múi giờ (luôn `Asia/Ho_Chi_Minh`, D39), trạng thái dịch vụ, số đếm từng tab và thao tác của từng dòng. Manager chỉ nhận dòng ACTIVE, không có thao tác, không có số Đã ngưng.
3. Thứ tự mặc định theo tên tiếng Việt A→Z, không phân biệt hoa thường; chưa có tên thì theo email; bằng nhau theo id. Bấm cột Thành viên để đảo. Không ghim Owner.
4. Tab: Tất cả = mọi dòng; Quản lý / Kỹ thuật viên = người ACTIVE của vai trò; Đã ngưng = INACTIVE (chỉ Owner). Đổi tab hoặc chiều sắp xếp về trang 1; 20 dòng/trang; giữ tab và chiều theo tài khoản + trại trong phiên.
5. Nút trên dòng theo trạng thái: ACTIVE "Đổi vai trò · Ngưng", INACTIVE "Kích hoạt lại", dòng Owner không có. Nút chỉ bấm được khi có trong `actions` (đổi vai trò, kích hoạt lại cần trại ACTIVE; Ngưng luôn được); trại không ACTIVE hiện ghi chú, Mời bị khóa.
6. Tải khi vào màn, sau Mời / thao tác UC6 hoặc bấm Làm mới; không polling. Rỗng → MSG-COM-04 + Xóa bộ lọc; lỗi tải → MSG-COM-03 + Thử lại. Ngày tham gia hiện mm/yyyy theo UTC+07:00.

### UC-FE03-06 Đổi vai trò / ngưng / kích hoạt lại (D30)
1. SCR-13 → Owner bấm thao tác trên dòng (hoặc Kích hoạt lại từ popup Mời khi gặp MSG-FE03-21) → popup hiện thành viên, vai trò và trạng thái hiện tại.
2. Chọn hành động, vai trò mới (nếu đổi vai trò), ngày hiệu lực (mặc định hôm nay theo UTC+07:00, không ở tương lai), lý do (5–500 ký tự không tính khoảng trắng) → **Lưu thay đổi**.
3. Xác nhận ngay trong popup [Quay lại] [Xác nhận]: MSG-FE03-11 (ngưng), MSG-FE03-12 (đổi vai trò), câu riêng cho kích hoạt lại (mục 8). Hủy khi đã nhập → MSG-COM-14.
4. Hệ thống khóa dòng membership rồi kiểm theo thứ tự: Owner của trại (COM-01) → membership thuộc trại (COM-08) → không phải membership Owner (COM-01) → dữ liệu (COM-06 / 07 / 10; trường thiếu hoặc sai dạng bị chặn ở tầng HTTP trước) → đổi vai trò người INACTIVE (COM-10, `field=action`) → trại ACTIVE cho đổi vai trò / kích hoạt lại (FE03-04) → đã đúng vai trò / trạng thái (FE03-20, kể cả khi version cũ) → version (COM-05). Lệnh bị từ chối không ghi gì.
5. Cập nhật membership + 1 dòng `farm_membership_change` + audit (vai trò / trạng thái trước-sau, ngày hiệu lực; lý do chỉ ở lịch sử) trong một transaction; cùng Idempotency-Key trả kết quả đầu → MSG-FE03-13 → tải lại SCR-13.
6. Quyền mới áp dụng từ request kế tiếp của thành viên, bất kể ngày hiệu lực; bản ghi người đó đã tạo giữ tác giả; thông báo nháp của Manager bị ngưng vẫn chỉ tác giả thấy và không sửa được (AF2).
7. Lỗi FE03-20 / FE03-04 / COM-05 / COM-08: hiện lý do, đóng popup, tải lại danh sách, không tự thử lại bằng version mới. Lỗi lưu / mạng: giữ popup và cùng Idempotency-Key.

E1 đích là Owner / người làm không phải Owner → MSG-COM-01 · E2 đổi vai trò / kích hoạt lại khi trại không ACTIVE → MSG-FE03-04 · E3 đã đúng vai trò / trạng thái → MSG-FE03-20 · E4 lý do trống / ngày tương lai → MSG-COM-06 / MSG-COM-07; lý do ngoài 5–500 → MSG-COM-10 · E5 sửa đồng thời → MSG-COM-05.

### UC-FE03-07 Xem tài khoản người dùng (D31)
1. SA có quyền SA ACTIVE mở SCR-16 (trang chủ của SA). Vai trò khác, SA đã bị thu hồi → MSG-COM-01; tài khoản bị tạm ngưng → MSG-FE01-03; chưa đăng nhập → 401.
2. A9 trả một trang 20 dòng (`page` từ 0) và tổng số sau lọc. Tìm theo tên hoặc email (bỏ khoảng trắng đầu cuối, không phân biệt hoa thường, giữ dấu, tối đa 100 ký tự; `%` `_` là ký tự thường); lọc trạng thái (Tất cả / ACTIVE / SUSPENDED) và vai trò platform đang ACTIVE (Tất cả / Không có / CS / PM / SA; "Không có" gồm vai trò đã thu hồi). Tham số sai → MSG-COM-10 kèm tên tham số.
3. Thứ tự theo tên tiếng Việt A→Z, không phân biệt hoa thường; chưa có tên theo email; bằng nhau theo email rồi id. Bấm cột Người dùng để đảo. Đổi bộ lọc / chiều về trang 1; ô tìm, bộ lọc và chiều được giữ trong phiên theo tài khoản SA; ô tìm trên thanh trên mở trang với `?q=`.
4. Mỗi dòng: chữ viết tắt, họ tên, email; vai trò platform ACTIVE hoặc "Không có" (kèm "CS đã thu hồi" khi bị thu hồi); số trại tham gia = membership ACTIVE kèm vai trò "3 (Chủ trại, Quản lý)"; trạng thái.
5. Chọn dòng (URL `/nen-tang/tai-khoan/{id}`; không có id thì dòng đầu) → A10: email và xác minh, tạo lúc, đăng nhập cuối (dd/mm/yyyy HH:mm, Asia/Ho_Chi_Minh), đăng ký Chủ trại và trại sở hữu, vai trò platform, trại tham gia. Id không tồn tại → MSG-COM-08, danh sách vẫn dùng được.
6. Tải khi vào màn, đổi bộ lọc / trang / chiều, sau thao tác UC8/UC9 hoặc bấm Làm mới; không polling. Rỗng → MSG-COM-04 + Xóa bộ lọc; lỗi tải → MSG-COM-03 + Thử lại. Không hiện SĐT, dữ liệu vận hành trại, nội dung phiếu hỗ trợ, mật khẩu (GBR-11).

### UC-FE03-08 Tạm ngưng / khôi phục tài khoản (D32)
1. SCR-16, khung chi tiết (A10). Ô lý do và nút **Tạm ngưng tài khoản** / **Khôi phục tài khoản** chỉ hiện khi có trong `actions` (SUSPEND: tài khoản ACTIVE không phải của SA đang xem; RESTORE: tài khoản SUSPENDED). Tài khoản của chính SA hiện "Bạn không thể tạm ngưng tài khoản của chính mình."
2. SA nhập lý do (bỏ khoảng trắng đầu cuối, 5–500 ký tự, ít nhất 5 ký tự không phải khoảng trắng) → bấm nút → hộp thoại MSG-FE03-14 / MSG-FE03-15 [Quay lại] [Tạm ngưng / Khôi phục tài khoản]; Quay lại không đổi gì (AF1).
3. A12 với `{reason, version}` + `Idempotency-Key`. Hệ thống khóa dòng tài khoản (tạm ngưng: khóa cả dòng tài khoản của SA đang thao tác, theo thứ tự id) rồi kiểm theo thứ tự: quyền SA ACTIVE (COM-01) → tài khoản tồn tại (COM-08) → lý do (COM-06 / COM-10; thiếu `reason` / `version` / key bị chặn ở tầng HTTP) → tạm ngưng chính mình (FE03-17) → đã ở trạng thái yêu cầu (FE03-20, kể cả version cũ) → version (COM-05) → khi tạm ngưng: SA đang thao tác còn ACTIVE (đọc lại từ DB; không → COM-01) và còn SA ACTIVE khác nếu đích là SA (FE03-17). Lệnh bị từ chối không ghi gì.
4. Cập nhật trạng thái + 1 dòng `app_user_status_change` + audit (trước / sau, không có lý do) trong một transaction; tạm ngưng thì cùng transaction đưa phiếu chưa CLOSED của tài khoản về hàng đợi (lịch sử AUTO_REQUEUE) và hết hạn phiên đã đăng ký. Cùng key + dữ liệu trả kết quả đầu; cùng key khác dữ liệu → COM-19. Phản hồi là A10 → MSG-FE03-16 → tải lại A9 + A10.
5. Phiên đã đăng ký của tài khoản bị hết hạn ngay khi tạm ngưng: request kế tiếp nhận 401 (frontend về màn đăng nhập), đăng nhập lại nhận 403 MSG-FE01-03; phiên không có trong registry vẫn bị filter từ chối bằng 403 MSG-FE01-03. Vai trò platform và membership giữ nguyên. Yêu cầu nội bộ OPEN giao cho người bị tạm ngưng có `needsReassignment=true` trên SCR-68 cho tới khi người đó khả dụng lại.
6. Lỗi FE03-17 / FE03-20 / COM-05 / COM-08: đóng hộp thoại, hiện lý do trên khung chi tiết, tải lại A9 + A10, giữ lý do đã nhập, không tự thử lại bằng version mới. Lỗi lưu / mạng: giữ hộp thoại và cùng `Idempotency-Key`.

E1 không có quyền SA ACTIVE → MSG-COM-01 · E2 lý do trống → MSG-COM-06 (ngoài 5–500 → MSG-COM-10) · E3 tạm ngưng SA cuối cùng hoặc chính mình → MSG-FE03-17 · E4 đã ở trạng thái yêu cầu → MSG-FE03-20 · E5 sửa đồng thời → MSG-COM-05 · E6 lỗi lưu → MSG-COM-02.

### UC-FE03-09 Quyền nhân viên platform (D33)
1. SCR-16, khung chi tiết → **Quyền nền tảng** mở popup ngay trên SCR-16 (`/nen-tang/tai-khoan/{id}?m=access`; link cũ `/nen-tang/quyen/{id}` chuyển sang đây). Không còn trang "Quyền nhân sự nền tảng" riêng (FE-03 Q5).
2. Popup hiện tài khoản (tên, email, vai trò và trạng thái hiện tại), ghi chú SA cuối cùng (MSG-FE03-17) và lịch sử vai trò (A11: hành động, vai trò, lý do, người làm, thời điểm theo Asia/Ho_Chi_Minh, mới nhất trước).
3. Hành động lấy từ `accessActions` của A10: GRANT (chưa có quyền), CHANGE / REVOKE (quyền ACTIVE), RESTORE (quyền REVOKED); tài khoản bị tạm ngưng hoặc chưa xác minh chỉ còn REVOKE; tài khoản của chính SA không có hành động. Không có hành động → popup hiện lý do (MSG-FE03-22 / MSG-FE03-18 / "Bạn không thể thay đổi quyền nền tảng của chính mình.") và lịch sử.
4. SA chọn hành động, vai trò (Cấp / Đổi), nhập lý do 5–500 → nút theo hành động ("Cấp quyền CS", "Đổi sang PM", "Thu hồi quyền CS", "Khôi phục quyền CS"). Hủy khi đã nhập lý do → MSG-COM-14.
5. A13 với `{operation, role?, reason, version}` + `Idempotency-Key`. Hệ thống khóa dòng tài khoản đích và dòng của SA đang thao tác theo thứ tự id rồi kiểm: quyền SA ACTIVE (COM-01) → tài khoản tồn tại (COM-08) → dữ liệu (COM-06 / COM-10 `operation`, `role`, `reason`) → quyền của chính mình (COM-01) → tài khoản SUSPENDED khi không phải thu hồi (FE03-22) → email chưa xác minh khi không phải thu hồi (FE03-18) → trạng thái: giá trị đã có hiệu lực → FE03-20 `{target, value: role|status}`, quyền đã đổi kể từ khi mở popup → COM-05 → version (COM-05) → SA đang thao tác còn ACTIVE (COM-01) → còn SA ACTIVE khác khi một SA mất quyền (FE03-17). Lệnh bị từ chối không ghi gì.
6. Lưu quyền + 1 dòng `platform_access_change` + audit trước / sau (không có lý do) trong một transaction; CS mất quyền CS (thu hồi hoặc đổi sang PM / SA) → phiếu chưa CLOSED của họ về hàng đợi trong cùng lệnh; PM / SA mất quyền → yêu cầu nội bộ OPEN giao cho họ có `needsReassignment=true`. Quyền mới áp dụng từ request kế tiếp của người đó. Phản hồi A10 → MSG-FE03-19 → tải lại A9 + A10.
7. Lỗi FE03-17 / FE03-18 / FE03-20 / FE03-22 / COM-05 / COM-08: đóng popup, hiện lý do trên khung chi tiết, tải lại. Lỗi lưu / mạng: giữ popup và cùng `Idempotency-Key`.

E1 không có quyền SA ACTIVE → MSG-COM-01 · E2 email chưa xác minh → MSG-FE03-18 · E3 không còn SA ACTIVE → MSG-FE03-17 · E4 vai trò / trạng thái đó đã có hiệu lực → MSG-FE03-20 · E5 lý do trống → MSG-COM-06 (ngoài 5–500 → MSG-COM-10) · E6 sửa đồng thời → MSG-COM-05 · E7 lỗi lưu → MSG-COM-02 · (D33) tài khoản bị tạm ngưng → MSG-FE03-22; quyền của chính mình → MSG-COM-01.

---

## 6. Màn hình và trường

### SCR-13 Thành viên và vai trò

| # | Trường | Loại | Hiện với | Nội dung / Hành vi |
|---|---|---|---|---|
| 1 | Invitations / Lời mời | Nút | Owner | Mở SCR-14 |
| 2 | Invite member / Mời thành viên | Nút | Owner, trại ACTIVE | Mở popup Mời |
| 3 | Tabs | Tab | Owner: 4 tab; Manager: không có tab Đã ngưng | Tất cả (n) = mọi dòng; Quản lý (n), Kỹ thuật viên (n) = người ACTIVE của vai trò; Đã ngưng (n) = INACTIVE (D29) |
| 4 | Member / Thành viên | Cột | Tất cả | Họ tên + email; sắp xếp theo tên tiếng Việt, mặc định A→Z, bấm để đảo; chưa có tên → "Chưa có tên", xếp theo email (D29) |
| 5 | Role / Vai trò | Cột | Tất cả | Chủ trại / Quản lý / Kỹ thuật viên |
| 6 | Status / Trạng thái | Huy hiệu | Tất cả | ACTIVE "Đang hoạt động" / INACTIVE "Đã ngưng" |
| 7 | Joined / Tham gia | Cột | Tất cả | mm/yyyy của `joinedAt` theo UTC+07:00 (D29) |
| 8 | Actions / Thao tác | Nút | Owner | ACTIVE: "Đổi vai trò · Ngưng"; INACTIVE: "Kích hoạt lại"; không có trên dòng Owner; khóa khi không có trong `actions` (D29) |
| 9 | Permissions by role / Quyền theo vai trò | Bảng chỉ đọc | Tất cả | Đủ Table III-2: 17 nhóm × Chủ trại / Quản lý / Kỹ thuật viên (D29) |
| 10 | Pagination / Phân trang | Điều hướng | Tất cả | 20 dòng/trang (Table III-1) |
| 11 | Refresh / Làm mới | Nút | Tất cả | Đọc lại A1, không polling (D29) |

### Popup Mời thành viên

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Farm / Trại | Chỉ đọc | — | Tên trại | — | — |
| 2 | Recipient email / Email người nhận | Ô chữ | * | Định dạng email, ≤ 254 | Trống | MSG-COM-06, MSG-COM-10, MSG-FE03-02, MSG-FE03-03 |
| 3 | Role / Vai trò | Radio | * | Quản lý / Kỹ thuật viên | **Không chọn sẵn** | MSG-COM-06 |
| 4 | Role permissions / Quyền của vai trò | Chỉ đọc | — | Tóm tắt Table III-2 của vai trò đã chọn | — | — |
| 5 | Valid for / Hiệu lực | Dropdown | — | 3 / 7 / 14 ngày | 7 | — |
| 6 | Cancel / Send invitation – Hủy / Gửi lời mời | Nút | — | — | — | MSG-FE03-04, MSG-COM-02; thành công MSG-FE03-01 |

### SCR-14 Lời mời của trại (Owner)

| # | Trường | Loại | Nội dung / Hành vi |
|---|---|---|---|
| 1 | Invite member / Mời thành viên | Nút | Mở popup Mời |
| 2 | Tabs | Tab | Đang chờ (n), Đã chấp nhận (n), Hết hạn (n), Đã hủy (n) |
| 3 | Recipient / Người nhận | Cột | Email + gợi ý "Đã có tài khoản" / "Chưa có tài khoản" |
| 4 | Role / Vai trò | Cột | Quản lý / Kỹ thuật viên |
| 5 | Last sent / Gửi lần cuối | Cột | dd/mm/yyyy HH:mm theo UTC+07:00; sắp xếp được, mặc định giảm dần, id giảm dần khi bằng thời điểm (D26) |
| 6 | Expires / Hết hạn | Cột | dd/mm/yyyy HH:mm |
| 7 | Status / Trạng thái | Huy hiệu | PENDING, ACCEPTED, EXPIRED, CANCELLED |
| 8 | Actions / Thao tác | Nút | Chỉ PENDING: "Gửi lại" (trại ACTIVE), "Hủy" (hộp thoại xác nhận MSG-FE03-06: Quay lại / Hủy lời mời, D27) |
| 9 | Pagination / Phân trang | Điều hướng | 20 dòng/trang; số trên tab là toàn trại, không theo trang/lọc (D26) |
| 10 | Refresh / Làm mới | Nút | Đọc lại dữ liệu, không polling (D26) |

### Popup Đổi vai trò / Ngưng thành viên

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Member / Thành viên | Chỉ đọc | — | Tên, email, vai trò và trạng thái hiện tại | — | — |
| 2 | Action / Hành động | Radio | * | ACTIVE: Đổi vai trò / Ngưng; INACTIVE: Kích hoạt lại; trại không ACTIVE chỉ còn Ngưng | Theo nút đã bấm | MSG-COM-06, MSG-COM-10, MSG-FE03-04 |
| 3 | New role / Vai trò mới | Radio | * (khi Đổi vai trò) | Quản lý / Kỹ thuật viên, khác vai trò hiện tại | — | MSG-FE03-20 |
| 4 | Effective date / Ngày hiệu lực | Ngày | * | Không ở tương lai theo UTC+07:00; chỉ để ghi lịch sử | Hôm nay | MSG-COM-06, MSG-COM-07 |
| 5 | Reason / Lý do | Ô chữ dài | * | Bỏ khoảng trắng đầu cuối; 5–500 ký tự, ít nhất 5 không phải khoảng trắng (Table III-1) | Trống | MSG-COM-06, MSG-COM-10 |
| 6 | Cancel / Save changes – Hủy / Lưu thay đổi | Nút | — | Xác nhận trong popup: MSG-FE03-11 / 12 / câu kích hoạt lại; Hủy khi đã nhập → MSG-COM-14 | — | MSG-FE03-04, MSG-FE03-20, MSG-COM-05, MSG-COM-08, MSG-COM-02; thành công MSG-FE03-13 |

### SCR-15 Chấp nhận lời mời

| # | Trường | Loại | Nội dung / Hành vi |
|---|---|---|---|
| 1 | Status / Trạng thái | Huy hiệu | PENDING (hoặc EXPIRED / CANCELLED / ACCEPTED / Liên kết không hợp lệ ở trạng thái không hợp lệ; "Đã chấp nhận" khi mở lại với membership ACTIVE — D28) |
| 2 | Farm, Role, Invited by, Sent at, Expires at | Chỉ đọc | Trại, vai trò, người mời (họ tên Owner), gửi lần cuối, hết hạn lúc; dd/mm/yyyy HH:mm theo UTC+07:00 |
| 3 | Invited email / Signed-in email – Email được mời / Email đang đăng nhập | Chỉ đọc | Phải bằng nhau; khác → MSG-FE03-09 và ẩn thông tin trại |
| 4 | Role permissions / Quyền của vai trò | Chỉ đọc | Tóm tắt Table III-2 |
| 5 | Decide later / Để sau | Nút | Lời mời vẫn PENDING, mở SCR-09 |
| 6 | Accept and enter farm / Chấp nhận và vào trại | Nút | MSG-FE03-10 → SCR-48 (Manager) / SCR-74 (Technician) |
| **Trạng thái: Lời mời không còn hiệu lực** | | | |
| 7 | Message / Thông báo | Chữ | MSG-FE03-08 kèm trạng thái và hạn |
| 8 | Back to home / Contact BeefCare | Nút | Về trang chủ; liên hệ hiện email và SĐT chính thức (GBR-87) |
| **Trạng thái: Đã tham gia (AF2, D28)** | | | |
| 9 | Message / Thông báo | Chữ | "Bạn đã là thành viên của {farm} với vai trò {role}." |
| 10 | Back to home / Enter farm – Về trang chủ / Vào trại | Nút | Vào trại qua kiểm tra của SCR-09; trại không ACTIVE → MSG-FE02-04 |
| **Trạng thái: Email khác (E2) / Trại chưa hoạt động (E3)** | | | |
| 11 | Message / Thông báo | Chữ | MSG-FE03-09 với email đang đăng nhập, không có thông tin trại; hoặc MSG-FE03-04, lời mời vẫn chờ |
| 12 | Sign out to switch account / Decide later | Nút | E2: nhớ link rồi đăng xuất để đăng nhập bằng email được mời; E3: Để sau → SCR-09 |

### SCR-16 Tài khoản người dùng (SA)

| # | Trường | Loại | Bắt buộc | Ràng buộc / Nội dung | Lỗi / Hành vi |
|---|---|---|---|---|---|
| 1 | Search / Tìm | Ô chữ | — | Khớp tên hoặc email; bỏ khoảng trắng đầu cuối, không phân biệt hoa thường, giữ dấu; ≤ 100 (D31) | MSG-COM-10 |
| 2 | Status / Trạng thái | Dropdown | — | Tất cả, ACTIVE "Đang hoạt động", SUSPENDED "Tạm ngưng" | — |
| 3 | Platform role / Vai trò platform | Dropdown | — | Tất cả, Không có (gồm vai trò đã thu hồi), CS, PM, SA – theo vai trò ACTIVE (D31) | — |
| 4 | User / Người dùng | Cột | — | Chữ viết tắt, họ tên ("Chưa có tên" khi trống), email; mặc định tên tiếng Việt A→Z, bấm để đảo (D31) | — |
| 5 | Platform role | Cột | — | Vai trò ACTIVE CS / PM / SA, hoặc "Không có"; vai trò đã thu hồi kèm chú thích "CS đã thu hồi" (D31) | — |
| 6 | Farms joined / Số trại tham gia | Cột | — | Số membership ACTIVE + vai trò theo thứ tự Chủ trại → Quản lý → Kỹ thuật viên, ví dụ "3 (Chủ trại, Quản lý)"; không có → "0" (D31) | — |
| 7 | Status | Cột | — | ACTIVE "Đang hoạt động" / SUSPENDED "Tạm ngưng" | — |
| — | Pagination / Phân trang, Refresh / Làm mới | Điều hướng, nút | — | 20 dòng/trang; Làm mới đọc lại A9 và A10, không polling (D31) | MSG-COM-03, MSG-COM-04 + Xóa bộ lọc |
| **Chi tiết tài khoản (A10, theo id trên URL)** | | | | | |
| 8 | Email and verification / Email và xác minh | Chỉ đọc | — | "Đã xác minh (Google)", "Đã xác minh (email)" hoặc "Chưa xác minh" (D31) | MSG-COM-08 khi id không còn |
| 9 | Created at, Last sign-in / Tạo lúc, đăng nhập cuối | Chỉ đọc | — | dd/mm/yyyy HH:mm theo Asia/Ho_Chi_Minh; chưa đăng nhập → "Chưa đăng nhập" (D31) | — |
| 10 | Owner registration / Đăng ký Chủ trại | Chỉ đọc | — | Có (dd/mm/yyyy) / Không; tên các trại sở hữu theo thứ tự tên | — |
| 11 | Reason / Lý do | Ô chữ dài | * (khi đổi trạng thái) | Bỏ khoảng trắng đầu cuối; 5–500 ký tự, ít nhất 5 không phải khoảng trắng; chỉ hiện khi có thao tác trong `actions` (D32) | MSG-COM-06, MSG-COM-10 |
| 12 | Suspend account / Restore account | Nút | — | Theo `actions` (D32); tài khoản của chính SA không có Tạm ngưng; xác nhận MSG-FE03-14 / 15 [Quay lại] [Tạm ngưng / Khôi phục tài khoản] | MSG-FE03-17, MSG-FE03-20, MSG-COM-05, MSG-COM-08 (đóng hộp thoại, tải lại); thành công MSG-FE03-16 |
| 13 | Platform access / Quyền platform | Nút | — | — | Mở popup Quyền nhân viên platform |

Không hiện: dữ liệu nghiệp vụ trại, nội dung phiếu hỗ trợ, thông tin mật khẩu.

### Popup Quyền nhân viên platform

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi / Hành vi |
|---|---|---|---|---|---|
| 1 | Account / Tài khoản | Chỉ đọc | — | Tên ("Chưa có tên" khi trống), email, vai trò platform hiện tại ("đã thu hồi" khi REVOKED), trạng thái tài khoản | — |
| 2 | Action / Hành động | Radio theo `accessActions` (D33) | * | GRANT → Cấp quyền; CHANGE / REVOKE → Đổi vai trò / Thu hồi quyền; RESTORE → Khôi phục quyền; rỗng → hiện lý do (MSG-FE03-22 / MSG-FE03-18 / quyền của chính mình) | — |
| 3 | Role / Vai trò | Radio | * (Cấp, Đổi) | CS / PM / SA; mặc định vai trò khác vai trò đang ACTIVE | MSG-FE03-20, MSG-COM-06 / 10 |
| 4 | Reason / Lý do | Ô chữ dài | * | Bỏ khoảng trắng đầu cuối; 5–500 ký tự, ít nhất 5 không phải khoảng trắng (D33) | MSG-COM-06, MSG-COM-10 |
| 5 | Last SA notice / Lưu ý SA cuối | Chỉ đọc | — | Cố định: phải luôn còn ít nhất một SA đang hoạt động | MSG-FE03-17 |
| 6 | Role history / Lịch sử vai trò | Danh sách chỉ đọc | — | A11: hành động, vai trò (Đổi: cũ → mới), lý do, người làm ("Hệ thống" khi trống), thời điểm dd/mm/yyyy HH:mm Asia/Ho_Chi_Minh; mới nhất trước | Lỗi tải: thông báo + Thử lại |
| 7 | Cancel / Confirm – Hủy / Xác nhận | Nút | — | Nhãn theo hành động, ví dụ "Cấp quyền CS"; Hủy khi đã nhập lý do → MSG-COM-14; không có hành động → chỉ "Đóng" | MSG-FE03-17, MSG-FE03-18, MSG-FE03-20, MSG-FE03-22, MSG-COM-05, MSG-COM-08 (đóng popup, tải lại); thành công MSG-FE03-19 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách thành viên (D29) | — | `{farmName, timeZone, serviceStatus, counts{all, managers, technicians, inactive?}, items[{id, userId, fullName, email, role, status, joinedAt, version, actions[]}]}`; cả danh sách, theo tên; `actions` ⊂ CHANGE_ROLE/DEACTIVATE/REACTIVATE; Manager không nhận dòng INACTIVE, `inactive` hay thao tác; không trả lý do / ngày hiệu lực của lần đổi | COM-01, COM-12 (Manager, trại không ACTIVE), FE01-03, COM-03 | `GET /api/farms/{farmId}/members` |
| A2 | Đổi vai trò / ngưng / kích hoạt lại (D30) | `{action: CHANGE_ROLE\|DEACTIVATE\|REACTIVATE, role? (bắt buộc khi CHANGE_ROLE), effectiveDate, reason (5–500), expectedVersion}` + `Idempotency-Key` | Một dòng A1 (D29) | COM-01, COM-08 (404), COM-06, COM-07, COM-10 (`reason`, `role`, `action`), FE03-04, FE03-20 (`{target, value}`), COM-05, COM-19, COM-02 | `PUT /api/farms/{farmId}/members/{membershipId}` |
| A3 | Danh sách lời mời (D26) | `status?` (bỏ trống = tất cả), `page=0`, `size=20` (1–100), `sort=lastSentAt`, `dir=desc` (asc/desc); `invitationId?` số dương để UC1 tra chính xác | `{items[{id,email,hasAccount,role,createdAt,lastSentAt,expiresAt,validityDays,status,version}],total,page,size,counts{PENDING,ACCEPTED,EXPIRED,CANCELLED},asOf}`; counts toàn trại trước lọc, total sau lọc; một clock, không ghi khi GET | COM-01, COM-10 (query sai) | `GET /api/farms/{farmId}/invitations` |
| A4 | Gửi lời mời | `email, role, validityDays? (3\|7\|14, mặc định 7)` + `Idempotency-Key` | Lời mời (A3), chưa xác nhận email đã tới | COM-01, FE03-02, FE03-03 (`{invitationId, email}`), FE03-04, FE03-21 (`{membershipId, email}`), COM-06, COM-10, COM-02 | `POST /api/farms/{farmId}/invitations` |
| A5 | Gửi lại (D27) | `expectedVersion` (bắt buộc) + `Idempotency-Key` | Lời mời (item A3) với lastSentAt/expiresAt/version mới | COM-01, FE03-04, COM-08, FE03-08 (`{status}`), COM-05, COM-06 (thiếu version/key), COM-19, COM-02 | `POST …/invitations/{id}/resend` |
| A6 | Hủy (D27) | `expectedVersion` (bắt buộc) + `Idempotency-Key` | Lời mời (item A3) `CANCELLED` | COM-01, COM-08, FE03-08 (`{status}`), COM-05, COM-06, COM-19, COM-02 | `POST …/invitations/{id}/cancel` |
| A7 | Xem lời mời từ link (D28) | `token` | `{status: PENDING\|ACCEPTED, farmId, farmName, timeZone, email, role, invitedBy, sentAt, expiresAt, membershipId?}` (membershipId khi ACCEPTED); quyền của vai trò là bảng cố định Table III-2 ở FE; email khác → 403 MSG-FE03-09 không có thông tin trại/trạng thái | 400 FE03-08 `{status, expiresAt?}` (INVALID không có hạn), 403 FE03-09, 403 FE03-04, 401 | `GET /api/invitations/accept?token=` |
| A8 | Chấp nhận (D28) | `token`; không Idempotency-Key (token là khóa ý định, GBR-17) | `{membershipId, farmId, farmName, role, status}`; gọi lại trả cùng kết quả khi membership còn ACTIVE | 400 FE03-08 `{status, expiresAt?}`, 403 FE03-09, 403 FE03-04, 409 COM-05, 500 COM-02, 401 | `POST /api/invitations/accept` |
| A9 | Danh sách tài khoản (SA, D31) | `q?` (≤ 100), `status?` (ACTIVE\|SUSPENDED), `platformRole?` (NONE\|CS\|PM\|SA, theo vai trò ACTIVE), `page=0`, `size=20` (1–100), `sort=name`, `dir=asc\|desc` | `{items[{id, fullName, email, accountStatus, platformRole, platformAccessStatus, emailVerified, farmCount, farmRoles[]}], total, page, size}`; `platformRole`/`platformAccessStatus` là quyền đang lưu (REVOKED vẫn trả); `farmCount`/`farmRoles` chỉ membership ACTIVE; không có SĐT | 401, COM-01, FE01-03, COM-10 (`params.field`), COM-03 | `GET /api/platform/accounts` |
| A10 | Chi tiết tài khoản (D31, D32) | — | `{…A9, platformAccessVersion, signInMethods[], createdAt, lastSignInAt, ownerRegistrationCompleted, ownerRegistrationCompletedAt, ownedFarms[], version, actions[]}`; `actions` ⊂ SUSPEND (tài khoản ACTIVE không phải của SA đang xem) / RESTORE (tài khoản SUSPENDED); `accessActions` ⊂ GRANT / CHANGE / REVOKE / RESTORE (D33); không có SĐT, mật khẩu, Google subject. Cũng là phản hồi của A12, A13 | 401, COM-01, FE01-03, COM-08 (404), COM-10 (id sai kiểu), COM-03 | `GET /api/platform/accounts/{id}` |
| A11 | Lịch sử vai trò (D33) | — | `[{id, action, roleBefore?, statusBefore?, roleAfter, statusAfter, reason, byName?, byEmail?, at}]` từ `platform_access_change`, mới nhất trước, tối đa 100; không gồm lịch sử tạm ngưng tài khoản | 401, COM-01, FE01-03, COM-08 (404), COM-03 | `GET /api/platform/accounts/{id}/history` |
| A12 | Tạm ngưng / khôi phục (D32) | `{reason (5–500), version}` + `Idempotency-Key` (bắt buộc) | A10 | 401, COM-01 (403), COM-08 (404), COM-06 (`reason` / `version` / `Idempotency-Key`), COM-10 (`reason`), FE03-17 (409, chính mình / SA cuối), FE03-20 (409, `{target: email, value: status}`), COM-05, COM-19, COM-02 | `POST /api/platform/accounts/{id}/suspend` · `/restore` |
| A13 | Quyền platform (D33) | `{operation: GRANT\|CHANGE\|REVOKE\|RESTORE, role? (bắt buộc khi GRANT / CHANGE), reason (5–500), version (platformAccessVersion; null / 0 khi chưa có quyền)}` + `Idempotency-Key` (bắt buộc) | A10 | 401, COM-01 (403; cả quyền của chính mình), COM-08 (404), COM-06 / COM-10 (`operation`, `role`, `reason`, `Idempotency-Key`), FE03-22 (409, `{email}`), FE03-18 (409), FE03-20 (409, `{target, value: role\|status}`), COM-05, FE03-17 (409), COM-19, COM-02 | `POST /api/platform/accounts/{id}/platform-access` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE03-01 | Toast thành công | Đã tạo lời mời tới {email}. Hệ thống đang gửi email. Hết hạn lúc {expiry}. (D25) |
| MSG-FE03-02 | Dưới trường | {email} đã là thành viên của trại. |
| MSG-FE03-03 | Hộp thoại | Đã có lời mời đang chờ cho {email}. Gửi lại lời mời đó? [Gửi lại] [Hủy] |
| MSG-FE03-04 | Trong hộp thoại | Mời thành viên, đổi vai trò và kích hoạt lại cần trại đang hoạt động (ACTIVE). |
| MSG-FE03-05 | Toast thành công | Đã cập nhật lời mời tới {email}. Hệ thống đang gửi email. Hết hạn lúc {expiry}. (D25) |
| MSG-FE03-06 | Hộp thoại xác nhận | Hủy lời mời gửi {email}? Link sẽ không còn tác dụng. [Quay lại] [Hủy lời mời] (D27) |
| MSG-FE03-07 | Toast thành công | Đã hủy lời mời. |
| MSG-FE03-08 | Trạng thái màn hình | Lời mời không còn hiệu lực ({status}). |
| MSG-FE03-09 | Trạng thái màn hình | Lời mời này được gửi tới email khác. Hãy đăng nhập bằng email được mời để chấp nhận. |
| MSG-FE03-10 | Toast thành công | Bạn đã tham gia {farm} với vai trò {role}. |
| MSG-FE03-11 | Hộp thoại xác nhận | Ngưng {member}? Người này sẽ mất quyền vào {farm} từ thao tác kế tiếp. |
| MSG-FE03-12 | Hộp thoại xác nhận | Đổi {member} từ {old_role} sang {new_role}? Quyền mới áp dụng từ thao tác kế tiếp. |
| MSG-FE03-13 | Toast thành công | Đã cập nhật thành viên {member}. |
| (D30) | Xác nhận kích hoạt lại, không có mã trong SRS | Kích hoạt lại {member} với vai trò {role}? Người này vào lại {farm} từ thao tác kế tiếp. |
| MSG-FE03-14 | Hộp thoại xác nhận | Tạm ngưng tài khoản {email}? Người dùng sẽ không đăng nhập được. |
| MSG-FE03-15 | Hộp thoại xác nhận | Khôi phục tài khoản {email}? Các vai trò và membership đã thu hồi sẽ không được trả lại. |
| MSG-FE03-16 | Toast thành công | Tài khoản {email} hiện là {status}. ({status}: "Đang hoạt động" / "Tạm ngưng", D32) |
| MSG-FE03-17 | Trong hộp thoại | Phải luôn còn ít nhất một System Admin đang hoạt động, và bạn không thể tạm ngưng tài khoản của chính mình. |
| MSG-FE03-18 | Trong hộp thoại | Chưa có tài khoản BeefCare cho email này. Người đó cần đăng nhập một lần trước khi được cấp quyền. |
| MSG-FE03-19 | Toast thành công | Quyền {role} của {email} đã được {action}. ({action}: cấp / đổi / thu hồi / khôi phục) |
| MSG-FE03-20 | Trong hộp thoại | Không có thay đổi: {target} đã ở {value} này. |
| MSG-FE03-21 | Đề nghị trong popup Mời | {email} là thành viên đã ngưng. Kích hoạt lại thay vì mời? [Kích hoạt lại] [Quay lại]. Mở UC6, giữ vai trò hiện tại, bắt buộc ngày hiệu lực/lý do. (D25) |
| MSG-FE03-22 | Trong hộp thoại | Tài khoản {email} đang tạm ngưng. Hãy khôi phục tài khoản trước khi cấp, đổi hoặc khôi phục quyền. (D33, FE-03 Q4; SRS không có mã) |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-03-01 | Popup Mời | Email trống / `abc` / 255 ký tự | MSG-COM-06 / MSG-COM-10 / MSG-COM-10 | U, H | Popup |
| TC-03-02 | Popup Mời | Không chọn vai trò | MSG-COM-06 (không có giá trị mặc định) | U | Popup |
| TC-03-03 | Trại ACTIVE | Mời `a@x.vn` làm Manager, 14 ngày | Lời mời PENDING, hết hạn = gửi + 14 ngày; 1 email; chưa có membership | I | R-03-06 |
| TC-03-04 | Đã có lời mời PENDING `a@x.vn` | Mời `A@X.vn` | MSG-FE03-03; vẫn 1 lời mời | I | R-03-02 |
| TC-03-05 | `a@x.vn` là thành viên ACTIVE | Mời | MSG-FE03-02 | I | R-03-03 |
| TC-03-06 | `a@x.vn` là thành viên INACTIVE | Mời | Không tạo lời mời; trả gợi ý kích hoạt lại | I | R-03-03 |
| TC-03-07 | Trại EXPIRED | Mời / gửi lại | MSG-FE03-04 | I | R-03-01 |
| TC-03-08 | Trại EXPIRED, có lời mời PENDING | Hủy | Thành công | I | UC-03 PRE-3 |
| TC-03-09 | Manager | Gọi API mời | 403 MSG-COM-01 | H | R-03-01 |
| TC-03-10 | Lời mời 7 ngày gửi ngày 1 | Gửi lại ngày 5 | Cùng `invitationId`; hết hạn ngày 12; email, vai trò không đổi | I | R-03-04 |
| TC-03-11 | Lời mời CANCELLED | Gửi lại / hủy | MSG-FE03-08 | I | R-03-05 |
| TC-03-12 | Lời mời quá hạn, JOB-02 chạy | — | EXPIRED | I | R-03-19 |
| TC-03-13 | Lời mời quá hạn 1 phút, JOB-02 chưa chạy | Chấp nhận | MSG-FE03-08; không có membership | I | R-03-19 |
| TC-03-14 | Lời mời gửi `a@x.vn` | Đăng nhập `b@x.vn` mở link | MSG-FE03-09; response không chứa tên trại / vai trò | H | R-03-07 |
| TC-03-15 | Lời mời hợp lệ | Chấp nhận | 1 membership ACTIVE đúng vai trò; lời mời ACCEPTED; Owner có thông báo; 1 audit | I | R-03-08 |
| TC-03-16 | Đã chấp nhận | Gọi chấp nhận lần nữa | Trả membership đã có; không có membership thứ hai | I | R-03-08 |
| TC-03-17 | Trại SUSPENDED | Chấp nhận | MSG-FE03-04; lời mời vẫn PENDING | I | UC-04 E3 |
| TC-03-18 | Người được mời là Owner trại khác | Chấp nhận làm Technician | Thành công; trại kia không đổi; không có quyền platform | I | R-03-09 |
| TC-03-19 | Owner | Đổi vai trò / ngưng chính membership OWNER | MSG-COM-01 | H | R-03-10 |
| TC-03-20 | Manager ACTIVE | Owner đổi sang Technician | Vai trò mới; lịch sử có ngày hiệu lực, lý do; request kế tiếp của người đó theo quyền Technician | I | R-03-11, R-03-12 |
| TC-03-21 | Manager | Đổi sang Manager | MSG-FE03-20 | I | R-03-11 |
| TC-03-22 | Popup | Ngày hiệu lực ngày mai; lý do trống; lý do 501 ký tự | MSG-COM-07; MSG-COM-06; MSG-COM-10 | U, H | Popup |
| TC-03-23 | Trại EXPIRED | Ngưng thành viên / đổi vai trò / kích hoạt lại | Được / MSG-FE03-04 / MSG-FE03-04 | I | R-03-11 |
| TC-03-24 | Manager đã ghi 10 lần cân | Bị ngưng | 10 bản ghi vẫn ghi tên người đó | I | R-03-12 |
| TC-03-25 | Manager | Xem danh sách thành viên | Không có thành viên INACTIVE, không có nút thao tác, không truy cập được lời mời | H, E | SCR-13 |
| TC-03-26 | Technician | Gọi danh sách thành viên | 403 | H | Table III-2 |
| TC-03-27 | Chỉ còn 1 SA ACTIVE | Thu hồi quyền SA của người đó | MSG-FE03-17 | I | R-03-15 |
| TC-03-28 | SA | Tạm ngưng chính mình | MSG-FE03-17 | I | R-03-15 |
| TC-03-29 | Tài khoản đang có vai trò CS ACTIVE | Cấp thêm PM | Không được có 2 vai trò ACTIVE (phải dùng Đổi vai trò) | I | R-03-15 |
| TC-03-30 | Email chưa có tài khoản | Cấp quyền | MSG-FE03-18; không gửi email | I | R-03-14 |
| TC-03-31 | CS đang giữ 3 phiếu | SA tạm ngưng tài khoản CS | 3 phiếu về hàng đợi chưa giao, trạng thái không đổi | I | R-03-17 |
| TC-03-32 | Tài khoản bị tạm ngưng rồi khôi phục, trước đó là Manager đã bị ngưng | Khôi phục | Tài khoản ACTIVE; membership vẫn INACTIVE | I | R-03-16 |
| TC-03-33 | SA | Xem chi tiết tài khoản | Không có trường mật khẩu, dữ liệu bò, nội dung phiếu | H | SCR-16 |
| TC-03-34 | Mọi thao tác ghi ở trên | — | Có audit cùng transaction | I | R-03-18 |
| TC-03-35 | Owner có lời mời đủ bốn trạng thái | Mở SCR-14 / đổi tab | PENDING mặc định; trả đúng trạng thái, đủ trường, số lượng cả bốn tab toàn trại | U, H, I | D26, SCR-14 |
| TC-03-36 | 23 lời mời PENDING, có lần gửi cuối bằng nhau | Mở trang 1/2, đảo sắp xếp | UI 20 dòng/trang; lastSentAt mới nhất trước, id giảm dần khi bằng; không trùng/mất dòng | U, H, I | D26, Table III-1 |
| TC-03-37 | PENDING có expiresAt bằng asOf, JOB-02 chưa chạy | Đọc/lọc/đếm | EXPIRED ngay trong response/counts, không có thao tác; DB status/version/audit không đổi | U, H, I | D26, JOB-02 |
| TC-03-38 | Owner, dịch vụ PENDING_PAYMENT/EXPIRED/SUSPENDED | Xem lời mời, hủy PENDING còn hạn | Đọc và hủy được; Mời/Gửi lại không khả dụng | U, H, I | D26, GBR-14 |
| TC-03-39 | Manager/Technician/Owner trại khác/membership INACTIVE/account SUSPENDED/anonymous | GET lời mời | Bị từ chối; không lộ email hoặc lời mời trại khác | U, H, I | GBR-09, D26 |
| TC-03-40 | Query status/page/size/sort/dir/ID sai | GET lời mời | 400 COM-10, đúng params.field; GET lỗi DB dùng COM-03, không lộ SQL | H, I | D26, MSG-COM-03/10 |
| TC-03-41 | Đã chọn tab/chiều sắp xếp; trại còn lưu mã múi giờ cũ khác `Asia/Ho_Chi_Minh` | Rời/quay lại, đổi trại, đọc thời điểm | Giữ lựa chọn đúng tài khoản/trại, trại khác mặc định mới; hiển thị theo UTC+07:00 | U | D26, D39, Table III-1 |
| TC-03-42 | Lỗi tải / kết quả rỗng / trang cuối bị hủy hết | Thử lại / Xóa bộ lọc / tải lại | Có đường phục hồi; về trang còn tồn tại; counts không tính riêng trang | U | D26, MSG-COM-03/04 |
| TC-03-43 | Lời mời xung đột UC1 nằm ngoài trang đầu | Tra theo invitationId | Đọc đúng lời mời/version; ID thuộc trại khác không trả item | U, H, I | D26, UC1 AF1 |
| TC-03-44 | Tài khoản mới tạo hoặc SUSPENDED trùng email mời | Đọc hasAccount | Phản ánh tồn tại hiện tại, không công bố trạng thái/xác minh/token | H, I | D25, D26 |
| TC-03-45 | Đã mở xác nhận Hủy; danh sách được làm mới với version mới | Xác nhận | Gửi version đã thấy khi mở xác nhận, không tự thay bằng version mới | U | D25, D26, BR-D31 |
| TC-03-46 | Lời mời PENDING trên SCR-14 | Bấm Hủy → Quay lại | Hộp thoại MSG-FE03-06 có email; Quay lại đóng hộp thoại, không gọi API | U | D27 |
| TC-03-47 | Lời mời đã gửi email | Gửi lại; gửi lặp cùng key | Link email trước bị từ chối (MSG-FE03-08), link mới mở được; cùng key trả kết quả đầu, không thêm email; 1 audit có giá trị trước/sau | H, I | D27, GBR-88, GBR-86 |
| TC-03-48 | Lời mời ACCEPTED / CANCELLED / EXPIRED, version cũ hoặc đúng | Gửi lại / Hủy | MSG-FE03-08 kèm trạng thái đó (không phải MSG-COM-05); version và audit không đổi | H, I | D27, UC-03 E2 |
| TC-03-49 | PENDING đúng hạn bằng now, JOB-02 chưa chạy | Gửi lại / Hủy | MSG-FE03-08 (EXPIRED); DB vẫn PENDING, hash, version, audit, email không đổi | H, I | D27, R-03-19 |
| TC-03-50 | Lời mời PENDING | Chấp nhận và Hủy cùng lúc | Đúng một lệnh thành công; Hủy thắng thì không có membership, Chấp nhận thắng thì Hủy nhận MSG-FE03-08 | I | D27, POST-2 |
| TC-03-51 | Manager / Technician / Owner trại khác; Owner trại khác dùng URL trại mình với ID lời mời trại này | Gửi lại / Hủy | 403 MSG-COM-01; 404 MSG-COM-08; lời mời không đổi | H, I | GBR-09, UC-03 E1 |
| TC-03-53 | Lời mời đã gửi lại | Người được mời mở SCR-15 | Hiện người mời, gửi lần cuối (không phải lần tạo), hạn theo UTC+07:00, `farmId` | H, U | D28, SCR-15 |
| TC-03-54 | Lời mời đã hủy / hết hạn (trước và sau JOB-02) / link sai | Mở link / Chấp nhận | MSG-FE03-08 kèm CANCELLED/EXPIRED và hạn; INVALID không có hạn; hash còn tới JOB-08; không tạo membership; email khác chỉ thấy MSG-FE03-09 | H, U | D28, Q6, JOB-08 |
| TC-03-55 | Đã chấp nhận | Mở lại link | Membership ACTIVE → trạng thái "đã tham gia" + Vào trại; membership INACTIVE → MSG-FE03-08 (ACCEPTED) | H, U | D28, AF2 |
| TC-03-56 | Chấp nhận thành công | JOB-07 chạy | Đúng 1 email tiếng Việt tới Owner ACTIVE (tên, email thành viên, trại, vai trò, link SCR-13); lỗi sau khi lưu rollback cả membership/audit/email; Owner bị tạm ngưng trước khi gửi → hủy email | I | D28, GBR-64, BR-D22 |
| TC-03-57 | Khách mở link khi chưa đăng nhập | Đăng nhập Google / xác minh email quay về trang khác | Mở lại đúng link lời mời một lần; link quá 24 giờ hoặc không phải SCR-15 bị bỏ | U | D28, UC-FE01-02 AF2 |
| TC-03-58 | Tài khoản chưa đăng ký Chủ trại | Đã có trại (Manager/Technician) / chưa có trại | Vào trang chủ của vai trò / mở SCR-07 | U | D28, UC-FE01-02 AF4 |
| TC-03-52 | SCR-14 | Gửi lại / Hủy bị MSG-FE03-08, MSG-COM-05 hoặc MSG-FE03-04; Hủy lỗi lưu | Hiện lý do (FE03-08 kèm trạng thái) và tải lại danh sách, không tự thử lại; lỗi lưu giữ hộp thoại và cùng key | U | D27, BR-D31, GBR-88 |
| TC-03-59 | Owner, trại có Owner, Quản lý, Kỹ thuật viên ACTIVE/INACTIVE và trại khác | Mở SCR-13 | Đủ dòng trại mình theo tên tiếng Việt; counts all/managers/technicians/inactive theo D29; `actions` đúng; không có lý do / ngày hiệu lực | H, I, U | D29, SCR-13 |
| TC-03-60 | Trại PENDING_PAYMENT/EXPIRED/SUSPENDED | Owner / Manager mở SCR-13 | Owner xem, chỉ còn Ngưng, Mời khóa; Manager MSG-COM-12 | H, I, U | D29, GBR-14 |
| TC-03-61 | Membership INACTIVE / tài khoản bị tạm ngưng / Owner trại khác / chưa đăng nhập | Gọi A1 | 403 MSG-COM-01 / 403 MSG-FE01-03 / 403 MSG-COM-01 / 401 | H, I | GBR-09 |
| TC-03-62 | Đăng ký trại; thành viên được đổi vai trò, ngưng, kích hoạt lại | Đọc A1 | `joinedAt` của Owner = lúc đăng ký, của thành viên = lúc chấp nhận; không đổi sau các lệnh UC6 | H, I | D29, SRS §3.2 |
| TC-03-63 | Dữ liệu trước D29 | Nâng cấp DB | `joined_at` lấy từ audit MEMBER_ACCEPT → FARM_REGISTER (Owner) → lời mời ACCEPTED cùng email → effective_date; cột NOT NULL; dữ liệu khác không đổi | I (PostgreSQL) | D29 |
| TC-03-64 | 2 và 12 thành viên | Gọi A1 | Số câu SQL như nhau (không N+1) | I | D29 |
| TC-03-65 | SCR-13 có 25 thành viên; tab rỗng; lỗi tải; rời màn rồi quay lại | Phân trang / Xóa bộ lọc / Thử lại / mở lại | 20 dòng/trang, đổi tab về trang 1; có đường phục hồi; giữ tab và chiều theo tài khoản + trại | U | D29, Table III-1 |
| TC-03-66 | Owner đổi vai trò / ngưng / kích hoạt lại | Lưu | 1 dòng `farm_membership_change` đủ trước/sau, ngày, lý do, người làm, thời điểm; audit có trước/sau, không có lý do / email; cùng key trả kết quả đầu, key cũ khác dữ liệu → COM-19 | H, I | D30, GBR-86/88 |
| TC-03-67 | Lỗi sau khi đã ghi trong cùng transaction | Lưu | Membership, lịch sử, audit đều không đổi | I (PostgreSQL) | D30, GBR-88 |
| TC-03-68 | Hai lệnh ngưng cùng lúc trên một thành viên | Lưu | Một thành công, một MSG-FE03-20 (PostgreSQL); đúng 1 dòng lịch sử | I (PostgreSQL) | D30 |
| TC-03-69 | Không phải Owner / membership trại khác / membership Owner với lý do sai | Lưu | MSG-COM-01 / MSG-COM-08 / MSG-COM-01 trước lỗi dữ liệu | H | D30 |
| TC-03-70 | Lý do 4 ký tự hiện / 501 ký tự / trống; ngày trống / ngày mai theo UTC+07:00 (mốc 17:00 UTC); đổi vai trò thiếu vai trò; đổi vai trò người INACTIVE | Lưu | COM-10 / COM-10 / COM-06; COM-06 / COM-07; COM-06 `role`; COM-10 `action` | U, H | D30, D39, Table III-1 |
| TC-03-71 | Đã INACTIVE / đã đúng vai trò, version cũ | Ngưng / đổi sang cùng vai trò | MSG-FE03-20 (không phải COM-05); không ghi gì | H | D30 |
| TC-03-72 | Manager có thông báo nháp và thông báo đã gửi | Bị ngưng | Manager không sửa được nháp; Owner không thấy nháp; Kỹ thuật viên vẫn thấy tên tác giả | H | AF2, POST-2 |
| TC-03-73 | Popup | Xác nhận / Quay lại / Hủy khi đã nhập / lỗi FE03-20, FE03-04, COM-05, COM-08 / lỗi mạng | Câu MSG-FE03-11/12/kích hoạt lại; MSG-COM-14; đóng popup và tải lại danh sách; lỗi mạng giữ popup và cùng key | U | D30 |
| TC-03-74 | Tài khoản có / không tên (Đ, ă, â…), vai trò platform ACTIVE / REVOKED, membership ACTIVE / INACTIVE, đã / chưa xác minh | SA mở SCR-16 | Tên tiếng Việt A→Z (chưa có tên theo email), đảo được; vai trò ACTIVE hoặc "Không có" + "CS đã thu hồi"; trại tham gia chỉ membership ACTIVE; xác minh đúng; không có SĐT | H, I (PostgreSQL), U | D31, SCR-16 |
| TC-03-75 | Tài khoản đủ trạng thái và vai trò | Lọc status / platformRole CS, PM, SA, NONE; tìm tên, email hoa thường; tìm SĐT; `%`, `_` | Đúng kết quả; NONE gồm REVOKED; SĐT không khớp; `%` `_` là ký tự thường | H, I, U | D31 |
| TC-03-76 | 5 tài khoản, 2 trùng tên | `size=2`, trang 0–3, `dir=desc` | Trang từ 0, total sau lọc, trùng tên theo email, desc đảo cả thứ tự | H, I | D31, Table III-1 |
| TC-03-77 | — | status / platformRole / page / size / sort / dir sai, sai kiểu, q 101 ký tự | 400 MSG-COM-10 đúng `params.field` | H | D31 |
| TC-03-78 | CS, PM, SA đã thu hồi, Owner, SA bị tạm ngưng, chưa đăng nhập | Gọi A9, A10 | 403 MSG-COM-01 / 403 MSG-FE01-03 / 401 | H | Permission Matrix, GBR-09/10 |
| TC-03-79 | Tài khoản Google + mật khẩu sở hữu 2 trại; tài khoản chờ xác minh; id không tồn tại | Gọi A10 | createdAt, đăng nhập cuối mới hơn, signInMethods, trại sở hữu theo tên, farmCount/farmRoles; "Chưa xác minh", chưa đăng nhập; 404 MSG-COM-08; không có SĐT / Google subject | H, I | D31, GBR-11 |
| TC-03-80 | 2 và 12 tài khoản có quyền platform, membership, identity | Gọi A9 | Số câu SQL như nhau (không N+1) | I | D31 |
| TC-03-81 | Dữ liệu trước D31 | Nâng cấp DB | `created_at` từ `jhi_user.created_date` → liên kết sớm nhất → chấp nhận điều khoản → lúc nâng cấp; NOT NULL, có default; cột khác không đổi | I (PostgreSQL) | D31 |
| TC-03-82 | SCR-16 | Đảo sắp xếp, 20 dòng/trang, rỗng + Xóa bộ lọc, rời rồi quay lại, mở link tới tài khoản ngoài trang đang lọc, id không còn | Giữ bộ lọc / chiều trong phiên; chi tiết đúng tài khoản trên URL, giờ Asia/Ho_Chi_Minh; MSG-COM-08 trong khung chi tiết | U | D31, Table III-1 |
| TC-03-83 | Tài khoản PM ACTIVE, là Manager ACTIVE của một trại | SA tạm ngưng với lý do có khoảng trắng đầu cuối | ACTIVE → SUSPENDED, version tăng, `actions=[RESTORE]`; 1 dòng `app_user_status_change` (SUSPEND, lý do đã bỏ khoảng trắng, SA); 1 audit trước / sau không có lý do; vai trò PM và membership giữ nguyên; request kế tiếp của tài khoản → 403 MSG-FE01-03 (phiên đã đăng ký → hết hạn, 401; đăng nhập lại → 403 MSG-FE01-03); tài khoản có login trùng email không lỗi 500 | H, I, runtime | D32, GBR-04, GBR-86 |
| TC-03-84 | Tài khoản SUSPENDED chưa xác minh, quyền CS REVOKED, membership INACTIVE | SA khôi phục | ACTIVE, `actions=[SUSPEND]`; quyền vẫn REVOKED, membership vẫn INACTIVE; 1 dòng RESTORE + audit | H, I | D32, GBR-04 |
| TC-03-85 | CS / ẩn danh / SA; id không tồn tại; lý do "a b c d", 501 ký tự, trống; thiếu version / key; chính mình; đã ở trạng thái với version cũ; version cũ | Gọi A12 | COM-01 trước COM-08; 401; COM-08 trước lý do; COM-10 / COM-10 / COM-06 (`reason`); COM-06 `version` / `Idempotency-Key`; FE03-17 (sau lý do), A10 của chính mình `actions=[]`; FE03-20 `{target, value=status}` trước COM-05; COM-05; không ghi gì | H | D32 |
| TC-03-86 | CS đang giữ phiếu | Tạm ngưng; lặp cùng key; cùng key khác lý do; lỗi sau khi đã ghi | Tài khoản, lịch sử, audit, phiếu về hàng đợi cùng commit; cùng key trả kết quả đầu, không ghi thêm; COM-19; lỗi → tất cả không đổi | I (H2, PostgreSQL) | D32, GBR-88 |
| TC-03-87 | Chỉ còn 2 SA ACTIVE, A đang giữ khóa lệnh tạm ngưng B | B tạm ngưng A | Lệnh của B chờ khóa dòng, sau khi A commit bị 403 MSG-COM-01; A ACTIVE, B SUSPENDED, đúng 1 SA ACTIVE; bỏ khóa dòng SA đang thao tác thì test đỏ | I (PostgreSQL) | D32, BR-D06 |
| TC-03-88 | CS giữ phiếu IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED; CS khác giữ 1 phiếu | Tạm ngưng CS | 3 phiếu chưa CLOSED về hàng đợi, trạng thái không đổi, 3 lịch sử AUTO_REQUEUE; phiếu CLOSED và phiếu của CS khác không đổi | H, I | D32, GBR-77, TC-03-31 |
| TC-03-89 | Ticket có yêu cầu nội bộ OPEN và DONE gửi PM | Tạm ngưng rồi khôi phục PM; CS mở ticket | OPEN: `needsReassignment` false → true → false; DONE luôn false; SCR-68 hiện "Người nhận không còn khả dụng – cần đổi người nhận" | H, U | D32, UC-08 bước 6 |
| TC-03-90 | SCR-16 | Tài khoản của chính mình; lý do 3 ký tự; xác nhận; lỗi nghiệp vụ; lỗi lưu rồi thử lại | Không có ô lý do / nút Tạm ngưng; lý do bị chặn trước hộp thoại; MSG-FE03-14 / 15 / 16; hộp thoại đóng, lý do hiện trên khung chi tiết, tải lại, giữ lý do; lỗi lưu giữ hộp thoại và cùng key | U | D32 |
| TC-03-91 | Tài khoản đã xác minh, chưa có quyền | Cấp PM → đổi sang CS → thu hồi → khôi phục | Mỗi bước 200, `accessActions` đúng trạng thái; 4 dòng `platform_access_change` (trước / sau, lý do đã bỏ khoảng trắng, SA); A11 mới nhất trước; 4 audit không có lý do; request kế tiếp của người đó theo quyền mới (PM vào được `/api/platform/farms`, CS thì 403 COM-01) | H, I | D33, POST-2 |
| TC-03-92 | CS gọi; id lạ; operation / role sai; thiếu role; lý do "a b c d" / trống; thiếu key; quyền của chính mình; Cấp đúng vai trò đang có (version cũ); Cấp vai trò khác khi đang có quyền; Đổi sang cùng vai trò; Khôi phục khi ACTIVE; Đổi / Thu hồi khi chưa có quyền; version cũ | Gọi A13 | COM-01 trước COM-08; COM-08 trước dữ liệu; 401; COM-10 / COM-06 đúng `field`; COM-01 (sau lý do), A10 của chính mình `accessActions=[]`; FE03-20 `value=role`; COM-05; FE03-20; FE03-20 `value=status`; COM-05; COM-05; không ghi gì | H | D33 |
| TC-03-93 | Tài khoản PM bị tạm ngưng; tài khoản bị tạm ngưng chưa có quyền; chưa xác minh; chưa xác minh có quyền REVOKED | A10, Cấp / Đổi / Khôi phục / Thu hồi | `accessActions` [REVOKE] / [] / [] / []; Cấp, Đổi → FE03-22 `{email}`; Cấp, Khôi phục chưa xác minh → FE03-18; Thu hồi PM bị tạm ngưng 200 | H | D33 Q3, FE-03 Q4 |
| TC-03-94 | CS giữ phiếu IN_PROGRESS và CLOSED; CS khác giữ phiếu WAITING; PM nhận yêu cầu nội bộ OPEN | Thu hồi CS; đổi CS kia sang PM; thu hồi PM | Phiếu chưa CLOSED về hàng đợi (lịch sử `CS_ACCESS_REMOVED`), CLOSED giữ nguyên; `needsReassignment=true` | H, I | D33, GBR-77, TC-03-29, TC-03-31 |
| TC-03-95 | CS giữ phiếu | Thu hồi; lặp cùng key; cùng key khác lý do; lỗi sau khi đã ghi | Quyền, lịch sử, audit, phiếu commit cùng nhau; cùng key trả kết quả đầu; COM-19; lỗi → tất cả không đổi | I (H2, PostgreSQL) | D33, GBR-88 |
| TC-03-96 | Chỉ còn 2 SA ACTIVE, A đang giữ khóa lệnh thu hồi quyền SA của B | B thu hồi quyền SA của A | Lệnh của B chờ khóa, sau khi A commit bị 403 COM-01; còn đúng 1 SA ACTIVE; bỏ khóa dòng SA đang thao tác thì test đỏ | I (PostgreSQL) | D33, BR-D06 |
| TC-03-97 | Audit `PLATFORM_ACCESS_*` cũ (có / không lý do, không người làm), audit tạm ngưng, details không phải JSON | Nâng cấp DB | Chép 3 dòng đúng hành động, vai trò / trạng thái (NONE → trống), lý do (thiếu → "(không ghi lý do)"), người làm, thời điểm; bỏ qua audit tạm ngưng và details hỏng; audit giữ nguyên | I (PostgreSQL) | D33 Q2 |
| TC-03-98 | SCR-16 | Nút Quyền nền tảng; link cũ `/nen-tang/quyen/{id}`; lý do trống / 3 ký tự; thu hồi; tài khoản chưa xác minh / của chính mình / bị tạm ngưng; hủy khi đã nhập; lỗi lưu rồi thử lại; lỗi nghiệp vụ | Popup trên SCR-16; MSG-FE03-19; lịch sử có người làm ("Hệ thống" khi trống); chỉ xem lịch sử + lý do; MSG-COM-14; cùng key; đóng popup và tải lại | U | D33 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | UC-01 AF2 (email của thành viên INACTIVE): SRS không có mã thông báo | Đã chốt D25 (11/11/2026): MSG-FE03-21 kèm nút mở popup, ngày/lý do bắt buộc, giữ vai trò hiện tại |
| Q2 | UC-FE03-02, 05, 07 không có đặc tả Part II; luồng suy từ SCR | Đã chốt UC2 theo D26 (12/11/2026), UC5 theo D29 và UC7 theo D31 (14/11/2026); luồng ở mục 5 |
| Q3 | Đổi vai trò với ngày hiệu lực trong quá khứ: quyền áp dụng ngay hay tính lại quá khứ? | Đã chốt D30 (14/11/2026): áp dụng từ request kế tiếp; ngày hiệu lực chỉ để ghi lịch sử, chỉ chặn ngày tương lai theo múi giờ trại (từ D39, 17/11/2026: theo UTC+07:00) |
| Q4 | Tài khoản bị tạm ngưng có được nhận lời mời / được cấp quyền platform không? | Phần lời mời đã chốt D25: được nhận nếu chưa có membership; chỉ chấp nhận sau khi khôi phục và còn hạn. Phần quyền platform chốt D33 (14/11/2026): chỉ còn Thu hồi; Cấp / Đổi / Khôi phục → MSG-FE03-22 |
| Q5 | Sidebar SA có mục riêng "Quyền nhân sự nền tảng" theo Figma; SRS SCR-16 coi đây là popup của Tài khoản người dùng | Đã chốt D33 (14/11/2026): theo SRS, bỏ trang và mục sidebar; popup mở trên SCR-16, link cũ chuyển hướng |
| Q6 | Link của lời mời đã Hủy / hết hạn: SCR-15 phải hiện MSG-FE03-08 kèm trạng thái và hạn (SRS dòng 3146), JOB-08 chỉ xóa hash sau 7 ngày (dòng 5628), nhưng code xóa hash ngay khi Hủy / JOB-02 nên SCR-15 chỉ báo "Liên kết không hợp lệ" | Đã chốt D28 (14/11/2026): giữ hash tới JOB-08; backend trả FE03-08 kèm trạng thái và hạn; SCR-15 hiển thị |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho DucNV duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 17/11/2026 | 28/10/2026 | Áp dụng D39: ngày giờ FE-03 theo UTC+07:00 cố định thay cho múi giờ riêng của trại | DucNV |
