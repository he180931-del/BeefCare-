# Kịch bản kiểm tra phần Tài trên BeefCare local

Áp dụng cho FE-07, FE-14, FE-15, FE-23, JOB-01, JOB-07 và phần API-04 được kiểm bằng Mailpit. Dùng SRS 28/10, các quyết định D04/D12 và dữ liệu tổng hợp. Ghi vai trò, thao tác, kết quả thực tế và ảnh hoặc mã lỗi khi có khác biệt.

## Vào môi trường kiểm thử

1. Mở `http://127.0.0.1:5173/sign-in`. Frontend gọi backend `127.0.0.1:8080` qua Vite. Đăng nhập bằng mật khẩu seed của backend local.
2. Chọn **BeefCare Local Farm A**. Dùng `owner@beefcare.local`, `manager@beefcare.local`, hoặc `technician@beefcare.local`. Dùng cửa sổ riêng để giữ phiên của các vai trò độc lập. Tài khoản `other-owner@beefcare.local` có Farm B để kiểm tra cách ly. Farm C giữ dữ liệu đo tải.
3. Dùng `http://127.0.0.1:8025` để xem email thử. Mailpit giữ thư trên máy này.

## Các luồng cần tự kiểm

| Phạm vi và vai trò | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| FE-23 · Owner hoặc Manager | Thức ăn → Phiếu nhập → Tạo phiếu. Chọn nhà cung cấp và thức ăn có sẵn, nhập 10 kg rồi thử hạn dùng bằng ngày nhập. Đổi hạn sang ngày sau, lưu nháp, ghi sổ, mở lại và ghi trả một phần. | Ngày bằng ngày nhập bị chặn ở dòng thức ăn. Lưu nháp chưa đổi tồn. Ghi sổ cộng đúng kg và khoản còn nợ. Ghi trả giảm nợ. Tồn kho hiển thị hạn dựa trên phiếu đã ghi sổ theo D04. |
| FE-23 · Owner hoặc Manager | Thức ăn → Kiểm kê. Chọn số đếm lệch tồn, nhập lý do, lưu nháp, mở lại rồi ghi sổ. | Kiểm kê cập nhật chênh lệch đúng một lần. Xem lại phiếu thấy lý do và số tồn lúc ghi. |
| FE-23 · Manager | Thức ăn → Khẩu phần. Tạo bản có ngày hiệu lực trong tương lai, mở lại và hủy. Vào Nhật ký cho ăn, ghi một cữ hợp lệ, sửa lượng rồi hủy bản ghi. | Khẩu phần hủy vẫn có lịch sử. Nhật ký không cho ghi trùng một cữ đang hiệu lực. Sửa thay đổi tồn theo chênh lệch, hủy hoàn lượng thực tế. |
| FE-07 / JOB-07 · Owner và Technician | Owner đăng thông báo cho một Technician cụ thể, sau đó đính chính. Technician đăng nhập lại và mở dòng đã nhận. Thử bằng Technician thứ hai hoặc Owner Farm B. | Người nhận đúng mở được phiên bản tương ứng. Đính chính giữ lịch sử và thông báo cho người đủ quyền. Người ngoài phạm vi không đọc được nội dung. |
| FE-14 / JOB-01 · Owner hoặc Manager | Tạo thức ăn có ngưỡng tối thiểu dương khi tồn đang bằng 0. Mở Nhắc việc và tìm thức ăn đó. Sau đó nhập đủ tồn. | Nhắc việc thiếu tồn xuất hiện khi sự kiện được xử lý, rồi kết thúc khi tồn vượt ngưỡng. Không tạo nhiều nhắc việc cho cùng một nguồn. |
| FE-15 · Owner hoặc Manager | Mở Tổng quan và Báo cáo. Chọn Hiệu quả sinh sản và Vỗ béo, chọn kỳ có dữ liệu và thử lọc chuồng. Với RPT-05 tại Farm A, đặt ngày cuối kỳ là ngày chạy fixture. | RPT-05 có `BC-009901` chờ phối tại QA-A và `BC-009902` động dục tại QA-B. Lọc QA-A hoặc QA-B chỉ còn nhóm tương ứng. Số lượng mẫu và tỷ lệ vỗ béo khớp dữ liệu nguồn. |
| JOB-07 · CS, PM hoặc SA | CS tạo yêu cầu nội bộ và chọn người nhận kiểm thử. Sau khi người nhận thấy thông báo, CS giao lại. Người nhận cũ thử mở thông báo đã tải trước đó. | Người nhận cũ bị từ chối với thông báo đã bàn giao. Người nhận mới thấy yêu cầu. Khi hoàn tất, CS hiện tại nhận thông báo. |
| API-04 · Owner | Gửi lời mời Technician tới một email tổng hợp tại `@beefcare.local`, rồi xem hộp thư Mailpit. | Mailpit nhận thư lời mời sau khi request đã lưu. Gửi lại cùng khóa idempotency ở tầng API không tạo thêm bản ghi hay thư. |

Khi thử một lệnh thay đổi tồn, ghi lại mã phiếu và số tồn trước/sau. Khi thử email, chỉ ghi số thư và tiêu đề cần thiết. Không ghi mật khẩu, cookie hoặc link có token vào bằng chứng.

Fixture sinh sản nằm trong [`scripts/tests/tai_local_reproduction_fixture.sql`](../../scripts/tests/tai_local_reproduction_fixture.sql). Dữ liệu đo 300 bò và 100 người dùng nằm ở Farm C và được nạp bằng [`scripts/tests/tai_local_performance_fixture.sql`](../../scripts/tests/tai_local_performance_fixture.sql). Hai script SQL kiểm tra đúng database QA trước khi ghi.
