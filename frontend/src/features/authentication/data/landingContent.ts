/** Nội dung tĩnh của trang công khai (SCR-01), theo khung Figma "Trang công khai · Redesign". */
export const CONTACT = { email: 'beefcare@gmail.com', phone: '0386 671 863', phoneHref: 'tel:+84386671863' }

export const NAV_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Tính năng', '#features'], ['Cách hoạt động', '#steps'], ['Bảng giá', '#pricing'], ['Câu hỏi', '#faq'], ['Liên hệ', '#contact'],
]

export const HERO_POINTS = ['Không cần cài ứng dụng', 'Dữ liệu riêng cho từng trại', 'Giao diện tiếng Việt dễ dùng']

export const OVERVIEW_CARDS: ReadonlyArray<readonly [string, string]> = [
  ['1 hồ sơ mỗi con', 'Mở đúng lịch sử, nắm đúng quyết định.'], ['8 nhóm sự kiện', 'Gom trọn hành trình chăm sóc.'],
  ['7 vai trò', 'Đúng người, đúng việc, rõ quyền.'], ['Kỳ hạn 1–3 năm', 'Chọn nhịp đầu tư cho trại.'],
]

export const DEFAULT_FEATURES: ReadonlyArray<readonly [string, string]> = [
  ['Hồ sơ cá thể & thẻ QR', 'Mở đúng hồ sơ từng con bằng QR, xem ngay nhận diện, chuồng nuôi và lịch sử chăm sóc.'],
  ['Tăng trưởng & BCS', 'Theo dõi cân nặng và BCS theo từng mốc, nhận ra thay đổi để chăm sóc kịp thời.'],
  ['Tiêm phòng & sức khỏe', 'Quản lý lịch tiêm, điều trị và tái khám để không bỏ sót mốc sức khỏe quan trọng.'],
  ['Sinh sản & đẻ', 'Theo dõi phối giống, khám thai và ngày dự kiến sinh theo từng cá thể.'],
  ['Nhắc việc & thông báo trại', 'Nắm việc sắp đến hạn, ưu tiên đúng việc và phối hợp cả đội chủ động hơn.'],
  ['Nhiều trại độc lập', 'Tách dữ liệu, quyền truy cập và phần việc rõ ràng cho từng trại.'],
]

export const STEPS: ReadonlyArray<readonly [string, string]> = [
  ['Quét QR thẻ tai', 'Quét thẻ tai tại chuồng để mở đúng hồ sơ của từng con.'],
  ['Mở đúng hồ sơ', 'Xem nhanh thông tin nhận diện và lịch sử chăm sóc.'],
  ['Ghi sự kiện thực tế', 'Cập nhật cân nặng, sức khỏe, sinh sản và các sự kiện thực tế.'],
  ['Theo dõi & nhận nhắc việc', 'Biết việc cần làm, nhận nhắc đúng lúc và xử lý đúng hạn.'],
]

export const DEFAULT_FAQ: ReadonlyArray<readonly [string, string]> = [
  ['BeefCare phù hợp với quy mô trại nào?', 'Tối ưu nhất cho trại bò thịt 150–300 con — quy mô đủ lớn để cần một hệ thống bài bản, đủ gọn để áp dụng nhanh. Trại nhỏ hơn vẫn bắt đầu nhẹ nhàng, số hóa từng hồ sơ và mở rộng khi đội ngũ sẵn sàng. Trại lớn hơn vẫn vận hành mạch lạc với quy trình chuẩn, phân quyền rõ và dữ liệu luôn trong tầm kiểm soát.'],
  ['Có cần cài ứng dụng để sử dụng BeefCare không?', 'BeefCare chạy trực tiếp trên trình duyệt nên bạn không cần cài ứng dụng. Kỹ thuật viên có thể mở hồ sơ và ghi nhận ngay tại chuồng bằng điện thoại. Trên máy tính hoặc máy tính bảng, đội ngũ vẫn theo dõi được toàn cảnh của trại.'],
  ['Các kỳ hạn 1, 2 và 3 năm khác nhau như thế nào?', 'Bạn có thể chọn kỳ hạn 1, 2 hoặc 3 năm cho từng trại theo kế hoạch vận hành. Giá hiển thị là tổng theo trại và theo kỳ hạn, không tính theo tháng hay theo đầu bò. Chọn kỳ hạn phù hợp để chủ động ngân sách và tập trung vào việc chăm đàn.'],
  ['Thanh toán và kích hoạt gói dịch vụ diễn ra ra sao?', 'Chủ trại khởi tạo thanh toán bằng chuyển khoản ngân hàng theo gói đã chọn. BeefCare đối soát giao dịch và ghi nhận kỳ hạn khi khoản thanh toán được xác nhận. Không có tự động trừ tiền hay gia hạn ngoài ý muốn, nên mọi quyết định vẫn nằm trong tay bạn.'],
  ['Dữ liệu giữa các trại được tách riêng như thế nào?', 'Mỗi trại có dữ liệu và quyền truy cập độc lập, kể cả khi một tài khoản tham gia nhiều trại. Thành viên chỉ nhìn thấy thông tin trong phạm vi membership và vai trò được cấp. Bạn có thể mở rộng quản lý mà không trộn lẫn hồ sơ, lịch sử hay công việc giữa các trại.'],
]

export const PLAN_YEARS = [1, 2, 3] as const
