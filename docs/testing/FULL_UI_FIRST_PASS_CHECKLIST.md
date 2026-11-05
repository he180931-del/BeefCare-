# BeefCare full UI first-pass checklist

Ngày lập: 02/11/2026  
Nguồn: `frontend/src/app/screenManifest.ts` và SRS 2026-11-01.

## Checkpoint giao diện ngày 05/11/2026

- Đã loại fallback quản trị chăm sóc cũ trong bộ điều phối màn hình; các màn chăm sóc tiếp tục đi qua renderer chuyên biệt theo manifest, tránh quay về giao diện bảng/thẻ cũ khi chuyển route.
- Các vùng chung của bò, nhập/xuất đàn và chuồng được làm phẳng thành đường phân tách ngang, bỏ nền trắng, viền bo và khung lồng nhau không cần thiết. Bảng chuồng cũng bỏ lớp bao bọc thứ hai.
- Màn đăng nhập chỉ giữ email/mật khẩu; nhận diện BeefCare dùng logo thật, tên sản phẩm lớn hơn. Đăng ký vẫn giữ lựa chọn đăng nhập Google tách riêng. Landing được tổ chức lại theo hành trình: giá trị, ba nhóm công việc, sau đó CTA rõ ràng.
- Component nút dùng chung bổ sung phản hồi hover/focus theo đúng ngữ nghĩa: nút chính đậm hơn, nút thường đổi viền/nền, nút nguy hiểm tối hơn và liên kết nhận nền nhấn. Trạng thái disabled không nhận tương tác.
- Các ô số liệu `Tile` dùng chung được đổi từ card trắng bo viền sang nhịp chỉ số có dải phân cách dọc. Nhờ vậy các dashboard/list page giữ mật độ thông tin nhưng không tạo các lớp khung kép.
- Bảng dùng chung mặc định hiển thị 15 dòng trên desktop/tablet (8 dòng trên mobile) rồi dùng phân trang đánh số. Điều này giới hạn chiều cao bảng dài mà không ẩn dữ liệu hoặc thay bằng cuộn trang ngang.
- `SCR-90` không còn đẩy thông tin chi tiết xuống cuối danh sách: nút `Chi tiết` mở popup có tiêu đề, mô tả và đóng bằng Esc/nút Đóng. Dòng dữ liệu thử chỉ xem trong popup; bản ghi thật có thêm hành động đi đến đối soát. `ActionDialog` dùng chung bổ sung cờ ẩn nút xác nhận để phục vụ popup chỉ đọc mà không tạo hai nút đóng trùng nhau.
- Các worklist vận hành dùng renderer chung cũng không còn cuộn xuống vùng chi tiết cuối trang: nút `Mở` bật popup. Dòng thử chỉ xem; dòng cục bộ thật có nút `Đánh dấu hoàn tất`, cập nhật trạng thái vào kho local như luồng cũ và phản hồi thành công ngay trong popup.
- Worklist nền tảng cũng chỉ mở chi tiết khi người dùng bấm `Mở`; không còn tự chọn hàng đầu tiên khi vào màn. Popup có hành động `Đánh dấu đã khớp` hoặc `Đánh dấu hoàn tất` cho bản ghi cục bộ thật và giữ dữ liệu mô phỏng ở chế độ chỉ xem.
- Với thay đổi worklist nền tảng, `git diff --check`, `npm run typecheck` và `npm run build` đều đạt; cảnh báo duy nhất là chunk `ScreenPreviewPage` lớn hơn 500 kB.
- Với thay đổi worklist, `git diff --check`, `npm run typecheck` và `npm run build` đều đạt; cảnh báo duy nhất là chunk `ScreenPreviewPage` lớn hơn 500 kB.
- Lượt typecheck đầu của popup lỗi vì import nhầm `ActionDialog` từ `components/ui`; đã chuyển về `components/workspace`. Lượt `git diff --check`, `npm run typecheck` và `npm run build` sau đó đều đạt.
- Lượt build đầu cho checkpoint phân trang bị lớp theo dõi dừng sau bước transform, nên không được tính là đạt. Đã chạy lại riêng `npm run build`: hoàn tất thành công; `npm run typecheck` và `git diff --check` cũng đạt. Cảnh báo chunk lớn giữ nguyên như đã biết.
- `git diff --check`, `npm run typecheck` và `npm run build` đều đạt. Cổng xem trước `http://127.0.0.1:4175/ui/scr-02` trả HTTP 200. Vite vẫn cảnh báo chunk `ScreenPreviewPage` lớn hơn 500 kB; đây là hạng mục tối ưu bundle còn mở, không phải lỗi biên dịch hoặc giao diện runtime.

## Cách đọc

- “Có thể mở” nghĩa là route có chủ sở hữu giao diện và được kiểm tra bằng manifest/unit test.
- `backend` là màn đang nối API thật; `hybrid` kết hợp API và phần giao diện bổ sung; `fixture` hiện dùng dữ liệu cục bộ để hoàn thiện UI trước khi nối API.
- Các màn fixture chưa được xem là hoàn thiện nghiệp vụ backend; dữ liệu cục bộ chỉ phục vụ duyệt luồng giao diện trong giai đoạn này.
- Trạng thái “chờ duyệt hình ảnh” sẽ được thay bằng bằng chứng runtime theo viewport sau khi chạy trình duyệt.

## Bằng chứng runtime ngày 03–04/11/2026

- Đã mở tuần tự đủ `SCR-01` đến `SCR-122` ở `1180×820` và `768×1024` bằng trình duyệt cục bộ.
- Ngày 04/11 đã quét lại đủ 122 màn ở `1180×820` và `1440×900`: không có màn rỗng, không có tràn ngang và console không phát sinh lỗi. Các màn bị giới hạn vai trò hiển thị trạng thái không có quyền thay vì tải dở hoặc màn trắng.
- Các route trực tiếp `/pens`, `/herd-entry/new`, `/herd-entry/:id`, `/herd-exit`, `/herd-exit/new`, `/herd-exit/:id`, `/cattle` và `/cattle/:code` đã được kiểm tra chuyển sang đúng màn local-first, giữ tham số định danh và không phát sinh HTTP request tới `/api/*`.
- Luồng bấm chính từ danh sách đã được kiểm tra: tạo/sửa chuồng, tạo/xem phiếu nhập và tạo/xem phiếu xuất mở đúng màn; nút Hủy ở ba biểu mẫu quay về danh sách cố định, không phụ thuộc lịch sử trình duyệt.
- Mỗi màn được kiểm tra: route tải xong, không rơi vào trang không có quyền ngoài dự kiến, có nội dung hoặc hành động chính, không kẹt trạng thái đang tải và không làm `document.scrollWidth` vượt viewport.
- Kiểm tra trực quan bổ sung: `SCR-104` ở `1180×820` có thanh điều hướng kỹ thuật viên một hàng; `SCR-111`, `SCR-113` và `SCR-66` ở `820×1180` không cắt trường cuối, nút hành động hoặc cột nội dung.
- `SCR-113` được kiểm tra cả đầu và cuối trang; vùng bảng responsive có `scrollWidth = clientWidth = 772px`, footer hành động vẫn nhìn thấy.
- `SCR-02`, `SCR-03` và `SCR-07` được duyệt ở `820×1180`; biểu mẫu phẳng, hành động chính rõ và lỗi bắt buộc hiển thị theo từng trường.
- `SCR-76` được duyệt với vai trò PM ở `820×1180`; menu nền tảng thu gọn thành nút trượt trên iPad dọc, không còn chiếm nửa màn hình, nội dung đối soát đã dùng nhãn tiếng Việt.
- `SCR-111` và `SCR-112` được duyệt với vai trò Chủ trại ở `820×1180`; nhóm thức ăn, đơn vị và trạng thái phiếu đã được Việt hóa, bảng chuyển sang dạng hàng dọc không cần cuộn ngang.
- `SCR-91`, `SCR-92`, `SCR-96`, `SCR-97` và `SCR-99` được duyệt ở `820×1180` theo đúng vai trò PM/CS; bộ lọc, bảng responsive và vùng xử lý không tràn ngang, nhãn kỹ thuật quan trọng đã được Việt hóa.
- `SCR-01`, `SCR-04`, `SCR-10`, `SCR-20` và `SCR-21` được duyệt ở `820×1180` theo đúng vai trò công khai/Chủ trại/SA; không có nội dung kiểm thử lộ ra và các bảng tự chuyển sang dạng đọc dọc.
- `SCR-22` đến `SCR-25` được duyệt với vai trò Chủ trại ở `820×1180`; danh sách chuồng chuyển thành hàng dọc dễ đọc, các biểu mẫu phẳng, cảnh báo đúng ngữ cảnh và không có lớp khung lồng nhau dư thừa.
- `SCR-33` đến `SCR-37` được duyệt với vai trò Chủ trại ở `820×1180`; danh sách, tạo phiếu, điều chỉnh, đăng ký bê và dòng bò đều không tràn ngang. Trạng thái, cách tính giá và số tiền còn phải trả đã dùng nhãn tiếng Việt trong khi vẫn giữ enum lưu trữ.
- `SCR-38` đến `SCR-41` được duyệt ở `820×1180` theo vai trò Chủ trại/Quản lý sau khi đưa renderer Thông báo chuyên biệt lên trước fallback tổng quát; luồng danh sách, soạn, xem lại và đính chính đều hiển thị đúng giao diện feature.
- `SCR-42` đến `SCR-45` được duyệt với vai trò Quản lý ở `820×1180`; danh sách, hồ sơ tăng trưởng, ghi số đo và sửa bản ghi đều không tràn ngang. Ngày nhập đàn tương lai bị loại khỏi dữ liệu hiển thị, thuật ngữ kỹ thuật đã được Việt hóa và màn sửa được kiểm tra với bản ghi thật.
- `SCR-46` đến `SCR-52` được duyệt với vai trò Quản lý ở `820×1180`; lịch, cấu hình, ghi nhận, hồ sơ cá thể, hoãn mũi, lịch sử toàn đàn và hiệu chỉnh đều không tràn ngang. Trạng thái nội bộ được chuyển thành nhãn nghiệp vụ và tên lịch thân thiện thay cho mã kỹ thuật.
- `SCR-53` đến `SCR-58` được duyệt với vai trò Quản lý ở `820×1180`; danh sách, hồ sơ, mở ca, tái khám, điều trị và cập nhật trạng thái đều không tràn ngang. Các trạng thái, đường dùng thuốc, lịch sử chỉnh sửa và vai trò người ghi đã dùng nhãn nghiệp vụ tiếng Việt; route sâu thiếu ca được chọn hiển thị trạng thái rỗng an toàn, không phát sinh lỗi console.
- `SCR-59` đến `SCR-68` được duyệt với vai trò Quản lý ở `820×1180`; danh sách công việc, hồ sơ sinh sản, động dục, phối giống, khám thai, thai kỳ và sinh bê đều không tràn ngang. Nguồn dữ liệu, trạng thái bò, thai kỳ và lịch sử thay đổi đã dùng nhãn nghiệp vụ tiếng Việt; 10 màn không phát sinh lỗi console.
- `SCR-69` đến `SCR-72` được duyệt với vai trò Chủ trại ở `820×1180`; danh sách, tạo phiếu, xác nhận chết/mất và hủy phiếu đều không tràn ngang. Trạng thái nội bộ và thuật ngữ kỹ thuật đã được đổi thành nhãn nghiệp vụ; các màn ghi nhận dùng dữ liệu cục bộ và không phát sinh lỗi console.
- `SCR-73` đến `SCR-75` được duyệt ở `820×1180` theo đúng vai trò Chủ trại/Chăm sóc khách hàng; bộ lọc và bảng thông báo chuyển thành dạng đọc dọc, không tràn ngang. Loại nhắc việc, nguồn dữ liệu và thông báo phân công đã được Việt hóa; không phát sinh lỗi console.
- `SCR-81` đến `SCR-85` được duyệt với vai trò Chủ trại ở `820×1180`; năm màn danh mục và tham số đều không tràn ngang, bảng chuyển thành hàng dọc và biểu mẫu sửa vẫn dễ quét. Trạng thái, nhóm tham số, ghi chú nguồn và thuật ngữ sinh sản đã được Việt hóa; không phát sinh lỗi console.
- `SCR-86` đến `SCR-90` được duyệt ở `820×1180` theo đúng vai trò Chủ trại/Quản lý nền tảng; gói dịch vụ, chọn kỳ hạn, hướng dẫn chuyển khoản, lịch sử và sổ đăng ký đều không tràn ngang. Trạng thái thanh toán, kỳ dịch vụ và tiến độ đã dùng nhãn nghiệp vụ tiếng Việt; không phát sinh lỗi console.
- `SCR-93` đến `SCR-95` và `SCR-98` được duyệt ở `820×1180` theo vai trò Chủ trại/Chăm sóc khách hàng; danh sách, biểu mẫu gửi, trao đổi và điều kiện đóng đều không tràn ngang. Trạng thái, lịch sử hành động và thông báo điều kiện đã dùng ngôn ngữ nghiệp vụ; không phát sinh lỗi console.
- Hộp thoại hủy phiếu tại `SCR-112` được kiểm tra bằng bàn phím: `Escape` đóng hộp thoại và trả focus về đúng nút đã mở hộp thoại.
- Đây là bằng chứng duyệt runtime thủ công có hỗ trợ script, **không phải** bộ kiểm thử hồi quy hình ảnh tự động.

## Nhật ký lệnh kiểm tra ngày 05/11/2026

- `npm --prefix frontend run typecheck`: đạt sau khi tách adapter dữ liệu mô phỏng cho trang trại, dịch vụ, thành viên và lời mời.
- `npm --prefix frontend run build`: đạt; còn cảnh báo chunk `ScreenPreviewPage` lớn hơn 500 kB như checkpoint trước.
- Playwright `SCR-15` tại `1440×1000`: hiển thị `100` thành viên, phân trang `25` dòng/trang, các dòng mô phỏng bị khóa thao tác và console có `0` lỗi.
- Playwright `SCR-01` tại `1440×1000` và `390×844`: landing không tràn ngang, menu desktop/mobile đúng breakpoint và console có `0` lỗi.
- Lần gọi Playwright đầu tiên trong sandbox thất bại với `EPERM` khi ghi daemon vào `~/Library/Caches/ms-playwright`; chạy lại bằng quyền đã duyệt thì đạt. Đây là lỗi quyền công cụ kiểm tra, không phải lỗi ứng dụng.
- Lần khởi động Vite bổ sung báo cổng `4175` đang được dùng và tự chuyển sang `4176`; kiểm tra tiến trình cho thấy server đúng worktree đã chạy sẵn tại `4175`, nên giữ server `4175` làm bản người dùng duyệt.
- `npm --prefix frontend run typecheck`: đạt sau khi thêm adapter 100 dòng mô phỏng cho tài khoản và quyền nhân sự nền tảng; dữ liệu mô phỏng không tham gia thao tác ghi localStorage.
- `npm --prefix frontend run build`: đạt; cảnh báo duy nhất vẫn là chunk `ScreenPreviewPage` lớn hơn 500 kB, chưa ảnh hưởng runtime giao diện.
- Lệnh Playwright đầu tiên cho `SCR-20` báo phiên `beefcare-account` chưa mở; lần mở tiếp theo trong sandbox thất bại `EPERM` khi ghi cache daemon. Mở lại bằng quyền công cụ đã duyệt thì đạt; đây là lỗi phiên/công cụ kiểm tra, không phải lỗi ứng dụng.
- Fixture kiểm tra `SCR-20` ban đầu đặt sai ở cấp gốc của `beefcare-ui-demo`, nên ứng dụng vẫn đọc vai trò Chủ trại trong `state` và hiển thị đúng màn từ chối quyền. Sau khi đặt đúng `version: 1` và `state.role: sa`, `SCR-20`/`SCR-21` hiển thị đủ 100 dòng, tự phân trang theo breakpoint và console có `0` lỗi.
- `npm --prefix frontend run typecheck`: đạt sau khi bổ sung adapter 100 dòng cho sổ đăng ký dịch vụ `SCR-90`; dòng mô phỏng chỉ dùng kiểm tra mật độ và bị khóa thao tác chi tiết.
- `npm --prefix frontend run build`: đạt cho checkpoint `SCR-90`; cảnh báo duy nhất vẫn là chunk `ScreenPreviewPage` lớn hơn 500 kB.

| Mã | Màn hình | Feature sở hữu | Kiểu | Dữ liệu | Route/owner | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| SCR-01 | Trang giới thiệu BeefCare | account | public | fixture | /ui/scr-01 | Đã duyệt manual · 820×1180 · nội dung mở, không tràn ngang |
| SCR-02 | Đăng nhập | account | public | hybrid | /ui/scr-02 | Đã duyệt manual · 820×1180 · lỗi theo trường rõ ràng |
| SCR-03 | Đăng ký Chủ trại | account | form | fixture | /ui/scr-03 | Đã duyệt manual · 1180×820 và 820×1180 · không tràn ngang |
| SCR-04 | Xác minh email | account | public | fixture | /ui/scr-04 | Đã duyệt manual · 820×1180 · bỏ điều khiển kiểm thử khỏi giao diện |
| SCR-05 | Quên mật khẩu | account | form | fixture | /ui/scr-05 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-06 | Đặt mật khẩu mới | account | form | fixture | /ui/scr-06 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-07 | Hoàn thiện hồ sơ Chủ trại | account | form | fixture | /ui/scr-07 | Đã duyệt manual · 820×1180 · biểu mẫu phẳng, hành động rõ |
| SCR-08 | Hồ sơ và quyền của tôi | account | detail | fixture | /ui/scr-08 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-09 | Đổi mật khẩu | account | form | fixture | /ui/scr-09 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-10 | Chọn trang trại | farm | list | fixture | /ui/scr-10 | Đã duyệt manual · Chủ trại · 820×1180 · danh sách dọc, không tràn ngang |
| SCR-11 | Đăng ký trang trại | farm | form | fixture | /ui/scr-11 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-12 | Thông tin trang trại | farm | detail | fixture | /ui/scr-12 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-13 | Tổng quan dịch vụ trang trại | farm | detail | fixture | /ui/scr-13 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-14 | Tạm ngừng hoặc khôi phục dịch vụ | farm | form | fixture | /ui/scr-14 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-15 | Thành viên và vai trò | membership | list | fixture | /ui/scr-15 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-16 | Mời thành viên | membership | form | fixture | /ui/scr-16 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-17 | Lời mời vào trang trại | membership | list | fixture | /ui/scr-17 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-18 | Đổi vai trò hoặc ngừng thành viên | membership | form | fixture | /ui/scr-18 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-19 | Chấp nhận lời mời | membership | form | fixture | /ui/scr-19 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-20 | Tài khoản người dùng | platform-access | workbench | fixture | /ui/scr-20 | Đã duyệt manual · SA · 820×1180 · bảng responsive, không tràn ngang |
| SCR-21 | Quyền nhân sự nền tảng | platform-access | workbench | fixture | /ui/scr-21 | Đã duyệt manual · SA · 820×1180 · hành động và cảnh báo rõ |
| SCR-22 | Chuồng trại | pen-management | list | backend | /pens | Đã duyệt manual · Chủ trại · 820×1180 · danh sách responsive, thao tác rõ |
| SCR-23 | Tạo hoặc sửa chuồng | pen-management | form | backend | /ui/scr-23 | Đã duyệt manual · Chủ trại · 820×1180 · biểu mẫu phẳng, không tràn ngang |
| SCR-24 | Ngừng hoặc mở lại chuồng | pen-management | form | backend | /ui/scr-24 | Đã duyệt manual · Chủ trại · 820×1180 · cảnh báo ngữ cảnh, hành động gọn |
| SCR-25 | Chuyển chuồng cho bò | pen-management | form | hybrid | /ui/scr-25 | Đã duyệt manual · Chủ trại · 820×1180 · bố cục phẳng, không tràn ngang |
| SCR-26 | Danh sách đàn bò | cattle | list | backend | /cattle | Đã duyệt manual · Chủ trại · 820×1180 · localStorage, bảng responsive, không tràn ngang |
| SCR-27 | Tổng quan hồ sơ bò | cattle | detail | backend | /cattle/:code | Đã duyệt manual · Chủ trại · 820×1180 · thông tin cá thể rõ, không lỗi xác thực |
| SCR-28 | Lịch sử chuồng | cattle | detail | hybrid | /ui/scr-28 | Đã duyệt manual · Chủ trại · 820×1180 · lịch sử và tiêu chí chuồng rõ |
| SCR-29 | Thẻ QR của bò | cattle | detail | hybrid | /ui/scr-29 | Đã duyệt manual · Chủ trại · 820×1180 · trạng thái QR Việt hóa |
| SCR-30 | Cập nhật hồ sơ bò | cattle | form | backend | /ui/scr-30 | Đã duyệt manual · Chủ trại · 820×1180 · biểu mẫu theo nhóm, không tràn ngang |
| SCR-31 | Cấp hoặc thay thẻ QR | cattle | form | hybrid | /ui/scr-31 | Đã duyệt manual · Chủ trại · 820×1180 · hành động và lỗi theo trường rõ |
| SCR-32 | Quét mã QR | cattle | mobile | fixture | /ui/scr-32 | Đã duyệt manual · Chủ trại · 820×1180 · trạng thái quét và tra cứu rõ |
| SCR-33 | Danh sách phiếu nhập đàn | herd-entry | list | backend | /herd-entry | Đã duyệt manual · Chủ trại · 820×1180 · trạng thái và số tiền rõ ràng |
| SCR-34 | Tạo phiếu nhập mua ngoài | herd-entry | form | backend | /herd-entry/new | Đã duyệt manual · Chủ trại · 820×1180 · biểu mẫu phẳng, không tràn ngang |
| SCR-35 | Điều chỉnh hoặc hủy phiếu nhập | herd-entry | form | backend | /ui/scr-35 | Đã duyệt manual · Chủ trại · 820×1180 · bố cục responsive, trạng thái Việt hóa |
| SCR-36 | Đăng ký bê sinh tại trại | herd-entry | form | hybrid | /ui/scr-36 | Đã duyệt manual · Chủ trại · 820×1180 · danh sách bê và trường phân chuồng rõ |
| SCR-37 | Thông tin từng con trong phiếu nhập | herd-entry | form | backend | /ui/scr-37 | Đã duyệt manual · Chủ trại · 820×1180 · cảnh báo chuồng và trường điều kiện rõ |
| SCR-38 | Thông báo trang trại | announcement | list | fixture | /ui/scr-38 | Đã duyệt manual · 820×1180 · renderer feature, bộ lọc và trạng thái rõ |
| SCR-39 | Soạn thông báo | announcement | form | fixture | /ui/scr-39 | Đã duyệt manual · Chủ trại · 820×1180 · soạn thảo và chọn người nhận đầy đủ |
| SCR-40 | Xem lại và phát hành thông báo | announcement | detail | fixture | /ui/scr-40 | Đã duyệt manual · Quản lý · 820×1180 · nội dung và lịch sử phẳng, dễ đọc |
| SCR-41 | Đính chính thông báo | announcement | form | fixture | /ui/scr-41 | Đã duyệt manual · Quản lý · 820×1180 · quyền tác giả và trạng thái vô hiệu rõ |
| SCR-42 | Cân nặng và thể trạng | growth | list | fixture | /ui/scr-42 | Đã duyệt manual · Quản lý · 820×1180 · bộ lọc và chỉ số rõ, không tràn ngang |
| SCR-43 | Tăng trưởng và thể trạng của bò | growth | detail | fixture | /ui/scr-43 | Đã duyệt manual · Quản lý · 820×1180 · biểu đồ, lịch sử và nhãn nghiệp vụ rõ |
| SCR-44 | Ghi nhận cân nặng và BCS | growth | form | fixture | /ui/scr-44 | Đã duyệt manual · Quản lý · 820×1180 · biểu mẫu phẳng, ngày nhập đàn hợp lệ |
| SCR-45 | Sửa hoặc loại trừ số đo tăng trưởng | growth | form | fixture | /ui/scr-45 | Đã duyệt manual · Quản lý · 820×1180 · mở đúng bản ghi, đối chiếu trước/sau rõ |
| SCR-46 | Lịch tiêm phòng | vaccination | list | fixture | /ui/scr-46 | Đã duyệt manual · Quản lý · 820×1180 · lịch và tiến độ responsive, không tràn ngang |
| SCR-47 | Quản lý lịch tiêm | vaccination | form | fixture | /ui/scr-47 | Đã duyệt manual · Quản lý · 820×1180 · phạm vi áp dụng và hành động rõ |
| SCR-48 | Ghi nhận tiêm phòng | vaccination | form | fixture | /ui/scr-48 | Đã duyệt manual · Quản lý · 820×1180 · biểu mẫu nhiều cá thể phẳng, dễ quét |
| SCR-49 | Lịch sử tiêm của bò | vaccination | detail | fixture | /ui/scr-49 | Đã duyệt manual · Quản lý · 820×1180 · liều đã lên lịch và lịch sử rõ |
| SCR-50 | Hoãn mũi tiêm | vaccination | form | fixture | /ui/scr-50 | Đã duyệt manual · Quản lý · 820×1180 · lý do và ngày dự kiến rõ |
| SCR-51 | Lịch sử tiêm phòng | vaccination | list | fixture | /ui/scr-51 | Đã duyệt manual · Quản lý · 820×1180 · bộ lọc và bảng responsive |
| SCR-52 | Sửa hoặc hủy bản ghi tiêm | vaccination | form | fixture | /ui/scr-52 | Đã duyệt manual · Quản lý · 820×1180 · bản ghi gốc và phiên bản sửa rõ |
| SCR-53 | Ca bệnh và điều trị | health | list | fixture | /ui/scr-53 | Đã duyệt manual · 820×1180 · không tràn ngang |
| SCR-54 | Sức khỏe và điều trị của bò | health | detail | fixture | /ui/scr-54 | Đã duyệt manual · 820×1180 · có trạng thái rỗng an toàn |
| SCR-55 | Mở ca bệnh | health | form | fixture | /ui/scr-55 | Đã duyệt manual · 820×1180 · không tràn ngang |
| SCR-56 | Ghi nhận tái khám | health | form | fixture | /ui/scr-56 | Đã duyệt manual · 820×1180 · không tràn ngang |
| SCR-57 | Ghi nhận điều trị | health | form | fixture | /ui/scr-57 | Đã duyệt manual · 820×1180 · có trạng thái rỗng an toàn |
| SCR-58 | Cập nhật hoặc đóng ca bệnh | health | form | fixture | /ui/scr-58 | Đã duyệt manual · 820×1180 · có trạng thái rỗng an toàn |
| SCR-59 | Danh sách công việc sinh sản | reproduction | list | fixture | /ui/scr-59 | Đã duyệt manual · Quản lý · 820×1180 · danh sách responsive, không tràn ngang |
| SCR-60 | Hồ sơ sinh sản của bò | reproduction | detail | fixture | /ui/scr-60 | Đã duyệt manual · Quản lý · 820×1180 · nguồn dữ liệu và trạng thái rõ |
| SCR-61 | Ghi nhận động dục | reproduction | form | fixture | /ui/scr-61 | Đã duyệt manual · Quản lý · 820×1180 · biểu mẫu phẳng, không tràn ngang |
| SCR-62 | Ghi nhận phối giống | reproduction | form | fixture | /ui/scr-62 | Đã duyệt manual · Quản lý · 820×1180 · biểu mẫu phẳng, không tràn ngang |
| SCR-63 | Sửa hoặc hủy động dục, phối giống | reproduction | form | fixture | /ui/scr-63 | Đã duyệt manual · Quản lý · 820×1180 · bản ghi gốc và lịch sử rõ |
| SCR-64 | Khám thai | reproduction | form | fixture | /ui/scr-64 | Đã duyệt manual · Quản lý · 820×1180 · không tràn ngang |
| SCR-65 | Cập nhật thai kỳ | reproduction | form | fixture | /ui/scr-65 | Đã duyệt manual · Quản lý · 820×1180 · trạng thái thai kỳ Việt hóa |
| SCR-66 | Ghi nhận sinh bê | reproduction | form | fixture | /ui/scr-66 | Đã duyệt manual · Quản lý · 820×1180 · thông tin bê và kết quả rõ |
| SCR-67 | Sửa hoặc hủy kết quả khám thai | reproduction | form | fixture | /ui/scr-67 | Đã duyệt manual · Quản lý · 820×1180 · phiên bản chỉnh sửa rõ |
| SCR-68 | Sửa hoặc hủy thai kỳ, sinh bê | reproduction | form | fixture | /ui/scr-68 | Đã duyệt manual · Quản lý · 820×1180 · hành động và cảnh báo rõ |
| SCR-69 | Danh sách phiếu xuất đàn | herd-exit | list | backend | /herd-exit | Đã duyệt manual · Chủ trại · 820×1180 · bảng responsive, trạng thái rõ |
| SCR-70 | Tạo phiếu xuất đàn | herd-exit | form | backend | /herd-exit/new | Đã duyệt manual · Chủ trại · 820×1180 · biểu mẫu phẳng, không tràn ngang |
| SCR-71 | Phiếu xuất do chết hoặc thất lạc | herd-exit | form | backend | /ui/scr-71 | Đã duyệt manual · Chủ trại · 820×1180 · kiểm tra và hành động rõ |
| SCR-72 | Hủy phiếu xuất đàn | herd-exit | form | backend | /ui/scr-72 | Đã duyệt manual · Chủ trại · 820×1180 · hoàn tác chuồng và cảnh báo rõ |
| SCR-73 | Nhắc việc trang trại | reminder | list | fixture | /ui/scr-73 | Đã duyệt manual · Chủ trại · 820×1180 · bộ lọc và danh sách responsive |
| SCR-74 | Thông báo của tôi | notification | list | fixture | /ui/scr-74 | Đã duyệt manual · Chủ trại · 820×1180 · nhóm thông báo và trạng thái rõ |
| SCR-75 | Thông báo hỗ trợ | support | workbench | fixture | /ui/scr-75 | Đã duyệt manual · CS · 820×1180 · phân công và hành động rõ |
| SCR-76 | Thông báo đối soát | finance | workbench | fixture | /ui/scr-76 | Đã duyệt manual · PM · 820×1180 · menu thu gọn, nhãn Việt hóa |
| SCR-77 | Tổng quan trang trại | dashboard | dashboard | fixture | /ui/scr-77 | Đã duyệt manual · 1440x900 và 1180x820 · không tràn ngang |
| SCR-78 | Báo cáo quản trị | report | report | fixture | /ui/scr-78 | Đã duyệt manual · Chủ trại · 820×1180 · bộ lọc mở, báo cáo responsive |
| SCR-79 | Dòng thời gian hồ sơ bò | cattle | detail | fixture | /ui/scr-79 | Đã duyệt manual · Chủ trại · 820×1180 · thuật ngữ Việt hóa, không tràn ngang |
| SCR-80 | Lịch sử kiểm tra | audit | workbench | fixture | /ui/scr-80 | Đã duyệt manual · SA · 100 dòng trong khoảng mặc định, phân trang và nhãn Việt hóa |
| SCR-81 | Danh mục giống bò | catalogue | catalogue | fixture | /ui/scr-81 | Đã duyệt manual · Chủ trại · 820×1180 · danh sách và biểu mẫu responsive |
| SCR-82 | Danh mục vaccine | catalogue | catalogue | fixture | /ui/scr-82 | Đã duyệt manual · Chủ trại · 820×1180 · trường vaccine đầy đủ, không tràn ngang |
| SCR-83 | Danh mục thuốc | catalogue | catalogue | fixture | /ui/scr-83 | Đã duyệt manual · Chủ trại · 820×1180 · danh sách và biểu mẫu responsive |
| SCR-84 | Danh mục mục đích nuôi | catalogue | catalogue | fixture | /ui/scr-84 | Đã duyệt manual · Chủ trại · 820×1180 · trạng thái và phạm vi dùng rõ |
| SCR-85 | Tham số trạng thái và nhắc việc | catalogue | catalogue | fixture | /ui/scr-85 | Đã duyệt manual · Chủ trại · 820×1180 · nhóm tham số Việt hóa, không tràn ngang |
| SCR-86 | Gói dịch vụ trang trại | subscription | detail | fixture | /ui/scr-86 | Đã duyệt manual · Chủ trại · 820×1180 · tóm tắt và giá gói rõ, không tràn ngang |
| SCR-87 | Chọn kỳ hạn và xem lại đăng ký | subscription | form | fixture | /ui/scr-87 | Đã duyệt manual · Chủ trại · 820×1180 · lựa chọn kỳ hạn và xem lại rõ |
| SCR-88 | Hướng dẫn chuyển khoản | subscription | detail | fixture | /ui/scr-88 | Đã duyệt manual · Chủ trại · 820×1180 · thông tin chuyển khoản và tiến độ rõ |
| SCR-89 | Lịch sử và chi tiết thanh toán | subscription | list | fixture | /ui/scr-89 | Đã duyệt manual · Chủ trại · 820×1180 · bộ lọc và danh sách responsive |
| SCR-90 | Quản lý đăng ký dịch vụ | platform-subscription | workbench | fixture | /ui/scr-90 | Đã duyệt manual · PM · 820×1180 · sổ đăng ký responsive, trạng thái Việt hóa |
| SCR-91 | Thanh toán và đối soát | platform-finance | workbench | fixture | /ui/scr-91 | Đã duyệt manual · PM · 820×1180 · nhãn Việt hóa, không tràn ngang |
| SCR-92 | Bảng giá gói dịch vụ | platform-subscription | workbench | fixture | /ui/scr-92 | Đã duyệt manual · PM · 820×1180 · form và lịch sử rõ ràng |
| SCR-93 | Yêu cầu hỗ trợ của tôi | support | list | fixture | /ui/scr-93 | Đã duyệt manual · Chủ trại · 820×1180 · bộ lọc và danh sách responsive |
| SCR-94 | Tạo yêu cầu hỗ trợ | support | form | fixture | /ui/scr-94 | Đã duyệt manual · Chủ trại · 820×1180 · biểu mẫu phẳng, trường bắt buộc rõ |
| SCR-95 | Chi tiết yêu cầu hỗ trợ | support | detail | fixture | /ui/scr-95 | Đã duyệt manual · Chủ trại · 820×1180 · trao đổi, kết quả và lịch sử rõ |
| SCR-96 | Hàng đợi hỗ trợ | support | workbench | fixture | /ui/scr-96 | Đã duyệt manual · CS · 820×1180 · bảng dọc, thuật ngữ Việt hóa |
| SCR-97 | Xử lý yêu cầu hỗ trợ | support | workbench | fixture | /ui/scr-97 | Đã duyệt manual · CS · 820×1180 · bố cục xử lý phẳng, không tràn ngang |
| SCR-98 | Đóng yêu cầu hỗ trợ | support | form | fixture | /ui/scr-98 | Đã duyệt manual · CS · 820×1180 · điều kiện đóng và hành động rõ |
| SCR-99 | Công việc nội bộ được giao | platform-work | workbench | fixture | /ui/scr-99 | Đã duyệt manual · PM · 820×1180 · form và bảng không tràn ngang |
| SCR-100 | Biên nhận đăng ký dịch vụ | finance | list | fixture | /ui/scr-100 | Đã duyệt manual · PM · 820×1180 · bộ lọc, chi tiết biên nhận rõ, không tràn ngang |
| SCR-101 | Sổ thu chi thủ công | finance | workbench | fixture | /ui/scr-101 | Đã duyệt manual · PM · 820×1180 · bộ lọc và danh sách responsive, không tràn ngang |
| SCR-102 | Tạo hoặc sửa bản ghi thu chi | finance | form | fixture | /ui/scr-102 | Đã duyệt manual · PM · 820×1180 · biểu mẫu phẳng và lịch sử rõ, không tràn ngang |
| SCR-103 | Báo cáo tiền mặt nền tảng | finance | report | fixture | /ui/scr-103 | Đã duyệt manual · PM · 820×1180 · tiêu chí và trạng thái rỗng rõ, không tràn ngang |
| SCR-104 | Trang chủ kỹ thuật viên | technician | mobile | fixture | /ui/scr-104 | Đã duyệt manual · 390x844 · không tràn ngang |
| SCR-105 | Nhập danh sách bò từ Excel | herd-entry | form | backend | /ui/scr-105 | Đã duyệt manual · Chủ trại · 820×1180 · tệp mẫu, giới hạn và kết quả kiểm tra rõ |
| SCR-106 | Chi tiết phiếu nhập đàn | herd-entry | detail | backend | /herd-entry/:id | Đã duyệt manual · Chủ trại · 820×1180 · trạng thái có dữ liệu, bảng và thanh toán rõ |
| SCR-107 | Ghi nhận thanh toán phiếu | payment | form | hybrid | /ui/scr-107 | Đã duyệt manual · Chủ trại · 820×1180 · tóm tắt và biểu mẫu thanh toán gọn |
| SCR-108 | Hủy phiếu nhập đàn | herd-entry | form | backend | /ui/scr-108 | Đã duyệt manual · Chủ trại · 820×1180 · kiểm tra phụ thuộc và cảnh báo Việt hóa |
| SCR-109 | Chọn bò để xuất đàn | herd-exit | list | backend | /ui/scr-109 | Đã duyệt manual · Chủ trại · 820×1180 · bộ lọc và danh sách responsive, không tràn ngang |
| SCR-110 | Chi tiết phiếu xuất đàn | herd-exit | detail | backend | /herd-exit/:id | Đã duyệt manual · Chủ trại · 820×1180 · trạng thái có dữ liệu, tiền thu và lịch sử rõ |
| SCR-111 | Tồn kho thức ăn | feed | list | fixture | /ui/scr-111 | Đã duyệt manual · Chủ trại · 820×1180 · không tràn ngang |
| SCR-112 | Phiếu nhập thức ăn | feed | list | fixture | /ui/scr-112 | Đã duyệt manual · 820×1180 · trạng thái Việt hóa, dialog trả focus |
| SCR-113 | Tạo hoặc sửa phiếu nhập thức ăn | feed | form | fixture | /ui/scr-113 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-114 | Điều chỉnh tồn kho | feed | form | fixture | /ui/scr-114 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-115 | Khẩu phần ăn | feed | list | fixture | /ui/scr-115 | Đã duyệt manual · Chủ trại · 820×1180 · empty state rõ, không tràn ngang |
| SCR-116 | Soạn khẩu phần | feed | form | fixture | /ui/scr-116 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-117 | Nhật ký cho ăn | feed | list | fixture | /ui/scr-117 | Đã duyệt manual · Quản lý · 820×1180 · bộ lọc gọn, không tràn ngang |
| SCR-118 | Ghi nhận lần cho ăn | feed | form | fixture | /ui/scr-118 | Đã duyệt manual · Quản lý · 820×1180 · form gọn, hành động rõ |
| SCR-119 | Sửa hoặc hủy lần cho ăn | feed | form | fixture | /ui/scr-119 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-120 | Danh mục thức ăn và nhà cung cấp | feed | catalogue | fixture | /ui/scr-120 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-121 | Báo cáo tiêu thụ và chi phí thức ăn | feed | report | fixture | /ui/scr-121 | Đã duyệt manual · iPad dọc không tràn ngang |
| SCR-122 | Khẩu phần hôm nay | feed | mobile | fixture | /ui/scr-122 | Đã duyệt manual · iPad dọc không tràn ngang |

## Bổ sung kiểm tra ngày 04/11/2026

- `SCR-111` tại `820×1180`: trang rộng đúng 820 px; bảng chuyển sang dạng nhãn–giá trị, không mất cột; vùng bảng giữ `overflow-x: auto` làm phương án an toàn thay vì cắt nội dung.
- `SCR-113` tại `820×1180`: hai bảng nhập thức ăn chuyển sang bố cục dọc; phần tử chứa và nội dung bảng đều rộng 772 px, không tràn trang.
- `SCR-70` tại `820×1180`: thông tin phiếu, tóm tắt và danh sách bò đủ điều kiện xếp dọc, không tràn ngang.
- `SCR-34 → SCR-37`: luồng “+ Thêm bò” mở đúng màn thông tin từng con; footer hành động nằm trong viewport và trường cảnh báo chuồng hiển thị theo ngữ cảnh.
- Các popup Excel và sửa dòng bò dùng `dvh` thay cho `vh`, tránh bị che footer khi trình duyệt di động thay đổi vùng hiển thị.
- Tiêu đề màn có nhãn nhỏ `Bản xem trước · dữ liệu cục bộ` để không gây hiểu nhầm đây là dữ liệu backend thật.
- Bảng responsive dùng lưới nhãn–giá trị có cột nhãn tối thiểu; các control nhiều dòng cùng nằm thẳng trong cột giá trị thay vì làm vỡ nhãn.
- Quét lại `122/122` màn tại `820×1180` và `1440×900`: không có màn tràn ngang. 9 màn lazy-load được kiểm tra lại với 300 ms đều có nội dung và heading cấp 1.
- 5 màn luồng chính (`SCR-34`, `SCR-70`, `SCR-77`, `SCR-111`, `SCR-113`) không có input/select/textarea/button thiếu nhãn truy cập.
- Quét mở rộng đủ `122/122` màn: không còn `input`, `select`, `textarea`, `button` hoặc liên kết có thể thao tác bị thiếu tên truy cập. Các trường bảng động tại `SCR-70`, `SCR-113`, `SCR-114` được đặt nhãn theo chứng từ, số dòng hoặc mặt hàng cụ thể.
- Khung Chủ trại, nền tảng và Kỹ thuật viên có liên kết “Bỏ qua điều hướng”; kiểm tra bàn phím đưa focus đến `main#main-content` và liên kết nổi cố định, không đẩy bố cục.
- Tìm bò toàn cục đã được nối với danh sách bò: mã hồ sơ `BC-000125` và mã QR `QR-7F3K-0125` đều đưa tới `SCR-26`, giữ từ khóa trên URL và lọc đúng một hồ sơ.
- Tên trang trại trên thanh đầu trang lấy từ lựa chọn cục bộ hiện tại và là liên kết đổi trang trại thật; chọn xong quay lại đúng màn trước thay vì luôn chuyển về Tổng quan. Lựa chọn cũng cập nhật vai trò phiên local: trại Kỹ thuật viên mở đúng `SCR-104`, trại Chủ trại mở đúng `SCR-77`, không còn lỗi chặn quyền do giữ vai trò cũ.
- Các trạng thái rỗng của tài khoản/nền tảng không còn hiển thị nút “Xóa bộ lọc” giả; trạng thái rỗng lời mời mở đúng màn `SCR-16`.
- Quét bổ sung đủ `122/122` màn tại `390×844`: không có màn tràn ngang hoặc vùng nội dung chính rỗng. Đây là bằng chứng manual Playwright cho khả năng co hẹp, không phải bộ visual-regression tự động.
- Footer bảng responsive xử lý đúng `colSpan`: `SCR-113` chỉ hiển thị tiêu đề “Tổng”, “Số lượng” và “Thành tiền”; `SCR-121` giữ đủ 11 chỉ số tổng hợp với nhãn tương ứng. Hai màn đều không tràn ngang tại `390×844`, còn bảng `SCR-113` tại `1440×900` vẫn giữ bố cục một hàng như desktop.
- `npm run typecheck` và `npm run build` đều đạt. Build còn cảnh báo kích thước chunk `ScreenPreviewPage` lớn hơn 500 kB; đây là việc tối ưu bundle, không phải lỗi giao diện/runtime.

## Bổ sung kiểm tra ngày 05/11/2026

- `SCR-90` và `SCR-91` được mở rộng thành 100 hàng mô phỏng chỉ để kiểm tra mật độ, phân trang và responsive; các hàng sinh thêm không ghi vào localStorage và không đi qua API lưu.
- Nút `Chi tiết` tại `SCR-90` và `Mở` tại `SCR-91` mở đúng vùng chi tiết, tự cuộn đến nội dung và đánh dấu dữ liệu thử ở chế độ chỉ xem thay vì để nút bất hoạt.
- Bộ lọc `SCR-91` tách đúng trạng thái chứng từ và trạng thái yêu cầu thanh toán; các nhãn `PENDING_MATCH`, `RECEIVED` và trạng thái thanh toán đã được Việt hóa theo đúng ngữ cảnh.
- Phân trang bảng dùng cửa sổ 5 số trang cạnh nút Trước/Sau, có trạng thái trang hiện tại và `aria-current`, giúp chuyển nhanh khi kiểm tra bảng 100 hàng.
- `SCR-99` giữ nguyên dữ liệu nghiệp vụ cục bộ; khi bấm `Mở`, trang tự cuộn tới vùng xử lý bên dưới để phản hồi thao tác được nhìn thấy ngay.
- `npm run typecheck`, `npm run build` và `git diff --check` đều đạt. Build vẫn còn cảnh báo chunk `ScreenPreviewPage` lớn hơn 500 kB; chưa coi đây là lỗi chặn checkpoint giao diện.
- `SCR-100` hiển thị 100 biên nhận mô phỏng chỉ đọc, có tổng tiền theo bộ lọc, 13 trang và phần chi tiết đầy đủ; chọn nguồn từ biên nhận mở đúng chứng từ mô phỏng tương ứng tại `SCR-91` ở chế độ chỉ xem.
- `SCR-103` được kiểm tra với bản chụp 51 giao dịch: bảng theo ngày và bảng chi tiết đều có phân trang số, tổng hợp phạm vi và biểu đồ không tràn bố cục desktop.
- `SCR-120` cho phép mở chi tiết cả 100 hàng kiểm tra mật độ. Hàng mô phỏng được đánh dấu `Dữ liệu thử · chỉ xem`, khóa toàn bộ trường và không có hành động lưu; hàng thật vẫn dùng đúng biểu mẫu có thể sửa theo quyền, nên dữ liệu thử không thể lọt vào localStorage nghiệp vụ.
- Sau thay đổi `SCR-120`, `npm run typecheck`, `npm run build` và `git diff --check` đều đạt. Build chỉ còn cảnh báo chunk `ScreenPreviewPage` lớn hơn 500 kB như checkpoint trước.
- `SCR-20` và `SCR-21` được kiểm tra trực tiếp bằng Playwright với vai trò SA và 100 dòng: mọi hàng đều có nút `Xem chi tiết`; hàng mô phỏng mở vùng chỉ đọc có nhãn rõ, không hiển thị nút thay đổi trạng thái hoặc lưu quyền và không ghi localStorage.
- `SCR-21` khởi tạo đúng hành động `Đổi` hoặc `Khôi phục` khi tài khoản đã có quyền; chỉ nút `Cấp quyền nền tảng` mới chuyển biểu mẫu sang hành động `Cấp`.
- `SCR-10`, `SCR-13`, `SCR-15` và `SCR-17` được kiểm tra trực tiếp bằng Playwright: hàng mô phỏng đều mở vùng thông tin chỉ đọc, không còn nút `Mô phỏng` bị vô hiệu. So sánh phần `account` trong `beefcare-ui-demo` trước và sau thao tác cho cả bốn màn đều không đổi.
- Các hành động nghiệp vụ trên bốn màn tài khoản vẫn tách riêng cho dữ liệu thật: vào trại/thanh toán, tạm ngừng hoặc xem gói, đổi vai trò và gửi lại/hủy lời mời.
- Màn đăng nhập thật trong `AuthProvider` được kiểm tra qua production preview (không dùng màn fixture): bố cục chia đôi tại `1180×820`, bố cục tablet tại `820×1180` và bố cục một cột tại `390×844` đều không tràn ngang hoặc dọc ngoài ý muốn.
- Ở cả ba viewport, tiêu đề, email, mật khẩu, nút hiện/ẩn mật khẩu và nút đăng nhập đều hiển thị và có tên truy cập. Bản DEV tại `/ui/*` vẫn giữ cơ chế bypass xác thực phục vụ duyệt giao diện; không thay đổi logic này để tạo bằng chứng giả.
- Sau khi thiết kế lại màn đăng nhập, `npm run typecheck`, `npm run build` và `git diff --check` đều đạt. Cảnh báo duy nhất vẫn là kích thước chunk `ScreenPreviewPage` lớn hơn 500 kB.
- Landing `SCR-01` chuyển phần minh họa hero từ dashboard dựng bằng HTML sang ảnh chụp đúng màn Tổng quan trang trại cục bộ. Ảnh chỉ là bằng chứng sản phẩm; CTA “Mở màn tổng quan” vẫn điều hướng đến màn hoạt động thật.
- `AccountScreens.test.tsx` đạt `27/27`, bao gồm ảnh sản phẩm có alt text và CTA hero. Lượt kiểm tra Playwright đa viewport sau thay đổi bị công cụ từ chối trước khi khởi chạy do hết hạn mức phiên, nên chưa ghi nhận là bằng chứng runtime mới.
- `SCR-80` giữ nguyên thời gian của bản ghi thật; 100 bản ghi mô phỏng được đặt trong khoảng bảy ngày mặc định để kiểm tra bộ lọc, mật độ và phân trang mà không ghi ngược vào localStorage.
- Test tập trung `PlatformScreens.test.tsx` đạt `7/7`, bao gồm trạng thái chỉ xem, trạng thái rỗng và xác nhận đủ 100 dòng trong bộ lọc mặc định.
- `SCR-01` dùng logo thật ở đầu/cuối trang, tăng diện tích nhận diện thương hiệu và làm phẳng khung xem trước sản phẩm (bỏ hai lớp bo góc và bóng đổ lồng nhau). Nút trong khung mở được tổng quan thật thay vì chỉ trang trí.
- Landing được kiểm tra trực tiếp tại `1440×900` và `390×844`: không tràn ngang; logo, menu mobile, liên kết điều hướng và nút “Mở tổng quan thật” đều hiển thị/hoạt động. Đây là kiểm tra runtime thủ công bằng Playwright, không phải visual-regression tự động.
- `SCR-111`: các hàng tồn kho mô phỏng không còn nút `Nhập` bị vô hiệu; thay bằng nhãn dữ liệu thử và nút `Xem chi tiết` mở vùng đọc-only. Kiểm tra runtime có 12 nút chi tiết trên trang hiện tại, vùng chi tiết hiển thị đúng và không tràn ngang tại `1180×820`.
- `SCR-112`: mã phiếu mô phỏng không giả làm liên kết chỉnh sửa; hành động ghi dữ liệu được thay bằng nhãn `Dữ liệu thử · chỉ xem`, trong khi nút `Thanh toán / lịch sử` vẫn mở được lịch sử thanh toán. So sánh giá trị `beefcare.preview.feed.v2` trước/sau thao tác ở cả `SCR-111` và `SCR-112` đều không đổi.
- Khi mở lịch sử của phiếu mô phỏng tại `SCR-112`, giao diện hiện cảnh báo chỉ xem và không render các nút `Ghi thêm thanh toán`, `Hủy phiếu` hoặc `Hủy khoản thu`. Kiểm tra runtime xác nhận cả ba loại nút đều có số lượng `0` trong vùng chi tiết dữ liệu thử; phiếu thật vẫn giữ các hành động theo quyền.
- Lần chạy đầu của `tests/unit/account/AccountScreens.test.tsx` thất bại `25/26` do test cũ render màn tài khoản ngoài `Router` sau khi luồng điều hướng thật được bổ sung. Sau khi thêm đúng `MemoryRouter` và `FixtureSessionProvider`, còn `5` ca thất bại vì nội dung kỳ vọng đã cũ; đây là lỗi bộ kiểm tra, không phải lỗi runtime.
- Bộ kiểm tra tài khoản đã được đồng bộ với nội dung hiện hành và bổ sung hai ca cho luồng xác minh email: xác minh thành công lưu trạng thái rồi chuyển đến hồ sơ Chủ trại; gửi lại email làm sạch liên kết hết hạn. Kết quả cuối: `26/26` ca đạt.
- `SCR-06` không còn lộ nút nội bộ dùng để ép liên kết sang trạng thái hết hạn. Trạng thái hợp lệ chỉ hiển thị thời hạn 30 phút và cảnh báo kết thúc phiên; trạng thái hết hạn mới hiện hành động gửi liên kết mới. Bộ test tài khoản vẫn đạt `26/26` và typecheck đạt.
- Dữ liệu thử của thông báo được mở rộng theo từng màn `SCR-73…76`, thay vì chia chung 100 dòng cho bốn loại. Kiểm tra runtime tại `SCR-76` với vai trò PM xác nhận tiêu đề `100 thông báo`, bảng chỉ render 25 dòng/trang và hiện đủ nút trang `1–4`, Trước/Sau.
- Test mới cho `SCR-73` và `SCR-76` xác nhận mỗi bảng có 100 dòng riêng, thanh phân trang hiển thị tổng 100 dòng và trang 1 có `aria-current`; kết quả `2/2` ca đạt. Đây là test hành vi bảng, không phải visual-regression tự động.
- Popup ghi nhận thu tiền phiếu xuất không còn nút `Xem` sao kê bất hoạt. Nút mở vùng xem trước cục bộ gồm tên tệp, tham chiếu và số tiền; người dùng có thể đóng xem trước hoặc xóa tệp. Hai test local/backend của `CollectModal` đều đạt (`2/2`), đồng thời xác nhận dữ liệu mô phỏng không xuất hiện khi chạy chế độ backend.
- `SCR-38` mở rộng riêng danh sách thông báo đã nhận thành 100 dòng để kiểm tra mật độ và phân trang responsive. Các dòng sinh thêm chỉ tồn tại ở lớp hiển thị; khi người dùng bấm `Mở`, đúng dòng đó mới được vật hóa vào localStorage rồi chuyển sang chi tiết, tránh cả lưu 100 bản ghi giả lẫn nút dẫn tới màn rỗng.
- Bộ test thông báo xác nhận bảng 100 dòng, phân trang đánh số và thao tác mở dòng mô phỏng có dữ liệu chi tiết tương ứng; kết quả `4/4` ca đạt.
- `SCR-77` dùng thống nhất thuật ngữ `Giai đoạn sinh trưởng` ở cả nhãn nhìn thấy, tên truy cập và mô tả cơ cấu đàn; không còn sót `Giai đoạn sống`. Test insight bỏ số liệu mẫu cố định đã lỗi thời và kiểm tra theo ngữ nghĩa dữ liệu cục bộ hiện hành.
- `SCR-89` mở rộng lịch sử thanh toán của trang trại đang chọn thành 100 dòng để kiểm tra bộ lọc, mật độ và phân trang. Chỉ bản ghi thật đang chờ mới có hành động `Mở lại`; dòng mô phỏng luôn chỉ có `Xem`, mở chi tiết tại chỗ và không ghi `activePaymentId` hay dữ liệu nghiệp vụ vào localStorage. Test hành vi mới đạt `1/1` và typecheck đạt.
- Các worklist vận hành dùng chung nay mở rộng đến 100 hàng kiểm tra mật độ và phân trang, nhưng chỉ lưu các bản ghi người dùng tự tạo vào `beefcare-operational-preview.v1`. Hàng sinh thêm có nhãn chỉ xem, không thể đổi trạng thái và không bị ghi lẫn vào dữ liệu nghiệp vụ.
- Nút hành động của worklist không còn là nút trang trí: `Mở` cuộn đến chi tiết tương ứng; biểu mẫu tạo bản ghi ghi vào localStorage; bản ghi thật có thể đổi sang `Đã hoàn tất`. Bộ lọc đặt cùng một thanh, không bọc thêm thẻ biểu mẫu gây tách dòng không cần thiết.
- Lượt test đầu của `OperationalScreens.test.tsx` phát hiện hai assertion cũ: một assertion đòi `role=search` dù thanh lọc không còn là form, và một assertion giả định chỉ có một chuỗi trạng thái. Đã thay bằng assertion cho ô tìm kiếm có nhãn và sự hiện diện của trạng thái; kết quả cuối `4/4` đạt. `npm run typecheck`, `npm run build` và `git diff --check` đều đạt; build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` lớn hơn 500 kB.
- `SCR-122` không còn nút “Ghi nhận đã cho ăn” không phản hồi: thao tác cập nhật đúng dòng khẩu phần thành hoàn tất, hiện thông báo và lưu riêng trong `beefcare-technician-rations.v1`. Trạng thái chỉ xem vẫn không hiện nút ghi.
- Test kỹ thuật viên ban đầu có năm ca thiếu `MemoryRouter`, nên dừng ở lỗi `useNavigate` trước khi render UI. Đã dùng helper Router chung và đồng bộ test quét mã với mã bò hiện có `BC-000203`; kết quả cuối `6/6` đạt. `npm run typecheck`, `npm run build` và `git diff --check` đều đạt; build chỉ còn cảnh báo chunk `ScreenPreviewPage` lớn hơn 500 kB.
- Các nhắc việc tại `SCR-104` nay là vùng chạm thật, có trạng thái focus và mở chi tiết ngay trong luồng thay vì chỉ hứa “chạm để mở”. Test bổ sung xác nhận mở `KT-01`; kết quả kỹ thuật viên cuối `7/7` đạt cùng `npm run typecheck` và `git diff --check`. Lượt assertion đầu gặp hai vị trí cùng chứa đối tượng nhắc việc sau khi vùng chi tiết được mở, đã đổi thành kiểm tra đúng cả hai ngữ cảnh hiển thị.
- Các worklist nền tảng dùng chung (`SCR-91` và các màn cùng cấu trúc) nay có 100 dòng mô phỏng, phân trang, tìm kiếm/lọc trạng thái, nút `Mở` và vùng chi tiết. Hàng mô phỏng chỉ để thử mật độ; chỉ bản ghi người dùng tạo được lưu ở khóa `beefcare-platform-work-preview.v1` và mới có thể đánh dấu hoàn tất/đã khớp.
- Nút chính của worklist không còn đứng yên: mở biểu mẫu cục bộ với ba trường rõ ràng, kiểm tra đủ trường trước khi lưu, cập nhật danh sách và chọn ngay bản ghi vừa tạo. Test đầu tiên thất bại đúng kỳ vọng do chưa có phân trang/hành vi tạo; sau khi triển khai, `PlatformScreens.test.tsx` đạt `8/8`. Một assertion cũ về trạng thái được điều chỉnh sang kiểm tra nhiều phần tử vì trạng thái hiện xuất hiện hợp lệ cả trong bộ lọc lẫn các nhãn bảng.
- Màn hồ sơ bò không còn có tab và nút cập nhật tĩnh: năm phần hồ sơ thay đổi nội dung ngay tại chỗ, nút lịch chăm sóc chuyển đúng sang phần sức khỏe, còn biểu mẫu cập nhật lưu tên gọi và ghi chú vào `beefcare-record-preview.v1` rồi phản ánh ở tiêu đề. Test RED ban đầu không thấy heading `Sinh sản` sau khi bấm tab; sau thay đổi, `RecordScreens.test.tsx` đạt `3/3`.
- Khi chuyển chi tiết tài khoản nền tảng sang popup, lượt `npm run typecheck` đầu tiên dừng ở lỗi `ActionDialog` vẫn bắt buộc `onConfirm` cho một popup chỉ xem. Component đã được điều chỉnh để callback xác nhận là tùy chọn; lượt kiểm tra lại được ghi ở checkpoint kế tiếp.
- `SCR-20` nay không tự mở một tài khoản mặc định hoặc cuộn xuống cuối trang: người dùng bấm `Xem chi tiết` để mở dialog, đóng dialog trả lại đúng bảng và các thao tác thay đổi trạng thái thật vẫn giữ trong cùng dialog. `npm run typecheck` và `npm run build` đã đạt sau thay đổi; build chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- `SCR-21` không còn tự render biểu mẫu quyền dưới bảng hoặc tự cuộn cuối trang. `Cấp quyền nền tảng` và `Xem chi tiết` cùng mở dialog có chủ đích; hàng mô phỏng vẫn chỉ xem, hàng thật vẫn lưu ở `beefcare-platform-access-demo`. `npm run typecheck`, `npm run build` và `git diff --check` đều đạt; build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- `SCR-10` mở thông tin của trang trại mô phỏng trong dialog chỉ đọc thay vì cuộn đến một khối ở cuối danh sách. Hành động với trang trại thật vẫn chuyển đúng vào trại, thanh toán, gia hạn hoặc hỗ trợ theo trạng thái dịch vụ. `npm run typecheck`, `npm run build` và `git diff --check` đều đạt; build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- `SCR-13` mở chi tiết trang trại mô phỏng bằng dialog chỉ đọc. Nút trên hàng thật vẫn dẫn đến luồng tạm ngừng/khôi phục hoặc màn gói dịch vụ tương ứng, còn bộ lọc và bảng dịch vụ giữ nguyên. `npm run typecheck`, `npm run build` và `git diff --check` đều đạt; build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- `SCR-15` mở thông tin thành viên mô phỏng bằng dialog chỉ đọc, thay cho khối nội dung ở cuối danh sách. Hành động đổi vai trò/ngừng/kích hoạt lại của thành viên thật vẫn điều hướng sang luồng quản trị thành viên. `npm run typecheck`, `npm run build` và `git diff --check` đều đạt; build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- Điều tra hiện tượng nháy khi mở `Đàn bò`, `Chuồng trại`, `Xuất đàn` xác định nguyên nhân là ba mục menu đi qua route cũ (`/cattle`, `/pens`, `/herd-exit`) rồi mới `Navigate` sang màn preview. Menu nay đi trực tiếp tới `SCR-26`, `SCR-22`, `SCR-69`; các route cũ vẫn giữ lại để tương thích liên kết cũ.
- Danh sách đàn có 100 hồ sơ cục bộ nhưng có thể hiện 0 dòng khi bộ lọc lưu trước đó không còn khớp. Trạng thái trống nay nêu rõ số hồ sơ vẫn có trong đàn và có một nút `Xóa bộ lọc` tại đúng vị trí cần xử lý; bấm nút đưa danh sách trở lại ngay, không xóa dữ liệu bò.
- Bảng dùng nền trắng và viền ngoài 1 px thống nhất; hover/focus-within chuyển sang nền xanh nhạt đủ tương phản, không thêm card lồng nhau. Danh sách phiếu xuất có tiêu đề `Lọc phiếu xuất` ngay dưới vùng tiêu đề màn, giữ các control cùng một thanh và tự xuống hàng khi hẹp.
- Lượt test RED đầu tiên cho route trực tiếp và khôi phục bộ lọc thất bại đúng kỳ vọng (`/cattle` còn là route menu và chưa có mô tả/nút khôi phục). Lượt kiểm tra sau đó phát hiện trùng hai nút `Xóa bộ lọc`, nên giữ lại một nút trong trạng thái trống. Assertion đầu dùng mã bò cố định không phù hợp với thứ tự 100 hàng stress; thay bằng kiểm tra theo hành vi: trạng thái trống biến mất và bảng có nút `Mở hồ sơ`.
- Kết quả cuối: `RoleNavigation.test.ts` và `CattlePreviewFilters.test.tsx` đạt `6/6`; `npm run typecheck`, `npm run build` và `git diff --check` đều đạt. Build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- `SCR-02` được đối chiếu lại với SRS: màn Đăng nhập phải hỗ trợ cả Google lẫn email/mật khẩu. Test tài khoản ban đầu dừng tại `25/26` vì UI chỉ đặt nút `Tiếp tục với Google` ở Đăng ký; sau khi bổ sung luồng Google cho Đăng nhập (đi tới đích phiên cục bộ), test `AccountScreens` và `TechnicianScreens` đạt `37/37`. React Router chỉ phát cảnh báo future-flag, không có lỗi runtime.
- `SCR-08` tách dữ liệu hồ sơ cục bộ theo vai trò, nên kỹ thuật viên thấy đúng danh tính cá nhân thay vì dữ liệu Chủ trại. Header kỹ thuật viên nay có `Đổi trang trại` và menu tài khoản dẫn tới hồ sơ/đăng xuất; `SCR-10` tách rõ hai hành động `Xem thông tin` và `Vào trang trại` cho trại còn hiệu lực. `npm run typecheck`, `npm run build` và `git diff --check` đều đạt; build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- Bộ đổi trang trại nhanh được tách khỏi layout thành `features/account/components/FarmQuickSwitcher.tsx` và `data/farmSelectionStore.ts`, để có thể thay adapter localStorage khi nối API. Lượt test đầu bắt được lỗi `loadSelectedFarmId is not defined` trong adapter; đã khôi phục import đúng nguồn subscription. Lượt sau còn gặp assertion mơ hồ vì đồng thời có menu trang trại và menu tài khoản; assertion được giới hạn bằng nhãn truy cập. Kết quả cuối: `AccountScreens` và `TechnicianScreens` đạt `37/37`, `npm run typecheck` đạt.
- `SCR-01` được làm lại theo nguyên tắc landing ít thẻ: hero có ảnh sản phẩm thật và CTA rõ, dải bằng chứng ba điểm, ba câu chuyện công việc, bốn bước, giá, FAQ và CTA kết thúc đều là các khối tuyến tính phân tách bằng khoảng trắng/đường kẻ thay vì card lồng nhau. Nội dung nhấn mạnh dùng tại chuồng trên điện thoại và máy tính bảng. `AccountScreens.test.tsx` đạt `29/29`; `npm run typecheck` và `npm run build` đạt. Build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- Bộ đổi trang trại nhanh nay vẫn gọn trên điện thoại nhưng hiện rõ tên trại và vai trò ở màn hình từ `sm` trở lên, nên người dùng không phải suy đoán mình đang thao tác trong trại nào. `SCR-104` cũng chuyển chi tiết nhắc việc sang dialog thay vì chèn khối ở cuối trang. Kiểm tra tập trung `AccountScreens` và `TechnicianScreens` đạt `37/37`; `npm run typecheck` đạt. React Router chỉ phát cảnh báo future-flag, không có lỗi runtime.
- Các màn xác thực (`SCR-02`, `SCR-03`, `SCR-05`, `SCR-06`) dùng biến thể hai cột riêng: nhận diện BeefCare và minh họa trại xuất hiện ở tablet/desktop, còn biểu mẫu giữ nền sáng có lớp nền trang trí rất nhẹ; không còn nhãn fixture ở chính màn đăng nhập. `AccountScreens.test.tsx` đạt `29/29`; `npm run typecheck` và `npm run build` đạt. Build chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- Vùng chạm của ô email/mật khẩu và hai hành động đăng nhập trên `SCR-02` được tăng riêng lên cỡ màn xác thực, không thay đổi cỡ nút nhỏ trong bảng. Kiểm tra runtime cục bộ bằng Playwright tại `1280×900` và `390×844` xác nhận header/footer còn đủ, cột minh họa hiển thị ở desktop, mobile không tràn ngang và không còn logo BeefCare lặp trong form. Đây là kiểm tra runtime thủ công, không phải visual-regression tự động. Lượt test `AccountScreens` đạt `29/29`, typecheck/build đạt; build vẫn chỉ cảnh báo chunk `ScreenPreviewPage` vượt 500 kB.
- Kiểm tra runtime luồng đổi trại từ vai trò Chủ trại sang Kỹ thuật viên phát hiện nội dung `SCR-104` còn ghi cứng “Trại bò Ba Vì” dù thanh đầu trang đã đổi sang trại kỹ thuật. Tiêu đề nay đọc cùng adapter `farmSelectionStore` với thanh điều hướng. Test mới giữ hồi quy cho ngữ cảnh `Trại kỹ thuật Yên Bài`; `TechnicianScreens.test.tsx` đạt `9/9`, typecheck và `git diff --check` đạt. React Router chỉ phát cảnh báo future-flag.
- `SCR-12` nay đọc cùng lựa chọn trại với thanh đổi trại nhanh: tiêu đề, tên trong biểu mẫu và tóm tắt dịch vụ thay đổi đồng bộ; bản nháp biểu mẫu được lưu tách theo từng tên trại thay vì ghi đè dữ liệu Ba Vì. Test tài khoản bổ sung kiểm tra ngữ cảnh Yên Bài và khóa localStorage riêng; kết quả kiểm tra được ghi ở checkpoint sau thay đổi.
- Xác nhận checkpoint `SCR-12`: `AccountScreens.test.tsx` đạt `30/30`, `npm run typecheck` và `git diff --check` đạt. React Router chỉ in hai cảnh báo future-flag đã biết; không có lỗi kiểm thử hay kiểu dữ liệu.
- Kiểm tra runtime thủ công bằng Playwright tại `1180×820`, trạng thái local preview chọn `Trại kỹ thuật Yên Bài · Kỹ thuật viên`: header, mô tả màn, tên form, trạng thái dịch vụ `Chờ thanh toán` và quy mô `142 con` cùng khớp ngữ cảnh; `scrollWidth = clientWidth = 1180`, console không có lỗi. Đây là kiểm tra runtime thủ công, không phải visual-regression tự động.

## Bổ sung kiểm tra ngày 06/11/2026

- `SCR-77` không còn đưa các hàng được sinh tự động cho stress-test vào chỉ số hoặc bảng “Cần chú ý hôm nay”. Stress data vẫn phục vụ kiểm tra mật độ ở các màn danh sách, nhưng bảng tổng quan chỉ tổng hợp nhắc việc cục bộ thật và các tín hiệu phát sinh từ hồ sơ.
- Lượt test đầu của `InsightScreens.test.tsx` kiểm tra cứng 7 dòng nhưng fixture hiện tại chỉ có 3 tín hiệu phù hợp (cộng hàng tiêu đề là 4), nên assertion được sửa để phản ánh đúng dữ liệu nghiệp vụ hiện hành và đồng thời bảo đảm không hiện nhãn hàng sinh `mẫu N`.
- Kiểm tra runtime thủ công tại `1024px`: bảng “Cần chú ý hôm nay” hiển thị 3 cảnh báo thật (`BC-000125`, `BC-000142`, lịch sinh bê), `scrollWidth = clientWidth = 1024` và console không có lỗi; chỉ còn 2 cảnh báo future-flag React Router đã biết. Đây không phải visual-regression tự động.
- Chỉ số `M09 · Sinh sản` giờ luôn hiện rõ số bò cái quá hạn phối, kể cả khi bằng `0`; trước đó mảng rỗng bị nội suy thành chuỗi trống làm mất con số.
- `SCR-70` bổ sung thao tác thật `Chọn N kết quả` / `Bỏ chọn kết quả` cho danh sách bò đang được lọc. Checkbox được tăng vùng chạm và mã bò liên kết trực tiếp với checkbox, thuận tiện khi dùng máy tính bảng mà không thay đổi điều kiện xuất đàn hay luồng lưu nháp.
- Kiểm tra runtime thủ công `SCR-70`: bấm `Chọn 7 kết quả` chọn đúng 7 checkbox, cập nhật danh sách cân/đơn giá và tổng `2.145 kg`; `scrollWidth - clientWidth = 0`, console không có lỗi. Đây là kiểm tra thao tác trực tiếp, không phải visual-regression tự động.
- `SCR-17` không còn cuộn trang xuống một khối chi tiết ở cuối bảng khi xem lời mời dữ liệu thử. Hành động `Xem` nay mở dialog chỉ đọc, đóng dialog trả lại nguyên vị trí danh sách; lời mời thật vẫn giữ các hành động gửi lại/hủy tại dòng.
- Kiểm tra runtime thủ công `SCR-17` với 100 lời mời mô phỏng: bấm `Xem` mở đúng dialog chỉ đọc, không phát sinh chi tiết ở cuối bảng; `scrollWidth = clientWidth` và console không có lỗi. `AccountScreens.test.tsx` đạt `33/33`, `npm run typecheck` và `git diff --check` đạt; React Router chỉ còn 2 cảnh báo future-flag đã biết.

- Đối chiếu `SRS_2026-11-01_SEP490_G35_Report.txt`, UC-FE02-02 và GBR-09/12/13/14: danh sách chọn trại phải dựa trên membership ACTIVE của tài khoản, không suy ra từ catalog trại; Chủ trại còn thấy trại sở hữu không ACTIVE để gia hạn/hỗ trợ, còn Quản lý/Kỹ thuật viên không được mở trại đó.
- Adapter local `farmsForMember` nay là ranh giới duy nhất của `SCR-10` và bộ đổi trại nhanh. Fixture dịch vụ được đồng bộ để `Trại kỹ thuật Yên Bài` là `ACTIVE`, khớp việc kỹ thuật viên được vào trại và mốc dịch vụ hiển thị.
- Lượt `npm run typecheck` đầu tiên dừng ở kiểu `false | FarmAccessRow` trong `readFarmSelection`; đã đổi biểu thức tra membership thành nhánh tường minh. Không có lỗi runtime từ thay đổi này.
- Lượt kiểm tra runtime đầu của `SCR-10` phát hiện adapter stress-table vẫn thêm 100 hàng mô phỏng vào màn phạm vi quyền. Đã loại stress adapter khỏi riêng màn chọn trại; sau khi tải lại ở `1180×820`, bảng chỉ còn `Trại bò Ba Vì`, `Trại Hòa Bình`, `Trại thử nghiệm Sơn Tây`, với `scrollWidth = clientWidth = 1180`.
- Kiểm tra Playwright thủ công ở `1180×820`, phiên local Kỹ thuật viên + `Trại kỹ thuật Yên Bài`: thanh đổi trại nhanh chỉ hiện đúng một menuitem Yên Bài, không lẫn Ba Vì; header và trang chủ cùng dùng Yên Bài; không có lỗi console. Console chỉ còn hai cảnh báo future-flag đã biết của React Router. Đây là bằng chứng runtime thủ công, không phải visual-regression tự động.
- `AccountScreens.test.tsx` và `TechnicianScreens.test.tsx` đạt `41/41`; `npm run typecheck` và `git diff --check` đạt.
