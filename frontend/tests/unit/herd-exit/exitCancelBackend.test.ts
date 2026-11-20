import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('exit cancellation without demo data', () => {
  it('starts with no reason, no sample occupancy, and leaves the cattle link check to the server', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    const { exitCancelDefaults, exitCancelLinks, listExitCancelPens } = await import('../../../src/features/herd-exit/api/herdExitApi')

    expect(exitCancelDefaults()).toEqual({ reason: '' })
    await expect(listExitCancelPens()).resolves.toBeNull()
    await expect(exitCancelLinks()).resolves.toEqual({ serverChecked: true })
  })

  it('keeps the demo reason, pens and canonical cattle in the local demo', async () => {
    const { exitCancelDefaults, exitCancelLinks, listExitCancelPens } = await import('../../../src/features/herd-exit/api/herdExitApi')

    expect(exitCancelDefaults().reason).toContain('Lò mổ trả lại')
    expect((await listExitCancelPens())?.length).toBeGreaterThan(0)
    const links = await exitCancelLinks()
    expect(links.serverChecked).toBe(false)
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
