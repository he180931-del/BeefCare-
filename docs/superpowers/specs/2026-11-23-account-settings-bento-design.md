# Thiết kế hiện hành cho popup Cài đặt tài khoản

## Mục tiêu

Làm popup Cài đặt dễ quét, phân biệt rõ dữ liệu chỉ đọc với dữ liệu có thể sửa và giữ người dùng trong trang đang làm việc. Popup dùng chung cho mọi vai trò sau đăng nhập.

## Phương án

- Chọn **Bento lai sáng**: Hồ sơ dùng lưới 2 × 2; Quyền theo vai trò dùng một thẻ chọn vai trò và một thẻ bảng quyền lớn.
- Không dùng thẻ xanh đậm làm header nội dung vì cạnh sidebar xanh tạo khối màu quá nặng.
- Không bọc toàn bộ nội dung trong một thẻ ngoài; mỗi khối tự có nền, viền và khoảng cách.
- Không chia từng quyền thành một thẻ riêng vì danh sách quyền dài và cần quét theo cột.

## Bố cục

- Popup tối đa khoảng 940 × 640 px, co theo viewport; header `Cài đặt` cố định, nút đóng ở góc phải.
- Sidebar xanh sáng hơn màu điều hướng chính, chữ trắng, gồm đúng hai mục **Hồ sơ** và **Quyền theo vai trò**.
- Sidebar không cuộn cùng nội dung; vùng nội dung bên phải cuộn độc lập. Trên màn hình hẹp, sidebar chuyển thành hàng tab ngang.
- Tab Hồ sơ:
  - Hàng một: thẻ nhận diện nền xanh trắng nhạt (avatar, họ tên, loại tài khoản) và thẻ Trạng thái tài khoản (email + trạng thái xác minh).
  - Hàng hai: thẻ Thông tin cá nhân (họ tên, điện thoại, nút **Lưu thay đổi** ở cuối thẻ) và thẻ Bảo mật (phương thức đăng nhập, nút Đổi/Thêm mật khẩu).
  - Nút lưu không đặt ở tiêu đề popup vì chỉ lưu hai trường trong Thông tin cá nhân.
- Tab Quyền theo vai trò:
  - Thẻ giới thiệu vai trò chứa bộ chọn Chủ trại, Quản lý, Kỹ thuật viên và mô tả ngắn.
  - Thẻ quyền lớn giữ bảng chức năng/quyền hiện tại, chỉ hiển thị mức khác `NO`.

## Phong cách

- Nền nội dung `#fbfbf8`; thẻ trắng hoặc xanh trắng rất nhạt, viền xanh xám nhẹ, bo tròn 16 px.
- Xanh BeefCare đậm dùng cho avatar, tiêu đề và hành động chính; không dùng làm mảng nền lớn ở phần nội dung.
- Nội dung ưu tiên căn trái, khoảng cách đều, độ tương phản rõ và hỗ trợ bàn phím.

## Đổi và thêm mật khẩu

- Nút trong thẻ Bảo mật mở popup con.
- Tài khoản có mật khẩu: mặc định hỏi mật khẩu hiện tại, mật khẩu mới và xác nhận.
- Tài khoản Google có thể chọn **Xác minh bằng Google**. Xác minh có hiệu lực 5 phút trong session; sau callback popup được khôi phục và chỉ còn mật khẩu mới + xác nhận.
- Tài khoản chỉ có Google: popup **Thêm mật khẩu** khóa nút lưu cho tới khi xác minh; sau callback mở lại đúng popup Thêm mật khẩu.
- Callback đi qua route tương thích `/tai-khoan` và phải giữ `m=doi-mat-khau&googleReauthenticated=true` khi chuyển tới trang phù hợp với phiên.

## Không thay đổi

- Không đổi schema dữ liệu, validation hồ sơ hoặc bảng quyền.
- Không đổi nội dung hoặc nguồn dữ liệu bảng quyền.
- Không thêm dependency hoặc animation trang trí.

## Kiểm chứng

- Unit test cấu trúc Bento, vị trí nút lưu, bảng quyền và popup con.
- Test callback Google giữ query và mở lại đúng trạng thái Đổi/Thêm mật khẩu.
- Chạy test account, typecheck và build.
- Kiểm tra thủ công popup tại `1180x820` và `1440x900`, gồm cuộn dọc và không tràn ngang.
