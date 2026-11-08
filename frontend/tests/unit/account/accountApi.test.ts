import { describe, expect, it, vi } from 'vitest'
import { createAccountApi } from '../../../src/features/account/api/accountApi'
import { createAccountDemoStore } from '../../../src/features/account/data/accountDemoStore'
import { validatePasswordChange, validateProfile } from '../../../src/features/account/domain/profileRules'
import type { AccountIdentity } from '../../../src/features/account/types'

const manager: AccountIdentity = { email: 'manager@beefcare.local', fullName: 'Trần Quốc Long', role: 'MANAGER', farmName: 'Trại bò Yên Bài – Ba Vì', farmId: 1 }
const pm: AccountIdentity = { email: 'pm@beefcare.local', fullName: 'Đỗ Minh Quân', role: 'PM', farmName: null, farmId: null }
const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
const localApi = (now?: () => number) => createAccountApi({ mode: 'local', farmId: 1, transport: transport(), store: createAccountDemoStore({ now }) })

describe('profile and password rules', () => {
  it('validates the name length and the Vietnamese phone format', () => {
    expect(validateProfile({ fullName: ' ', phone: '' }).fullName).toMatch(/bắt buộc/)
    expect(validateProfile({ fullName: 'A', phone: '' }).fullName).toMatch(/2 đến 100/)
    expect(validateProfile({ fullName: 'Trần Quốc Long', phone: '0987 654 321' })).toEqual({})
    expect(validateProfile({ fullName: 'Trần Quốc Long', phone: '+84987654321' })).toEqual({})
    expect(validateProfile({ fullName: 'Trần Quốc Long', phone: '12345' }).phone).toMatch(/không hợp lệ/)
  })

  it('requires 8-128 characters, not the email, and a matching confirmation (GBR-02)', () => {
    const ctx = { email: 'a@b.vn', requireCurrent: true }
    expect(validatePasswordChange({ newPassword: 'short', confirmPassword: 'short' }, ctx)).toMatchObject({ currentPassword: expect.any(String), newPassword: expect.any(String) })
    expect(validatePasswordChange({ currentPassword: 'x', newPassword: 'A@B.VN', confirmPassword: 'A@B.VN' }, ctx).newPassword).toBeDefined()
    expect(validatePasswordChange({ currentPassword: 'x', newPassword: 'longenough1', confirmPassword: 'different1' }, ctx).confirmPassword).toMatch(/chưa khớp/)
    expect(validatePasswordChange({ newPassword: 'longenough1', confirmPassword: 'longenough1' }, { ...ctx, requireCurrent: false })).toEqual({})
  })
})

describe('account API (local mode)', () => {
  it('builds the profile from the signed-in identity and saves name and phone', async () => {
    const api = localApi()
    const profile = await api.getProfile(manager)
    expect(profile).toMatchObject({ email: 'manager@beefcare.local', fullName: 'Trần Quốc Long', platformRole: null })
    expect(profile.farms[0]).toMatchObject({ farmName: 'Trại bò Yên Bài – Ba Vì', role: 'MANAGER' })
    const saved = await api.updateProfile(manager, { fullName: ' Trần Quốc Long B ', phone: '0911 222 333' })
    expect(saved.fullName).toBe('Trần Quốc Long B')
    expect((await api.getProfile(manager)).phone).toBe('0911 222 333')
    await expect(api.updateProfile(manager, { fullName: 'X', phone: '' })).rejects.toThrow('2 đến 100')
  })

  it('changes the password only with the correct current password and locks after 5 failures', async () => {
    const api = localApi()
    await api.getProfile(manager)
    await expect(api.changePassword(manager, { currentPassword: 'nope', newPassword: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' })).rejects.toThrow('Mật khẩu hiện tại không đúng')
    expect((await api.changePassword(manager, { currentPassword: 'mock-demo', newPassword: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' })).message).toMatch(/phiên khác/)
    await expect(api.changePassword(manager, { currentPassword: 'mock-demo', newPassword: 'Another0ne', confirmPassword: 'Another0ne' })).rejects.toThrow('không đúng')
    for (let i = 0; i < 4; i++) await api.changePassword(manager, { currentPassword: 'bad', newPassword: 'Another0ne', confirmPassword: 'Another0ne' }).catch(() => undefined)
    await expect(api.changePassword(manager, { currentPassword: 'NewPassw0rd', newPassword: 'Another0ne', confirmPassword: 'Another0ne' })).rejects.toThrow('khóa 15 phút')
  })

  it('lets a Google account skip the current password for 5 minutes after re-authentication (D07)', async () => {
    let clock = 1_000_000
    const api = localApi(() => clock)
    await api.getProfile(manager)
    await api.reauthenticateWithGoogle(manager)
    await expect(api.changePassword(manager, { newPassword: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' })).resolves.toBeDefined()
    clock += 5 * 60 * 1000 + 1
    await expect(api.changePassword(manager, { newPassword: 'Another0ne', confirmPassword: 'Another0ne' })).rejects.toThrow('Mật khẩu hiện tại')
  })

  it('requires Google re-authentication to add the first password and rejects non-Google accounts', async () => {
    const api = localApi()
    expect((await api.getProfile(pm)).passwordSignInEnabled).toBe(false)
    await expect(api.changePassword(pm, { newPassword: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' })).rejects.toThrow('xác thực lại với Google')
    await api.reauthenticateWithGoogle(pm)
    await api.changePassword(pm, { newPassword: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' })
    expect((await api.getProfile(pm)).passwordSignInEnabled).toBe(true)
    await expect(api.reauthenticateWithGoogle({ ...manager, role: 'TECHNICIAN', email: 'technician@beefcare.local' })).rejects.toThrow('chưa liên kết')
  })
})

describe('account API (backend mode)', () => {
  it('calls the real routes and never reads the local store', async () => {
    const http = transport()
    http.get.mockImplementation(async (path: string) => path === '/api/farms/1/my-permissions'
      ? { role: 'MANAGER', permissions: [{ area: 'GROWTH_BCS', value: 'FULL' }] }
      : { id: 7, email: 'a@b.vn', fullName: 'An', phone: '', emailVerified: true, passwordSignInEnabled: true, googleSignInLinked: false, ownerRegistrationCompleted: true, platformRole: null, farms: [] })
    http.command.mockResolvedValue({ id: 7, email: 'a@b.vn', fullName: 'An B', phone: '', farms: [] })
    const store = createAccountDemoStore()
    const spy = vi.spyOn(store, 'getProfile')
    const api = createAccountApi({ mode: 'backend', farmId: 1, transport: http, store })
    expect((await api.getProfile(manager)).id).toBe(7)
    await expect(api.getFarmPermissions(manager, 1)).resolves.toEqual({ role: 'MANAGER', permissions: [{ area: 'GROWTH_BCS', value: 'FULL' }] })
    await api.updateProfile(manager, { fullName: 'An B', phone: '' })
    await api.changePassword(manager, { currentPassword: 'a', newPassword: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' })
    expect(http.get).toHaveBeenCalledWith('/api/account/profile')
    expect(http.get).toHaveBeenCalledWith('/api/farms/1/my-permissions')
    expect(http.command).toHaveBeenCalledWith('/api/account/profile', { fullName: 'An B', phone: '' }, { method: 'POST' })
    expect(http.command).toHaveBeenCalledWith('/api/account/change-password', expect.objectContaining({ newPassword: 'NewPassw0rd' }), { method: 'POST' })
    expect(spy).not.toHaveBeenCalled()
  })
})
