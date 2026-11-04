export interface OperationalRow { code: string; subject: string; detail: string; date: string; status: string }
export interface OperationalConfig { primaryAction: string; emptyTitle: string; columns: [string, string, string, string]; rows: OperationalRow[] }

const rows = (prefix: string, status: string): OperationalRow[] => [
  { code: `${prefix}-001`, subject: 'VN-0248 · Bò cái 248', detail: 'Chuồng A2 · Brahman lai', date: '02/11/2026', status },
  { code: `${prefix}-002`, subject: 'VN-0186 · Bò cái 186', detail: 'Chuồng C1 · Lai Sind', date: '04/11/2026', status: 'Đang theo dõi' },
  { code: `${prefix}-003`, subject: 'VN-0312 · Bê 312', detail: 'Chuồng A3 · 6 tháng tuổi', date: '08/11/2026', status: 'Đã hoàn tất' },
]

export const operationConfigs: Record<string, OperationalConfig> = {
  announcement: { primaryAction: 'Soạn thông báo', emptyTitle: 'Chưa có thông báo', columns: ['Mã', 'Tiêu đề', 'Ngày phát hành', 'Trạng thái'], rows: rows('TB', 'Chờ phát hành') },
  growth: { primaryAction: 'Ghi nhận cân', emptyTitle: 'Chưa có số đo phù hợp', columns: ['Bò', 'Số đo', 'Ngày cân', 'Trạng thái'], rows: rows('CN', 'Cần cân lại') },
  vaccination: { primaryAction: 'Ghi nhận tiêm', emptyTitle: 'Chưa có lịch tiêm phù hợp', columns: ['Bò', 'Vaccine / mũi', 'Ngày dự kiến', 'Trạng thái'], rows: rows('TP', 'Sắp đến hạn') },
  health: { primaryAction: 'Mở ca bệnh', emptyTitle: 'Chưa có ca bệnh phù hợp', columns: ['Mã ca', 'Bò / triệu chứng', 'Ngày mở', 'Trạng thái'], rows: rows('SK', 'Đang điều trị') },
  reproduction: { primaryAction: 'Ghi nhận mới', emptyTitle: 'Chưa có công việc sinh sản phù hợp', columns: ['Bò', 'Công việc', 'Ngày dự kiến', 'Trạng thái'], rows: rows('SS', 'Cần khám thai') },
  reminder: { primaryAction: 'Tạo nhắc việc', emptyTitle: 'Chưa có nhắc việc', columns: ['Mã', 'Nội dung', 'Hạn xử lý', 'Trạng thái'], rows: rows('NV', 'Hôm nay') },
  feed: { primaryAction: 'Tạo phiếu', emptyTitle: 'Chưa có dữ liệu thức ăn', columns: ['Mã', 'Thức ăn / nhà cung cấp', 'Ngày ghi nhận', 'Trạng thái'], rows: rows('TA', 'Đủ tồn kho') },
  catalogue: { primaryAction: 'Thêm danh mục', emptyTitle: 'Chưa có mục danh mục', columns: ['Mã', 'Tên danh mục', 'Cập nhật', 'Trạng thái'], rows: rows('DM', 'Đang sử dụng') },
}

export function configForFeature(feature: string): OperationalConfig {
  return operationConfigs[feature] ?? { primaryAction: 'Tạo mới', emptyTitle: 'Chưa có dữ liệu phù hợp', columns: ['Mã', 'Nội dung', 'Cập nhật', 'Trạng thái'], rows: rows('BC', 'Đang xử lý') }
}
