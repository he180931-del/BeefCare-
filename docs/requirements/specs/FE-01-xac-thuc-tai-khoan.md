# SPEC FE-01 – Xác thực và truy cập tài khoản

| | |
|---|---|
| Feature | FE-01 Authentication and Account Access |
| Use case | UC-FE01-01 → UC-FE01-06 |
| Người phụ trách | LamKD (BE + FE + test) · Review BE: DucNV · Review FE: AnNT |
| Nguồn duy nhất | SRS Report 3 bản 28/10/2026: Part I §3.2 (User Account), §3.3 (BR-D02, BR-D03), Part II §1, Part III §1 (SCR-02 → SCR-08, popup Đổi mật khẩu), bảng MSG, GBR-01 → GBR-05, GBR-09, GBR-87; API-04, API-05 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> **Nguyên tắc của bộ spec này:** mọi dòng đều lấy từ SRS và ghi rõ nguồn. Spec **không** dựa vào code hay giao diện đã sinh. Code hiện có được rà lại theo spec, không làm ngược lại.
> Nhãn tiếng Việt trên màn hình là đề xuất; khi làm, đối chiếu lại với Figma tab 01.
> Chỗ nào SRS không nói thì ghi ở mục 10 "Điểm SRS chưa rõ", không tự bịa.

---

## 1. Phạm vi

| UC | Tên | Tác nhân chính | Màn hình |
|---|---|---|---|
| UC-FE01-01 | Đăng ký tài khoản Chủ trại | Khách | SCR-01, SCR-03, SCR-04, SCR-07 |
| UC-FE01-02 | Đăng nhập | Khách | SCR-02, SCR-09 |
| UC-FE01-03 | Đăng xuất | Mọi người đã đăng nhập | Menu người dùng trên thanh trên cùng |
| UC-FE01-04 | Xem và sửa hồ sơ của tôi | Mọi người đã đăng nhập | SCR-08 |
| UC-FE01-05 | Đặt lại mật khẩu đã quên | Khách | SCR-02, SCR-05, SCR-06 |
| UC-FE01-06 | Đổi mật khẩu / thêm mật khẩu đầu tiên | Mọi người đã đăng nhập | SCR-08, popup Đổi mật khẩu |

**Dịch vụ ngoài:** API-05 Đăng nhập Google (OAuth 2.0 / OpenID Connect), API-04 Gửi email.

**Ngoài phạm vi:** Đăng ký trại (UC-FE02-01, SCR-10), Chọn trại (SCR-09, FE-02), Chấp nhận lời mời (UC-FE03-04, SCR-15), Tạm ngưng / khôi phục tài khoản (UC-FE03-08, do System Admin).

---

## 2. Vai trò và quyền

| Hành động | Khách | Owner / Manager / Technician | CS / PM / SA | Nguồn |
|---|---|---|---|---|
| Đăng ký, đăng nhập, quên mật khẩu | Có | — | — | Role lists P435 |
| Đăng xuất, xem / sửa hồ sơ, đổi mật khẩu | — | Có | Có | Role lists P439–P459 |
| Tài khoản SUSPENDED | Không đăng nhập được bằng bất kỳ cách nào; phiên đang mở bị từ chối ở request kế tiếp | | | GBR-04 |
| Mọi request cần đăng nhập | Kiểm tra lại trạng thái tài khoản, membership, vai trò và trạng thái dịch vụ trại ở **mỗi** request | | | GBR-09 |

---

## 3. Dữ liệu (SRS Part I §3.2 – User Account)

### 3.1 Tài khoản người dùng (User Account)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Họ tên (full name) | Chuỗi | Có | 2–100 ký tự | §3.2, SCR-03 |
| Email đã xác minh (email) | Chuỗi | Có | Định dạng email, ≤ 254 ký tự; **duy nhất toàn hệ thống, không phân biệt hoa thường** | §3.2, BR-D02, GBR-01 |
| Số điện thoại liên hệ (contact phone) | Chuỗi | Không | 10 chữ số bắt đầu bằng 0, hoặc `+84` + 9 chữ số. **Chỉ để liên hệ, không bao giờ dùng để định danh hay phân quyền** | §3.2, SCR-07, GBR-01 |
| Trạng thái (account status) | Enum | Có | `ACTIVE`, `SUSPENDED` | §3.2 |
| Đã hoàn tất đăng ký Owner | Boolean + thời điểm | Có | Mặc định `false` | §3.2, GBR-05 |
| Đã chấp nhận điều khoản | Boolean + thời điểm | Có khi hoàn tất đăng ký Owner | — | SCR-03, SCR-07, GBR-05 |
| Lần đăng nhập cuối | Thời điểm | Không | — | §3.2 |
| Thời điểm tạo | Thời điểm | Có | — | §3.2 |

**Vòng đời:** tạo `ACTIVE` ở lần đăng nhập Google đầu tiên, hoặc khi email đăng ký được xác minh. `ACTIVE ⇄ SUSPENDED` do System Admin, có lý do. **Không bao giờ xóa** khi đã có membership, trại hoặc lịch sử.

### 3.2 Phương thức đăng nhập (Sign-in Method – chi tiết của tài khoản)

| Thuộc tính | Kiểu | Ràng buộc | Nguồn |
|---|---|---|---|
| Loại | Enum `GOOGLE` / `PASSWORD` | Mỗi tài khoản tối đa 1 phương thức mỗi loại | §3.2 |
| Google subject | Chuỗi (chỉ GOOGLE) | Duy nhất; thuộc đúng 1 tài khoản; **không bao giờ gắn lại sang tài khoản khác** | §3.2, BR-D03 |
| Mật khẩu (hash) | Chuỗi (chỉ PASSWORD) | Chỉ lưu hash một chiều có salt; không bao giờ hiển thị, ghi log hay trả về | GBR-02 |
| Trạng thái mật khẩu | Enum | `PENDING_VERIFICATION` (sau đăng ký email) → `ACTIVE` (sau xác minh); bị thay khi đổi / đặt lại | §3.2 |
| Số lần sai liên tiếp | Số nguyên | Đặt về 0 khi đăng nhập đúng hoặc đặt lại mật khẩu | §3.2, GBR-02 |
| Khóa đến | Thời điểm | Sai 5 lần liên tiếp → khóa đăng nhập bằng mật khẩu 15 phút | GBR-02 |
| Thời điểm liên kết, lần dùng cuối | Thời điểm | — | §3.2 |

### 3.3 Liên kết qua email (token)

| Loại | Hiệu lực | Quy tắc | Nguồn |
|---|---|---|---|
| Xác minh email | 24 giờ | Ngẫu nhiên, dùng 1 lần, chỉ lưu hash; phát link mới làm link cũ cùng loại hết hiệu lực | GBR-03 |
| Đặt lại mật khẩu | 30 phút | Như trên | GBR-03 |
| Giới hạn gửi lại | Tối đa 5 email / giờ / địa chỉ; nút gửi lại khóa 60 giây sau mỗi lần gửi | SCR-04, UC-01 AF4, UC-05 AF2 |

### 3.4 Phiên đăng nhập (session)

| Thuộc tính | Giá trị | Nguồn |
|---|---|---|
| Không chọn "Ghi nhớ đăng nhập" | Hết hạn sau 8 giờ không hoạt động | UC-02 bước 4, SCR-02 |
| Chọn "Ghi nhớ đăng nhập" | Giữ tối đa 30 ngày | UC-02 bước 4, SCR-02 |
| Đăng xuất | Kết thúc phiên, xóa trại đang chọn trên thiết bị | UC-FE01-03 |
| Đổi mật khẩu | Giữ phiên hiện tại, kết thúc **các phiên khác** | UC-06 bước 4 |
| Đặt lại mật khẩu | Kết thúc **mọi** phiên | UC-05 bước 7 |

---

## 4. Quy tắc nghiệp vụ

Mỗi quy tắc viết thành câu kiểm được. Mã `R-01-xx` dùng để nối với test ở mục 9.

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-01-01 | Một người có đúng một tài khoản, định danh bằng email đã xác minh (không phân biệt hoa thường). Danh tính Google và mật khẩu BeefCare cùng email thuộc cùng một tài khoản. | GBR-01, BR-D02 |
| R-01-02 | Một Google subject thuộc đúng một tài khoản và không bao giờ được gắn lại sang tài khoản khác. | BR-D03 |
| R-01-03 | Mật khẩu dài 8–128 ký tự và không được trùng email. | GBR-02 |
| R-01-04 | Sai mật khẩu 5 lần liên tiếp → khóa đăng nhập bằng mật khẩu 15 phút; đăng nhập Google vẫn dùng được. Sai mật khẩu hiện tại khi đổi mật khẩu cũng được tính. | GBR-02, UC-06 E1 |
| R-01-05 | Mật khẩu chỉ lưu dạng hash có salt; không hiển thị, không ghi log, không trả về trong bất kỳ response nào. | GBR-02, UC-06 |
| R-01-06 | Link xác minh hiệu lực 24 giờ, link đặt lại 30 phút; dùng 1 lần; link mới vô hiệu link cũ cùng loại. | GBR-03 |
| R-01-07 | Yêu cầu đặt lại mật khẩu luôn trả cùng một phản hồi, dù email có tồn tại hay không. | GBR-03, UC-05 |
| R-01-08 | Chỉ tài khoản ACTIVE đăng nhập được. SUSPENDED bị chặn mọi phương thức; phiên đang mở bị từ chối ở request kế tiếp. Khôi phục tài khoản không khôi phục vai trò / membership đã thu hồi. | GBR-04 |
| R-01-09 | Tài khoản SUSPENDED vẫn đặt lại được mật khẩu, nhưng vẫn không đăng nhập được. | UC-05 E3 |
| R-01-10 | Khách chỉ trở thành Chủ trại khi hoàn tất đăng ký Owner (họ tên + chấp nhận điều khoản). Việc này **không** tạo trại, membership, vai trò platform hay gói dịch vụ. | GBR-05, UC-01 POST-3 |
| R-01-11 | Đăng nhập không bao giờ tự chấp nhận lời mời, khôi phục quyền đã thu hồi hay đổi gói dịch vụ. | UC-02 POST-2 |
| R-01-12 | Trại đang chọn trong trình duyệt, link, thông báo hay mã QR không bao giờ là bằng chứng quyền; quyền được kiểm lại ở mỗi request. | GBR-09 |
| R-01-13 | Thêm mật khẩu đầu tiên cho tài khoản chỉ dùng Google: phải xác thực lại Google trong vòng 5 phút trước đó; mật khẩu có hiệu lực ngay (email đã xác minh). | UC-06 AF1 |
| R-01-14 | Tài khoản chỉ dùng Google yêu cầu đặt lại mật khẩu: email gửi đi khuyên đăng nhập bằng Google, không tạo mật khẩu. | UC-05 AF1 |
| R-01-15 | Lỗi gửi email hoặc lỗi lưu: không lưu dở dang bất kỳ phần nào (MSG-COM-02). | UC-01 E6, UC-05 E4, UC-06 E4 |

---

## 5. Luồng xử lý

### UC-FE01-01 Đăng ký tài khoản Chủ trại

**Luồng chính (Google):**
1. Khách mở SCR-03, bấm **Tiếp tục với Google**.
2. Hệ thống chuyển sang Google (API-05); khách xác thực và đồng ý.
3. Google trả về subject, email đã xác minh, họ tên.
4. Hệ thống tìm tài khoản theo Google subject, rồi theo email. Không có → tạo tài khoản `ACTIVE` với email đó và gắn danh tính Google (R-01-01).
5. Hệ thống đăng nhập người dùng và mở SCR-07: email chỉ đọc, họ tên điền sẵn từ Google.
6. Khách xác nhận họ tên, nhập SĐT (không bắt buộc), tick điều khoản, bấm **Hoàn tất và đăng ký trại**.
7. Hệ thống kiểm tra trường, đánh dấu đã hoàn tất đăng ký Owner, mở SCR-10.

**Luồng phụ:**
- **AF1 – Đăng ký bằng email:** nhập họ tên, email, mật khẩu, xác nhận, tick điều khoản → **Tạo tài khoản** → hệ thống kiểm tra (R-01-03), kiểm email chưa có tài khoản → tạo tài khoản với mật khẩu `PENDING_VERIFICATION`, gửi link 24 giờ (API-04) → SCR-04 + MSG-FE01-04 → khách mở link → hệ thống kích hoạt tài khoản và mật khẩu, đăng nhập, sang bước 5 (họ tên đã nhập sẵn).
- **AF2 – Tài khoản đã có (bước 4):** dùng lại tài khoản. Đã hoàn tất đăng ký Owner → mở SCR-09; chưa → bước 5.
- **AF3 – Rời đi trước bước 6:** tài khoản vẫn còn; lần đăng nhập sau mở lại SCR-07.
- **AF4 – Gửi lại email xác minh:** link cũ bị vô hiệu, gửi link mới; tối đa 5 email / giờ / địa chỉ.

**Ngoại lệ:**

| Mã | Tình huống | Kết quả |
|---|---|---|
| E1 | Hủy / không hoàn tất đăng nhập Google | MSG-FE01-12; không tạo tài khoản |
| E2 | AF1 với email đã có tài khoản | MSG-FE01-10 kèm link Đăng nhập và Quên mật khẩu; không tạo tài khoản thứ hai |
| E3 | Trường không hợp lệ | MSG-COM-06, MSG-COM-10, MSG-FE01-08, MSG-FE01-09 hoặc MSG-FE01-14 dưới trường |
| E4 | Link xác minh hết hạn / đã dùng | MSG-FE01-06 kèm Gửi link mới |
| E5 | Tài khoản SUSPENDED | Trạng thái "Tài khoản bị tạm ngưng" (MSG-FE01-03); không tạo phiên |
| E6 | Lỗi gửi email / lỗi lưu | MSG-COM-02; không lưu dở dang |

### UC-FE01-02 Đăng nhập

**Luồng chính (email + mật khẩu):**
1. Khách mở SCR-02, nhập email, mật khẩu, tùy chọn **Ghi nhớ đăng nhập**, bấm **Đăng nhập**.
2. Hệ thống kiểm tra: tài khoản tồn tại, mật khẩu `ACTIVE` (email đã xác minh), không bị khóa, mật khẩu khớp hash (R-01-03, R-01-04).
3. Kiểm tra tài khoản `ACTIVE` (R-01-08); đặt lại bộ đếm sai về 0.
4. Tạo phiên (mục 3.4).
5. Xác định vai trò platform hiện tại và các membership `ACTIVE`.
6. Mở màn hình đích theo **thứ tự ưu tiên** (SCR-02):
   1. Trang đã yêu cầu trước khi đăng nhập, nếu vẫn còn quyền;
   2. SCR-15 nếu bắt đầu từ link lời mời;
   3. SCR-07 nếu chưa hoàn tất đăng ký Owner;
   4. Màn hình chính của nhân viên platform: CS → SCR-67, PM → SCR-12, SA → SCR-16;
   5. Màn hình chính của trại nếu có đúng 1 trại ACTIVE: Owner / Manager → SCR-48, Technician → SCR-74;
   6. Còn lại → SCR-09 Chọn trại.

**Luồng phụ:**
- **AF1 – Tiếp tục với Google:** chuyển sang Google, tìm tài khoản theo subject hoặc email; không có → tạo tài khoản `ACTIVE` **chưa** đăng ký Owner, sang bước 4.
- **AF2 – Bắt đầu từ link lời mời:** sang UC-FE03-04.
- **AF3 – Không có trại, không có vai trò platform:** MSG-FE01-15 kèm "Đăng ký làm Chủ trại" (sang UC-01 bước 5) và hướng dẫn mở email lời mời.
- **AF4 – Đăng ký Owner chưa xong:** mở SCR-07.
- **AF5 – Quên mật khẩu:** sang UC-FE01-05.
- **AF6 – Email chưa xác minh:** MSG-FE01-11 kèm "Gửi lại email xác minh".

**Ngoại lệ:**

| Mã | Tình huống | Kết quả |
|---|---|---|
| E1 | Sai email hoặc mật khẩu | MSG-FE01-01 (không nói rõ sai cái nào); tính 1 lần sai |
| E2 | Sai 5 lần liên tiếp | Khóa 15 phút, MSG-FE01-02 kèm thời điểm mở khóa; Google vẫn dùng được |
| E3 | Tài khoản SUSPENDED | Trạng thái "Tài khoản bị tạm ngưng" (MSG-FE01-03) kèm liên hệ chính thức (GBR-87); không tạo phiên |
| E4 | Google bị hủy / lỗi | MSG-FE01-12 |
| E5 | Trại đã yêu cầu không còn quyền | MSG-COM-01 và hiện các trại còn quyền |
| E6 | Dịch vụ không khả dụng | MSG-COM-03; không tạo phiên |

### UC-FE01-03 Đăng xuất
Người dùng chọn **Đăng xuất** trong menu người dùng (mọi màn hình đã đăng nhập) → hệ thống kết thúc phiên, xóa trại đang chọn trên thiết bị → mở SCR-02.

### UC-FE01-04 Xem và sửa hồ sơ của tôi
1. Người dùng mở SCR-08: họ tên, "vai trò tại tên trại" (hoặc vai trò platform), email đăng nhập và trạng thái xác minh, phương thức đăng nhập, bảng quyền của vai trò trong trại hiện tại (Table III-2).
2. Sửa họ tên và / hoặc SĐT → **Lưu hồ sơ** → kiểm tra → lưu → MSG-FE01-13.
Email **không** sửa được. Nhân viên platform thấy vai trò platform thay cho bảng quyền trại.

### UC-FE01-05 Đặt lại mật khẩu đã quên
1. Khách nhập email ở SCR-05, bấm **Gửi link đặt lại**.
2. Hệ thống **luôn** hiện cùng thông báo MSG-FE01-05 (R-01-07). Chỉ khi email có mật khẩu `ACTIVE` mới tạo link 30 phút và vô hiệu link cũ.
3. Gửi email (API-04).
4. Khách mở link → hệ thống kiểm tra link chưa dùng, chưa hết hạn → SCR-06 với email chỉ đọc.
5. Nhập mật khẩu mới + xác nhận → **Lưu mật khẩu mới**.
6. Hệ thống kiểm tra (R-01-03), lưu hash, đánh dấu link đã dùng, kết thúc mọi phiên, xóa khóa, gửi email "đã đổi mật khẩu".
7. Mở SCR-02 với MSG-FE01-07.

AF1 tài khoản chỉ có Google (R-01-14) · AF2 gửi lại (tối đa 5 / giờ) · AF3 quay lại đăng nhập.
E1 link hết hạn / đã dùng → trạng thái "Link không còn hiệu lực" (MSG-FE01-06) · E2 mật khẩu sai quy tắc → MSG-FE01-08 / 09, mật khẩu cũ giữ nguyên · E3 SUSPENDED → đặt lại được, vẫn không đăng nhập được · E4 lỗi gửi / lưu → MSG-COM-02.

### UC-FE01-06 Đổi mật khẩu / thêm mật khẩu đầu tiên
1. Người dùng bấm **Đổi mật khẩu** ở SCR-08 → popup.
2. Nhập mật khẩu hiện tại, mật khẩu mới, xác nhận → **Lưu**.
3. Kiểm tra mật khẩu hiện tại (sai được tính vào khóa, R-01-04), kiểm tra mật khẩu mới.
4. Lưu hash mới, giữ phiên hiện tại, kết thúc các phiên khác, gửi email "đã đổi mật khẩu".
5. Đóng popup, MSG-FE01-07.

AF1 **Thêm mật khẩu** (tài khoản chưa có mật khẩu): xác thực lại Google trong 5 phút; popup chỉ hỏi mật khẩu mới + xác nhận (R-01-13) · AF2 quên mật khẩu hiện tại → xác thực lại Google, hoặc đăng xuất và dùng UC-05 · AF3 Hủy → không đổi gì.
E1 sai mật khẩu hiện tại → MSG-FE01-16; sau 5 lần → MSG-FE01-02 · E2 mật khẩu mới sai quy tắc → MSG-FE01-08 / 09 · E3 phiên hết hạn → phải đăng nhập lại, không lưu · E4 lỗi lưu → MSG-COM-02, giữ mật khẩu cũ.

---

## 6. Màn hình và trường

Cột **Bắt buộc**: `*` theo SRS. Cột **Lỗi** ghi mã MSG ở mục 8. Kiểm tra dữ liệu làm **cả ở FE (để báo sớm) lẫn BE (quyết định cuối cùng)**.

### SCR-02 Đăng nhập

| # | Trường (SRS / VN đề xuất) | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi | Hành vi |
|---|---|---|---|---|---|---|---|
| 1 | Continue with Google / Tiếp tục với Google | Nút | — | — | — | MSG-FE01-12 | Bắt đầu đăng nhập Google (API-05) |
| 2 | Email | Ô chữ | * | Định dạng email, ≤ 254, không phân biệt hoa thường (trim 2 đầu) | Trống | MSG-COM-06, MSG-COM-10 | — |
| 3 | Password / Mật khẩu | Ô mật khẩu + nút hiện / ẩn | * | ≤ 128 ký tự | Trống | MSG-COM-06 | Không trim |
| 4 | Remember me / Ghi nhớ đăng nhập | Checkbox | — | — | Tắt | — | Bật: phiên 30 ngày; tắt: 8 giờ không hoạt động |
| 5 | Forgot password? / Quên mật khẩu? | Link | — | — | — | — | Sang SCR-05 |
| 6 | Sign in / Đăng nhập | Nút | — | — | — | MSG-FE01-01 (trên form), MSG-FE01-02, MSG-FE01-11, MSG-FE01-15, MSG-COM-03 | Thành công → màn hình đích theo thứ tự ở UC-02 bước 6 |
| 7 | Register / Chưa có tài khoản Chủ trại? Đăng ký | Link | — | — | — | — | Sang SCR-03 |
| **Trạng thái: Tài khoản bị tạm ngưng** | | | | | | | |
| 8 | Message / Thông báo | Chữ | — | — | — | MSG-FE01-03 kèm email | — |
| 9 | Contact BeefCare / Liên hệ BeefCare | Chữ | — | `tuanpqhe181869@fpt.edu.vn`, `0386 671 863` | — | — | GBR-87 |
| 10 | Back to sign in / Quay lại đăng nhập | Link | — | — | — | — | Về SCR-02 |

### SCR-03 Đăng ký Chủ trại

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi | Hành vi |
|---|---|---|---|---|---|---|---|
| 1 | Continue with Google / Tiếp tục với Google | Nút | — | — | — | MSG-FE01-12 | Đăng nhập Google → SCR-07 |
| 2 | Full name / Họ tên | Ô chữ | * | 2–100 ký tự (sau trim) | Trống | MSG-COM-06, MSG-COM-10 | — |
| 3 | Email | Ô chữ | * | Định dạng email, ≤ 254; chưa có tài khoản | Trống | MSG-COM-06, MSG-COM-10, MSG-FE01-10 | — |
| 4 | Password / Mật khẩu | Ô mật khẩu | * | 8–128 ký tự, khác email | Trống | MSG-COM-06, MSG-FE01-08 | — |
| 5 | Confirm password / Xác nhận mật khẩu | Ô mật khẩu | * | Bằng trường 4 | Trống | MSG-COM-06, MSG-FE01-09 | — |
| 6 | I agree to the Terms of Use and Data Policy / Tôi đồng ý Điều khoản sử dụng và Chính sách dữ liệu | Checkbox + 2 link | * | Phải tick | Không tick | MSG-FE01-14 | — |
| 7 | Create account / Tạo tài khoản | Nút | — | — | — | MSG-COM-02 | Tạo tài khoản chờ xác minh, gửi link (GBR-03) → SCR-04 |
| 8 | Sign in / Đã có tài khoản? Đăng nhập | Link | — | — | — | — | Sang SCR-02 |

### SCR-04 Xác minh email

| # | Trường | Loại | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|
| 1 | Message / Thông báo | Chữ | MSG-FE01-04 kèm email | — | — |
| 2 | Resend verification email / Gửi lại email xác minh | Nút | Khóa 60 giây sau mỗi lần gửi; tối đa 5 lần / giờ / email; link mới vô hiệu link cũ | MSG-COM-02 | — |
| 3 | Back to sign in / Quay lại đăng nhập | Link | — | — | Sang SCR-02 |
| 4 | Verification link (trong email) | Link | 24 giờ, dùng 1 lần | MSG-FE01-06 kèm "Gửi link mới" | Mở SCR-07 |

### SCR-05 Quên mật khẩu

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Email | Ô chữ | * | Định dạng email, ≤ 254 | MSG-COM-06, MSG-COM-10 | — |
| 2 | Send reset link / Gửi link đặt lại | Nút | — | — | — | Chuyển sang trạng thái "Kiểm tra email" với MSG-FE01-05 (**giống nhau mọi trường hợp**) |
| 3 | Resend / Gửi lại | Nút (ở trạng thái xác nhận) | — | Giới hạn như SCR-04 | — | — |
| 4 | Back to sign in / Quay lại đăng nhập | Link | — | — | — | Sang SCR-02 |

### SCR-06 Đặt mật khẩu mới

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Email | Chữ chỉ đọc | — | Email của link | — | — |
| 2 | New password / Mật khẩu mới | Ô mật khẩu | * | 8–128, khác email | MSG-COM-06, MSG-FE01-08 | — |
| 3 | Confirm new password / Xác nhận mật khẩu mới | Ô mật khẩu | * | Bằng trường 2 | MSG-COM-06, MSG-FE01-09 | — |
| 4 | Save new password / Lưu mật khẩu mới | Nút | — | — | MSG-COM-02 | Thành công → SCR-02 + MSG-FE01-07; kết thúc mọi phiên |
| **Trạng thái: Link không còn hiệu lực** | | | | | | |
| 5 | Message / Thông báo | Chữ | — | — | MSG-FE01-06 | — |
| 6 | Send new link / Gửi link mới | Nút | — | — | — | Mở SCR-05 với email điền sẵn |

### SCR-07 Hoàn tất hồ sơ Chủ trại

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi | Hành vi |
|---|---|---|---|---|---|---|---|
| 1 | Onboarding steps / Các bước | Thanh bước chỉ đọc | — | 1 Hồ sơ · 2 Trại · 3 Gói (đang ở bước 1) | — | — | — |
| 2 | Sign-in email / Email đăng nhập | Chữ chỉ đọc | — | Kèm "đã xác minh qua Google" hoặc "đã xác minh" | — | — | — |
| 3 | Full name / Họ tên | Ô chữ | * | 2–100 | Từ Google hoặc từ lúc đăng ký | MSG-COM-06, MSG-COM-10 | — |
| 4 | Contact phone / Số điện thoại liên hệ | Ô chữ | — | `0` + 9 chữ số (tổng 10) hoặc `+84` + 9 chữ số | Trống | MSG-COM-10 | Chỉ để liên hệ |
| 5 | I agree to the Terms… / Tôi đồng ý điều khoản… | Checkbox | * (chỉ khi chưa chấp nhận lúc đăng ký) | Phải tick | Không tick | MSG-FE01-14 | Ẩn nếu đã chấp nhận ở SCR-03 |
| 6 | Complete and register farm / Hoàn tất và đăng ký trại | Nút | — | — | — | MSG-COM-02 | Lưu đăng ký Owner → SCR-10 |

### SCR-08 Hồ sơ và quyền của tôi

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Header / Tiêu đề | Chữ | — | Họ tên + "vai trò tại tên trại" (hoặc vai trò platform) | — | — |
| 2 | Sign-in email / Email đăng nhập | Chữ chỉ đọc | — | Kèm trạng thái xác minh | — | Không sửa được |
| 3 | Sign-in methods / Phương thức đăng nhập | Chữ chỉ đọc | — | Google và / hoặc Email & mật khẩu | — | — |
| 4 | Full name / Họ tên | Ô chữ | * | 2–100 | MSG-COM-06, MSG-COM-10 | — |
| 5 | Contact phone / Số điện thoại liên hệ | Ô chữ | — | Định dạng SĐT Việt Nam như SCR-07 | MSG-COM-10 | — |
| 6 | Change password / Add password – Đổi mật khẩu / Thêm mật khẩu | Nút | — | "Thêm mật khẩu" khi tài khoản chưa có mật khẩu | — | Mở popup Đổi mật khẩu |
| 7 | Save profile / Lưu hồ sơ | Nút | — | Chỉ lưu họ tên, SĐT | MSG-COM-02 | MSG-FE01-13 |
| **Khối: Quyền của tôi trong trại này** (ẩn với nhân viên platform) | | | | | | |
| 8 | Role / Vai trò | Chữ chỉ đọc | — | Chủ trại / Quản lý / Kỹ thuật viên | — | — |
| 9 | Permission table / Bảng quyền | Bảng chỉ đọc | — | Các nhóm quyền với giá trị của vai trò, theo Table III-2 | — | — |

### Popup Đổi mật khẩu (mở từ SCR-08)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Account / Tài khoản | Chữ chỉ đọc | — | Email | — | — |
| 2 | Current password / Mật khẩu hiện tại | Ô mật khẩu | * (ẩn khi thêm mật khẩu đầu tiên) | — | MSG-COM-06, MSG-FE01-16, MSG-FE01-02 | Sai được tính vào khóa |
| 3 | New password / Mật khẩu mới | Ô mật khẩu | * | 8–128, khác email | MSG-COM-06, MSG-FE01-08 | — |
| 4 | Confirm new password / Xác nhận mật khẩu mới | Ô mật khẩu | * | Bằng trường 3 | MSG-COM-06, MSG-FE01-09 | — |
| 5 | Cancel / Hủy | Nút | — | — | — | Đóng, không đổi gì |
| 6 | Save / Lưu | Nút | — | — | MSG-COM-02 | MSG-FE01-07; kết thúc các phiên khác |

---

## 7. Hợp đồng dữ liệu FE ↔ BE (mức nghiệp vụ)

SRS không quy định đường dẫn API. **Dữ liệu vào / ra và mã lỗi lấy theo SRS.** Cột **Route** ghi đường dẫn đang có trong code (`main@dec155d`) để FE nối ngay; "chưa có" = BE phải bổ sung. Chỗ nào code lệch dữ liệu vào / ra hay mã lỗi trong bảng này thì **sửa code theo spec**.

| # | Thao tác | Vào | Ra (thành công) | Lỗi có thể trả | Route |
|---|---|---|---|---|---|
| A1 | Đăng ký bằng email | `fullName, email, password, confirmPassword, termsAccepted` | `{email}` – tài khoản chờ xác minh | MSG-COM-06, COM-10, FE01-08, 09, 10, 14, COM-02 || `POST /api/register` |
| A2 | Gửi lại email xác minh | `email` | `{nextAllowedAt}` | Quá giới hạn gửi (xem Q1), COM-02 || `POST /api/account/verification/resend` |
| A3 | Xác minh email qua link | `token` | Phiên đăng nhập + `{ownerRegistrationCompleted: false}` | FE01-06 || `GET /api/activate?token=` |
| A4 | Đăng nhập Google (bắt đầu / nhận kết quả) | Mã trả về từ Google | Phiên + thông tin điều hướng (A7) | FE01-12, FE01-03 || `GET /oauth2/authorization/google` (Spring OAuth2, kết quả qua success handler) |
| A5 | Hoàn tất hồ sơ Chủ trại | `fullName, contactPhone?, termsAccepted?` | Hồ sơ đã cập nhật, `ownerRegistrationCompleted: true` | COM-06, COM-10, FE01-14, COM-02 || `POST /api/account/owner-registration` |
| A6 | Đăng nhập bằng mật khẩu | `email, password, rememberMe` | Phiên + thông tin điều hướng (A7) | FE01-01, 02 (`{unlockAt}`), 03, 11, COM-03 || `POST /api/authenticate` |
| A7 | Thông tin người đang đăng nhập | — | `{id, fullName, email, emailVerified, contactPhone, status, ownerRegistrationCompleted, signInMethods[GOOGLE, PASSWORD], platformRole?, farms[{farmId, farmName, role, serviceStatus}], hasPassword}` | 401 || `GET /api/account/profile` |
| A8 | Đăng xuất | — | — | — || `POST /api/logout` |
| A9 | Sửa hồ sơ | `fullName, contactPhone?` | Hồ sơ (A7) | COM-06, COM-10, COM-02 || `POST /api/account/profile` |
| A10 | Bảng quyền trong trại hiện tại | `farmId` | `{role, permissions[{area, value: FULL\|RESTRICTED\|NO}]}` | COM-01 || chưa có riêng – thêm vào A7 hoặc `GET /api/farms/{farmId}/my-permissions` |
| A11 | Yêu cầu đặt lại mật khẩu | `email` | **Luôn** thành công như nhau | COM-10 (chỉ định dạng) || `POST /api/account/reset-password/init` |
| A12 | Kiểm tra link đặt lại | `token` | `{email}` | FE01-06 || `GET /api/account/reset-password/validate?token=` |
| A13 | Đặt mật khẩu mới | `token, newPassword, confirmPassword` | — | FE01-06, 08, 09, COM-02 || `POST /api/account/reset-password/finish` |
| A14 | Đổi mật khẩu | `currentPassword, newPassword, confirmPassword` | — | FE01-16, 02, 08, 09, COM-02 || `POST /api/account/change-password` |
| A15 | Thêm mật khẩu đầu tiên | `newPassword, confirmPassword` (cần xác thực lại Google ≤ 5 phút) | — | FE01-08, 09, cần xác thực lại (xem Q2), COM-02 || `POST /api/account/google-reauthentication` rồi `POST /api/account/change-password` (không gửi `currentPassword`) |

**Không bao giờ** có trường `password` / `passwordHash` trong bất kỳ response nào (R-01-05).
Lỗi trả theo khuôn chung: `{code: "MSG-FE01-08", field?: "newPassword", params?: {...}}` để FE hiện đúng chỗ.

---

## 8. Thông báo

| Mã | Kiểu | Khi nào | Nội dung (EN – SRS) | Nội dung VN (đề xuất, đối chiếu Figma) |
|---|---|---|---|---|
| MSG-FE01-01 | Trên form | Sai email hoặc mật khẩu | Email or password is incorrect. | Email hoặc mật khẩu không đúng. |
| MSG-FE01-02 | Trên form | Khóa sau 5 lần sai | Password sign-in is locked after 5 failed attempts. Try again after {time} or continue with Google. | Đăng nhập bằng mật khẩu bị khóa sau 5 lần sai. Thử lại sau {time} hoặc tiếp tục với Google. |
| MSG-FE01-03 | Trạng thái màn hình | Tài khoản bị tạm ngưng | The account {email} cannot sign in at the moment. Contact BeefCare for help. | Tài khoản {email} hiện không thể đăng nhập. Vui lòng liên hệ BeefCare để được hỗ trợ. |
| MSG-FE01-04 | Trạng thái màn hình | Đã gửi email xác minh | We sent a verification link to {email}. Open it within 24 hours to activate your account. | Chúng tôi đã gửi link xác minh tới {email}. Mở link trong 24 giờ để kích hoạt tài khoản. |
| MSG-FE01-05 | Trạng thái màn hình | Đã gửi yêu cầu đặt lại (luôn giống nhau) | If {email} has a BeefCare password, a reset link has been sent. It is valid for 30 minutes. | Nếu {email} có mật khẩu BeefCare, link đặt lại đã được gửi. Link có hiệu lực 30 phút. |
| MSG-FE01-06 | Trạng thái màn hình | Link hết hạn / đã dùng | This link has expired or has already been used. [Send a new link] | Link đã hết hạn hoặc đã được sử dụng. [Gửi link mới] |
| MSG-FE01-07 | Toast thành công | Đã đổi / đặt lại mật khẩu | Your password has been changed. Other sessions have been signed out. | Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất. |
| MSG-FE01-08 | Dưới trường | Mật khẩu sai quy tắc | Password must have 8–128 characters and must not be the same as your email. | Mật khẩu phải có 8–128 ký tự và không được trùng email. |
| MSG-FE01-09 | Dưới trường | Xác nhận không khớp | The passwords do not match. | Mật khẩu xác nhận không khớp. |
| MSG-FE01-10 | Trên form | Email đã có tài khoản | This email already has a BeefCare account. [Sign in] [Forgot password] | Email này đã có tài khoản BeefCare. [Đăng nhập] [Quên mật khẩu] |
| MSG-FE01-11 | Trên form | Email chưa xác minh | Please verify your email before signing in. [Resend verification email] | Vui lòng xác minh email trước khi đăng nhập. [Gửi lại email xác minh] |
| MSG-FE01-12 | Trên form | Google bị hủy / lỗi | Google sign-in was not completed. Please try again. | Đăng nhập Google chưa hoàn tất. Vui lòng thử lại. |
| MSG-FE01-13 | Toast thành công | Đã lưu hồ sơ | Your profile has been updated. | Đã cập nhật hồ sơ. |
| MSG-FE01-14 | Dưới trường | Chưa tick điều khoản | Please accept the Terms of Use and Data Policy. | Vui lòng đồng ý Điều khoản sử dụng và Chính sách dữ liệu. |
| MSG-FE01-15 | Trạng thái màn hình | Không có trại, không có vai trò platform | Your account is not linked to any farm yet. Register your farm, or open the invitation sent to your email. | Tài khoản chưa gắn với trại nào. Hãy đăng ký trại, hoặc mở lời mời đã gửi tới email của bạn. |
| MSG-FE01-16 | Dưới trường | Sai mật khẩu hiện tại | The current password is incorrect. | Mật khẩu hiện tại không đúng. |
| MSG-COM-01 | Trong trang | Không có quyền | You do not have permission to perform this action. | Bạn không có quyền thực hiện thao tác này. |
| MSG-COM-02 | Toast lỗi | Lỗi lưu | The data could not be saved. Please try again. | Không lưu được dữ liệu. Vui lòng thử lại. |
| MSG-COM-03 | Trong trang | Lỗi tải | The data could not be loaded. [Retry] | Không tải được dữ liệu. [Thử lại] |
| MSG-COM-06 | Dưới trường | Thiếu trường bắt buộc | {field} is required. | {field} là bắt buộc. |
| MSG-COM-10 | Dưới trường | Sai định dạng | {field} is not valid. | {field} không hợp lệ. |
| MSG-COM-14 | Hộp thoại | Đóng form khi có dữ liệu chưa lưu | Discard the information you have entered? [Discard] [Keep editing] | Bỏ thông tin đã nhập? [Bỏ] [Tiếp tục nhập] |

---

## 9. Test case

Tầng: **U** = unit, **I** = integration BE (service + DB), **H** = HTTP (controller, quyền, mã lỗi), **E** = E2E / kiểm tay trên giao diện.

### 9.1 Kiểm tra trường (giá trị biên)

| Mã | Màn hình · trường | Dữ liệu | Kết quả mong đợi | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-01-01 | SCR-03 Họ tên | `A` (1 ký tự) / `An` (2) / 100 ký tự / 101 ký tự | Lỗi / Hợp lệ / Hợp lệ / Lỗi | U, H | SCR-03 |
| TC-01-02 | SCR-03 Họ tên | Chỉ khoảng trắng | MSG-COM-06 | U, H | SCR-03 |
| TC-01-03 | SCR-03 Email | `abc`, `a@b`, chuỗi 255 ký tự | MSG-COM-10 | U, H | SCR-03 |
| TC-01-04 | SCR-03 Mật khẩu | 7 ký tự / 8 / 128 / 129 | Lỗi FE01-08 / Hợp lệ / Hợp lệ / Lỗi | U, H | R-01-03 |
| TC-01-05 | SCR-03 Mật khẩu | Trùng email (kể cả khác hoa thường) | MSG-FE01-08 | U, H | R-01-03 |
| TC-01-06 | SCR-03 Xác nhận | Khác mật khẩu | MSG-FE01-09 | U, H | SCR-03 |
| TC-01-07 | SCR-03 Điều khoản | Không tick | MSG-FE01-14 | U, H | SCR-03 |
| TC-01-08 | SCR-07 SĐT | `0912345678` / `+84912345678` / `912345678` / `09123456789` / `+8491234567` | Hợp lệ / Hợp lệ / Lỗi / Lỗi / Lỗi | U, H | SCR-07 |
| TC-01-09 | SCR-07 SĐT | Để trống | Hợp lệ | U, H | SCR-07 |
| TC-01-10 | SCR-02 Email | `Owner@Farm.VN` khi tài khoản là `owner@farm.vn` | Đăng nhập được | I | R-01-01 |

### 9.2 Luồng và quy tắc

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-01-11 | Chưa có tài khoản | Đăng ký email hợp lệ | Tài khoản tạo, mật khẩu `PENDING_VERIFICATION`, gửi 1 email; SCR-04 + MSG-FE01-04 | I, E | UC-01 AF1 |
| TC-01-12 | Đã có tài khoản `a@x.vn` | Đăng ký email `A@X.vn` | MSG-FE01-10; không có tài khoản thứ hai | I | R-01-01, UC-01 E2 |
| TC-01-13 | Đăng ký nhưng chưa xác minh | Đăng nhập bằng mật khẩu | MSG-FE01-11; không tạo phiên | I | UC-02 AF6 |
| TC-01-14 | Link xác minh tạo lúc T | Mở lúc T + 24h + 1 phút | MSG-FE01-06 | I | R-01-06 |
| TC-01-15 | Đã gửi link 1, rồi gửi lại link 2 | Mở link 1 | MSG-FE01-06; link 2 vẫn dùng được | I | R-01-06 |
| TC-01-16 | Đã gửi 5 email trong 1 giờ | Gửi lần 6 | Bị từ chối, không gửi email | I | UC-01 AF4 |
| TC-01-17 | Vừa gửi email xác minh | Bấm Gửi lại trong 60 giây | Nút bị khóa | E | SCR-04 |
| TC-01-18 | Tài khoản có mật khẩu `a@x.vn` | Đăng nhập Google với cùng email lần đầu | Gắn Google vào **cùng** tài khoản; không tạo tài khoản mới | I | R-01-01 |
| TC-01-19 | Google subject S đã gắn tài khoản A | Tình huống bất kỳ khiến S gắn sang tài khoản B | Bị chặn | I | R-01-02 |
| TC-01-20 | Tài khoản ACTIVE | Sai mật khẩu 4 lần rồi đúng | Đăng nhập được, bộ đếm về 0 | I | R-01-04 |
| TC-01-21 | Tài khoản ACTIVE | Sai 5 lần, lần 6 nhập đúng | MSG-FE01-02 kèm thời điểm mở khóa; không tạo phiên | I | R-01-04 |
| TC-01-22 | Đang bị khóa mật khẩu | Đăng nhập Google | Thành công | I | R-01-04 |
| TC-01-23 | Bị khóa lúc T | Đăng nhập đúng lúc T + 15 phút + 1 giây | Thành công | I | R-01-04 |
| TC-01-24 | Sai email / sai mật khẩu | Đăng nhập | Cả hai trường hợp cùng MSG-FE01-01 | H | UC-02 E1 |
| TC-01-25 | Tài khoản SUSPENDED | Đăng nhập mật khẩu / Google | Trạng thái MSG-FE01-03 + liên hệ GBR-87; không có phiên | I, E | R-01-08 |
| TC-01-26 | Đang đăng nhập, SA tạm ngưng tài khoản | Gọi request kế tiếp | 401; FE về SCR-02 trạng thái tạm ngưng | H | R-01-08 |
| TC-01-27 | Không tick Ghi nhớ | Không thao tác 8 giờ | Phiên hết hạn | I | §3.4 |
| TC-01-28 | Tick Ghi nhớ | Quay lại sau 29 ngày | Vẫn đăng nhập | I | §3.4 |
| TC-01-29 | Người dùng có 1 trại ACTIVE, vai trò Technician | Đăng nhập | Mở SCR-74 | E | UC-02 bước 6 |
| TC-01-30 | Owner có 2 trại ACTIVE | Đăng nhập | Mở SCR-09 | E | UC-02 bước 6 |
| TC-01-31 | Tài khoản PM | Đăng nhập | Mở SCR-12 | E | UC-02 bước 6 |
| TC-01-32 | Đăng nhập Google lần đầu qua trang Đăng nhập, không có trại / vai trò | Đăng nhập | Tài khoản tạo **chưa** đăng ký Owner; MSG-FE01-15 kèm "Đăng ký làm Chủ trại" | I, E | UC-02 AF1, AF3 |
| TC-01-33 | Đã đăng ký nhưng chưa xong SCR-07 | Đăng nhập | Mở SCR-07 | E | UC-02 AF4 |
| TC-01-34 | Hoàn tất SCR-07 | — | `ownerRegistrationCompleted = true`; **không** có trại, membership, vai trò platform, gói nào được tạo | I | R-01-10 |
| TC-01-35 | Có lời mời chưa chấp nhận | Đăng nhập | Lời mời vẫn chưa chấp nhận | I | R-01-11 |
| TC-01-36 | Email không tồn tại / tồn tại | Yêu cầu đặt lại | Phản hồi giống hệt nhau (nội dung, mã HTTP); chỉ trường hợp tồn tại có email gửi đi | H | R-01-07 |
| TC-01-37 | Tài khoản chỉ có Google | Yêu cầu đặt lại | Email khuyên dùng Google; không tạo mật khẩu | I | R-01-14 |
| TC-01-38 | Link đặt lại tạo lúc T | Mở lúc T + 31 phút | MSG-FE01-06 | I | R-01-06 |
| TC-01-39 | Có 2 phiên đang mở | Đặt lại mật khẩu thành công | Cả 2 phiên bị từ chối; bộ đếm sai và khóa bị xóa; có email "đã đổi mật khẩu" | I | UC-05 bước 6 |
| TC-01-40 | Tài khoản SUSPENDED | Đặt lại mật khẩu | Thành công nhưng vẫn không đăng nhập được | I | R-01-09 |
| TC-01-41 | Có 2 phiên (P1 hiện tại, P2) | Đổi mật khẩu ở P1 | P1 còn, P2 bị từ chối | I | UC-06 bước 4 |
| TC-01-42 | Đổi mật khẩu | Sai mật khẩu hiện tại 5 lần | Lần 1–4 MSG-FE01-16; lần 5 MSG-FE01-02 | I | R-01-04 |
| TC-01-43 | Tài khoản chỉ Google, xác thực Google 10 phút trước | Thêm mật khẩu | Yêu cầu xác thực lại Google | I | R-01-13 |
| TC-01-44 | Tài khoản chỉ Google, vừa xác thực lại | Thêm mật khẩu hợp lệ | Mật khẩu `ACTIVE` ngay; đăng nhập bằng email + mật khẩu được | I | R-01-13 |
| TC-01-45 | Bất kỳ | Gọi mọi API của FE-01 | Không response nào có trường mật khẩu / hash; log không chứa mật khẩu | H | R-01-05 |
| TC-01-46 | Sửa hồ sơ | Gửi kèm `email` mới | Email không đổi | H | UC-04 |
| TC-01-47 | Nhân viên platform | Mở SCR-08 | Thấy vai trò platform, không có bảng quyền trại | E | SCR-08 |
| TC-01-48 | Đang đăng nhập, đã chọn trại | Đăng xuất | Phiên kết thúc, trại đang chọn bị xóa khỏi thiết bị, về SCR-02 | E | UC-03 |
| TC-01-49 | Dịch vụ email lỗi | Đăng ký email | MSG-COM-02; không có tài khoản nào được tạo | I | R-01-15 |

---

## 10. Điểm SRS chưa rõ (cần chủ dự án chốt, không tự quyết)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Vượt giới hạn 5 email / giờ: SRS không có mã thông báo riêng | Dùng MSG-COM-02 hoặc thêm MSG-FE01-17 "Bạn đã gửi quá nhiều yêu cầu, thử lại sau {time}" |
| Q2 | Thêm mật khẩu khi xác thực Google đã quá 5 phút: SRS không ghi thông báo | Tự chuyển sang Google xác thực lại, không cần thông báo |
| Q3 | Họ tên chỉ gồm ký tự đặc biệt / số có hợp lệ không? | Chỉ kiểm độ dài 2–100 sau trim (đúng như SRS) |
| Q4 | SĐT có cho phép khoảng trắng / dấu chấm (`0912 345 678`) không? | Cho nhập, chuẩn hóa bỏ khoảng trắng và dấu chấm trước khi kiểm |
| Q5 | "Trang đã yêu cầu trước khi đăng nhập" lưu ở đâu, bao lâu? | Lưu trong tham số `redirect` của URL, chỉ nhận đường dẫn nội bộ |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại hoàn toàn từ SRS (không dựa trên code) | Claude (cho LamKD duyệt) |
| 06/11/2026 | 28/10/2026 | Điền cột Route theo route hiện có trong code | Claude |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
