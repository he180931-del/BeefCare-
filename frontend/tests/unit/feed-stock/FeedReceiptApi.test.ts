import { describe, expect, it, vi } from 'vitest'
import {
  createFeedReceiptApi,
  listFeedReceipts,
  postFeedReceiptDemo,
  resetFeedReceiptDemoStore,
  saveFeedReceiptDemoDraft,
} from '../../../src/features/feed-stock/api/feedReceiptApi'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { FEED_RECEIPT_MOCK } from '../../../src/features/feed-stock/data/feedReceiptMock'
import type { BackendTransport } from '../../../src/api/backendTransport'
import type { FeedReceiptDemoStore } from '../../../src/features/feed-stock/types/feedReceiptDemo'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => FEED_RECEIPT_MOCK),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})

describe('SCR-78 feed receipt API boundary', () => {
  it('requests the receipts endpoint in backend mode and propagates failures without mock fallback', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockRejectedValueOnce(new Error('backend unavailable'))
    const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport })

    await expect(api.list()).rejects.toThrow('backend unavailable')
    expect(transport.farmPath).toHaveBeenCalledWith(32, '/feed/receipts')
    expect(transport.get).toHaveBeenCalledWith('/api/farms/32/feed/receipts')
  })

  it('returns copied synthetic ReceiptView-shaped rows in local mode', async () => {
    const transport = makeTransport()
    const api = createFeedReceiptApi({ mode: 'local', farmId: 1, transport, mockRows: FEED_RECEIPT_MOCK })

    const rows = await api.list()
    expect(rows).toEqual(FEED_RECEIPT_MOCK)
    expect(rows[0]).not.toBe(FEED_RECEIPT_MOCK[0])
    expect(transport.get).not.toHaveBeenCalled()
  })

  it('keeps draft and post actions local-only and does not mutate the demo store in backend mode', async () => {
    const transport = makeTransport()
    const demoStore: FeedReceiptDemoStore = {
      list: vi.fn(async () => []),
      get: vi.fn(),
      saveDraft: vi.fn(),
      post: vi.fn(),
      reset: vi.fn(),
    }
    const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport, demoStore })

    await expect(api.saveDraft({
      receiptDate: '2026-11-01', supplierId: 1, supplierName: 'demo', invoiceNumber: '', receivedBy: '',
      storageLocation: '', note: '', transportFee: 0, amountPaid: 0, paymentMethod: null,
      paymentDate: '', balanceDueDate: '', lines: [],
    })).rejects.toThrow(/bản demo/i)
    await expect(api.post(8101)).rejects.toThrow(/bản demo/i)
    await expect(api.get('8101')).rejects.toThrow(/bản demo/i)
    expect(demoStore.saveDraft).not.toHaveBeenCalled()
    expect(demoStore.post).not.toHaveBeenCalled()
    expect(demoStore.get).not.toHaveBeenCalled()
  })

  it('updates receipt and stock together once, and ignores expiry dates outside the near-expiry window', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
    const today = new Date()
    const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const expiry = new Date(today)
    expiry.setDate(expiry.getDate() + 45)
    const beforeStock = (await listFeedStock()).find((row) => row.feedItemId === 101)!
    const isExistingNear = Boolean(beforeStock.nearestLotExpiryDate)
      && beforeStock.nearestLotExpiryDate! >= formatDate(today)
      && beforeStock.nearestLotExpiryDate! <= formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30))

    const draft = await saveFeedReceiptDemoDraft({
      receiptDate: formatDate(today), supplierId: 201, supplierName: 'Nông sản Ba Vì',
      invoiceNumber: '', receivedBy: '', storageLocation: '', note: '', transportFee: 0,
      amountPaid: 0, paymentMethod: null, paymentDate: '', balanceDueDate: '',
      lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Bắp ủ chua', lotNumber: 'LO-FAR', expiryDate: formatDate(expiry), quantityPurchase: 5, purchaseUnit: 'kg', kgPerPurchaseUnit: 1, unitPrice: 1000 }],
    })
    await postFeedReceiptDemo(draft.id)

    const changedStock = (await listFeedStock()).find((row) => row.feedItemId === 101)!
    expect(changedStock.onHandKg).toBe(beforeStock.onHandKg + 5)
    expect(changedStock.nearestLotExpiryDate).toBe(isExistingNear ? beforeStock.nearestLotExpiryDate : null)
    await expect(postFeedReceiptDemo(draft.id)).rejects.toThrow('Chỉ có thể ghi nhận phiếu nháp.')
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(changedStock.onHandKg)
    expect((await listFeedReceipts()).find((row) => row.id === draft.id)?.status).toBe('POSTED')
  })
})
