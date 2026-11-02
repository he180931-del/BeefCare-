import type { FarmRole } from '../types'

/** Bảng quyền cố định theo vai trò (SRS Table III-2, GBR-06): có / chỉ xem / không. */
export type PermissionLevel = 'full' | 'view' | 'none'

export interface PermissionArea {
  label: string
  /** Chỉ Chủ trại có quyền quản lý (nhóm "Chỉ Chủ trại" ở Figma). */
  ownerOnly?: boolean
  levels: Record<FarmRole, PermissionLevel>
}

const area = (label: string, OWNER: PermissionLevel, MANAGER: PermissionLevel, TECHNICIAN: PermissionLevel, ownerOnly = false): PermissionArea => ({ label, ownerOnly, levels: { OWNER, MANAGER, TECHNICIAN } })

export const PERMISSION_AREAS: readonly PermissionArea[] = [
  area('Hồ sơ bò & thẻ QR', 'full', 'full', 'view'),
  area('Chuồng trại & chuyển chuồng', 'full', 'full', 'view'),
  area('Nhập đàn & xác nhận bê', 'full', 'full', 'none'),
  area('Cân nặng & thể trạng', 'view', 'full', 'view'),
  area('Tiêm phòng', 'view', 'full', 'view'),
  area('Sức khỏe & điều trị', 'view', 'full', 'view'),
  area('Sinh sản', 'view', 'full', 'view'),
  area('Danh mục & tham số trại', 'full', 'full', 'view'),
  area('Thông báo trại', 'full', 'full', 'view'),
  area('Báo cáo & tổng quan', 'full', 'full', 'none'),
  area('Thành viên & vai trò', 'full', 'none', 'none', true),
  area('Gói dịch vụ & thanh toán', 'full', 'none', 'none', true),
  area('Xác nhận / hủy xuất đàn', 'full', 'none', 'none', true),
  area('Đổi mục đích nuôi', 'full', 'none', 'none', true),
]

export const LEVEL_LABEL: Record<PermissionLevel, string> = { full: 'Có', view: 'Chỉ xem', none: 'Không' }

/** Các dòng quyền của một vai trò; Quản lý và Kỹ thuật viên không có nhóm "Chỉ Chủ trại". */
export function permissionRowsFor(role: FarmRole) {
  return PERMISSION_AREAS.filter((item) => role === 'OWNER' || !item.ownerOnly).map((item) => ({ label: item.label, level: item.levels[role], ownerOnly: Boolean(item.ownerOnly) }))
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
