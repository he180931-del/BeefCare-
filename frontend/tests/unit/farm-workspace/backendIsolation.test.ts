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

  it('UC-FE02-02 rechecks access through the farm context before entering a farm', async () => {
    vi.mocked(transport.get).mockResolvedValue({ id: 902, name: 'Trại hết hạn', role: 'OWNER', serviceStatus: 'EXPIRED', version: 2, activeCattleCount: 0, serviceUntil: null })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    await expect(api.selectFarm(902)).resolves.toMatchObject({ id: 902, role: 'OWNER', serviceStatus: 'EXPIRED' })
    expect(transport.get).toHaveBeenCalledWith('/api/farms/902/context')
  })

  it('UC-FE02-03 saves SCR-11 with the page request key, without main breeds, and reads the service summary', async () => {
    vi.mocked(transport.command).mockResolvedValueOnce({
      id: 1, name: 'Trại A', province: 'Hà Nội', commune: 'Ba Vì', serviceStatus: 'SUSPENDED', version: 4, mainBreedIds: [7],
      currentPeriodUntil: '2026-12-31T17:00:00Z', renewalOpensAt: '2026-10-02T17:00:00Z', suspendedAt: '2026-11-01T03:00:00Z',
      daysRemaining: 60, ownerName: 'Nguyễn Văn Hùng', ownerEmail: 'owner@beefcare.local',
    })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    const saved = await api.updateFarm(1, {
      name: 'Trại A', province: 'Hà Nội', commune: 'Ba Vì', detailedAddress: '', contactPerson: '', contactPhone: '0912 345 678',
      registrationCertificateInfo: '', timeZone: 'Asia/Ho_Chi_Minh', morningShiftStart: '05:30', operatingNotes: '', mainBreedIds: [7], expectedVersion: 3,
    }, { idempotencyKey: 'key-3' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms/1', expect.not.objectContaining({ mainBreedIds: expect.anything() }), { method: 'PUT', key: 'key-3' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms/1', expect.objectContaining({ contactPhone: '0912345678', expectedVersion: 3 }), { method: 'PUT', key: 'key-3' })
    expect(transport.get).not.toHaveBeenCalled()
    expect(saved).toMatchObject({
      role: 'OWNER', serviceUntil: '2026-12-31T17:00:00Z', renewalOpensAt: '2026-10-02T17:00:00Z', suspendedAt: '2026-11-01T03:00:00Z',
      daysRemaining: 60, ownerName: 'Nguyễn Văn Hùng', ownerEmail: 'owner@beefcare.local',
    })
  })

  it('propagates a backend read failure and does not fall back to the demo store', async () => {
    vi.mocked(transport.get).mockRejectedValue(new Error('backend unavailable'))
    const expectedLocalCount = (await store.listFarms()).length
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    await expect(api.listFarms()).rejects.toThrow('backend unavailable')
    expect((await store.listFarms()).length).toBe(expectedLocalCount)
  })

  it('sends profile and farm mutations only through the backend command transport', async () => {
    vi.mocked(transport.command)
      .mockResolvedValueOnce({ id: 7, email: 'owner@beefcare.vn', fullName: 'Nguyễn Văn An', phone: '0912345678', completed: true })
      .mockResolvedValueOnce({ id: 902, name: 'Trại mới', province: 'Phú Thọ', commune: 'Minh Đài', serviceStatus: 'PENDING_PAYMENT', timeZone: 'Asia/Ho_Chi_Minh', mainBreedIds: [], version: 1 })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    await api.completeOwnerRegistration({ fullName: 'Nguyễn Văn An', phone: '0912345678', termsAccepted: true })
    await api.registerFarm({ name: 'Trại mới', province: 'Phú Thọ', commune: 'Minh Đài', expectedHerdSize: 'UNDER_50', mainBreedCodes: [] })
    expect(transport.command).toHaveBeenCalledWith('/api/account/owner-registration', { fullName: 'Nguyễn Văn An', phone: '0912345678', termsAccepted: true }, { method: 'POST' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms', expect.objectContaining({ name: 'Trại mới' }), { method: 'POST' })
    expect((await store.listFarms()).some((farm) => farm.name === 'Trại mới')).toBe(false)
  })

  it('UC-FE02-01 sends the request key held by the page and a blank expected herd size as null', async () => {
    vi.mocked(transport.command).mockResolvedValueOnce({ id: 903, name: 'Trại mới', province: 'Phú Thọ', commune: 'Minh Đài', serviceStatus: 'PENDING_PAYMENT', mainBreedIds: [], version: 1 })
    const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 1, transport, demoStore: store })
    const farm = await api.registerFarm({ name: 'Trại mới', province: 'Phú Thọ', commune: 'Minh Đài', contactPhone: '0912 345 678', expectedHerdSize: '' }, { idempotencyKey: 'key-1' })
    expect(farm).toMatchObject({ id: 903, role: 'OWNER', serviceStatus: 'PENDING_PAYMENT' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms', expect.objectContaining({ contactPhone: '0912345678', expectedHerdSize: null }), { method: 'POST', key: 'key-1' })
  })
})
