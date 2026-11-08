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
