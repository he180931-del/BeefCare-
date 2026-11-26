# FE-23 giai đoạn 2 — kiểm kê và hạn sử dụng

## Phạm vi đã nối ở frontend

Theo `docs/requirements/specs/FE-23-thuc-an.md` §3.3, §3.4, §6, §7, UC-FE23-01/02/04, SCR-77/79/80, GBR-97/100 và TC-23-08/12/13:

- Màn hình kiểm kê dùng `GET /api/farms/{farmId}/feed/stock` làm số tồn hệ thống và `GET/POST /api/farms/{farmId}/feed/adjustments` cùng `GET /{id}` để đọc/tạo phiếu. Cập nhật nháp dùng `PUT /{id}/draft`; ghi sổ dùng `POST /{id}/post`.
- Adapter ánh xạ tường minh `AdjustmentView` và `AttachmentDTO`; form không thay lỗi backend bằng dữ liệu demo. Mã phiếu được máy chủ cấp trong backend mode. Demo/local mode tiếp tục dùng demo store.
- Request gửi `countDate`, `adjustmentType`, `countedBy`, từng `feedItemId`, `countedKg`, `reason`, và `postNow:false` khi tạo nháp. Lưu nháp/ghi sổ gửi `Idempotency-Key`; cập nhật nháp và ghi sổ gửi `expectedVersion`. Retry cùng ý định giữ nguyên key; upload giữ key theo lựa chọn File đến khi thành công, rồi intent upload sau nhận key mới. Version bị thiếu thì chặn và yêu cầu tải lại.
- Form kiểm ngày không hợp lệ/tương lai, số đếm âm hoặc quá 3 chữ số thập phân, mặt hàng thiếu/trùng, và yêu cầu lý do khi có chênh lệch. `DRAFT` cho phép sửa; phiếu đã ghi chỉ xem. Giá trị server trả về và lỗi nghiệp vụ được giữ để hiển thị, không tự khẳng định việc ghi sổ thành công trước phản hồi.
- API tồn kho có thể trả cả mặt hàng `INACTIVE`, trong khi API kiểm kê chỉ nhận mặt hàng `ACTIVE`. Form mới chỉ gửi mặt hàng đang hoạt động. Nếu một nháp cũ có dòng mặt hàng sau đó bị ngưng, màn hình giữ nguyên dữ liệu và chuyển phiếu sang xem-only để tránh gửi update/post mà backend sẽ từ chối hoặc làm mất dòng.
- Nếu chọn ngày quá khứ hoặc đổi ngày kiểm kê, form báo máy chủ xác định lại tồn ở ngày đó. Khi đọc/lưu nháp, UI dùng `systemKg` và các giá trị chênh lệch từ response của API cho bản nháp đã lưu. Backend tính lại lần nữa khi ghi sổ.
- Attachment theo hợp đồng A7 được nối qua GET/POST/DELETE/download tại `/feed/adjustments/{id}/attachments`. Upload/xóa chỉ ở DRAFT; PDF/JPG tối đa 10 MB; thao tác có key retry. Tệp chờ upload được giữ lại khi request lỗi.
- Nhãn `HSD` được thay bằng `Hạn sử dụng`; ngày hết hạn chỉ cho chọn từ ngày sau ngày nhập. Lỗi cùng ngày hoặc trước ngày nhập được hiển thị cạnh trường; dữ liệu cũ không bị đổi ngầm.

## Cảnh báo hạn dùng theo quyết định D04

Theo `docs/REQUIREMENT_DECISIONS.md` D04 và giả định UC-FE23-02, lô và hạn dùng được ghi trên dòng phiếu nhập để cảnh báo hạn. `StockView.nearestLotNumber` / `nearestLotExpiryDate` là lô có ngày hạn sớm nhất trong 30 ngày trên phiếu nhập `POSTED`; đây là cảnh báo theo chứng từ, không phải số dư còn lại của lô. Tồn kho vẫn là tổng biến động theo kg và giá vốn bình quân gia quyền. Vì thế, không phải thiếu sót của FE-23 hiện tại khi projection không đọc `FeedInventoryLot` / `FeedLotAllocation`, và không được diễn giải cảnh báo này thành tồn theo lô hoặc FEFO.

SCR-77 đã ghi rõ nguồn là phiếu nhập đã ghi sổ trong tiêu đề và ô hạn dùng. Backend không cần thêm tính số dư lô cho yêu cầu đã chốt. Nếu nhóm sau này muốn theo dõi tồn theo lô hoặc FEFO, cần chốt yêu cầu mới trước rồi mới thiết kế backfill, migration mới, các writer tồn kho, DTO và test.

## Hạng mục FE-23 còn phụ thuộc / ngoài patch

- SRS §7 A12 ghi rõ API kế hoạch bữa ăn `GET …/feed/feeding-records/plan` chưa có. `FeedFeedingPage` hiện khóa thao tác ghi/sửa/hủy trong backend mode; cần bổ sung hợp đồng này trước khi nối UI hoàn chỉnh.
- SRS §7 A10 và Q2 ghi thiếu route hủy khẩu phần đã lên lịch / dừng khẩu phần đang hiệu lực; chưa thể hoàn thiện các thao tác đó bằng frontend.
- Spec Q2 liệt kê bỏ nháp phiếu nhập/điều chỉnh như câu hỏi còn mở; A8 hiện chỉ chốt danh sách, tạo, sửa nháp và ghi sổ điều chỉnh, chưa có lệnh bỏ nháp. Không tự thêm route/xóa nháp khi nghiệp vụ chưa chốt; đây là ngoài yêu cầu hiện hành, không phải blocker để hoàn thành FE-23 đã thống nhất. Code đã có `DELETE /feed/receipts/{receiptId}` và nút bỏ nháp phiếu nhập. Form kiểm kê chỉ cho rời màn hình và không giả vờ đã xóa nháp.
- Gói này không triển khai backend, không thực hiện test HTTP/PostgreSQL mới, và không tuyên bố toàn bộ FE-23 hoàn tất. `FE23_PHASE1_HANDOFF.md` ghi Report 5.1/5.2 chưa có workbook chính thức; test frontend ở đây không thay thế việc cập nhật/duyệt các workbook.

## Kiểm chứng gói frontend

Ngày 15/11/2026 đã chạy thêm smoke API trực tiếp trên PostgreSQL 16.15 với DB QA mới riêng, nền `de11943` cùng các thay đổi chưa commit: Owner đăng nhập, đọc tồn, tạo nháp kiểm kê và ghi sổ thành công. Chưa kiểm tệp kiểm kê, phân quyền hoặc thao tác UI trong lượt PostgreSQL này.

Đã thêm unit test adapter cho DTO/route, version và key; test UI backend mode tạo nháp, mở lại, sửa và ghi sổ; test lọc mặt hàng ngưng trong phiếu mới và giữ nháp cũ có mặt hàng ngưng ở chế độ xem; test label/date picker và từ chối hạn dùng cùng ngày nhập. Node API test dùng `createBackendClient` và fetch giả để kiểm tra HTTP method/path, CSRF, version, idempotency và file A7. Các test dùng transport/API mock và dữ liệu tổng hợp, nên chỉ xác nhận request frontend phát ra và cách render UI; chưa chứng minh kết nối runtime tới backend hoặc quyền/persistence thực tế.

- Node 22.22.2: `node node_modules/vitest/vitest.mjs run --passWithNoTests tests/unit/feed-stock --reporter=dot` — 24 file, 114 test đạt. Sau khi thêm kiểm tra retry, chạy lại `node node_modules/vitest/vitest.mjs run tests/unit/feed-stock/FeedStockAdjustmentApi.test.ts --reporter=dot` — 1 file, 8 test đạt; tính cả test mới, 115 ca feed-stock đã được chạy đạt qua hai lượt.
- Node 22.22.2: `node --import tsx --test tests/api/feedStockAdjustmentBackendFlow.test.ts` — 1 test đạt.
- Node 22.22.2: `node node_modules/typescript/bin/tsc --noEmit` — đạt. Dependency `jsqr` đã được cài trong lần `npm ci` của lượt review; lỗi TS2307 cũ không còn tái hiện.
- `git diff --check` — đạt. Vitest vẫn ghi cảnh báo React Router future flags và `act(...)` trong một số test phiếu nhập; không làm suite thất bại.

Đã đối chiếu quyền/route ở mã hiện tại: màn hình quản lý thức ăn nằm dưới `desk` (Owner/Manager); service backend yêu cầu `MANAGE_FEED` cho đọc/tạo/sửa/ghi sổ kiểm kê và thao tác tệp, còn stock projection dùng `VIEW_FEED_STOCK`. Các test frontend lần này không xác thực session, role, farm isolation, DB round-trip hoặc upload bytes trên backend thật; cần backend/API integration evidence cho các điểm đó. Với nháp có mặt hàng bị ngưng, hiện backend không cho update/post; FE giữ dữ liệu read-only. Nếu nghiệp vụ cần hoàn tất các nháp này thì cần backend chốt và hỗ trợ hành vi phù hợp.
