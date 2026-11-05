import { expandLocalTable, isStressGenerated } from '../../../app/localStressData'
import { staffAccessRows, userAccountRows } from './platformFixtures'

type UserAccountRow = typeof userAccountRows[number]
type StaffAccessRow = typeof staffAccessRows[number]

function indexOf(row: { __stressIndex?: number }, fallback: number) {
  return (row.__stressIndex ?? fallback) + 1
}

/** Large local-only lists used to review density, filters and pagination. */
export function previewUserAccounts(rows: UserAccountRow[]) {
  return expandLocalTable('platform-user-accounts', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = indexOf(row, index)
    const platformRole = value % 8 === 0 ? 'SA' : value % 5 === 0 ? 'PM' : value % 3 === 0 ? 'CS' : 'Không có'
    return {
      ...row,
      name: `Người dùng mô phỏng ${String(value).padStart(3, '0')}`,
      email: `nguoidung.${String(value).padStart(3, '0')}@preview.beefcare.local`,
      platformRole,
      farms: platformRole === 'Không có' ? `${value % 4} (${value % 2 ? 'Kỹ thuật viên' : 'Chủ trại'})` : '0',
      status: value % 9 === 0 ? 'Tạm ngừng' : 'Đang hoạt động',
      createdAt: `${String((value % 28) + 1).padStart(2, '0')}/03/${2024 + value % 3} 08:40`,
      lastSignIn: `${String((value % 28) + 1).padStart(2, '0')}/11/2026 06:02`,
    }
  })
}

export function previewStaffAccess(rows: StaffAccessRow[]) {
  return expandLocalTable('platform-staff-access', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = indexOf(row, index)
    return {
      ...row,
      name: `Nhân sự nền tảng ${String(value).padStart(3, '0')}`,
      email: `nhansu.${String(value).padStart(3, '0')}@preview.beefcare.local`,
      role: value % 7 === 0 ? 'SA' : value % 3 === 0 ? 'PM' : 'CS',
      status: value % 8 === 0 ? 'Đã thu hồi' : 'Đang hoạt động',
      changedAt: `${String((value % 28) + 1).padStart(2, '0')}/10/2026 09:12`,
      changedBy: 'admin@beefcare.local',
    }
  })
}
