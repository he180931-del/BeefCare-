import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedStockAdjustmentList } from '../../../src/features/feed-stock/hooks/useFeedStockAdjustmentList'

const api = vi.hoisted(() => ({ listFeedStockAdjustments: vi.fn() }))
vi.mock('../../../src/features/feed-stock/api/feedStockAdjustmentApi', () => ({ listFeedStockAdjustments: api.listFeedStockAdjustments }))

describe('useFeedStockAdjustmentList', () => {
  beforeEach(() => { vi.clearAllMocks(); api.listFeedStockAdjustments.mockResolvedValue([{ id: 1, code: 'KK-01' }]) })

  it('loads adjustment history and exposes retry state', async () => {
    const { result } = renderHook(() => useFeedStockAdjustmentList())
    await waitFor(() => expect(result.current.adjustments).toEqual([{ id: 1, code: 'KK-01' }]))
    expect(api.listFeedStockAdjustments).toHaveBeenCalledOnce()
  })
})
