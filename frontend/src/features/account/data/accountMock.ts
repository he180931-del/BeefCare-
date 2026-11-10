import type { AppRole } from '../../authorization'
import type { AccountIdentity, AccountProfile } from '../types'

/** Mật khẩu của mọi tài khoản mô phỏng (các nút vai trò ở trang đăng nhập điền sẵn giá trị này). */
export const MOCK_PASSWORD = 'mock-demo'
export const REAUTH_WINDOW_MS = 5 * 60 * 1000

const SEEDS: Record<AppRole, { phone: string; google: boolean; password: boolean }> = {
  OWNER: { phone: '0912 345 678', google: true, password: true },
  MANAGER: { phone: '0987 654 321', google: true, password: true },
  TECHNICIAN: { phone: '0934 567 890', google: false, password: true },
  CS: { phone: '0901 234 567', google: false, password: true },
  PM: { phone: '0902 345 678', google: true, password: false },
  SA: { phone: '0903 456 789', google: false, password: true },
}

let nextId = 100

/** Dựng hồ sơ mô phỏng từ người đang đăng nhập, để tên và email khớp mọi màn hình khác. */
export function seedProfile(identity: AccountIdentity): AccountProfile {
  const seed = SEEDS[identity.role]
  const farmRole = identity.role === 'OWNER' || identity.role === 'MANAGER' || identity.role === 'TECHNICIAN'
  return {
    id: nextId++, email: identity.email, fullName: identity.fullName, phone: seed.phone, emailVerified: true,
    passwordSignInEnabled: seed.password, googleSignInLinked: seed.google, ownerRegistrationCompleted: identity.role === 'OWNER',
    status: 'ACTIVE', signInMethods: [seed.password && 'PASSWORD', seed.google && 'GOOGLE'].filter((method): method is string => Boolean(method)), hasPassword: seed.password,
    platformRole: farmRole ? null : identity.role,
    farms: farmRole && identity.farmName ? [{ farmId: 1, farmName: identity.farmName, role: identity.role, serviceStatus: 'ACTIVE', permissions: [] }] : [],
  }
}
