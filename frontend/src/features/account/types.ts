import type { AppRole } from '../authorization'

/** ProfileResponse trong OpenAPI (GET /api/account/profile). */
export interface AccountProfile {
  id: number
  email: string
  fullName: string
  phone: string
  emailVerified: boolean
  passwordSignInEnabled: boolean
  googleSignInLinked: boolean
  ownerRegistrationCompleted: boolean
  status: string
  signInMethods: string[]
  hasPassword: boolean
  platformRole: string | null
  farms: Array<{ farmId: number; farmName: string; role: string; serviceStatus: string; permissions: string[] }>
}

/** A10: server-verified permissions for the currently selected farm. */
export interface FarmPermission { area: string; value: 'FULL' | 'RESTRICTED' | 'NO' }
export interface FarmPermissions { role: 'OWNER' | 'MANAGER' | 'TECHNICIAN'; permissions: FarmPermission[] }

/** Người đang đăng nhập; chế độ mô phỏng dùng nó để dựng hồ sơ, máy chủ thật bỏ qua. */
export interface AccountIdentity {
  email: string
  fullName: string
  role: AppRole
  farmName: string | null
  farmId: number | null
}

export interface ProfileUpdateInput { fullName: string; phone: string }

/** `currentPassword` bỏ trống khi vừa xác thực lại với Google (D07) hoặc khi thêm mật khẩu đầu tiên. */
export interface PasswordChangeInput { currentPassword?: string; newPassword: string; confirmPassword: string }

export type ProfileErrors = Partial<Record<keyof ProfileUpdateInput, string>>
export type PasswordErrors = Partial<Record<keyof PasswordChangeInput, string>>
