# Bộ dữ liệu QA riêng

Đã kiểm tra ngày 08/11/2026 với backend từ commit `5acd384`, PostgreSQL 16.15 và DB QA riêng: nạp lần đầu, nạp lặp, reset DB và nạp lại thành công. Chi tiết và giới hạn: `QA_CHECK_2026-11-08.md`. Không dùng cho production hoặc cơ sở dữ liệu chung. Dữ liệu tạo qua API, không chèn trực tiếp vào bảng; nếu API báo lỗi, dừng và ghi nhận lỗi, không sửa dữ liệu bằng SQL để ép thành công.

## Dữ liệu dự kiến

- Seeder có sẵn của profile `local`: 10 tài khoản, 3 trại A/B/C, thành viên và danh mục; mật khẩu do biến môi trường đặt. Trại B khác chủ để kiểm tra cách ly. Danh sách tài khoản ở `docs/LOCAL_SETUP.md`.
- `seed-qa-fixtures.py`: trên Farm A tạo hai chuồng QA-A/QA-B; một phiếu mua đã nhập, gồm hai con với thẻ QA-TAG-001/002; và một phiếu nháp chứa dòng QA-TAG-003. Dòng nháp chưa phải con bò đã nhập. Ngày nhập theo ngày hiệu lực của chuồng mới hơn. Có hai nhà cung cấp giả.
- Các lệnh API dùng khóa idempotency cố định; đã kiểm tra chạy lại trên DB mới mà không nhân bản. Nếu người kiểm thử sửa/xóa dữ liệu hoặc đổi cấu trúc, hãy reset **bộ QA riêng** thay vì kỳ vọng script phục hồi các thay đổi.

## Chuẩn bị và chạy trên Windows

1. Cài JDK 21, Docker Desktop, Python 3 và dùng Node theo `.nvmrc` nếu chạy FE. Tạo `.env` như `docs/LOCAL_SETUP.md`, dùng mật khẩu/secret riêng cho local; không commit chúng.
2. Trong PowerShell tại gốc repo, đặt biến môi trường `BEEFCARE_DB_PASSWORD`, `BEEFCARE_DEV_PASSWORD` và `BEEFCARE_LINK_SECRET` bằng giá trị local của nhóm. Sau đó chạy:

   ```powershell
   .\scripts\qa-fixture-db.ps1 start
   $env:BEEFCARE_DB_URL='jdbc:postgresql://localhost:15433/beefcare_qa'
   $env:BEEFCARE_DB_USERNAME='beefcare_qa'
   cd backend
   .\mvnw.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dspring-boot.run.profiles=dev,local' spring-boot:run
   ```

   Đợi migration và backend khởi động thành công. Các biến môi trường ở cửa sổ này ưu tiên hơn `.env`; xác nhận log backend dùng **port 15433, database beefcare_qa**. Cổng backend 8080 phải là tiến trình vừa khởi động, không phải ứng dụng khác.
3. Ở PowerShell thứ hai, đặt cùng `BEEFCARE_DEV_PASSWORD`, đứng ở gốc repo và chạy `python .\scripts\seed-qa-fixtures.py --isolated-qa-db`. Script chỉ gọi `127.0.0.1:8080`; tham số này là lời xác nhận của người chạy rằng backend đang nối DB QA, script không tự kiểm chứng được đích JDBC.
4. Kiểm tra danh sách trại, chuồng, bò và phiếu qua FE/API; đăng nhập tài khoản khác chủ để thử truy cập chéo. Ghi commit, ngày chạy, lệnh, kết quả và lỗi vào bằng chứng test, không lưu mật khẩu/cookie.

Trên máy kiểm tra Windows, `spring-boot:run` không tìm được main class khi repo nằm ở đường dẫn có dấu. Đã dùng jar đã đóng gói trong thư mục đường dẫn không dấu để chạy thử. Lệnh `package` vẫn thất bại tại Modernizer, nên việc sinh được jar không có nghĩa toàn bộ build đạt; xem `QA_CHECK_2026-11-08.md`.

## Reset

Dừng backend đang kết nối DB QA. Tại gốc repo, đặt `BEEFCARE_DB_PASSWORD`, chạy `.\scripts\qa-fixture-db.ps1 reset`, rồi làm lại bước 2–4. Reset xóa **toàn bộ dữ liệu của Compose project `beefcare-qa-fixtures`** và tạo DB rỗng; Liquibase và local seeder chạy lại khi backend khởi động. Lệnh không dùng compose/volume `beefcare-base-data` của nhóm. Không chạy reset khi còn cần giữ dữ liệu QA đó.

## Giới hạn

Đây là bộ nhỏ cho thao tác và kiểm tra phân quyền, không phải tập hiệu năng 300 con/2 năm; chưa có lịch sử chăm sóc, sinh sản, thanh toán hay dữ liệu đủ cho mọi tính năng. Phải bổ sung dataset theo từng test case và chạy lại kiểm chứng sau khi API hoặc schema thay đổi.
