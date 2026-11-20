import { describe, expect, it, vi } from 'vitest'
import { createAccountApi } from '../../../src/features/account/api/accountApi'
import { createAccountDemoStore } from '../../../src/features/account/data/accountDemoStore'
import type { AccountIdentity } from '../../../src/features/account/types'

// Characterization of the ProfileResponse / my-permissions mapping (GET /api/account/profile,
// GET /api/farms/{id}/my-permissions) before it moves out of accountApi.ts.
const manager: AccountIdentity = { email: 'manager@beefcare.local', fullName: 'Trần Quốc Long', role: 'MANAGER', farmName: 'Trại A', farmId: 1 }
const backendApi = (body: unknown) => {
  const transport = { get: vi.fn().mockResolvedValue(body), command: vi.fn().mockResolvedValue(body), farmPath: vi.fn() }
  return createAccountApi({ mode: 'backend', farmId: 1, transport, store: createAccountDemoStore() })
}

describe('account profile mapping', () => {
  it('maps every ProfileResponse field, contactPhone first', async () => {
    const profile = await backendApi({
      id: 7, email: 'a@b.vn', fullName: 'An', contactPhone: '0912345678', phone: '0000000000', emailVerified: true,
      passwordSignInEnabled: false, googleSignInLinked: true, ownerRegistrationCompleted: true, termsAccepted: true,
      status: 'SUSPENDED', signInMethods: ['GOOGLE', 3, 'PASSWORD'], hasPassword: true, platformRole: 'PM',
      farms: [{ farmId: 4, farmName: 'Trại A', role: 'OWNER', serviceStatus: 'ACTIVE', permissions: ['VIEW', null, 'EDIT'] }],
    }).getProfile(manager)
    expect(profile).toEqual({
      id: 7, email: 'a@b.vn', fullName: 'An', phone: '0912345678', emailVerified: true, passwordSignInEnabled: false,
      googleSignInLinked: true, ownerRegistrationCompleted: true, termsAccepted: true, status: 'SUSPENDED',
      signInMethods: ['GOOGLE', 'PASSWORD'], hasPassword: true, platformRole: 'PM',
      farms: [{ farmId: 4, farmName: 'Trại A', role: 'OWNER', serviceStatus: 'ACTIVE', permissions: ['VIEW', 'EDIT'] }],
    })
  })

  it('falls back to phone, ACTIVE status and no password, platform role or farms', async () => {
    expect(await backendApi({ phone: '0987654321' }).getProfile(manager)).toEqual({
      id: 0, email: '', fullName: '', phone: '0987654321', emailVerified: false, passwordSignInEnabled: false,
      googleSignInLinked: false, ownerRegistrationCompleted: false, termsAccepted: false, status: 'ACTIVE',
      signInMethods: [], hasPassword: false, platformRole: null, farms: [],
    })
  })

  it('treats password sign-in as having a password', async () => {
    expect((await backendApi({ passwordSignInEnabled: true }).getProfile(manager)).hasPassword).toBe(true)
  })
})

describe('farm permissions mapping', () => {
  it('maps the role and every area level', async () => {
    await expect(backendApi({ role: 'TECHNICIAN', permissions: [{ area: 'GROWTH_BCS', value: 'RESTRICTED' }, { area: 'HEALTH', value: 'NO' }] }).getFarmPermissions(manager, 1))
      .resolves.toEqual({ role: 'TECHNICIAN', permissions: [{ area: 'GROWTH_BCS', value: 'RESTRICTED' }, { area: 'HEALTH', value: 'NO' }] })
  })

  it('rejects an unknown role or level instead of guessing', async () => {
    await expect(backendApi({ role: 'PM', permissions: [] }).getFarmPermissions(manager, 1)).rejects.toThrow('Máy chủ không trả vai trò trại hợp lệ.')
    await expect(backendApi({ role: 'OWNER', permissions: [{ area: 'X', value: 'PARTIAL' }] }).getFarmPermissions(manager, 1)).rejects.toThrow('Máy chủ không trả quyền trại hợp lệ.')
  })
})
