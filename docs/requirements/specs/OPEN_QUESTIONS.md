# Câu hỏi còn mở trong bộ spec

Nguồn: mục 10 của 23 spec theo SRS 28/10/2026 (quyết định D12). Mỗi câu cần một quyết định. Câu nào làm thay đổi SRS thì sửa SRS trước, rồi sửa spec và ghi vào `docs/REQUIREMENT_DECISIONS.md`.

Cột **Quyết định**: để trống = chưa chốt; ghi `Theo đề xuất`, `Khác: …` hoặc `Hoãn`. **Người chốt** mặc định là chủ feature; câu chạm feature khác thì trao đổi với chủ feature đó.

Tổng: 120 câu – AnNT 28, DucNV 24, LamKD 19, TaiDX 28, TuanPQ 20, cả nhóm 1.

Ngày 07/11/2026 thêm 10 câu (FE-03 Q5, FE-12 Q5, FE-14 Q6, FE-23 Q7–Q12, Chung Q1) khi dọn thư mục `docs/`: lấy từ đối chiếu FE–BE phần thức ăn (01/11), đối chiếu Figma với frontend (02/11) và báo cáo triển khai backend (28–29/10).

Ngày 08/11/2026 thêm 5 câu (FE-02 Q5–Q9) khi làm UC-FE02-02 đến UC-FE02-05: chỗ SRS mâu thuẫn, đọc được hai cách hoặc cần chọn cách lưu.

| FE | Mã | Câu hỏi | Đề xuất trong spec | Quyết định | Người chốt | Ngày |
|---|---|---|---|---|---|---|
| FE-01 | Q1 | Vượt giới hạn 5 email / giờ: SRS không có mã thông báo riêng | Dùng MSG-COM-02 hoặc thêm MSG-FE01-17 "Bạn đã gửi quá nhiều yêu cầu, thử lại sau {time}" |  | LamKD |  |
| FE-01 | Q2 | Thêm mật khẩu khi xác thực Google đã quá 5 phút: SRS không ghi thông báo | Tự chuyển sang Google xác thực lại, không cần thông báo |  | LamKD |  |
| FE-01 | Q3 | Họ tên chỉ gồm ký tự đặc biệt / số có hợp lệ không? | Chỉ kiểm độ dài 2–100 sau trim (đúng như SRS) |  | LamKD |  |
| FE-01 | Q4 | SĐT có cho phép khoảng trắng / dấu chấm (`0912 345 678`) không? | Cho nhập, chuẩn hóa bỏ khoảng trắng và dấu chấm trước khi kiểm |  | LamKD |  |
| FE-01 | Q5 | "Trang đã yêu cầu trước khi đăng nhập" lưu ở đâu, bao lâu? | Lưu trong tham số `redirect` của URL, chỉ nhận đường dẫn nội bộ |  | LamKD |  |
| FE-02 | Q1 | UC-FE02-03 và UC-FE02-04 không có đặc tả Part II; luồng ở mục 5 suy từ Part I và SCR-11 / 12 | Chủ dự án xác nhận | Theo đề xuất: đã xác nhận luồng UC-FE02-03 và UC-FE02-04 (mục 5) | DucNV | 08/11/2026 |
| FE-02 | Q2 | Đổi múi giờ trại khi đã có dữ liệu: dữ liệu cũ hiển thị lại theo múi giờ mới? | Chỉ cho đổi khi trại chưa có bò, hoặc cảnh báo | Khác: chỉ cho chọn 3 múi giờ UTC+7 (`Asia/Ho_Chi_Minh`, `Asia/Bangkok`, `Asia/Vientiane`), backend từ chối múi giờ khác (MSG-COM-10); đổi qua lại không làm lệch ngày đã lưu nên không cần chặn | DucNV | 08/11/2026 |
| FE-02 | Q3 | Danh mục tỉnh / thành: theo danh mục sau sáp nhập 2025 (34 tỉnh) hay 63 tỉnh cũ? | 34 tỉnh, lưu mã | Khác: 34 tỉnh, **lưu tên** (SRS không quy định lưu mã); backend từ chối tên ngoài danh sách (MSG-COM-10) | DucNV | 08/11/2026 |
| FE-02 | Q4 | "Số ngày còn lại" khi đang SUSPENDED có hiện không? | Vẫn hiện (kỳ dịch vụ không đổi khi tạm ngưng) | Theo đề xuất; không có kỳ hiện tại (hết kỳ, chờ thanh toán) thì hiện "—" | DucNV | 08/11/2026 |
| FE-02 | Q5 | Nút "Thanh toán để kích hoạt" / "Gia hạn" trên SCR-09 mở SCR-57 (UC-FE02-02 AF1) hay SCR-58 (bảng nút SCR-09; trigger UC-FE19-02)? SRS mâu thuẫn | SCR-58 kèm MSG-FE02-03 | Theo đề xuất: chờ thanh toán → SCR-58 lần đầu (`/dang-ky-goi`), hết hạn → SCR-58 gia hạn (`/goi-dich-vu/gia-han`), kèm banner MSG-FE02-03; sửa AF1 mục 5 | DucNV | 08/11/2026 |
| FE-02 | Q6 | UC-FE02-02 bước 2 đọc được là Manager / Technician không thấy trại không ACTIVE; AF3, bảng nút SCR-09 và TC-02-11 lại nói thẻ bị khóa | Hiện thẻ khóa kèm MSG-FE02-04 | Theo đề xuất | DucNV | 08/11/2026 |
| FE-02 | Q7 | AF4 "chỉ có 1 trại khả dụng → mở thẳng": "khả dụng" là gì, áp dụng lúc nào? | Chỉ ngay sau đăng nhập, khi danh sách có đúng 1 trại và trại đó ACTIVE; mở từ nút đổi trại thì vẫn hiện SCR-09 để còn "Đăng ký trại mới" | Theo đề xuất | DucNV | 08/11/2026 |
| FE-02 | Q8 | Manager / Technician mở SCR-11 (gõ đường dẫn hoặc link cũ): hiện MSG-COM-01 (TC-02-17) hay đưa về trang chủ? | Hiện MSG-COM-01 | Khác: đưa về trang chủ của vai trò, không tải dữ liệu trại; API vẫn trả 403 MSG-COM-01 | DucNV | 08/11/2026 |
| FE-02 | Q9 | Lịch sử thay đổi dịch vụ (Farm Service Change, mục 3.3) lưu ở bảng riêng hay trong audit? | Dùng audit đang có: mỗi lần tạm ngưng / khôi phục ghi một dòng `FARM_SERVICE_SUSPEND` / `FARM_SERVICE_RESTORE` gồm PM, thời điểm, trạng thái trước / sau, lý do; bất biến (BR-D29); không thêm bảng, không migration | Theo đề xuất | DucNV | 08/11/2026 |
| FE-03 | Q1 | UC-01 AF2 (email của thành viên INACTIVE): SRS không có mã thông báo | Thêm MSG-FE03-21 "{email} là thành viên đã ngưng. Kích hoạt lại thay vì mời?" kèm nút mở popup |  | DucNV |  |
| FE-03 | Q2 | UC-FE03-02, 05, 07 không có đặc tả Part II; luồng suy từ SCR | Chủ dự án xác nhận |  | DucNV |  |
| FE-03 | Q3 | Đổi vai trò với ngày hiệu lực trong quá khứ: quyền áp dụng ngay hay tính lại quá khứ? | Áp dụng từ request kế tiếp; ngày hiệu lực chỉ để ghi lịch sử |  | DucNV |  |
| FE-03 | Q4 | Tài khoản bị tạm ngưng có được nhận lời mời / được cấp quyền platform không? | Không được cấp quyền platform khi đang tạm ngưng |  | DucNV |  |
| FE-03 | Q5 | Sidebar SA có mục riêng "Quyền nhân sự nền tảng" theo Figma; SRS SCR-16 coi đây là popup của Tài khoản người dùng. FE đang theo Figma | Theo SRS (D12), sửa FE; nếu giữ Figma thì ghi quyết định mới vào `REQUIREMENT_DECISIONS.md` |  | DucNV |  |
| FE-04 | Q1 | UC-FE04-01 → 04 không có đặc tả Part II; luồng suy từ SCR-17 và popup | Chủ dự án xác nhận |  | AnNT |  |
| FE-04 | Q2 | "Tuổi / cân tối thiểu" khi bò chưa có lần cân nào | Kết quả "Không áp dụng" cho tiêu chí cân |  | AnNT |  |
| FE-04 | Q3 | Mã chuồng phân biệt hoa thường không (`c-01` và `C-01`)? | Không phân biệt; lưu chữ hoa |  | AnNT |  |
| FE-04 | Q4 | Ngưng chuồng với ngày hiệu lực trong quá khứ: có chặn các lần xếp đã ghi sau ngày đó không? | Không ảnh hưởng dữ liệu đã có |  | AnNT |  |
| FE-05 | Q1 | Độ dài tối đa của lý do đổi mục đích / giai đoạn: SRS không ghi | 500 ký tự như các popup khác |  | AnNT |  |
| FE-05 | Q2 | Lịch sử thay đổi hồ sơ xem ở đâu ngoài dòng thời gian? | Chỉ qua dòng thời gian (FE-16, chip "Mục đích / giai đoạn") |  | AnNT |  |
| FE-05 | Q3 | Định dạng mã thẻ do hệ thống tạo | Chuỗi ngẫu nhiên không đoán được, không chứa mã hiển thị |  | AnNT |  |
| FE-05 | Q4 | Đổi số tai có cần ngày hiệu lực và lý do không? (SRS chỉ bắt buộc cho mục đích, giai đoạn) | Không bắt buộc; vẫn lưu lịch sử |  | AnNT |  |
| FE-05 | Q5 | Lọc "Chờ xuất" trong trạng thái đàn có gồm cả phiếu chết PENDING không? | Có (cả 2 loại chờ) |  | AnNT |  |
| FE-06 | Q1 | UC-FE06-02, 04 không có đặc tả Part II; luồng suy từ SCR | Chủ dự án xác nhận |  | AnNT |  |
| FE-06 | Q2 | Mã thông báo khi trùng tên đối tác: SRS không có | Thêm MSG riêng hoặc dùng MSG-COM-10 kèm tham số |  | AnNT |  |
| FE-06 | Q3 | Sửa "Ngày nhập" của phiếu mua có cần kiểm với sự kiện của **mọi** bò trong phiếu không? | Có (áp cho mọi bò) |  | AnNT |  |
| FE-06 | Q4 | Chuồng nhận của phiếu FARM_BORN có kiểm tiêu chí chuồng không? | Có, như phiếu mua (GBR-21 áp cho UC-FE06-01) |  | AnNT |  |
| FE-06 | Q5 | "In phiếu" ra định dạng gì? | PDF A4 |  | AnNT |  |
| FE-07 | Q1 | Danh sách thông báo phân tab ở FE hay BE? | BE nhận `tab` và trả `counts` |  | TaiDX |  |
| FE-07 | Q2 | Rich text lưu dạng gì? | Markdown hoặc HTML đã lọc theo danh sách thẻ cho phép (đậm, nghiêng, ul, ol, a) |  | TaiDX |  |
| FE-07 | Q3 | Có xóa được nháp không? SRS không nêu | Có, chỉ tác giả |  | TaiDX |  |
| FE-07 | Q4 | Người nhận chọn tên bị đổi vai trò (Technician → Manager) trước khi đăng, tác giả là Manager | Bị loại khi đăng (R-07-05) |  | TaiDX |  |
| FE-08 | Q1 | Trạng thái VOIDED của bản ghi cân xuất hiện khi nào? (UC-03 chỉ có Sửa và Loại trừ) | Chỉ khi hủy nhập / hủy phiếu (hệ thống), người dùng không chọn | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-08 | Q2 | "Ngưỡng 20 %" và "30 ngày" có là tham số trại không? | Hằng số | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-08 | Q3 | Thang BCS 1–9 thì ô tổng hợp "BCS dưới 2,5" tính thế nào? | Quy đổi theo tỷ lệ thang, hoặc chỉ hiện với thang 1–5 | Quy đổi theo tỷ lệ thang: thang 1–9 dùng ngưỡng dưới 4,0 (tương đương 2,5 trên thang 1–5) | TuanPQ | 07/11/2026 |
| FE-09 | Q1 | Độ dài lý do dừng lịch: SRS không ghi | ≤ 500 | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-09 | Q2 | UC-FE09-01, 03, 04, 07 không có đặc tả Part II; luồng suy từ SCR | Chủ dự án xác nhận | Theo các màn hình SCR trong SRS 28/10 | TuanPQ | 07/11/2026 |
| FE-09 | Q3 | Sửa lịch đổi **vắc-xin** khi đã có mũi DONE có được không? | Không – dừng lịch và tạo lịch mới | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-09 | Q4 | "Gần đây" ở R-09-04 là bao nhiêu ngày? | Trong khoảng nhắc lại, mặc định 30 ngày | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-09 | Q5 | Mũi nhắc lại khi lịch có số mũi 1 và không có nhắc lại | Không tạo | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-10 | Q1 | "Diễn biến mới nhất" ở popup Cập nhật / Đóng ca có bắt buộc không? UC-03 E1 nói thiếu "progress, description" → MSG-COM-06 | Bắt buộc khi Giữ trạng thái; không bắt buộc khi Đóng / đổi trạng thái | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-10 | Q2 | UC-FE10-01 không có đặc tả Part II | Theo SCR-36, SCR-37 | Theo SCR-36, SCR-37 | TuanPQ | 07/11/2026 |
| FE-10 | Q3 | Code có "sửa việc đóng ca" (closure-correction) – SRS không có | Bỏ, hoặc bổ sung UC vào SRS | Bỏ: không làm chức năng sửa việc đóng ca (không có trong SRS); gỡ route hiện có khi làm FE-10 | TuanPQ | 07/11/2026 |
| FE-10 | Q4 | Chẩn đoán nghi ngờ có danh mục chuẩn không? | Không – chữ tự do + gợi ý từ dữ liệu trại | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-11 | Q1 | UC-FE11-01 không có đặc tả Part II | Theo SCR-38, SCR-39 | Theo SCR-38, SCR-39 | TuanPQ | 07/11/2026 |
| FE-11 | Q2 | Kiểm trùng 12 giờ áp cho phối giống không? (MSG-FE11-03 dùng "{event_type}") | Có cho cả động dục và phối, trừ phối lần hai có chủ ý (R-11-08) – cần chốt | Có, áp cho cả động dục và phối; trừ phối lần hai có chủ ý (R-11-08) | TuanPQ | 07/11/2026 |
| FE-11 | Q3 | Động dục trên bò Đã phối → trạng thái Động dục; nếu sau đó khám CÓ THAI cho lần phối cũ? | Khám CÓ THAI thắng (Table 3.4-3 "Any → PREGNANT") | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-12 | Q1 | UC-02 POST-2 viết "returns to OPEN" sau KHÔNG CÓ THAI – mâu thuẫn tên trạng thái | Hiểu là Chờ phối (AWAITING_BREEDING) theo Table 3.4-3 | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-12 | Q2 | UC-FE12-01 không có đặc tả Part II | Theo SCR-39 | Theo SCR-39 | TuanPQ | 07/11/2026 |
| FE-12 | Q3 | Bê "Đăng ký ngay" không có mã thẻ | Hệ thống cấp mã khi ghi sổ phiếu FARM_BORN (như SCR-25) | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-12 | Q4 | Người khám chọn thành viên hay chữ tự do – cần cả hai? | Cả hai, như người thực hiện ở các popup khác | Theo đề xuất | TuanPQ | 07/11/2026 |
| FE-12 | Q5 | Thẻ tai bê: Figma bắt buộc khi chọn "Đăng ký ngay", SRS không bắt buộc. FE (`CalvingPage`) đang theo Figma | Theo SRS (D12), sửa FE; nếu giữ Figma thì ghi quyết định mới vào `REQUIREMENT_DECISIONS.md` |  | TuanPQ |  |
| FE-13 | Q1 | Độ dài lý do bỏ đề xuất phiếu chết | ≤ 500 |  | AnNT |  |
| FE-13 | Q2 | UC-FE13-02, 04 không có đặc tả Part II | Theo SCR-41, SCR-76 và popup dùng chung |  | AnNT |  |
| FE-13 | Q3 | Phiếu PENDING có được thêm bò khác không? | Không – mỗi phiếu chết gắn đúng 1 con (GBR-95) |  | AnNT |  |
| FE-13 | Q4 | REM-13 nhắc "đạt cân xuất chuồng": có nút tạo phiếu xuất từ nhắc việc không? | Có, mở SCR-42 với bò đó (SRS: "Owner may start an exit voucher") |  | AnNT |  |
| FE-14 | Q1 | FE-14 không có đặc tả UC ở Part II | Dùng Part III + GBR làm nguồn; bổ sung Part II ở lần sửa SRS sau |  | TaiDX |  |
| FE-14 | Q2 | Có API chi tiết nhắc việc riêng? | Thêm A2; hoặc trả đủ chi tiết trong A1 |  | TaiDX |  |
| FE-14 | Q3 | Nhắc việc có gửi email / thông báo đẩy không? | Không – SRS chỉ nói hiển thị trong trại |  | TaiDX |  |
| FE-14 | Q4 | Thời gian giữ thông báo đã đọc | Giữ vô hạn; phân trang |  | TaiDX |  |
| FE-14 | Q5 | Chuông thông báo trên header cho vai trò nào | Owner (SCR-45), CS / PM / SA (SCR-46), PM (SCR-47) |  | TaiDX |  |
| FE-14 | Q6 | Thanh dưới của Technician: Figma có Trang chủ, Đàn bò, Quét QR, Sinh sản, Thức ăn, Tài khoản; SRS bảng 5.1-1 có Announcements, không có Tài khoản. FE đang theo Figma, thông báo mở từ trang chủ | Theo SRS (D12), sửa FE; nếu giữ Figma thì ghi quyết định mới vào `REQUIREMENT_DECISIONS.md` |  | TaiDX |  |
| FE-15 | Q1 | Không có đặc tả UC ở Part II | Dùng Part III + GBR |  | TaiDX |  |
| FE-15 | Q2 | Mã lỗi khi kỳ > 24 tháng | MSG-COM-10 với nội dung "tối đa 24 tháng" |  | TaiDX |  |
| FE-15 | Q3 | Có xuất báo cáo (Excel / PDF) không? | SRS không yêu cầu – ngoài phạm vi |  | TaiDX |  |
| FE-15 | Q4 | Kỳ mặc định SCR-49 | 30 ngày như SCR-48 |  | TaiDX |  |
| FE-15 | Q5 | Bộ lọc nào áp dụng cho từng RPT | RPT-03: bỏ giống / giai đoạn; RPT-07: chỉ chuồng; còn lại đủ 4 |  | TaiDX |  |
| FE-15 | Q6 | Cache dashboard | Tính tại thời điểm xem; nếu cache phải hiện thời điểm tính thực |  | TaiDX |  |
| FE-16 | Q1 | Không có đặc tả UC ở Part II | Dùng Part III + GBR-37 |  | AnNT |  |
| FE-16 | Q2 | SRS chỉ nói Manager có Sửa / Hủy trên dòng thời gian; Owner thì sao? | Owner theo quyền sửa của FE nguồn (đề xuất có, đồng nhất với tab nguồn) |  | AnNT |  |
| FE-16 | Q3 | Thứ tự mới nhất trước hay cũ nhất trước | Mới nhất trước |  | AnNT |  |
| FE-16 | Q4 | Trạng thái rỗng, phân trang | "Chưa có sự kiện"; tải thêm theo tháng |  | AnNT |  |
| FE-16 | Q5 | Sự kiện điều trị / đóng ca (FE-10) có Sửa / Hủy từ dòng thời gian? | Không – SRS chỉ liệt kê 5 popup |  | AnNT |  |
| FE-17 | Q1 | Không có đặc tả Part II, không có MSG riêng | Dùng MSG-COM |  | DucNV |  |
| FE-17 | Q2 | Danh sách đầy đủ mã hành động + allowlist trường trước / sau cho từng mã | Lập bảng ở §3.2 thành phụ lục; mỗi FE nguồn khai báo khi ghi |  | DucNV |  |
| FE-17 | Q3 | Kích thước trang | 20 |  | DucNV |  |
| FE-17 | Q4 | Thời gian lưu giữ audit | Không xóa (append-only) |  | DucNV |  |
| FE-17 | Q5 | Audit trong trại (thay đổi dữ liệu bò) | Không thuộc audit trung tâm; dùng Record Revision (FE-16) |  | DucNV |  |
| FE-18 | Q1 | Technician có xem SCR-55, SCR-56 không? (SRS nói SCR-55 "Owner or a Manager"; SCR-52 → 54 "farm members") | Technician chỉ xem giống, vắc-xin, thuốc |  | AnNT |  |
| FE-18 | Q2 | SCR-54 không nêu mã và tên thuốc | Mã như giống; tên ≤ 150 như vắc-xin |  | AnNT |  |
| FE-18 | Q3 | SCR-55 không có trường Mô tả dù entity có | Thêm Mô tả ≤ 500 |  | AnNT |  |
| FE-18 | Q4 | Có xóa giống / thuốc / mục đích chưa dùng không? | Không – SRS chỉ cho xóa vắc-xin chưa dùng |  | AnNT |  |
| FE-18 | Q5 | Tham số "Chuẩn bị đẻ trước" (30) dùng cho REM-05; "Khám thai sau phối" (28) cho REM-03 – xác nhận REM dùng tham số thay hằng số | Có – Table III-3 ghi giá trị mặc định |  | AnNT |  |
| FE-19 | Q1 | Rút phiên bản đã lên lịch chưa có route | Thêm A14 |  | DucNV |  |
| FE-19 | Q2 | Tra cứu SePay theo khoảng thời gian (SRS nêu "ID or period"), code chỉ có theo ID | Bổ sung tham số `from, to` |  | DucNV |  |
| FE-19 | Q3 | UC-FE19-01, 03, 04, 05 không có đặc tả Part II | Theo Part III |  | DucNV |  |
| FE-19 | Q4 | Độ dài lý do khóa / mở khóa / rút phiên bản | ≤ 1.000 như quyết định |  | DucNV |  |
| FE-19 | Q5 | Email cho Owner khi PAID – mẫu nội dung | Theo MSG-FE19-06 |  | DucNV |  |
| FE-20 | Q1 | Độ dài lý do bàn giao / trả về hàng đợi / đổi người nhận / hủy IR | ≤ 1.000 |  | LamKD |  |
| FE-20 | Q2 | Ghi chú tùy chọn khi Owner xác nhận – UI chưa có trường | Thêm ô "Nhận xét" (≤ 1.000) tùy chọn |  | LamKD |  |
| FE-20 | Q3 | UC-FE20-02, 03, 06, 08, 09 không có đặc tả Part II | Theo Part III + GBR |  | LamKD |  |
| FE-20 | Q4 | Đính kèm file vào ticket? | SRS không có – ngoài phạm vi |  | LamKD |  |
| FE-20 | Q5 | Thông báo email cho Owner khi CS trả lời? | Chỉ thông báo trong app (FE-14) trừ khi SRS bổ sung |  | LamKD |  |
| FE-21 | Q1 | Danh sách danh mục thu / chi | Cấu hình cố định qua A2; cần chốt danh sách |  | LamKD |  |
| FE-21 | Q2 | Thời gian lưu snapshot trước khi EXPIRED | 24 giờ |  | LamKD |  |
| FE-21 | Q3 | Độ dài lý do hủy | ≤ 500 |  | LamKD |  |
| FE-21 | Q4 | UC-FE21-01, 03, 04, 05, 08 không có đặc tả Part II | Theo Part III + GBR |  | LamKD |  |
| FE-21 | Q5 | Mã lỗi khi kỳ > 24 tháng | MSG-COM-10 |  | LamKD |  |
| FE-22 | Q1 | Không có đặc tả Part II | Theo Part III + GBR-87 |  | LamKD |  |
| FE-22 | Q2 | Người đã đăng nhập mở trang gốc → ở lại hay chuyển vào app? | Ở lại; header đổi "Đăng nhập" thành "Vào ứng dụng" |  | LamKD |  |
| FE-22 | Q3 | Header dính, SEO, ngôn ngữ thứ 2 | Header dính; chỉ tiếng Việt |  | LamKD |  |
| FE-22 | Q4 | Nội dung lấy từ API hay đóng gói FE | Đóng gói FE (đổi bằng triển khai), giá gọi API |  | LamKD |  |
| FE-23 | Q1 | Mã lỗi khi trùng mã TA-nn | Dùng nội dung như MSG-FE18-02 |  | TaiDX |  |
| FE-23 | Q2 | Bỏ nháp phiếu nhập / điều chỉnh, hủy phiên bản khẩu phần, dừng khẩu phần chưa có route | Thêm A5, A10 |  | TaiDX |  |
| FE-23 | Q3 | API kế hoạch khi mở popup ghi bữa | Thêm A12 |  | TaiDX |  |
| FE-23 | Q4 | "Điền nhanh theo khẩu phần" cho nhiều bữa: lưu 1 lần hay từng bữa? | Mở lần lượt từng popup đã điền sẵn để Manager xác nhận |  | TaiDX |  |
| FE-23 | Q5 | UC-FE23-01, 03, 04, 05, 07, 10, 11 không có đặc tả Part II | Theo Part III + GBR |  | TaiDX |  |
| FE-23 | Q6 | Giá vốn khi tồn về 0 rồi nhập lại | Giá vốn BQ = đơn giá của lần nhập mới |  | TaiDX |  |
| FE-23 | Q7 | `feedGroup`: sáu mã ở SRS Table III-6 là tập đóng hay danh mục mở? BE chỉ kiểm chuỗi ≤ 30 ký tự, OpenAPI không có enum | Tập đóng; BE và OpenAPI kiểm enum |  | TaiDX |  |
| FE-23 | Q8 | Danh sách phiếu nhập (SCR-78): lọc trạng thái / kỳ / nhà cung cấp, phân trang và công nợ làm ở BE hay FE? Hiện FE phải gọi API thanh toán cho từng phiếu để biết còn nợ | BE thêm lọc, phân trang và đã trả / còn nợ trong `ReceiptView` |  | TaiDX |  |
| FE-23 | Q9 | Lịch sử của phiếu nhập đã ghi sổ / đã hủy (SCR-79) lấy từ đâu? `ReceiptView` không có lịch sử | Dùng người, thời điểm ghi sổ / hủy, lý do hủy (spec §3) và danh sách thanh toán; không thêm API lịch sử riêng |  | TaiDX |  |
| FE-23 | Q10 | "Tồn trước → sau" trên phiếu nhập: chỉ là xem trước khi soạn hay phải lưu lại lúc ghi sổ? | Chỉ xem trước khi soạn; sau khi ghi sổ xem thẻ kho (A2) |  | TaiDX |  |
| FE-23 | Q11 | Hóa đơn đến sau khi đã ghi sổ có được đính kèm thêm vào phiếu không? Hiện BE từ chối vì phiếu chỉ đọc | Giữ như hiện tại: phiếu đã ghi sổ chỉ đọc |  | TaiDX |  |
| FE-23 | Q12 | Trạng thái "Sắp hết": Figma tính cả khi đủ dùng dưới 4 ngày; SRS là tồn ≤ mức tối thiểu. Mock đang theo Figma, backend theo SRS | Theo SRS (D12), sửa FE; nếu giữ Figma thì ghi quyết định mới vào `REQUIREMENT_DECISIONS.md` |  | TaiDX |  |
| Chung | Q1 | Outbox: sự kiện được ghi nhưng chưa có handler; thông báo trong app và email đang tạo trực tiếp trong transaction. Giữ outbox (thêm handler) hay bỏ ghi sự kiện không dùng? | Hoãn; không thêm handler gửi trùng thông báo / email khi chưa kiểm thiết kế |  | Cả nhóm |  |
