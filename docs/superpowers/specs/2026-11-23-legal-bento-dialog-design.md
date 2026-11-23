# Popup Điều khoản và Chính sách

## Ý định

Đưa Điều khoản sử dụng và Chính sách dữ liệu vào đúng luồng đăng ký thay vì mở một trang pháp lý rời rạc. Người đăng ký phải đọc được nội dung dài mà không mất dữ liệu đang nhập; nội dung giao diện không hiển thị tên tài liệu nội bộ hoặc ghi chú nguồn.

## Mục tiêu

- Khi người dùng gửi form đăng ký email hợp lệ, mở popup trên chính trang đăng ký trước khi gọi API. Popup cũng được dùng ở bước chấp thuận sau Google OAuth.
- Giữ nguyên toàn bộ giá trị form khi mở/đóng popup. Checkbox chỉ giữ khi API lỗi để người dùng thử lại; đóng popup hoặc tải lại thì phải tick lại.
- Dùng hai tab ngang và phần văn bản dài cuộn độc lập; không dùng các ô Bento tóm tắt nội dung pháp lý.
- Dùng chung một nguồn nội dung cho popup và các route pháp lý truy cập trực tiếp.
- Tài khoản có Google liên kết và chưa chấp nhận điều khoản phải hoàn tất một bước đồng ý riêng trước khi dùng các chức năng đã đăng nhập; bước này không hoàn tất đăng ký Owner, không tạo trại và không cấp vai trò.

## Ngoài phạm vi

- Không thay đổi payload đăng ký hiện có; bổ sung lệnh chấp thuận độc lập dùng các cột `termsAccepted`/`termsAcceptedAt` sẵn có.
- Không thay đổi hình dạng dữ liệu `termsAccepted`/`termsAcceptedAt`; chỉ bổ sung lệnh chấp nhận độc lập để không lạm dụng endpoint đăng ký Owner.
- Không thêm migration hoặc phiên bản điều khoản trong đợt này (D49).
- Không thêm cơ chế bắt buộc cuộn hết mới được đóng hoặc mới được tick checkbox.
- Không tự thêm cam kết về bán/chia sẻ dữ liệu, cookie, thời hạn lưu toàn hệ thống, quyền yêu cầu xóa hoặc pháp luật áp dụng khi spec chưa quy định.
- Không thay thế bước rà soát cuối của PM/người phụ trách pháp lý.

## Hướng thiết kế đã chọn

Đã cân nhắc trang riêng, drawer bên phải và popup. Chọn popup nội dung ở giữa vì nó giữ người dùng trong ngữ cảnh đăng ký và bảo toàn form; drawer không phù hợp ngôn ngữ màn hình xác thực, còn trang riêng tạo cảm giác tách rời như hiện tại.

Popup rộng khoảng 820px, cao tối đa theo màn hình, gồm header cố định, nút đóng, hai tab ngang, vùng văn bản cuộn độc lập, checkbox xác nhận và footer hành động. Không hiển thị dòng nguồn SRS hoặc nút “Đã hiểu”. Trên màn hình hẹp, popup dùng gần toàn bộ chiều rộng; tab và câu xác nhận được phép xuống dòng.

## Nguồn và cấu trúc nội dung

### Điều khoản sử dụng

1. **Tài khoản và đăng ký:** email là định danh; email phải được xác minh; Owner chỉ hoàn tất đăng ký sau khi cung cấp họ tên và chấp nhận điều khoản. Nguồn: FE-01 §3.1, R-01-01, R-01-10, UC-FE01-01, SCR-03/SCR-07.
2. **Bảo vệ phương thức đăng nhập:** mật khẩu chỉ lưu dạng hash có salt, không hiển thị/ghi log/trả về; đăng nhập sai liên tiếp bị khóa tạm thời. Nguồn: FE-01 §3.2, R-01-03 đến R-01-05.
3. **Phiên đăng nhập:** phiên thường hết hạn sau 8 giờ không hoạt động, ghi nhớ tối đa 30 ngày; đăng xuất xóa trại đang chọn; đổi/đặt lại mật khẩu xử lý các phiên theo spec. Nguồn: FE-01 §3.4.
4. **Vai trò và phạm vi theo trại:** quyền phụ thuộc vai trò Owner/Manager/Technician tại từng trại; trại lưu trong trình duyệt không phải bằng chứng quyền và quyền được kiểm tra lại ở request. Nguồn: FE-01 R-01-12; FE-03 §3.2, R-03-07 đến R-03-18 và Table III-2.
5. **Trạng thái tài khoản và dịch vụ:** tài khoản SUSPENDED không đăng nhập được; nghiệp vụ trại phụ thuộc trạng thái dịch vụ, với ngoại lệ xem/quản lý được spec nêu. Nguồn: FE-01 R-01-08/R-01-09; FE-02 R-02-05 đến R-02-10.
6. **Tính toàn vẹn lịch sử:** tài khoản/membership và các lịch sử nghiệp vụ quan trọng không bị xóa tùy tiện; thay đổi thuộc phạm vi audit được ghi theo quy tắc feature. Nguồn: FE-01 §3.1; FE-03 R-03-13/R-03-18; REQUIREMENT_DECISIONS các quyết định audit tương ứng.

### Chính sách dữ liệu

1. **Dữ liệu tài khoản:** họ tên, email, điện thoại liên hệ, trạng thái, phương thức đăng nhập và dấu thời gian liên quan. Nguồn: FE-01 §3.1–3.2.
2. **Dữ liệu trang trại và phân quyền:** thông tin trại, membership, vai trò, lời mời và lịch sử thay đổi. Nguồn: FE-02 §3; FE-03 §3.
3. **Dữ liệu vận hành đàn:** hồ sơ bò và dữ liệu nhập/xuất đàn, tăng trưởng, tiêm phòng, sức khỏe, sinh sản, thức ăn theo từng feature spec. Chỉ mô tả theo nhóm, không tạo trường mới ngoài contract.
4. **Dữ liệu giao dịch và hỗ trợ:** gói dịch vụ, yêu cầu thanh toán, chứng từ, đối soát, phiếu hỗ trợ và lịch sử xử lý theo FE-19/FE-20/FE-21.
5. **Mục đích sử dụng:** xác thực tài khoản, cung cấp chức năng vận hành trại, thực thi quyền, duy trì lịch sử nghiệp vụ, thanh toán/đối soát và hỗ trợ. Mỗi mục đích phải gắn với feature đã có trong spec.
6. **Bảo vệ và truy cập:** mật khẩu/token nhạy cảm chỉ lưu dạng hash khi spec quy định; quyền theo tài khoản, vai trò và trại; không suy diễn rằng giao diện hoặc mã trên URL tự cấp quyền.
7. **Dịch vụ ngoài được nêu trong spec:** Google OAuth/OpenID Connect, dịch vụ email và SePay ở các luồng tương ứng. Chỉ nói hệ thống sử dụng các tích hợp này cho chức năng được mô tả, không tự thêm tuyên bố chia sẻ hoặc lưu trữ ngoài spec.
8. **Chỉnh sửa và lịch sử:** người dùng sửa được họ tên/điện thoại; các chỉnh sửa nghiệp vụ tuân theo quy trình hiệu chỉnh và audit của feature, không mặc định xóa bản ghi gốc.

## Trạng thái và tương tác

- Chọn từng tab hiển thị đúng tài liệu tương ứng.
- Chuyển tab không đóng popup.
- Nút ×, Escape và nhấn nền đóng popup khi luồng cho phép.
- Sau khi đóng, focus trở về nút đã mở popup; form đăng ký giữ nguyên dữ liệu nhưng checkbox đồng ý được đặt lại.
- Nội dung popup có heading đúng cấp, tab có trạng thái truy cập được và vùng cuộn dùng được bằng bàn phím.
- Checkbox **Tôi đã đọc và đồng ý…** là bắt buộc; nút **Đồng ý và xác nhận** chỉ bật khi đã tick.

## Cổng chấp nhận cho đăng nhập Google

- Email đăng ký bằng mật khẩu đã bắt buộc chấp nhận ở SCR-03 nên không đi qua cổng lần nữa.
- Sau Google OAuth, tài khoản có `termsAccepted=false` được đưa tới bước chấp nhận trước khi vào trang chính, bất kể họ là Owner mới, thành viên được mời hay nhân viên platform.
- Bước chấp nhận hiển thị popup pháp lý chung, checkbox và nút **Đồng ý và xác nhận**. Không tick thì không gửi lệnh.
- Backend cung cấp lệnh chấp nhận độc lập, chỉ đặt `termsAccepted=true` và `termsAcceptedAt` nếu chưa có; gọi lại không đổi thời điểm ban đầu.
- Cho tới khi chấp nhận, backend chặn các API nghiệp vụ đã đăng nhập khác bằng `MSG-FE01-14`; vẫn cho phép kiểm tra phiên, CSRF, đọc hồ sơ, chấp nhận điều khoản và đăng xuất.
- Google OAuth redirect thẳng đến `/chap-nhan-dieu-khoan` khi consent còn thiếu. Frontend session gate vẫn kiểm tra hồ sơ để không phụ thuộc riêng vào redirect.

## Kiểm chứng

- Unit test luồng đăng ký: gửi form hợp lệ để mở popup, chuyển tab, đóng popup và giữ dữ liệu form nhưng đặt lại checkbox.
- Unit test nguồn nội dung: các nhóm bắt buộc xuất hiện ở cả popup và route trực tiếp.
- HTTP test: lệnh chấp nhận không đặt `ownerRegistrationCompleted`, giữ thời điểm khi gọi lại và mở khóa API sau khi chấp nhận.
- Frontend test: Google-linked profile chưa chấp nhận chỉ thấy bước consent; sau khi lưu thành công mới render ứng dụng.
- Typecheck và build frontend.
- Kiểm tra thủ công tại 1180×820 và 1440×900; ghi rõ đây là kiểm tra runtime, không phải visual-regression tự động.
