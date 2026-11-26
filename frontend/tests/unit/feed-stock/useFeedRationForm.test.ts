import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedRationForm } from '../../../src/features/feed-stock/hooks/useFeedRationForm'

const api = vi.hoisted(() => ({
  listFeedRations: vi.fn(), listFeedRationPens: vi.fn(), listFeedRationFeeds: vi.fn(), saveFeedRationVersion: vi.fn(),
}))
vi.mock('../../../src/features/feed-stock/api/feedRationApi', () => api)

describe('useFeedRationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFeedRations.mockResolvedValue([{ id: 7, name: 'Existing' }])
    api.listFeedRationPens.mockResolvedValue([{ id: 3 }])
    api.listFeedRationFeeds.mockResolvedValue([{ feedItemId: 101 }])
    api.saveFeedRationVersion.mockResolvedValue({ id: 8, rationCode: 'KP-08' })
  })

  it('loads editor data and sends the version save through one mutation boundary', async () => {
    const { result } = renderHook(() => useFeedRationForm('7'))
    await waitFor(() => expect(result.current.data?.record).toEqual({ id: 7, name: 'Existing' }))
    expect(api.listFeedRations).toHaveBeenCalledOnce()
    expect(api.listFeedRationPens).toHaveBeenCalledOnce()
    expect(api.listFeedRationFeeds).toHaveBeenCalledOnce()

    const input = { name: 'Next' } as never
    await act(async () => { await result.current.save({ input, options: { key: 'ration-key' } }) })
    expect(api.saveFeedRationVersion).toHaveBeenCalledWith(input, { key: 'ration-key' })
    expect(result.current.saving).toBe(false)
  })
})
