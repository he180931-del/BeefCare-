import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('exitPenShift ("Chuồng giảm" của phiếu xuất)', () => {
  it('uses the occupancy the backend sent with each candidate, never the demo pens', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    const { exitPenShift } = await import('../../../src/features/herd-exit/api/herdExitApi')

    expect(exitPenShift([
      { barn: 'K7', penCount: 12 },
      { barn: 'K7', penCount: 12 },
      { barn: 'A1' },
      { barn: '' },
    ])).toEqual([
      { code: 'K7', name: 'K7', count: 12, out: 2 },
      { code: 'A1', name: 'A1', count: null, out: 1 },
    ])
  })

  it('keeps the demo pens in the local demo', async () => {
    const { exitPenShift } = await import('../../../src/features/herd-exit/api/herdExitApi')

    expect(exitPenShift([{ barn: 'A1' }])).toEqual([expect.objectContaining({ code: 'A1', out: 1, count: expect.any(Number) })])
  })
})
