import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedMovements, useFeedStock, useFeedStockUpdatedAt } from '../../../src/features/feed-stock/hooks/useFeedStockQueries'

const api = vi.hoisted(() => ({
  getFeedStockUpdatedAt: vi.fn(),
  listFeedMovements: vi.fn(),
  listFeedStock: vi.fn(),
}))
vi.mock('../../../src/features/feed-stock/api/feedMovementApi', () => ({
  getFeedStockUpdatedAt: api.getFeedStockUpdatedAt,
  listFeedMovements: api.listFeedMovements,
}))
vi.mock('../../../src/features/feed-stock/api/feedStockApi', () => ({ listFeedStock: api.listFeedStock }))

describe('useFeedStockQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFeedStock.mockResolvedValue([{ feedItemId: 7, code: 'A', name: 'Cám', onHandKg: 12 }])
    api.listFeedMovements.mockResolvedValue([{ id: 1, feedItemId: 7, quantityKg: 4 }])
    api.getFeedStockUpdatedAt.mockResolvedValue('2026-11-21T09:00:00+07:00')
  })

  it('loads stock rows and exposes the underlying query state', async () => {
    const { result } = renderHook(() => useFeedStock())
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.data?.[0]?.feedItemId).toBe(7)
    expect(api.listFeedStock).toHaveBeenCalledOnce()
  })

  it('loads movements for the selected feed item', async () => {
    const { result } = renderHook(() => useFeedMovements(7))
    await waitFor(() => expect(result.current.movements).toHaveLength(1))
    expect(api.listFeedMovements).toHaveBeenCalledWith(7)
  })

  it('keeps freshness best effort when the timestamp read fails', async () => {
    api.getFeedStockUpdatedAt.mockRejectedValue(new Error('unsupported'))
    const { result } = renderHook(() => useFeedStockUpdatedAt())
    await waitFor(() => expect(result.current.data).toBeNull())
    expect(result.current.error).toBeNull()
  })
})
