# SPEC FE-20 – Hỗ trợ khách hàng (ticket)

| | |
|---|---|
| Feature | FE-20 Customer Support Ticket Management |
| Use case | UC-FE20-01 → UC-FE20-13 |
| Người phụ trách | LamKD (BE + FE + test) · Review BE: DucNV · Review FE: AnNT |
| Nguồn tham chiếu | SRS 28/10/2026/D12 là baseline lịch sử; `REQUIREMENT_DECISIONS.md` và code hiện tại là evidence. |
| Trạng thái | **AS-BUILT — 25/11/2026.** §0 là luồng triển khai hiện hành và là phần duy nhất dùng để đối chiếu code/test. Các mục cũ §1–12 còn giữ làm proposal lịch sử, không được dùng làm contract triển khai. |

> **Quy tắc đọc tài liệu từ 25/11/2026:** nếu §0 khác bất kỳ nội dung nào ở §1–12, §0 thắng. §1–12 có nhiều giả định target (supplement, deadline, evidence workflow, context selector…) chưa được code; không được coi chúng là hành vi hiện hữu. Khi mở phase mới, tách proposal đó thành spec/version mới thay vì trộn với luồng đang chạy.

---

## 0. Luồng triển khai hiện hành (as-built)

### 0.1 Phạm vi đã có và chưa có

| Nội dung | Trạng thái hiện tại |
|---|---|
| Owner tạo ticket | Có. Form chỉ có **Danh mục, Tiêu đề, Mô tả**; ticket luôn gắn với trang trại đang mở. Owner không chọn scope, trại hoặc ưu tiên. |
| Tệp ở form tạo ticket | Có nút chọn PDF/JPEG/PNG để hiển thị danh sách file đã chọn ở giao diện; **chưa có upload/persistence/API attachment trong command tạo ticket**. Không được ghi là evidence đã được lưu hay PM/SA đã nhận file. |
| Chat Owner ↔ CS | Có tin PUBLIC, tối đa 3.000 ký tự, lịch sử tải thêm theo cursor. Chưa có payload/API lưu tệp đính kèm trong chat. |
| CS ghi chú nội bộ | Có; chỉ CS thấy, tối đa 3.000 ký tự. Lịch sử hiển thị tên actor thực tế. |
| CS yêu cầu Owner bổ sung | Backend còn command `ASK_CUSTOMER`, nhưng CTA đã bị bỏ khỏi workspace CS. Luồng nghiệp vụ đang dùng là trao đổi PUBLIC trong chat, không phải một form supplement riêng. |
| Priority | Ticket mới hiện được backend gán `NORMAL`; chỉ CS phụ trách sửa category/priority. Owner **chưa** có command/UI sửa priority. Quyết định D58 về Owner sửa priority vẫn là future work. |
| Evidence/deadline/supplement | Chưa triển khai contract/upload/scan/deadline. D58 là quyết định product chưa biến thành hành vi hệ thống. |
| IR gửi PM/SA | Có text request, named recipient, kết quả text và lịch sử. Không có attachment selection, context selector, deep-link hoặc tra soát nhúng. |

### 0.2 Dữ liệu và phạm vi ticket

| Trường | Hành vi hiện tại |
|---|---|
| Mã | `TK-…`, hệ thống tạo. |
| Người gửi | Owner tạo ticket; không đổi. |
| Danh mục | `ACCOUNT_ACCESS`, `PAYMENT`, `FARM_SERVICE`, `SYSTEM_USAGE`, `OTHER`. |
| Trại | Form Owner lấy trại đang mở và gửi `scope=FARM`; không hiển thị control chọn/đổi trại. Backend vẫn kiểm ma trận category/scope khi nhận API. |
| Tiêu đề / mô tả | Bắt buộc; tối đa 150 / 3.000 ký tự. Mô tả tạo tin PUBLIC đầu tiên. |
| Ưu tiên | `LOW`, `NORMAL`, `HIGH`; ticket mới `NORMAL`, CS phụ trách mới sửa. |
| Trạng thái | `OPEN → IN_PROGRESS → RESOLVED → CLOSED`; command legacy có thể đưa `IN_PROGRESS ↔ WAITING_CUSTOMER`. Owner trả lời khi `WAITING_CUSTOMER` đưa ticket về `IN_PROGRESS`; UI hiện không mở action “yêu cầu bổ sung” riêng. |
| Version | Mọi mutation dùng optimistic version; conflict yêu cầu tải lại. |

### 0.3 Luồng Owner

1. Owner đang ở một trang trại bấm **Gửi yêu cầu hỗ trợ**, chọn danh mục, nhập tiêu đề/mô tả và có thể chọn tệp PDF/JPEG/PNG ở UI.
2. Hệ thống tạo ticket `OPEN`, priority `NORMAL`, PUBLIC opening message và lịch sử. Tệp được chọn chưa được gửi/lưu bởi API hiện tại.
3. Trang chi tiết Owner có hai cột: trái là chat PUBLIC cố định chiều cao; phải là thông tin ticket và lịch sử trạng thái có cuộn/phân trang. Owner chỉ thấy tin PUBLIC và nhãn CS chung “Nhân viên hỗ trợ”.
4. Khi CS ghi kết quả, Owner mở popup **Kết quả giải quyết** để xem bảng các phiên kết quả, rồi xác nhận phiên mới nhất hoặc mở lại bằng lý do.
5. Xác nhận không tự đóng ticket. Ticket chỉ `CLOSED` sau khi CS phụ trách review xác nhận và bấm đóng. Ticket đóng là chỉ đọc; Owner muốn hỗ trợ mới thì tạo ticket mới.

### 0.4 Luồng CS

1. CS xem hàng đợi chưa đóng. Bộ lọc tách nhãn/giá trị: tìm kiếm, trang trại, người phụ trách, danh mục, ưu tiên. Hàng đợi sắp ticket chưa có người nhận trước, sau đó priority và thời gian tạo.
2. CS nhận ticket chưa giao hoặc ticket có CS cũ không còn khả dụng. `OPEN` đổi sang `IN_PROGRESS`; ticket `RESOLVED` giữ trạng thái khi nhận lại.
3. Chỉ CS đang phụ trách và còn khả dụng được chat, thêm ghi chú nội bộ, phân loại, chuyển giao, trả về hàng đợi, tạo/hủy IR, ghi kết quả và đóng.
4. Chat PUBLIC: tin Owner ở bên trái/nền trắng; tin CS ở bên phải/nền xanh, tên hiển thị “Nhân viên hỗ trợ”. Ghi chú nội bộ hiển thị tên thật của người viết, không xuất hiện ở Owner/PM/SA.
5. CS sửa danh mục/ưu tiên trong khung **Trạng thái**. Không có control Owner hoặc CS khác sửa trực tiếp.
6. **Trả về hàng đợi** cần lý do, bỏ CS phụ trách, giữ ticket status/history và hủy mọi IR `OPEN`/`WAITING_CS` với lý do mặc định `Hiện không có chăm sóc khách hàng hỗ trợ yêu cầu này.`
7. **Chuyển giao** cần lý do và đổi sang CS được chọn. Khi UI đổi người nhận của IR, UI hủy IR hiện tại trước; CS phải tạo IR mới cho người nhận mới. API backend có action `REASSIGN`, nhưng không phải luồng UI chính hiện tại.
8. CS ghi kết quả PUBLIC khi không còn IR active. Kết quả là phiên bản bất biến, ticket sang `RESOLVED`, Owner nhận thông báo. CS đóng sau khi Owner xác nhận phiên mới nhất và tick review; thao tác đóng cũng hủy IR active còn lại theo lý do mặc định.

### 0.5 Yêu cầu nội bộ (IR)

| Nội dung | Hành vi hiện tại |
|---|---|
| Tạo | CS phụ trách tạo `IR-…` với target role, named recipient và `requestText` ≤ 2.000 ký tự. |
| Role matrix | `ACCOUNT_ACCESS → SA`; `PAYMENT`/`FARM_SERVICE → PM`; `SYSTEM_USAGE`/`OTHER → PM hoặc SA`. |
| Số IR active | Tối đa một IR `OPEN`/`WAITING_CS` cho **mỗi ticket + target role**. Vì vậy `SYSTEM_USAGE`/`OTHER` có thể đồng thời một PM IR và một SA IR. |
| Trạng thái | `OPEN → DONE` hoặc `OPEN → WAITING_CS → OPEN`; mọi IR active cũng có thể `CANCELLED`. |
| PM/SA nhận | Danh sách theo trạng thái, có pagination; chọn dòng mở popup detail. Chỉ named recipient cùng role mở/hoàn thành được. |
| Kết quả | `CONFIRMED`, `NOT_CONFIRMED`, `NEED_MORE_INFO`, `OUT_OF_SCOPE` + `resultNote` ≤ 2.000. `NEED_MORE_INFO` đưa IR sang `WAITING_CS`; CS bổ sung clarification để về `OPEN`. Các outcome khác đưa IR sang `DONE`. |
| Boundary | PM/SA thấy request text, người gửi, user + trại hiển thị, trạng thái/lịch sử và result. Họ không thấy public conversation, CS note, dữ liệu vận hành trại, chứng từ ngân hàng chi tiết hay attachment ticket. |
| Owner | Không thấy IR hoặc kết quả IR. CS tự viết kết quả PUBLIC cho Owner. |

### 0.6 Lịch sử, actor và hiển thị

Lịch sử ticket ghi theo tên người thực hiện (`fullName`); role là metadata riêng, không thay tên. UI dịch các event kỹ thuật thành tiếng Việt: tạo ticket, nhận xử lý, chuyển giao, trả về hàng đợi, cập nhật danh mục/ưu tiên, gửi phản hồi, thêm ghi chú, tạo/hoàn thành IR, ghi kết quả, Owner xác nhận, mở lại và đóng.

### 0.7 Điều kiện không được suy diễn

- Không coi file đã chọn trong UI là attachment đã lưu/gửi; chưa có round-trip API/database cho file FE-20.
- Không coi PM/SA được tự động chia sẻ file, toàn bộ hội thoại, ghi chú nội bộ, dữ liệu ngân hàng hoặc account detail.
- Không coi deadline, reminder, expiry hay timeout là đang hoạt động.
- Không coi Owner có thể chọn/sửa priority hoặc đổi trại/scope trong UI hiện hành.
- Không thêm luồng “yêu cầu Owner bổ sung” riêng vào UI khi chưa có product/API contract mới; hiện chỉ dùng chat PUBLIC.

### 0.8 Contract/API thực tế cần giữ

| Actor | Command chính |
|---|---|
| Owner | `POST /api/support/tickets`, `/{id}/replies`, `/{id}/acknowledgments`, `/{id}/reopen`, `/{id}/messages` |
| CS | `GET /api/platform/support/tickets`, `/{id}/processing`, `/{id}/replies`, `/{id}/internal-notes`, `/{id}/resolutions`, `/{id}/close`, `/{id}/internal-requests` |
| CS quản lý IR | `POST /api/platform/support/tickets/{ticketId}/internal-requests/{irId}/management` |
| PM/SA recipient | `GET /api/platform/internal-requests`, `/{id}`, `POST /{id}/completion` |

**Kiểm chứng:** phần as-built trên được đối chiếu với `NewTicketForm.tsx`, Owner `TicketDetailPage.tsx`, CS `QueuePage.tsx`/`TicketPage.tsx`, `InternalRequestsPage.tsx`, `SupportTicketCommandService.java` và `InternalSupportRequestService.java` ở commit `9e3e232b`.

---

## Phụ lục A — Proposal/target lịch sử (không phải contract triển khai)

> Phần dưới phản ánh phương án thiết kế trước ngày 25/11/2026. Nó được giữ lại để truy vết quyết định, nhưng có thể mâu thuẫn với §0 — ví dụ scope/trại do Owner chọn, lưu/tải tệp đính kèm, yêu cầu bổ sung/hạn xử lý, Owner sửa ưu tiên và tệp của yêu cầu nội bộ. Mọi thay đổi code/test phải theo §0; khi duyệt phase mới, tạo spec/version mới rồi mới cập nhật contract, API và code.

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
| Yêu cầu nội bộ `VERIFY` | Không thấy | Xem queue metadata | Tạo / bổ sung text / đổi / hủy | Chỉ đọc request text được giao, trả kết quả xác minh |

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

### 3.4 Yêu cầu nội bộ `VERIFY`

| Thuộc tính | Ràng buộc |
|---|---|
| Mã | `IR-nnn` |
| Loại | `VERIFY` trong MVP; `PERFORM_ACTION` chưa thuộc UI/contract MVP |
| Ticket, vai trò đích (PM / SA), người nhận được nêu tên, CS tạo | Người nhận đang khả dụng với vai trò đó; matrix role theo category do server enforce |
| Nội dung yêu cầu | `requestText` ≤2.000, bắt buộc; CS ghi câu hỏi + hint tối thiểu Owner đã cung cấp |
| Hiển thị tối thiểu | Ticket code, category, farm display/null, CS gửi, thời điểm, trạng thái và attachment refs được CS chọn riêng cho IR revision; không có context selector/domain record hoặc raw attachment ngoài selection đó |
| Trạng thái | `OPEN → WAITING_CS → OPEN`, hoặc `OPEN → DONE/CANCELLED`; tối đa 1 IR active (`OPEN`/`WAITING_CS`) / ticket / role |
| Kết quả | `CONFIRMED` / `NOT_CONFIRMED` / `NEED_MORE_INFO` / `OUT_OF_SCOPE` |
| Ghi chú kết quả | `resultNote` ≤2.000, đã làm sạch; chỉ CS phụ trách thấy, **không bao giờ** cho Owner |
| Clarification | `NEED_MORE_INFO` giữ IR `WAITING_CS`; CS thêm text revision, IR về `OPEN`; không được đóng IR |
| Lịch sử | Tạo, clarification, đổi người nhận, hủy, response/complete; actor/role/time/version |
| Future mutation | Nếu sau này thêm `PERFORM_ACTION`, domain command phải lưu request ID, target, actor, before/after version và audit cùng transaction |

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-20-01 | Chỉ Owner tạo ticket, về tài khoản hoặc 1 trại mình sở hữu; ưu tiên bắt đầu NORMAL; hỗ trợ được khi trại không ACTIVE; người yêu cầu không đổi. | GBR-76, GBR-14 |
| R-20-02 | CS đọc cả hàng đợi; **chỉ CS đang phụ trách và khả dụng** thay đổi ticket chưa CLOSED (MSG-FE20-09). | GBR-77 |
| R-20-03 | Nhận và bàn giao là nguyên tử; bàn giao và trả về hàng đợi cần lý do; lưu lịch sử. CS không khả dụng → ticket về hàng đợi, giữ trạng thái. | GBR-77 |
| R-20-04 | Vòng đời: Nhận → OPEN thành IN_PROGRESS (RESOLVED giữ nguyên); Hỏi khách → WAITING_CUSTOMER; Owner trả lời khi WAITING → IN_PROGRESS; ghi kết quả → RESOLVED; Owner mở lại (lý do) → OPEN, cùng CS; trả lời công khai **không** mở lại RESOLVED; CLOSED chỉ đọc. | GBR-78 |
| R-20-05 | `VERIFY` IR: tối đa 1 active (`OPEN`/`WAITING_CS`) / ticket / role; chỉ khi ticket IN_PROGRESS / WAITING_CUSTOMER; người nhận đang khả dụng; đổi người nhận / hủy cần lý do; người nhận cũ mất quyền ngay. Người nhận mất khả dụng có `needsReassignment=true` (tính lúc đọc). | Target contract; D32 pattern |
| R-20-06 | Người nhận chỉ thấy request text + metadata tối thiểu và attachment CS chọn cho chính IR revision; không thấy hội thoại, CS note hay attachment khác; `DONE` không giải quyết/đóng ticket; IR active (`OPEN`/`WAITING_CS`) chặn resolve và close. | D58 target contract |
| R-20-07 | `CONFIRMED` chỉ là xác minh thông tin, không chứng minh mutation. `NEED_MORE_INFO` chuyển `WAITING_CS`, không DONE. `PERFORM_ACTION` future phải dùng domain command/audit provenanced; không được thay bằng result text. | Target contract |
| R-20-08 | Kết quả giải quyết là phiên bản mới bất biến; Owner xác nhận phiên bản mới nhất; phiên bản mới hoặc mở lại vô hiệu xác nhận cũ. | GBR-80 |
| R-20-09 | Đóng chỉ khi RESOLVED, Owner đã xác nhận phiên bản mới nhất (MSG-FE20-13), không có IR active (`OPEN`/`WAITING_CS`) hoặc supplement blocker, CS tick xác nhận (MSG-COM-16). **Không bao giờ** đóng do im lặng, hết giờ hay diễn giải câu chữ. | GBR-80 |
| R-20-10 | Phân tách đối tượng: Owner chỉ ticket mình + PUBLIC + supplement của mình; CS note chỉ CS; VERIFY request/result chỉ CS phụ trách và named recipient. Named PM/SA chỉ nhận attachment mà CS chọn trong IR revision; không role nào nhận raw payment/account data, public URL/storage key hay attachment ngoài IR selection. | D58 target contract |
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
Hộp thoại nội dung → **Ghi kết quả giải quyết** → kiểm phụ trách, trạng thái (OPEN / IN_PROGRESS / WAITING), không có IR active hoặc supplement blocker, version → lưu phiên bản, RESOLVED, vô hiệu xác nhận cũ → thông báo Owner; MSG-FE20-11.
E1 có IR active/supplement blocker → MSG-FE20-12 (nút tắt) · E2 trống → MSG-COM-06 · E3 không phụ trách → MSG-FE20-09 · E4 đã đổi → MSG-COM-05.

### UC-FE20-11 Đóng ticket
Popup: điều kiện + trạng thái, nội dung xác nhận của Owner, ghi chú đóng (tùy chọn) → tick → **Đóng ticket** → kiểm lại → CLOSED + lịch sử đóng (phiên bản, xác nhận, CS, thời điểm) → thông báo Owner; MSG-FE20-14.
E1 chưa xác nhận → MSG-FE20-13 · E2 IR active/supplement blocker → MSG-FE20-12 · E3 chưa tick → MSG-COM-16 · E4 đã mở lại / đổi → MSG-COM-05.

### UC-FE20-12 Yêu cầu nội bộ
1. CS phụ trách chọn **Tạo yêu cầu xác minh**. 2. Chọn vai trò đích được category cho phép và người nhận đang khả dụng. 3. Nhập `Request text` (≤ 2.000): câu hỏi nghiệp vụ và hint tối thiểu mà Owner đã cung cấp. 4. **Gửi yêu cầu**. 5. Server kiểm CS phụ trách, trạng thái ticket, matrix role, người nhận, version và tối đa 1 IR active (`OPEN`/`WAITING_CS`) mỗi ticket/vai trò. 6. Lưu IR `VERIFY` ở `OPEN`, lịch sử và thông báo người nhận; ticket có blocker IR active.
AF1 PM/SA chọn `NEED_MORE_INFO` → IR thành `WAITING_CS`; CS nhận thông báo, bổ sung clarification text rồi IR trở về `OPEN` cho cùng người nhận. AF2 Đổi người nhận (lý do) → người nhận cũ mất quyền ngay, IR vẫn active, MSG-FE20-17. AF3 Hủy (lý do) → `CANCELLED`, MSG-FE20-17.
E1 đã có IR active cùng role → MSG-FE20-16 · E2 ticket sai trạng thái → MSG-COM-05 · E3 người nhận không còn khả dụng → MSG-COM-08 · E4 thiếu `Request text` → MSG-COM-06 · E5 không phụ trách → MSG-FE20-09.

### UC-FE20-13 PM / SA xử lý
1. SCR-69 hiển thị mã IR, ticket/trại ở mức tối thiểu, người gửi, thời điểm, trạng thái, `Request text` và clarification history. 2. PM/SA tự vào màn nghiệp vụ đúng quyền của mình (FE-19 / FE-02 / FE-03) và tự tra cứu bằng thông tin trong request; FE-20 không cấp deep-link, selector hay dữ liệu domain. 3. Chọn `CONFIRMED`, `NOT_CONFIRMED`, `NEED_MORE_INFO` hoặc `OUT_OF_SCOPE`, viết `Result note` đã làm sạch. 4. **Gửi phản hồi**. 5. Server kiểm người nhận, trạng thái và version. 6. Nếu `NEED_MORE_INFO`, IR thành `WAITING_CS`; các outcome khác đưa IR thành `DONE`, lưu lịch sử và thông báo CS (MSG-FE20-18).
AF1 `NEED_MORE_INFO` → chờ CS clarification, không được DONE. AF2 lỗi gửi → thử lại cùng Idempotency-Key.
E1 đã đổi người / hủy → MSG-FE20-19, mất quyền · E2 thiếu outcome/note → MSG-COM-06 · E3 stale version → MSG-COM-05.

---

## 6. Màn hình và trường

### SCR-64 Ticket của tôi (Owner)

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | New request / Gửi yêu cầu mới | Nút | SCR-65 |
| 2 | Search / Tìm | Ô chữ | Mã hoặc tiêu đề |
| 3 | Category / Nhóm | Dropdown | — |
| 4 | Period / Khoảng | Khoảng ngày cập nhật | MSG-COM-11 |
| 5 | Tabs | Tab có số | Tất cả, Đang xử lý, Cần bạn xử lý, Đã giải quyết, Đã đóng |
| 6 | Code, Subject, Category, Farm, Status, Updated, Next action | Cột | Sắp theo cập nhật; `nextAction` do server trả; "Đã giải quyết · chờ bạn xác nhận" khi RESOLVED chưa xác nhận; chọn dòng → SCR-66 |

### SCR-65 Tạo ticket

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Category / Nhóm | Dropdown | * | 5 giá trị §3.1 | MSG-COM-06 |
| 2 | Scope / Phạm vi | Radio | * | Trại / Vấn đề tài khoản (không trại) | MSG-COM-06 |
| 3 | Related farm / Trại liên quan | Dropdown | * khi Trại | Trại người yêu cầu sở hữu | MSG-COM-06, MSG-COM-01 |
| 4 | Subject / Tiêu đề | Ô chữ | * | ≤ 150 | MSG-COM-06, MSG-COM-10 |
| 5 | Description / Mô tả | Ô chữ dài | * | ≤ 3.000 | MSG-COM-06, MSG-COM-10 |
| 6 | Cancel / Submit ticket | Nút | — | Thành công: hộp MSG-FE20-01 (trạng thái OPEN, nhóm, phạm vi, "Xem ticket" → SCR-66) | MSG-COM-02 |

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
| 3 | Summary tiles | Chưa giao, Của tôi, Chờ Owner, Chờ CS review, Chờ PM/SA, Đã giải quyết – chờ xác nhận |
| 4 | Tabs | Tất cả, Chưa giao, Của tôi, Chờ xử lý, Đã giải quyết |
| 5 | Ticket, Subject, Owner · farm, Category, Priority, Status, Work owner, Next action, Assigned | Cột; sắp theo ưu tiên và cập nhật |
| 6 | Action | "Nhận" (chưa giao, MSG-FE20-07) / "Mở" (SCR-68) |
| 7 | Needs attention / Cần chú ý | Ticket có CS không còn khả dụng + "Nhận" |

### SCR-68 Xử lý ticket (CS)

| # | Trường | Loại | Bắt buộc | Ràng buộc / Lỗi |
|---|---|---|---|---|
| 1 | Header | Chỉ đọc | — | Mã · tiêu đề; Owner · trại · nhóm; CS khác thấy chỉ đọc + "Nhận" khi được phép |
| 2 | Hand over / Bàn giao | Hộp thoại | * CS khả dụng, * Lý do | MSG-FE20-08 |
| 3 | Record resolution / Ghi kết quả | Hộp thoại | * Nội dung ≤ 3.000 | Tắt khi có IR active (`OPEN`/`WAITING_CS`) hoặc supplement blocker (MSG-FE20-12); MSG-FE20-11 |
| 4 | Close ticket / Đóng ticket | Nút (RESOLVED) | — | Popup Đóng ticket |
| 5 | Tabs | Tab | — | Hội thoại công khai, Ghi chú nội bộ CS, Lịch sử; tải 20 tin mới nhất, "Xem trao đổi trước" tải thêm 20 tin bằng con trỏ; vùng hội thoại cuộn riêng |
| 6 | Public reply / Trả lời công khai | Ô chữ dài | — | ≤ 3.000; MSG-FE20-02 |
| 7 | Internal note / Ghi chú nội bộ | Ô chữ dài | — | ≤ 3.000; MSG-FE20-10; chỉ CS thấy |
| 8 | Status / Trạng thái | Huy hiệu + nút | — | "Hỏi khách" (→ WAITING_CUSTOMER), "Trả về hàng đợi" (lý do *); MSG-FE20-20 |
| 9 | Category / Nhóm | Dropdown | — | Như SCR-65; MSG-COM-09 |
| 10 | Priority / Ưu tiên | Dropdown | — | LOW / NORMAL / HIGH; MSG-COM-09 |
| 11 | Assigned CS | Chỉ đọc | — | "bạn" |
| 12 | Internal verification list | Danh sách | — | Mã → role/người nhận, trạng thái, loại `VERIFY`, request text preview, outcome mới nhất |
| 13 | Create verification request | Hộp thoại | * Vai trò hợp lệ, * Người nhận, * Request text ≤ 2.000; evidence selection chỉ sau contract Security | Không có context selector/link/file ngoài selected READY evidence; MSG-FE20-15 / MSG-FE20-16 / MSG-COM-08 |
| 14 | Clarify / Change recipient / Cancel request | Nút (state hợp lệ) | Clarification text hoặc * Lý do | `WAITING_CS` chỉ cho clarification, reassign/cancel; MSG-FE20-17 |
| 15 | Verification result | Chỉ đọc | — | Outcome + sanitized result note; Owner không thấy |

### Popup Đóng ticket

| # | Trường | Loại | Bắt buộc | Nội dung |
|---|---|---|---|---|
| 1 | Closing conditions / Điều kiện đóng | Checklist chỉ đọc | — | RESOLVED (phiên bản, thời điểm); không có IR active hoặc supplement blocker; Owner đã xác nhận phiên bản này (thời điểm). Chưa đạt → nút tắt (MSG-FE20-13 / MSG-FE20-12) |
| 2 | Owner confirmation / Xác nhận của Owner | Chỉ đọc | — | Nội dung + thời điểm |
| 3 | Closing note / Ghi chú đóng | Ô chữ | — | ≤ 500 |
| 4 | Tôi đã xem xác nhận của Owner và đồng ý đóng ticket | Checkbox | * | MSG-COM-16 |
| 5 | Cancel / Close ticket | Nút | — | MSG-FE20-14 |

### SCR-69 Yêu cầu nội bộ được giao (PM / SA)

| # | Trường | Loại | Bắt buộc | Nội dung / Lỗi |
|---|---|---|---|---|
| 1 | Tabs | Tab có số | — | OPEN, WAITING_CS, DONE, Đã hủy |
| 2 | Request, Status, Ticket · farm, From | Cột | — | Mã IR; loại `VERIFY`; request text preview; trạng thái; mã ticket + trại tối thiểu; tên CS + thời điểm |
| 3 | Request text/evidence from CS | Chỉ đọc | — | Câu hỏi và hint tối thiểu, clarification history; chỉ selected READY evidence của IR revision, không có ticket thread/note/file khác |
| 4 | Domain lookup | Hướng dẫn chỉ đọc | — | PM/SA tự mở màn nghiệp vụ theo quyền của mình và tự tra cứu; SCR-69 không chứa deep-link, selector hoặc dữ liệu domain |
| 5 | Outcome / Kết quả | Radio | * | `CONFIRMED` / `NOT_CONFIRMED` / `NEED_MORE_INFO` / `OUT_OF_SCOPE` |
| 6 | Result note / Ghi chú kết quả | Ô chữ dài | * | ≤ 2.000; sanitized; chỉ CS phụ trách thấy |
| 7 | Send response | Nút | — | `NEED_MORE_INFO` → WAITING_CS; outcome khác → DONE; MSG-FE20-18 / MSG-FE20-19 |
| 8 | Request history | Bảng | — | Tạo, clarification, đổi người nhận, hủy, phản hồi/hoàn thành |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Owner: danh sách | `q, category, tab, from, to, page, size` | `OwnerTicketPage {counts, items: OwnerTicketRow[]}` | COM-11 | `GET /api/support/tickets` |
| A2 | Owner: tạo | `Create {category, scope, farmId?, subject, description}` + `Idempotency-Key` | `Ticket` | COM-06, COM-01, COM-10, COM-02 | `POST /api/support/tickets` |
| A3 | Owner: chi tiết | — | `Ticket {…, messages[PUBLIC] (20 mới nhất), messagesBeforeId, messagesHasMore, latestResolution{version, by, at, text}, acknowledged, history[], version}` | COM-08 | `GET /api/support/tickets/{id}` |
| A3a | Owner: hội thoại cũ | `beforeId, size` (1–100; mặc định 20) | `MessagePage {items[PUBLIC], nextBeforeId, hasMore}` | COM-08, COM-10 | `GET /api/support/tickets/{id}/messages` |
| A4 | Owner: trả lời | `Reply {content, expectedVersion}` + `Idempotency-Key` | `Ticket` | FE20-06, COM-06, COM-05 | `POST /api/support/tickets/{id}/replies` |
| A5 | Owner: xác nhận | `Acknowledge {resolutionVersion, comment?, expectedVersion}` + `Idempotency-Key`; cùng resolution/version thì no-op idempotent | `Ticket` | FE20-05, COM-05 | `POST /api/support/tickets/{id}/acknowledgments` |
| A6 | Owner: mở lại | `Reopen {reason, expectedVersion}` + `Idempotency-Key` | `Ticket` | COM-06, FE20-06, COM-05 | `POST /api/support/tickets/{id}/reopen` |
| A6a | Owner: sửa priority sau tạo | **CONTRACT PENDING D58:** exact lifecycle states, enum, expectedVersion, idempotency và audit event chưa được chốt | Không authorizes route/payload/code | — | Chưa tạo route |
| A7 | CS: hàng đợi | `q, category, tab, from, to, page, size, farmId, priority, assignee` | `CsTicketPage {tiles, items: CsTicketRow[], needsAttention[]}` | — | `GET /api/platform/support/tickets` |
| A8 | CS: chi tiết | — | `Ticket` + 20 `messages` mới nhất (PUBLIC + CS_ONLY) + `messagesBeforeId`, `messagesHasMore` + `internalRequests[]` | — | `GET /api/platform/support/tickets/{id}` |
| A8a | CS: hội thoại cũ | `beforeId, size` (1–100; mặc định 20) | `MessagePage {items[PUBLIC + CS_ONLY], nextBeforeId, hasMore}` | COM-08, COM-10 | `GET /api/platform/support/tickets/{id}/messages` |
| A9 | CS: nhận / bàn giao / hỏi khách / trả về / đổi nhóm, ưu tiên | `Processing {action: CLAIM \| HANDOVER \| ASK_CUSTOMER \| RELEASE \| CLASSIFY, recipientId?, reason?, category?, priority?, expectedVersion}` + `Idempotency-Key` | `Ticket` | COM-05, FE20-09, COM-06, FE20-06 | `POST /api/platform/support/tickets/{id}/processing` |
| A10 | CS: trả lời / ghi chú | `Reply {content, expectedVersion}` + `Idempotency-Key` | `Ticket` | FE20-09, COM-06, COM-05 | `POST …/{id}/replies` · `POST …/{id}/internal-notes` |
| A11 | CS: ghi kết quả | `Resolution {text, expectedVersion}` + `Idempotency-Key` | `Ticket` | FE20-12, COM-06, FE20-09, COM-05 | `POST …/{id}/resolutions` |
| A12 | CS: đóng | `Close {reviewedAcknowledgment: true, note?, expectedVersion}` + `Idempotency-Key` | `Ticket` | FE20-13, FE20-12, COM-16, COM-05 | `POST …/{id}/close` |
| A13 | CS: người nhận khả dụng | `role` | `[{id, name, role}]` | — | `GET /api/platform/support/recipients` |
| A14 | CS: tạo IR `VERIFY` | `InternalCreate {targetRole, recipientId, requestText, ticketVersion}` + `Idempotency-Key`; attachment selection PENDING: selected READY refs, revision binding, authorization/revoke/audit phải được §7 supplement contract chốt trước | `InternalView` | FE20-16, COM-05, COM-08, COM-06, FE20-09 | `POST …/{id}/internal-requests` |
| A15 | CS: clarification / đổi người nhận / hủy | `InternalManage {action: CLARIFY \| REASSIGN \| CANCEL, clarificationText?, recipientId?, reason?, expectedVersion}` + `Idempotency-Key` | `InternalView` | COM-06, COM-08, COM-05 | `POST /api/platform/support/tickets/{ticketId}/internal-requests/{id}/management` |
| A16 | PM / SA: danh sách / chi tiết | `state` / — | `[InternalView]` / `InternalView` gồm request text, metadata tối thiểu, clarification/history/outcome và attachment refs được CS chọn cho IR; không có hội thoại, note, context/domain data hoặc file khác | FE20-19 | `GET /api/platform/internal-requests` · `GET …/{id}` |
| A17 | PM / SA: tra cứu domain | Không có route FE-20 | PM/SA dùng route/domain screen đã được authorization riêng | — | Không thuộc FE-20 MVP |
| A18 | PM / SA: phản hồi VERIFY | `VerifyResponse {outcome, resultNote, expectedVersion}` + `Idempotency-Key` | `InternalView` (`WAITING_CS` khi NEED_MORE_INFO, `DONE` với outcome khác) | COM-06, COM-05, FE20-19 | `POST …/internal-requests/{id}/completion` |

`OwnerTicketRow` phải có: `code`, `subject`, `category`, `farmDisplay|null`, `status`, `awaitingAcknowledgment`, `updatedAt`, `nextAction`, `activeSupplementStatus|null`, `dueAt|null`. `nextAction` là allowlist do server tính từ state/bound blocker, không suy từ message body; không mang CS identity, priority, IR/result hay file metadata.

`CsTicketRow` phải có: `code`, `subject`, `ownerDisplay`, `farmDisplay|null`, `category`, `priority`, `ticketStatus`, `workOwner`, `nextAction`, `updatedAt`, `agingSeconds`, `activeSupplementStatus|null`, `activeInternalRequestStatus|null`, `assigneeAvailability`. `workOwner` là một trong `UNASSIGNED`, `CS`, `OWNER`, `PM_SA`, `OWNER_CONFIRMATION`; `nextAction` là allowlist server-side `AWAITING_CLAIM`, `OWNER_SUPPLEMENT`, `CS_REVIEW_SUPPLEMENT`, `PM_SA_VERIFY`, `OWNER_ACKNOWLEDGMENT`, hoặc `NONE`. `tiles`/`counts` phải dùng cùng predicate/filter với `items`; `needsAttention` chỉ là tập con row an toàn, không chứa nguyên nhân security hoặc dữ liệu protected.

> **Supplement contract boundary.** `CustomerSupplementRequest` ở §12 là target UX/data model, nhưng chưa có route, payload, storage/scan policy hay message catalogue được duyệt. D58 chỉ chốt hướng Product; vì D-FE20-02/03/04/06 còn Security/operational gaps, không task nào được tự tạo endpoint hoặc suy diễn JSON cho create, draft, upload, submit, review, waive, cancel, attachment selection hay download. Khi các contracts được duyệt, bổ sung nhóm Owner read/draft/submit, CS issue/review/cancel, attachment upload/scan/read và selected-attachment IR delegation trước khi sửa code.

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
| TC-20-13 | Có IR active (`OPEN` hoặc `WAITING_CS`) cho PM | Tạo IR thứ 2 cho PM | MSG-FE20-16; IR cho SA vẫn tạo được nếu matrix cho phép | I | R-20-05 |
| TC-20-14 | Ticket OPEN (chưa nhận) | Tạo IR | MSG-COM-05 | I | R-20-05 |
| TC-20-15 | IR active (`OPEN` hoặc `WAITING_CS`) hoặc supplement blocker | Ghi kết quả / đóng | MSG-FE20-12 | I, E | R-20-06 |
| TC-20-16 | PM người nhận | Xem IR | Không thấy hội thoại, ghi chú CS | H | R-20-06 |
| TC-20-17 | IR đổi người nhận từ PM1 sang PM2 | PM1 mở | MSG-FE20-19; mất quyền | I | R-20-05 |
| TC-20-18 | PM/SA chọn NEED_MORE_INFO | Gửi phản hồi | IR là WAITING_CS, không DONE; CS bổ sung clarification thì IR trở lại OPEN | I | R-20-07 |
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
| TC-20-30 | CS tạo IR VERIFY | Kiểm payload/response PM-SA | Request có targetRole, recipientId, requestText, selectedAttachmentIds theo IR revision và ticketVersion; response không contextRefs, thread, note, domain data hoặc attachment ngoài selection | U, I, H | §3.4, R-20-06 |
| TC-20-31 | PM/SA gửi CONFIRMED | Gửi phản hồi | IR DONE có resultNote/audit; ticket không tự đổi trạng thái, không có chứng cứ mutation | I | R-20-06, R-20-07 |
| TC-20-32 | PM/SA không phải người nhận hoặc IR đã reassign/cancel | Đọc/gửi phản hồi | 403/MSG-FE20-19, không lộ request content | H, I | R-20-05, R-20-10 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Độ dài lý do bàn giao / trả về hàng đợi / đổi người nhận / hủy IR | ≤ 1.000 |
| Q2 | Ghi chú tùy chọn khi Owner xác nhận – UI chưa có trường | Thêm ô "Nhận xét" (≤ 1.000) tùy chọn |
| Q3 | UC-FE20-02, 03, 06, 08, 09 không có đặc tả Part II | Theo Part III + GBR |
| Q4 | Đính kèm file vào ticket/supplement? | Ticket message vẫn text-only. Supplement dùng response text + attachment optional/required; MIME/size/count/retention chờ D-FE20-02. |
| Q5 | Thông báo email cho Owner khi CS trả lời? | Chỉ thông báo trong app (FE-14) trừ khi SRS bổ sung |

### 10.1 Khoảng cách target contract với implementation hiện tại

| Target được chốt trong draft | Evidence code/OpenAPI hiện tại | Hệ quả cho implementation/WBS |
|---|---|---|
| IR MVP là `VERIFY` text-first với `requestText`, `resultNote`, outcome `CONFIRMED` / `NOT_CONFIRMED` / `NEED_MORE_INFO` / `OUT_OF_SCOPE`, và state `WAITING_CS`. | `SupportDtos`, `InternalSupportRequestService` và `platform-support` vẫn dùng `question`, `result`, `PERFORMED` / `UNABLE` / `OUTSIDE_DOMAIN`, `context`, `domainResultAuditId`; không có `WAITING_CS` hay clarification command. | Đây là thay đổi contract có chủ ý, không phải mapping nhỏ. Chỉ sửa sau khi Product/Security duyệt target và OpenAPI/DTO/migration/FE được thay cùng một lát cắt. |
| PM/SA không nhận context selector, deep-link, domain data hoặc attachment ngoài selection do CS gắn vào IR revision. | `InternalCreate.context`, `InternalView.context`, `contextOptions` và endpoint `domain-results` đang tồn tại. | Phải loại/retire dữ liệu theo migration-safe plan, thêm selected-attachment authorization/audit/revoke và kiểm cache/idempotency; không chỉ ẩn control ở UI. |
| Supplement là structured work item riêng, có revision, upload quarantine/scan, review và blocker. | Chưa có entity, route, persistence, storage/scan integration hay message catalogue cho supplement. | Chưa implementation-ready: hoàn tất D-FE20-02/03/06 và contract group nêu ở §7 trước, rồi mới tách WBS/code/test. |
| Category-to-role matrix được server enforce; `SYSTEM_USAGE`/`OTHER` để CS phụ trách chọn PM hoặc SA. | Code chỉ kiểm recipient PM/SA, không có matrix theo category. | Implement matrix đã chốt: `ACCOUNT_ACCESS → SA`, `PAYMENT/FARM_SERVICE → PM`, `SYSTEM_USAGE/OTHER → PM hoặc SA` do CS chọn; không dùng fallback UI. |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho LamKD duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 09/11/2026 | 28/10/2026 | Bổ sung phân trang hội thoại chi tiết Owner/CS theo con trỏ, 20 tin mỗi lượt và vùng cuộn riêng để trang không kéo dài vô hạn | Codex |
| 14/11/2026 | 28/10/2026 | `InternalView.needsReassignment` và ghi chú trên SCR-68 cho yêu cầu OPEN có người nhận bị tạm ngưng / mất vai trò; phiếu của CS bị tạm ngưng về hàng đợi ngay trong lệnh tạm ngưng (UC-FE03-08, D32) | DucNV / Claude |
| 23/11/2026 | DRAFT Product/Contract | Thêm §12: boundary Owner/CS/PM/SA, supplement structured, field minimization và stability/acceptance criteria; chờ phê duyệt trước khi sửa SRS/implementation | Codex + 2 Luna audits |
| 23/11/2026 | DRAFT Product/Contract | Thống nhất §12 theo review logic + nghiên cứu hệ thống support: MVP IR là `VERIFY` text-first, PM/SA tự tra cứu ở domain screen, `NEED_MORE_INFO` giữ vòng lặp CS; `PERFORM_ACTION` tách thành nhánh future có audit/provenance | Codex + Luna critique/research |
| 24/11/2026 | DRAFT Product/Contract | Đồng bộ toàn bộ mục 1–12 theo cùng contract: use case, screen, route/payload, test và blocker đều dùng IR `VERIFY` text-first + `WAITING_CS`; loại bỏ deep-link/context/domain-result của MVP; rà soát 2 lượt bằng transition, payload và boundary dữ liệu | Codex |
| 24/11/2026 | DRAFT Product/Contract | Hai lượt self-review và Luna read-only review: chuẩn hóa optimistic-lock payload, row schema server-authoritative, supplement blocker lifecycle và pre-WBS gate. D-FE20-01 → 06 vẫn là chặn Product/Security; chưa có code/test code. | Codex + Luna Review |

---

## 12. Bổ sung tài liệu có cấu trúc và dữ liệu tối thiểu theo vai trò

> Mục này giải thích chi tiết field, boundary, UI và contract của cùng target spec. Nó không tự sửa SRS 28/10, không backfill `QUESTION` cũ, và không cho phép mở rộng quyền chỉ bằng thay UI. Khi được duyệt, source-of-truth liên quan phải được cập nhật cùng màn/API/test.

### 12.1 Mục tiêu và phi mục tiêu

**Mục tiêu.** Khi CS cần Owner cung cấp thông tin/tài liệu, hệ thống phải tạo một yêu cầu có identity, hướng dẫn text, phản hồi text + bằng chứng đính kèm, revision, review và audit riêng — không dùng message chat làm bằng chứng. Mỗi role chỉ thấy dữ liệu cần để làm bước kế tiếp:

1. Owner biết **cần làm gì** và chỉ nộp thông tin/tài liệu được yêu cầu.
2. CS điều phối và review supplement, nhưng không biến ticket thành nơi xem dữ liệu payment/account sâu.
3. PM/SA nhận một IR text-first, tự vào màn nghiệp vụ của mình để tra cứu; SCR-69 không chứa tra soát hay dữ liệu sâu.
4. Kết quả xác minh quay về CS dưới dạng outcome + ghi chú đã làm sạch; Owner không thấy IR/result nội bộ.

**Không làm trong MVP.** Không có generic form builder; không chia sẻ customer attachment cho PM/SA ngoài attachment được CS chọn theo đúng IR revision; không tự suy các `QUESTION`/reply cũ thành supplement; không đưa password, OTP, token, full bank account, raw account diagnostic hoặc raw audit log vào ticket/IR/notification.

### 12.2 Phân loại dữ liệu và ranh giới xem

| Lớp | Source of truth | Owner | CS phụ trách | PM / SA người nhận | Không được coi là |
|---|---|---|---|---|---|
| Ticket/public conversation | Ticket + `PUBLIC` message | Đọc/viết ticket mình | Đọc/viết | Không thấy | Bằng chứng file hoặc domain action |
| Supplement | `CustomerSupplementRequest`, request text, submission text, attachment, review | Đọc/nháp/nộp request của mình | Assignee issue/review/state mutation; mọi CS read/download theo policy D58 còn cần Security contract | Không thấy mặc định trừ attachment CS chọn trong IR | Public chat hoặc attachment chung của trại |
| CS operation | Assignment, priority, CS_ONLY note, handover reason | Không thấy | Đọc; assignee mới mutate | Không thấy | Dữ liệu public cho Owner |
| Internal verification request | IR code/type, ticket/farm display tối thiểu, request text, selected attachment refs, recipient/status/history | Không thấy | Tạo/bổ sung text/hủy/đổi người nhận/select attachment theo contract | Chỉ request được giao + selected attachment ở IR revision | Quyền tự động đọc record hoặc lời khẳng định đã mutation |
| Domain deep data | Record ở FE-19/FE-02/FE-03 | Không thấy | Không nhúng vào ticket | Đọc/action sau domain authorization | Nội dung được copy về ticket |
| Sanitized IR result | VERIFY outcome + result note + history | Không thấy | Đọc (assignee) | Đọc request của mình | Public resolution cho Owner |

Mọi GET/download/command phải authorization lại từ resource gốc. `type,id` hoặc URL không tự cấp quyền; frontend không được dùng `farmId=0`, `fromId=0`, history rỗng hay default khác để che `null`/missing data.

### 12.3 Owner: input, output và field phải loại bỏ

#### A. Owner gửi gì

| Hành động | Field bắt buộc | Field chỉ hiện khi liên quan | Không thu thập / không cho gửi mặc định |
|---|---|---|---|
| Tạo ticket | `category`, `scope`, `farmId` khi FARM, `subject` ≤150, `description` ≤3000 | Không có field nghiệp vụ phụ bắt buộc; Owner mô tả bằng text | priority, assignee, IR/audit ID, selector record người khác, payment code/time/amount bắt buộc, full receiving account, password/OTP/secret |
| Reply công khai | `content` ≤3000 | Clarification ngắn | File/tài liệu thay cho submission; nội dung CS_ONLY; kết quả PM/SA |
| Nộp bổ sung | `Response text` ≤3000; ít nhất một attachment `READY` nếu CS đánh dấu cần bằng chứng | Một hay nhiều file bằng chứng theo request text | Upload tự phát khi không có request, file tự chia sẻ cho PM/SA không qua CS selection, password/OTP hoặc giấy tờ không nằm trong request |
| Confirm/reopen | Confirm latest resolution hoặc reopen `reason` ≤1000 | Optional acknowledgement comment nếu được duyệt | Closing note hoặc internal reason |

`Priority: Normal` hiện ở SRS SCR-65 nhưng không phải quyết định của Owner. **Đề xuất:** bỏ field này khỏi form tạo, chỉ hiển thị sau create/detail khi cần minh bạch. Nếu duyệt, phải sửa Part III SRS/SCR-65; không chỉ xóa ở FE.

#### B. Owner thấy gì

| Màn | Bắt buộc thấy | Chỉ hiện khi cần | Không hiện |
|---|---|---|---|
| SCR-64 | code, subject, category, farm/null, status, updated, `nextAction` | trạng thái `Cần phản hồi`, `Đã gửi bằng chứng – CS đang xem`, `Cần bổ sung lại`, due date khi có | priority/assignment/internal request/raw domain data |
| SCR-65 | category, scope/farm theo D40, subject, description, field validation | safe prefill/hint khi mở từ payment/farm context | free selector payment/account, CS priority/assignee |
| SCR-66 | PUBLIC timeline; thẻ action chính “Bạn cần bổ sung” hoặc “Xác nhận kết quả”; resolution | request text, own response text/file/scan/review reason, status history an toàn | CS note/handover reason, PM/SA name/result, audit ID, full payment/account/evidence |

Khi supplement active, `Lưu nháp/Gửi bổ sung` là CTA chính; public reply vẫn có nhưng không thể thay submission. Khi không active, conversation là CTA chính. Owner không tự đoán việc từ `WAITING_CUSTOMER`.

### 12.4 CS: input, output và giới hạn dữ liệu sâu

| Việc CS làm | CS phải thấy | CS tạo/gửi | Không thấy/không chuyển tiếp |
|---|---|---|---|
| Queue/claim | code, Owner/farm display, category, status, priority, next action, aging, count supplement/IR | claim/release/handover reason | full body/file/evidence trong row, account security/raw bank data |
| Phân loại/trao đổi | public description/reply, safe payment/account summary | category/priority, public reply, CS_ONLY note | password/OTP/raw access log |
| Issue/review supplement | request text, attachment-required flag, revision, scan/review state | public instruction, due date, accept/correction/waive/cancel reason | CS diagnosis trong instruction; structured time/amount fields; storage key/signed URL |
| Tạo IR | role availability, ticket/farm display tối thiểu, evidence IDs để CS chọn | request text ngắn nêu câu hỏi + hint Owner đã cung cấp; selected attachment refs theo IR revision | full conversation, CS_ONLY note, attachment không được chọn, full bank/account data |
| Resolution/close | blockers, latest resolution, Owner confirmation **text + time + version** | public resolution/close note | checkbox review khi confirmation text chưa render; raw IR result dán nguyên văn ra public |

CS có thể review file Owner nộp cho supplement sau assignment/re-authorization. Điều đó không cho CS mặc định đọc payment evidence hay account diagnostic của platform; với PAYMENT, CS nhận safe summary và tạo IR, PM mới đối soát trong FE-19.

### 12.5 PM và SA/Admin: tự tra cứu trong domain screen, không nhúng vào IR

Trong FE-20, “Admin” không là một quyền xem tất cả. Phân biệt PM (payment/service) và SA (account/access):

| Người nhận | Nhận trong IR/SCR-69 | Tự tra cứu ở đâu | Trả về CS | Không nhận |
|---|---|---|---|---|
| PM – PAYMENT | IR code, ticket/farm display, request text gồm mã/hint Owner đã cung cấp nếu có; selected READY evidence | FE-19, bằng search/tra cứu bình thường của PM | `CONFIRMED`/`NOT_CONFIRMED`/`NEED_MORE_INFO`/`OUT_OF_SCOPE` + note ngắn | conversation, CS note, file không được chọn, account security, payment ngoài phạm vi tra cứu |
| PM – FARM_SERVICE | IR code, ticket/farm display, request text; selected READY evidence | FE-02, theo quyền PM | outcome + note ngắn | conversation/note/file không được chọn; bank evidence |
| SA – ACCOUNT_ACCESS | IR code, ticket code, masked account display/access symptom trong request text; selected READY evidence | FE-03, theo quyền SA | outcome + note ngắn | farm operation data, payment/evidence không được chọn, password/secret/OTP |

SCR-69 không có context card, deep-link, table reconciliation/evidence/account diagnostic hay generic hub CTA. Người nhận tự mở đúng màn nghiệp vụ của role họ và tự tra cứu theo request text. Ticket/farm display chỉ là định hướng, không phải quyền truy cập hay target bắt buộc.

### 12.6 Dữ liệu và state mới: Customer Supplement Request

| Object/field | Required / rule | Visibility |
|---|---|---|
| `CustomerSupplementRequest.id, ticketId, definitionVersion` | immutable identity; 1 blocking active request/ticket trong MVP | Owner + assigned CS |
| `status` | `DRAFT → OPEN → SUBMITTED → UNDER_REVIEW → ACCEPTED` hoặc `NEEDS_CORRECTION/CANCELLED/WAIVED/EXPIRED` | Owner + assigned CS |
| `requestText, evidenceRequired` | instruction ≤2000; whether at least one evidence attachment is required | Owner + assigned CS |
| `submission` | immutable revision; `responseText` ≤3000, submittedBy/At, attachment refs | Owner + assigned CS |
| `attachment` | private object, original name sanitized, media/size/signature, scan state; no public URL | Owner; any authorized CS read/download per D58 pending Security role/audit/revocation contract; PM/SA only selected READY IR refs |
| `review` | request-level `ACCEPTED`/`NEEDS_CORRECTION` + reason, reviewer/at; required evidence must be clean/READY before ACCEPTED | Owner + assigned CS |
| `dueAt` | optional until policy approved; Asia/Ho_Chi_Minh for display | Owner + assigned CS |

**Provisional lifecycle and blocker table (không authorizes API/code khi các decision §12.11 còn mở):**

| Supplement state | Actor / legal transition | Ticket effect and `workOwner` | Blocks resolve/close? | Notification / audit |
|---|---|---|---|---|
| `DRAFT` | Assigned CS creates/edits draft definition, then `ISSUE → OPEN` | No Owner-visible change; `CS` | No | Audit draft only; no Owner notification |
| `OPEN` | Assigned CS issues; Owner may save draft or `SUBMIT → SUBMITTED`; CS may `CANCEL` or authorized `WAIVE` | `WAITING_CUSTOMER`; `OWNER`; `nextAction=OWNER_SUPPLEMENT` | Yes | Issue/cancel/waive history and notification as applicable |
| `SUBMITTED` | Owner submits immutable revision; assigned CS begins `REVIEW → UNDER_REVIEW` | `IN_PROGRESS`; `CS`; `nextAction=CS_REVIEW_SUPPLEMENT` | Yes | Submission history/audit; notify assigned CS |
| `UNDER_REVIEW` | Assigned CS `ACCEPT → ACCEPTED` or `REQUEST_CORRECTION → NEEDS_CORRECTION` | `IN_PROGRESS`; `CS`; `nextAction=CS_REVIEW_SUPPLEMENT` | Yes | Review decision/history; notify Owner only for correction |
| `NEEDS_CORRECTION` | Owner saves draft or submits a new revision; assigned CS may cancel/waive | `WAITING_CUSTOMER`; `OWNER`; `nextAction=OWNER_SUPPLEMENT` | Yes | Correction reason is Owner-visible; history/notification required |
| `ACCEPTED`, `CANCELLED`, `WAIVED` | Terminal for this request; a later need creates a new draft/request | `IN_PROGRESS`; `CS`; no supplement next action | No | Audit/history; Owner notification for cancellation/waiver only when it changes their required action |
| `EXPIRED` | **Blocked on D-FE20-06.** No transition, blocker behavior, or auto-action may be implemented before policy is approved. | Undecided | Undecided | Undecided |

At most one request in `OPEN`, `SUBMITTED`, `UNDER_REVIEW`, or `NEEDS_CORRECTION` may exist per ticket and these are exactly the **active/blocking** states. A `DRAFT` belongs only to the assigned CS and is neither active nor blocking. Every non-draft mutation needs an idempotency key plus the displayed record version; concurrent submit/review/cancel/waive returns stale conflict and reloads rather than replaying intent. Existing free `ASK_CUSTOMER` remains legacy-compatible and renders as “Yêu cầu bổ sung (không có form phản hồi/bằng chứng)”; never backfill it as structured data.

### 12.7 IR contract đơn giản: VERIFY text-first; mutation là nhánh khác

**MVP chỉ hỗ trợ `VERIFY`.** Đây là work item hỏi–đáp nghiệp vụ, không phải lệnh thay đổi payment/account/service.

| Thành phần | CS tạo | PM/SA thấy hoặc gửi | Rule |
|---|---|---|---|
| `requestType` | `VERIFY` (server-controlled trong MVP) | Read-only | Nhánh `PERFORM_ACTION` chưa hiển thị trong MVP |
| `targetRole`, `recipientId` | Chọn recipient có role hợp lệ | Read-only | Server enforce `ACCOUNT_ACCESS → SA`, `PAYMENT/FARM_SERVICE → PM`, `SYSTEM_USAGE/OTHER → PM hoặc SA` do CS phụ trách chọn; recipient phải available |
| `requestText` | Required, ≤2000; chứa câu hỏi và chỉ hint tối thiểu Owner đã cung cấp | PM/SA đọc; CS có thể thêm clarification revision | Không có numeric context selector, full thread, CS note, attachment ngoài selected refs, raw bank/account data |
| `outcome` | — | `CONFIRMED`, `NOT_CONFIRMED`, `NEED_MORE_INFO`, `OUT_OF_SCOPE` | `CONFIRMED` chỉ nghĩa là đã xác minh, **không** nghĩa là đã thực hiện mutation |
| `resultNote` | — | Required ≤2000 for PM/SA outcome | Sanitized, chỉ assigned CS đọc; Owner không thấy |
| `history[]` | — | Created, clarification, reassign, cancel, response/complete; actor/role/time/version | Backend trả lịch sử thật, FE không synthesize `history:[]`/`fromId:0`/`farmId:0` |

State: `OPEN` (đang chờ PM/SA) → `WAITING_CS` (PM/SA chọn `NEED_MORE_INFO`) → `OPEN` khi CS gửi clarification revision; hoặc `DONE` khi `CONFIRMED`/`NOT_CONFIRMED`/`OUT_OF_SCOPE`; `CANCELLED` ở mọi state active. Reassign/cancel làm recipient cũ mất quyền ngay. `NEED_MORE_INFO` không được DONE, vì nếu DONE thì mất vòng lặp hỏi–đáp.

**Future branch `PERFORM_ACTION`.** Chỉ thêm khi Product cần PM/SA thực hiện mutation từ một IR. Khi đó domain command bắt buộc ghi `sourceInternalRequestId`, actor, target record, version before/after và audit/provenance cùng transaction. Không cho PM/SA gõ “đã làm” hoặc chọn một audit bất kỳ để chứng minh mutation. Nhánh này không phải phần text-only MVP.

### 12.8 Contract/UI stability rules

| Rule | Required behavior |
|---|---|
| Server authority | Derive category/scope/role from persisted ticket; reject role sai, surplus fields và dữ liệu vượt boundary. |
| Snapshot and stale | Persist identity + display snapshot/version; stale/reassigned/revoked recipient must reload and never auto-retarget. |
| File safety | Upload quarantine → signature/type/size validation → scan → READY; failed scan never becomes visible/downloadable as valid evidence. |
| Concurrency | All creates/submits/reviews/reassign/complete use idempotency key + version/lock; stale loser reloads, never silently retries old intent. |
| Error shape | Field validation is `{code, field, message}`; UI renders next to correct input, not generic conflict only. |
| Notification | Minimal payload (code/status/due/IR-or-ticket link); recipient access rechecked at read/navigation; no filename/content/storage URL/raw domain data. Link chỉ mở work item, không mở domain record. |
| Audit | VERIFY lưu actor/role/request/revision/outcome/status/version/correlation; `PERFORM_ACTION` tương lai thêm target/before-after/provenance. Never store document content, secret, signed URL or raw sensitive payload. |

### 12.9 Đặc tả đầy đủ màn hình, xem và sửa dữ liệu

Các bảng sau là contract UI target, không phải gợi ý layout. Một field không được có trong “Hiển thị” thì FE không render, BE không trả ở endpoint role đó và log/notification không được dùng để lách boundary. “Sửa” nghĩa là command có version/idempotency; không cho inline edit đối với history, public message, submission hoặc domain result đã commit.

#### 12.9.1 State chung cho tất cả route/dialog

| State | Người dùng phải thấy | Hành vi bắt buộc |
|---|---|---|
| Loading | Skeleton theo vùng, không phải spinner che hết trang | Không enable mutation khi chưa có `version`/quyền hiện hành |
| Empty | Lý do ngắn + một CTA hợp lệ (ví dụ “Gửi yêu cầu mới”, không phải “thử lại” mơ hồ) | Không render table/card giả hoặc default IDs |
| Field error | Lỗi cạnh đúng field và summary focus lỗi đầu | Giữ input an toàn; không mất draft/file đã READY |
| Forbidden / no longer assigned | Banner nói không còn quyền + CTA quay lại list/refresh | Không lộ content như một phần của error payload |
| Stale / changed | So sánh version, nói dữ liệu đã đổi + “Tải lại” | Không tự submit lại intent cũ sang version mới |
| Closed / read-only | Nhãn rõ ticket/IR đã đóng/hủy | Hide mutation composer/CTA thay vì nút bấm rồi fail |
| Async file scan | `Uploading` / `Scanning` / `Ready` / `Rejected` bằng text và icon | `Submit` khóa khi required file chưa READY; retry không tạo attachment trùng |

#### 12.9.2 SCR-64 — Owner: danh sách ticket

| Vùng | Hiển thị bắt buộc | Action / sửa | Không hiển thị |
|---|---|---|---|
| Header | “Yêu cầu hỗ trợ”; CTA `Gửi yêu cầu mới` | Mở SCR-65 | CS assignee, số IR; priority detail/edit remains unavailable until A6a contract is approved |
| Filter | Search code/subject; category; updated-from/to; tab | Đổi filter/pagination, URL state an toàn | Search Owner khác, payment/account ID nội bộ |
| Tab/counter | All, In progress, `Cần bạn xử lý`, Resolved, Closed; count server trả | Chọn tab | `WAITING_CUSTOMER` thô nếu lý do là CS review/PM xử lý |
| Row | code, subject, category, farm display hoặc “Không gắn trại”, human status, updatedAt, `nextAction` | Mở SCR-66 | CS name/internal note/result/audit/raw payment data; priority only after A6a contract explicitly permits list visibility |
| Active supplement hint | `Bạn cần phản hồi` / `Đã gửi bằng chứng – CS đang xem` / `Cần bổ sung lại`, due date nếu có | Mở đúng supplement card của SCR-66 | Request text/file name trong list |

`nextAction` là field server-side enum/text allowlist, không suy từ message/body/status. Owner phải hiểu được “mình cần làm gì” trong một row, không cần mở ticket để dịch trạng thái kỹ thuật.

#### 12.9.3 SCR-65 — Owner: tạo ticket

| Field / control | Hiển thị / required | Sửa được? | Điều kiện và dữ liệu không có |
|---|---|---|---|
| Category | Required enum | Có, trước submit | Đổi category recalculates scope; không hiển thị category không được duyệt |
| Scope | Required FARM/ACCOUNT | Có khi category cho phép | D40 locks ACCOUNT_ACCESS→ACCOUNT; PAYMENT/FARM_SERVICE→FARM |
| Related farm | Required khi FARM | Có | Chỉ farm Owner sở hữu; ACCOUNT gửi `farmId:null` |
| Subject / description | Required, ≤150 / ≤3000 | Có | Field errors tại chỗ; description là public opening message |
| Contextual hint | Không có field riêng; Owner mô tả bằng `Description` | — | Không có payment code/time/amount bắt buộc hay free lookup/record selector |
| Priority | Hiển thị system-calculated priority sau khi tạo; Owner có thể sửa theo contract | Có sau tạo; không chọn initial value | Server initial calculation/sort; timing, version và audit còn phải chốt |
| Submit / cancel | Submit idempotent; cancel không lưu | — | Không gửi assignee/IR/audit/secret/full bank account |

Owner không “sửa ticket đã gửi” trực tiếp vì subject/description là record/history public. Sai hoặc thiếu sau submit phải đi qua reply, supplement, hoặc reopen có lý do; không mutate âm thầm nội dung đã được CS nhìn thấy.

#### 12.9.4 SCR-66 — Owner: xem và xử lý ticket

| Vùng theo thứ tự ưu tiên | Hiển thị bắt buộc | Action/sửa | Không hiển thị |
|---|---|---|---|
| Header | code, subject, category, farm/null, human status, updatedAt | Back list | CS-only internal state/IR count; priority display/edit only after A6a contract is approved |
| **Action card** | Chỉ một action chính: active supplement, resolution awaiting confirmation hoặc no-action | Draft/submit supplement; confirm/reopen as allowed | Hai CTA cạnh tranh “Gửi reply” và “Gửi supplement” cùng primary |
| Supplement card | Request text, `Bằng chứng đính kèm` có bắt buộc hay không, draft `Response text`, own file status, due, correction reason, submission/review timestamps | Save draft, upload/remove own draft file, submit; resubmit after correction | CS internal review note, storage URL/key, scan engine output, PM/SA identity/result |
| Public conversation | PUBLIC author/time/content; legacy QUESTION renders a distinct legacy card | Send public reply only when not CLOSED | CS_ONLY note, IR question/result, raw document metadata beyond Owner file |
| Resolution | latest version, CS display, at, public text; acknowledgement status | Confirm latest or reopen with reason | Internal root cause/audit/domain result |
| Safe history | status/time and public-facing action | Read only | handover/cancel/CS reason/recipient identity when not public |
| Sidebar facts | category, scope, farm/null, status, created/updated, assigned CS display only if product keeps it | Read only; priority edit only after A6a contract | account/payment deep data |

If a supplement is `OPEN`/`NEEDS_CORRECTION`, reply is secondary and cannot transition the supplement. If `SUBMITTED`/`UNDER_REVIEW`, Owner sees a read-only “CS đang xem” card, not an editable composer that suggests re-submission is allowed. If `CLOSED`, all mutation is absent and the screen states the next legal action is new ticket.

#### 12.9.5 SCR-67 — CS: queue và triage

| Vùng | Hiển thị bắt buộc | Action / sửa | Không hiển thị |
|---|---|---|---|
| Summary/filter | Unassigned, Mine, waiting-owner, waiting-CS-review, waiting-PM/SA, resolved-awaiting-confirmation; search requester/code/subject; category/priority/assignee/farm filters | Filter, sort, page | Raw document/payment/account data |
| Row | code, short subject, Owner display, farm/null, category, priority, ticket status, `workOwner`, `nextAction`, aging, supplement/IR indicator | Claim/Open/Re-claim if allowed | Full description/thread, file names, IR question/result, bank/account content |
| Needs attention | unavailable assignee, expired/near-due supplement, IR needs reassignment | Claim/open; never mutate direct from row except claim | Security reason of suspended account |
| Empty/error | Current filter explanation and clear/reset filter | Retry/clear filters | Fake zero values |

`ticketStatus` và `workOwner` là hai field riêng. Một ticket `WAITING_CUSTOMER` không đủ để queue biết đang chờ Owner nộp, CS review, hay domain work. Sort must be explicit (`priority`, `updatedAt`, default documented), not an invisible database ordering.

#### 12.9.6 SCR-68 — CS phụ trách: workspace ticket

| Vùng | Hiển thị bắt buộc | Sửa/action hợp lệ | Không hiển thị / không làm |
|---|---|---|---|
| Header/facts | code, subject, Owner/farm/null, category, status, priority, assignment availability, blocker summary | Claim if unassigned; handover/release/classify only assignee | Full account security/payment reconciliation data |
| Public tab | Public conversation + reply composer | Public reply ≤3000 | CS_ONLY note under public tab |
| CS note tab | CS_ONLY note author/time/content | Add note ≤3000, no edit/delete | Named PM/SA access; Owner access |
| History tab | Immutable status/assignment/IR/supplement events with actor role; sensitive reason redacted appropriately | Read only | Raw file/secret/domain payload |
| Supplement workspace | Current request text/version; evidence-required flag; latest response text/files; scan; request-level review reason; due/blocker | Create request; review start; request correction; accept/cancel/waive with reason | Let non-assigned CS mutate/review decision; silently edit issued request text |
| IR workspace | IR code/type/role/recipient/status/request text, selected attachment refs, clarification history, result summary; `needsReassignment` | Create VERIFY request; select permitted evidence, send clarification revision; reassign/cancel with reason | Send unselected customer files/conversation/CS notes/raw bank/account data; embed tra soát |
| Resolution/close | Current resolution/ack text-time-version and all blockers | Record resolution only without OPEN IR/blocking supplement; close only after current ack | Treat IR result as public resolution without CS rewrite |

**Edit semantics in SCR-68.** Category/priority are mutable classification fields and require version. Assignment change/release/reassign/cancel require reason and history. Supplement definition may change only in DRAFT; after issue create a new definition/request version, never overwrite Owner instruction. Submission, review and resolution are immutable revisions; correction creates a new submission revision. The system must expose distinct PM and SA actions only for roles allowed by category matrix; no generic “create request” that lets CS choose an invalid role.

#### 12.9.7 Dialogs: create supplement, create IR, close ticket

| Dialog | Field đầy đủ | Validation / output | Không chứa |
|---|---|---|---|
| Create supplement | Public `Request text` ≤2000; `Evidence required?` toggle; dueAt if policy enables | Preview Owner view; issue atomically creates request/history/notification; field errors point to request text/attachment policy | CS-only diagnosis, PM/SA assignment, structured field checklist, raw storage setting |
| Create IR | Target role constrained by category; available recipient; `Request text` ≤2000; optional evidence selection | Server validates role/scope/recipient/selected evidence; preview exactly what recipient will see | Numeric ID/context selector, unselected customer files, conversation, CS notes, raw bank/account values |
| Close ticket | Latest resolution version/time/text; Owner confirmation text/time/version; no-open-IR/supplement conditions; optional close note ≤500; review checkbox | Close rechecks all version/blockers; stale reloads | Checkbox without visible confirmation; internal result/secret |

#### 12.9.8 SCR-69 — PM/SA: list, text request, response

| Vùng | Hiển thị bắt buộc | Action / sửa | Không hiển thị |
|---|---|---|---|
| List | IR code, request type, request text preview, ticket code/farm display when relevant, from-CS display/time, status, age, reassigned indicator | Filter OPEN/WAITING_CS/DONE/CANCELLED; open own request | Owner thread, CS note, file not selected for this IR, other recipient request |
| Detail header | code, status, recipient role, createdAt, request text, clarification history | Refresh stale assignment; back list | Ticket body/full title if not needed, PM/SA cross-domain data |
| Domain lookup | Không nằm trong SCR-69 | PM/SA tự mở màn nghiệp vụ của role mình và tìm theo request text | Tra soát/payment/account table hoặc deep-link inside IR |
| Response | Outcome + result note ≤2000; real history/completedBy | `NEED_MORE_INFO` gửi câu hỏi về CS và giữ `WAITING_CS`; outcome khác complete IR | Free audit ID, result visible to Owner, completion after reassigned/cancelled |

PM/SA tự tra cứu deep data trong domain screen theo quyền của họ, không từ route của IR. Họ trả summary CS có thể dùng; CS tự viết resolution Owner-facing. `NEED_MORE_INFO` không complete; `NOT_CONFIRMED`/`OUT_OF_SCOPE` cần note đã làm sạch.

### 12.10 Acceptance criteria bổ sung

| ID | Given / When | Then |
|---|---|---|
| AC-20-01 | Owner creates/opens payment, farm, account ticket | Only conditionally relevant fields show; no priority/internal/free record selector; server rejects category/scope mismatch. |
| AC-20-02 | Active supplement for Owner | Owner sees request text, response text, own files/status/review reason and primary submit CTA; public reply does not complete it. |
| AC-20-03 | CS creates/reviews supplement | Only assigned CS can inspect submission/file; request/submission revision is versioned; CS cannot browse raw payment/account domain data. |
| AC-20-04 | PM/SA opens same ticket's VERIFY IR | PM/SA sees request text + minimal ticket/farm display and only evidence attachments explicitly selected by CS for that IR revision; no conversation/note, context selector, deep-link or embedded domain data. |
| AC-20-05 | PM/SA returns `NEED_MORE_INFO` | IR becomes `WAITING_CS`, CS can add a clarification revision, and the same recipient sees the new text after return to `OPEN`; IR is not DONE. |
| AC-20-06 | PM/SA returns `CONFIRMED`, `NOT_CONFIRMED` or `OUT_OF_SCOPE` | Required sanitized note is stored with actor/time/history; IR is DONE; Owner cannot see it. |
| AC-20-07 | Role loss/reassign/stale version | Old recipient/action denied; UI shows actionable stale/forbidden state without fallback target. |
| AC-20-08 | Owner submit vs CS cancel/review; IR clarification vs reassign/complete | One serializable outcome; replay is idempotent and never applies old intent to a new version. |
| AC-20-09 | Owner confirmation then CS close | Popup renders exact confirmation text/time/version before required review tick. |
| AC-20-10 | Owner opens SCR-64/66 in each ticket and supplement state | List/detail render only the columns/cards defined in §12.9; exactly one primary next action; no CS/IR/domain field leaks. |
| AC-20-11 | CS opens SCR-67/68 as assignee and non-assignee | Queue has only triage summary; non-assignee cannot mutate but may view/download evidence under the approved CS access policy; assignee sees the correct workspace/tab/blocker fields and only valid role actions. |
| AC-20-12 | CS edits classification, assignment, supplement definition/review and resolution | Only mutable fields accept update; immutable public message/submission/review/resolution cannot be overwritten; every transition has version/reason/history as specified. |
| AC-20-13 | PM and SA open SCR-69 for PAYMENT, FARM_SERVICE and ACCOUNT_ACCESS | Each list/detail contains request text + minimal role-scoped metadata and only CS-selected IR attachments; no thread, note, context selector, deep-link or embedded domain workspace. |
| AC-20-14 | Loading/empty/validation/forbidden/stale/closed/file-scan states on every screen/dialog | UI gives a field-level/actionable response, does not fabricate sentinel values or expose protected content, and never enables a stale mutation. |

### 12.11 Product decisions and remaining Security/operational contracts

| ID | Decision | Recommended default |
|---|---|---|
| D-FE20-01 | Owner priority | Hệ thống tính/sắp xếp priority ban đầu; Owner có thể sửa priority ticket của mình. Còn phải chốt timing, version và audit. |
| D-FE20-02 | Allowed evidence attachment policy | Chỉ PDF/JPEG/PNG. Chưa chốt count, size, quarantine/scan, retention, legal hold và audit. |
| D-FE20-03 | Non-assigned CS evidence access | CS khác vẫn xem/tải evidence bình thường. Còn phải chốt role boundary, audit download và revocation. |
| D-FE20-04 | PM/SA customer attachments | CS có thể chủ động chọn evidence đính kèm cho named PM/SA IR; không auto-share mọi file. Còn phải chốt immutable attachment selection, authorization/revoke và audit. |
| D-FE20-05 | Category matrix for SYSTEM_USAGE/OTHER | CS phụ trách chọn PM hoặc SA theo tình huống; server chỉ cho recipient khả dụng, không fallback UI. |
| D-FE20-06 | Deadline/reminder/expiry | Có deadline, reminder và EXPIRED; không auto-close ticket. Còn phải chốt cadence/timezone/transition/blocker/action/retention/audit. |

### 12.11.1 Pre-WBS implementation gate

Không tạo code/test implementation cho supplement, attachment, PM/SA attachment share hoặc deadline/expiry cho tới khi các Security/operational gaps của D-FE20-02/03/04/06 được ghi vào source-of-truth. Sau đó phải cập nhật §7 bằng nhóm supplement contract hoàn chỉnh: route, payload, field/error/message catalogue, version/idempotency, upload/quarantine/scan/read authorization, retention và transition trong bảng trên. Những slice không phụ thuộc các gap vẫn phải qua impact analysis và WBS đã duyệt; không được tự suy diễn policy còn thiếu.

### 12.12 Luồng chính theo kịch bản — từ tạo ticket đến đóng ticket

Các luồng dưới đây mô tả trải nghiệm mục tiêu bằng ngôn ngữ thao tác. Tên field/CTA/state là một phần của spec; implementation có thể thay layout nhưng không được đổi boundary dữ liệu hoặc bỏ qua transition.

#### LF-20-01 — Owner báo vấn đề, nộp đúng tài liệu khi CS yêu cầu, CS xử lý và đóng ticket

1. **Owner tạo ticket tại SCR-65.** Owner chọn `Category`, `Scope`, `Related farm` khi scope là FARM, nhập `Subject` và `Description`. Đây là toàn bộ dữ liệu Owner phải khai ban đầu: nếu cần nói thêm về thanh toán/dịch vụ, Owner viết tự do trong `Description`, không bị bắt nhập `Payment code`, thời điểm hay số tiền theo field riêng. Owner không tự chọn initial `Priority`; không thấy `Assigned CS`, internal request, audit ID, receiving account đầy đủ, password hay OTP.
2. Owner bấm **Gửi yêu cầu**. Server kiểm category/scope theo D40, quyền sở hữu trại, field validation và idempotency, rồi tự tính priority ban đầu. Hệ thống tạo `TK-…`, PUBLIC opening message, history và notification cho CS trong một transaction. Ticket ở `OPEN`; SCR-66 hiển thị `Đang chờ CS tiếp nhận` là `nextAction`. Owner có thể sửa priority sau khi tạo theo timing/version/audit contract sẽ chốt.
3. **CS nhận và phân loại tại SCR-67/SCR-68.** Trong queue, CS chỉ nhìn code, subject, Owner/farm display, category, priority, tuổi ticket và `nextAction`. CS bấm **Nhận**; ticket thành `IN_PROGRESS`. Ở workspace, CS xem `Description`/public reply và ticket summary an toàn, nhưng không có payment reconciliation/raw account diagnostic.
4. CS xác định cần làm rõ/bằng chứng và bấm **Yêu cầu Owner bổ sung**. Dialog chỉ có `Request text` (ví dụ: “Bạn vui lòng mô tả lại giao dịch và đính kèm ảnh/xác nhận chuyển khoản để chúng tôi kiểm tra.”), toggle `Yêu cầu có bằng chứng đính kèm`, và `Due date` nếu policy đã bật. CS xem preview Owner rồi bấm **Gửi yêu cầu bổ sung**. Không có checklist bắt Owner điền thời điểm/số tiền hay nhiều field lẻ; các bên trao đổi chi tiết trong text. Không được đưa CS-only diagnosis, raw bank/account data, storage key hay phân công PM/SA vào request Owner.
5. Hệ thống tạo `CustomerSupplementRequest` có `requestId`, `definitionVersion`, request text, attachment rule, history và thông báo Owner; ticket thành `WAITING_CUSTOMER`. Owner mở SCR-66 và nhìn thấy một action card duy nhất: **Bạn cần phản hồi và gửi bằng chứng**. Card hiện yêu cầu của CS, ô `Response text`, vùng **Đính kèm bằng chứng**, deadline (nếu có), tiến độ file và CTA **Lưu nháp** / **Gửi bổ sung**. Public reply chỉ là action phụ để hỏi CS, không thay thế submission.
6. **Owner nộp bổ sung.** Owner viết `Response text` và đính kèm một hoặc nhiều bằng chứng nếu CS đã yêu cầu. File lần lượt ở `Uploading → Scanning → Ready` hoặc `Rejected`. Nút **Gửi bổ sung** chỉ enable khi response text hợp lệ và, nếu evidence bắt buộc, có ít nhất một file `Ready`. Owner có thể lưu nháp; draft không thông báo CS. Owner không gửi file trực tiếp cho PM/SA và không nhìn thấy review nội bộ/scan log kỹ thuật.
7. Owner bấm **Gửi bổ sung**. Server tạo một `Submission revision` bất biến với `submittedBy`, `submittedAt`, `responseText` và attachment refs, chuyển request thành `SUBMITTED`, ticket thành `IN_PROGRESS`, ghi history/audit/outbox và báo CS. SCR-66 đổi action card thành **CS đang xem xét thông tin bạn đã gửi**; Owner không thể sửa revision này cho đến khi CS yêu cầu sửa.
8. **CS review submission tại SCR-68.** CS phụ trách xem response text, các file bằng chứng và trạng thái scan. CS chọn `Accepted` hoặc **Yêu cầu bổ sung lại** cùng một `Reason` rõ ràng. Nếu cần sửa, request thành `NEEDS_CORRECTION`, ticket về `WAITING_CUSTOMER`, và Owner thấy yêu cầu mới kèm lý do để trả lời/nộp revision khác. Nếu response/bằng chứng hợp lệ/an toàn, CS bấm **Xác nhận đủ thông tin**; request thành `ACCEPTED`, ticket giữ `IN_PROGRESS`. Accept không tự resolve/close ticket.
9. **Nếu cần xác minh, CS tạo VERIFY IR đúng vai trò.** CS bấm **Tạo yêu cầu PM** hoặc **Tạo yêu cầu SA** chỉ khi category matrix cho phép. Dialog có `Recipient`, `Request text` và danh sách evidence để CS chọn đính kèm; selection gắn với IR revision, không tự chia sẻ mọi file. PAYMENT/FARM_SERVICE chỉ PM, ACCOUNT_ACCESS chỉ SA; SYSTEM_USAGE/OTHER cho CS chọn PM hoặc SA. IR không chứa conversation, CS-only note, context selector hay deep-link.
10. **PM/SA tự tra cứu trong màn nghiệp vụ của họ.** Tại SCR-69, người nhận chỉ thấy IR code, ticket/farm display tối thiểu, request text, history và evidence đã được CS chọn cho IR đó. PM/SA tự vào FE-19/FE-02/FE-03 theo menu/quy trình quen thuộc và tra cứu theo thông tin trong text/file được cấp. SCR-69 không nhúng tra soát, không mở record cụ thể và không thực hiện mutation.
11. PM/SA quay lại SCR-69, chọn `Outcome`: `Đã xác nhận`, `Không xác nhận được`, `Cần thêm thông tin` hoặc `Ngoài phạm vi`; nhập `Result note` đã làm sạch. Với `Cần thêm thông tin`, IR thành `WAITING_CS`, CS nhận notification và gửi clarification text revision; IR quay lại `OPEN`. Ba outcome còn lại mới cho phép **Gửi kết quả và hoàn thành** để IR thành `DONE`. Owner không thấy IR/result này.
12. **CS ghi kết quả cho Owner.** Khi nhận `Đã xác nhận`, CS dùng note đã làm sạch để viết `Resolution` công khai, dễ hiểu cho Owner, ví dụ “Thông tin thanh toán đã được xác nhận.” Không tự tuyên bố dịch vụ/tài khoản đã thay đổi trừ khi có bằng chứng domain ngoài luồng VERIFY. Khi không còn supplement blocking/IR `OPEN` hoặc `WAITING_CS`, ticket thành `RESOLVED`.
13. **Owner xác nhận và CS đóng.** Owner thấy resolution version/text/time và bấm **Xác nhận đã giải quyết**. CS mở dialog **Đóng ticket**; dialog phải hiển thị resolution version/time, không có request/IR active, và chính xác `Owner confirmation text + time + version`. Sau khi CS tick **Tôi đã xem xác nhận…** và bấm **Đóng ticket**, server recheck tất cả điều kiện, chuyển ticket thành `CLOSED`, lưu history/audit/notification. `CLOSED` chỉ đọc; Owner muốn vấn đề mới phải tạo ticket mới.

#### LF-20-02 — CS giải quyết không cần tài liệu hoặc PM/SA

1. Owner tạo ticket như bước 1–2 của LF-20-01.
2. CS nhận ticket, đọc mô tả/public reply và có đủ thông tin để hướng dẫn hoặc sửa một lỗi thuộc phạm vi CS.
3. CS **không** tạo supplement/IR chỉ để làm flow “đủ bước”. CS ghi `Resolution` công khai trực tiếp; ticket thành `RESOLVED`.
4. Owner xác nhận resolution. CS review confirmation text/time/version tại dialog và đóng ticket như bước 13 của LF-20-01.

Luồng này bảo đảm rằng response text/bằng chứng/IR chỉ xuất hiện khi chúng phục vụ quyết định thực tế; người dùng không bị ép đi qua các field/checklist dư thừa.

#### LF-20-03 — Ticket ACCOUNT_ACCESS cần SA xử lý sâu

1. Owner tại SCR-65 chọn `Category = ACCOUNT_ACCESS`. Scope tự khóa `ACCOUNT`, `Related farm` biến mất và request gửi `farmId:null`. Owner chỉ mô tả triệu chứng (ví dụ không đăng nhập được), không nhập mật khẩu/OTP.
2. CS nhận ticket; nếu cần làm rõ, tạo supplement bằng request text và có thể yêu cầu screenshot lỗi đã che dữ liệu nhạy cảm, hoặc tạo IR SA khi đã đủ thông tin.
3. CS tạo **Yêu cầu SA** với `Request text`, SA recipient và nếu cần evidence selection, ví dụ “Owner không đăng nhập được từ 09:00; vui lòng kiểm tra tình trạng tài khoản.” Không thể chọn PM, farm/payment hay full public thread; CS chỉ chọn evidence phù hợp để SA đọc trong IR revision.
4. SA mở SCR-69, tự vào FE-03 nếu cần và chỉ ở FE-03 mới xem account security/access detail theo quyền; SCR-69 chỉ hiện tài liệu Owner mà CS đã chọn cho IR.
5. SA trả `Đã xác nhận`/`Không xác nhận được`/`Cần thêm thông tin`/`Ngoài phạm vi` + note. Mở khóa/khôi phục quyền là nhánh `PERFORM_ACTION` ngoài MVP và không được báo là đã làm chỉ bằng VERIFY result. CS viết resolution Owner-facing, Owner confirm, CS close theo LF-20-01.

#### LF-20-04 — Ticket FARM_SERVICE cần PM xử lý sâu

1. Owner chọn `Category = FARM_SERVICE`; scope tự khóa FARM, bắt buộc `Related farm`. Owner mô tả tình trạng dịch vụ, không chọn subscription/payment bất kỳ.
2. CS nhận ticket, kiểm mô tả. Nếu thiếu bằng chứng, dùng supplement; nếu đủ, tạo **Yêu cầu PM** bằng request text nêu trại/dịch vụ cần xác minh.
3. PM tự vào FE-02 theo quyền PM để kiểm tra, không thấy operation/cattle/care data hoặc public conversation trong IR.
4. PM trả outcome text ngắn; suspend/restore/điều chỉnh là `PERFORM_ACTION` ngoài MVP và phải có command/audit riêng trước khi được gắn vào bất kỳ workflow nào.

#### LF-20-05 — Ticket SYSTEM_USAGE hoặc OTHER

1. Owner chọn `SYSTEM_USAGE`/`OTHER`, sau đó tự chọn scope FARM hoặc ACCOUNT theo D40. Form chỉ hỏi subject/description và contextual hint do category được duyệt.
2. CS phân loại vấn đề. Nếu cần supplement, gửi request text kèm attachment rule; nếu cần PM/SA, CS phụ trách chọn một named PM hoặc SA đang khả dụng theo D58. UI không tự fallback hoặc đổi role.
3. Các bước submission, review, VERIFY text response, resolution và close giữ nguyên LF-20-01; chỉ target-role matrix khác theo category được duyệt.
