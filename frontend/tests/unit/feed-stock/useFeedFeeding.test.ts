import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedFeeding } from '../../../src/features/feed-stock/hooks/useFeedFeeding'

const api = vi.hoisted(() => ({
  listFeedFeedingRecords: vi.fn(), getFeedFeedingPlan: vi.fn(), recordFeedSession: vi.fn(), correctFeedSession: vi.fn(), voidFeedSession: vi.fn(),
}))

vi.mock('../../../src/features/feed-stock/api/feedFeedingApi', () => api)

describe('useFeedFeeding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFeedFeedingRecords.mockResolvedValue([])
    api.getFeedFeedingPlan.mockResolvedValue({})
    api.recordFeedSession.mockResolvedValue({ id: 1 })
    api.correctFeedSession.mockResolvedValue({ id: 1 })
    api.voidFeedSession.mockResolvedValue({ id: 1 })
  })

  it('loads records for the selected range and exposes command boundaries', async () => {
    const range = { from: '2026-06-01', to: '2026-06-01' }
    const record = { id: 7 }
    api.listFeedFeedingRecords.mockResolvedValue([record])
    const { result } = renderHook(() => useFeedFeeding(range))

    await waitFor(() => expect(result.current.records).toEqual([record]))
    expect(api.listFeedFeedingRecords).toHaveBeenCalledWith(range)

    await act(async () => { await result.current.record({ input: { penId: 1 } as never, options: { key: 'feed-key' } }) })
    expect(api.recordFeedSession).toHaveBeenCalledWith({ penId: 1 }, { key: 'feed-key' })
  })
})
