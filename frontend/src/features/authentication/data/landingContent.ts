/** Nội dung tĩnh của trang công khai (SCR-01), theo khung Figma "Trang công khai · Redesign". */
export const CONTACT = { email: 'tuanpqhe181869@fpt.edu.vn', phone: '0386 671 863', phoneHref: 'tel:+84386671863' }

export const NAV_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Tính năng', '#features'], ['Cách hoạt động', '#steps'], ['Bảng giá', '#pricing'], ['Câu hỏi', '#faq'], ['Liên hệ', '#contact'],
]

export const HERO_POINTS = ['Dữ liệu có tổ chức', 'Dễ dùng tại trại', 'Theo dõi từng cá thể']

export const OVERVIEW_CARDS: ReadonlyArray<readonly [string, string]> = [
  ['Hồ sơ bò', 'Theo dõi từng cá thể'], ['Sức khỏe', 'Tiêm phòng & điều trị'],
  ['Sinh sản', 'Theo dõi theo giai đoạn'], ['Nhắc việc', 'Biết việc cần làm hôm nay'],
]

export const DEFAULT_FEATURES: ReadonlyArray<readonly [string, string]> = [
  ['Hồ sơ cá thể', 'Mã QR mở nhanh hồ sơ, thông tin và lịch sử theo từng con.'],
  ['Đàn & chuồng', 'Quản lý nhóm đàn, vị trí chuồng và tình trạng hiện tại.'],
  ['Tăng trưởng & BCS', 'Ghi cân nặng, thể trạng và theo dõi thay đổi theo thời gian.'],
  ['Tiêm phòng & sức khỏe', 'Lưu lịch tiêm, điều trị và lịch tái khám.'],
  ['Sinh sản', 'Theo dõi động dục, phối giống, khám thai và ngày dự kiến sinh.'],
  ['Nhắc việc & báo cáo', 'Xem việc sắp đến hạn và tổng hợp tình hình trại.'],
]

export const STEPS: ReadonlyArray<readonly [string, string]> = [
  ['Tạo trại', 'Thiết lập thông tin trại và mời thành viên.'],
  ['Thêm hồ sơ bò', 'Tạo hồ sơ hoặc nhập đàn theo phiếu.'],
  ['Ghi nhận tại trại', 'Cập nhật sức khỏe, sinh sản, tăng trưởng.'],
  ['Theo dõi & nhắc việc', 'Xem tổng quan và xử lý việc đến hạn.'],
]

export const DEFAULT_FAQ: ReadonlyArray<readonly [string, string]> = [
  ['BeefCare phù hợp với quy mô trại nào?', 'BeefCare hướng tới các trang trại bò thịt quy mô khoảng 150–300 con và vẫn dùng được cho trại nhỏ hơn hoặc lớn hơn.'],
  ['Quản lý được những thông tin nào của đàn bò?', 'Hồ sơ từng cá thể, chuồng trại, cân nặng và thể trạng, tiêm phòng, sức khỏe, sinh sản, thức ăn và nhắc việc.'],
  ['Thành viên trại được phân quyền ra sao?', 'Mỗi trại có Chủ trại, Quản lý và Kỹ thuật viên với quyền cố định theo vai trò. Chủ trại mời và quản lý thành viên.'],
  ['Có thể dùng trên điện thoại không?', 'Có. BeefCare chạy trên trình duyệt, không cần cài ứng dụng; Kỹ thuật viên có giao diện điện thoại để ghi nhận tại chuồng.'],
  ['Tôi cần hỗ trợ khi bắt đầu từ đâu?', 'Liên hệ BeefCare qua email hoặc điện thoại ở cuối trang; chúng tôi hướng dẫn tạo trại và mời thành viên.'],
]

export const PLAN_YEARS = [1, 2, 3] as const
