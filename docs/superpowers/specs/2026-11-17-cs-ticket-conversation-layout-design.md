# CS Ticket Conversation Layout Design

## Mục tiêu

Ưu tiên vùng trao đổi trên trang chi tiết ticket của CS: bỏ card “Yêu cầu nội bộ” ở cuối cột trái, cho card “Trao đổi” lấp phần chiều cao còn lại để cân với cột xử lý bên phải, và giữ tin mới nhất ở đáy như ứng dụng nhắn tin.

## Thiết kế

- Chỉ thay đổi `TicketPage`; không đổi API, dữ liệu, quyền hay các hộp thoại xử lý yêu cầu nội bộ.
- Cột trái là flex column. Card trao đổi chiếm phần chiều cao còn lại; card kết quả (nếu có) vẫn nằm dưới nó.
- Trên desktop, vùng danh sách tin nhắn co giãn trong card và tự cuộn; trên màn hình nhỏ vẫn giới hạn 480px để tránh đẩy trang quá dài.
- Tin nhắn giữ thứ tự thời gian hiện có (cũ ở trên, mới ở dưới). Khi ticket được nạp lại hoặc người dùng đổi tab công khai/nội bộ, vùng chat cuộn xuống tin mới nhất. Khi tải tin cũ, vị trí đọc hiện tại vẫn được bảo toàn.
- Các thao tác yêu cầu nội bộ ở cột phải và các dialog hiện có không thay đổi.

## Kiểm chứng

- Unit test xác nhận card “Yêu cầu nội bộ” không còn xuất hiện và đổi tab hội thoại neo xuống đáy.
- Typecheck/build xác nhận không còn import hoặc component chết.
- Kiểm tra runtime desktop xác nhận card trao đổi và cột phải có cùng chiều cao, chỉ danh sách tin nhắn cuộn.
