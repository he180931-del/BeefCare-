# Route và phần backend còn thiếu so với spec

File này theo dõi phần backend còn thiếu. Câu hỏi cần quyết định nằm ở `OPEN_QUESTIONS.md`.

1. Route còn thiếu theo mục 7 của spec (18 mục).
2. Trường và quyền backend chưa khớp spec FE-23.
3. Route và trường FE cần khi dựng màn từ Figma.
4. Phần backend đã có code nhưng chưa kiểm chứng.

Mục 2–4 thêm ngày 07/11/2026 khi dọn thư mục `docs/`, gom từ các tài liệu cũ: đối chiếu FE–BE phần thức ăn (01/11), đối chiếu Figma với frontend (02/11), báo cáo triển khai backend và bàn giao backend (28–29/10). Khi xong một dòng, đổi cột Trạng thái; khi đổi DTO hoặc route, cập nhật `docs/api/openapi.json` và spec.

## 1. Route còn thiếu theo mục 7 của spec

Các thao tác trong mục 7 của spec mà code tại `main` chưa có route riêng. Route ghi ở đây là **đề xuất**; chủ feature chốt route thật, cập nhật `docs/api/openapi.json` và sửa cột Route trong spec khi làm xong.

Tổng: 18 mục.

| FE | Mã | Thao tác | Ghi chú / route đề xuất | Chủ feature | Trạng thái |
|---|---|---|---|---|---|
| FE-01 | A10 | Bảng quyền trong trại hiện tại | chưa có riêng – thêm vào A7 hoặc `GET /api/farms/{farmId}/my-permissions` | LamKD | Chưa làm |
| FE-02 | A7 | Xem trước popup | chưa có riêng – thêm `GET /api/platform/farms/{farmId}` | DucNV | Chưa làm |
| FE-05 | A9 | Lịch sử thay đổi hồ sơ | chưa có riêng – hiện qua dòng thời gian FE-16 (Q2) | AnNT | Chưa làm |
| FE-07 | A2 | Chi tiết | chưa có riêng – thêm `GET …/announcements/{id}` | TaiDX | Chưa làm |
| FE-07 | A5 | Xem trước người nhận khi đăng | chưa có riêng – có thể trả trong A4 | TaiDX | Chưa làm |
| FE-09 | A1 | Danh sách lịch + mũi | `GET /api/farms/{farmId}/vaccination-schedules` (mũi theo tab: chưa có – Q2) | TuanPQ | Chưa làm |
| FE-09 | A2 | Xem trước bò khớp đối tượng | chưa có – thêm `POST …/vaccination-schedules/preview` | TuanPQ | Chưa làm |
| FE-09 | A8 | Tab tiêm của một con | chưa có riêng – thêm `GET /api/farms/{farmId}/cattle/{cattleId}/vaccinations` | TuanPQ | Chưa làm |
| FE-14 | A2 | Chi tiết nhắc việc | Chưa có riêng – đề xuất `GET /api/farms/{farmId}/reminders/{id}` | TaiDX | Chưa làm |
| FE-14 | A4 | Trang chủ Technician | Chưa có riêng – đề xuất `GET /api/farms/{farmId}/technician-home` (hoặc ghép A1 + FE-07 + A3) | TaiDX | Chưa làm |
| FE-14 | A8 | Số chưa đọc (chuông) | Chưa có riêng – đề xuất `GET /api/notifications/unread-count` | TaiDX | Chưa làm |
| FE-15 | A3 | Đóng panel Bắt đầu | Chưa có – đề xuất `POST /api/farms/{farmId}/dashboard/getting-started/dismiss` | TaiDX | Chưa làm |
| FE-17 | A3 | Danh sách mã hành động | Chưa có – đề xuất `GET /api/platform/audit/actions` (hoặc enum cố định ở FE) | DucNV | Chưa làm |
| FE-18 | A7 | Kiểm trước khi ngưng | Chưa có riêng – trả `referencedCount` trong view A2, A3, A5, A6 | AnNT | Chưa làm |
| FE-19 | A14 | Rút phiên bản đã lên lịch | Chưa có – đề xuất `POST /api/platform/plan-prices/{version}/withdraw` | DucNV | Chưa làm |
| FE-23 | A5 | Bỏ nháp phiếu nhập | Chưa có – đề xuất `DELETE …/feed/receipts/{receiptId}` | TaiDX | Chưa làm |
| FE-23 | A10 | Hủy phiên bản lên lịch / dừng khẩu phần | Chưa có – đề xuất `POST …/feed/rations/{rationId}/versions/{v}/cancel` · `POST …/feed/rations/{rationId}/stop` | TaiDX | Chưa làm |
| FE-23 | A12 | Dữ liệu mở popup (kế hoạch theo chuồng, bữa) | Chưa có riêng – đề xuất `GET …/feed/feeding-records/plan` | TaiDX | Chưa làm |

## 2. Backend chưa khớp spec FE-23

Từ đối chiếu FE–BE phần thức ăn ngày 01/11; đã kiểm lại với code ngày 07/11/2026.

| FE | Mã spec | Chỗ lệch | Việc cần làm | Chủ feature | Trạng thái |
|---|---|---|---|---|---|
| FE-23 | §2, R-23-01 | `FarmAction.VIEW_FEED` cấp cho cả Technician và `FeedManagementService.stock()` dùng quyền này; spec và GBR-103 chỉ cho Owner, Manager xem tồn kho. Cùng quyền đang bảo vệ đọc khẩu phần và nhật ký cho ăn. | Tách quyền xem tồn kho (Owner, Manager), giữ Technician xem khẩu phần và nhật ký | TaiDX | Chưa làm |
| FE-23 | A1 | `StockView` chưa có tiles, bộ lọc `q, group, status`, giờ cập nhật tồn. OpenAPI không khai báo nullable cho `minimumStockKg`, `daysOfCover`, `nearestLotNumber`, `nearestLotExpiryDate` dù BE có thể trả null. | Bổ sung tiles và bộ lọc; sửa OpenAPI cho đúng nullable | TaiDX | Chưa làm |
| FE-23 | A3 | `CreateReceiptRequest` chưa có đã trả, hình thức, hạn trả; `FeedReceipt` không có hạn trả. UC-FE23-02 yêu cầu ghi sổ và thanh toán ban đầu trong cùng transaction, hiện FE phải gọi API thanh toán riêng sau khi ghi sổ. | Thêm các trường vào lệnh ghi sổ và lưu nguyên tử | TaiDX | Chưa làm |
| FE-23 | A3, A4 | `ReceiptView` không trả đã trả / còn nợ và lý do hủy (lý do đã lưu ở `FeedReceipt` nhưng mapper không trả ra). | Thêm vào DTO và OpenAPI | TaiDX | Chưa làm |

## 3. Route và trường FE cần khi dựng màn

Từ đối chiếu Figma với frontend ngày 02/11. Trong code FE, mỗi method API có chú thích route thật hoặc `// chưa có API`; ở chế độ backend, phần chưa nối báo lỗi rõ ràng, không dùng mock. Một số dòng có thể trùng mục 1; chủ feature đối chiếu với mục 7 của spec trước khi làm.

| FE | Phần | Chưa có route | Thiếu trường hoặc sai mô tả | Chủ feature |
|---|---|---|---|---|
| FE-07, FE-15 | Tổng quan, thông báo | Lựa chọn chuồng, tóm tắt trang chủ Technician, lấy thông báo theo id, danh sách thành viên, xem trước công bố | `DraftRequest` chỉ có `recipientRoles`, frame cần người nhận đích danh | TaiDX |
| FE-08 | Tăng trưởng | Bộ lọc, lựa chọn cho form | Model `Page` và `Summary` trong OpenAPI giống của ticket hỗ trợ, cần kiểm tra lại | TuanPQ |
| FE-09 | Tiêm phòng | Lựa chọn cho form, danh sách mũi, xem trước đối tượng và kế hoạch, ngữ cảnh ghi nhận | | TuanPQ |
| FE-10 | Sức khỏe | Lựa chọn thuốc, thành viên, gợi ý chẩn đoán, phiếu chết chờ xác nhận, số đếm tab | Đóng ca chết hoặc mất phải tự tạo phiếu ở server | TuanPQ |
| FE-18 | Danh mục | Lọc `q`, `status` cho vắc-xin và thuốc | `CatalogueItem` thiếu số lượng đang dùng; `ParameterVersionResult` thiếu `sourceNote`, `savedBy`, nội dung thay đổi; command thiếu `expectedVersion` | AnNT |
| FE-19 | Gói dịch vụ (Owner) | | Request cần `expectedPriceVersionId` (GBR-70); `PaymentDTO` thiếu `bankPaidAt`, `receivedAt`, `confirmedAt`; `SubscriptionOverview` thiếu tên trại, cờ và ngày tạm ngưng, các kỳ đã mua, số ngày còn lại; danh sách thanh toán thiếu lọc và sắp xếp | DucNV |
| FE-19 | PM dịch vụ | `getEvidence`, bản nháp bảng giá, thu hồi bảng giá | | DucNV |
| FE-20 | Hỗ trợ của Owner | Danh sách trại cho form tạo ticket | `Message` thiếu `author`, `authorRole`, `createdAt`, `kind` | LamKD |
| FE-20 | CS | Danh sách trại, CS, thông báo CS | `processing.action` chỉ khai báo là string, tên hành động đang là phỏng đoán | LamKD |
| FE-21 | PM tài chính | Danh sách trại, danh sách và chi tiết biên nhận, báo cáo mới nhất | Tải XLSX chưa nối vì route trả về bytes | LamKD |
| FE-03, FE-17 | SA | Danh sách người thao tác audit, xuất CSV, kiểm tra lại khi mở thông báo, lọc theo vai trò nền tảng | `AccountSummary`, `AuditEntry` thiếu `emailVerified`, ngày tạo, đăng nhập gần nhất, số trại, vai trò người thao tác, nhãn đối tượng | DucNV |
| FE-01, FE-03 | Tài khoản, trại | | `POST /api/account/profile` mô tả thành `ProfileUpdate` có trường của bò, FE đang gửi `{ fullName, phone }` theo SCR-08; lời mời thiếu ngày tham gia, `invitedBy`, `farmId` | LamKD, DucNV |
| FE-04, FE-05 | Đàn bò, chuồng | Ảnh bò | Kiểm tra chuyển chuồng không trả kết quả theo từng tiêu chí | AnNT |
| FE-06, FE-13 | Nhập, xuất đàn | Ảnh, quét QR, số bê chờ xác nhận, gán bố mẹ cho bê, danh sách vắc-xin, giống, bò bố mẹ | `colourMarkings` gửi đi nhưng không đọc lại được | AnNT |
| FE-11, FE-12 | Sinh sản | Thành viên, bò đực, chuồng và giống, mục đích, ca sức khỏe, tra thẻ tai đã dùng | DTO sửa bản ghi phối thiếu bò đực, tinh, động dục liên kết. Route đã có nhưng màn chưa nối | TuanPQ |
| FE-23 | Thức ăn | Hủy phiên bản và dừng khẩu phần, ghi trả nhà cung cấp, `GET …/feed/receipts/{id}` | Tạo, sửa danh mục, kiểm kê, khẩu phần vẫn bị khóa ở chế độ backend của FE | TaiDX |

## 4. Backend đã có code nhưng chưa kiểm chứng

Từ báo cáo triển khai backend và bàn giao ngày 28–29/10. Mỗi dòng là phần còn thiếu test hoặc chưa làm xong, không phải lỗi đã xác nhận.

| FE | Còn thiếu | Chủ feature |
|---|---|---|
| FE-02 | Test ranh giới thời hạn dịch vụ và chuyển trạng thái; màn lịch sử chuyển trạng thái | DucNV |
| FE-05 | Mã QR duy nhất khi tạo đồng thời; đối chiếu đủ trường SCR-19 | AnNT |
| FE-08 | Fixture và truy vấn dữ liệu lớn cho tổng quan đàn | TuanPQ |
| FE-09 | Test khớp đối tượng tiêm, lọc lịch sử, sửa lịch, khôi phục mũi, ca ON_FARM và HISTORICAL; JOB-01 dời nhắc việc khi đổi lịch; lưu lý do dừng lịch | TuanPQ |
| FE-10 | Test lọc ngày Open / Chronic / Closed, liên kết phản ứng, người ghi và người quan sát, sửa bản ghi, thứ tự ngày đóng ca; ánh xạ đủ MSG-FE10 | TuanPQ |
| FE-11, FE-12 | Các nhánh sửa / hủy của lần đẻ và kết quả bê; đối chiếu đủ trường SCR-38, SCR-39; mọi nơi chọn snapshot tham số theo ngày hiệu lực rồi phiên bản | TuanPQ |
| FE-14 | REM-11 (bữa ăn chưa ghi) chưa có test; JOB-07 bước 4 (nhắc yêu cầu nội bộ sau 4 giờ) chưa có test riêng | TaiDX |
| FE-15 | RPT-03, RPT-04, RPT-06 chưa kiểm bằng số tính tay; phân bổ vỗ béo GBR-107 chưa kiểm mẫu số | TaiDX |
| FE-16 | Fixture luồng kết hợp cho bản ghi sửa đổi của sinh sản, sức khỏe, xuất đàn | AnNT |
| FE-17 | Xuất dữ liệu và hành vi khi kết quả lớn | DucNV |
| FE-18 | Lưu tham số (SCR-56) chưa gọi JOB-01 tính lại nhắc việc tương lai | AnNT |
| FE-19 | Race nhiều transaction: webhook trùng, cùng `Idempotency-Key` | DucNV |
| FE-20 | Ca replay qua REST / security; ánh xạ thông báo theo trường cho yêu cầu nội bộ | LamKD |
| FE-21 | Test nội dung XLSX; race nhiều transaction | LamKD |
| FE-22 | Quản trị nội dung trang giới thiệu (đang tĩnh); test API | LamKD |
| FE-23 | Test hủy phiếu nhập (hoàn tồn và giá vốn; không phân bổ theo lô, D04); test hủy và lịch sử khẩu phần; test đồng thời và phân quyền khi ghi bữa; test xung đột và rollback khi sửa / hủy bữa; test nghiệm thu danh mục | TaiDX |
| Chung | Các controller CRUD do JHipster sinh vẫn còn cạnh route command; cần rà quyền và tenant trước khi mở cho production | Cả nhóm |
| Chung | Google OIDC, SMTP thật, SePay LIVE chưa cấu hình và kiểm thử (xem `docs/LOCAL_SETUP.md` mục 10) | Cả nhóm |
