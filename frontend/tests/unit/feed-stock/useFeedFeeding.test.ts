import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedFeedingCommands } from '../../../src/features/feed-stock/hooks/useFeedFeeding'

const api = vi.hoisted(() => ({
  listFeedFeedingRecords: vi.fn(), getFeedFeedingPlan: vi.fn(), recordFeedSession: vi.fn(), correctFeedSession: vi.fn(), voidFeedSession: vi.fn(),
}))

vi.mock('../../../src/features/feed-stock/api/feedFeedingApi', () => api)

describe('useFeedFeedingCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.recordFeedSession.mockResolvedValue({ id: 1 })
    api.correctFeedSession.mockResolvedValue({ id: 1 })
    api.voidFeedSession.mockResolvedValue({ id: 1 })
  })

  it('owns one idempotency key across retries of one command intent', async () => {
    const { result } = renderHook(() => useFeedFeedingCommands())
    api.recordFeedSession.mockRejectedValueOnce(new Error('temporary'))
    const input = { penId: 1 } as never
    await act(async () => { await expect(result.current.record({ input })).rejects.toThrow('temporary') })
    await act(async () => { await result.current.record({ input }) })
    const firstOptions = api.recordFeedSession.mock.calls[0][1]
    const secondOptions = api.recordFeedSession.mock.calls[1][1]
    expect(firstOptions.key).toEqual(expect.any(String))
    expect(secondOptions.key).toBe(firstOptions.key)
  })
})
