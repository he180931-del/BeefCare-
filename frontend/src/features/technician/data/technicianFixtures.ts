export interface TechnicianTask { id: string; title: string; subject: string; due: string; status: string }

export const technicianReminders: TechnicianTask[] = [
  { id: 'KT-01', title: 'Kiểm tra bò sau điều trị', subject: 'VN-0382 · Chuồng A1', due: '07:30', status: 'Quá hạn' },
  { id: 'KT-02', title: 'Tiêm nhắc vaccine LMLM', subject: '12 con · Chuồng B2', due: '09:00', status: 'Hôm nay' },
  { id: 'KT-03', title: 'Khám thai định kỳ', subject: 'VN-0214 · Chuồng C1', due: '14:00', status: 'Sắp tới' },
]

export const technicianAnnouncements = [
  { title: 'Điều chỉnh lịch kiểm tra chuồng C', author: 'Quản lý Trần Quốc Long', time: '20 phút trước' },
  { title: 'Áp dụng quy trình sát trùng cổng mới', author: 'Chủ trại Nguyễn Văn Hùng', time: 'Hôm qua · 16:20' },
]

export const rationRows = [
  { pen: 'A1 · Bò cái sinh sản', count: '58 con', ration: 'TMR sinh sản', amount: '638 kg', status: 'Chưa ghi nhận' },
  { pen: 'B1 · Bò vỗ béo', count: '46 con', ration: 'TMR tăng trọng', amount: '598 kg', status: 'Đã hoàn tất' },
  { pen: 'C2 · Bê cai sữa', count: '41 con', ration: 'Khẩu phần bê', amount: '246 kg', status: 'Chưa ghi nhận' },
]

export const identifiedCattle = {
  code: 'VN-0382', earTag: 'BV-0382', breed: 'Lai Sind', sex: 'Cái', age: '3 năm 4 tháng', pen: 'A1', herdStatus: 'Trong đàn', health: 'Đang điều trị', reproduction: 'Đang chửa',
}
