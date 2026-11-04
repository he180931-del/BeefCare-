export interface PlatformWorkRow { code: string; subject: string; owner: string; amount: string; status: string; updatedAt: string }
export interface PlatformWorkConfig { intro: string; primaryAction: string; searchPlaceholder: string; rows: PlatformWorkRow[] }

const reconciliationRows: PlatformWorkRow[] = [
  { code: 'DS-261102-08', subject: 'Đăng ký trại Ba Vì', owner: 'Nguyễn Văn Hùng', amount: '6.000.000 đ', status: 'Chờ đối soát', updatedAt: '02/11/2026 · 08:40' },
  { code: 'DS-261101-17', subject: 'Gia hạn trại Mộc Châu', owner: 'Trần Quốc Long', amount: '3.600.000 đ', status: 'Đã khớp', updatedAt: '01/11/2026 · 16:25' },
]
const supportRows: PlatformWorkRow[] = [
  { code: 'HT-2026-184', subject: 'Không in được thẻ QR', owner: 'Trại Ba Vì', amount: 'Ưu tiên cao', status: 'Đang xử lý', updatedAt: '02/11/2026 · 09:15' },
  { code: 'HT-2026-181', subject: 'Sai số lượng chuồng trống', owner: 'Trại Yên Bái', amount: 'Ưu tiên vừa', status: 'Chờ phản hồi', updatedAt: '02/11/2026 · 08:05' },
]

export const userAccountRows = [
  { name: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', platformRole: 'Không có', farms: '3 (Chủ trại)', status: 'Đang hoạt động', verified: 'Đã xác minh', createdAt: '12/03/2024 08:40', lastSignIn: '03/11/2026 05:58' },
  { name: 'Trần Thu Hà', email: 'pm@beefcare.local', platformRole: 'PM', farms: '0', status: 'Đang hoạt động', verified: 'Đã xác minh', createdAt: '08/01/2025 10:12', lastSignIn: '03/11/2026 06:02' },
  { name: 'Lê Minh An', email: 'an@example.vn', platformRole: 'Không có', farms: '1 (Kỹ thuật viên)', status: 'Tạm ngừng', verified: 'Đã xác minh', createdAt: '16/08/2026 15:30', lastSignIn: '29/10/2026 17:45' },
]

export const staffAccessRows = [
  { name: 'Phạm Lan', email: 'lan.cs@beefcare.local', role: 'CS', status: 'Đang hoạt động', changedAt: '28/10/2026 09:12', changedBy: 'admin@beefcare.local' },
  { name: 'Trần Thu Hà', email: 'pm@beefcare.local', role: 'PM', status: 'Đang hoạt động', changedAt: '15/09/2026 14:05', changedBy: 'admin@beefcare.local' },
  { name: 'Hoàng Quốc Bảo', email: 'bao.sa@beefcare.local', role: 'SA', status: 'Đã thu hồi', changedAt: '02/08/2026 11:20', changedBy: 'admin@beefcare.local' },
]

export const auditRows = [
  { time: '03/11/2026 06:18', actor: 'Trần Thu Hà · PM', action: 'FARM_SERVICE_RESTORED', target: 'Trang trại · Trại Mộc Châu', correlation: 'corr-7f42…a91c', before: 'status: SUSPENDED', after: 'status: ACTIVE' },
  { time: '02/11/2026 16:35', actor: 'System', action: 'PAYMENT_CONFIRMED', target: 'Thanh toán · PAY-***-1842', correlation: 'corr-22bc…90de', before: 'status: PENDING', after: 'status: CONFIRMED' },
  { time: '02/11/2026 09:08', actor: 'Admin BeefCare · SA', action: 'MEMBERSHIP_ROLE_CHANGED', target: 'Thành viên · mem-***-381', correlation: 'corr-18d0…42ab', before: 'role: TECHNICIAN', after: 'role: MANAGER' },
]

export function platformConfigFor(feature: string): PlatformWorkConfig {
  if (feature.includes('finance') || feature.includes('subscription')) return { intro: 'Theo dõi khoản chuyển, đối chiếu nội dung thanh toán và xác nhận kết quả trong cùng một hàng công việc.', primaryAction: 'Ghi nhận khoản thu', searchPlaceholder: 'Tìm mã đối soát hoặc trang trại…', rows: reconciliationRows }
  return { intro: 'Ưu tiên yêu cầu cần hành động, giữ rõ người phụ trách và lần cập nhật gần nhất.', primaryAction: 'Tiếp nhận yêu cầu', searchPlaceholder: 'Tìm mã yêu cầu hoặc trang trại…', rows: supportRows }
}
