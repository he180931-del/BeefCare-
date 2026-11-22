# Checklist áp dụng Bento Grid trên React

Đối chiếu từng khung Bento trong Figma ([file thiết kế](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ)) với màn React, theo quy tắc trong [BeefCare-Bento-Grid.md](BeefCare-Bento-Grid.md). Cập nhật 23/11/2026.

**Cách đánh dấu**

- `[x]` Màn React đã sửa theo Bento và đã so với khung Figma.
- `[ ]` *(đã đổi một phần)*: code đã đổi theo khung chung của màn, chưa so riêng khung này.
- `[ ]` Chưa làm.

**Đợt sửa**

| Đợt | Commit / nhánh | Trạng thái |
|---|---|---|
| 1 | `d0549154` | Đã lên `dev` |
| 2 | `efc82f9c`, `96ef8455` | Đã lên `dev` |
| 3 | nhánh `feature/bento-grid-18-19-21` (tab 18, 19, 21) | Chưa commit |
| 4 | cùng nhánh: hộp thoại chung, hồ sơ bò, nhập/xuất đàn, chuồng trại (tab 16); tăng trưởng, tiêm phòng, sức khỏe (tab 17); nhắc việc, thông báo trại, kỹ thuật viên (tab 15) | Chưa commit |

## Tổng hợp

| Tab Figma | Số khung | Đã xong | Đổi một phần | Chưa làm |
|---|---:|---:|---:|---:|
| 12 · Guest – Công khai & Đăng nhập | 11 | 5 | 6 | 0 |
| 13 · Chủ trại – Trại & Thành viên | 38 | 0 | 0 | 38 |
| 15 · Tổng quan & Nhắc việc | 12 | 10 | 2 | 0 |
| 16 · Đàn bò, Nhập/Xuất & Chuồng | 33 | 24 | 9 | 0 |
| 17 · Tăng trưởng, Tiêm phòng & Sức khỏe | 24 | 16 | 8 | 0 |
| 18 · Sinh sản | 17 | 17 | 0 | 0 |
| 19 · Danh mục & Tham số | 6 | 6 | 0 | 0 |
| 21 · Quản lý thức ăn | 14 | 14 | 0 | 0 |
| **Tổng** | **155** | **92** | **25** | **38** |

Trang 22 · Nền tảng (CS, PM, SA) chưa có khung Bento. Tab 13 làm ở nhánh riêng.

## Tab 12 · Guest – Công khai & Đăng nhập

**①c Trang công khai (FE-22) · Version C** — bản được chọn; thay cho ①b Trang công khai · Bento.

- [x] [Trang công khai · Desktop](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2873-130) — `/` · đợt 1
- [x] [Trang công khai · Mobile](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2873-268) — `/` · đợt 1

**②b Đăng nhập, đăng ký & khôi phục mật khẩu (FE-01)**

- [x] [Đăng nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-383) — đã đúng Bento từ trước (khung AuthShell), đối chiếu 23/11. Giữ ô Ghi nhớ đăng nhập và tài khoản mock đang có trong code.
- [x] [Tạo tài khoản chủ trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-414) — đã đúng Bento từ trước (khung AuthShell), đối chiếu 23/11.
- [ ] [Xác minh email](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-450) *(đã đổi một phần: dùng chung khung AuthShell đã đúng Bento, chưa so riêng)*
- [x] [Quên mật khẩu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-473) — đã đúng Bento từ trước (khung AuthShell), đối chiếu 23/11.
- [ ] [Kiểm tra email](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-496) *(đã đổi một phần: dùng chung khung AuthShell đã đúng Bento, chưa so riêng)*
- [ ] [Đặt mật khẩu mới](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-519) *(đã đổi một phần: dùng chung khung AuthShell đã đúng Bento, chưa so riêng)*
- [ ] [Liên kết không còn hiệu lực](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-543) *(đã đổi một phần: dùng chung khung AuthShell đã đúng Bento, chưa so riêng)*
- [ ] [Đăng nhập chưa thành công](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-564) *(đã đổi một phần: dùng chung khung AuthShell đã đúng Bento, chưa so riêng)*
- [ ] [Tài khoản đang tạm ngưng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-594) *(đã đổi một phần: dùng chung khung AuthShell đã đúng Bento, chưa so riêng)*

## Tab 13 · Chủ trại – Trại & Thành viên

**①b Hoàn tất hồ sơ, đăng ký trại, chọn trại & thông tin trại (FE-01, FE-02, FE-19)**

- [ ] [Chọn trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3424) — `/chon-trai`
- [ ] [Hoàn tất hồ sơ chủ trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3539) — `/owner-registration`
- [ ] [Đăng ký trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3600) — `/dang-ky-trai`
- [ ] [Đăng ký gói dịch vụ lần đầu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3692) — `/dang-ky-goi`
- [ ] [Thông tin trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3784) — `/thong-tin-trai`

**②b Thành viên & lời mời, hồ sơ cá nhân (FE-03, FE-01)**

- [ ] [Thành viên & vai trò](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-3989) — `/thanh-vien`
- [ ] [Mời thành viên](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4230)
- [ ] [Lời mời thành viên](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4380) — `/loi-moi`
- [ ] [Đổi vai trò / ngừng hoạt động thành viên](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4526)
- [ ] [Chấp nhận lời mời (người được mời)](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4674) — `/invitation/accept`
- [ ] [Lời mời không còn hiệu lực](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4741)
- [ ] [Hồ sơ & quyền của tôi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4787) — `/ho-so`
- [ ] [Đổi mật khẩu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-4978)

**③b Gói dịch vụ & thanh toán (FE-19)**

- [ ] [Gói dịch vụ của trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5115) — `/goi-dich-vu`
- [ ] [Gia hạn gói – chọn thời hạn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5307)
- [ ] [Hướng dẫn chuyển khoản](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5489)
- [ ] [Lịch sử thanh toán](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5682)
- [ ] [Chi tiết thanh toán đã xác nhận](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-5858)

**③bb Trạng thái thanh toán (FE-19)**

- [ ] [Yêu cầu đã hết hạn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6016)
- [ ] [Đã có yêu cầu còn hiệu lực](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6154)
- [ ] [Chưa đến thời gian gia hạn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6288)
- [ ] [Trại đang tạm ngưng dịch vụ](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6415)
- [ ] [Bảng giá đã thay đổi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6546)
- [ ] [Giá gói chưa khả dụng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6675)
- [ ] [Không lấy được kết quả thanh toán](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6798)
- [ ] [Lịch sử thanh toán – chưa có dữ liệu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-6929)

**⑥b Ticket & thông báo (FE-20)**

- [ ] [Ticket hỗ trợ của tôi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7054) — `/ho-tro`
- [ ] [Gửi yêu cầu hỗ trợ](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7238)
- [ ] [Chi tiết ticket](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7408)
- [ ] [Mở lại ticket](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7602)
- [ ] [Thông báo của tôi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7727) — `/thong-bao-cua-toi`

**④bb Trạng thái Ticket (FE-20)**

- [ ] [Đã gửi yêu cầu hỗ trợ](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-7889)
- [ ] [Gửi yêu cầu hỗ trợ – thiếu thông tin](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8024)
- [ ] [Đã xác nhận kết quả](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8197)
- [ ] [Ticket đã đóng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8335)
- [ ] [Kết quả đã thay đổi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8471)
- [ ] [Không có ticket phù hợp](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8592)
- [ ] [Lỗi tải dữ liệu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-8740)

## Tab 15 · Tổng quan & Nhắc việc

**①b Tổng quan & Nhắc việc (FE-15, FE-14)**

- [x] [Tổng quan trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-12315) — `/tong-quan` · đợt 1
- [x] [Nhắc việc trang trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-12619) — `/nhac-viec` · đợt 4
- [x] [Tổng quan trang trại · Trại mới](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-12814) — `/tong-quan` · đợt 4. Khung Bắt đầu sử dụng ở cột 8 cạnh Cơ cấu đàn; vẫn giữ Ghi chép nhanh và Cần chú ý hôm nay đang có trong code.

**②b Thông báo trại (FE-07)**

- [x] [Thông báo trại – danh sách & chi tiết](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13109) — `/thong-bao` · đợt 4
- [x] [Soạn thông báo](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13316) — đợt 4
- [ ] [Xem lại trước khi đăng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13502) *(đã đổi một phần: card bo 16 px, lưới 8+4)*
- [ ] [Đính chính thông báo](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13647) *(đã đổi một phần: card bo 16 px, lưới 8+4)*

**③b Báo cáo quản lý (FE-15)**

- [x] [Báo cáo quản lý](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-13815) — `/bao-cao` · đợt 2

**④b Kỹ thuật viên – Trang chủ, thông báo & nhắc việc (chỉ xem)**

- [x] [Kỹ thuật viên · Trang chủ](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-14092) — `/kt` · đợt 4. Giữ khối Chuồng trại / Danh mục trại đang có trong code.
- [x] [Kỹ thuật viên · Thông báo trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-14181) — `/kt/thong-bao` · đợt 4
- [x] [Kỹ thuật viên · Chi tiết thông báo](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-14233) — đợt 4
- [x] [Kỹ thuật viên · Nhắc việc](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-14269) — `/kt/nhac-viec` · đợt 4

## Tab 16 · Đàn bò, Nhập/Xuất & Chuồng

**①b Đàn bò & hồ sơ cá thể (FE-05, FE-16, FE-04)**

- [x] [Đàn bò – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-17961) — `/cattle` · đợt 2
- [x] [Hồ sơ bò › Tổng quan](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-18311) — `/cattle/:code` · đợt 4
- [x] [Cập nhật hồ sơ bò](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-18614) — đợt 4
- [x] [Cấp lại thẻ QR](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-18779) — đợt 4
- [x] [Hồ sơ bò › Dòng thời gian](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-18938) — đợt 4
- [x] [Hồ sơ bò › Lịch sử chuồng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-19173) — đợt 4
- [x] [Chuyển chuồng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-19426) — đợt 4
- [x] [Hồ sơ bò › Thẻ QR](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-19623) — đợt 4
- [x] [Cập nhật hồ sơ bò – Định danh & mô tả](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-19863) — đợt 4
- [x] [Hồ sơ bò › Tổng quan – bò mua ngoài](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-20030) — đợt 4 (cùng tab Tổng quan, dữ liệu bò mua ngoài)

**②b Nhập đàn theo phiếu nhập (FE-06)**

- [x] [Phiếu nhập – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-20334) — `/herd-entry` · đợt 4
- [x] [Phiếu nhập mới – Mua ngoài](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-20685) — `/herd-entry/new` · đợt 1
- [x] [Thêm / sửa con trong phiếu nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-21059) — đợt 4
- [ ] [Nhập danh sách bò từ Excel](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-21349) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [x] [Phiếu nhập mới – Bê sinh tại trại](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-21575) — `/herd-entry/new` · đợt 4 (sửa thêm nút "Đánh dấu chết" bị bẻ chữ)
- [x] [Chi tiết phiếu nhập – Đã nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-21861) — `/herd-entry/:id` · đợt 4
- [ ] [Ghi nhận thanh toán phiếu nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-22176) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [ ] [Hủy phiếu nhập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-22350) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [ ] [Sửa / hủy bản ghi nhập đàn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-22505) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*

**③b Chuồng trại (FE-04)**

- [x] [Chuồng trại – danh sách & chi tiết](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-22736) — `/pens` · đợt 4
- [ ] [Tạo / sửa chuồng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-23078) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [ ] [Ngừng / mở lại sử dụng chuồng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-23263) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*

**④b Xuất đàn theo phiếu xuất (FE-13)**

- [x] [Phiếu xuất – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-23423) — `/herd-exit` · đợt 4
- [x] [Phiếu xuất mới – Bán](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-23741) — `/herd-exit/new` · đợt 4
- [x] [Chọn bò vào phiếu xuất](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-24141) — đợt 4
- [ ] [Phiếu xuất – Chết / mất (chờ xác nhận)](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-24394) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [x] [Chi tiết phiếu xuất – Đã xuất](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-24680) — `/herd-exit/:id` · đợt 4
- [ ] [Hủy phiếu xuất](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25005) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [ ] [Ghi nhận thu tiền phiếu xuất](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25145) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*

**⑤b Kỹ thuật viên – Đàn bò & hồ sơ bò (chỉ xem)**

- [x] [Kỹ thuật viên · Đàn bò](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25332) — `/kt/dan-bo` · đợt 4
- [x] [Kỹ thuật viên · Quét QR](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25426) — `/kt/quet-qr` · đợt 4
- [x] [Kỹ thuật viên · Hồ sơ bò › Tổng quan](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25477) — đợt 4
- [x] [Kỹ thuật viên · Hồ sơ bò › Dòng thời gian](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-25591) — đợt 4

## Tab 17 · Tăng trưởng, Tiêm phòng & Sức khỏe

**①b Tăng trưởng & BCS – Quản lý (FE-08)**

- [x] [Tăng trưởng & BCS – danh sách đàn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-2192) — `/can-nang` · đợt 4
- [x] [Ghi nhận cân & BCS](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-2881) — đợt 4
- [ ] [Sửa / loại trừ bản ghi cân](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-3097) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [x] [Hồ sơ bò › Tăng trưởng & BCS](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2789-1980) — `/cattle/:code?tab=growth` · đợt 1
- [x] [Dự kiến xuất bán · Không áp dụng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2798-2269) — đợt 4
- [x] [Dự kiến xuất bán · Chưa đủ dữ liệu](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2798-2286) — đợt 4

**②b Tiêm phòng – Quản lý (FE-09)**

- [x] [Lịch tiêm phòng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-3306) — `/tiem-phong` · đợt 4
- [x] [Quản lý lịch tiêm](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-3616) — đợt 4
- [x] [Ghi nhận tiêm](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-3890) — đợt 4. Không thêm ô "Số lô" trong Figma: đã bỏ theo D44.
- [x] [Hồ sơ bò › Tiêm phòng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-4155) — đợt 4
- [ ] [Hoãn mũi tiêm](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-4456) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [ ] [Sửa / hủy bản ghi tiêm](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-4614) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [x] [Lịch sử tiêm phòng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-4850) — đợt 4
- [ ] [Sửa / hủy bản ghi điều trị](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-5098) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*

**③b Sức khỏe & Điều trị – Quản lý (FE-10)**

- [x] [Ca sức khỏe – danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-5335) — `/suc-khoe` · đợt 4
- [x] [Hồ sơ bò › Sức khỏe](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-5644) — đợt 4
- [ ] [Mở ca sức khỏe / ghi bất thường](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-5934) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [ ] [Ghi theo dõi ca sức khỏe](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6139) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [x] [Ghi điều trị](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6309) — đợt 4
- [ ] [Cập nhật trạng thái / đóng ca](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6504) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*
- [ ] [Cập nhật trạng thái / đóng ca – Chết](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6685) *(đã đổi một phần: hộp thoại chung bo 16 px, chưa so riêng)*

**④b Kỹ thuật viên – Tăng trưởng, tiêm phòng, sức khỏe trong hồ sơ bò (chỉ xem)**

- [x] [Kỹ thuật viên · Hồ sơ bò › Tăng trưởng & BCS](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6877) — đợt 4
- [x] [Kỹ thuật viên · Hồ sơ bò › Tiêm phòng](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-6971) — đợt 4
- [x] [Kỹ thuật viên · Hồ sơ bò › Sức khỏe](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-7064) — đợt 4

## Tab 18 · Sinh sản

**①b Danh sách theo dõi sinh sản (FE-11, FE-12)**

- [x] [Sinh sản – Danh sách theo dõi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-10410) — `/sinh-san` · đợt 3

**②b Hồ sơ bò › Sinh sản – Đang động dục (FE-11)**

- [x] [Hồ sơ bò › Sinh sản – Đang động dục](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-10669) — `/cattle/:code?tab=repro` · đợt 3
- [x] [Ghi động dục](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11011) — đợt 3
- [x] [Ghi phối giống](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11178) — đợt 3
- [x] [Sửa / hủy bản ghi động dục, phối giống](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11404) — đợt 3

**③b Hồ sơ bò › Sinh sản – Đã phối, chờ khám thai (FE-12)**

- [x] [Hồ sơ bò › Sinh sản – Đã phối, chờ khám thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11608) — `/cattle/:code?tab=repro` · đợt 3
- [x] [Ghi khám thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-11931) — đợt 3

**④b Hồ sơ bò › Sinh sản – Đang mang thai & sinh bê (FE-12)**

- [x] [Hồ sơ bò › Sinh sản – Đang mang thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-12139) — `/cattle/:code?tab=repro` · đợt 3
- [x] [Ghi diễn biến thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-12503) — đợt 3
- [x] [Ghi sự kiện đẻ & kết quả bê](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-12686) — `/cattle/:code/sinh-san/de` · đợt 3
- [x] [Ghi sự kiện đẻ – lỗi trùng mã thẻ tai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13014) — đợt 3
- [x] [Sửa / hủy kết quả khám thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13348) — đợt 3
- [x] [Sửa / hủy diễn biến thai, sự kiện đẻ, kết quả bê](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13575) — đợt 3

**⑤b Kỹ thuật viên – chỉ xem**

- [x] [Kỹ thuật viên · Sinh sản – Danh sách theo dõi](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13800) — `/kt/sinh-san` · đợt 3
- [x] [Kỹ thuật viên · Quét QR → nhận diện bò](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13870) — `/kt/quet-qr` · đợt 3. Thẻ kết quả theo Figma; trước khi quét vẫn giữ nút Bật camera / Quét từ ảnh / nhập mã hiện có.
- [x] [Kỹ thuật viên · Hồ sơ bò › Sinh sản – Đang động dục](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-13918) — `/kt/dan-bo/:code?tab=repro` · đợt 3
- [x] [Kỹ thuật viên · Hồ sơ bò › Sinh sản – Đang mang thai](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2827-14024) — `/kt/dan-bo/:code?tab=repro` · đợt 3

## Tab 19 · Danh mục & Tham số

**①b Danh mục trại (FE-18)**

- [x] [Giống bò – danh sách & biên tập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29103) — `/danh-muc/giong` · đợt 3
- [x] [Vắc-xin – danh sách & biên tập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29381) — `/danh-muc/vac-xin` · đợt 3
- [x] [Thuốc tham chiếu – danh sách & biên tập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29680) — `/danh-muc/thuoc` · đợt 3
- [x] [Mục đích nuôi – danh sách & biên tập](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-29950) — `/danh-muc/muc-dich` · đợt 3

**②b Tham số trạng thái & nhắc việc (FE-18)**

- [x] [Tham số trạng thái & nhắc việc](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-30215) — `/danh-muc/tham-so` · đợt 3
- [x] [Lịch sử phiên bản tham số](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-30515) — `/danh-muc/tham-so/lich-su` · đợt 3

## Tab 21 · Quản lý thức ăn

**①b Kho thức ăn – Tồn kho, phiếu nhập kho, kiểm kê (FE-23)**

- [x] [Thức ăn – Tồn kho](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-32233) — `/thuc-an` · đợt 2. Khác Figma có chủ đích: khối nổi bật là "Sắp hết / hết" (việc cần xử lý, §1), Figma để "Thức ăn đang dùng".
- [x] [Phiếu nhập kho – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-32630) — `/thuc-an/phieu-nhap` · đợt 3
- [x] [Phiếu nhập kho – Tạo mới](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-32954) — `/thuc-an/phieu-nhap/moi` · đợt 3
- [x] [Kiểm kê / điều chỉnh tồn kho](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-33345) — `/thuc-an/kiem-ke/moi` · đợt 3
- [x] [Phiếu nhập kho – Chi tiết (đã ghi)](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-33696) — `/thuc-an/phieu-nhap/:id` · đợt 3
- [x] [Hủy phiếu nhập kho](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34087) — đợt 3

**②b Khẩu phần (FE-23)**

- [x] [Khẩu phần – Danh sách](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34243) — `/thuc-an/khau-phan` · đợt 3
- [x] [Sửa khẩu phần – tạo phiên bản mới](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34545) — `/thuc-an/khau-phan/:id` · đợt 3

**③b Nhật ký cho ăn (FE-23)**

- [x] [Nhật ký cho ăn – theo ngày](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-34857) — `/thuc-an/nhat-ky` · đợt 3
- [x] [Ghi cữ cho ăn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-35261) — đợt 3
- [x] [Sửa / hủy bản ghi cho ăn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-35488) — đợt 3

**④b Danh mục thức ăn & báo cáo (FE-23)**

- [x] [Danh mục thức ăn & nhà cung cấp](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-35666) — `/thuc-an/danh-muc` · đợt 3
- [x] [Báo cáo tiêu thụ & chi phí thức ăn](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-36049) — `/thuc-an/bao-cao` · đợt 3

**⑤b Kỹ thuật viên – khẩu phần hôm nay (điện thoại)**

- [x] [Kỹ thuật viên · Khẩu phần hôm nay](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ?node-id=2848-36359) — `/kt/thuc-an` · đợt 3
