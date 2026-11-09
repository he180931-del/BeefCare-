/** Nội dung tĩnh của trang công khai (SCR-01), theo khung Figma "Trang công khai · Redesign". */
export const CONTACT = { email: 'tuanpqhe181869@fpt.edu.vn', phone: '0386 671 863', phoneHref: 'tel:+84386671863' }

export const NAV_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Tính năng', '#features'], ['Cách hoạt động', '#steps'], ['Bảng giá', '#pricing'], ['Câu hỏi', '#faq'], ['Liên hệ', '#contact'],
]

export const HERO_POINTS = ['Dữ liệu có tổ chức', 'Dễ dùng tại trại', 'Theo dõi từng cá thể']

export const OVERVIEW_CARDS: ReadonlyArray<readonly [string, string]> = [
  ['1 hồ sơ mỗi con', 'Theo dõi rõ từng cá thể'], ['8 nhóm sự kiện', 'Chăm sóc trong một nơi'],
  ['7 vai trò', 'Phân quyền theo công việc'], ['Kỳ hạn 1–3 năm', 'Chọn gói theo nhu cầu'],
]

export const DEFAULT_FEATURES: ReadonlyArray<readonly [string, string]> = [
  ['Hồ sơ cá thể & thẻ QR', 'Mã QR mở nhanh hồ sơ, thông tin và lịch sử theo từng con.'],
  ['Tăng trưởng & BCS', 'Ghi cân nặng, thể trạng và theo dõi thay đổi theo thời gian.'],
  ['Tiêm phòng & sức khỏe', 'Lưu lịch tiêm, điều trị và lịch tái khám.'],
  ['Sinh sản & đẻ', 'Theo dõi động dục, phối giống, khám thai và ngày dự kiến sinh.'],
  ['Nhắc việc & thông báo trại', 'Xem việc sắp đến hạn và tổng hợp tình hình trại.'],
  ['Nhiều trại độc lập', 'Tách dữ liệu và phân quyền rõ ràng giữa các trại.'],
]

export const STEPS: ReadonlyArray<readonly [string, string]> = [
  ['Quét QR thẻ tai', 'Mở đúng hồ sơ của từng con tại chuồng.'],
  ['Mở đúng hồ sơ', 'Xem nhanh thông tin và lịch sử chăm sóc.'],
  ['Ghi sự kiện thực tế', 'Cập nhật sức khỏe, sinh sản và tăng trưởng.'],
  ['Theo dõi & nhận nhắc việc', 'Biết việc cần làm và xử lý đúng hạn.'],
]

export const DEFAULT_FAQ: ReadonlyArray<readonly [string, string]> = [
  ['BeefCare phù hợp với quy mô trại nào?', 'BeefCare hướng tới các trang trại bò thịt quy mô khoảng 150–300 con và vẫn dùng được cho trại nhỏ hơn hoặc lớn hơn.'],
  ['Quản lý được những thông tin nào của đàn bò?', 'Hồ sơ từng cá thể, chuồng trại, cân nặng và thể trạng, tiêm phòng, sức khỏe, sinh sản, thức ăn và nhắc việc.'],
  ['Thành viên trại được phân quyền ra sao?', 'Mỗi trại có Chủ trại, Quản lý và Kỹ thuật viên với quyền cố định theo vai trò. Chủ trại mời và quản lý thành viên.'],
  ['Có thể dùng trên điện thoại không?', 'Có. BeefCare chạy trên trình duyệt, không cần cài ứng dụng; Kỹ thuật viên có giao diện điện thoại để ghi nhận tại chuồng.'],
  ['Tôi cần hỗ trợ khi bắt đầu từ đâu?', 'Liên hệ BeefCare qua email hoặc điện thoại ở cuối trang; chúng tôi hướng dẫn tạo trại và mời thành viên.'],
]

export const PLAN_YEARS = [1, 2, 3] as const
