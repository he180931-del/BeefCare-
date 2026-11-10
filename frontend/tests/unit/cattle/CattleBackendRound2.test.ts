import { describe, expect, it, vi } from 'vitest'
import { createCattleBackendApi, mapBackendCattle } from '../../../src/api/cattleBackendApi'

describe('backend cattle round 2 contract', () => {
  it('sends every server-side cattle filter and preserves backend pagination/counts', async () => {
    const get = vi.fn(async (_path: string) => ({
      items: [{ id: 7, displayCode: 'BC-007', herdStatus: 'EXITED', lifeStage: 'ADULT', sex: 'FEMALE' }],
      total: 27, page: 2, size: 10, counts: { ACTIVE: 20, EXITED: 7, VOIDED: 0, FATTENING: 11 },
    }))
    const api = createCattleBackendApi({
      farmId: 9,
      transport: { get, command: vi.fn(), farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}` },
    })

    const page = await api.listPage({ q: 'tag-7', purposeId: 31, health: 'MEAT_WITHDRAWAL', breedId: 21, sex: 'FEMALE', penId: 4, lifeStage: 'ADULT', herdStatus: 'EXITED', herdGroup: 'FATTENING', page: 2, size: 10 })
    const url = new URL(String(get.mock.calls[0][0]), 'http://backend.test')

    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'tag-7', purposeId: '31', health: 'MEAT_WITHDRAWAL', breedId: '21', sex: 'FEMALE', penId: '4',
      lifeStage: 'ADULT', herdStatus: 'EXITED', herdGroup: 'FATTENING', page: '2', size: '10',
    })
    expect(page).toMatchObject({ total: 27, page: 2, size: 10, counts: { ACTIVE: 20, EXITED: 7, FATTENING: 11 } })
    expect(page.items[0]).toMatchObject({ code: 'BC-007', status: 'EXITED', inList: false })
  })

  it('maps real QR tags and timeline events without inventing profile history', () => {
    const cow = mapBackendCattle({ id: 8, displayCode: 'BC-008', herdStatus: 'ACTIVE' }, null, [
      { id: 81, tagCode: 'QR-REAL', status: 'ACTIVE', issuedAt: '2026-10-01T08:00:00Z', endedAt: null, reason: 'FIRST_ISSUE', displayCode: 'BC-008' },
    ], [
      { category: 'IDENTIFICATION_QR', type: 'QR_ISSUED', sourceId: 81, occurredAt: '2026-10-01T08:00:00Z', recordedAt: '2026-10-01T08:01:00Z', recorder: 'Owner', status: 'ACTIVE', values: { tagCode: 'QR-REAL', reason: 'FIRST_ISSUE' } },
    ])

    expect(cow.qrHistory).toHaveLength(1)
    expect(cow.qrHistory[0]).toMatchObject({ code: 'QR-REAL', status: 'ACTIVE' })
    expect(cow.events).toHaveLength(1)
    expect(cow.events[0]).toMatchObject({ cat: 'qr', title: 'Cấp thẻ QR QR-REAL' })
  })
})
