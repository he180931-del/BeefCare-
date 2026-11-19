import { backendFarmId } from '../../../api/backendTransport'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import { accountDemoStore, type AccountDemoStore } from '../data/accountDemoStore'
import { googleAuthorizationUrl } from '../../authentication'
import { permissionRowsFor } from '../../farm-workspace'
import type { AccountIdentity, AccountProfile, FarmPermissions, PasswordChangeInput, ProfileUpdateInput } from '../types'
import { mapAccountProfile, mapFarmPermissions } from './accountMapper'

function mockPermissions(role: 'OWNER' | 'MANAGER' | 'TECHNICIAN'): FarmPermissions {
  const level = { full: 'FULL', view: 'RESTRICTED', none: 'NO' } as const
  return { role, permissions: permissionRowsFor(role).map((item) => ({ area: item.label, value: level[item.level] })) }
}

/** `identity` chỉ dùng ở chế độ mô phỏng; máy chủ thật nhận diện người dùng qua phiên. */
export function createAccountApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: AccountDemoStore }) {
  void farmId
  const backend = mode === 'backend'
  return {
    /** Gợi ý chỉ có ở bản mô phỏng; máy chủ thật không có mật khẩu mẫu. */
    samplePasswordHint(): string | null { return backend ? null : `Bản mô phỏng: mật khẩu hiện tại là ${store.samplePassword}.` },
    // GET /api/account/profile
    async getProfile(identity: AccountIdentity): Promise<AccountProfile> {
      return backend ? mapAccountProfile(await transport.get('/api/account/profile')) : store.getProfile(identity)
    },
    // POST /api/account/profile (FE01 A9: contactPhone là tên trường hợp đồng)
    async updateProfile(identity: AccountIdentity, input: ProfileUpdateInput): Promise<AccountProfile> {
      return backend ? mapAccountProfile(await transport.command('/api/account/profile', { fullName: input.fullName.trim(), contactPhone: input.phone.trim() }, { method: 'POST' })) : store.updateProfile(identity, input)
    },
    async getFarmPermissions(identity: AccountIdentity, farmId: number): Promise<FarmPermissions> {
      if (backend) return mapFarmPermissions(await transport.get(`/api/farms/${farmId}/my-permissions`))
      if (identity.role !== 'OWNER' && identity.role !== 'MANAGER' && identity.role !== 'TECHNICIAN') throw new Error('Tài khoản nền tảng không có quyền trại.')
      return mockPermissions(identity.role)
    },
    // POST /api/account/google-reauthentication (D07), sau đó trình duyệt chuyển tới Google
    async reauthenticateWithGoogle(identity: AccountIdentity, returnTo: string): Promise<{ redirectTo: string | null }> {
      if (!backend) return store.reauthenticateWithGoogle(identity)
      await transport.command('/api/account/google-reauthentication', { returnTo }, { method: 'POST' })
      return { redirectTo: googleAuthorizationUrl() }
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
