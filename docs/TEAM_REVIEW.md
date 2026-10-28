# Phân công review và kiểm thử backend cho 4 người

Áp dụng cho bản bàn giao đang làm theo yêu cầu mới nhất của chủ dự án. Đọc HANDOFF_BACKEND.md trước để biết phạm vi và kết quả kiểm tra cuối. Các nhóm chức năng còn đang hoàn thiện; bảng này không có nghĩa toàn bộ đã hoàn thành. Mỗi người phụ trách luồng xuyên suốt của nhóm mình, đối chiếu UC, quy tắc, quyền và dữ liệu trong SRS thay vì chia theo controller/service/repository.

| Người | Phạm vi chính | Các luồng cần tự kiểm chứng |
|---|---|---|
| 1 | FE01–03, FE17, FE19, FE21–22: tài khoản, trại/thành viên, vận hành nền tảng, gói dịch vụ, thanh toán, tài chính | Đăng ký/xác minh/đăng nhập; mời và thu hồi quyền; đình chỉ/khôi phục; hết hạn dịch vụ; báo giá và webhook trùng/sai/thiếu/thừa/trễ; đối soát; biên nhận và số liệu thu chi. |
| 2 | FE04–06, FE08, FE13, FE16: chuồng, đàn, nhập/xuất, tăng trưởng, QR và timeline | Phiếu nhiều dòng; sức chứa; chuyển chuồng; nhập Excel; sửa/hủy có phụ thuộc; đề nghị chết/mất và Owner xác nhận; cân/BCS; thẻ cũ/thẻ khác trại; không mất lịch sử. |
| 3 | FE09–12 và FE18 phần chăm sóc: vaccine, bệnh/điều trị, sinh sản, bê và tham số | Lịch và liều; hoãn/tiêm/đổi/hủy; cách ly thịt; điều trị thực tế; phối không đồng nghĩa mang thai; mất thai/đẻ/bê nhập đàn; sửa/hủy có bản ghi phụ thuộc; hiệu lực tham số. |
| 4 | FE07, FE14–15, FE20, FE23: thức ăn, thông báo, nhắc việc, dashboard/báo cáo và hỗ trợ | Tồn và giá bình quân; cho ăn theo chuồng/ngày/buổi; trả tồn khi sửa/hủy; đúng người nhận; đủ REM01–13; đối chiếu báo cáo với nguồn; CS/PM/SA tách hội thoại và kết quả; xác nhận phiên bản giải quyết rồi mới đóng. |

Người 1 và 2 review chéo; người 3 và 4 review chéo. Mọi nhóm đều thử một tài khoản đúng quyền, một tài khoản sai quyền và một tài khoản thuộc trại khác. Kiểm tra gửi lặp, phiên bản cũ, hai thao tác đồng thời, lỗi giữa giao dịch và bản ghi bị hủy khi luồng có các điều kiện đó. Các trường hợp cần thiết được giữ thành kiểm thử hồi quy.

Các phần dùng chung gồm đăng nhập/phân quyền, idempotency, phiên bản, audit/revision, outbox, lưu tệp, cấu trúc lỗi và migration. Khi đổi chúng, người phụ trách thông báo cho các nhóm liên quan và có ít nhất một người khác review tác động. Migration mới dùng tên mới; không sửa nội dung changeSet đã áp dụng trên DB chung.

Frontend làm việc qua contract OpenAPI trong `docs/api/`, ví dụ luồng trong README và bộ gọi HTTP chung. Người đổi API cập nhật DTO, kiểm thử và contract trong cùng thay đổi; ghi rõ thay đổi trường/enum nếu có. Backend chịu trách nhiệm giao dịch và quy tắc; frontend hiển thị quyền/nút từ phản hồi và xử lý mã thông báo SRS.

Theo yêu cầu mới nhất của chủ dự án, bản bàn giao đang làm được push trực tiếp lên `main` để nhóm tiếp tục bằng agent; `production` dành cho sản phẩm cuối. Từng người review và sửa trên nhánh riêng rồi đưa thay đổi đã kiểm thử vào `main`. Bản bàn giao này chưa được công bố là backend hoàn tất.
