# Đối chiếu màn hình frontend với Figma Redesign — 01/11/2026

## Nguồn và mức kiểm chứng

- SRS hiện hành: `requirements/SRS_2026-10-28.txt`, bảng 5.1-2 (SCR-01–86); quyết định triển khai: `REQUIREMENT_DECISIONS.md`.
- Mã đã đối chiếu: `frontend/src/App.tsx`, `components/Layout.tsx`, `pages/Placeholder.tsx`, `features/` và các REST resources có liên quan.
- Thiết kế: [BeefCare Figma](https://www.figma.com/design/BmFA2ndWI434UHS38zRr3A/BEEFCARE-1--Copy-?node-id=2621-4113). File mở bằng Browser Use ở chế độ Viewer. Các trang Redesign 12, 13, 15, 16, 17, 18, 19, 21, 22 và phạm vi nhóm chính được quan sát trực tiếp; frame SCR-77 `2621:4113` (1440 × 1024) được nhận diện trong Redesign 21. Các frame chi tiết, popup, trạng thái và tương tác còn lại đang được Luna Figma kiểm tra; bảng này chưa xác nhận đã xem hết frame, prototype hay độ khớp pixel với code.

**Chỉ các trang có nhãn Redesign được dùng làm căn cứ thiết kế hiện hành. Các trang không có Redesign là bản cũ và không được dùng làm căn cứ thiết kế.** Các mã SCR trong bảng dưới là phạm vi dự kiến theo tên trang và SRS; đối chiếu frame-to-SCR cụ thể sẽ được cập nhật khi Luna Figma hoàn tất kiểm kê.

“Có mã liên quan” chỉ có nghĩa là đã tìm thấy route, trang, tab hoặc data/API boundary. Nó không chứng minh giao diện khớp Figma, đủ nghiệp vụ, quyền đã đúng hay API đã chạy thành công.

## Bản đồ trang Redesign và frontend

| Trang Figma Redesign đã thấy | Phạm vi SRS dự kiến | Hiện trạng frontend đã đối chiếu |
| --- | --- | --- |
| 12 · Guest – Công khai & Đăng nhập (Redesign) | SCR-01–08 | Chưa có route/trang công khai, đăng ký, xác minh, quên/đặt lại mật khẩu hoặc hoàn tất hồ sơ. `features/authentication/AuthContext.tsx` có form đăng nhập cơ bản trong provider; đây chưa phải các màn hình/luồng SCR còn lại. |
| 13 · Chủ trại – Trại & Thành viên (Redesign) | SCR-09–15, SCR-57–60, SCR-64–66; các frame onboarding, thành viên và hỗ trợ Owner | Chưa có route/trang chọn và đăng ký trại, thông tin trại, thành viên, lời mời/chấp nhận lời mời, đăng ký/gia hạn thanh toán, hoặc hỗ trợ Owner. `features/authorization/AuthGate.tsx` chỉ kiểm tra đã đăng nhập, chưa cung cấp màn hình hay route theo vai trò/trại. |
| 15 · Trại – Tổng quan & Nhắc việc (Redesign) | Nhóm quan sát gồm tổng quan, nhắc việc, thông báo trại, báo cáo và trang chủ Technician; phạm vi SCR dự kiến SCR-26–28, SCR-44, SCR-48–49, SCR-74 | Chưa có route/trang. Backend có resources cho thông báo trại, nhắc việc và dashboard; sự hiện diện của API không đồng nghĩa frontend đã triển khai. Mapping từng frame đến SCR cần hoàn tất. |
| 16 · Trại – Đàn bò, Nhập/Xuất & Chuồng (Redesign) | SCR-17–25, SCR-41–43, SCR-50, SCR-75–76; có biến thể Technician xem đàn bò/hồ sơ | Có route/trang cho chuồng, danh sách/hồ sơ bò, phiếu nhập và phiếu xuất. Hồ sơ có một số tab; tab tăng trưởng, tiêm phòng, sức khỏe và sinh sản hiện dùng `ComingSoon`. Chưa thấy route quét QR SCR-22. Cần so từng trang với Redesign trước khi đánh giá hoàn chỉnh. |
| 17 · Trại – Tăng trưởng, Tiêm phòng & Sức khỏe (Redesign) | SCR-29–37, với các trạng thái xem phù hợp vai trò Technician | Chưa có route/trang riêng; các tab tương ứng trong hồ sơ bò còn là chỗ chờ. Backend có các REST resource về growth, vaccination và health. |
| 18 · Trại – Sinh sản (Redesign) | SCR-38–40, worklist và vòng đời hồ sơ sinh sản; Technician chỉ xem | Chưa có route/trang worklist sinh sản, tab sinh sản hoặc ghi sự kiện đẻ. Backend có các REST resource về reproduction, pregnancy, calving và calf outcomes. |
| 19 · Trại – Danh mục & Tham số (Redesign) | SCR-52–56 | Chưa có route/trang. Backend có REST resource cho danh mục giống/thuốc, danh mục chăm sóc, mục đích nuôi và tham số nhắc việc. |
| 21 · Trại – Quản lý thức ăn (Redesign) | SCR-77–86, gồm stock/receipt/count, rations, feeding, catalogue, report và Technician | Chưa có route/trang thức ăn. Có feature `feed-stock` với type, fixture local, filter và boundary đọc tồn kho SCR-77; chưa có UI, route hay các luồng SCR-78–86. Frame SCR-77 `2621:4113` đã được xác nhận. |
| 22 · Nền tảng – CS, PM, SA (Redesign) | SCR-12, SCR-16, SCR-46–47, SCR-51, SCR-61–73; có vai trò, dialog và trạng thái nền tảng | Chưa có route/trang nền tảng. Backend có resource liên quan đến platform account, audit, farm/service, subscription/payment, plan prices, support và finance. Các frame cụ thể cần tiếp tục đối chiếu với SCR. |

Trong Redesign 21, frame tồn kho `2621:4113` được quan sát ở kích thước 1440 × 1024. Nội dung thấy trực tiếp gồm bảy tab (tồn kho, phiếu nhập, kiểm kê, khẩu phần, nhật ký, danh mục, báo cáo), bốn thẻ tóm tắt, lọc tìm kiếm/nhóm/trạng thái, bảng tồn kho và CTA tạo phiếu nhập/kiểm kê. Đây là kiểm kê cấu trúc từ Figma Viewer, chưa phải kết quả so sánh pixel hay kiểm chứng tương tác prototype.

### Các route và trang đã thấy trong code

`frontend/src/App.tsx` khai báo redirect `/` và các route sau: `/herd-entry`, `/herd-entry/new`, `/herd-entry/:id`, `/herd-exit`, `/herd-exit/new`, `/herd-exit/:id`, `/pens`, `/cattle`, `/cattle/:code`, cùng route `*` sang `pages/Placeholder.tsx`.

Đối chiếu theo SRS: `/pens` có code cho SCR-17; `/cattle` cho SCR-18; `/cattle/:code` có overview và các tab `timeline`, `barns`, `qr` liên quan SCR-19–21/50; phiếu nhập có route cho SCR-23–25/75; phiếu xuất có route cho SCR-41–43/76. Không dùng danh sách route này để khẳng định trạng thái hoặc mọi popup đã hoàn chỉnh.

Các đường dẫn trong menu `Layout.tsx` cho tổng quan, nhắc việc, thông báo, tăng trưởng, tiêm phòng, sức khỏe, sinh sản, thức ăn, báo cáo, danh mục, thành viên, thông tin trại, gói dịch vụ và hỗ trợ hiện rơi vào route `*` và hiển thị `Placeholder`.

## Giới hạn data/API của SCR-77

`features/feed-stock/api/feedStockApi.ts` đọc `GET /api/farms/{farmId}/feed/stock` khi `VITE_BEEFCARE_DATA_SOURCE=backend`; lỗi backend được trả lên và không tự đổi sang mock. Ở local mode, adapter trả fixture tại `features/feed-stock/data/feedStockMock.ts`. Bộ lọc nhóm/trạng thái và tìm kiếm nằm trong cùng feature. Các file đó chưa tạo màn hình SCR-77.

Theo `docs/agent-context/API_RULES.md`, mode chỉ là `backend` khi biến `VITE_BEEFCARE_DATA_SOURCE` bằng `backend`; nếu không, mode chung chọn `local`. Vì vậy, cấu hình mặc định hiện là local, trừ khi biến môi trường đặt rõ thành `backend`. Chưa xác định mode của một tiến trình Vite đang chạy.

### Phát hiện quyền truy cập tồn kho

SRS SCR-77 và GBR-103 giới hạn xem tồn kho cho Owner và Manager; Technician xem khẩu phần và nhật ký cho ăn. Tuy nhiên, `FarmAction.VIEW_FEED` hiện cho phép cả Technician, còn `FeedManagementService.stock()` gọi `access.require(farmId, FarmAction.VIEW_FEED)`. `FarmAccessService.require` còn kiểm tra tư cách thành viên và trạng thái ACTIVE của trại. `AuthGate` ở frontend chỉ xác nhận đăng nhập, không kiểm tra vai trò. Đây là chênh lệch giữa quyền SCR-77 theo SRS và quyền backend hiện tại; cần chuyển cho chủ sở hữu API/backend xử lý trước khi tuyên bố hoàn tất phân quyền. Chỉ ẩn route/tab ở UI không thay thế kiểm soát quyền phía server.

## Thứ tự triển khai đề xuất

1. Hoàn tất đối chiếu frame Redesign và ánh xạ từng frame với SCR, trạng thái, vai trò và tương tác.
2. Ưu tiên một lát độc lập là SCR-77 (tồn kho thức ăn): dùng `features/feed-stock/` cho trang/component/data/API, và `frontend/tests/unit/feed-stock/` cho kiểm tra; điều phối nối route tại `frontend/src/App.tsx` riêng vì đây là file dùng chung.
3. Với các feature tiếp theo, đối chiếu SRS, OpenAPI/DTO, quyền và trạng thái trước khi triển khai. Giữ API adapter và mock sau boundary của feature; không để lỗi backend rơi về mock.
4. Xác minh giao diện theo frame Redesign và viewport quy định trong `RTK.md`. Bảng này chưa phải kiểm thử hình ảnh.

## Trạng thái khảo sát

Checkout `fe/fe23-feed-stock`, HEAD `dec155d37c7e7f5a82ecce5cef8bda303fcaea40`. `frontend/node_modules` chưa có tại lần kiểm tra; bộ kiểm thử Vitest, typecheck và build chưa được xác minh trong checkout này. Kiểm tra nhanh riêng bằng Node của data/API mock không thay thế bộ kiểm thử dự án.
