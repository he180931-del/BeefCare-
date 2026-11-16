import type { FarmRole } from '../types'

/**
 * Bảng quyền cố định theo vai trò, đúng SRS Table III-2 (GBR-06, D29): 17 nhóm quyền × 3 vai trò. `text` là nội dung ô
 * của SRS (null = không có quyền, hiện "—"); `level` là mức thô dùng chung với SCR-08 (`FULL`/`RESTRICTED`/`NO` của
 * `GET /api/farms/{farmId}/my-permissions`), nhãn nhóm quyền trùng nhãn SCR-08.
 */
export type PermissionLevel = 'full' | 'view' | 'none'

export interface PermissionCell { level: PermissionLevel; text: string | null }

export interface PermissionArea {
  code: string
  label: string
  /** Chỉ Chủ trại có quyền (Quản lý và Kỹ thuật viên đều "—"). */
  ownerOnly: boolean
  access: Record<FarmRole, PermissionCell>
}

type Cell = [PermissionLevel, string] | null
const cell = (value: Cell): PermissionCell => value ? { level: value[0], text: value[1] } : { level: 'none', text: null }
const area = (code: string, label: string, OWNER: Cell, MANAGER: Cell, TECHNICIAN: Cell): PermissionArea =>
  ({ code, label, ownerOnly: MANAGER === null && TECHNICIAN === null, access: { OWNER: cell(OWNER), MANAGER: cell(MANAGER), TECHNICIAN: cell(TECHNICIAN) } })

export const PERMISSION_AREAS: readonly PermissionArea[] = [
  area('CATTLE_PROFILE_QR', 'Hồ sơ bò & thẻ QR', ['full', 'Quản lý (cả mục đích)'], ['full', 'Quản lý (trừ mục đích)'], ['view', 'Xem']),
  area('PENS_AND_MOVES', 'Chuồng trại & chuyển chuồng', ['full', 'Quản lý'], ['full', 'Quản lý'], ['view', 'Xem']),
  area('HERD_ENTRY_AND_PAYMENTS', 'Nhập đàn, thanh toán & xác nhận bê', ['full', 'Quản lý'], ['full', 'Quản lý'], null),
  area('GROWTH_BCS', 'Cân nặng & thể trạng', ['view', 'Xem'], ['full', 'Ghi và sửa'], ['view', 'Xem']),
  area('VACCINATION', 'Tiêm phòng', ['view', 'Xem'], ['full', 'Lập lịch, ghi và sửa'], ['view', 'Xem']),
  area('HEALTH_AND_TREATMENT', 'Sức khỏe & điều trị', ['view', 'Xem'], ['full', 'Ghi và sửa'], ['view', 'Xem']),
  area('REPRODUCTION', 'Sinh sản', ['view', 'Xem'], ['full', 'Ghi và sửa'], ['view', 'Xem']),
  area('CATALOGUES_AND_PARAMETERS', 'Danh mục & tham số trại', ['view', 'Mục đích, tham số; xem danh mục'], ['full', 'Quản lý tất cả'], ['view', 'Xem giống, vắc-xin, thuốc']),
  area('FARM_ANNOUNCEMENTS', 'Thông báo trại', ['full', 'Viết cho Quản lý và Kỹ thuật viên'], ['full', 'Viết cho Kỹ thuật viên'], ['view', 'Đọc thông báo nhận được']),
  area('REMINDERS', 'Nhắc việc', ['view', 'Xem (trừ cữ ăn chưa ghi)'], ['view', 'Xem tất cả'], ['view', 'Xem (trừ bê nháp và thức ăn sắp hết)']),
  area('DASHBOARD_AND_REPORTS', 'Tổng quan & báo cáo', ['view', 'Xem'], ['view', 'Xem'], null),
  area('MEMBERS_ROLES', 'Thành viên & vai trò', ['full', 'Quản lý'], ['view', 'Xem danh sách'], null),
  area('HERD_EXIT_AND_COLLECTIONS', 'Xuất đàn & thu tiền', ['full', 'Ghi, xác nhận, bỏ, hủy'], ['view', 'Xem phiếu'], null),
  area('FEED_STOCK_AND_CATALOGUE', 'Kho thức ăn, phiếu nhập, khẩu phần & danh mục', ['full', 'Quản lý'], ['full', 'Quản lý'], ['view', 'Xem khẩu phần']),
  area('FEEDING_LOG', 'Nhật ký cho ăn', ['view', 'Xem'], ['full', 'Ghi và sửa'], ['view', 'Xem']),
  area('SUBSCRIPTION_AND_PAYMENT', 'Gói dịch vụ & thanh toán', ['full', 'Quản lý'], null, null),
  area('FARM_INFORMATION', 'Thông tin trại', ['full', 'Quản lý'], null, null),
]

export const LEVEL_LABEL: Record<PermissionLevel, string> = { full: 'Có', view: 'Chỉ xem', none: 'Không' }

/** Các dòng quyền của một vai trò; Quản lý và Kỹ thuật viên không nhận các nhóm chỉ dành cho Chủ trại. */
export function permissionRowsFor(role: FarmRole) {
  return PERMISSION_AREAS.filter((item) => role === 'OWNER' || !item.ownerOnly)
    .map((item) => ({ label: item.label, level: item.access[role].level, text: item.access[role].text, ownerOnly: item.ownerOnly }))
}

/** Tóm tắt quyền hiển thị khi mời hoặc chấp nhận lời mời (Figma "Chấp nhận lời mời"). */
export const ROLE_SUMMARY: Record<Exclude<FarmRole, 'OWNER'>, readonly string[]> = {
  MANAGER: [
    'Quản lý hồ sơ bò, chuồng trại, nhập đàn và danh mục',
    'Ghi nhận và đính chính tăng trưởng, tiêm phòng, sức khỏe, sinh sản',
    'Gửi thông báo cho Kỹ thuật viên, xem báo cáo và tổng quan',
  ],
  TECHNICIAN: [
    'Xem hồ sơ bò qua quét QR hoặc danh sách',
    'Xem tăng trưởng, tiêm phòng, sức khỏe, sinh sản',
    'Xem chuồng trại, nhắc việc và thông báo trại',
  ],
}
