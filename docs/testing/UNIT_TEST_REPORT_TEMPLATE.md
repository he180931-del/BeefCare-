# Mẫu Report 5.1 – Unit Test

Người giữ file: Tuấn. Mỗi chủ feature tự điền phần của mình; Tuấn kiểm tra đủ cột, liên kết và số liệu.

## Quy ước

- **Mã case** lấy từ mục 9 của spec (`TC-xx-nn`). Case mới chưa có trong spec: đánh tiếp số cuối của feature và bổ sung vào spec trong cùng PR.
- **UC / Quy tắc**: mã UC và mã quy tắc trong spec (`R-xx-nn`) hoặc GBR/BR-D của SRS.
- **Tầng**: U = unit thuần, C = component (React), S = service backend với H2.
- **Kết quả**: `Đạt` · `Lỗi` · `Chưa chạy` · `Bỏ qua (lý do)`. Case mới viết giữ `Chưa chạy` cho tới khi có log.
- **Môi trường**: hệ điều hành, Node/Java, chế độ dữ liệu (API giả, H2…).
- Mỗi lần chạy lại sau khi sửa lỗi: thêm dòng mới, không ghi đè dòng cũ.

## Bảng kết quả

| Mã case | Feature | UC | Quy tắc | Tầng | Điều kiện / Input | Kết quả mong đợi | Kết quả thực tế | Kết quả | Commit | Môi trường | Người chạy | Ngày | Test / log | Mã lỗi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-08-01 | FE-08 | UC-FE08-01 | R-08-01 | U | (ví dụ) Cân 0 kg | Báo lỗi MSG-COM-10 | | Chưa chạy | | | | | | |

## Thống kê theo feature

| Feature | Tổng case | Đạt | Lỗi | Chưa chạy | Bỏ qua | Commit lượt cuối |
|---|---|---|---|---|---|---|
| FE-01 | | | | | | |
| … | | | | | | |
| FE-23 | | | | | | |
| **Tổng** | | | | | | |
