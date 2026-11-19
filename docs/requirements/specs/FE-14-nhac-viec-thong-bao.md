# SPEC FE-14 – Nhắc việc và thông báo hệ thống

| | |
|---|---|
| Feature | FE-14 System Reminders and Notifications |
| Use case | UC-FE14-01 → UC-FE14-04 |
| Người phụ trách | TaiDX (BE + FE + test, gồm JOB-01, JOB-07) · Review BE: DucNV · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Reminder, Notification), BR-D22, Part III §14 (Table III-3 REM-01 → REM-13, SCR-44, SCR-74, SCR-45 → SCR-47), MSG-FE14, GBR-25, 49, 53, 63, 64, 66, 81, 107; JOB-01, JOB-07 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.
> FE-14 **không có đặc tả Part II**; luồng dưới đây suy từ Part III và GBR (xem Q1).

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE14-01 | Xem nhắc việc và gợi ý của trại, mở bản ghi nguồn | Owner, Manager, Technician (chỉ đọc) | SCR-44, SCR-74 (trang chủ Technician) |
| UC-FE14-02 | Xem thông báo gói dịch vụ / thanh toán | Owner | SCR-45 |
| UC-FE14-03 | Xem thông báo hỗ trợ | Owner (ticket của mình), CS, PM / SA (yêu cầu nội bộ được giao) | SCR-45 (Owner), SCR-46 |
| UC-FE14-04 | Xem thông báo đối soát thanh toán | Platform Manager | SCR-47 |

**Không thuộc FE-14:** ghi nhận nghiệp vụ (cân, tiêm, phối…) – nhắc việc chỉ mở màn hình nguồn của FE tương ứng. Thông báo trại (announcement) là FE-07.

---

## 2. Vai trò và quyền

| Nội dung | Owner | Manager | Technician | CS | PM | SA |
|---|---|---|---|---|---|---|
| SCR-44 nhắc việc trại | Có | Có | Có (chỉ đọc) | — | — | — |
| Tab Bê nháp, Xuất đàn & xuất chuồng | Có | Có | — | — | — | — |
| Tab Thức ăn | Tồn thấp | Tồn thấp + bữa chưa ghi | Bữa chưa ghi | — | — | — |
| Nút mở nguồn REM-08 (popup Chuyển chuồng / Cập nhật hồ sơ) | Có | Có | — | — | — | — |
| SCR-74 Trang chủ Technician | — | — | Có | — | — | — |
| SCR-45 Thông báo của tôi | Có (trại mình sở hữu, ticket mình) | — | — | — | — | — |
| SCR-46 Thông báo hỗ trợ | — | — | — | Có | Yêu cầu được giao | Yêu cầu được giao |
| SCR-47 Thông báo đối soát | — | — | — | — | Có | — |

Mọi lần mở / xem trước / đếm chưa đọc đều kiểm lại quyền hiện tại (GBR-64).

---

## 3. Dữ liệu

### 3.1 Nhắc việc (Reminder)

| Thuộc tính | Ràng buộc | Nguồn |
|---|---|---|
| Trại, bò (hoặc nhóm / chuồng / mặt hàng thức ăn) | — | §3.2 |
| Quy tắc | REM-01 → REM-13 (Table III-3) | GBR-63 |
| Bản ghi nguồn + khóa lần xảy ra | Duy nhất: quy tắc + nguồn + khóa lần (BR-D22) | BR-D22 |
| Phiên bản tham số | Lưu phiên bản tham số dùng để tính hạn; thiếu tham số → không sinh nhắc việc đó | GBR-63 |
| Hạn / cửa sổ | Ngày, khoảng giờ hoặc khoảng ngày | Table III-3 |
| Nhãn cơ sở | TENTATIVE / CONFIRMED (dự sinh) | GBR-53 |
| Đối tượng nhận | Theo cột Audience | Table III-3 |
| Vòng đời | `ACTIVE` → `RESOLVED` / `CANCELLED` / `SUPERSEDED` | GBR-63 |

### 3.2 Thông báo (Notification)

| Thuộc tính | Ràng buộc |
|---|---|
| Người nhận | 1 tài khoản |
| Nhóm | Gói dịch vụ, Hỗ trợ, Đối soát, Thông báo trại |
| Đích | 1 loại + ID (typed target) |
| Tiêu đề, tóm tắt, thời điểm tạo, thời điểm đọc | — |
| Duy nhất | Người nhận + sự kiện nguồn (BR-D22) |
| Trạng thái | `UNREAD` → `READ` |

### 3.3 Danh mục quy tắc nhắc việc (Table III-3)

| Quy tắc | Tên VN | Nguồn và điều kiện | Hạn / cửa sổ | Giải quyết / hủy | Đối tượng | Mở nguồn |
|---|---|---|---|---|---|---|
| REM-01 | Đến hạn cân | Bò ACTIVE đã đăng ký | Ngày cân VALID mới nhất (hoặc ngày nhập đàn) + chu kỳ cân (30 ngày) | Giải quyết khi có cân VALID mới; hủy khi xuất | O, M, T | SCR-30 (popup Ghi cân & BCS) |
| REM-02 | Cửa sổ phối | Động dục VALID của cái chưa có thai OPEN | Giờ động dục + 8 h → + 12 h | Giải quyết khi phối; thay thế bởi động dục mới; hủy khi quá cửa sổ / động dục bị hủy | O, M, T | SCR-39 (popup Ghi phối) |
| REM-03 | Đến hạn khám thai | Lần phối VALID chưa khám sau đó, hoặc thai khai báo khi nhập đàn (GBR-30) | Phối + 28 ngày; nhập đàn + 7 ngày | Giải quyết khi khám; thay thế bởi lần phối mới; hủy khi phối bị hủy | O, M, T | SCR-39 (popup Ghi khám thai) |
| REM-04 | Khám lại thai | Kết quả INCONCLUSIVE | Lần khám + 14 ngày | Giải quyết khi khám tiếp; hủy khi lần khám bị hủy | O, M, T | SCR-39 |
| REM-05 | Sắp đẻ | Ngày dự sinh (TENTATIVE / CONFIRMED, có nhãn) | Mở 30 ngày trước; hạn đúng ngày | Giải quyết khi đẻ; hủy khi sẩy, khám NOT_PREGNANT, hủy, xuất | O, M, T | SCR-39 (SCR-40) |
| REM-06 | Mũi tiêm | Mũi PLANNED / DEFERRED | Sắp tới đến 7 ngày trước; đến hạn trong 7 ngày; quá hạn sau ngày | Giải quyết khi tiêm ON_FARM; theo ngày hoãn; hủy khi dừng lịch / xuất | O, M, T | SCR-34 (ghi: SCR-33; hoãn: popup Hoãn mũi) |
| REM-07 | Sẵn sàng phối sau đẻ | Lần đẻ của con cái | Đẻ + 45 ngày | Giải quyết khi có động dục / phối; hủy khi xuất | O, M, T | SCR-39 |
| REM-08 | Gợi ý chuyển chuồng / giai đoạn | Chuồng: bò ACTIVE không còn đạt tiêu chí tiếp nhận chuồng hiện tại. Giai đoạn: tuổi đạt mốc (bê theo mẹ → bê cai sữa 6 tháng; → bò tơ 12 tháng; → trưởng thành 24 tháng) hoặc cái chưa trưởng thành có lần đẻ VALID đầu. Không gợi ý giai đoạn khi ngày sinh UNKNOWN | Chuồng: ngay. Giai đoạn: ngày đạt tuổi / ngày đẻ | Chuồng: giải quyết khi chuyển chuồng hoặc đạt lại tiêu chí. Giai đoạn: giải quyết khi đổi giai đoạn. Cả hai hủy khi xuất. Gợi ý **không tự đổi** (GBR-25) | O, M, T | Popup Chuyển chuồng / Cập nhật hồ sơ (tab Giai đoạn) |
| REM-09 | Bê nháp chờ xác nhận | Kết quả bê PENDING_CONFIRMATION | Ngay; tô nổi sau 3 ngày | Giải quyết khi đăng ký hoặc "chết trước khi đăng ký"; hủy khi lần đẻ bị hủy | O, M | SCR-25 |
| REM-10 | Tồn thức ăn thấp | Mặt hàng ACTIVE có mức tồn tối thiểu, tồn ≤ mức đó (GBR-104) | Ngay; "Hết hàng" khi 0 kg | Giải quyết khi nhập / điều chỉnh đưa tồn > mức; hủy khi mặt hàng ngưng / bỏ mức | O, M | SCR-77 (nhập: SCR-79) |
| REM-11 | Bữa ăn chưa ghi | Bữa của khẩu phần hiệu lực của chuồng ACTIVE có bò, hôm nay | Giờ bữa + 2 giờ | Giải quyết khi có bản ghi cho ăn VALID cho chuồng, ngày, bữa; hủy cuối ngày, khi khẩu phần kết thúc hoặc chuồng hết bò | M, T | SCR-83 (popup Ghi bữa ăn) |
| REM-12 | Chết / mất chờ xác nhận | Phiếu chết PENDING từ ca sức khỏe (GBR-95) | Ngay; tô nổi sau 3 ngày | Giải quyết khi Owner xác nhận / bỏ; hủy khi phiếu bị hủy hoặc đóng ca được sửa | O, M | SCR-43 (Owner thao tác, Manager xem) |
| REM-13 | Đạt cân xuất chuồng | Bò ACTIVE loại FATTENING có cân VALID mới nhất ≥ cân xuất chuồng mục tiêu (tham số, GBR-107) | Ngày ghi cân | Giải quyết khi xuất đàn / đổi mục đích; hủy khi cân sửa xuống dưới mục tiêu / bỏ tham số | O, M | SCR-30 (Owner có thể lập phiếu xuất SCR-42) |

O = Owner, M = Manager, T = Technician.

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-14-01 | Nhắc việc chỉ sinh từ REM-01 → REM-13, mỗi nhắc việc có đúng 1 bản ghi nguồn và lưu phiên bản tham số. Tham số thiếu → chỉ nhắc việc đó không sinh. | GBR-63 |
| R-14-02 | Duy nhất theo quy tắc + nguồn + khóa lần; chạy lại JOB-01 không tạo trùng. | BR-D22 |
| R-14-03 | Đọc / mở nhắc việc **không bao giờ** giải quyết nó. Trạng thái chỉ đổi do dữ liệu nguồn (bản ghi mới, sửa, hủy). | GBR-63, GBR-49 |
| R-14-04 | Sửa / hủy bản ghi nguồn → nhắc việc được thay thế (SUPERSEDED) hoặc hủy. | GBR-63 |
| R-14-05 | JOB-01 chạy mỗi 15 phút và sau mỗi thay đổi nguồn đã lưu; tạo, cập nhật, giải quyết, hủy theo Table III-3. | JOB-01 |
| R-14-06 | Nhóm thời gian theo múi giờ trại (mặc định Asia/Ho_Chi_Minh): Quá hạn / Hôm nay / Sắp tới trong 7 ngày. | GBR-66 |
| R-14-07 | Nhắc việc chỉ hiện cho đối tượng ở cột Audience; tab Bê nháp và Xuất đàn & xuất chuồng chỉ Owner, Manager; tab Thức ăn tách theo vai trò. | Table III-3, SCR-44 |
| R-14-08 | Mở nguồn: kiểm lại quyền rồi mở màn hình nguồn; REM-08 chỉ cho Owner, Manager mở popup. | SCR-44 |
| R-14-09 | Gợi ý REM-08 không tự đổi chuồng, giai đoạn, mục đích. | GBR-25 |
| R-14-10 | Nhắc việc dự sinh hiển thị nhãn TENTATIVE / CONFIRMED (ESTIMATED nếu ngày ước tính). | GBR-53 |
| R-14-11 | Thông báo: 1 đích, 1 người nhận; duy nhất theo người nhận + sự kiện nguồn. | GBR-64, BR-D22 |
| R-14-12 | Mở thông báo, xem trước, số chưa đọc → kiểm lại quyền; mất quyền → ẩn. | GBR-64 |
| R-14-13 | Thay đổi nghiệp vụ và sự kiện thông báo lưu cùng transaction; JOB-07 giao (mỗi phút) với retry, không lặp, không hoàn tác nghiệp vụ khi giao lỗi. | GBR-64, JOB-07 |
| R-14-14 | Phân tách đối tượng hỗ trợ: Owner chỉ thấy ticket của mình và tin PUBLIC; ngữ cảnh yêu cầu nội bộ chỉ CS phụ trách và người được giao. | GBR-81 |
| R-14-15 | Mở thông báo → đánh dấu đã đọc. "Đánh dấu tất cả đã đọc" → MSG-FE14-02. | SCR-45 |

---

## 5. Luồng xử lý

### UC-FE14-01 Xem nhắc việc trại
1. Thành viên mở SCR-44 (hoặc SCR-74 với Technician).
2. Hệ thống trả nhắc việc ACTIVE thuộc đối tượng người dùng, chia tab theo loại (có số) và nhóm Quá hạn / Hôm nay / Sắp tới 7 ngày.
3. Chọn nhắc việc → chi tiết: bò, loại, tóm tắt nguồn, cơ sở (tham số + phiên bản, nhãn dự sinh).
4. **Mở hồ sơ bò** → SCR-19 (tab liên quan) hoặc **Mở nguồn** → màn hình cột cuối Table III-3, sau khi kiểm lại quyền.
5. Người dùng ghi nhận nghiệp vụ ở màn hình nguồn → JOB-01 giải quyết nhắc việc.

E1 thiếu cơ sở → MSG-FE14-01 · E2 mất quyền với nguồn → MSG-COM-03.

### UC-FE14-02 / 03 / 04 Xem thông báo
1. Mở SCR-45 / SCR-46 / SCR-47 → danh sách theo tab, mới nhất trước, dấu chưa đọc.
2. Chọn → kiểm lại quyền → đánh dấu READ → mở đích (SCR-57, 59, 60, 66 / SCR-68, 69 / SCR-62).
3. **Đánh dấu tất cả đã đọc** → MSG-FE14-02.

E1 yêu cầu không còn được giao (PM / SA) → MSG-FE20-19 · E2 mất quyền → ẩn thông báo.

---

## 6. Màn hình và trường

### SCR-44 Nhắc việc trại

| # | Trường | Loại | Nội dung / Ràng buộc |
|---|---|---|---|
| 1 | Type tabs / Tab loại | Tab có số | Tất cả, Tiêm phòng, Đẻ, Phối giống, Khám thai, Chuyển chuồng & giai đoạn, Cân, Bê nháp (O, M), Xuất đàn & xuất chuồng (REM-12, REM-13; O, M), Thức ăn (tồn thấp: O, M; bữa chưa ghi: M, T) |
| 2 | Groups / Nhóm | Nhóm có số | Quá hạn (n), Hôm nay (n), Sắp tới trong 7 ngày (n) |
| 3 | Title / Tiêu đề | Chữ | Tên quy tắc + giá trị chính (ví dụ "LMLM mũi 2", "Cửa sổ phối 14:30–18:30", "Dự sinh 22/10 – chuẩn bị chuồng đẻ") |
| 4 | Cattle / Bò | Chữ | Mã hiển thị, giống, chuồng (hoặc nhóm, ví dụ "12 con · chuồng B1") |
| 5 | Due / Hạn | Chữ | Ngày, khoảng giờ, hoặc "Quá hạn n ngày"; REM-09, REM-12 tô nổi sau 3 ngày |
| **Chi tiết** | | | |
| 6 | Cattle / Bò | Chỉ đọc | Mã, giống, giới tính, tuổi, chuồng |
| 7 | Reminder type / Loại nhắc việc | Chỉ đọc | Tên quy tắc |
| 8 | Source / Nguồn | Chỉ đọc | Tóm tắt bản ghi nguồn (ví dụ lịch, mũi, vắc-xin, liều và đường tiêm tham chiếu, ngày hạn) |
| 9 | Basis / Cơ sở | Chỉ đọc | Tham số + phiên bản; nhãn TENTATIVE / CONFIRMED cho dự sinh; thiếu → MSG-FE14-01 |
| 10 | Open cattle profile / Open source – Mở hồ sơ bò / Mở nguồn | Nút | SCR-19 (tab liên quan) hoặc màn hình nguồn; REM-08 chỉ O, M |

### SCR-74 Trang chủ Technician (điện thoại, chỉ đọc)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Greeting / Lời chào | Tên, tên trại, ngày |
| 2 | Scan ear tag QR / Quét QR thẻ tai | Mở SCR-22 |
| 3 | Open cattle profile / Mở hồ sơ bò | Tìm theo mã / số tai → SCR-19 |
| 4 | New announcements / Thông báo mới | Tối đa 3 thông báo trại chưa đọc mới nhất (tiêu đề, người đăng, giờ); "Xem tất cả" → SCR-26 |
| 5 | Today's reminders (n) / Nhắc việc hôm nay | Tối đa 6: tiêu đề, bò · chuồng, chip Quá hạn / Hôm nay / Sắp tới; chạm → chi tiết SCR-44 |
| 6 | Today's rations / Khẩu phần hôm nay | Link SCR-86 + số bữa chưa ghi (REM-11) |

### SCR-45 Thông báo của tôi (Owner)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Mark all as read / Đánh dấu tất cả đã đọc | Nút → MSG-FE14-02 |
| 2 | Tabs | Tất cả (n), Gói & thanh toán (n), Hỗ trợ (n) |
| 3 | Title / Tiêu đề | Ví dụ "Yêu cầu thanh toán BCF7K2Q9 đang chờ chuyển khoản", "CS đã trả lời ticket TK-1042", "TK-1031 đã xử lý – vui lòng xác nhận", "Gói của trại X hết hạn sau 27 ngày", "Trại X đã bị tạm ngưng dịch vụ" |
| 4 | Context line / Ngữ cảnh | Trại, ngày hết hạn, nhóm ticket hoặc phiên bản xử lý |
| 5 | Time / Thời gian | Tương đối ("5 phút trước"), sau đó ngày |
| 6 | Unread marker / Dấu chưa đọc | Đến khi mở |
| 7 | Open / Mở | SCR-57, SCR-59, SCR-60 hoặc SCR-66 sau khi kiểm lại quyền sở hữu |

### SCR-46 Thông báo hỗ trợ (CS, PM / SA)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Mark all as read | Nút |
| 2 | Title / Tiêu đề | CS: ticket mới (mức ưu tiên), nhận kết quả yêu cầu nội bộ, Owner xác nhận xử lý, ticket mở lại, ticket được bàn giao cho bạn. PM / SA: yêu cầu nội bộ giao cho bạn, CS bổ sung thông tin, yêu cầu bị hủy, yêu cầu còn OPEN sau 4 giờ |
| 3 | Context line | Mã ticket, trại hoặc mã yêu cầu, lý do |
| 4 | Time, Unread marker | Như SCR-45 |
| 5 | Open | SCR-68 (CS) / SCR-69 (PM / SA) sau khi kiểm lại phân công; không còn được giao → MSG-FE20-19 |

### SCR-47 Thông báo đối soát (PM)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Title / Tiêu đề | Chứng từ không khớp mã thanh toán; chứng từ cho yêu cầu đã hết hạn; chứng từ không có yêu cầu; chứng từ khóa chờ mã hoàn tiền; tổng hợp xác nhận tự động trong ngày |
| 2 | Context line | Số tiền, giờ ngân hàng, mã ứng viên hoặc ngày |
| 3 | Open | SCR-62 trên chứng từ hoặc yêu cầu |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách nhắc việc trại | `tab?, group?` | `{counts{tab}, groups{overdue, today, upcoming}[{id, rule, title, cattle{code, breed, pen} \| groupLabel, due{date \| window \| overdueDays}, highlighted}]}` | COM-03 | `GET /api/farms/{farmId}/reminders` |
| A2 | Chi tiết nhắc việc | — | `{cattle{…}, rule, source{type, id, summary}, basis{parameter, version, label?} \| missing, sourceScreen}` | FE14-01, COM-03 | Chưa có riêng – đề xuất `GET /api/farms/{farmId}/reminders/{id}` |
| A3 | Nhắc việc thức ăn | — | REM-10, REM-11 theo vai trò | — | `GET /api/farms/{farmId}/feed/reminders` |
| A4 | Trang chủ Technician | — | `{greeting, announcements[≤3], reminders[≤6], unrecordedSessions}` | — | Chưa có riêng – đề xuất `GET /api/farms/{farmId}/technician-home` (hoặc ghép A1 + FE-07 + A3) |
| A5 | Thông báo của tôi | `category?, page, size` | `{counts{all, subscription, support, reconciliation}, items[{id, category, title, context, createdAt, readAt?, target{type, id}}]}` | — | `GET /api/notifications/mine` |
| A6 | Mở / đánh dấu đọc | — | Thông báo + đích sau khi kiểm quyền | COM-03, FE20-19 | `PUT /api/notifications/{id}/read` |
| A7 | Đánh dấu tất cả đã đọc | `category?` | `count` | — | `PUT /api/notifications/read-all` |
| A8 | Số chưa đọc (chuông) | — | `{unread}` | — | Chưa có riêng – đề xuất `GET /api/notifications/unread-count` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE14-01 | Trong chi tiết | Chưa tính được hạn: thiếu {basis}. |
| MSG-FE14-02 | Toast thành công | Đã đánh dấu tất cả thông báo là đã đọc. |

Dùng lại: MSG-COM-03 (không có quyền), MSG-FE20-19 (yêu cầu không còn giao cho bạn).

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-14-01 | Bò cân ngày 01/10, chu kỳ 30 | JOB-01 chạy | REM-01 hạn 31/10, lưu phiên bản tham số | U, I | REM-01, R-14-01 |
| TC-14-02 | Có REM-01 ACTIVE | Ghi cân VALID mới | REM-01 RESOLVED, REM-01 mới với hạn mới | I | REM-01 |
| TC-14-03 | Xóa tham số chu kỳ cân | JOB-01 | Không sinh REM-01; nhắc việc khác vẫn sinh | I | R-14-01 |
| TC-14-04 | JOB-01 chạy 2 lần liên tiếp | — | Không trùng nhắc việc | I | R-14-02 |
| TC-14-05 | Mở chi tiết nhắc việc | — | Vẫn ACTIVE | I | R-14-03 |
| TC-14-06 | Động dục 06:00 | JOB-01 | REM-02 cửa sổ 14:00–18:00; ghi động dục mới → SUPERSEDED; quá 18:00 → CANCELLED | U, I | REM-02 |
| TC-14-07 | Phối 01/10 | JOB-01 | REM-03 hạn 29/10; hủy phối → CANCELLED | I | REM-03, R-14-04 |
| TC-14-08 | Dự sinh TENTATIVE 22/12 | Hôm nay 22/11 | REM-05 hiện, nhãn TENTATIVE | I, E | REM-05, R-14-10 |
| TC-14-09 | Mũi PLANNED 20/11, hôm nay 15/11 | Xem | Nhóm "Sắp tới 7 ngày" → đến hạn; sau 20/11 → Quá hạn n ngày | U | REM-06, R-14-06 |
| TC-14-10 | Bê theo mẹ 6 tháng tuổi | JOB-01 | REM-08 gợi ý giai đoạn; bò **không** tự đổi giai đoạn | I | REM-08, R-14-09 |
| TC-14-11 | Bò ngày sinh UNKNOWN | JOB-01 | Không có gợi ý giai đoạn | I | REM-08 |
| TC-14-12 | Technician mở REM-08 | Mở nguồn | Không có nút popup Chuyển chuồng / Cập nhật hồ sơ | E | R-14-08 |
| TC-14-13 | Technician | Xem SCR-44 | Không có tab Bê nháp, Xuất đàn; tab Thức ăn chỉ bữa chưa ghi | E, H | R-14-07 |
| TC-14-14 | REM-09 tạo 4 ngày trước | Xem | Tô nổi | U | REM-09 |
| TC-14-15 | Tồn 0 kg, mức tối thiểu 50 | JOB-01 | REM-10 "Hết hàng"; nhập đưa tồn 60 → RESOLVED | I | REM-10 |
| TC-14-16 | Bữa 07:00, không ghi | 09:01 | REM-11 hiện cho M, T; cuối ngày → CANCELLED | I | REM-11 |
| TC-14-17 | Bò vỗ béo đạt cân mục tiêu | Ghi cân | REM-13; xuất đàn → RESOLVED | I | REM-13 |
| TC-14-18 | Bò xuất đàn | Xác nhận phiếu | Mọi nhắc việc của bò sau ngày xuất CANCELLED | I | Table III-3 |
| TC-14-19 | Múi giờ trại, 23:30 ngày 10/11 | Phân nhóm | Hôm nay = 10/11 (không theo UTC) | U | R-14-06 |
| TC-14-20 | Owner mất quyền sở hữu trại X | Xem SCR-45 | Thông báo của trại X bị ẩn; số chưa đọc không tính | I, H | R-14-12 |
| TC-14-21 | Sự kiện thanh toán tạo 2 lần | JOB-07 | Chỉ 1 thông báo / người nhận | I | R-14-11 |
| TC-14-22 | JOB-07 giao lỗi | Retry | Không lặp; nghiệp vụ gốc không bị hoàn tác | I | R-14-13 |
| TC-14-23 | 5 thông báo chưa đọc | Đánh dấu tất cả | 0 chưa đọc; MSG-FE14-02 | I, E | R-14-15 |
| TC-14-24 | SA mở yêu cầu đã bàn giao cho người khác | Mở | MSG-FE20-19 | I | SCR-46 |
| TC-14-25 | Owner | Gọi API SCR-46 / SCR-47 | 403 | H | §2 |
| TC-14-26 | Chi tiết nhắc việc thiếu tham số | Xem | MSG-FE14-01 | E | R-14-01 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | FE-14 không có đặc tả UC ở Part II | Dùng Part III + GBR làm nguồn; bổ sung Part II ở lần sửa SRS sau |
| Q2 | Có API chi tiết nhắc việc riêng? | Thêm A2; hoặc trả đủ chi tiết trong A1 |
| Q3 | Nhắc việc có gửi email / thông báo đẩy không? | Không – SRS chỉ nói hiển thị trong trại |
| Q4 | Thời gian giữ thông báo đã đọc | Giữ vô hạn; phân trang |
| Q5 | Chuông thông báo trên header cho vai trò nào | Owner (SCR-45), CS / PM / SA (SCR-46), PM (SCR-47) |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho TaiDX duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
