# BeefCare full UI first-pass checklist

Ngày lập: 02/11/2026  
Nguồn: `frontend/src/app/screenManifest.ts` và SRS 2026-11-01.

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
| SCR-80 | Lịch sử kiểm tra | audit | workbench | fixture | /ui/scr-80 | Đã duyệt manual · SA · 820×1180 · hành động và đối tượng Việt hóa |
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
