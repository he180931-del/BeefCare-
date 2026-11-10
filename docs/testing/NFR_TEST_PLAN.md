# Tiêu chí và kế hoạch kiểm thử NFR BeefCare

Nguồn: `docs/requirements/SRS_2026-10-28.txt`, mục IV.2; đối chiếu repo tại `5acd384`. Đây là **kế hoạch**, chưa phải kết quả kiểm thử. Mỗi case ghi ID NFR, dữ liệu và môi trường, bước, kết quả mong đợi/thực tế, Pass/Fail/Blocked, thời điểm, người thực hiện, phiên bản commit và link bằng chứng trong Report 5.4; lỗi ghi ID issue. Tránh lưu mật khẩu/token trong bằng chứng.

## 1. Hiệu năng và tải

| ID | Điều kiện / tiêu chí SRS | Cách đo dự kiến |
|---|---|---|
| P01 | Trang thông thường hiển thị nội dung dùng được ≤3 giây; đến 100 người dùng đã đăng nhập, mạng 4G bình thường hoặc mạng văn phòng | Đo thời điểm nội dung chính dùng được bằng trình duyệt và chạy tải đồng thời; ghi thiết bị, mạng, tải, từng mẫu và phân bố thời gian. |
| P02 | Hồ sơ bò mở ≤2 giây sau khi mã đã đọc; cùng điều kiện P01 | Quét mã hợp lệ, đo từ lúc đọc thành công đến khi hồ sơ hiển thị; không cộng thời gian camera nhận diện. |
| P03 | Gửi form trả thành công hoặc lỗi hợp lệ ≤2 giây; cùng điều kiện P01 | Đo cả trường hợp hợp lệ và validation lỗi. |
| P04 | Dashboard/báo cáo dùng bộ lọc thông thường ≤5 giây với khoảng 300 bò đang hoạt động và 2 năm lịch sử | Tạo dataset riêng đúng quy mô; đo cả UI/API, lưu mô tả dataset và truy vấn. |
| P05 | Giao dịch SePay đủ điều kiện cập nhật thanh toán và dịch vụ ≤10 giây từ lúc nhận; tải BE bình thường | Dùng sandbox và sự kiện hợp lệ, ghi thời điểm nhận và cập nhật; không thay bằng mock nếu kết luận tích hợp thật. |
| P06 | ≥100 người dùng đăng nhập đồng thời, chức năng cốt lõi không mất và vẫn đạt các ngưỡng trên; triển khai capstone một vùng | k6 đề xuất, chạy ramp-up/giữ tải với tài khoản và dữ liệu riêng; thống kê lỗi, thời gian và chức năng bị ảnh hưởng. |
| P07 | Nhắc việc phản ánh thay đổi nguồn ≤1 phút khi chạy theo sự kiện và ≤15 phút trong mọi trường hợp; JOB-01 hoạt động | Đo từ thời điểm lưu nguồn đến khi kết quả reminder cập nhật; thử cả hai đường chạy. |

Thống nhất trước khi chạy: định nghĩa điểm đo, kịch bản, số lần và cách kết luận theo phân bố; SRS chưa quy định percentile nên không tự công bố p95 là yêu cầu bắt buộc. Chỉ chạy tải trên môi trường nhóm cho phép, không dùng dữ liệu thật. Bộ QA nhỏ không đủ cho P04/P06.

## 2. Bảo mật và cách ly

| Nhóm SRS | Kiểm tra dự kiến và kết quả mong đợi |
|---|---|
| S01–S03 | Không đăng nhập và thử route/API được bảo vệ; dùng tài khoản khác role, khác trại, tài khoản bị khóa và trại bị ngưng. Backend từ chối đúng quyền, không lộ dữ liệu qua danh sách, số đếm, xuất file, cache hay link. |
| S04–S07 | Kiểm tra chính sách mật khẩu/hash, khóa 15 phút sau 5 lần sai, token hết hạn/một lần, cookie/session và bí mật cấu hình; kiểm tra logout, đổi mật khẩu và thu hồi session theo SRS. Không đưa secret vào log hay ảnh. |
| S08–S10 | Webhook sandbox chữ ký/thời gian sai bị từ chối; QR không vượt quyền trại; CS/PM/SA chỉ truy cập đúng phạm vi. Kiểm chứng bằng API và tài khoản tương ứng. |
| S11–S13 | Thay đổi quan trọng có audit cùng transaction, không sửa được; log không chứa bí mật; đổi vai trò/thu hồi quyền có hiệu lực từ request tiếp theo. |

Postman/Bruno hoặc API client, DevTools và test tự động BE là công cụ đề xuất. Nếu webhook, OIDC hoặc HTTPS chưa cấu hình thì đánh `Blocked`, không thay bằng kết quả giả.

## 3. Độ tin cậy, dữ liệu và vận hành

| Nhóm SRS | Kiểm tra dự kiến và kết quả mong đợi |
|---|---|
| R01 | Gây lỗi an toàn trong môi trường thử; dữ liệu nghiệp vụ, lịch sử, audit và outbox không được lưu dở dang. |
| R02 | Gửi lại cùng khóa/yêu cầu, webhook và job; kết quả đầu được dùng lại, không tạo bản ghi trùng. |
| R03 | Gửi cập nhật với version cũ và chạy đồng thời nghiệp vụ liên quan; version cũ bị từ chối, thao tác cần tuần tự không tạo trạng thái sai. |
| R04 | Mục tiêu sẵn sàng 99% mỗi tháng khi pilot, loại trừ bảo trì thông báo trước; cần hệ thống giám sát và thời gian pilot mới kết luận được. |
| R05 | Backup hằng ngày, giữ 14 ngày; thử restore trước pilot trên DB riêng, kiểm tra dữ liệu và thời điểm. Cần người phụ trách hạ tầng xác nhận. |
| R06 | Đối chiếu thời điểm lưu có múi giờ, ngày theo múi giờ trại và tài chính nền tảng Asia/Ho_Chi_Minh, kể cả sát nửa đêm. |

## 4. Giao diện, tương thích và dễ dùng

- I01–I13: kiểm kích thước ≥360/768/1280 px, thiết bị di động, QR qua HTTPS và đường thay thế, tiếng Việt, múi giờ; kiểm các trình duyệt/OS SRS nêu, OIDC email đã xác minh, email gửi sau commit/có retry và SePay sandbox tách live. Một số mục cần thiết bị thật/dịch vụ thật.
- U01: kỹ thuật viên được đào tạo mở đúng hồ sơ bò bằng quét trong tối đa 2 chạm từ trang chủ. U02: quản lý ghi sự kiện thường lệ dưới 60 giây từ hồ sơ đang mở. Ghi vai trò, mức đào tạo, kịch bản và thời gian.
- U03–U08: đo vùng chạm tối thiểu 44×44 px và thao tác bàn phím; kiểm nhãn dữ liệu, thông báo lỗi, role/trại hiện hành, trạng thái dịch vụ/thanh toán/ngưng và đăng ký tối đa 4 màn theo SRS. Dùng DevTools, thao tác bàn phím và checklist thủ công.
- I11 nêu Next.js trong SRS trong khi FE hiện tại dùng React/Vite. Đây là điểm cần nhóm/giảng viên thống nhất, chưa tự kết luận đạt yêu cầu công nghệ.

## 5. Đầu ra và công cụ

- Report 5.0: chiến lược, môi trường, công cụ, dữ liệu, trách nhiệm và tiêu chí vào/ra; bản điền I và II.1 ở cùng thư mục.
- Report 5.4: test case NFR và kết quả thực tế; đính kèm log đã loại secret, ảnh/video có thời điểm, thống kê tải và issue. Report 5.3 dành cho chức năng; 5.5 cho nghiệm thu.
- Công cụ đề xuất: JUnit/Mockito/Maven cho BE; Vitest/Testing Library và Playwright nếu nhóm chốt cho FE; Postman hoặc Bruno cho API; k6 cho tải; DevTools/Lighthouse và kiểm thủ công thiết bị cho giao diện. Công cụ đề xuất chưa đồng nghĩa đã được cài hay đã chạy.
