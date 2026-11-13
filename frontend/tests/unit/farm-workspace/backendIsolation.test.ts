import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendTransport } from '../../../src/api/backendTransport'
import { createFarmWorkspaceApi } from '../../../src/features/farm-workspace/api/farmWorkspaceApi'
import { createFarmWorkspaceDemoStore } from '../../../src/features/farm-workspace/data/farmWorkspaceDemoStore'

describe('farm workspace backend adapter isolation', () => {
  let store: ReturnType<typeof createFarmWorkspaceDemoStore>
  let transport: BackendTransport

  beforeEach(() => {
    store = createFarmWorkspaceDemoStore()
    transport = {
      get: vi.fn().mockResolvedValue([]),
      command: vi.fn().mockResolvedValue(undefined),
      farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    }
  })

  it('reads the backend endpoint without blending local mock rows', async () => {
    vi.mocked(transport.get).mockResolvedValue([{ id: 901, name: 'Trại từ backend', role: 'OWNER', serviceStatus: 'ACTIVE', version: 3, province: 'Phú Thọ', commune: 'Minh Đài', activeCattleCount: 48, serviceUntil: '2026-12-01' }])
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 901, transport, demoStore: store })
    const farms = await api.listFarms()
    expect(farms.map((farm) => farm.id)).toEqual([901])
    expect(farms[0].name).toBe('Trại từ backend')
    expect(farms[0]).toMatchObject({ province: 'Phú Thọ', commune: 'Minh Đài', activeCattleCount: 48, serviceUntil: '2026-12-01' })
    expect(transport.get).toHaveBeenCalledWith('/api/farms')
  })

  it('propagates a backend read failure and does not fall back to the demo store', async () => {
    vi.mocked(transport.get).mockRejectedValue(new Error('backend unavailable'))
    const expectedLocalCount = (await store.listFarms()).length
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    await expect(api.listFarms()).rejects.toThrow('backend unavailable')
    expect((await store.listFarms()).length).toBe(expectedLocalCount)
  })

  it('preserves the server terms state needed to hide the duplicate Owner checkbox', async () => {
    vi.mocked(transport.get).mockResolvedValue({
      id: 7, email: 'owner@beefcare.vn', fullName: 'Nguyễn Văn An', contactPhone: '',
      emailVerified: true, passwordSignInEnabled: true, googleSignInLinked: false,
      ownerRegistrationCompleted: false, termsAccepted: true, status: 'ACTIVE',
      signInMethods: ['PASSWORD'], hasPassword: true, farms: [],
    })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    const profile = await api.getProfile()
    expect(profile.termsAccepted).toBe(true)
  })

  it('sends profile and farm mutations only through the backend command transport', async () => {
    vi.mocked(transport.command)
      .mockResolvedValueOnce({ id: 7, email: 'owner@beefcare.vn', fullName: 'Nguyễn Văn An', contactPhone: '0912345678', completed: true })
      .mockResolvedValueOnce({ id: 902, name: 'Trại mới', province: 'Phú Thọ', commune: 'Minh Đài', serviceStatus: 'PENDING_PAYMENT', timeZone: 'Asia/Ho_Chi_Minh', mainBreedIds: [], version: 1 })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    await api.completeOwnerRegistration({ fullName: 'Nguyễn Văn An', phone: '0912345678', termsAccepted: true })
    await api.registerFarm({ name: 'Trại mới', province: 'Phú Thọ', commune: 'Minh Đài', expectedHerdSize: 'UNDER_50', mainBreedCodes: [] })
    expect(transport.command).toHaveBeenCalledWith('/api/account/owner-registration', { fullName: 'Nguyễn Văn An', contactPhone: '0912345678', termsAccepted: true }, { method: 'POST' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms', expect.objectContaining({ name: 'Trại mới' }), { method: 'POST' })
    expect((await store.listFarms()).some((farm) => farm.name === 'Trại mới')).toBe(false)
  })

  it('sends an omitted optional farm phone as null instead of an invalid empty string', async () => {
    vi.mocked(transport.command).mockResolvedValueOnce({ id: 902, name: 'Trại không có số', province: 'Phú Thọ', commune: 'Minh Đài', serviceStatus: 'PENDING_PAYMENT', version: 1 })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    await api.registerFarm({ name: 'Trại không có số', province: 'Phú Thọ', commune: 'Minh Đài', expectedHerdSize: 'UNDER_50', mainBreedCodes: [] })
    expect(transport.command).toHaveBeenCalledWith('/api/farms', expect.objectContaining({ contactPhone: null }), { method: 'POST' })
  })

  it('holds the invitation intent key and maps the backend account hint without using local rows', async () => {
    vi.mocked(transport.command).mockResolvedValue({ id: 61, email: 'new@example.test', role: 'TECHNICIAN', status: 'PENDING', validityDays: 14, hasAccount: true, version: 0 })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 901, transport, demoStore: store })
    const input = { email: 'new@example.test', role: 'TECHNICIAN' as const, validityDays: 14 as const }
    const result = await api.inviteMember(901, input, { idempotencyKey: 'intent-one' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms/901/invitations', input, { method: 'POST', key: 'intent-one' })
    expect(result.accountHint).toBe('HAS_ACCOUNT')
  })

  it('resends and reactivates with the version already shown instead of fetching a newer one', async () => {
    vi.mocked(transport.command).mockResolvedValue({ id: 61, email: 'member@example.test', role: 'MANAGER', status: 'PENDING', version: 4 })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 901, transport, demoStore: store })
    await api.resendInvitation(901, 61, { expectedVersion: 3, idempotencyKey: 'resend-one' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms/901/invitations/61/resend', { expectedVersion: 3 }, { method: 'POST', key: 'resend-one' })
    vi.mocked(transport.command).mockResolvedValue({ id: 52, userId: 8, email: 'member@example.test', role: 'MANAGER', status: 'ACTIVE', version: 5 })
    const input = { action: 'REACTIVATE' as const, effectiveDate: '2026-11-11', reason: 'Tiếp tục công việc' }
    await api.changeMember(901, 52, input, { expectedVersion: 4, idempotencyKey: 'reactivate-one' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms/901/members/52', { ...input, expectedVersion: 4 }, { method: 'PUT', key: 'reactivate-one' })
    expect(transport.get).not.toHaveBeenCalled()
  })
})
