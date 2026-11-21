import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedReceiptForm } from '../../../src/features/feed-stock/hooks/useFeedReceiptForm'

const api = vi.hoisted(() => ({
  listFeedStock: vi.fn(), listFeedSuppliers: vi.fn(), getFeedReceipt: vi.fn(), listFeedReceipts: vi.fn(), listFeedReceiptAttachments: vi.fn(),
  saveFeedReceiptDraft: vi.fn(), createAndPostFeedReceipt: vi.fn(), postFeedReceipt: vi.fn(),
}))
vi.mock('../../../src/features/feed-stock/api/feedStockApi', () => ({ listFeedStock: api.listFeedStock }))
vi.mock('../../../src/features/feed-stock/api/feedCatalogueApi', () => ({ listFeedSuppliers: api.listFeedSuppliers }))
vi.mock('../../../src/features/feed-stock/api/feedReceiptApi', () => ({
  getFeedReceipt: api.getFeedReceipt, listFeedReceipts: api.listFeedReceipts, listFeedReceiptAttachments: api.listFeedReceiptAttachments,
  saveFeedReceiptDraft: api.saveFeedReceiptDraft, createAndPostFeedReceipt: api.createAndPostFeedReceipt, postFeedReceipt: api.postFeedReceipt,
}))

describe('useFeedReceiptForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFeedStock.mockResolvedValue([]); api.listFeedSuppliers.mockResolvedValue([]); api.getFeedReceipt.mockResolvedValue({ id: 4 }); api.listFeedReceipts.mockResolvedValue([{ code: 'PNK-2026-0001' }]); api.listFeedReceiptAttachments.mockResolvedValue([])
    api.saveFeedReceiptDraft.mockResolvedValue({ id: 4 }); api.createAndPostFeedReceipt.mockResolvedValue({ id: 4 }); api.postFeedReceipt.mockResolvedValue({ id: 4 })
  })

  it('loads receipt editor data and keeps draft/post commands behind one hook', async () => {
    const { result } = renderHook(() => useFeedReceiptForm('4'))
    await waitFor(() => expect(result.current.data?.receipt).toEqual({ id: 4 }))
    expect(api.listFeedReceipts).toHaveBeenCalledOnce()
    const input = { receiptDate: '2026-06-01' } as never
    await act(async () => { await result.current.saveDraft({ input, options: { key: 'receipt-key' } }); await result.current.post({ id: 4, version: 2, options: { key: 'post-key' } }) })
    expect(api.saveFeedReceiptDraft).toHaveBeenCalledWith(input, { key: 'receipt-key' })
    expect(api.postFeedReceipt).toHaveBeenCalledWith(4, 2, { key: 'post-key' })
  })
})
