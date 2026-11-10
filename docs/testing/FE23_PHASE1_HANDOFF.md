# FE-23 giai đoạn 1 — hợp đồng và kiểm tra

Nền khảo sát: `main` `c9d2e63`; mã đang thực hiện trên nhánh `feat/fe23-feed-management`. Phạm vi là tồn kho, danh mục cần cho nhập kho, phiếu nhập và ghi trả nhà cung cấp; không đồng nghĩa toàn bộ FE-23 hoặc FE-14 đã hoàn thiện. Nguồn: quyết định D12, SRS 28/10 mục II.18, III.23–25; `docs/requirements/specs/FE-23-thuc-an.md`, `FE-14-nhac-viec-thong-bao.md`; DTO và resource backend hiện hành.

## Ma trận trường và luồng dữ liệu phiếu nhập

Nguồn yêu cầu: UC-FE23-02, SCR-79, GBR-91/97/99, BR-D34/36/39 và spec FE-23 §3.3, §6, §7. Bảng này phân biệt thiết kế đang triển khai với kết quả đã chứng minh; cột xác minh chỉ được cập nhật sau test thực tế.

| Trường / trạng thái | Quy tắc và đường dữ liệu cần có | Xác minh |
| --- | --- | --- |
| Ngày nhập, nhà cung cấp | Bắt buộc; ngày không tương lai, NCC active thuộc trại. Form → request `receiptDate`, `supplierId` → `feed_receipt` → đọc lại đúng ID và tên. | Luồng hợp lệ đã qua API/PostgreSQL; chưa xác nhận mọi biên. |
| Số hóa đơn, người nhận, nơi lưu, ghi chú | Tùy chọn, tối đa lần lượt 50/100/100/1.000 ký tự. Form → request → `feed_receipt` → response chi tiết. | Đọc lại đúng qua API/PostgreSQL; chưa kiểm mọi giới hạn độ dài. |
| Các dòng thức ăn | Ít nhất một dòng; thức ăn active, số lượng > 0, giá nguyên VND ≥ 0; lô tối đa 30, hạn dùng sau ngày nhập. Lưu `feedItemId`, `lotNumber`, `expiryDate`, `quantityPurchase`, `purchaseUnit`, `unitPrice`; kg và thành tiền do BE tính. Nhiều lô cùng mặt hàng không được tự cấm nếu SRS không yêu cầu. | Đã kiểm hai lô cùng mặt hàng, tồn và hai phát sinh kho qua API/PostgreSQL; chưa khẳng định mọi biên. |
| Phí vận chuyển, tổng, hạn trả | Phí không âm; tổng bằng tiền hàng + phí. Hạn trả tùy chọn được lưu và đọc lại; tồn/công nợ chỉ phát sinh theo trạng thái nghiệp vụ. | Đã kiểm trường hợp hợp lệ qua API/PostgreSQL. |
| Khoản trả ban đầu | `amountPaid` là ý định trả trên form; `method` bắt buộc khi số tiền > 0, ngày hợp lệ, không lớn hơn tổng. DRAFT lưu ý định nhưng không tạo `voucher_payment`; ghi sổ tạo khoản trả và cập nhật tồn/audit trong cùng transaction. | Đã kiểm DRAFT và ghi sổ qua API/PostgreSQL; chưa chứng minh mọi trường hợp lỗi transaction. |
| Khoản trả sau / hủy khoản trả | Endpoint payment phải kiểm quyền/trại, số tiền ≤ nợ, ngày, version và idempotency; hủy có lý do và giữ lịch sử. Response trả lại tổng đã trả và còn nợ từ ledger. | Đã kiểm ghi, lặp, vượt nợ, version cũ và hủy qua API/PostgreSQL. |
| Tệp của phiếu nhập | Invoice/phiếu giao hàng là attachment của phiếu, PDF/JPG ≤10 MB; upload/xóa khi DRAFT, đọc sau ghi sổ. Không nhầm với attachment của từng khoản payment. | Chưa chạy |
| Tệp của khoản trả | SRS phần Voucher Payment có attachment; storage/API gắn riêng từng payment và UI tương ứng cần được kiểm chứng. Không được giả lưu vào attachment của phiếu rồi báo là chứng từ payment. | Đã kiểm tải lên, tải xuống, lặp, nội dung sai và quyền qua API/PostgreSQL; UI có test mock. |
| Dinh dưỡng mặt hàng | `nutritionNote` tùy chọn ≤500 ký tự; danh mục → DTO → `feed_item` → đọc lại; không ép rỗng trong backend mode. | Đã kiểm lưu và đọc lại qua API/PostgreSQL. |
| Quyền, version, lặp và tồn | Owner/Manager thao tác nhập kho/trả NCC; Technician không có quyền tồn kho/phiếu nhập. Tất cả request có farm scope; command có idempotency key, update/post/void dùng version tương ứng; ghi lặp không cộng tồn/trả tiền hai lần. | Đã kiểm Owner hợp lệ, Technician/trại khác bị từ chối và một số trường hợp version/idempotency qua API/PostgreSQL; chưa xác minh đầy đủ mọi vai trò và endpoint. |

## Rà nguồn JOB-01, JOB-07 và API-04

| Thành phần | SRS yêu cầu / dữ liệu liên quan | Quan sát ở nền `c9d2e63` và việc tiếp theo |
| --- | --- | --- |
| JOB-01 / REM-10 | Đánh giá khi tồn thay đổi và định kỳ 15 phút; mặt hàng active có tồn không vượt mức tối thiểu tạo nhắc tồn thấp, khi nhập đủ thì giải quyết. | `ReminderReconciliationService.feedRules` có tính REM-10; `ReminderReconciliationJob` có lịch 15 phút. `FeedManagementService` ghi sự kiện outbox sau khi ghi/hủy phiếu. Chưa tìm thấy lời gọi tính lại theo sự kiện sau commit từ nguồn thức ăn; cần kiểm thử thời gian cập nhật và xử lý ở scope FE-14/JOB-01. Không khẳng định NFR-P07 đã đạt. |
| JOB-01 / REM-11 | Bữa ăn chưa ghi sau giờ khẩu phần 2 tiếng là nguồn nhắc; đã ghi thì giải quyết. | `ReminderReconciliationService.feedRules` có nhánh cho phiên ăn; `docs/requirements/specs/MISSING_ROUTES.md` ghi thiếu test riêng REM-11. Cần kiểm thử ngày/giờ theo múi giờ trại, trạng thái và chạy lặp. |
| JOB-07 | SRS mô tả đọc outbox sau commit, kiểm quyền người nhận, chống trùng và retry; thông báo yêu cầu nội bộ mở quá 4 giờ. | `OutboxService` có polling, claim và retry handler; sự kiện không có handler được giữ pending. Chưa tìm thấy implementation `OutboxEventHandler` trong mã chính; `NotificationService` và `SupportMaintenanceJob` có các cơ chế riêng. Không thêm consumer gửi trùng khi chưa đối chiếu các luồng hiện tại. Cần kiểm chứng luồng event→recipient, hồi phục và chống trùng ở scope FE-14. |
| API-04 email | Email giao sau thay đổi nghiệp vụ đã commit, lỗi gửi không rollback; sandbox tách thông tin thật. | `EmailDeliveryJobService` xử lý hàng đợi và retry, `MockEmailDelivery` cho mock, `SmtpEmailDelivery` cho SMTP/local Mailpit. Cần kiểm thực tế retry/deduplicate và cấu hình; không coi mock hay Mailpit là bằng chứng giao email tới provider thật. |

Các nhận xét về job ở đây là **rà mã**, chưa phải kết quả test JOB-01/JOB-07/API-04. Chỉ chủ động kiểm thử/sửa các luồng ngoài FE-23 khi được đưa vào scope triển khai tương ứng; kết quả không tự suy ra từ việc test phiếu thức ăn.

## Kiểm tra và kết quả

Các case sau là danh sách để cập nhật Report 5.1/5.2; kết quả đã chạy và giới hạn được ghi ở cuối mục này. Mã TC-23 dẫn bộ spec; tiền tố `FE23-API` là case kiểm tra thêm của gói, không tự coi là mã đã chốt bởi SRS.

| ID và tầng | Điều kiện / thao tác | Kết quả mong đợi |
| --- | --- | --- |
| TC-23-01 — API/5.2 | Technician gọi tạo phiếu hoặc đọc tồn kho; Owner/Manager thao tác hợp lệ | Technician bị từ chối; Owner/Manager chỉ thao tác trong trại được phép. |
| TC-23-05 — service/API/5.2 | Lưu phiếu DRAFT có nhiều dòng và khoản dự kiến | Tồn không đổi; không phát sinh khoản trả thực trước ghi sổ. |
| TC-23-06 — unit + DB/5.1–5.2 | Có tồn và giá vốn; ghi sổ phiếu nhập | Tồn và giá vốn bình quân đúng; ghi sổ, payment đầu kỳ và audit theo transaction. |
| TC-23-07/08 — unit/API/5.1–5.2 | Quy đổi bao sang kg; hạn dùng bằng ngày nhập | Kg quy đổi đúng; hạn dùng không hợp lệ bị từ chối. |
| TC-23-09 — unit/API/5.1–5.2 | Khoản trả lớn hơn tổng/còn nợ | Bị từ chối; không lưu payment hoặc dữ liệu dở dang. |
| TC-23-10/11 — DB/5.2 | Hủy phiếu đã ghi khi tồn thiếu/đủ | Thiếu tồn bị từ chối; đủ tồn hủy được, trừ tồn đúng và giữ lịch sử thanh toán. |
| FE23-API-01 — API/5.2 | Đọc lại phiếu và danh mục sau tạo/cập nhật | Các trường nghiệp vụ được lưu và trả lại; trường chưa hỗ trợ phải thông báo rõ. |
| FE23-API-02 — API/DB/5.2 | Gửi lại cùng idempotency key và body cho ghi sổ hoặc ghi trả | Cùng kết quả, không nhân đôi tồn hoặc payment; key cũ với payload khác phải bị từ chối. |
| FE23-API-03 — API/5.2 | Gửi version cũ và dùng tài khoản trại khác | Từ chối thay đổi cũ hoặc truy cập chéo; không lộ hay thay đổi dữ liệu. |

Khi chạy cần ghi UC/BR, commit nền và trạng thái diff, dataset, lệnh, kết quả, phiên bản DB, bước HTTP/UI và readback; phân biệt mock, H2 và PostgreSQL. Chủ feature tự đưa case/kết quả vào Report 5.1, 5.2 và cập nhật tham chiếu trong Report 5.0 II.2.

### Bằng chứng thực hiện ngày 10/11/2026

- Mã nền `c9d2e63`, cùng các thay đổi chưa commit trên `feat/fe23-feed-management`; chưa phải kết quả của một commit đã phát hành.
- Backend: bộ test có chọn lọc 45 test Surefire và 11 integration test Failsafe với H2 đạt; Checkstyle đạt. Modernizer và JaCoCo được bỏ qua trong lượt này, không suy ra toàn bộ test hay coverage của dự án đã đạt.
- Frontend: typecheck và build đạt; 106/106 test trong 23 file `tests/unit/feed-stock` đạt với hai worker, thêm 1 test luồng API adapter đạt. Lượt chạy đồng thời nhiều tác vụ trước đó có một test chờ màn hình quá thời gian; test riêng và toàn bộ nhóm chạy lại đều đạt. Còn cảnh báo React Router/`act` trong log test và cảnh báo kích thước bundle khi build.
- API với PostgreSQL 16.15 riêng: `scripts/tests/fe23_postgres_smoke.py --isolated-db` đạt, sử dụng dữ liệu tổng hợp. Kiểm DRAFT không thay tồn/trả, ghi sổ hai lô, gửi lặp, ghi/hủy khoản trả, vượt nợ/version cũ, upload/download chứng từ khoản trả, quyền Technician và trại khác. Không coi đây là kiểm thử toàn diện tất cả biên hoặc UI end-to-end.
- Migration PostgreSQL: tạo phiếu, khoản trả và tồn bằng backend nền `main`, sau đó khởi chạy bản mới trên cùng DB thử nghiệm; đọc lại phiếu, thanh toán, công nợ và tồn đúng. Đây là một kịch bản nâng cấp đại diện, không bảo đảm mọi dữ liệu lịch sử.
- Report 5.0 II.2 tham chiếu tài liệu bàn giao này. Các workbook Report 5.1 và 5.2 dùng chung chưa có trong repo; bảng case ở trên là nguồn để nhóm chuyển vào workbook, chưa coi là đã điền hoặc duyệt workbook chính thức.
- Cần phối hợp **An** thống nhất quyền sửa đối tác vừa là nhà cung cấp vừa là khách mua: backend nền đang chặn Manager sửa đối tác hai vai trò. Các job và email ở trên mới rà mã, chưa chạy kiểm thử end-to-end.
