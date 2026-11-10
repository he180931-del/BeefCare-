# SPEC FE-20 – Hỗ trợ khách hàng (ticket)

| | |
|---|---|
| Feature | FE-20 Customer Support Ticket Management |
| Use case | UC-FE20-01 → UC-FE20-13 |
| Người phụ trách | LamKD (BE + FE + test) · Review BE: DucNV · Review FE: AnNT |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Support Ticket + History Event, Ticket Message, Ticket Resolution + Acknowledgment, Internal Request, Customer Support), BR-D26, Part II §16 (UC-FE20-01, 04, 05, 07, 10, 11, 12, 13), Part III §20 (SCR-64 → SCR-69, popup Đóng ticket), MSG-FE20-01 → 20, GBR-11, 14, 76 → 81, 86 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.

---

## 1. Phạm vi

| Nhóm | UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|---|
| Owner | UC-FE20-01 | Tạo ticket | Owner | SCR-65 |
| | UC-FE20-02 | Xem ticket của mình | Owner | SCR-64, SCR-66 |
| | UC-FE20-03 | Trả lời ticket | Owner | SCR-66 |
| | UC-FE20-04 | Xác nhận đã giải quyết | Owner | SCR-66 |
| | UC-FE20-05 | Mở lại ticket đã giải quyết | Owner | SCR-66 |
| CS | UC-FE20-06 | Xem hàng đợi | CS | SCR-67 |
| | UC-FE20-07 | Nhận, bàn giao, phân loại, đổi trạng thái | CS | SCR-67, SCR-68 |
| | UC-FE20-08 | Trả lời công khai | CS phụ trách | SCR-68 |
| | UC-FE20-09 | Ghi chú nội bộ | CS phụ trách | SCR-68 |
| | UC-FE20-10 | Ghi kết quả giải quyết | CS phụ trách | SCR-68 |
| | UC-FE20-11 | Đóng ticket | CS phụ trách | Popup Đóng ticket |
| Yêu cầu nội bộ | UC-FE20-12 | Tạo / đổi người nhận / hủy yêu cầu nội bộ | CS phụ trách | SCR-68 |
| | UC-FE20-13 | Xử lý yêu cầu nội bộ được giao | PM / SA được nêu tên | SCR-69 |

**Liên quan:** thông báo hỗ trợ (FE-14 SCR-45, SCR-46); thao tác nghiệp vụ của PM / SA nằm ở FE-02, FE-03, FE-19.

---

## 2. Vai trò và quyền

| Hành động | Owner | CS | CS phụ trách | PM / SA người nhận |
|---|---|---|---|---|
| Tạo ticket | **Chỉ Owner**, về tài khoản mình hoặc 1 trại mình sở hữu | — | — | — |
| Xem ticket | Chỉ ticket của mình, chỉ tin PUBLIC | Toàn bộ hàng đợi | Có | — |
| Ghi chú nội bộ | Không thấy | Thấy | Thêm | Không thấy |
| Thay đổi ticket chưa CLOSED | Trả lời, xác nhận, mở lại | Chỉ "Nhận" | Mọi thao tác | — |
| Yêu cầu nội bộ | Không thấy | — | Tạo / đổi / hủy | Chỉ xem ngữ cảnh yêu cầu của mình, hoàn thành |

Owner tạo ticket được kể cả khi trại không ACTIVE (GBR-14, GBR-76). CS **không** truy cập dữ liệu bò / chăm sóc.

---

## 3. Dữ liệu

### 3.1 Ticket hỗ trợ

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| Mã | `TK-nnnn` | Hệ thống | Duy nhất |
| Người yêu cầu | Tài khoản Owner | Hệ thống | **Không bao giờ đổi** (BR-D26) |
| Nhóm | Enum | Có | `ACCOUNT_ACCESS` Truy cập tài khoản / `PAYMENT` Thanh toán / `FARM_SERVICE` Dịch vụ trại / `SYSTEM_USAGE` Sử dụng hệ thống / `OTHER` Khác |
| Phạm vi | Enum | Có | Trại / Vấn đề tài khoản (không trại) |
| Trại liên quan | Tham chiếu | Có khi phạm vi Trại | Trại người yêu cầu sở hữu |
| Mức ưu tiên | Enum | — | `LOW` / `NORMAL` (mặc định) / `HIGH`; chỉ CS đặt |
| Tiêu đề | Chuỗi | Có | ≤ 150 |
| Mô tả | Chuỗi dài | Có | ≤ 3.000; lưu thành tin PUBLIC đầu tiên |
| Trạng thái | Enum | — | `OPEN` → `IN_PROGRESS` ⇄ `WAITING_CUSTOMER` → `RESOLVED` → `CLOSED`; `RESOLVED` → `OPEN` khi mở lại |
| CS phụ trách | Tham chiếu | — | Rỗng = chưa giao |
| Phiên bản giải quyết mới nhất, xác nhận hiện hành, tạo / cập nhật lúc, version | — | — | — |
| Lịch sử (detail) | Bất biến | — | Loại sự kiện, trước / sau (trạng thái / người phụ trách), người + vai trò, lý do, thời điểm; gồm sự kiện của yêu cầu nội bộ |

### 3.2 Tin nhắn ticket
Ticket, người viết + vai trò, đối tượng (`PUBLIC` / `CS_ONLY`), nội dung (≤ 3.000), thời điểm. Bất biến, không sửa / xóa.

### 3.3 Kết quả giải quyết
Ticket, số phiên bản (duy nhất trong ticket), nội dung (≤ 3.000), người, thời điểm. Bất biến. **Xác nhận (detail):** phiên bản, người yêu cầu, thời điểm, ghi chú tùy chọn, CS xem xét + thời điểm; `EFFECTIVE` → `SUPERSEDED` (khi mở lại hoặc có kết quả mới); 1 xác nhận hiệu lực / phiên bản.

### 3.4 Yêu cầu nội bộ

| Thuộc tính | Ràng buộc |
|---|---|
| Mã | `IR-nnn` |
| Ticket, vai trò đích (PM / SA), người nhận được nêu tên, CS tạo | Người nhận đang khả dụng với vai trò đó |
| Câu hỏi | ≤ 2.000, bắt buộc |
| Ngữ cảnh được phép | PM: tham chiếu trại, subscription, thanh toán, thu chi; SA: tham chiếu tài khoản |
| Trạng thái | `OPEN` → `DONE` / `CANCELLED`; tối đa 1 OPEN / ticket / vai trò |
| Kết quả | `PERFORMED` Đã thực hiện / `UNABLE` Không thực hiện được / `OUTSIDE_DOMAIN` Ngoài phạm vi |
| Kết quả đã làm sạch | ≤ 2.000; chỉ CS phụ trách thấy, **không bao giờ** cho Owner |
| Tham chiếu kết quả nghiệp vụ | Bắt buộc khi PERFORMED: thay đổi đã commit (quyết định chứng từ, thay đổi dịch vụ trại, thay đổi tài khoản) |
| Hoàn thành lúc, lý do đổi người nhận / hủy | — |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-20-01 | Chỉ Owner tạo ticket, về tài khoản hoặc 1 trại mình sở hữu; ưu tiên bắt đầu NORMAL; hỗ trợ được khi trại không ACTIVE; người yêu cầu không đổi. | GBR-76, GBR-14 |
| R-20-02 | CS đọc cả hàng đợi; **chỉ CS đang phụ trách và khả dụng** thay đổi ticket chưa CLOSED (MSG-FE20-09). | GBR-77 |
| R-20-03 | Nhận và bàn giao là nguyên tử; bàn giao và trả về hàng đợi cần lý do; lưu lịch sử. CS không khả dụng → ticket về hàng đợi, giữ trạng thái. | GBR-77 |
| R-20-04 | Vòng đời: Nhận → OPEN thành IN_PROGRESS (RESOLVED giữ nguyên); Hỏi khách → WAITING_CUSTOMER; Owner trả lời khi WAITING → IN_PROGRESS; ghi kết quả → RESOLVED; Owner mở lại (lý do) → OPEN, cùng CS; trả lời công khai **không** mở lại RESOLVED; CLOSED chỉ đọc. | GBR-78 |
| R-20-05 | Yêu cầu nội bộ: tối đa 1 OPEN / vai trò (MSG-FE20-16); chỉ khi ticket IN_PROGRESS / WAITING_CUSTOMER; người nhận đang khả dụng; đổi người nhận / hủy cần lý do; người nhận cũ mất quyền ngay. | GBR-79, BR-D26 |
| R-20-06 | Người nhận chỉ thấy ngữ cảnh yêu cầu, không thấy hội thoại hay ghi chú CS; DONE **không** giải quyết / đóng ticket; yêu cầu OPEN chặn giải quyết và đóng (MSG-FE20-12). | GBR-79 |
| R-20-07 | PERFORMED phải tham chiếu thay đổi nghiệp vụ đã commit (MSG-COM-08 nếu sai); lưu DONE lỗi sau khi nghiệp vụ đã commit → thử lại với cùng tham chiếu, không làm lại nghiệp vụ. | UC-13 |
| R-20-08 | Kết quả giải quyết là phiên bản mới bất biến; Owner xác nhận phiên bản mới nhất; phiên bản mới hoặc mở lại vô hiệu xác nhận cũ. | GBR-80 |
| R-20-09 | Đóng chỉ khi RESOLVED, Owner đã xác nhận phiên bản mới nhất (MSG-FE20-13), không có yêu cầu OPEN, CS tick xác nhận (MSG-COM-16). **Không bao giờ** đóng do im lặng, hết giờ hay diễn giải câu chữ. | GBR-80 |
| R-20-10 | Phân tách đối tượng: Owner chỉ ticket mình + tin PUBLIC; ghi chú nội bộ chỉ CS; ngữ cảnh / kết quả yêu cầu nội bộ chỉ CS phụ trách và người nhận. | GBR-81 |
| R-20-11 | Mọi thay đổi + lịch sử + sự kiện thông báo lưu cùng transaction; thông báo qua JOB-07; phân công và đổi trạng thái ghi audit. | GBR-64, GBR-86 |
| R-20-12 | Lệnh có Idempotency-Key; cập nhật có version → MSG-COM-05 khi đã đổi. | GBR-88, GBR-89 |

---

## 5. Luồng xử lý

### UC-FE20-01 Tạo ticket
1. SCR-65 với danh sách nhóm. 2. Owner chọn nhóm, phạm vi, trại (nếu phạm vi Trại), nhập tiêu đề, mô tả. 3. **Gửi ticket**. 4. Kiểm trường, trại thuộc người yêu cầu. 5. Tạo ticket, tin PUBLIC đầu, lịch sử – 1 transaction. 6. Thông báo CS; MSG-FE20-01 kèm mã.
AF1 mở từ ngữ cảnh (thanh toán, trại tạm ngưng) → điền sẵn nhóm, trại · AF2 Hủy.
E1 thiếu → MSG-COM-06 · E2 trại không sở hữu → MSG-COM-01 · E3 lỗi → MSG-COM-02.

### UC-FE20-03 Owner trả lời
SCR-66 → nhập trả lời → **Gửi** → MSG-FE20-02; nếu WAITING_CUSTOMER → IN_PROGRESS. CLOSED → MSG-FE20-06.

### UC-FE20-04 Xác nhận đã giải quyết
1. Owner đọc kết quả (phiên bản, CS, thời điểm) → **Xác nhận đã giải quyết**. 2. Kiểm người yêu cầu, trạng thái, phiên bản đang xem là mới nhất. 3. Lưu xác nhận + tin PUBLIC. 4. Thông báo CS; MSG-FE20-03.
AF1 xác nhận lặp → trả xác nhận cũ. E1 có phiên bản mới → MSG-FE20-05 · E2 không còn RESOLVED → MSG-COM-05.

### UC-FE20-05 Mở lại
Hộp thoại (phiên bản) → lý do → **Xác nhận mở lại** → OPEN cho cùng CS (hoặc hàng đợi nếu CS không khả dụng), lưu tin PUBLIC, vô hiệu xác nhận, lịch sử → MSG-FE20-04.
E1 thiếu lý do → MSG-COM-06 · E2 CLOSED → MSG-FE20-06 · E3 đã đổi → MSG-COM-05.

### UC-FE20-07 Nhận và xử lý
1. CS **Nhận** trên SCR-67. 2. Kiểm quyền CS, chưa có CS khả dụng phụ trách, version → giao nguyên tử, OPEN → IN_PROGRESS. 3. Lịch sử; MSG-FE20-07; mở SCR-68. 4. Đặt nhóm, ưu tiên → MSG-COM-09.
AF1 Bàn giao (CS khả dụng + lý do) → MSG-FE20-08, giữ trạng thái và yêu cầu nội bộ OPEN · AF2 Hỏi khách → WAITING_CUSTOMER (MSG-FE20-20) · AF3 Trả về hàng đợi (lý do) → chưa giao, giữ trạng thái (MSG-FE20-20) · AF4 CS không khả dụng → tự về hàng đợi.
E1 đã có người nhận → MSG-COM-05, làm mới hàng đợi · E2 không phải CS phụ trách → MSG-FE20-09 · E3 thiếu lý do → MSG-COM-06 · E4 CLOSED → MSG-FE20-06.

### UC-FE20-08 / 09 Trả lời / ghi chú
Nhập ≤ 3.000 → **Gửi** (MSG-FE20-02) / **Thêm ghi chú** (MSG-FE20-10, chỉ CS thấy).

### UC-FE20-10 Ghi kết quả
Hộp thoại nội dung → **Ghi kết quả giải quyết** → kiểm phụ trách, trạng thái (OPEN / IN_PROGRESS / WAITING), không yêu cầu OPEN, version → lưu phiên bản, RESOLVED, vô hiệu xác nhận cũ → thông báo Owner; MSG-FE20-11.
E1 có yêu cầu OPEN → MSG-FE20-12 (nút tắt) · E2 trống → MSG-COM-06 · E3 không phụ trách → MSG-FE20-09 · E4 đã đổi → MSG-COM-05.

### UC-FE20-11 Đóng ticket
Popup: điều kiện + trạng thái, nội dung xác nhận của Owner, ghi chú đóng (tùy chọn) → tick → **Đóng ticket** → kiểm lại → CLOSED + lịch sử đóng (phiên bản, xác nhận, CS, thời điểm) → thông báo Owner; MSG-FE20-14.
E1 chưa xác nhận → MSG-FE20-13 · E2 yêu cầu OPEN → MSG-FE20-12 · E3 chưa tick → MSG-COM-16 · E4 đã mở lại / đổi → MSG-COM-05.

### UC-FE20-12 Yêu cầu nội bộ
1. **Tạo yêu cầu** → chọn vai trò. 2. Danh sách nhân sự khả dụng → chọn người nhận, câu hỏi, ngữ cảnh phù hợp vai trò. 3. **Gửi**. 4. Kiểm phụ trách, trạng thái ticket, 1 OPEN / vai trò, vai trò hiện tại của người nhận. 5. Lưu + lịch sử; thông báo người nhận. 6. MSG-FE20-15; ticket hiện yêu cầu OPEN.
AF1 Đổi người nhận (lý do) → MSG-FE20-17 · AF2 Hủy (lý do) → CANCELLED, MSG-FE20-17.
E1 đã có OPEN → MSG-FE20-16 · E2 ticket sai trạng thái → MSG-COM-05 · E3 người nhận không còn khả dụng → MSG-COM-08 · E4 thiếu → MSG-COM-06 · E5 không phụ trách → MSG-FE20-09.

### UC-FE20-13 PM / SA xử lý
1. SCR-69: mã, ticket + trại, từ CS, thời điểm, trạng thái, câu hỏi + link ngữ cảnh. 2. **Mở chức năng liên quan** (ví dụ UC-FE19-06, UC-FE02-05, UC-FE03-08) và làm tại đó. 3. Chọn kết quả, viết kết quả đã làm sạch, chọn tham chiếu (khi PERFORMED). 4. **Gửi kết quả & đánh dấu DONE**. 5. Kiểm người nhận, trạng thái, version, tham chiếu hợp lệ. 6. DONE + lịch sử; thông báo CS; MSG-FE20-18.
AF1 UNABLE / OUTSIDE_DOMAIN → nhập lý do, không cần tham chiếu · AF2 lỗi lưu DONE → thử lại cùng tham chiếu.
E1 đã đổi người / hủy → MSG-FE20-19, mất quyền · E2 thiếu → MSG-COM-06 · E3 PERFORMED không có tham chiếu hợp lệ → MSG-COM-08.

---

## 6. Màn hình và trường

### SCR-64 Ticket của tôi (Owner)

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | New request / Gửi yêu cầu mới | Nút | SCR-65 |
| 2 | Search / Tìm | Ô chữ | Mã hoặc tiêu đề |
| 3 | Category / Nhóm | Dropdown | — |
| 4 | Period / Khoảng | Khoảng ngày cập nhật | MSG-COM-11 |
| 5 | Tabs | Tab có số | Tất cả, Đang xử lý (OPEN + IN_PROGRESS), Chờ bạn (WAITING_CUSTOMER), Đã giải quyết, Đã đóng |
| 6 | Code, Subject, Category, Farm, Status, Updated | Cột | Sắp theo cập nhật; "Đã giải quyết · chờ bạn xác nhận" khi RESOLVED chưa xác nhận; chọn dòng → SCR-66 |

### SCR-65 Tạo ticket

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Category / Nhóm | Dropdown | * | 5 giá trị §3.1 | MSG-COM-06 |
| 2 | Scope / Phạm vi | Radio | * | Trại / Vấn đề tài khoản (không trại) | MSG-COM-06 |
| 3 | Related farm / Trại liên quan | Dropdown | * khi Trại | Trại người yêu cầu sở hữu | MSG-COM-06, MSG-COM-01 |
| 4 | Subject / Tiêu đề | Ô chữ | * | ≤ 150 | MSG-COM-06, MSG-COM-10 |
| 5 | Description / Mô tả | Ô chữ dài | * | ≤ 3.000 | MSG-COM-06, MSG-COM-10 |
| 6 | Cancel / Submit ticket | Nút | — | Thành công: hộp MSG-FE20-01 (trạng thái OPEN, ưu tiên, nhóm, phạm vi, "Xem ticket" → SCR-66) | MSG-COM-02 |

### SCR-66 Chi tiết ticket – Owner

| # | Trường | Loại | Nội dung / Lỗi |
|---|---|---|---|
| 1 | Header | Chỉ đọc | Mã · tiêu đề; nhóm · trại · ngày tạo; huy hiệu trạng thái |
| 2 | Messages / Hội thoại | Danh sách phân trang | Chỉ PUBLIC: người viết ("bạn" / tên CS), thời điểm, nội dung; tải 20 tin mới nhất, "Xem trao đổi trước" tải thêm 20 tin bằng con trỏ; vùng hội thoại cuộn riêng |
| 3 | Resolution card / Kết quả giải quyết | Thẻ | Phiên bản, CS, thời điểm, nội dung của kết quả mới nhất |
| 4 | Confirm resolved / Xác nhận đã giải quyết | Nút (RESOLVED) | MSG-FE20-03; phiên bản mới MSG-FE20-05 |
| 5 | Reopen with reason / Mở lại kèm lý do | Nút (RESOLVED) | Hộp thoại Lý do * (≤ 1.000); MSG-FE20-04 |
| 6 | Write a public reply / Trả lời | Ô chữ dài | ≤ 3.000; "Gửi" (MSG-FE20-02); CLOSED → MSG-FE20-06 |
| 7 | Ticket information | Chỉ đọc | Trạng thái, CS phụ trách, nhóm, ưu tiên, trại, cập nhật |
| 8 | Status history / Lịch sử trạng thái | Bảng | Thời điểm / trạng thái |

### SCR-67 Hàng đợi ticket (CS)

| # | Trường | Nội dung |
|---|---|---|
| 1 | Search | Tên người yêu cầu, mã, tiêu đề |
| 2 | Filters | Trại, CS phụ trách (Tất cả / Chưa giao / Không khả dụng), Nhóm, Ưu tiên |
| 3 | Summary tiles | Chưa giao, Của tôi, Chờ khách, Đã giải quyết – chờ xác nhận |
| 4 | Tabs | Tất cả, Chưa giao, Của tôi, Chờ, Đã giải quyết |
| 5 | Ticket, Subject, Owner · farm, Category, Priority, Status, Assigned | Cột; sắp theo ưu tiên và cập nhật |
| 6 | Action | "Nhận" (chưa giao, MSG-FE20-07) / "Mở" (SCR-68) |
| 7 | Needs attention / Cần chú ý | Ticket có CS không còn khả dụng + "Nhận" |

### SCR-68 Xử lý ticket (CS)

| # | Trường | Loại | Bắt buộc | Ràng buộc / Lỗi |
|---|---|---|---|---|
| 1 | Header | Chỉ đọc | — | Mã · tiêu đề; Owner · trại · nhóm; CS khác thấy chỉ đọc + "Nhận" khi được phép |
| 2 | Hand over / Bàn giao | Hộp thoại | * CS khả dụng, * Lý do | MSG-FE20-08 |
| 3 | Record resolution / Ghi kết quả | Hộp thoại | * Nội dung ≤ 3.000 | Tắt khi có yêu cầu OPEN (MSG-FE20-12); MSG-FE20-11 |
| 4 | Close ticket / Đóng ticket | Nút (RESOLVED) | — | Popup Đóng ticket |
| 5 | Tabs | Tab | — | Hội thoại công khai, Ghi chú nội bộ CS, Lịch sử; tải 20 tin mới nhất, "Xem trao đổi trước" tải thêm 20 tin bằng con trỏ; vùng hội thoại cuộn riêng |
| 6 | Public reply / Trả lời công khai | Ô chữ dài | — | ≤ 3.000; MSG-FE20-02 |
| 7 | Internal note / Ghi chú nội bộ | Ô chữ dài | — | ≤ 3.000; MSG-FE20-10; chỉ CS thấy |
| 8 | Status / Trạng thái | Huy hiệu + nút | — | "Hỏi khách" (→ WAITING_CUSTOMER), "Trả về hàng đợi" (lý do *); MSG-FE20-20 |
| 9 | Category / Nhóm | Dropdown | — | Như SCR-65; MSG-COM-09 |
| 10 | Priority / Ưu tiên | Dropdown | — | LOW / NORMAL / HIGH; MSG-COM-09 |
| 11 | Assigned CS | Chỉ đọc | — | "bạn" |
| 12 | Internal request list | Danh sách | — | Mã → người nhận (vai trò, tên), trạng thái, câu hỏi |
| 13 | Create request for PM / SA | Hộp thoại | * Vai trò, * Người nhận, * Câu hỏi ≤ 2.000; Ngữ cảnh theo vai trò | MSG-FE20-15 / MSG-FE20-16 / MSG-COM-08 |
| 14 | Change recipient / Cancel request | Nút (OPEN) | * Lý do | MSG-FE20-17 |
| 15 | Request result | Chỉ đọc | — | Kết quả + nội dung đã làm sạch của yêu cầu DONE |

### Popup Đóng ticket

| # | Trường | Loại | Bắt buộc | Nội dung |
|---|---|---|---|---|
| 1 | Closing conditions / Điều kiện đóng | Checklist chỉ đọc | — | RESOLVED (phiên bản, thời điểm); không có yêu cầu OPEN; Owner đã xác nhận phiên bản này (thời điểm). Chưa đạt → nút tắt (MSG-FE20-13 / MSG-FE20-12) |
| 2 | Owner confirmation / Xác nhận của Owner | Chỉ đọc | — | Nội dung + thời điểm |
| 3 | Closing note / Ghi chú đóng | Ô chữ | — | ≤ 500 |
| 4 | Tôi đã xem xác nhận của Owner và đồng ý đóng ticket | Checkbox | * | MSG-COM-16 |
| 5 | Cancel / Close ticket | Nút | — | MSG-FE20-14 |

### SCR-69 Yêu cầu nội bộ được giao (PM / SA)

| # | Trường | Loại | Bắt buộc | Nội dung / Lỗi |
|---|---|---|---|---|
| 1 | Tabs | Tab có số | — | OPEN, DONE, Đã hủy |
| 2 | Request, Status, Ticket · farm, From | Cột | — | Mã · tiêu đề; trạng thái; mã ticket + trại; tên CS + thời điểm |
| 3 | Question from CS / Câu hỏi | Chỉ đọc | — | — |
| 4 | Domain links / Link nghiệp vụ | Chỉ đọc | — | Tham chiếu được phép (ví dụ thanh toán BCF7K2Q9, trại, email tài khoản che) |
| 5 | Open related function / Mở chức năng liên quan | Nút | — | "Mở đối soát" (PM), "Mở tài khoản" (SA) |
| 6 | Outcome / Kết quả | Radio | * | Đã thực hiện / Không thực hiện được / Ngoài phạm vi |
| 7 | Result / Nội dung kết quả | Ô chữ dài | * | ≤ 2.000; chỉ CS phụ trách thấy |
| 8 | Domain result reference / Tham chiếu kết quả | Chọn | * khi Đã thực hiện | Thay đổi đã commit; MSG-COM-08 |
| 9 | Send result & mark DONE | Nút | — | MSG-FE20-18; MSG-FE20-19 |
| 10 | Request history | Bảng | — | Tạo, đổi người nhận, hủy, hoàn thành |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Owner: danh sách | `q, category, tab, from, to, page, size` | `Page {counts{tab}, items[{code, subject, category, farm, status, awaitingAck, updatedAt}]}` | COM-11 | `GET /api/support/tickets` |
| A2 | Owner: tạo | `Create {category, scope, farmId?, subject, description}` + `Idempotency-Key` | `Ticket` | COM-06, COM-01, COM-10, COM-02 | `POST /api/support/tickets` |
| A3 | Owner: chi tiết | — | `Ticket {…, messages[PUBLIC] (20 mới nhất), messagesBeforeId, messagesHasMore, latestResolution{version, by, at, text}, acknowledged, history[], version}` | COM-08 | `GET /api/support/tickets/{id}` |
| A3a | Owner: hội thoại cũ | `beforeId, size` (1–100; mặc định 20) | `MessagePage {items[PUBLIC], nextBeforeId, hasMore}` | COM-08, COM-10 | `GET /api/support/tickets/{id}/messages` |
| A4 | Owner: trả lời | `Reply {content, version}` + `Idempotency-Key` | `Ticket` | FE20-06, COM-06 | `POST /api/support/tickets/{id}/replies` |
| A5 | Owner: xác nhận | `Acknowledge {resolutionVersion, comment?}` + `Idempotency-Key` | `Ticket` | FE20-05, COM-05 | `POST /api/support/tickets/{id}/acknowledgments` |
| A6 | Owner: mở lại | `Reopen {reason, resolutionVersion, version}` + `Idempotency-Key` | `Ticket` | COM-06, FE20-06, COM-05 | `POST /api/support/tickets/{id}/reopen` |
| A7 | CS: hàng đợi | `q, category, tab, from, to, page, size, farmId, priority, assignee` | `Page {tiles, items[], needsAttention[]}` | — | `GET /api/platform/support/tickets` |
| A8 | CS: chi tiết | — | `Ticket` + 20 `messages` mới nhất (PUBLIC + CS_ONLY) + `messagesBeforeId`, `messagesHasMore` + `internalRequests[]` | — | `GET /api/platform/support/tickets/{id}` |
| A8a | CS: hội thoại cũ | `beforeId, size` (1–100; mặc định 20) | `MessagePage {items[PUBLIC + CS_ONLY], nextBeforeId, hasMore}` | COM-08, COM-10 | `GET /api/platform/support/tickets/{id}/messages` |
| A9 | CS: nhận / bàn giao / hỏi khách / trả về / đổi nhóm, ưu tiên | `Processing {action: CLAIM \| HANDOVER \| ASK_CUSTOMER \| RELEASE \| CLASSIFY, toCsId?, reason?, category?, priority?, version}` + `Idempotency-Key` | `Ticket` | COM-05, FE20-09, COM-06, FE20-06 | `POST /api/platform/support/tickets/{id}/processing` |
| A10 | CS: trả lời / ghi chú | `Reply {content}` + `Idempotency-Key` | `Ticket` | FE20-09, COM-06 | `POST …/{id}/replies` · `POST …/{id}/internal-notes` |
| A11 | CS: ghi kết quả | `Resolution {text, version}` + `Idempotency-Key` | `Ticket` | FE20-12, COM-06, FE20-09, COM-05 | `POST …/{id}/resolutions` |
| A12 | CS: đóng | `Close {reviewedAck: true, note?, version}` + `Idempotency-Key` | `Ticket` | FE20-13, FE20-12, COM-16, COM-05 | `POST …/{id}/close` |
| A13 | CS: người nhận khả dụng | `role` | `[{id, name, role}]` | — | `GET /api/platform/support/recipients` |
| A14 | CS: tạo yêu cầu nội bộ | `InternalCreate {targetRole, recipientId, question, contextRefs[]}` + `Idempotency-Key` | `InternalView` | FE20-16, COM-05, COM-08, COM-06, FE20-09 | `POST …/{id}/internal-requests` |
| A15 | CS: đổi người nhận / hủy | `InternalManage {action: REASSIGN \| CANCEL, recipientId?, reason, version}` + `Idempotency-Key` | `InternalView` | COM-06, COM-08, COM-05 | `POST /api/platform/support/tickets/{ticketId}/internal-requests/{id}/management` |
| A16 | PM / SA: danh sách / chi tiết | `state` / — | `[InternalView]` / `InternalView` (không có hội thoại, ghi chú) | FE20-19 | `GET /api/platform/internal-requests` · `GET …/{id}` |
| A17 | PM / SA: kết quả nghiệp vụ chọn được | — | `[{ref, type, summary, committedAt}]` | — | `GET …/internal-requests/{id}/domain-results` |
| A18 | PM / SA: hoàn thành | `Complete {outcome, result, domainRef?, version}` + `Idempotency-Key` | `InternalView` | COM-06, COM-08, FE20-19 | `POST …/internal-requests/{id}/completion` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE20-01 | Hộp thoại | Đã gửi ticket {code}. Bộ phận hỗ trợ sẽ trả lời trong ticket. |
| MSG-FE20-02 | Toast thành công | Đã gửi trả lời. |
| MSG-FE20-03 | Toast thành công | Cảm ơn bạn. Đã ghi nhận xác nhận cho kết quả giải quyết phiên bản {version}. |
| MSG-FE20-04 | Toast thành công | Đã mở lại ticket {code}. |
| MSG-FE20-05 | Hộp thoại | Ticket có kết quả giải quyết mới hơn bản bạn đang xem. [Tải lại ticket] |
| MSG-FE20-06 | Banner | Ticket đã đóng và chỉ xem. Hãy tạo ticket mới nếu cần hỗ trợ thêm. |
| MSG-FE20-07 | Toast thành công | Bạn đang phụ trách {code}. |
| MSG-FE20-08 | Toast thành công | Đã bàn giao {code} cho {cs}. |
| MSG-FE20-09 | Trên trang | Chỉ CS phụ trách mới thay đổi được ticket này. [Nhận] |
| MSG-FE20-10 | Toast thành công | Đã thêm ghi chú nội bộ (chỉ CS thấy). |
| MSG-FE20-11 | Toast thành công | Đã ghi kết quả giải quyết phiên bản {version}. Chủ trại đã được thông báo. |
| MSG-FE20-12 | Trong panel | Yêu cầu nội bộ {request} vẫn đang mở. Chưa thể giải quyết hoặc đóng ticket. |
| MSG-FE20-13 | Trong hộp thoại | Chủ trại chưa xác nhận kết quả giải quyết phiên bản {version}. |
| MSG-FE20-14 | Toast thành công | Đã đóng ticket {code}. |
| MSG-FE20-15 | Toast thành công | Đã gửi yêu cầu nội bộ {request} cho {recipient}. |
| MSG-FE20-16 | Trong hộp thoại | Ticket đã có yêu cầu nội bộ đang mở gửi {role}. |
| MSG-FE20-17 | Toast thành công | Yêu cầu nội bộ {request} đã được {action}. |
| MSG-FE20-18 | Toast thành công | Đã gửi kết quả của {request} cho {cs}. |
| MSG-FE20-19 | Banner | Yêu cầu này không còn được giao cho bạn. |
| MSG-FE20-20 | Toast thành công | Ticket {code} chuyển sang {status}. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-20-01 | Manager / CS | Gọi A2 | 403 | H | R-20-01 |
| TC-20-02 | Owner trại SUSPENDED | Tạo ticket nhóm FARM_SERVICE | OPEN, NORMAL, TK-nnnn, tin PUBLIC đầu = mô tả; CS nhận thông báo | I | R-20-01 |
| TC-20-03 | Phạm vi Trại, trại của người khác | Tạo | MSG-COM-01 | I, H | UC-01 E2 |
| TC-20-04 | Tiêu đề 151 ký tự / mô tả trống | Tạo | MSG-COM-10 / MSG-COM-06 | U | §3.1 |
| TC-20-05 | Owner A | Gọi A3 ticket của Owner B | 404 / 403 | H | R-20-10 |
| TC-20-06 | Ticket có ghi chú nội bộ | Owner xem | Không có ghi chú, không có yêu cầu nội bộ | I | R-20-10 |
| TC-20-07 | 2 CS cùng nhận 1 ticket | Đồng thời | 1 thành công; người kia MSG-COM-05 | I | R-20-03 |
| TC-20-08 | CS B (không phụ trách) | Trả lời / đổi trạng thái | MSG-FE20-09 | I, H | R-20-02 |
| TC-20-09 | Bàn giao không lý do | Lưu | MSG-COM-06 | U, H | R-20-03 |
| TC-20-10 | SA thu hồi quyền CS đang phụ trách | — | Ticket về hàng đợi, giữ trạng thái; hiện ở "Cần chú ý" | I | R-20-03 |
| TC-20-11 | WAITING_CUSTOMER | Owner trả lời | IN_PROGRESS | I | R-20-04 |
| TC-20-12 | RESOLVED | Owner trả lời công khai | Vẫn RESOLVED | I | R-20-04 |
| TC-20-13 | Có IR OPEN cho PM | Tạo IR thứ 2 cho PM | MSG-FE20-16; IR cho SA vẫn tạo được | I | R-20-05 |
| TC-20-14 | Ticket OPEN (chưa nhận) | Tạo IR | MSG-COM-05 | I | R-20-05 |
| TC-20-15 | IR OPEN | Ghi kết quả / đóng | MSG-FE20-12 | I, E | R-20-06 |
| TC-20-16 | PM người nhận | Xem IR | Không thấy hội thoại, ghi chú CS | H | R-20-06 |
| TC-20-17 | IR đổi người nhận từ PM1 sang PM2 | PM1 mở | MSG-FE20-19; mất quyền | I | R-20-05 |
| TC-20-18 | PERFORMED không có tham chiếu | Hoàn thành | MSG-COM-08 | I | R-20-07 |
| TC-20-19 | IR DONE | — | Ticket không đổi trạng thái | I | R-20-06 |
| TC-20-20 | RESOLVED v1, Owner xác nhận v1, CS ghi v2 | Đóng | MSG-FE20-13 (v2 chưa xác nhận) | I | R-20-08, R-20-09 |
| TC-20-21 | Owner đang xem v1, đã có v2 | Xác nhận | MSG-FE20-05 | I | UC-04 E1 |
| TC-20-22 | Xác nhận 2 lần | — | 1 xác nhận | I | UC-04 AF1 |
| TC-20-23 | RESOLVED, đã xác nhận | Owner mở lại có lý do | OPEN, cùng CS, xác nhận SUPERSEDED, lý do là tin PUBLIC | I | R-20-08 |
| TC-20-24 | Đủ điều kiện, chưa tick | Đóng | MSG-COM-16 | U, E | R-20-09 |
| TC-20-25 | Đủ điều kiện, đã tick | Đóng | CLOSED; lịch sử đóng; thông báo Owner; audit | I | R-20-09, R-20-11 |
| TC-20-26 | RESOLVED nhiều ngày, Owner không phản hồi | — | **Không** tự đóng | I | R-20-09 |
| TC-20-27 | CLOSED | Owner trả lời / mở lại | MSG-FE20-06 | I | R-20-04 |
| TC-20-28 | Gửi lại cùng Idempotency-Key khi tạo ticket | — | 1 ticket | I | R-20-12 |
| TC-20-29 | Ticket có 25 tin PUBLIC và ghi chú CS_ONLY | Owner / CS mở chi tiết rồi tải trang trước | Chi tiết có 20 tin mới nhất; Owner chỉ nhận PUBLIC; CS nhận cả PUBLIC + CS_ONLY; trang trước không trùng / không mất tin | U, I, H | SCR-66, SCR-68, R-20-10 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Độ dài lý do bàn giao / trả về hàng đợi / đổi người nhận / hủy IR | ≤ 1.000 |
| Q2 | Ghi chú tùy chọn khi Owner xác nhận – UI chưa có trường | Thêm ô "Nhận xét" (≤ 1.000) tùy chọn |
| Q3 | UC-FE20-02, 03, 06, 08, 09 không có đặc tả Part II | Theo Part III + GBR |
| Q4 | Đính kèm file vào ticket? | SRS không có – ngoài phạm vi |
| Q5 | Thông báo email cho Owner khi CS trả lời? | Chỉ thông báo trong app (FE-14) trừ khi SRS bổ sung |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho LamKD duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 09/11/2026 | 28/10/2026 | Bổ sung phân trang hội thoại chi tiết Owner/CS theo con trỏ, 20 tin mỗi lượt và vùng cuộn riêng để trang không kéo dài vô hạn | Codex |
