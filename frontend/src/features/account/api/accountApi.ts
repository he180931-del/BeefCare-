import { asRecord, asRows, backendFarmId, backendMode, backendTransport, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { accountDemoStore, type AccountDemoStore } from '../data/accountDemoStore'
import type { AccountIdentity, AccountProfile, PasswordChangeInput, ProfileUpdateInput } from '../types'

function profile(value: unknown): AccountProfile {
  const row = asRecord(value)
  return {
    id: numberValue(row.id), email: textValue(row.email), fullName: textValue(row.fullName), phone: textValue(row.phone),
    emailVerified: row.emailVerified === true, passwordSignInEnabled: row.passwordSignInEnabled === true,
    googleSignInLinked: row.googleSignInLinked === true, ownerRegistrationCompleted: row.ownerRegistrationCompleted === true,
    status: textValue(row.status, 'ACTIVE'),
    signInMethods: Array.isArray(row.signInMethods) ? row.signInMethods.filter((item): item is string => typeof item === 'string') : [],
    hasPassword: row.hasPassword === true || row.passwordSignInEnabled === true,
    platformRole: typeof row.platformRole === 'string' ? row.platformRole : null,
    farms: asRows(row.farms).map((farm) => ({
      farmId: numberValue(farm.farmId), farmName: textValue(farm.farmName), role: textValue(farm.role),
      serviceStatus: textValue(farm.serviceStatus),
      permissions: Array.isArray(farm.permissions) ? farm.permissions.filter((item): item is string => typeof item === 'string') : [],
    })),
  }
}

/** `identity` chỉ dùng ở chế độ mô phỏng; máy chủ thật nhận diện người dùng qua phiên. */
export function createAccountApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: AccountDemoStore }) {
  void farmId
  const backend = mode === 'backend'
  return {
    // GET /api/account/profile
    async getProfile(identity: AccountIdentity): Promise<AccountProfile> {
      return backend ? profile(await transport.get('/api/account/profile')) : store.getProfile(identity)
    },
    // POST /api/account/profile (OpenAPI ProfileUpdate hiện mô tả sai trường: gửi fullName và phone theo SRS SCR-08)
    async updateProfile(identity: AccountIdentity, input: ProfileUpdateInput): Promise<AccountProfile> {
      return backend ? profile(await transport.command('/api/account/profile', { fullName: input.fullName.trim(), phone: input.phone.trim() }, { method: 'POST' })) : store.updateProfile(identity, input)
    },
    // POST /api/account/google-reauthentication (D07), sau đó trình duyệt chuyển tới Google
    async reauthenticateWithGoogle(identity: AccountIdentity): Promise<{ redirectTo: string | null }> {
      if (!backend) return store.reauthenticateWithGoogle(identity)
      await transport.command('/api/account/google-reauthentication', {}, { method: 'POST' })
      return { redirectTo: '/oauth2/authorization/google' }
    },
    // POST /api/account/change-password
    async changePassword(identity: AccountIdentity, input: PasswordChangeInput): Promise<{ message: string }> {
      if (!backend) return store.changePassword(identity, input)
      await transport.command('/api/account/change-password', input, { method: 'POST' })
      return { message: 'Mật khẩu đã được đổi. Các phiên khác đã được đăng xuất.' }
    },
  }
}

export type AccountApi = ReturnType<typeof createAccountApi>
export const accountApi = createAccountApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: accountDemoStore })
