import type { AppRole } from '../../authorization'

export const PLATFORM_ROLE_LABEL: Record<string, string> = {
  CS: 'Nhân viên hỗ trợ · CS', PM: 'Quản lý nền tảng · PM', SA: 'Quản trị hệ thống · SA',
}
export const FARM_ROLE_LABEL: Record<string, string> = { OWNER: 'Chủ trại', MANAGER: 'Quản lý', TECHNICIAN: 'Kỹ thuật viên' }

export const roleTitle = (role: AppRole) => FARM_ROLE_LABEL[role] ?? PLATFORM_ROLE_LABEL[role] ?? role

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length ? (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : '?'
}

/** Mô tả vai trò ở đầu hồ sơ: "Quản lý tại Trại bò Yên Bài – Ba Vì" hoặc vai trò nền tảng. */
export function roleAtFarm(role: AppRole, farmName: string | null) {
  if (role in FARM_ROLE_LABEL) return farmName ? `${FARM_ROLE_LABEL[role]} tại ${farmName}` : FARM_ROLE_LABEL[role]
  return PLATFORM_ROLE_LABEL[role] ?? role
}
