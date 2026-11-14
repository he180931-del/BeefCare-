import { describe, expect, it, vi } from 'vitest'
import type { BackendTransport } from '../../../src/api/backendTransport'
import { createFarmWorkspaceApi } from '../../../src/features/farm-workspace/api/farmWorkspaceApi'
import { createFarmWorkspaceDemoStore } from '../../../src/features/farm-workspace/data/farmWorkspaceDemoStore'

const response = {
  items: [{ id: 901, email: 'backend@example.test', role: 'MANAGER', status: 'PENDING', createdAt: '2026-11-12T03:00:00Z', lastSentAt: '2026-11-12T03:00:00Z', expiresAt: '2026-11-19T03:00:00Z', validityDays: 7, version: 5, hasAccount: true }],
  total: 23, page: 1, size: 20, counts: { PENDING: 23, ACCEPTED: 6, EXPIRED: 2, CANCELLED: 1 }, asOf: '2026-11-12T04:00:00Z',
}
function setup() {
  const transport: BackendTransport = { get: vi.fn().mockResolvedValue(response), command: vi.fn(), farmPath: (id, suffix = '') => `/api/farms/${id}${suffix}` }
  const demo = createFarmWorkspaceDemoStore()
  const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 401, transport, demoStore: demo })
  return { api, transport }
}

describe('invitation list backend boundary', () => {
  it('sends the page/filter/sort and preserves server counts and every displayed field', async () => {
    const { api, transport } = setup()
    const result = await api.listInvitations(401, { status: 'PENDING', page: 1, size: 20, sort: 'lastSentAt', dir: 'asc' })
    expect(transport.get).toHaveBeenCalledWith('/api/farms/401/invitations?status=PENDING&page=1&size=20&sort=lastSentAt&dir=asc')
    expect(result).toMatchObject({ total: 23, page: 1, size: 20, counts: response.counts, asOf: response.asOf })
    const { hasAccount: _hint, ...fields } = response.items[0]
    expect(result.items).toEqual([{ ...fields, accountHint: 'HAS_ACCOUNT' }])
  })

  it('supports an exact UC1 lookup rather than searching only the first page', async () => {
    const { api, transport } = setup()
    await api.listInvitations(401, { invitationId: 901 })
    expect(transport.get).toHaveBeenCalledWith('/api/farms/401/invitations?invitationId=901')
  })

  it('rejects the legacy array or missing counts instead of returning an empty/demo page', async () => {
    const { api, transport } = setup()
    vi.mocked(transport.get).mockResolvedValue(response.items)
    await expect(api.listInvitations(401)).rejects.toThrow(/danh sách lời mời/i)
    vi.mocked(transport.get).mockResolvedValue({ ...response, counts: undefined })
    await expect(api.listInvitations(401)).rejects.toThrow(/danh sách lời mời/i)
    vi.mocked(transport.get).mockRejectedValue(new Error('backend unavailable'))
    await expect(api.listInvitations(401)).rejects.toThrow('backend unavailable')
  })

  it.each(['id', 'version', 'hasAccount', 'lastSentAt'])('rejects a row missing %s rather than silently inventing it', async (field) => {
    const { api, transport } = setup()
    vi.mocked(transport.get).mockResolvedValue({ ...response, items: [{ ...response.items[0], [field]: undefined }] })
    await expect(api.listInvitations(401)).rejects.toThrow(/danh sách lời mời/i)
  })
})
