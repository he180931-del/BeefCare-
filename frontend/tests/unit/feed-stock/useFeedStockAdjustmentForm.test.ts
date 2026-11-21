import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedStockAdjustmentForm } from '../../../src/features/feed-stock/hooks/useFeedStockAdjustmentForm'

const api = vi.hoisted(() => ({ listFeedStock: vi.fn(), getFeedStockAdjustment: vi.fn(), listFeedStockAdjustments: vi.fn(), listFeedStockAdjustmentAttachments: vi.fn(), saveFeedStockAdjustmentDraft: vi.fn(), postFeedStockAdjustment: vi.fn() }))
vi.mock('../../../src/features/feed-stock/api/feedStockApi', () => ({ listFeedStock: api.listFeedStock }))
vi.mock('../../../src/features/feed-stock/api/feedStockAdjustmentApi', () => ({
  feedStockAdjustmentServerBacked: false, getFeedStockAdjustment: api.getFeedStockAdjustment, listFeedStockAdjustments: api.listFeedStockAdjustments,
  listFeedStockAdjustmentAttachments: api.listFeedStockAdjustmentAttachments, saveFeedStockAdjustmentDraft: api.saveFeedStockAdjustmentDraft, postFeedStockAdjustment: api.postFeedStockAdjustment,
}))

describe('useFeedStockAdjustmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks(); api.listFeedStock.mockResolvedValue([]); api.getFeedStockAdjustment.mockResolvedValue({ id: 4 }); api.listFeedStockAdjustments.mockResolvedValue([{ code: 'KK-01' }]); api.listFeedStockAdjustmentAttachments.mockResolvedValue([]); api.saveFeedStockAdjustmentDraft.mockResolvedValue({ id: 4, version: 2 }); api.postFeedStockAdjustment.mockResolvedValue({ id: 4, code: 'KK-01', totalDifferenceKg: 1, totalValue: 100 })
  })

  it('loads adjustment editor data and routes draft/post commands', async () => {
    const { result } = renderHook(() => useFeedStockAdjustmentForm('4'))
    await waitFor(() => expect(result.current.data?.record).toEqual({ id: 4 }))
    const input = { countDate: '2026-06-01' } as never
    await result.current.saveDraft({ input, options: { key: 'adjustment-key' } })
    await result.current.post({ id: 4, version: 2, options: { key: 'post-key' } })
    expect(api.saveFeedStockAdjustmentDraft).toHaveBeenCalledWith(input, { key: 'adjustment-key' })
    expect(api.postFeedStockAdjustment).toHaveBeenCalledWith(4, 2, { key: 'post-key' })
  })
})
