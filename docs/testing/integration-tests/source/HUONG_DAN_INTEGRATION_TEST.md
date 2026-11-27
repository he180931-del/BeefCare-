# Hướng dẫn xây kịch bản Integration Test

Integration test kiểm tra **một feature chạy đúng khi các phần nối với nhau**: giao diện → API → dữ liệu lưu → email/thông báo. Ở dự án này test **thủ công trên giao diện**, không gọi API trực tiếp.

## 1. Xây kịch bản: 5 bước

**Bước 1. Chia feature thành chức năng chính.**
Đọc spec của feature (`docs/requirements/specs/`), lấy các chức năng người dùng thấy được. Chỉ lấy chức năng chính, bỏ chi tiết nhỏ.
Ví dụ FE-01: đăng ký, đăng nhập, quên mật khẩu, đổi mật khẩu, hồ sơ.

**Bước 2. Mỗi use case: 1 ca chính + các ca lỗi người dùng gặp trên màn hình.**
Theo báo cáo mẫu (FA25 G1), mỗi use case thường có 3–7 ca:
- 1 ca luồng chính (dữ liệu đúng → kết quả cuối).
- Các ca lỗi nhìn thấy được trên giao diện: để trống ô bắt buộc, dữ liệu sai định dạng, trùng (email đã tồn tại), sai mật khẩu, tài khoản bị khóa, không có quyền.
Không đi sâu như unit test (từng nhánh code, giá trị biên từng trường); mỗi ca lỗi là một tình huống người dùng thật sự làm.

**Bước 3. Viết từng ca theo khung cố định.**

- **Mô tả:** kiểm tra cái gì, một câu.
- **Điều kiện trước:** tài khoản nào, dữ liệu nào đã có, service nào đang chạy.
- **Các bước:** mỗi bước một dòng `1. 2. 3.`, ghi đúng tên nút/ô như trên giao diện và **dữ liệu cụ thể nhập vào** (ví dụ `Input email: 'owner@...'`, không ghi mật khẩu thật).
- **Kết quả mong đợi:** mỗi ý một dòng, ghi **nguyên văn thông báo** hiện ra, nói **thấy gì trên màn hình** (thông báo, trạng thái, danh sách) và **thứ phía sau** (email nhận được, bản ghi xuất hiện ở màn hình khác).

**Bước 4. Kiểm tra "đi qua nhiều tầng".**
Một ca integration tốt phải chứng minh dữ liệu đi hết đường. Ví dụ tạo khoản thu chi: sau khi bấm Lưu, **mở lại danh sách** và thấy khoản đó (chứng minh đã lưu), chứ không chỉ thấy toast "thành công".

**Bước 5. Sắp thứ tự và đặt mã.**
Trong mỗi use case: ca chính trước, ca lỗi sau. Mã dạng `FE01-INT-01`. Ca nào cần dữ liệu từ ca trước thì ghi ở điều kiện trước.

## 2. Ví dụ một ca hoàn chỉnh

**FE01-INT-01. Đăng ký bằng email mới và xác minh qua link trong email**

Điều kiện trước:
1. Email chưa đăng ký.
2. Backend, frontend và Mailpit đang chạy.

Các bước:
1. Mở `/dang-ky`, nhập họ tên, email mới, mật khẩu và xác nhận mật khẩu.
2. Bấm "Tạo tài khoản", tick đồng ý điều khoản, bấm "Đồng ý và xác nhận".
3. Mở hộp thư (Mailpit), bấm link xác minh.

Kết quả mong đợi:
1. Hiện trang "Xác minh email" với địa chỉ vừa nhập.
2. Hộp thư nhận đúng một email xác minh.
3. Sau khi bấm link, vào màn "Hoàn tất hồ sơ chủ trại", tên đã điền sẵn.

## 3. Cách thực hiện test

1. **Dựng môi trường** theo `docs/LOCAL_SETUP.md` (database, backend, frontend, Mailpit). Dùng tài khoản seed, mật khẩu lấy từ `.env`, không ghi vào tài liệu.
2. **Chạy từng ca đúng thứ tự các bước**, không bỏ bước, không đoán kết quả.
3. **So với kết quả mong đợi:**
   - Khớp hết → `Passed`.
   - Lệch → `Failed`, ghi cái gì khác (thấy gì, đáng lẽ thấy gì).
   - Không chạy được (thiếu dữ liệu, thiếu tài khoản) → `N/A` kèm lý do. Không ghi Passed khi chưa tận mắt thấy.
4. **Chụp một ảnh cuối cho mỗi ca**, chỉ cắt vùng chứng minh kết quả (thông báo, hộp thoại, dòng trong bảng). Không chụp cả màn hình. Mẫu thêm cột **Evidence** (cột F) ngay sau Pre-conditions và dán ảnh vào ô của dòng ca đó.
5. **Ghi vào file Excel**: kết quả, ngày test, người test, ghi chú.
6. **Ca Failed:** báo cho người sửa code, sửa xong chạy lại và ghi ở Round 2.

## 4. Lỗi hay gặp khi viết kịch bản

- Chỉ ghi "hiển thị thành công" mà không nói thấy gì cụ thể.
- Gộp nhiều chức năng vào một ca, không biết lỗi ở đâu.
- Bỏ quên ca lỗi (để trống, sai, trùng, không có quyền).
- Đi sâu như unit test (từng nhánh code, từng giá trị biên).
- Dùng tên nút trong tài liệu thay vì tên trên giao diện thật.
- Chỉ kiểm tra màn hình vừa thao tác, không kiểm tra dữ liệu ở màn hình khác hoặc email.

## 5. Nơi lưu file

Copy mẫu `Report5_IntegrationTest_Sample.xlsx` (không sửa file mẫu) thành file mới trong `docs/testing/`. Mỗi feature một sheet, các ca ghi theo khung ở bước 3. Ví dụ đã làm: `BeefCare_Report5.2_Integration_Test_UI_FE01_FE20_FE21_FE22.xlsx`.
