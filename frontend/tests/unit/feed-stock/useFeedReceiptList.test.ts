import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedReceiptList } from '../../../src/features/feed-stock/hooks/useFeedReceiptList'

const api = vi.hoisted(() => ({ listFeedReceipts: vi.fn(), listFeedSuppliers: vi.fn() }))
vi.mock('../../../src/features/feed-stock/api/feedReceiptApi', () => ({ listFeedReceipts: api.listFeedReceipts }))
vi.mock('../../../src/features/feed-stock/api/feedCatalogueApi', () => ({ listFeedSuppliers: api.listFeedSuppliers }))

describe('useFeedReceiptList', () => {
  beforeEach(() => { vi.clearAllMocks(); api.listFeedReceipts.mockResolvedValue([{ id: 1 }]); api.listFeedSuppliers.mockResolvedValue([{ id: 2 }]) })

  it('loads receipts and keeps supplier lookup non-blocking', async () => {
    const { result } = renderHook(() => useFeedReceiptList())
    await waitFor(() => expect(result.current.receipts).toEqual([{ id: 1 }]))
    expect(result.current.suppliers).toEqual([{ id: 2 }])

    api.listFeedSuppliers.mockRejectedValueOnce(new Error('supplier unavailable'))
    const second = renderHook(() => useFeedReceiptList())
    await waitFor(() => expect(second.result.current.receipts).toEqual([{ id: 1 }]))
    expect(second.result.current.suppliers).toBeNull()
  })
})
