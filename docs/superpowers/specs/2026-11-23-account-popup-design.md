# Thiết kế popup Cài đặt

## Mục tiêu

Thay trang tài khoản độc lập bằng một popup lớn mở ngay trên trang người dùng đang làm việc. Popup chỉ xuất hiện sau khi đăng nhập, giữ nguyên bố cục sidebar xanh và cột nội dung đã duyệt, nhưng không có header BeefCare riêng.

## Cách tiếp cận

- Không chọn popup cục bộ trong từng layout vì sẽ tạo nhiều trạng thái và nhiều bản triển khai.
- Không chọn modal điều khiển hoàn toàn bằng route vì việc mở hồ sơ sẽ làm thay đổi trang nền và lịch sử điều hướng.
- Chọn một `AccountDialogProvider` đặt bên trong `SessionProvider`. Mọi `AccountMenu` gọi cùng một API mở popup, nên trang chọn trại, trang trại và trang nền tảng đều dùng đúng một giao diện.

## Giao diện và hành vi

- Bấm avatar rồi chọn **Hồ sơ của tôi** sẽ đóng menu và mở popup, không đổi URL.
- Popup tối đa 940 × 640 px, tự co theo viewport, có nền phủ mờ và bo góc; bấm nền ngoài hoặc `Escape` sẽ đóng.
- Header **Cài đặt** chạy ngang phía trên và chứa nút `×` ở bên phải, tách khỏi phần điều hướng và nội dung.
- Desktop giữ sidebar xanh 220 px ở trái, sáng hơn nhẹ so với sidebar chính của BeefCare. Sidebar có hai mục chữ trắng: **Hồ sơ**, **Quyền theo vai trò**.
- Sidebar độc lập, không cuộn. Chỉ cột nội dung bên phải cuộn; khoảng đệm đầu và cuối giữ như trang hiện tại.
- Mobile chuyển hai mục thành thanh tab ngang và toàn thân popup cuộn theo chiều dọc.
- Nội dung hồ sơ, lưu thay đổi, thông báo, xác thực lại Google và đổi/thêm mật khẩu giữ nguyên nghiệp vụ hiện tại.
- Hộp đổi mật khẩu mở phía trên popup tài khoản; đóng hộp đổi mật khẩu quay lại popup.
- Nội dung quyền theo vai trò và bộ chọn Chủ trại/Quản lý/Kỹ thuật viên giữ nguyên.
- Các route tài khoản cũ không còn render trang riêng; chúng chỉ chuyển hướng về luồng ứng dụng phù hợp để tránh duy trì hai UI.

## Phạm vi và ràng buộc

- Không thay API hồ sơ, quyền hay mật khẩu.
- Không thay dropdown avatar ngoài việc đổi mục **Hồ sơ của tôi** từ link thành nút mở popup.
- Popup chỉ được mount trong cây đã qua `AuthGate` và `SessionProvider`.
- Giữ khả năng truy cập bằng `role="dialog"`, `aria-modal`, nhãn đóng, thao tác bàn phím và focus nhìn thấy được.
