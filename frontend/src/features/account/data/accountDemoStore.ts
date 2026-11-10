import { validatePasswordChange, validateProfile } from '../domain/profileRules'
import type { AccountIdentity, AccountProfile, PasswordChangeInput, ProfileUpdateInput } from '../types'
import { MOCK_PASSWORD, REAUTH_WINDOW_MS, seedProfile } from './accountMock'

export const PASSWORD_LOCK_THRESHOLD = 5

/** Bộ nhớ trong phiên áp dụng đúng luật hồ sơ và đổi mật khẩu (GBR-02, D07); không dùng localStorage. */
export function createAccountDemoStore(options: { now?: () => number } = {}) {
  const now = options.now ?? Date.now
  const profiles = new Map<string, AccountProfile>()
  const passwords = new Map<string, string>()
  const failures = new Map<string, number>()
  const reauthAt = new Map<string, number>()

  const ensure = (identity: AccountIdentity) => {
    const key = identity.email.toLowerCase()
    let profile = profiles.get(key)
    if (!profile) { profile = seedProfile(identity); profiles.set(key, profile); passwords.set(key, MOCK_PASSWORD) }
    return { key, profile }
  }
  const copy = (profile: AccountProfile): AccountProfile => ({ ...profile, farms: profile.farms.map((farm) => ({ ...farm, permissions: [...farm.permissions] })) })
  const recentlyReauthenticated = (key: string) => now() - (reauthAt.get(key) ?? -Infinity) <= REAUTH_WINDOW_MS

  return {
    async getProfile(identity: AccountIdentity) { return copy(ensure(identity).profile) },

    async updateProfile(identity: AccountIdentity, input: ProfileUpdateInput) {
      const { key, profile } = ensure(identity)
      const errors = validateProfile(input)
      const first = Object.values(errors)[0]
      if (first) throw new Error(first)
      const updated = { ...profile, fullName: input.fullName.trim(), phone: input.phone.trim() }
      profiles.set(key, updated)
      return copy(updated)
    },

    /** D07: ghi nhận thời điểm xác thực lại với Google; chỉ tài khoản có Google. */
    async reauthenticateWithGoogle(identity: AccountIdentity) {
      const { key, profile } = ensure(identity)
      if (!profile.googleSignInLinked) throw new Error('Tài khoản này chưa liên kết với Google.')
      reauthAt.set(key, now())
      return { redirectTo: null as string | null }
    },

    async changePassword(identity: AccountIdentity, input: PasswordChangeInput) {
      const { key, profile } = ensure(identity)
      const reauthed = profile.googleSignInLinked && recentlyReauthenticated(key)
      if (!profile.passwordSignInEnabled && !reauthed) throw new Error('Cần xác thực lại với Google trước khi thêm mật khẩu.')
      const requireCurrent = profile.passwordSignInEnabled && !reauthed
      const errors = validatePasswordChange(input, { email: profile.email, requireCurrent })
      const first = errors.currentPassword ?? errors.newPassword ?? errors.confirmPassword
      if (first) throw new Error(first)
      if (requireCurrent) {
        if ((failures.get(key) ?? 0) >= PASSWORD_LOCK_THRESHOLD) throw new Error('Đổi mật khẩu bị khóa 15 phút sau 5 lần nhập sai. Hãy xác thực lại với Google hoặc thử lại sau.')
        if (input.currentPassword !== passwords.get(key)) {
          failures.set(key, (failures.get(key) ?? 0) + 1)
          throw new Error('Mật khẩu hiện tại không đúng.')
        }
      }
      passwords.set(key, input.newPassword)
      failures.delete(key)
      profiles.set(key, { ...profile, passwordSignInEnabled: true, hasPassword: true, signInMethods: [...new Set([...profile.signInMethods, 'PASSWORD'])] })
      return { message: 'Mật khẩu đã được đổi. Các phiên khác đã được đăng xuất.' }
    },

    async reset() { profiles.clear(); passwords.clear(); failures.clear(); reauthAt.clear() },
  }
}

export type AccountDemoStore = ReturnType<typeof createAccountDemoStore>
export const accountDemoStore = createAccountDemoStore()
