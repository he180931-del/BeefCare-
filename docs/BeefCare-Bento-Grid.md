# Quy tắc thiết kế Bento Grid cho BeefCare

**Bản đề xuất v1.0 · Dùng chung cho Figma và React**

Bento Grid phân cấp nội dung bằng kích thước, vị trí và màu của từng khối. Mỗi màn hình bắt đầu bằng hai câu hỏi: người dùng cần biết điều gì trước, và họ cần làm gì tiếp theo?

## 1. Chọn bố cục theo tác vụ

| Loại màn hình | Bố cục mặc định | Khối ưu tiên |
|---|---|---|
| Landing page | Hero → cụm tính năng Bento → quy trình → bảng giá → FAQ | Một ảnh màn hình sản phẩm đủ lớn để hiểu nội dung. Gộp các thẻ tính năng trùng ý. |
| Dashboard / báo cáo | Tiêu đề và bộ lọc → chỉ số → nội dung chính → chi tiết | Việc cần xử lý, biểu đồ trả lời câu hỏi chính hoặc chỉ số quan trọng nhất. |
| Hồ sơ cá thể | Định danh và trạng thái → tab → khối nghiệp vụ → lịch sử | Trạng thái hiện tại hoặc việc tiếp theo. Giữ lịch sử theo bảng hoặc timeline. |
| Danh sách / tồn kho | Tiêu đề và hành động → bộ lọc → bảng. Thêm KPI khi hỗ trợ quyết định. | Bảng dữ liệu. Đặt liên kết xử lý gần hàng có vấn đề. |
| Phiếu nhập / xuất | Form chính 8 cột, tóm tắt và kiểm tra 4 cột trên desktop | Trường đang nhập, lỗi theo trường và một nút xác nhận rõ. |
| Danh mục / tham số | Danh sách + vùng biên tập, hoặc form chia nhóm theo nghiệp vụ | Mục đang sửa, thay đổi sẽ áp dụng và nơi lưu. |
| Đăng nhập / xác nhận ngắn | Form một cột, có thể kèm nhận diện thương hiệu trên desktop | Nút chính và hướng dẫn khôi phục khi lỗi. |

## 2. Lưới và khoảng cách

Các kích thước dưới đây là **giá trị đề xuất** để chuẩn hóa màn mới. Đo lưới theo chiều rộng vùng nội dung sau sidebar.

| Vùng nội dung | Lưới | Khoảng cách giữa khối | Lề nội dung |
|---|---:|---:|---:|
| Từ 1.024 px | 12 cột | 24 px | 32 px |
| 640–1.023 px | 8 cột | 16 px | 24 px |
| Dưới 640 px | 4 cột | 12–16 px | 16 px |

- Desktop ưu tiên các tổ hợp vừa lưới như **8+4**, **7+5**, **6+6** hoặc **6+3+3**. Căn thẳng cạnh giữa các hàng liên quan.
- Thang khoảng cách dùng chung: **4, 8, 12, 16, 24, 32, 48, 64 px**. Padding card mặc định **24 px desktop**, **16 px mobile**. Bo góc card **16 px**, nút và ô nhập **8 px**.
- Căn theo nội dung. Cho khối tăng chiều cao khi chữ xuống dòng, có lỗi hoặc dữ liệu dài. Các card cùng hàng có thể cao bằng nhau nếu việc đó hỗ trợ so sánh.
- Mobile xếp theo thứ tự đọc: **trạng thái quan trọng → hành động chính → thông tin hỗ trợ → lịch sử**. Chỉ dùng hai ô cùng hàng cho chỉ số ngắn. Bảng dài có thể cuộn ngang trong vùng bảng hoặc chuyển thành danh sách, tùy tác vụ.
- Bảng, biểu đồ dài và cảnh báo bao trùm có thể chiếm toàn chiều rộng. Trên landing, xen kẽ cụm thẻ với ảnh sản phẩm, quy trình và bảng giá để tạo nhịp cuộn.

## 3. Phân cấp, màu và chữ

- Mỗi màn có **một khối nổi bật nhất** và một hành động chính trong mỗi ngữ cảnh. Khối lớn trả lời câu hỏi chính. Kích thước card phụ theo lượng nội dung và mức ưu tiên.
- Dùng xanh đậm cho nhận diện và điểm nhấn. Card thường dùng nền trắng, viền nhẹ. Dùng vàng cho việc sắp đến hạn hoặc cần chú ý, đỏ cho lỗi hoặc quá hạn, xanh nhạt cho trạng thái tích cực. Luôn có nhãn chữ đi cùng màu.
- Giữ **Be Vietnam Pro**. Mốc khởi điểm: tiêu đề trang 24–32 px, tiêu đề card 16–18 px, nội dung 14–16 px, chú thích 12–13 px. Kiểm tra tiếng Việt có dấu và nhãn dài ở kích thước thật.
- Card bấm được cần có nhãn hành động hoặc dấu hiệu tương tác rõ, kèm trạng thái hover và focus. Trên mobile, đặt vùng chạm mục tiêu khoảng 44 × 44 px.
- Ảnh sản phẩm dùng màn hình thật với dữ liệu mẫu. Cắt quanh phần giải thích được tính năng, giữ chữ và biểu đồ đủ rõ ở kích thước hiển thị.

## 4. Dữ liệu, trạng thái và thao tác

- KPI có **tên, giá trị, đơn vị và kỳ tính** khi liên quan. Đặt nhãn “Ước tính” sát giá trị dự báo. Giải thích ADG/BCS hoặc cung cấp chú thích ngay nơi dùng.
- Biểu đồ cho thấy mốc thời gian, giá trị và sự khác biệt giữa số đo thực tế và ước tính. Bản mobile cần đủ mốc để hiểu xu hướng hoặc có tương tác xem điểm.
- Phân biệt **0**, **chưa có dữ liệu**, **đang tải**, **lỗi** và **không áp dụng**. Lỗi tải bảng có thể hiện trong vùng bảng kèm “Thử lại”. Cảnh báo nghiệp vụ phải khớp với dữ liệu hiện tại.
- Form đặt lỗi sát trường. Làm rõ hành động **lưu nháp**, **lưu chính thức** và **hủy**. Khi hủy hoặc loại trừ bản ghi, giải thích ảnh hưởng tại bước xác nhận.
- Với hồ sơ bò, đặt trạng thái có thể ảnh hưởng đến quyết định bên cạnh thao tác liên quan. Ví dụ, hiển thị thời hạn ngưng sử dụng thịt nơi người dùng xem thông tin xuất bán.

## 5. Áp dụng trong Figma và React

- **Figma:** Tạo biến cho khoảng cách, bo góc và màu theo mục đích. Dùng Auto Layout cho nội dung card, tiêu đề và form. Tạo component dùng chung cho thẻ KPI, badge, nút, bộ lọc và trạng thái trống/lỗi. Cho vùng chữ tự tăng chiều cao.
- **React:** Dùng cùng vai trò và giá trị token với Figma. Dùng CSS Grid cho bố cục trang và Flexbox cho nội dung trong card. Giữ thứ tự DOM theo thứ tự đọc để dùng bàn phím và trình đọc màn hình. Kiểm tra trong vùng nội dung thực tế có sidebar.
- **Bàn giao:** Ghi rõ card nào đổi số cột, thứ tự khi xếp lại, trạng thái tương tác và dữ liệu mẫu. Đánh dấu màn nào là mẫu chuẩn và màn nào đang thử nghiệm.

## Checklist trước khi chốt màn

- [ ] Xác định được khối chính và hành động tiếp theo ngay khi mở màn.
- [ ] Cạnh khối, khoảng cách và kiểu chữ nhất quán với màn cùng loại.
- [ ] Tiêu đề dài, dữ liệu lớn và lỗi form không đè lên nội dung.
- [ ] Bảng và biểu đồ vẫn đọc được ở kích thước sử dụng thực tế.
- [ ] Chữ và trạng thái quan trọng có đủ tương phản. Điều khiển có focus nhìn thấy được.
- [ ] Có thiết kế cho tải, trống, lỗi và quyền chỉ xem khi phù hợp.
- [ ] Cảnh báo, dự báo và nút thao tác phản ánh đúng dữ liệu và trạng thái.

## Mẫu đối chiếu trong BeefCare

Checklist tiến độ áp dụng từng khung Bento trên React (155 khung, cập nhật 23/11/2026) đã gỡ khỏi repo; xem bằng `git show cc64a5ba:docs/BeefCare-Bento-Grid-checklist.md`.

- [Tab 12 · Landing Version C](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2873-129)
- [Tab 15 · Tổng quan trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-12315)
- [Tab 16 · Phiếu nhập mua ngoài](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-20685)
- [Tab 17 · Hồ sơ tăng trưởng và BCS](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2789-1980)
- Tab 18 · Sinh sản (Bento Grid)
  - [①b Danh sách theo dõi sinh sản](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-10409)
  - [②b Hồ sơ bò › Đang động dục / sẵn sàng phối](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-10668)
  - [③b Hồ sơ bò › Đã phối, chờ khám thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11607)
  - [④b Hồ sơ bò › Đang mang thai & sinh bê](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-12138)
  - [⑤b Kỹ thuật viên – chỉ xem](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13799)
- Tab 19 · Danh mục & Tham số (Bento Grid)
  - [①b Danh mục trại: Giống bò, Vắc-xin, Thuốc, Mục đích nuôi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29102)
  - [②b Tham số trạng thái & nhắc việc](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-30214)
- Tab 21 · Quản lý thức ăn (Bento Grid)
  - [①b Kho thức ăn – tồn kho, phiếu nhập, kiểm kê](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-32232)
  - [②b Khẩu phần – danh sách, sửa khẩu phần](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34242)
  - [③b Nhật ký cho ăn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34856)
  - [④b Danh mục thức ăn & báo cáo](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-35665)
  - [⑤b Kỹ thuật viên – khẩu phần hôm nay](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-36358)
