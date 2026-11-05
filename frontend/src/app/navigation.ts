import type { ScreenRole } from './screenManifest'

export interface NavigationItem { name: string; to: string; readOnly?: boolean }
export interface NavigationGroup { label: string; items: NavigationItem[] }

const item = (name: string, to: string, readOnly = false): NavigationItem => ({ name, to, ...(readOnly ? { readOnly } : {}) })

const farmCommon: NavigationGroup[] = [
  { label: 'VẬN HÀNH', items: [item('Tổng quan', '/ui/scr-77'), item('Nhắc việc', '/ui/scr-73'), item('Thông báo', '/ui/scr-38')] },
  { label: 'ĐÀN BÒ', items: [item('Đàn bò', '/ui/scr-26'), item('Nhập đàn', '/ui/scr-33'), item('Chuồng trại', '/ui/scr-22'), item('Xuất đàn', '/ui/scr-69')] },
  { label: 'CHĂM SÓC', items: [item('Cân nặng & thể trạng', '/ui/scr-42'), item('Tiêm phòng', '/ui/scr-46'), item('Sức khỏe & điều trị', '/ui/scr-53'), item('Sinh sản', '/ui/scr-59'), item('Thức ăn', '/ui/scr-111')] },
  { label: 'QUẢN TRỊ', items: [item('Báo cáo', '/ui/scr-78'), item('Danh mục & tham số', '/ui/scr-81')] },
]

const owner: NavigationGroup[] = [...farmCommon, { label: 'TRANG TRẠI', items: [item('Thông tin trại', '/ui/scr-12'), item('Thành viên & quyền', '/ui/scr-15'), item('Gói dịch vụ', '/ui/scr-86'), item('Thông báo của tôi', '/ui/scr-74'), item('Hỗ trợ', '/ui/scr-93')] }]
const manager: NavigationGroup[] = farmCommon.map((group) => ({ ...group, items: group.items.map((entry) => entry.name === 'Xuất đàn' ? { ...entry, readOnly: true } : entry) })).concat([{ label: 'TRANG TRẠI', items: [item('Thành viên & quyền', '/ui/scr-15')] }])
const technician: NavigationGroup[] = [
  { label: 'CÔNG VIỆC', items: [item('Hôm nay', '/ui/scr-104'), item('Đàn bò', '/ui/scr-26'), item('Quét QR', '/ui/scr-32'), item('Sinh sản', '/ui/scr-59'), item('Khẩu phần hôm nay', '/ui/scr-122'), item('Thông báo', '/ui/scr-38')] },
]
const cs: NavigationGroup[] = [{ label: 'HỖ TRỢ', items: [item('Hàng đợi hỗ trợ', '/ui/scr-96'), item('Thông báo hỗ trợ', '/ui/scr-75'), item('Công việc được giao', '/ui/scr-99')] }]
const pm: NavigationGroup[] = [{ label: 'KINH DOANH', items: [item('Tổng quan dịch vụ', '/ui/scr-13'), item('Đăng ký dịch vụ', '/ui/scr-90'), item('Thanh toán & đối soát', '/ui/scr-91'), item('Thông báo hỗ trợ', '/ui/scr-75'), item('Thông báo đối soát', '/ui/scr-76'), item('Bảng giá gói', '/ui/scr-92'), item('Báo cáo tiền mặt', '/ui/scr-103'), item('Công việc được giao', '/ui/scr-99')] }]
const sa: NavigationGroup[] = [{ label: 'HỆ THỐNG', items: [item('Tài khoản người dùng', '/ui/scr-20'), item('Quyền nhân sự', '/ui/scr-21'), item('Thông báo hỗ trợ', '/ui/scr-75'), item('Nhật ký kiểm tra', '/ui/scr-80'), item('Công việc được giao', '/ui/scr-99')] }]

const NAVIGATION: Record<Exclude<ScreenRole, 'guest'>, NavigationGroup[]> = { owner, manager, technician, cs, pm, sa }
const LANDING: Record<ScreenRole, string> = { guest: '/ui/scr-01', owner: '/ui/scr-77', manager: '/ui/scr-77', technician: '/ui/scr-104', cs: '/ui/scr-96', pm: '/ui/scr-90', sa: '/ui/scr-20' }

export function navigationForRole(role: Exclude<ScreenRole, 'guest'>): NavigationGroup[] {
  return NAVIGATION[role]
}

export function landingRouteForRole(role: ScreenRole): string {
  return LANDING[role]
}
