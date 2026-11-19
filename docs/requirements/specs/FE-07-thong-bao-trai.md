# SPEC FE-07 – Thông báo trại

| | |
|---|---|
| Feature | FE-07 Farm Announcements |
| Use case | UC-FE07-01 → UC-FE07-04 |
| Người phụ trách | TaiDX (BE + FE + test) · Review BE: DucNV · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Farm Announcement, Announcement Version, Announcement Delivery, Notification), §3.3 (BR-D21), Part II §7, Part III §7 (SCR-26 → SCR-28, popup Xem lại & đăng), MSG-FE07, GBR-60 → 62, 64; JOB-07 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN đối chiếu Figma tab 05.

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE07-01 | Soạn và lưu nháp thông báo | Owner, Manager | SCR-27 |
| UC-FE07-02 | Sửa nháp / đính chính thông báo đã đăng | Tác giả | SCR-27, SCR-28 |
| UC-FE07-03 | Đăng thông báo | Tác giả | Popup Xem lại & đăng |
| UC-FE07-04 | Xem thông báo và lịch sử | Owner, Manager, Technician | SCR-26 (Technician cũng thấy ở SCR-74) |

**Liên quan:** thông báo in-app (chuông) gửi qua JOB-07, quy tắc hộp thông báo ở FE-14.

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Soạn, lưu nháp, đăng | Có – gửi tới Manager và Technician | Có – chỉ gửi tới Technician | — |
| Sửa nháp, đính chính | Chỉ thông báo **của chính mình** | Chỉ của chính mình | — |
| Xem nháp | Chỉ tác giả thấy nháp của mình (Owner **không** thấy nháp của Manager) | | |
| Đọc thông báo nhận được | Có | Có | Có |
| Xem trạng thái gửi / đã đọc | Chỉ tác giả | | |

Nhân viên platform không bao giờ là người nhận (GBR-60). Cần trại ACTIVE và tác giả còn là thành viên ACTIVE.

---

## 3. Dữ liệu

### 3.1 Thông báo (Farm Announcement)

| Thuộc tính | Ràng buộc | Nguồn |
|---|---|---|
| Trại, membership tác giả, thời điểm tạo | — | §3.2 |
| Đối tượng dự kiến | Bộ chọn: "Tất cả Quản lý", "Tất cả Kỹ thuật viên", danh sách thành viên chọn tên | SCR-27 |
| Trạng thái | `DRAFT` → `PUBLISHED` (một lần) | §3.2 |
| Phiên bản hiện tại | Con trỏ tới phiên bản mới nhất | GBR-62 |
| Nội dung nháp | Tiêu đề ≤ 150, nội dung ≤ 5.000 (định dạng: đậm, nghiêng, danh sách gạch đầu dòng, danh sách số, link) | SCR-27 |

### 3.2 Phiên bản (Announcement Version) – bất biến

| Thuộc tính | Ràng buộc |
|---|---|
| Số phiên bản | Duy nhất trong thông báo; v1 khi đăng, v2… khi đính chính |
| Tiêu đề, nội dung | Không trống; như §3.1 |
| Lý do đính chính | Bắt buộc từ v2; ≤ 500 |
| Người đăng, thời điểm đăng | — |

### 3.3 Lượt gửi (Announcement Delivery)

| Thuộc tính | Ràng buộc |
|---|---|
| Phiên bản + membership người nhận | Duy nhất (BR-D21) |
| Thời điểm gửi, thời điểm đọc | `DELIVERED` → `READ`; mở chi tiết thì thành READ |

Danh sách người nhận **chốt tại lúc đăng** (snapshot). Người tham gia sau không nhận phiên bản cũ.

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-07-01 | Owner gửi tới Manager và Technician đang ACTIVE; Manager chỉ gửi tới Technician đang ACTIVE. Người nhận không hợp lệ cho vai trò tác giả → MSG-FE07-02. | GBR-60 |
| R-07-02 | Người nhận chọn theo vai trò hoặc theo tên; hệ thống loại trùng. Nhân viên platform không bao giờ là người nhận. | GBR-60 |
| R-07-03 | Nháp chỉ tác giả thấy và sửa; chỉ tác giả đính chính thông báo của mình; Owner không có quyền ghi đè. | GBR-61 |
| R-07-04 | Lưu nháp không gửi gì. | UC-02 POST-1 |
| R-07-05 | Đăng: xác định thành viên ACTIVE theo bộ chọn tại thời điểm đăng, loại người không hợp lệ và trùng; còn 0 người → MSG-FE07-05, nháp vẫn DRAFT. | UC-03 bước 3, E1 |
| R-07-06 | Đăng lưu **trong một transaction**: phiên bản 1, danh sách người nhận, một lượt gửi mỗi người, trạng thái PUBLISHED. Sau đó tạo thông báo in-app (JOB-07). Lỗi → không gửi gì. | GBR-62, UC-03 bước 4–5 |
| R-07-07 | Mỗi thông báo chỉ đăng một lần; đăng lại / đã thay đổi → MSG-COM-05. | UC-03 E3 |
| R-07-08 | Đính chính: bắt buộc lý do, tạo phiên bản mới bất biến, chuyển con trỏ, gửi tới **người nhận của lần đăng gốc còn ACTIVE**; không thêm người nhận mới. | GBR-62, UC-02 POST-2 |
| R-07-09 | Phiên bản đã đăng không bao giờ sửa; mỗi phiên bản gửi mỗi người nhận đúng một lần. | BR-D21 |
| R-07-10 | Đọc thông báo không đổi bất kỳ trạng thái bò hay chăm sóc nào. | GBR-62 |
| R-07-11 | Mở thông báo / xem trước / đếm chưa đọc đều kiểm lại quyền hiện tại; mất quyền thì không thấy. Lỗi gửi thông báo in-app không làm mất việc đăng; gửi lại không trùng. | GBR-64 |
| R-07-12 | Ngưng một Manager có nháp: nháp vẫn riêng tư với người đó và không sửa được nữa. | UC-FE03-06 AF2 |

---

## 5. Luồng xử lý

### UC-FE07-01 / 02 AF1 Soạn, sửa nháp
SCR-27 → nhập tiêu đề, nội dung, chọn người nhận → hệ thống hiện danh sách người nhận đã xác định (tên, vai trò, trạng thái, đã loại trùng) → **Lưu nháp** → kiểm R-07-01 → MSG-FE07-01.

### UC-FE07-03 Đăng
SCR-27 → **Xem lại & đăng** → popup hiện tiêu đề, nội dung, tác giả + vai trò, đối tượng, người nhận (số + tên tại thời điểm này), trại → **Đăng thông báo** → R-07-05, R-07-06 → MSG-FE07-03 → mở thông báo vừa đăng trong SCR-26.
AF1 **Quay lại sửa** → nháp không đổi.
E1 không còn người nhận → MSG-FE07-05 · E2 người nhận chọn tên không còn hợp lệ → MSG-FE07-02 · E3 đã đăng / đã đổi → MSG-COM-05 · E4 lỗi → MSG-COM-02.

### UC-FE07-02 Đính chính
SCR-26 → **Đính chính** (tác giả) → SCR-28 hiện phiên bản hiện tại để sửa và lịch sử phiên bản → sửa tiêu đề / nội dung, nhập lý do → **Đăng phiên bản n** → kiểm nội dung, lý do, quyền tác giả, version → R-07-08 → MSG-FE07-04.
E1 không phải tác giả → MSG-COM-01 · E2 thiếu tiêu đề / nội dung / lý do → MSG-COM-06 · E4 đã đổi → MSG-COM-05 · E5 lỗi → MSG-COM-02.

### UC-FE07-04 Xem
SCR-26: tab Đã nhận / Đã viết / Nháp (n) (Technician trên điện thoại: Chưa đọc (n) / Tất cả) → mở chi tiết → lượt gửi thành READ.

---

## 6. Màn hình và trường

### SCR-26 Thông báo trại

| # | Trường | Loại | Hiện với | Nội dung / Hành vi |
|---|---|---|---|---|
| 1 | Write announcement / Viết thông báo | Nút | Owner, Manager | Mở SCR-27 |
| 2 | Tabs | Tab | — | Đã nhận, Đã viết, Nháp (n) (Nháp chỉ cho tác giả). Technician điện thoại: Chưa đọc (n), Tất cả |
| 3 | Title / Tiêu đề | Dòng danh sách | — | In đậm nếu chưa đọc |
| 4 | Version · date · recipients | Dòng danh sách | — | Ví dụ "v2 · 10/10 · 3 người nhận" |
| 5 | State / Trạng thái | Huy hiệu | — | DRAFT / PUBLISHED |
| **Chi tiết** | | | | |
| 6 | Title, Author · role, Published at, Version | Chỉ đọc | — | Mở → lượt gửi thành READ |
| 7 | Body / Nội dung | Rich text | — | Như đã đăng |
| 8 | Version history / Lịch sử phiên bản | Link | — | Các phiên bản trước kèm lý do đính chính |
| 9 | Correct / Đính chính | Nút | Tác giả, thông báo PUBLISHED | Mở SCR-28 |
| 10 | Delivery status / Trạng thái gửi | Bảng | Chỉ tác giả | Người nhận, vai trò, trạng thái (Đã gửi / Đã đọc lúc HH:mm) |

### SCR-27 Soạn thông báo

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | State / Trạng thái | Huy hiệu | — | DRAFT | — |
| 2 | Title / Tiêu đề | Ô chữ | * | ≤ 150 | MSG-COM-06, MSG-COM-10 |
| 3 | Body / Nội dung | Rich text | * | ≤ 5.000 ký tự; đậm, nghiêng, gạch đầu dòng, danh sách số, link | MSG-COM-06, MSG-COM-10 |
| 4 | All Managers (n) / Tất cả Quản lý (n) | Checkbox | — | Chỉ Owner | MSG-FE07-02 |
| 5 | All Technicians (n) / Tất cả Kỹ thuật viên (n) | Checkbox | — | — | — |
| 6 | Choose individual members / Chọn từng thành viên | Chọn nhiều | — | Thành viên ACTIVE hợp lệ cho vai trò tác giả | MSG-FE07-02 |
| 7 | Resolved recipients (n) / Người nhận (n) | Danh sách chỉ đọc | — | Tên, vai trò, trạng thái; đã loại trùng | — |
| 8 | Save draft / Lưu nháp | Nút | — | — | MSG-COM-05, MSG-COM-02; thành công MSG-FE07-01 |
| 9 | Review & publish / Xem lại & đăng | Nút | — | Cần ít nhất 1 bộ chọn | Mở popup |

### Popup Xem lại & đăng

| # | Trường | Nội dung |
|---|---|---|
| 1 | Title, Body | Xem trước chỉ đọc |
| 2 | Author / Tác giả | Tên · vai trò |
| 3 | Audience / Đối tượng | Bộ chọn đã chọn (ví dụ "Tất cả Kỹ thuật viên") |
| 4 | Recipients / Người nhận | Số và tên xác định tại thời điểm này |
| 5 | Farm / Trại | Tên trại |
| 6 | Back to edit / Publish – Quay lại sửa / Đăng | "Quay lại sửa" về SCR-27; Đăng → MSG-FE07-03 và mở SCR-26; không còn người nhận → MSG-FE07-05 |

### SCR-28 Đính chính thông báo

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Version / Phiên bản | Chỉ đọc | — | "Phiên bản n – đang sửa" | — |
| 2 | Title / Tiêu đề | Ô chữ | * | ≤ 150; điền sẵn từ phiên bản hiện tại | MSG-COM-06 |
| 3 | Body / Nội dung | Rich text | * | ≤ 5.000; điền sẵn | MSG-COM-06 |
| 4 | Correction reason / Lý do đính chính | Ô chữ dài | * | ≤ 500 | MSG-COM-06, MSG-COM-10 |
| 5 | Version history / Lịch sử phiên bản | Chỉ đọc | — | Phiên bản, thời điểm, tác giả, lý do | — |
| 6 | Cancel / Publish version n – Hủy / Đăng phiên bản n | Nút | — | — | MSG-COM-01, MSG-COM-05, MSG-COM-02; thành công MSG-FE07-04 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách thông báo | `tab: RECEIVED\|AUTHORED\|DRAFTS\|UNREAD` | `{counts {drafts, unread}, items[{announcementId, title, versionNo, publishedAt, recipientCount, state, unread, deliveryId}]}` | COM-03 | `GET /api/farms/{farmId}/announcements` (thiếu tham số tab, xem Q1) |
| A2 | Chi tiết | — | `{announcementId, title, body, author {name, role}, publishedAt, versionNo, versions[{versionNo, publishedAt, by, reason}], canCorrect, deliveries? (chỉ tác giả) [{recipient, role, status, readAt}], myDeliveryId}` | COM-01, COM-08 | chưa có riêng – thêm `GET …/announcements/{id}` |
| A3 | Tạo nháp | `title, body, allManagers, allTechnicians, memberIds[]` + `Idempotency-Key` | `{…, resolvedRecipients[{membershipId, name, role, status}], version}` | FE07-02, COM-06, COM-10, COM-02 | `POST /api/farms/{farmId}/announcements/drafts` |
| A4 | Sửa nháp | Như A3 + `version` | Như A3 | FE07-02, COM-01, COM-05 | `PUT …/announcements/{id}/draft` |
| A5 | Xem trước người nhận khi đăng | — | `{recipients[], count}` | FE07-05 | chưa có riêng – có thể trả trong A4 |
| A6 | Đăng | `version` + `Idempotency-Key` | `{state: PUBLISHED, versionNo: 1, recipientCount}` | FE07-05, FE07-02, COM-05, COM-02 | `POST …/announcements/{id}/publish` |
| A7 | Đính chính | `title, body, reason, version` + `Idempotency-Key` | `{versionNo, recipientCount}` | COM-01, COM-06, COM-05, COM-02 | `POST …/announcements/{id}/corrections` |
| A8 | Đánh dấu đã đọc | — | `{readAt}` | COM-01 | `POST …/announcements/recipients/{deliveryId}/read` – A1 / A2 phải trả `deliveryId` để FE gọi được |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE07-01 | Toast thành công | Đã lưu nháp thông báo. |
| MSG-FE07-02 | Dưới trường | Một số người nhận không phù hợp với vai trò của bạn. Chủ trại: Quản lý và Kỹ thuật viên; Quản lý: chỉ Kỹ thuật viên. |
| MSG-FE07-03 | Toast thành công | Đã đăng thông báo tới {count} người nhận. |
| MSG-FE07-04 | Toast thành công | Đã đăng phiên bản {version} của thông báo. |
| MSG-FE07-05 | Trong hộp thoại | Không còn người nhận hợp lệ. Hãy chọn ít nhất một thành viên đang hoạt động. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-07-01 | SCR-27 | Tiêu đề trống / 151 ký tự; nội dung trống / 5.001 ký tự | MSG-COM-06 / MSG-COM-10 | U, H | SCR-27 |
| TC-07-02 | Manager | Chọn "Tất cả Quản lý" hoặc chọn tên một Manager | MSG-FE07-02 | I | R-07-01 |
| TC-07-03 | Owner, trại có 2 Manager, 3 Technician | Chọn Tất cả Kỹ thuật viên + tên 1 Technician | Người nhận 3 (đã loại trùng) | I | R-07-02 |
| TC-07-04 | Nháp của Manager M | Owner gọi danh sách nháp / sửa / đăng nháp đó | Không thấy / 403 / 403 | H | R-07-03 |
| TC-07-05 | Lưu nháp | — | Không có lượt gửi, không có thông báo in-app | I | R-07-04 |
| TC-07-06 | Nháp gửi 1 Technician đã bị ngưng sau khi lưu nháp | Đăng | MSG-FE07-05; vẫn DRAFT | I | R-07-05 |
| TC-07-07 | Nháp gửi Tất cả Kỹ thuật viên (3) | Đăng | v1, 3 lượt gửi, PUBLISHED, 3 thông báo in-app | I | R-07-06 |
| TC-07-08 | Đã đăng | Đăng lại | MSG-COM-05 | I | R-07-07 |
| TC-07-09 | Đăng v1 cho T1, T2; T2 bị ngưng; T3 mới tham gia | Đính chính v2 | v2 gửi chỉ T1; T3 không nhận v1, v2 | I | R-07-08, GBR-62 |
| TC-07-10 | Đính chính | Không lý do / lý do 501 ký tự | MSG-COM-06 / MSG-COM-10 | U, H | R-07-08 |
| TC-07-11 | v1 đã đăng | Đính chính | Nội dung v1 không đổi; xem được v1 trong lịch sử | I | R-07-09 |
| TC-07-12 | Owner | Đính chính thông báo của Manager | MSG-COM-01 | H | R-07-03 |
| TC-07-13 | Technician mở thông báo | — | Lượt gửi READ, có thời điểm; tác giả thấy "Đã đọc lúc HH:mm" | I, E | §3.3 |
| TC-07-14 | Technician bị ngưng | Mở link thông báo cũ | Bị chặn | H | R-07-11 |
| TC-07-15 | Dịch vụ thông báo in-app lỗi | Đăng | Đăng vẫn thành công; thông báo gửi lại sau, mỗi người 1 lần | I | R-07-11 |
| TC-07-16 | Technician | Gọi tạo nháp | 403 | H | §2 |
| TC-07-17 | Nội dung có thẻ `<script>` | Lưu và xem | Không chạy script (chỉ giữ định dạng cho phép) | I, E | SCR-27 (Q2) |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Danh sách thông báo phân tab ở FE hay BE? | BE nhận `tab` và trả `counts` |
| Q2 | Rich text lưu dạng gì? | Markdown hoặc HTML đã lọc theo danh sách thẻ cho phép (đậm, nghiêng, ul, ol, a) |
| Q3 | Có xóa được nháp không? SRS không nêu | Có, chỉ tác giả |
| Q4 | Người nhận chọn tên bị đổi vai trò (Technician → Manager) trước khi đăng, tác giả là Manager | Bị loại khi đăng (R-07-05) |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho TaiDX duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
