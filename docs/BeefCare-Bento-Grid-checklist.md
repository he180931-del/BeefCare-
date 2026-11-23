# Checklist áp dụng Bento Grid trên React

Đối chiếu từng khung Bento trong Figma ([file thiết kế](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ)) với màn React, theo quy tắc trong [BeefCare-Bento-Grid.md](BeefCare-Bento-Grid.md). Cập nhật 23/11/2026.

**Cách đánh dấu**

- `[x]` Màn React đã sửa theo Bento và đã so với khung Figma.
- `[ ]` *(đã đổi một phần)*: code đã đổi theo khung chung của màn, chưa so riêng khung này.
- `[ ]` Chưa làm.

**Đợt sửa**

| Đợt | Commit / nhánh | Trạng thái |
|---|---|---|
| 1 | `d0549154` | Đã lên `dev` |
| 2 | `efc82f9c`, `96ef8455` | Đã lên `dev` |
| 3 | `9b2b64ae` (tab 18, 19, 21), nhánh `feature/bento-grid` | Chưa lên `dev` |
| 4 | `9b2b64ae`: hộp thoại chung, hồ sơ bò, nhập/xuất đàn, chuồng trại (tab 16); tăng trưởng, tiêm phòng, sức khỏe (tab 17); nhắc việc, thông báo trại, kỹ thuật viên (tab 15) | Chưa lên `dev` |
| 5 | nhánh `feature/bento-grid` (tab 13 và sáu trạng thái xác thực tab 12) | Chưa commit |
| 6 | nhánh `feature/bento-grid` (hai khung cuối tab 15) | Chưa commit |
| 7 | nhánh `feature/bento-grid` (17 hộp thoại và trang còn lại của tab 16, 17) | Chưa commit |

## Tổng hợp

| Tab Figma | Số khung | Đã xong | Đổi một phần | Chưa làm |
|---|---:|---:|---:|---:|
| 12 · Guest – Công khai & Đăng nhập | 11 | 11 | 0 | 0 |
| 13 · Chủ trại – Trại & Thành viên | 38 | 38 | 0 | 0 |
| 15 · Tổng quan & Nhắc việc | 12 | 12 | 0 | 0 |
| 16 · Đàn bò, Nhập/Xuất & Chuồng | 33 | 33 | 0 | 0 |
| 17 · Tăng trưởng, Tiêm phòng & Sức khỏe | 24 | 24 | 0 | 0 |
| 18 · Sinh sản | 17 | 17 | 0 | 0 |
| 19 · Danh mục & Tham số | 6 | 6 | 0 | 0 |
| 21 · Quản lý thức ăn | 14 | 14 | 0 | 0 |
| **Tổng** | **155** | **155** | **0** | **0** |

Trang 22 · Nền tảng (CS, PM, SA) chưa có khung Bento. Mọi đợt Bento từ đợt 3 nằm chung nhánh `feature/bento-grid`.

**Thay đổi dùng chung ở đợt 5** (ảnh hưởng cả các tab đã xong):

- Nút Đóng của mọi hộp thoại có vùng chạm 44 px, tâm biểu tượng giữ nguyên vị trí.
- Tiêu đề trên thanh trên xuống dòng thay vì bị cắt. Thanh cao tối thiểu 72 px.
- `Note` xám đặt chữ `text-ink` để đọc được cả trong khối xanh đậm.
- `Button size="bento"`: nút thao tác của các trang trong ứng dụng (cao tối thiểu 44 px, bo 8 px, chữ dài xuống dòng). Hộp thoại và các trang thiết lập ban đầu giữ `size="lg"` (46 px, bo 12) như các trang cùng luồng. Màn quét QR (tab 16) cũng dùng cỡ này.
- `Card variant="panel"` dùng chung bề mặt và tiêu đề của `Panel`: tiêu đề h2 18 px, padding 16 px, 24 px khi vùng chứa từ 1.024 px. Khối lồng trong khối khác dùng `headingAs="h3"` (16 px). Các khối tóm tắt và kiểm tra trước khi lưu ở phiếu nhập kho, khẩu phần, kiểm kê và khối giả lập chuyển khoản chuyển sang tiêu đề chung này.
- Màu nhãn và dòng phụ `#5b6a60` thành token `text-label`.
- Bảng không xếp thẻ (`stack={false}`) cuộn ngang trong khung khi thiếu chỗ, thay vì bị cắt mất cột. Trước đó, ở 390 px, cột Trạng thái bị cắt ở `/pens` và bốn danh mục giống, mục đích, thuốc, vắc-xin. Khung đang cuộn được thì nhận focus bàn phím. Ô của bảng cuộn được chỉ xuống dòng giữa các từ, không cắt giữa chữ (trước đó ở 390 px tên vắc-xin bị cắt thành "huy ết"). Ở Lịch sử thanh toán, ô "Tạo lúc" và "Hết hạn" được xuống dòng giữa ngày và giờ để bảng vẫn vừa khung ở 1.024 px.

## Tab 12 · Guest – Công khai & Đăng nhập

**①c Trang công khai (FE-22) · Version C** — bản được chọn; thay cho ①b Trang công khai · Bento.

- [x] [Trang công khai · Desktop](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2873-130) — `/` · đợt 1
- [x] [Trang công khai · Mobile](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2873-268) — `/` · đợt 1

**②b Đăng nhập, đăng ký & khôi phục mật khẩu (FE-01)**

- [x] [Đăng nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-383) — đã đúng Bento từ trước (khung AuthShell), đối chiếu 23/11. Giữ ô Ghi nhớ đăng nhập và tài khoản mock đang có trong code.
- [x] [Tạo tài khoản chủ trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-414) — đã đúng Bento từ trước (khung AuthShell), đối chiếu 23/11.
- [x] [Xác minh email](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-450) — `/xac-minh-email` · đợt 5. Giữ giới hạn gửi lại hiện có, căn trái cùng liên kết quay lại.
- [x] [Quên mật khẩu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-473) — đã đúng Bento từ trước (khung AuthShell), đối chiếu 23/11.
- [x] [Kiểm tra email](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-496) — `/kiem-tra-email` · đợt 5. Căn giữa địa chỉ email như Figma và giữ câu về hiệu lực 30 phút.
- [x] [Đặt mật khẩu mới](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-519) — `/resetpassword` · đợt 5. Giữ email chỉ đọc, nút hiện mật khẩu và liên kết về đăng nhập.
- [x] [Liên kết không còn hiệu lực](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-543) — `/lien-ket-khong-con-hieu-luc` · đợt 5. Dùng chung Panel cảnh báo cho liên kết hết hạn và giữ các thao tác hiện có.
- [x] [Đăng nhập chưa thành công](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-564) — `/dang-nhap-that-bai` · đợt 5. Giữ ô Ghi nhớ đăng nhập, nút hiện mật khẩu, tài khoản mẫu và trạng thái Google bị vô hiệu hóa ở mock. Nhãn mô phỏng nằm dưới nội dung để các nút tài khoản mẫu dễ bấm.
- [x] [Tài khoản đang tạm ngưng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-594) — `/tai-khoan-tam-ngung` · đợt 5. Giữ email, điện thoại hỗ trợ và nút Quay lại đăng nhập hiện có.

## Tab 13 · Chủ trại – Trại & Thành viên

Đối chiếu 38 khung ở chế độ React mock với ảnh trước và sau tại 1440×1024, 1280×900 và 390×844. Hộp thoại React tiếp tục căn giữa viewport và phủ nội dung thật của route. Figma thường căn theo vùng sau sidebar và dùng nền minh họa.

**①b Hoàn tất hồ sơ, đăng ký trại, chọn trại & thông tin trại (FE-01, FE-02, FE-19)**

- [x] [Chọn trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3424) — `/chon-trai` · đợt 5. Giữ nút Đăng xuất, tên thao tác và ngày dịch vụ theo từng trại mock.
- [x] [Hoàn tất hồ sơ chủ trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3539) — `/owner-registration` · đợt 5. Ô đồng ý điều khoản chỉ xuất hiện khi hồ sơ chưa hoàn tất. Tài khoản mock đã hoàn tất hồ sơ.
- [x] [Đăng ký trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3600) — `/dang-ky-trai` · đợt 5. Giữ Xã/Phường là ô nhập và Giống chủ lực là danh sách chọn nhiều.
- [x] [Đăng ký gói dịch vụ lần đầu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3692) — `/dang-ky-goi` · đợt 5. Giữ khối Điều khoản gói, kỳ dịch vụ ước tính và cảnh báo hiện có khi mở từ trại chưa hoạt động.
- [x] [Thông tin trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3784) — `/thong-tin-trai` · đợt 5. Giữ Xã/Phường là ô nhập, múi giờ UTC+7 chỉ đọc theo D39 và số ngày còn lại theo dữ liệu lúc mở.

**②b Thành viên & lời mời, hồ sơ cá nhân (FE-03, FE-01)**

- [x] [Thành viên & vai trò](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3989) — `/thanh-vien` · đợt 5. Giữ bảng quyền đủ ba vai trò theo D29, thao tác Làm mới, sắp xếp, phân trang và số đếm theo trạng thái hiện tại.
- [x] [Mời thành viên](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4230) — `/thanh-vien?m=invite` · đợt 5. Giữ nhãn Email người nhận, kiểm tra khi bấm Gửi lời mời và các trạng thái gửi lại hoặc kích hoạt lại hiện có.
- [x] [Lời mời thành viên](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4380) — `/loi-moi` · đợt 5. Giữ sắp xếp, phân trang và thông tin tài khoản theo dữ liệu.
- [x] [Đổi vai trò / ngừng hoạt động thành viên](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4526) — `/thanh-vien?m=doi-vai-tro` · đợt 5. Giữ trạng thái thành viên, lý do 5–500 ký tự và bước xác nhận theo D30.
- [x] [Chấp nhận lời mời (người được mời)](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4674) — `/invitation/accept` · đợt 5. Giữ nút Để sau và quyền, email hiện có của tài khoản được mời.
- [x] [Lời mời không còn hiệu lực](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4741) — `/invitation/accept` · đợt 5. Giữ nội dung xử lý liên kết hết hiệu lực và Liên hệ BeefCare. API hiện chỉ cung cấp trạng thái và thời điểm hết hạn nếu có.
- [x] [Hồ sơ & quyền của tôi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4787) — `/ho-so` · đợt 5. Giữ danh sách đầy đủ quyền và trạng thái chỉ xem theo vai trò hiện tại.
- [x] [Đổi mật khẩu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4978) — `/ho-so?m=doi-mat-khau` · đợt 5. Giữ nút hiện mật khẩu, xác thực lại Google và gợi ý mật khẩu ở chế độ mock.

**③b Gói dịch vụ & thanh toán (FE-19)**

- [x] [Gói dịch vụ của trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5115) — `/goi-dich-vu` · đợt 5. Giữ mã yêu cầu chờ, liên kết Mở hướng dẫn và ngày kết thúc đã xác nhận theo dữ liệu thanh toán.
- [x] [Gia hạn gói – chọn thời hạn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5307) — `/goi-dich-vu/gia-han` · đợt 5. Giữ khối Trạng thái trang trại và kỳ hạn mặc định bỏ trống. Ảnh đối chiếu dùng kỳ hạn 1 năm. Khối xem lại dùng nền xanh đậm theo quy tắc Bento.
- [x] [Hướng dẫn chuyển khoản](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5489) — `/goi-dich-vu/chuyen-khoan/:id` · đợt 5. Giữ QR minh họa, Hủy yêu cầu theo D38, khối giả lập ở dev và bố cục chuyển khoản riêng trên điện thoại.
- [x] [Lịch sử thanh toán](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5682) — `/goi-dich-vu/lich-su` · đợt 5. Giữ làm mới, sắp xếp, phân trang và hai ô lọc ngày độc lập. Ảnh mock dùng bộ lọc mặc định.
- [x] [Chi tiết thanh toán đã xác nhận](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5858) — `/goi-dich-vu/lich-su/:id` · đợt 5. Giữ chi tiết nội tuyến, tự cuộn và nhận focus theo D16. Figma hiển thị chi tiết trong hộp thoại.

**③bb Trạng thái thanh toán (FE-19)**

- [x] [Yêu cầu đã hết hạn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6016) — `/goi-dich-vu?m=expired` · đợt 5. Giữ nhãn Hết hạn và màu badge dùng chung theo trạng thái hiện có.
- [x] [Đã có yêu cầu còn hiệu lực](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6154) — `/goi-dich-vu?m=pending-exists` · đợt 5. Giữ nhãn Quay lại, Mở lại hướng dẫn và các giá trị yêu cầu chờ hiện có.
- [x] [Chưa đến thời gian gia hạn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6288) — `/goi-dich-vu?m=renewal-closed` · đợt 5. Giữ ngày đã xác nhận và ngày mở tạo yêu cầu theo dữ liệu.
- [x] [Trại đang tạm ngưng dịch vụ](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6415) — `/goi-dich-vu?m=suspended` · đợt 5. Giữ nhãn Tạm ngưng và tông lỗi dùng chung, cùng các lối vào lịch sử và hỗ trợ.
- [x] [Bảng giá đã thay đổi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6546) — `/goi-dich-vu?m=price-changed` · đợt 5. Giữ giá đã xem, giá hiện tại và thao tác xem lại.
- [x] [Giá gói chưa khả dụng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6675) — `/goi-dich-vu?m=price-unavailable` · đợt 5. Giữ thông báo khi thiếu bảng giá hoặc thông tin tài khoản nhận.
- [x] [Không lấy được kết quả thanh toán](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6798) — `/goi-dich-vu?m=result-unavailable` · đợt 5. Giữ nhãn Trạng thái gần nhất và hộp thoại trượt từ dưới lên trên điện thoại.
- [x] [Lịch sử thanh toán – chưa có dữ liệu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6929) — `/goi-dich-vu/lich-su` · đợt 5. Giữ bộ lọc lịch sử và thao tác Xem gói của trại ở trạng thái trống.

**⑥b Ticket & thông báo (FE-20)**

- [x] [Ticket hỗ trợ của tôi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7054) — `/ho-tro` · đợt 5. Giữ hai ô ngày, ô lọc danh mục và số đếm theo bộ lọc hiện tại.
- [x] [Gửi yêu cầu hỗ trợ](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7238) — `/ho-tro/moi` · đợt 5. Giữ các trường Danh mục, Phạm vi và Trang trại liên quan theo D40. Mức ưu tiên do bộ phận hỗ trợ gán và chỉ có trong chú thích ở form này.
- [x] [Chi tiết ticket](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7408) — `/ho-tro/:id` · đợt 5. Giữ avatar trong trao đổi, cảnh báo xác nhận chưa tự đóng, bộ đếm phản hồi và lịch sử. Kết quả đang chờ xác nhận dùng nền xanh đậm.
- [x] [Mở lại ticket](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7602) — `/ho-tro/:id?m=mo-lai` · đợt 5. Giữ ô chỉ đọc Yêu cầu / kết quả hiện tại và cảnh báo mở lại.
- [x] [Thông báo của tôi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7727) — `/thong-bao-cua-toi` · đợt 5. Giữ cả chín thông báo mock. Figma minh họa sáu mục đầu.

**④bb Trạng thái Ticket (FE-20)**

- [x] [Đã gửi yêu cầu hỗ trợ](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7889) — `/ho-tro?m=da-gui` · đợt 5. Giữ câu xác nhận và nút Danh sách yêu cầu, Xem yêu cầu.
- [x] [Gửi yêu cầu hỗ trợ – thiếu thông tin](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8024) — `/ho-tro/moi` · đợt 5. Giữ thông báo sát từng trường và cột Dùng khi trong bảng hướng dẫn.
- [x] [Đã xác nhận kết quả](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8197) — `/ho-tro/:id?m=da-xac-nhan` · đợt 5. Giữ lời cảm ơn, mã tin nhắn khi có và ghi chú chờ bộ phận hỗ trợ đóng yêu cầu.
- [x] [Ticket đã đóng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8335) — `/ho-tro/:id?m=da-dong` · đợt 5. Giữ trạng thái chỉ đọc, phiên bản kết quả và thao tác dành cho yêu cầu đã đóng.
- [x] [Kết quả đã thay đổi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8471) — `/ho-tro/:id?m=ket-qua-thay-doi` · đợt 5. Giữ nội dung yêu cầu vừa có kết quả mới và nút Tải lại yêu cầu.
- [x] [Không có ticket phù hợp](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8592) — `/ho-tro` · đợt 5. Giữ EmptyBlock thay bảng và số đếm theo bộ lọc thực tế.
- [x] [Lỗi tải dữ liệu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8740) — `/ho-tro?demo=loi` · đợt 5. Giữ trạng thái lỗi có Thử lại sau khi đóng hộp thoại.

## Tab 15 · Tổng quan & Nhắc việc

**①b Tổng quan & Nhắc việc (FE-15, FE-14)**

- [x] [Tổng quan trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-12315) — `/tong-quan` · đợt 1
- [x] [Nhắc việc trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-12619) — `/nhac-viec` · đợt 4
- [x] [Tổng quan trang trại · Trại mới](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-12814) — `/tong-quan` · đợt 4. Khung Bắt đầu sử dụng ở cột 8 cạnh Cơ cấu đàn; vẫn giữ Ghi chép nhanh và Cần chú ý hôm nay đang có trong code.

**②b Thông báo trại (FE-07)**

- [x] [Thông báo trại – danh sách & chi tiết](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13109) — `/thong-bao` · đợt 4
- [x] [Soạn thông báo](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13316) — đợt 4
- [x] [Xem lại trước khi đăng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13502) — `/thong-bao/moi?nhap=:id&m=xem-lai` · đợt 6. Hộp thoại dùng vùng xem trước riêng, một cột thông tin ở điện thoại và hai cột khi đủ rộng. Giữ form soạn thật bên dưới và căn giữa viewport theo Modal dùng chung.
- [x] [Đính chính thông báo](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13647) — `/thong-bao/:id/dinh-chinh` · đợt 6. Giữ thanh định dạng, bộ đếm ký tự và ô tiêu đề nhập một dòng. Bảng lịch sử dùng Table bo 16 px. Nội dung và lịch sử phiên bản trong ảnh mock khớp dữ liệu của khung.

**③b Báo cáo quản lý (FE-15)**

- [x] [Báo cáo quản lý](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13815) — `/bao-cao` · đợt 2

**④b Kỹ thuật viên – Trang chủ, thông báo & nhắc việc (chỉ xem)**

- [x] [Kỹ thuật viên · Trang chủ](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-14092) — `/kt` · đợt 4. Giữ khối Chuồng trại / Danh mục trại đang có trong code.
- [x] [Kỹ thuật viên · Thông báo trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-14181) — `/kt/thong-bao` · đợt 4
- [x] [Kỹ thuật viên · Chi tiết thông báo](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-14233) — đợt 4
- [x] [Kỹ thuật viên · Nhắc việc](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-14269) — `/kt/nhac-viec` · đợt 4

## Tab 16 · Đàn bò, Nhập/Xuất & Chuồng

**①b Đàn bò & hồ sơ cá thể (FE-05, FE-16, FE-04)**

- [x] [Đàn bò – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-17961) — `/cattle` · đợt 2
- [x] [Hồ sơ bò › Tổng quan](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-18311) — `/cattle/:code` · đợt 4
- [x] [Cập nhật hồ sơ bò](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-18614) — đợt 4
- [x] [Cấp lại thẻ QR](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-18779) — đợt 4
- [x] [Hồ sơ bò › Dòng thời gian](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-18938) — đợt 4
- [x] [Hồ sơ bò › Lịch sử chuồng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-19173) — đợt 4
- [x] [Chuyển chuồng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-19426) — đợt 4
- [x] [Hồ sơ bò › Thẻ QR](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-19623) — đợt 4
- [x] [Cập nhật hồ sơ bò – Định danh & mô tả](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-19863) — đợt 4
- [x] [Hồ sơ bò › Tổng quan – bò mua ngoài](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-20030) — đợt 4 (cùng tab Tổng quan, dữ liệu bò mua ngoài)

**②b Nhập đàn theo phiếu nhập (FE-06)**

- [x] [Phiếu nhập – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-20334) — `/herd-entry` · đợt 4
- [x] [Phiếu nhập mới – Mua ngoài](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-20685) — `/herd-entry/new` · đợt 1
- [x] [Thêm / sửa con trong phiếu nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-21059) — đợt 4
- [x] [Nhập danh sách bò từ Excel](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-21349) — `/herd-entry/new?m=excel` · đợt 7. Bảng kết quả một khung viền, "Đổi tệp" là liên kết chữ như Figma. Giữ nút "Tải mẫu .xlsx" cỡ nhỏ và hộp thoại cách đỉnh 24 px để vừa bảng dài.
- [x] [Phiếu nhập mới – Bê sinh tại trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-21575) — `/herd-entry/new` · đợt 4 (sửa thêm nút "Đánh dấu chết" bị bẻ chữ)
- [x] [Chi tiết phiếu nhập – Đã nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-21861) — `/herd-entry/:id` · đợt 4
- [x] [Ghi nhận thanh toán phiếu nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-22176) — `/herd-entry/:id?m=pay` · đợt 7. Tệp đính kèm là dòng trơn như Figma. Giữ câu "sổ thu chi, không phải hóa đơn thuế" khi còn nợ.
- [x] [Hủy phiếu nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-22350) — `/herd-entry/:id?m=cancel` · đợt 7. Bảng kiểm tra trước khi hủy dùng Table bo 16 px.
- [x] [Sửa / hủy bản ghi nhập đàn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-22505) — `/herd-entry/:id?m=line&entry=:entryId` · đợt 7. Hộp thoại chỉ bật khi chạy với backend nên so bằng code, chưa chụp runtime. Lựa chọn Sửa/Hủy dùng Radio chung. Giữ tiêu đề "Sửa / Hủy bản ghi nhập", độ rộng 840 px và các dòng của phiếu mua (người bán, giấy kiểm dịch, biển số xe).

**③b Chuồng trại (FE-04)**

- [x] [Chuồng trại – danh sách & chi tiết](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-22736) — `/pens` · đợt 4
- [x] [Tạo / sửa chuồng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-23078) — `/pens?barn=:code&m=edit` · đợt 7. Giữ ô chọn tiêu chí sửa ngay trong bảng và độ rộng 680 px. Figma dùng danh sách thả xuống, nút "Thêm tiêu chí" và nhóm Tình trạng sử dụng; không thêm trường.
- [x] [Ngừng / mở lại sử dụng chuồng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-23263) — `/pens?barn=:code&m=disable` · đợt 7. Giữ badge trạng thái mới thay cho radio của Figma. Ba ô thông tin xuống hai cột trên điện thoại để badge không bị cắt.

**④b Xuất đàn theo phiếu xuất (FE-13)**

- [x] [Phiếu xuất – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-23423) — `/herd-exit` · đợt 4
- [x] [Phiếu xuất mới – Bán](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-23741) — `/herd-exit/new` · đợt 4
- [x] [Chọn bò vào phiếu xuất](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-24141) — đợt 4
- [x] [Phiếu xuất – Chết / mất (chờ xác nhận)](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-24394) — `/herd-exit/:id` (phiếu Chết / mất chờ xác nhận) · đợt 7. Bảng bò trong phiếu và bảng kiểm tra trước khi xác nhận dùng Table bo 16 px (bảng kiểm tra dùng chung với phiếu bán).
- [x] [Chi tiết phiếu xuất – Đã xuất](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-24680) — `/herd-exit/:id` · đợt 4
- [x] [Hủy phiếu xuất](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25005) — `/herd-exit/:id?m=cancel` · đợt 7. Giữ biểu tượng trong hai ghi chú xanh và vàng.
- [x] [Ghi nhận thu tiền phiếu xuất](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25145) — `/herd-exit/:id?m=collect` · đợt 7. Ba số tiền xuống một cột trên điện thoại.

**⑤b Kỹ thuật viên – Đàn bò & hồ sơ bò (chỉ xem)**

- [x] [Kỹ thuật viên · Đàn bò](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25332) — `/kt/dan-bo` · đợt 4
- [x] [Kỹ thuật viên · Quét QR](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25426) — `/kt/quet-qr` · đợt 4
- [x] [Kỹ thuật viên · Hồ sơ bò › Tổng quan](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25477) — đợt 4
- [x] [Kỹ thuật viên · Hồ sơ bò › Dòng thời gian](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25591) — đợt 4

## Tab 17 · Tăng trưởng, Tiêm phòng & Sức khỏe

**①b Tăng trưởng & BCS – Quản lý (FE-08)**

- [x] [Tăng trưởng & BCS – danh sách đàn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-2192) — `/can-nang` · đợt 4
- [x] [Ghi nhận cân & BCS](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-2881) — đợt 4
- [x] [Sửa / loại trừ bản ghi cân](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-3097) — `/cattle/:code?tab=growth&m=correct` · đợt 7. Giữ tiêu đề "Sửa bản ghi cân", các dòng vòng ngực, dài thân và ô Ghi chú. Figma có ô Bản ghi, lựa chọn Sửa/Loại trừ và Lý do; loại trừ đang ở hộp thoại "Xóa lần đo?".
- [x] [Hồ sơ bò › Tăng trưởng & BCS](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2789-1980) — `/cattle/:code?tab=growth` · đợt 1
- [x] [Dự kiến xuất bán · Không áp dụng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2798-2269) — đợt 4
- [x] [Dự kiến xuất bán · Chưa đủ dữ liệu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2798-2286) — đợt 4

**②b Tiêm phòng – Quản lý (FE-09)**

- [x] [Lịch tiêm phòng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-3306) — `/tiem-phong` · đợt 4
- [x] [Quản lý lịch tiêm](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-3616) — đợt 4
- [x] [Ghi nhận tiêm](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-3890) — đợt 4. Không thêm ô "Số lô" trong Figma: đã bỏ theo D44.
- [x] [Hồ sơ bò › Tiêm phòng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-4155) — đợt 4
- [x] [Hoãn mũi tiêm](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-4456) — `/cattle/:code?tab=vaccine&m=defer` · đợt 7.
- [x] [Sửa / hủy bản ghi tiêm](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-4614) — `/cattle/:code?tab=vaccine&m=correct` · đợt 7. Hộp thoại React không có dòng Số lô mà Figma có; không thêm trường.
- [x] [Lịch sử tiêm phòng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-4850) — đợt 4
- [x] [Sửa / hủy bản ghi điều trị](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-5098) — `/cattle/:code?tab=health&m=correct` · đợt 7. Ghi chú "Ngưng thịt đến" đặt sau ô Lý do như Figma; màu xanh khi ngày thay đổi, xám khi giữ nguyên.

**③b Sức khỏe & Điều trị – Quản lý (FE-10)**

- [x] [Ca sức khỏe – danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-5335) — `/suc-khoe` · đợt 4
- [x] [Hồ sơ bò › Sức khỏe](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-5644) — đợt 4
- [x] [Mở ca sức khỏe / ghi bất thường](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-5934) — `/cattle/:code?tab=health&m=open-case` · đợt 7. Ô chọn ca đang mở chỉ hiện khi chọn "Nối vào ca đang có".
- [x] [Ghi theo dõi ca sức khỏe](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6139) — `/cattle/:code?tab=health&m=follow-up` · đợt 7. Giữ nhãn diễn biến "Tốt hơn / Không đổi / Xấu hơn".
- [x] [Ghi điều trị](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6309) — đợt 4
- [x] [Cập nhật trạng thái / đóng ca](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6504) — `/cattle/:code?tab=health&m=update-status` · đợt 7. Giữ nhóm Diễn biến và ô Nghi truyền nhiễm.
- [x] [Cập nhật trạng thái / đóng ca – Chết](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6685) — `/cattle/:code?tab=health&m=update-status` (Đóng ca → Chết) · đợt 7. Cảnh báo đỏ và nút "Xác nhận đóng ca" đỏ như Figma.

**④b Kỹ thuật viên – Tăng trưởng, tiêm phòng, sức khỏe trong hồ sơ bò (chỉ xem)**

- [x] [Kỹ thuật viên · Hồ sơ bò › Tăng trưởng & BCS](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6877) — đợt 4
- [x] [Kỹ thuật viên · Hồ sơ bò › Tiêm phòng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6971) — đợt 4
- [x] [Kỹ thuật viên · Hồ sơ bò › Sức khỏe](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-7064) — đợt 4

## Tab 18 · Sinh sản

**①b Danh sách theo dõi sinh sản (FE-11, FE-12)**

- [x] [Sinh sản – Danh sách theo dõi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-10410) — `/sinh-san` · đợt 3

**②b Hồ sơ bò › Sinh sản – Đang động dục (FE-11)**

- [x] [Hồ sơ bò › Sinh sản – Đang động dục](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-10669) — `/cattle/:code?tab=repro` · đợt 3
- [x] [Ghi động dục](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11011) — đợt 3
- [x] [Ghi phối giống](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11178) — đợt 3
- [x] [Sửa / hủy bản ghi động dục, phối giống](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11404) — đợt 3

**③b Hồ sơ bò › Sinh sản – Đã phối, chờ khám thai (FE-12)**

- [x] [Hồ sơ bò › Sinh sản – Đã phối, chờ khám thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11608) — `/cattle/:code?tab=repro` · đợt 3
- [x] [Ghi khám thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11931) — đợt 3

**④b Hồ sơ bò › Sinh sản – Đang mang thai & sinh bê (FE-12)**

- [x] [Hồ sơ bò › Sinh sản – Đang mang thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-12139) — `/cattle/:code?tab=repro` · đợt 3
- [x] [Ghi diễn biến thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-12503) — đợt 3
- [x] [Ghi sự kiện đẻ & kết quả bê](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-12686) — `/cattle/:code/sinh-san/de` · đợt 3
- [x] [Ghi sự kiện đẻ – lỗi trùng mã thẻ tai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13014) — đợt 3
- [x] [Sửa / hủy kết quả khám thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13348) — đợt 3
- [x] [Sửa / hủy diễn biến thai, sự kiện đẻ, kết quả bê](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13575) — đợt 3

**⑤b Kỹ thuật viên – chỉ xem**

- [x] [Kỹ thuật viên · Sinh sản – Danh sách theo dõi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13800) — `/kt/sinh-san` · đợt 3
- [x] [Kỹ thuật viên · Quét QR → nhận diện bò](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13870) — `/kt/quet-qr` · đợt 3. Thẻ kết quả theo Figma; trước khi quét vẫn giữ nút Bật camera / Quét từ ảnh / nhập mã hiện có.
- [x] [Kỹ thuật viên · Hồ sơ bò › Sinh sản – Đang động dục](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13918) — `/kt/dan-bo/:code?tab=repro` · đợt 3
- [x] [Kỹ thuật viên · Hồ sơ bò › Sinh sản – Đang mang thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-14024) — `/kt/dan-bo/:code?tab=repro` · đợt 3

## Tab 19 · Danh mục & Tham số

**①b Danh mục trại (FE-18)**

- [x] [Giống bò – danh sách & biên tập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29103) — `/danh-muc/giong` · đợt 3
- [x] [Vắc-xin – danh sách & biên tập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29381) — `/danh-muc/vac-xin` · đợt 3
- [x] [Thuốc tham chiếu – danh sách & biên tập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29680) — `/danh-muc/thuoc` · đợt 3
- [x] [Mục đích nuôi – danh sách & biên tập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29950) — `/danh-muc/muc-dich` · đợt 3

**②b Tham số trạng thái & nhắc việc (FE-18)**

- [x] [Tham số trạng thái & nhắc việc](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-30215) — `/danh-muc/tham-so` · đợt 3
- [x] [Lịch sử phiên bản tham số](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-30515) — `/danh-muc/tham-so/lich-su` · đợt 3

## Tab 21 · Quản lý thức ăn

**①b Kho thức ăn – Tồn kho, phiếu nhập kho, kiểm kê (FE-23)**

- [x] [Thức ăn – Tồn kho](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-32233) — `/thuc-an` · đợt 2. Khác Figma có chủ đích: khối nổi bật là "Sắp hết / hết" (việc cần xử lý, §1), Figma để "Thức ăn đang dùng".
- [x] [Phiếu nhập kho – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-32630) — `/thuc-an/phieu-nhap` · đợt 3
- [x] [Phiếu nhập kho – Tạo mới](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-32954) — `/thuc-an/phieu-nhap/moi` · đợt 3
- [x] [Kiểm kê / điều chỉnh tồn kho](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-33345) — `/thuc-an/kiem-ke/moi` · đợt 3
- [x] [Phiếu nhập kho – Chi tiết (đã ghi)](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-33696) — `/thuc-an/phieu-nhap/:id` · đợt 3
- [x] [Hủy phiếu nhập kho](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34087) — đợt 3

**②b Khẩu phần (FE-23)**

- [x] [Khẩu phần – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34243) — `/thuc-an/khau-phan` · đợt 3
- [x] [Sửa khẩu phần – tạo phiên bản mới](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34545) — `/thuc-an/khau-phan/:id` · đợt 3

**③b Nhật ký cho ăn (FE-23)**

- [x] [Nhật ký cho ăn – theo ngày](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34857) — `/thuc-an/nhat-ky` · đợt 3
- [x] [Ghi cữ cho ăn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-35261) — đợt 3
- [x] [Sửa / hủy bản ghi cho ăn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-35488) — đợt 3

**④b Danh mục thức ăn & báo cáo (FE-23)**

- [x] [Danh mục thức ăn & nhà cung cấp](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-35666) — `/thuc-an/danh-muc` · đợt 3
- [x] [Báo cáo tiêu thụ & chi phí thức ăn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-36049) — `/thuc-an/bao-cao` · đợt 3

**⑤b Kỹ thuật viên – khẩu phần hôm nay (điện thoại)**

- [x] [Kỹ thuật viên · Khẩu phần hôm nay](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-36359) — `/kt/thuc-an` · đợt 3
