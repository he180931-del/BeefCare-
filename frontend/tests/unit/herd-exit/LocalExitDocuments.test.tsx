import { beforeEach, describe, expect, it } from 'vitest'
import { herdExitApi, saveHerdExit } from '../../../src/features/herd-exit/api/herdExitApi'

describe('local exit documents', () => {
  beforeEach(async () => {
    localStorage.clear()
    await herdExitApi.reset()
  })

  it('keeps selected document metadata in terminal detail and does not leave a draft', async () => {
    const saved = await saveHerdExit({
      id: 'PX-2026-0099',
      record: {
        type: 'Bán', status: 'Đã xuất', date: '2026-10-29', total: 32800000, due: 32800000,
        detail: { docs: [] },
      },
      cattleRows: [{ code: 'BC-000203', barn: 'B1', weight: 322, unitPrice: 80000, estimated: false }],
      documents: [new File(['%PDF'], 'hop-dong.pdf', { type: 'application/pdf' })],
    })

    expect(saved.draft).toBeUndefined()
    expect(saved.detail?.docs).toEqual([{ name: 'hop-dong.pdf', ext: 'PDF', size: 4 }])
  })
})
