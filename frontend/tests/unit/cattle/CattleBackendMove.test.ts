import { describe, expect, it, vi } from 'vitest'
import { createCattleBackendApi } from '../../../src/api/cattleBackendApi'

describe('backend cattle pen move contract', () => {
  it('checks and moves one backend cattle with the canonical pen-move endpoints', async () => {
    const command = vi.fn(async (path: string, body: unknown) => ({ path, body, moved: [] }))
    const api = createCattleBackendApi({
      farmId: 9,
      transport: { get: vi.fn(), command, farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}` },
    })

    await api.checkPenMove({ cattleId: 42, toPenId: 12, moveDate: '2026-10-30' })
    await api.movePen({ cattleId: 42, toPenId: 12, moveDate: '2026-10-30', reason: 'Đủ điều kiện', warningReason: 'Đủ điều kiện', cattleVersion: 7 })

    expect(command).toHaveBeenNthCalledWith(1, '/api/farms/9/pen-moves/check', {
      cattleIds: [42], toPenId: 12, moveDate: '2026-10-30',
    }, expect.objectContaining({ method: 'POST' }))
    expect(command).toHaveBeenNthCalledWith(2, '/api/farms/9/pen-moves', {
      cattleIds: [42], toPenId: 12, moveDate: '2026-10-30', reason: 'Đủ điều kiện',
      warningReasons: { 42: 'Đủ điều kiện' }, cattleVersions: { 42: 7 },
    }, expect.objectContaining({ method: 'POST' }))
  })
})
