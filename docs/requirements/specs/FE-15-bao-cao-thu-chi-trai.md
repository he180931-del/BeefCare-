# SPEC FE-15 — Báo cáo thu chi của trại

| | |
|---|---|
| Quyết định | D86, bổ sung FE-15 |
| Người phụ trách | TaiDX |
| Màn hình | Quản trị → Báo cáo thu chi, `/bao-cao-thu-chi` |
| Nguồn | Bản ghi thanh toán FE-06, FE-13, FE-23 và biên nhận gói FE-19 |

## 1. Phạm vi và quyền

- Trong nhóm **Quản trị**, đổi nhãn **Báo cáo** thành **Báo cáo quản lý**, giữ `/bao-cao` và bảy loại báo cáo hiện có. Thêm **Báo cáo thu chi** ở dòng kế tiếp, trước **Danh mục & Tham số**.
- Chủ trại và Quản lý xem dòng tiền vận hành của trại đang chọn. Chỉ Chủ trại xem khoản đã trả gói dịch vụ của trại đó, theo quyền FE-19. Khi Quản lý chạy báo cáo, API loại cả bộ lọc, dòng và tổng từ nguồn gói dịch vụ. Người ngoài phạm vi, Kỹ thuật viên và vai trò nền tảng không có quyền truy cập theo vai trò đó.
- Màn hình đọc lại chứng từ gốc. Ghi thanh toán, ghi thu, hủy khoản và xem công nợ thực hiện tại màn nghiệp vụ hiện có. Thu chi thủ công FE-21 thuộc nền tảng. Danh mục thuốc, điều trị, giá vốn tiêu thụ, điều chỉnh tồn hoặc dự kiến công nợ chỉ tạo dòng tiền khi đã có nguồn ghi nhận thực thu / thực chi.

## 2. Nguồn và quy tắc tổng hợp

| Nguồn | Hiện | Ngày và điều kiện | Mở chứng từ |
|---|---|---|---|
| `HERD_EXIT` | Thu xuất đàn | Một dòng cho mỗi khoản `COLLECT` / `RECORDED` của phiếu xuất thuộc trại | `/herd-exit/{voucherId}` |
| `HERD_ENTRY` | Chi nhập đàn | Một dòng cho mỗi khoản `PAY` / `RECORDED` của phiếu nhập thuộc trại | `/herd-entry/{voucherId}` |
| `FEED_RECEIPT` | Chi nhập thức ăn | Một dòng cho mỗi khoản `PAY` / `RECORDED` của phiếu nhập thức ăn thuộc trại | `/thuc-an/phieu-nhap/{receiptId}` |
| `SUBSCRIPTION` | Chi gói dịch vụ | Một dòng cho mỗi yêu cầu `PAID` có biên nhận của đúng trại, dùng ngày ngân hàng ghi nhận theo UTC+07:00; chỉ Chủ trại | `/goi-dich-vu/lich-su/{paymentId}?farm={farmId}` |

1. Với ba nguồn phiếu, dùng ngày thanh toán (`paymentDate`), không dùng ngày lập / ghi sổ phiếu. Khoản ban đầu và khoản bổ sung đều lấy từ lịch sử thanh toán và chỉ tính một lần theo mã bản ghi. Tiền ghi theo VND; tổng thu, tổng chi là số không âm. **Dòng tiền ròng = Tổng thu − Tổng chi**. Số ròng âm có nhãn chi nhiều hơn thu.
2. Loại giao dịch `VOIDED`, phiếu nháp, khoản chỉ còn phải trả / phải thu và yêu cầu gói chưa thanh toán. Với biên nhận gói, tái dùng nguồn biên nhận hiện có (một biên nhận / yêu cầu). Không tự lấy ngày gửi yêu cầu làm ngày tiền về. Chứng từ bị hủy nhưng vẫn còn khoản thực thu / thực chi `RECORDED` phải giữ đúng trạng thái khoản tiền, không giả định đã hoàn tiền. Nguồn không có ghi nhận thì không ước tính.
3. Tách chi phí theo lượng thức ăn đã sử dụng khỏi tiền trả nhà cung cấp. Liên kết xem **Báo cáo tiêu thụ thức ăn** phục vụ đối chiếu giá vốn.
4. Chi tiết theo ngày mới nhất trước, thứ tự ổn định khi trùng ngày. Tổng theo toàn bộ kết quả đã lọc, gồm cả các dòng ngoài trang điều hướng hiện tại. Trả trạng thái rỗng riêng khi không có khoản phù hợp; lỗi tải có thể thử lại.

## 3. Giao diện

| Khu vực | Yêu cầu |
|---|---|
| Đầu trang | **Báo cáo thu chi** và tên trại đang xem. |
| Kỳ & bộ lọc | Từ ngày, Đến ngày, Nguồn, Thu / Chi / Tất cả, nút **Xem báo cáo**. Mặc định từ đầu tháng đến hôm nay, lịch nghiệp vụ UTC+07:00, kỳ tối đa 24 tháng, không chọn ngày tương lai. Bộ lọc trên kết quả phản ánh lần chạy gần nhất. |
| Tổng quan | Ba ô Bento: **Tổng thu**, **Tổng chi**, **Dòng tiền ròng**. Dùng VND, phân cách hàng nghìn, không hiện mã enum. |
| Chi tiết | Bảng **Ngày, Khoản, Chứng từ, Hình thức, Số tiền**, hoặc cùng dữ liệu theo thẻ trên màn hẹp. Thu/chi có nhãn chữ. Có nút **Xem chứng từ**. Bảng nhiều dòng dùng phân trang. |
| Đối chiếu | Link ngắn đến Nhập đàn, Xuất đàn, Phiếu nhập thức ăn, Báo cáo tiêu thụ thức ăn và Lịch sử thanh toán gói nếu có quyền. Các màn nguồn giữ luồng ghi thu, chi và công nợ. |
| Kiểu trình bày | Tái dùng `FarmPlatformLayout`, `PageHeader`, `Panel`, ô chỉ số, bảng và trạng thái của BeefCare. Dùng nền, màu brand, khoảng cách và kiểu chữ hiện tại. |

## 4. Hợp đồng

`GET /api/farms/{farmId}/dashboard/cash-flow?from=YYYY-MM-DD&to=YYYY-MM-DD&source=…&direction=…&page=0&size=20`.

- `source` và `direction` tùy chọn (nguồn theo bảng trên, chiều `IN` / `OUT`). `page` bắt đầu từ 0, `size` mặc định 20, tối đa 100. Backend xác thực quyền của trại trong path, khoảng ngày và bộ lọc. Yêu cầu trại / nguồn vượt quyền bị từ chối theo cơ chế hiện có.
- Phản hồi `FarmCashFlowView {generatedAt, totalIncome, totalExpense, netCashFlow, totalElements, items[]}`. Mỗi dòng có `id, source, direction, cashDate, amountVnd, documentId, documentCode, method`, trong đó `documentId` dùng mở chứng từ theo loại nguồn và `method` có thể rỗng. `id` duy nhất trong từng nguồn.
- Tổng và chi tiết lấy từ cùng phạm vi lọc. Không phụ thuộc mock trong chế độ backend. Không yêu cầu migration hay ghi thêm bản sao giao dịch.

## 5. Tiêu chí nghiệm thu

| Mã | Thao tác và kết quả |
|---|---|
| TC-15-26 | Chủ trại / Quản lý mở Quản trị và thấy hai mục độc lập. Bản cũ `/bao-cao` vẫn đúng 7 loại; mục mới mở đúng trại. |
| TC-15-27 | Một khoản thu xuất, hai lần trả cho cùng phiếu nhập và một trả thức ăn: cộng đúng tiền đã ghi, theo ngày thanh toán, không cộng thêm tổng phiếu. |
| TC-15-28 | Có nháp, khoản chưa trả, khoản hủy và giá vốn tiêu thụ: các giá trị đó không xuất hiện trong dòng tiền. |
| TC-15-29 | Biên nhận gói đã xác nhận ở sát ranh giới ngày VN: Chủ trại thấy một dòng chi ngày ngân hàng ghi nhận; Quản lý không thấy dòng hoặc tiền gói trong tổng. |
| TC-15-30 | Khác trại hoặc Technician gọi API: bị từ chối. Mở chứng từ theo dòng hợp lệ vào đúng phiếu của trại. |
| TC-15-31 | Lọc ngày / nguồn / chiều, đổi trang, thử kỳ sai và kỳ rỗng: số tổng theo cả bộ lọc, kết quả không chồng dữ liệu khi đổi trại. |
