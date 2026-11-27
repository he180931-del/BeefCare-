# Đối chiếu màn hình: code dev ↔ wireframe (27/11/2026)

Nguồn: code `origin/dev` (d4ea8073), wireframe Figma BEEFCARE-1 trang 01–11, bản đồ `docs/requirements/screens.yaml`.
Chạy lại: `python docs/tools/screen_audit.py --all`. Bảng chi tiết bên dưới là kết quả tự động, cần người rà: "-wf" có thể là dữ liệu mẫu trên wireframe.

Nguyên tắc: code là chuẩn; SRS và wireframe sửa theo code. Trường dev bỏ mà chưa có quyết định D-xx thì đánh dấu để hỏi nhóm.

## Tóm tắt theo feature

| Feature | Mức lệch | Điểm chính cần sửa trên wireframe |
|---|---|---|
| FE-01, FE-22 | Nhẹ | Đổi nhãn "Nhập lại mật khẩu" thành "Xác nhận mật khẩu"; SCR-08 trình bày quyền khác code. |
| FE-02 | Nhẹ | SCR-12 thêm ô tìm trại. |
| FE-03 | Vừa | SCR-16 thiếu lọc trạng thái / vai trò, lịch sử vai trò, lý do bắt buộc. |
| FE-04 | Nhẹ | Trạng thái "Đang sửa chữa" và nhóm tiêu chí mẫu trên wireframe không còn trong code. |
| FE-05 | Nhiều | Hồ sơ bò đã gọn theo D78/D79 (tab Tổng quan, khối gập, tóm tắt chăm sóc, đổi mục đích, ảnh nhận diện); bộ lọc danh sách khác. |
| FE-06 | Nhiều | Thiếu khai báo lịch sử khi nhập (tiêm, bệnh, sinh sản), thanh toán (ngày, số tham chiếu), biển số xe, giấy kiểm dịch, phí vận chuyển, cách ly (D63, D76, D82). |
| FE-07 | Nhẹ | Trình soạn thảo có thanh định dạng và chọn thành viên riêng. |
| FE-08 | Vừa | "Loại trừ bản ghi" cũ → Sửa / Xóa (D72–D74); bộ lọc BCS thấp, quá hạn cân, kỳ ADG. |
| FE-09 | Vừa | Còn "Hoãn mũi tiêm", tab "Đã hoãn" (bỏ theo D46); thiếu đường tiêm khác, người ngoài, mã bò cần thêm. |
| FE-10 | Vừa | Điều trị: liều mỗi lần, số ngày dùng, ngày dùng cuối thay "Liệu trình"; theo dõi dài hạn, lý do mở lại. |
| FE-11, FE-12 | Nhẹ | Bỏ "Nguồn dữ liệu"; thêm "Điều kiện xét phối", "Mục đích nuôi *" khi đăng ký bê. |
| FE-13 | Nhiều | Thiếu loại chết / mất, phương án xử lý xác, nơi đến, biển số xe, giấy kiểm dịch, khấu trừ, hạn thu, đặt cọc; chi tiết phiếu có lý do bác, chứng từ. |
| FE-14 | Nhẹ | SCR-44 có lọc thời gian (3 / 7 / 30 ngày) và tìm kiếm. |
| FE-15 | Vừa | SCR-48 bộ chỉ số khác; SCR-87 Báo cáo thu chi chưa có wireframe (D86). |
| FE-16, FE-17 | Nhẹ | Timeline hiện chi tiết theo loại sự kiện; audit có lọc hành động / đối tượng. |
| FE-18 | Nhẹ | Thêm lọc trạng thái, tìm; SCR-56 "Áp dụng từ *", "Ghi chú nguồn *". |
| FE-19 | Vừa | Màn chủ trại khớp; SCR-62 đối soát có nhiều trường mới (khóa hoàn trả, tra cứu SePay). |
| FE-20 | Vừa | Đính kèm tệp; popup chuyển giao, hủy yêu cầu nội bộ, vai trò đích. |
| FE-21 | Vừa | SCR-71–73 nhiều cột và bộ lọc hơn wireframe. |
| FE-23 | Nhẹ | SCR-79 thiếu thanh toán nhà cung cấp, hủy phiếu (D85); SCR-81 thiếu ngày kết thúc, trạng thái. |

## Chi tiết theo màn

| SCR | Màn | Frame wireframe | +code (thiếu trên wireframe) | -wf (không còn trong code) |
|---|---|---|---|---|
| SCR-01 | Public Landing Page | 3 | BeefCare, đầu trang; Mở menu; Điều hướng trang | Bạn còn băn khoăn?; Cân, tiêm, điều trị, động dụ; Dòng thời gian, nhắc việc và; Dữ liệu từng trại tách biệt; Hệ thống tìm Internal Cattle; Hỗ trợ qua ticket; Hỗ trợ tiếng Việt; Internal Cattle ID bất biến;; Không giới hạn thành viên tr; Kỹ thuật viên quét bằng came; Lịch sử cập nhật; Quản lý chăm sóc bò thịt; Sinh sản & sinh bê; Thanh toán bằng chuyển khoản; Xem bảng giá; quyết định tự động thay ngườ; vai trò người dùng với quyền; Đã quét thẻ tai QR |
| SCR-02 | Sign In | 3 | — | Chưa có tài khoản chủ trại?; Tài khoản bị tạm ngưng |
| SCR-03 | Register Farm Owner | 1 | Xác nhận mật khẩu; Đăng ký bằng Google | — |
| SCR-04 | Verify Email | 1 | — | Về đăng nhập |
| SCR-05 | Forgot Password | 2 | Email tài khoản; Email đăng ký; Mật khẩu mới | — |
| SCR-06 | Set New Password | 2 | Email tài khoản; Email đăng ký | — |
| SCR-07 | Complete Owner Profile | 1 | Các bước đăng ký; Thư điện tử đăng nhập | — |
| SCR-08 | My Profile and Permissions | 2 | Cài đặt; Tài khoản; mật khẩu xác nhận; Đóng cài đặt | Báo cáo & tổng quan; Chuồng trại & chuyển chuồng; Hồ sơ & quyền của tôi; Hồ sơ bò & thẻ QR; Nhập đàn & xác nhận bê; Quyền của tôi trong trại này; long.tq@gmail.com |
| SCR-09 | Select Farm | 1 | — | Cẩm Lĩnh, Ba Vì, Hà Nội; Gửi ticket hỗ trợ; Suối Hai, Ba Vì, Hà Nội; Tản Lĩnh, Ba Vì, Hà Nội; Yên Bài, Ba Vì, Hà Nội |
| SCR-10 | Register Farm | 1 | Các bước đăng ký | Lai Sind, Brahman đỏ; Tạo trang trại và tiếp tục |
| SCR-11 | Farm Information | 1 | Các bước đăng ký | — |
| SCR-12 | Farm Service Overview | 2 | Tìm trại | Bảng điều khiển nền tảng; Không có quyền vận hành trại; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá; Tạm ngưng/khôi phục tách biệ |
| SCR-13 | Members and Roles | 3 | Các bước đăng ký; Email người nhận *; Ngưng | Báo cáo & tổng quan; Bùi Văn Khoa khoa.bv@gmail.com; Chuồng trại & chuyển chuồng; Email Gmail người nhận *; Gói dịch vụ & thanh toán; Hoàng Thị Lan lan.ht@gmail.com; Hồ sơ bò & thẻ QR; Lê Thị Mai mai.lt@gmail.com; Nguyễn Văn Hùng hung.nv@gmail.com; Nhập đàn & xác nhận bê; Phạm Văn Tú tu.pv@gmail.com; Trần Quốc Long long.tq@gmail.com; Xác nhận / hủy xuất đàn; phamtuan.kt@gmail.com; Đinh Văn Sơn son.dv@gmail.com; Đổi mục đích nuôi |
| SCR-14 | Farm Invitations | 1 | Các bước đăng ký; Email người nhận *; Hành động *; Hết hạn sau; Kích hoạt lại; Lý do * (5–500 ký tự); Ngày hiệu lực *; Ngưng; Quyền của vai trò; Vai trò mới *; Đổi vai trò | dinhthuy.kt@gmail.com Chưa có tài khoản; quang.manager@gmail.com Đã có tài khoản |
| SCR-15 | Accept Invitation | 2 | Các bước đăng ký | Từ chối sau |
| SCR-16 | User Accounts | 4 | Lý do *; Lịch sử vai trò; Lọc theo trạng thái; Lọc theo vai trò nền tảng; Tìm tài khoản theo tên hoặc email; Đóng thông báo | Bảng điều khiển nền tảng; Customer Support (CS); Không có quyền vận hành trại; Platform Manager (PM); Tài khoản toàn cục đăng nhập; Tìm ticket, trang trại, mã t |
| SCR-17 | Pens | 3 | Chuồng đích; Ngày chuyển *; Người thực hiện *; Sắp xếp theo mã chuồng | Bê sau cai sữa; Bò mang thai cận đẻ; Còn trống; Tình trạng sử dụng; Đang có / Sức chứa; Đang sửa chữa |
| SCR-18 | Cattle List | 2 | Bộ lọc đàn bò; Nhóm đàn; Sắp xếp; Tìm bò | Giới tính: Tất cả; Mục đích: Tất cả; Sức khỏe: Tất cả; Trạng thái đàn: Đang nuôi; Trạng thái: ACTIVE |
| SCR-19 | Cattle Profile – Overview | 5 | Biểu hiện; Chi tiết; Các tab hồ sơ bò; Cách ly thịt; Diễn biến; Ghi bất thường; Ghi cân & BCS; Ghi khám thai; Ghi nhận cân & BCS; Ghi nhận tiêm; Ghi tiêm; Hiện chỉnh sửa; Kết quả; Liều; Mở ca sức khỏe; Mục đích hiện tại; Mục đích mới *; Nguồn ghi nhận; Ngày hết ngưng thịt; Ngày ngưng thịt; Ngày tiêm; Người hỗ trợ; Người khám; Người quan sát; Người thực hiện; Người tiêm; Phương pháp; Sót nhau; Thao tác; Thời điểm tiêm; Thời điểm xảy ra; Thời điểm đẻ; Tình trạng bò mẹ; Tệp ảnh bò; Vắc-xin; Đường tiêm; Ảnh nhận diện | Hoa Vàng; Không có ca mở; Không có mũi quá hạn; Lông đỏ, đốm trắng trán; Mây |
| SCR-20 | Profile – Pen History | 2 | Lý do cảnh báo | Bắt đầu mục đích sinh sản |
| SCR-21 | Profile – QR Tag | 2 | — | Xác nhận cấp thẻ mới |
| SCR-22 | Scan QR | 3 | — | Động dục hôm nay |
| SCR-23 | Herd Entry Vouchers | 1 | Phân trang phiếu nhập | Vận hành / Nhập đàn |
| SCR-24 | Herd Entry Voucher – Purchase | 3 | Biển số xe; Chi tiết bệnh đã biết; Chi tiết sinh sản; Chi tiết tiêm phòng; Cách ly nhập đàn đến; Danh sách vaccine; Lý do *; Lưu nguồn; Mô tả bệnh; Mô tả bổ sung; Ngày thanh toán *; Năm sinh; Quay lại đàn bò; Số lứa đã đẻ trước nhập đàn; Số tham chiếu / nội dung chuyển khoản; Số tháng mang thai; Số tiền (đ); Tháng sinh; Tên người bán / chủ bò cũ; Tên vaccine; Tóm tắt và lưu phiếu; Đánh dấu chết trước đăng ký | Ghi chú cách ly; Không chửa; Ngày sinh hoặc tuổi (tháng); Phiếu nhập mới; anh-lo-bo-nhan.jpg; Đang chửa; ↳ Bò cái; ⇪ |
| SCR-25 | Herd Entry Voucher – Farm-born Calves | 1 | Biển số xe; Chi tiết bệnh đã biết; Chi tiết sinh sản; Chi tiết tiêm phòng; Cách ly nhập đàn đến; Danh sách vaccine; Lý do *; Lưu nguồn; Màu lông & đặc điểm; Mô tả bệnh; Mô tả bổ sung; Nguồn / chủ bò cũ *; Ngày thanh toán *; Người nhập; Năm sinh; Phí vận chuyển (đ); Quay lại đàn bò; Số giấy kiểm dịch; Số lứa đã đẻ trước nhập đàn; Số tham chiếu / nội dung chuyển khoản; Số tháng mang thai; Số thẻ tai; Số tiền (đ); Theo con; Theo kg; Thành tiền; Tháng sinh; Tên gọi; Tên người bán / chủ bò cũ; Tên vaccine; Tóm tắt và lưu phiếu; Đánh dấu chết trước đăng ký | Bố: không rõ; Phiếu nhập mới; ⇪ |
| SCR-75 | Herd Entry Voucher Detail | 3 | Bò bố; Bò mẹ; Chi tiết bệnh đã biết; Chi tiết sinh sản; Chi tiết tiêm phòng; Chính xác; Cơ sở cân; Danh sách vaccine; Khai báo lịch sử; Mô tả bệnh; Mô tả bổ sung; Ngày sinh; Người bán; Số lứa đã đẻ trước nhập đàn; Số tháng mang thai; Sửa khai báo lịch sử; Tên vaccine; Đã cân; Độ chính xác ngày sinh; Ước tính | Lưu thanh toán; Người lập / lưu |
| SCR-26 | Farm Announcements | 3 | — | — |
| SCR-27 | Announcement Editor | 2 | Chèn liên kết; Danh sách gạch đầu dòng; Danh sách số; In nghiêng; In đậm; Thành viên được chọn riêng; Định dạng nội dung | Xem lại & đăng |
| SCR-28 | Announcement Correction | 1 | Chèn liên kết; Danh sách gạch đầu dòng; Danh sách số; In nghiêng; In đậm; Định dạng nội dung | — |
| SCR-29 | Growth and BCS | 1 | BCS thấp; Chỉ số tăng trưởng; Kỳ ADG; Nhóm đàn; Quá hạn cân; Tìm mã hiển thị, số tai; Xem bò ADG thấp; Xem bò BCS thấp; Xem bò quá hạn cân | ADG thấp hơn chuồng; Ngày cân |
| SCR-30 | Profile tab – Growth and BCS | 4 | BCS mới; Cân nặng mới; Dài thân chéo mới; Phương pháp mới; Thể trạng và số lần đo; Thời điểm đo mới; Tăng cân bình quân (ADG); Tăng cân và lần cân tới; Vòng ngực mới | Cơ sở số liệu (tự động); Dự kiến đạt; Ghi bởi Trần Quốc Long; Loại trừ bản ghi; Nhập ghi chú; Sửa giá trị |
| SCR-31 | Vaccination Schedule | 1 | Nhóm đàn; Tìm mã bò, tên bò | Đã hoãn |
| SCR-32 | Manage Vaccination Schedule | 1 | Lý do *; Mã bò cần thêm; Ngày tiêm *; Nhóm đàn; Đã hoàn thành; Đóng danh sách | Thông tin lịch |
| SCR-33 | Record Vaccination | 1 | Tên người ngoài; Đường tiêm khác | — |
| SCR-34 | Profile tab – Vaccination | 3 | Bản ghi; Liều mới; Người tiêm mới; Số ngày ngưng mới; Thời điểm tiêm mới; Vắc-xin mới; Đóng danh sách; Đường tiêm khác mới; Đường tiêm mới | Hoãn mũi tiêm; Lý do chưa tiêm *; Lưu hoãn; Ngày dự kiến mới; Tiêm bởi Trần Quốc Long |
| SCR-35 | Vaccination History | 1 | Tìm mã hiển thị, số tai | — |
| SCR-36 | Health Cases | 1 | Chỉ số sức khỏe; Theo dõi dài hạn; Từ ngày; Đến ngày | — |
| SCR-37 | Profile tab – Health | 7 | Ca gần nhất; Chuyển theo dõi dài hạn; Chuyển về đang mở; Có – cách ly, báo thú y; Ghi chú; Liều mỗi lần *; Lý do mở lại *; Ngày dùng cuối; Ngày đóng; Người xác nhận đóng; Số ngày dùng (mỗi ngày 1 lần); Theo dõi dài hạn; Tổng số ca | Cải thiện; Diễn biến mới; Ghi theo dõi; Giữ OPEN; Ho, chảy nước mũi, bú kém; Liệu trình (ngày); Lưu ghi nhận; Lưu theo dõi; Lời khuyên thú y; Nối vào ca đang mở; Sửa giá trị; Thời điểm đóng *; Xấu đi |
| SCR-38 | Reproduction Worklist | 2 | Chỉ số sinh sản; Chờ phối; Lọc chuồng; Lọc giống; Lọc điều kiện phối; Sau sinh; Tìm bò; Động dục – cần phối | Theo dõi động dục |
| SCR-39 | Profile tab – Reproduction | 12 | Cân sơ sinh; Cơ sở cân; Giới tính; Khoảng thời gian; Kiểu đẻ; Liên kết động dục; Mã thẻ tai / QR; Mã tinh; Người đỡ đẻ; Sót nhau (quá 12 giờ); Thời điểm đẻ; Tình trạng bò mẹ sau đẻ; Động dục liên kết | Ghi bởi Trần Quốc Long; Liên kết sự kiện động dục; Nhập ghi chú; Phối / đậu thai; Số lần khám; Trung tâm giống Ba Vì |
| SCR-40 | Record Calving | 2 | Mục đích nuôi | — |
| SCR-41 | Herd Exit Vouchers | 1 | Kỳ nhanh; Từ ngày; Đến ngày | Hủy: ghi nhầm con; Vận hành / Xuất đàn |
| SCR-42 | Herd Exit Voucher | 2 | Cân gần nhất tối thiểu; Loại chết / mất; Lưu người mua; Mã thẻ QR; Nơi đến *; Phương án xử lý xác *; Tên người mua / thương lái; Tìm kiếm | Mũi tiêm, nhắc việc tương lai; Ngưng giết mổ còn hiệu lực; Nhóm đàn: Vỗ béo; Tìm mã bò, thẻ tai…; ⇪ |
| SCR-43 | Death / Missing Exit Voucher | 1 | Biển số xe; Cân gần nhất tối thiểu; Hạn thu phần còn lại; Khấu trừ (hao hụt, môi giới); Loại chết / mất; Lưu người mua; Mã thẻ QR; Ngày xuất *; Người mua / thương lái; Nhóm đàn; Nơi đến *; Phương thức; Phương án xử lý xác *; Số giấy kiểm dịch vận chuyển; Theo con; Theo kg; Tên người mua / thương lái; Tìm kiếm; Đã thu (đặt cọc) | — |
| SCR-76 | Herd Exit Voucher Detail | 3 | Chuồng cho từng con; Chết / mất; Cần xem lại sau khi hủy; Hình thức; Loại mất *; Loại thải; Lý do bác *; Mã phiếu; Nguyên nhân / ghi chú *; Nguồn đề xuất; Ngày chết / mất *; Người báo; Thêm chứng từ bằng chứng; Xử lý xác *; Xử lý xác khác; bê nháp; ca sức khỏe đã đóng; mũi tiêm đã hủy; thai đã đóng | Ghi nhận thu tiền; Người lập & xác nhận |
| SCR-44 | Farm Reminders | 2 | 3 ngày tới; 30 ngày tới; 7 ngày tới; 7 ngày tới và quá hạn; Chuồng / nhóm; Danh sách nhắc việc; Thời gian; Tìm nhắc việc; Tất cả thời gian | Bê chờ xác nhận nhập đàn; Hạn tiêm; Nhắc việc trang trại; Tiêm Viêm da nổi cục |
| SCR-45 | My Notifications | 1 | — | — |
| SCR-46 | Support Notifications | 3 | Tất cả; Đóng thông báo | Bảng điều khiển nền tảng; Customer Support; Không có quyền vận hành trại; Liên kết kiểm tra lại quyền; Platform Manager; Ticket được giao; TÀI CHÍNH NỀN TẢNG; Tìm ticket, trang trại, mã t; Yêu cầu chuyển sang COMPLETED |
| SCR-47 | Reconciliation Notifications | 1 | Tất cả | Bảng điều khiển nền tảng; Không có quyền vận hành trại; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá |
| SCR-48 | Farm Dashboard | 2 | 90 ngày; Bộ lọc tổng quan; Chỉ số bổ sung; Chỉ số chính; Cần chú ý sức khỏe; Dự kiến đẻ 30 ngày; Lấp đầy chuồng; Mũi tiêm đến hạn 7 ngày; Mở danh sách cân →; Quá hạn cân; Sinh sản 12 tháng; Tùy chọn; Xem báo cáo sinh sản →; Xem chuồng →; Xem danh sách cân; Xem danh sách cân →; Xem lịch tiêm; Xem nhật ký cho ăn; Xem sức khỏe | Cần theo dõi sức khỏe; Mục đích nuôi: Tất cả; Tiêm phòng đến hạn |
| SCR-49 | Management Reports | 1 | Chỉ số báo cáo; Cảnh báo dữ liệu; Kỳ báo cáo · từ – đến *; Nhóm đàn; Thông tin về phạm vi báo cáo; Trạng thái dữ liệu; Từ ngày; Đến ngày | Lượt phối |
| SCR-87 | Farm Cash Report | chưa có | Chiều; Nguồn; Nguồn đối chiếu; Tổng quan dòng tiền; Từ ngày; Đến ngày | — |
| SCR-50 | Profile tab – Timeline | 2 | Biểu hiện; Chi tiết; Diễn biến; Hiện chỉnh sửa; Kết quả; Liều; Lý do *; Nguồn ghi nhận; Ngày hết ngưng thịt; Ngày ngưng thịt; Ngày tiêm; Người hỗ trợ; Người khám; Người quan sát; Người thực hiện; Người tiêm; Phương pháp; Sót nhau; Thao tác; Thời điểm tiêm; Thời điểm xảy ra; Thời điểm đẻ; Tình trạng bò mẹ; Vắc-xin; Đường tiêm | Ghi bởi Trần Quốc Long; Khám thai: Có thai |
| SCR-51 | Platform Audit History | 1 | Bỏ lọc hành động; Lọc theo hành động; Lọc theo loại đối tượng; Sao chép mã truy vết; Tìm người thực hiện; Từ ngày; Đóng thông báo; Đến ngày | Bảng điều khiển nền tảng; Correlation ID; Không có quyền vận hành trại; MEMBERSHIP_PERMISSION_CHANGE; Siêu dữ liệu audit được phép; Tìm ticket, trang trại, mã t; ⚙ |
| SCR-52 | Breed Catalogue | 1 | Lọc theo trạng thái; Mã giống *; Mô tả; Tham số trạng thái & nhắc việc; Thêm giống; Tìm mã, tên | Sửa giống: Zebu đỏ |
| SCR-53 | Vaccine Catalogue | 1 | Liều tham chiếu; Lọc theo trạng thái; Ngưng sử dụng thịt; Nhà sản xuất; Nhắc lại sau; Tham số trạng thái & nhắc việc; Thêm vắc-xin; Trạng thái sử dụng; Tìm mã, tên; Đường tiêm | Chỉ vắc-xin chưa từng được t; Sửa vắc-xin: Aftopor; Vắc-xin tụ huyết trùng trâu |
| SCR-54 | Medicine Catalogue | 1 | Ghi chú; Lọc theo trạng thái; Ngưng sử dụng thịt *; Tham số trạng thái & nhắc việc; Thêm thuốc; Trạng thái sử dụng; Tìm mã, tên | Thông tin tham chiếu – không |
| SCR-55 | Production Purpose Catalogue | 1 | Loại mục đích *; Lọc theo trạng thái; Mô tả; Tham số trạng thái & nhắc việc; Thêm mục đích; Trạng thái sử dụng; Tìm mã, tên | Ngừng dùng chỉ chặn chọn mới; Sửa mục đích: Sinh sản |
| SCR-56 | State and Reminder Parameters | 1 | Ghi chú nguồn *; Tham số trạng thái & nhắc việc; Trạng thái sử dụng; Áp dụng từ * | Khởi tạo theo tài liệu khuyế; Thời điểm phối sau đứng yên; Tăng trưởng & nhắc việc |
| SCR-57 | Farm Subscription | 5 | Gửi yêu cầu hỗ trợ; Thử lại; Xem lại giá mới; Đóng | Được tạo yêu cầu mới từ |
| SCR-58 | Select Term and Review | 4 | Gửi hỗ trợ; Gửi yêu cầu hỗ trợ; Mở lại hướng dẫn; Tạo yêu cầu mới; Về lịch sử; Đóng | — |
| SCR-59 | Transfer Instructions | 2 | Gửi hỗ trợ; Gửi yêu cầu hỗ trợ; Lý do (không bắt buộc); Lịch sử thanh toán; Mã VietQR minh họa (demo); Mã biên lai; Mở lại hướng dẫn; Phương thức; Quay lại; Trang trại; Tạo yêu cầu mới; Xem lại giá mới; mã thanh toán | — |
| SCR-60 | Payment History and Detail | 3 | — | — |
| SCR-61 | Platform Subscriptions | 2 | Bao phủ; Quyền hiện tại / dịch vụ; Sắp xếp theo Xác nhận đến; Thanh toán hiện tại / xác nhận; Thanh toán tương lai / xác nhận; Trạng thái dịch vụ; Tìm tên trại hoặc mã thanh toán; Xác nhận đến ngày; Xác nhận đến từ ngày; Đã xác nhận đến / mở gia hạn | Bảng điều khiển nền tảng; Không có quyền vận hành trại; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá |
| SCR-62 | Payments and Reconciliation | 7 | Chi tiết chứng từ; Chi tiết thanh toán; Chứng từ / ứng viên; Chứng từ chưa phân bổ; Chứng từ cần xem; Chứng từ nguồn; Cửa sổ báo giá; Delivery / xử lý; Khóa hoàn trả; Kiểm tra chấp nhận; Kết quả hoàn trả; Kết quả hoàn đã xác minh; Kết quả thao tác; Kỳ mua bất biến; Lý do & bằng chứng *; Lý do khóa *; Lý do khóa hoàn trả; Lý do mở khóa; Lý do và tham chiếu chứng từ; Lịch sử xử lý; Mã giao dịch SePay; Mã giao dịch chiều ra; Mã tham chiếu chính xác; Nguồn tiền vào; Nguồn đã xác thực (chỉ đọc); Ngày hoàn trả; Ngày ngân hàng từ; Ngày ngân hàng đến; Ngân hàng / nhận lần đầu; Người khóa / thời điểm; Người nhận đã chốt; Phân bổ / xác nhận; Review gần nhất; Tham chiếu trao đổi; Thanh toán / phân bổ; Thanh toán nguồn; Thời hạn / giá / phiên bản; Tiền / người nhận; Tra cứu giao dịch SePay; Tra cứu mã chính xác; Tra cứu từ ngày; Tra cứu đến ngày; Trạng thái thanh toán; Trạng thái xem xét; Tìm mã thanh toán hoặc tên trại; Tạo / hết hạn; Xác minh chưa có khoản trả ra *; Xác nhận hệ thống; Xử lý chứng từ; Yêu cầu chờ thanh toán; Yêu cầu được chọn; Điều kiện không đạt | ACCEPT kiểm tra lại toàn bộ; Bảng điều khiển nền tảng; Chứng từ SePay chưa khớp luô; Không có quyền vận hành trại; Lưu quyết định HOLD; Lưu quyết định REJECT; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá; Yêu cầu PENDING |
| SCR-63 | Plan Prices | 3 | Hết hiệu lực; Lên lịch; Lý do *; Mô tả điều khoản; Đã rút lại | Bảng điều khiển nền tảng; Công bố và áp dụng ngay; Không có quyền vận hành trại; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá |
| SCR-64 | My Support Tickets | 2 | Tìm mã hoặc tiêu đề | Gửi yêu cầu mới; Không có ticket phù hợp; Ticket hỗ trợ của tôi |
| SCR-65 | Create Support Ticket | 3 | Tệp bằng chứng đã chọn; Đính kèm tệp | Danh sách ticket; Gửi ticket; Ticket hỗ trợ của tôi; Trang trại liên quan; Xem ticket |
| SCR-66 | Ticket Detail – Owner | 4 | Danh sách kết quả giải quyết; Danh sách lịch sử trạng thái; Kết quả công khai; Lý do đã lưu; Tệp đính kèm đã chọn; Yêu cầu / kết quả hiện tại; Đính kèm tệp | CS phụ trách; Danh sách ticket; Mở lại kèm lý do; Thông tin ticket; Ticket hỗ trợ của tôi; Về ticket; Xác nhận mở lại; Xác nhận đã giải quyết |
| SCR-67 | Ticket Queue | 1 | Bộ lọc hàng đợi; Lý do nhận *; Nhân viên hỗ trợ phụ trách; Tìm kiếm; Xác nhận nhận yêu cầu; Yêu cầu / trạng thái hiện tại; Yêu cầu của tôi | Bảng điều khiển nền tảng; Customer Support; Không có quyền vận hành trại; Phân công cần chú ý; Ticket của tôi; Ticket được giao; Tìm ticket, trang trại, mã t |
| SCR-68 | Ticket Processing | 7 | Danh mục; Danh sách trao đổi; Danh sách yêu cầu nội bộ; Ghi chú mới *; Ghi chú đóng (không bắt buộc); Gửi kết quả và Đã giải quyết; Gửi và chờ khách; Kết quả / xác nhận đã xem; Kết quả công khai *; Lý do *; Lý do chuyển giao *; Lý do hủy *; Lý do nhận *; Lưu ghi chú (chỉ nhân viên hỗ trợ thấy); Lịch sử ticket; Người nhận cụ thể *; Người đóng / thời điểm; Nhân viên hỗ trợ nhận *; Nội dung gửi công khai *; Nội dung yêu cầu *; Trả về hàng đợi; Vai trò đích *; Xác nhận hủy IR; Xác nhận nhận yêu cầu; Yêu cầu / trạng thái hiện tại; Yêu cầu / điều kiện; Điều kiện cần xem lại; Ưu tiên | Bảng điều khiển nền tảng; Chuyển giao ticket; Customer Support; Ghi chú nội bộ của CS; Không có quyền vận hành trại; Không thể đóng ticket khi cò; Sau khi đóng, ticket chỉ đọc; Thao tác được phép; Ticket đang RESOLVED (kết qu; Ticket được giao; Tìm ticket, trang trại, mã t; “Đã dùng Chrome mới, quét QR |
| SCR-69 | Assigned Internal Requests | 3 | Danh sách yêu cầu nội bộ; Ghi chú kết quả đã lưu; IR hiện tại; Lịch sử yêu cầu | Bảng điều khiển nền tảng; Câu hỏi từ CS; Không chứa dữ liệu ngân hàng; Không có quyền vận hành trại; Kết quả xử lý yêu cầu; Liên kết miền; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tài khoản ACTIVE, định danh; Tìm ticket, trang trại, mã t; Tìm trang trại, mã thanh toá; Đã ACCEPT chứng từ (khớp số |
| SCR-70 | Subscription Receipts | 1 | Múi giờ tính; Tìm biên nhận; Tìm kiếm; Từ ngày; Đến ngày | Bảng điều khiển nền tảng; Chứng từ chưa khớp, trùng ho; Không có quyền vận hành trại; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá |
| SCR-71 | Manual Finance Records | 1 | Chứng từ / diễn giải; Chứng từ / nguồn; Ghi sổ bởi / lúc; Khoản gốc; Liên kết khoản gốc; Loại / danh mục; Loại / danh mục / số tiền; Lý do; Lý do Hủy bỏ *; Lịch sử; Người / thời điểm Hủy bỏ; Phát sinh / phạm vi; Phát sinh / trại; Số tiền mới (VND) *; Thông tin gốc; Từ ngày; Đến ngày | Bảng điều khiển nền tảng; Hạ tầng máy chủ; In thẻ tai QR; Khoản thu/chi nền tảng ngoài; Không có quyền vận hành trại; Phí dịch vụ email; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá; Đào tạo tại trại |
| SCR-72 | Manual Finance Record Form | 1 | Chiều tiền ngày ngân hàng; Chứng từ / diễn giải; Chứng từ / nguồn; Diễn giải *; Ghi sổ bởi / lúc; Hồ sơ; Khoản gốc; Kiểm tra danh mục; Kiểm tra phạm vi; Kiểm tra số tiền; Liên kết khoản gốc; Loại / danh mục; Loại / danh mục / số tiền; Lý do; Lý do Hủy bỏ *; Nguồn khoản; Nguồn đã chọn; Ngày phát sinh *; Người / thời điểm Hủy bỏ; Phát sinh / phạm vi; Phát sinh / trại; Số chứng từ; Số tiền mới (VND) *; Thông tin gốc; Trạng thái; Tìm giao dịch đã xác thực; Xung đột | Bảng điều khiển nền tảng; Khoản thu chi – Nháp; Không có quyền vận hành trại; Nguồn giao dịch; Platform Manager; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá |
| SCR-73 | Platform Cash Report | 1 | Biểu đồ tròn cơ cấu; Danh mục; Danh mục giao dịch; Dòng tiền ròng lũy kế; Khoản chi; Loại giao dịch; Nguồn; Ngày dòng tiền; Phiên bản nguồn; Sắp xếp; Số tiền; Thu theo ngày trong kỳ; Thu từ gói đăng ký; Thu và chi theo ngày; Trạng thái; Tìm giao dịch; Tìm trại; Từ ngày *; Đến ngày * | Biên nhận + Thu khác; Biên nhận theo thời điểm ngâ; Bảng điều khiển nền tảng; Chi / Ròng; Dòng tiền theo phạm vi; Không có quyền vận hành trại; Không gồm nháp/hủy/chưa khớp; Platform Manager; Trại Yên Bài – Ba Vì; TÀI CHÍNH NỀN TẢNG; Tìm trang trại, mã thanh toá |
| SCR-74 | Technician Home | 1 | Tra cứu trại | Chào Mai |
| SCR-77 | Feed Stock | 1 | Chỉ số tồn kho; Các màn hình quản lý thức ăn; Cảnh báo tồn kho thấp; Nhóm thức ăn; Thao tác; Thao tác tồn kho; Trạng thái tồn kho; Tồn kho thức ăn | Chăm sóc / Thức ăn; Lô gần hết hạn |
| SCR-78 | Feed Receipts | 3 | Chỉ số phiếu nhập kho; Các màn hình quản lý thức ăn; Danh sách phiếu nhập kho; Thao tác | Cám hỗn hợp, Sữa thay thế; Cỏ voi, Cỏ non |
| SCR-79 | Feed Receipt Form | 1 | Các màn hình quản lý thức ăn; Danh sách thức ăn nhập kho; Ghi sổ; Hủy phiếu; Lý do hủy *; Lịch sử thanh toán; Mã / nội dung chuyển khoản; Ngày trả *; Ngày trả lần đầu; Phương thức thanh toán; Số tiền (đ) *; Thao tác; Tên nhà cung cấp *; Tạo phiếu; Xóa; Ô ký xác nhận; Điện thoại; ĐÃ GHI; ĐÃ HỦY | — |
| SCR-80 | Stock Adjustment | 1 | Các màn hình quản lý thức ăn; Danh sách phiếu kiểm kê | Trần Quốc Long, Lê Thị Mai |
| SCR-81 | Rations | 1 | Các màn hình quản lý thức ăn; Danh sách khẩu phần; Ngày kết thúc *; Thao tác; Tất cả; Đã hủy; Đã kết thúc | — |
| SCR-82 | Ration Editor | 1 | Các màn hình quản lý thức ăn; Xóa | — |
| SCR-83 | Feeding Log | 3 | Các màn hình quản lý thức ăn; Cảnh báo; Ngày sau; Ngày trước; Xóa | Bò ăn hết khẩu phần sáng; Thực tế hôm nay; Đã trừ kho hôm nay |
| SCR-84 | Feed Catalogue and Suppliers | 1 | Các màn hình quản lý thức ăn; Danh mục thức ăn và nhà cung cấp; Khu vực / địa chỉ; Thao tác; Tên nhà cung cấp *; Điện thoại | Hỗn hợp TMR; Khoáng – PG; Không đổi khi đã dùng |
| SCR-85 | Feed Consumption and Cost Report | 1 | Báo cáo tiêu thụ thức ăn; Các màn hình quản lý thức ăn; Giá trị hao hụt; Hao hụt điều chỉnh; Đầu trang báo cáo in | Cỏ non & sữa thay thế |
| SCR-86 | Today's Rations | 1 | Cữ cho ăn hôm nay | — |
