import { afterEach, describe, expect, it, vi } from 'vitest'

const getPens = vi.hoisted(() => vi.fn())
const command = vi.hoisted(() => vi.fn())
vi.mock('../../../src/shared/api/backendTransport', () => ({ backendTransport: {
  farmPath: (id: unknown, suffix = '') => `/api/farms/${id}${suffix}`,
  get: getPens,
  command,
} }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('exit cancellation without demo data', () => {
  it('starts with no reason, loads canonical pens and leaves the cattle link check to the server', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    getPens.mockResolvedValue({ pens: [{ id: 4, code: 'B4', name: 'Chuồng 4', headcount: 9, capacity: 10, status: 'ACTIVE' }] })
    const { exitCancelDefaults, exitCancelLinks, listExitCancelPens } = await import('../../../src/features/herd-exit/api/herdExitApi')

    expect(exitCancelDefaults()).toEqual({ reason: '' })
    await expect(listExitCancelPens()).resolves.toMatchObject([{ id: 4, code: 'B4', count: 9, capacity: 10, status: 'ACTIVE' }])
    expect(getPens).toHaveBeenCalledWith(expect.stringMatching(/\/pens$/))
    await expect(exitCancelLinks()).resolves.toEqual({ serverChecked: true })
  })

  it('keeps the demo reason, pens and canonical cattle in the local demo', async () => {
    const { exitCancelDefaults, exitCancelLinks, listExitCancelPens, exitVoidCheck } = await import('../../../src/features/herd-exit/api/herdExitApi')

    expect(exitCancelDefaults().reason).toContain('Lò mổ trả lại')
    expect((await listExitCancelPens())?.length).toBeGreaterThan(0)
    const links = await exitCancelLinks()
    expect(links.serverChecked).toBe(false)
    await expect(exitVoidCheck('demo')).resolves.toBeNull()
  })

  it('forwards the opened snapshot and selected pens/reasons through the backend facade', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    getPens.mockResolvedValue({ voucherId: 61, code: 'PX-61', version: 99, voidable: true, cattle: [], occupancyAfter: [] })
    command.mockResolvedValue({ voucher: { id: 61, code: 'PX-61', status: 'VOIDED' } })
    const { exitVoidCheck, cancelHerdExit } = await import('../../../src/features/herd-exit/api/herdExitApi')
    expect((await exitVoidCheck('PX-61', 61))?.version).toBe(99)
    await cancelHerdExit('PX-61', [], { cancelReason: 'Trả lại' }, { expectedVersion: 3, backendId: 61, penOverrides: { '301': 4 }, warningReasons: { '301': '  Nhận tạm  ' } })
    expect(command).toHaveBeenCalledWith(expect.stringMatching(/\/exit-vouchers\/61\/void$/), {
      reason: 'Trả lại', expectedVersion: 3, penOverrides: { '301': 4 }, warningReasons: { '301': 'Nhận tạm' },
    }, { key: expect.stringMatching(/^beefcare-exit-void-/) })
  })
})

describe('feeding people suggestions', () => {
  it('suggests only the signed-in user on the real backend', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    const { feedingPeopleSuggestions } = await import('../../../src/features/feed-stock/api/feedFeedingApi')

    expect(feedingPeopleSuggestions('Nguyễn Thị Lan')).toEqual(['Nguyễn Thị Lan'])
    expect(feedingPeopleSuggestions()).toEqual([])
  })

  it('offers the sample people in the local demo', async () => {
    const { feedingPeopleSuggestions } = await import('../../../src/features/feed-stock/api/feedFeedingApi')

    expect(feedingPeopleSuggestions('Ai đó').length).toBeGreaterThan(0)
  })
})
