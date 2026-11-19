# SPEC FE-22 – Trang giới thiệu công khai

| | |
|---|---|
| Feature | FE-22 Public Landing Page |
| Use case | UC-FE22-01 |
| Người phụ trách | LamKD (BE + FE + test) · Review BE: DucNV · Review FE: AnNT |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 J (Public Landing Content), Part III §22 (SCR-01), MSG-FE22-01, GBR-69, GBR-75, GBR-87, OR-14 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.
> FE-22 **không có đặc tả Part II** (Q1).

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE22-01 | Xem trang giới thiệu (giới thiệu, tính năng, cách hoạt động, giá 1 / 2 / 3 năm, FAQ, liên hệ), bắt đầu đăng ký / đăng nhập | Guest (khách chưa đăng nhập) | SCR-01 |

**Không thuộc FE-22:** đăng nhập / đăng ký (FE-01, SCR-02, SCR-03); công bố bảng giá (FE-19 SCR-63); quản trị nội dung (không có – nội dung đổi qua triển khai).

---

## 2. Vai trò và quyền

Công khai, không cần đăng nhập. Người đã đăng nhập vẫn mở được (Q2).

---

## 3. Dữ liệu

### 3.1 Nội dung trang (Public Landing Content)

| Thuộc tính | Ràng buộc |
|---|---|
| Mã bản phát hành | 1 bản phát hành tại một thời điểm |
| Các mục | Header, Hero, Dải số liệu, Tính năng, Cách hoạt động, Bảng giá, FAQ, Liên hệ, Footer |
| Câu hỏi FAQ | Danh sách câu hỏi – trả lời |
| Liên hệ | Email `tuanpqhe181869@fpt.edu.vn`, điện thoại `0386 671 863`; **không có địa chỉ** |
| Vòng đời | Đổi bằng triển khai; không có quản lý nội dung cho người dùng |

### 3.2 Giá
Đọc từ **phiên bản giá đang hiệu lực** (FE-19): giá 1 / 2 / 3 năm, mỗi trại. Giá ban đầu 1.200.000 / 2.160.000 / 3.060.000 VND (GBR-69).

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-22-01 | Chỉ hiện nội dung tĩnh đã phát hành, giá của phiên bản đang hiệu lực, và liên hệ chính thức (email, điện thoại, không địa chỉ). | GBR-87, OR-14 |
| R-22-02 | Giá luôn lấy theo phiên bản hiệu lực **tại thời điểm xem**; phiên bản lên lịch chỉ hiện sau khi có hiệu lực. | GBR-75 |
| R-22-03 | Không tải được giá → mục giá hiện "Tạm thời chưa có" + Thử lại (MSG-FE22-01); **không bao giờ** hiện giá cũ (cache) hay giá tự đặt. | GBR-87 |
| R-22-04 | Giá là tổng cho 1 trại theo kỳ hạn; không có giá theo tháng / theo con. | GBR-69 |
| R-22-05 | API công khai không lộ dữ liệu nội bộ (người công bố, phiên bản lên lịch). | GBR-87 |

---

## 5. Luồng xử lý

### UC-FE22-01 Xem trang giới thiệu
1. Khách mở trang gốc.
2. Hệ thống trả nội dung tĩnh; tải giá hiệu lực (hiện placeholder khi đang tải).
3. Khách cuộn hoặc chọn anchor (Tính năng, Cách hoạt động, Bảng giá, FAQ, Liên hệ).
4. Khách chọn **Đăng nhập** → SCR-02, **Đăng ký làm Chủ trại** / **Tiếp tục với Google** → SCR-03 / luồng Google (FE-01), **Xem bảng giá** → cuộn đến Bảng giá.

E1 không tải được giá → MSG-FE22-01 + Thử lại; phần còn lại vẫn hiển thị.

---

## 6. Màn hình và trường

### SCR-01 Trang giới thiệu

| # | Mục | Thành phần | Nội dung / Hành vi |
|---|---|---|---|
| 1 | Header | Logo; anchor Tính năng, Cách hoạt động, Bảng giá, FAQ, Liên hệ; "Đăng nhập" (SCR-02); "Đăng ký làm Chủ trại" (SCR-03) | Anchor cuộn mượt; header dính trên cùng (Q3) |
| 2 | Hero | Đối tượng (trại bò thịt 150–300 con), tiêu đề, mô tả ngắn, "Tiếp tục với Google", "Xem bảng giá", 3 ý chính (không cần cài ứng dụng, dữ liệu riêng từng trại, giao diện tiếng Việt), hình minh họa | "Tiếp tục với Google" → luồng Google FE-01 |
| 3 | Key figures band / Dải số liệu | 1 hồ sơ mỗi con · 8 nhóm sự kiện chăm sóc · 7 vai trò · Kỳ hạn 1–3 năm | Tĩnh |
| 4 | Features / Tính năng | 6 thẻ: Hồ sơ cá thể & thẻ QR; Tăng trưởng & BCS; Tiêm phòng & sức khỏe; Sinh sản & đẻ; Nhắc việc & thông báo trại; Nhiều trại độc lập | Tĩnh |
| 5 | How it works / Cách hoạt động | 4 bước: quét QR thẻ tai, mở đúng hồ sơ, ghi sự kiện thực tế, theo dõi và nhận nhắc việc | Tĩnh |
| 6 | Pricing / Bảng giá | 3 thẻ 1 / 2 / 3 năm, tổng giá mỗi trại từ phiên bản hiệu lực | Placeholder khi tải; lỗi → MSG-FE22-01 + Thử lại |
| 7 | FAQ | Accordion: quy mô trại, có cần cài app, khác nhau giữa các kỳ hạn, thanh toán và kích hoạt, tách dữ liệu giữa các trại | Mở / đóng từng câu |
| 8 | Contact / Liên hệ | Email tuanpqhe181869@fpt.edu.vn, điện thoại 0386 671 863 | `mailto:` / `tel:`; không có địa chỉ |
| 9 | Footer | Bản quyền BeefCare | — |

Responsive: điện thoại và máy tính (NFR – theo FE-01 shell).

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Nội dung trang | — | `LandingContent {release, hero{…}, figures[], features[6], steps[4], faq[{q, a}], contact{email, phone}}` | — | `GET /api/public/landing` |
| A2 | Giá hiệu lực | — | `PriceVersion {version, effectiveFrom, prices{1, 2, 3}}` (không có người công bố, không có phiên bản lên lịch) | 5xx → FE hiện MSG-FE22-01 | `GET /api/public/prices` |

Ghi chú: A1 có thể là nội dung tĩnh đóng gói trong FE (vì "đổi bằng triển khai"); A2 bắt buộc gọi BE, không cache phía FE quá thời gian phiên (R-22-03).

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE22-01 | Trong mục | Bảng giá tạm thời chưa hiển thị được. [Thử lại] |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-22-01 | Khách chưa đăng nhập | Mở trang | Đủ 9 mục; không cần token | E | §6 |
| TC-22-02 | Phiên bản hiệu lực v1 (1.200.000 / 2.160.000 / 3.060.000) | Xem Bảng giá | Đúng 3 giá | I, E | R-22-02 |
| TC-22-03 | PM công bố v2 hiệu lực ngay | Tải lại | Hiện giá v2 | I | R-22-02 |
| TC-22-04 | v3 lên lịch ngày mai | Xem | Vẫn giá v2; A2 không trả v3 | I, H | R-22-02, R-22-05 |
| TC-22-05 | A2 lỗi 500 | Xem | MSG-FE22-01 + Thử lại; không có số giá | E | R-22-03 |
| TC-22-06 | A2 lỗi rồi Thử lại thành công | Bấm Thử lại | Hiện giá | E | R-22-03 |
| TC-22-07 | — | Xem Liên hệ | Đúng email, điện thoại; không có địa chỉ | E | R-22-01 |
| TC-22-08 | — | Bấm "Đăng nhập" / "Đăng ký làm Chủ trại" | Mở SCR-02 / SCR-03 | E | §6 |
| TC-22-09 | — | Bấm anchor "Bảng giá" / "Xem bảng giá" | Cuộn đến mục Bảng giá | E | §6 |
| TC-22-10 | Màn hình 375 px | Mở | Không cuộn ngang; thẻ xếp dọc | E | §6 |
| TC-22-11 | — | Gọi A2 | Response không có trường nội bộ | H | R-22-05 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Không có đặc tả Part II | Theo Part III + GBR-87 |
| Q2 | Người đã đăng nhập mở trang gốc → ở lại hay chuyển vào app? | Ở lại; header đổi "Đăng nhập" thành "Vào ứng dụng" |
| Q3 | Header dính, SEO, ngôn ngữ thứ 2 | Header dính; chỉ tiếng Việt |
| Q4 | Nội dung lấy từ API hay đóng gói FE | Đóng gói FE (đổi bằng triển khai), giá gọi API |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho LamKD duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
