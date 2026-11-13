import { describe, expect, it, vi } from 'vitest'
import type { BackendTransport } from '../../../src/api/backendTransport'
import { createFarmWorkspaceApi } from '../../../src/features/farm-workspace/api/farmWorkspaceApi'
import { createFarmWorkspaceDemoStore } from '../../../src/features/farm-workspace/data/farmWorkspaceDemoStore'

const row = { id: 52, userId: 8, fullName: 'Trần Quốc Long', email: 'long@example.test', role: 'MANAGER', status: 'ACTIVE', joinedAt: '2024-05-02T02:00:00Z', version: 3, actions: ['CHANGE_ROLE', 'DEACTIVATE'] }
const response = { farmName: 'Trại kiểm thử', timeZone: 'Asia/Ho_Chi_Minh', serviceStatus: 'ACTIVE', counts: { all: 2, managers: 1, technicians: 0, inactive: 0 }, items: [row] }

function setup(body: unknown = response) {
  const transport: BackendTransport = { get: vi.fn().mockResolvedValue(body), command: vi.fn(), farmPath: (id, suffix = '') => `/api/farms/${id}${suffix}` }
  const api = createFarmWorkspaceApi({ mode: 'backend', farmId: 401, transport, demoStore: createFarmWorkspaceDemoStore() })
  return { api, transport }
}

describe('A1 member list backend boundary (D29)', () => {
  it('reads one request and keeps every field the screen shows, without the reason of the last change', async () => {
    const { api, transport } = setup({ ...response, items: [{ ...row, reason: 'ghi chú riêng', effectiveDate: '2026-11-01' }] })
    const result = await api.listMembers(401, 'MANAGER')
    expect(transport.get).toHaveBeenCalledTimes(1)
    expect(transport.get).toHaveBeenCalledWith('/api/farms/401/members')
    expect(result).toEqual({ ...response, items: [row] })
  })

  it('keeps the Manager counts without an inactive count', async () => {
    const { api } = setup({ ...response, counts: { all: 1, managers: 1, technicians: 0 }, items: [{ ...row, actions: [] }] })
    const result = await api.listMembers(401)
    expect(result.counts).toEqual({ all: 1, managers: 1, technicians: 0 })
    expect('inactive' in result.counts).toBe(false)
  })

  it('rejects the legacy array and rows without joined time, actions or ids instead of inventing them', async () => {
    for (const body of [
      [row],
      { ...response, counts: undefined },
      { ...response, items: [{ ...row, joinedAt: undefined }] },
      { ...response, items: [{ ...row, actions: undefined }] },
      { ...response, items: [{ ...row, actions: ['DELETE'] }] },
      { ...response, items: [{ ...row, id: 0 }] },
      { ...response, timeZone: '' },
    ]) {
      const { api } = setup(body)
      await expect(api.listMembers(401)).rejects.toThrow(/Dữ liệu máy chủ/)
    }
  })
})
