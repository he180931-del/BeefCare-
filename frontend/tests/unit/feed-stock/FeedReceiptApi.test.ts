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
import type { FeedReceiptPaymentResult } from '../../../src/features/feed-stock/types/feedReceipt'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => []),
  command: vi.fn(async () => undefined),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})

const receiptView = (overrides: Record<string, unknown> = {}) => ({
  id: 8130, code: 'PNK-2026-0030', receiptDate: '2026-11-01', supplierId: 201, supplierName: 'NCC 1',
  invoiceNumber: 'HD-01', receivedBy: 'Người nhận', storageLocation: 'Kho A', note: 'Ghi chú', status: 'POSTED',
  goodsAmount: 1200, transportFee: 100, totalPayable: 1300, amountPaid: 300, outstandingAmount: 1000,
  initialPaymentAmount: 300, initialPaymentMethod: 'CASH', initialPaymentDate: '2026-11-01', paymentDueDate: '2026-11-15',
  paymentState: 'PARTIAL', version: 3, createdById: 1, createdByName: 'Quản lý', createdAt: '2026-11-01T08:00:00Z',
  postedById: 1, postedByName: 'Quản lý', postedAt: '2026-11-01T08:05:00Z', voidReason: null, voidedById: null, voidedByName: null, voidedAt: null,
  lines: [{ id: 22, feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', lotNumber: 'LO-1', expiryDate: '2027-02-01', quantityPurchase: 2, purchaseUnit: 'Bao', kgReceived: 50, unitPrice: 600, lineAmount: 1200 }],
  ...overrides,
})

const paymentResult: FeedReceiptPaymentResult = {
  payment: null,
  summary: { voucherType: 'FEED_RECEIPT', voucherId: 8130, voucherCode: 'PNK-2026-0030', total: 1300, paid: 300, outstanding: 1000, overpaid: 0, state: 'PARTIAL', voucherVersion: 3 },
  payments: [{ id: 44, voucherType: 'FEED_RECEIPT', voucherId: 8130, voucherCode: 'PNK-2026-0030', direction: 'PAY', paymentDate: '2026-11-01', amount: 300, method: 'CASH', reference: null, note: null, status: 'RECORDED', recordedById: 1, recordedByName: 'Quản lý', recordedAt: '2026-11-01T08:05:00Z', voidReason: null, voidedAt: null, version: 0 }],
}

describe('SCR-78 feed receipt API boundary', () => {
  it('maps the backend ReceiptView and does not substitute demo rows after an endpoint failure', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockResolvedValueOnce([receiptView()])
    const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport })

    const rows = await api.list()
    expect(rows[0]).toMatchObject({
      id: 8130, code: 'PNK-2026-0030', supplierId: 201, amountPaid: 300, outstanding: 1000,
      initialPaymentAmount: 300, paymentMethod: 'CASH', paymentDueDate: '2026-11-15', invoiceNumber: 'HD-01',
      lines: [{ feedItemId: 101, purchaseUnit: 'Bao', kgReceived: 50 }],
    })
    expect(transport.farmPath).toHaveBeenCalledWith(32, '/feed/receipts')
    expect(transport.get).toHaveBeenCalledWith('/api/farms/32/feed/receipts')

    vi.mocked(transport.get).mockRejectedValueOnce(new Error('backend unavailable'))
    await expect(api.list()).rejects.toThrow('backend unavailable')
  })

  it('returns copied synthetic ReceiptView-shaped rows in local mode', async () => {
    const transport = makeTransport()
    const api = createFeedReceiptApi({ mode: 'local', farmId: 1, transport, mockRows: FEED_RECEIPT_MOCK })

    const rows = await api.list()
    expect(rows).toEqual(FEED_RECEIPT_MOCK)
    expect(rows[0]).not.toBe(FEED_RECEIPT_MOCK[0])
    expect(transport.get).not.toHaveBeenCalled()
  })

  it('creates and updates drafts, and posts/voids with backend-owned IDs and versions', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockResolvedValue(receiptView())
    vi.mocked(transport.command).mockResolvedValue(receiptView({ status: 'DRAFT', version: 0 }))
    const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport })
    const input = {
      receiptDate: '2026-11-01', supplierId: 201, supplierName: 'NCC 1', invoiceNumber: 'HD-02', receivedBy: 'Long',
      storageLocation: 'Kho A', note: 'Nhận đủ', transportFee: 50, amountPaid: 200, paymentMethod: 'CASH' as const,
      paymentDate: '2026-11-01', balanceDueDate: '2026-11-15',
      lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', lotNumber: 'LO-2', expiryDate: '2027-02-01', quantityPurchase: 2, purchaseUnit: 'Bao', kgPerPurchaseUnit: 25, unitPrice: 600 }],
    }
    const created = await api.saveDraft(input, { key: 'create-intent' })
    expect(created.status).toBe('DRAFT')
    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/receipts', {
      receiptDate: input.receiptDate, supplierId: input.supplierId, invoiceNumber: 'HD-02', receivedBy: 'Long', storageLocation: 'Kho A', note: 'Nhận đủ',
      transportFee: 50, amountPaid: 200, method: 'CASH', paymentDate: input.receiptDate, paymentDueDate: '2026-11-15',
      lines: [{ feedItemId: 101, lotNumber: 'LO-2', expiryDate: '2027-02-01', quantityPurchase: 2, purchaseUnit: 'Bao', unitPrice: 600 }], postNow: false,
    }, { key: 'create-intent' })

    vi.mocked(transport.get).mockResolvedValueOnce(receiptView({ status: 'DRAFT', version: 4 }))
    vi.mocked(transport.command).mockResolvedValueOnce(receiptView({ status: 'DRAFT', version: 5 }))
    await api.saveDraft({ ...input, id: 8130 }, { key: 'update-intent' })
    expect(transport.get).toHaveBeenLastCalledWith('/api/farms/32/feed/receipts/8130')
    expect(transport.command).toHaveBeenLastCalledWith('/api/farms/32/feed/receipts/8130/draft', expect.objectContaining({ expectedVersion: 4 }), { method: 'PUT', key: 'update-intent' })

    vi.mocked(transport.command).mockResolvedValueOnce(receiptView({ status: 'POSTED', version: 6 }))
    await api.post(8130, 5, { key: 'post-intent' })
    expect(transport.command).toHaveBeenLastCalledWith('/api/farms/32/feed/receipts/8130/post', { expectedVersion: 5 }, { key: 'post-intent' })
    vi.mocked(transport.command).mockResolvedValueOnce(receiptView({ status: 'VOIDED', version: 7, voidReason: 'Nhập nhầm' }))
    await api.void(8130, 'Nhập nhầm', 6, { key: 'void-intent' })
    expect(transport.command).toHaveBeenLastCalledWith('/api/farms/32/feed/receipts/8130/void', { reason: 'Nhập nhầm', expectedVersion: 6 }, { key: 'void-intent' })
    await api.discardDraft(8130, 4, { key: 'discard-intent' })
    expect(transport.command).toHaveBeenLastCalledWith('/api/farms/32/feed/receipts/8130', { expectedVersion: 4 }, { method: 'DELETE', key: 'discard-intent' })
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
      receiptDate: formatDate(today), supplierId: 201, supplierName: 'Đại lý TACN Hưng Thịnh – Sơn Tây',
      invoiceNumber: '', receivedBy: '', storageLocation: '', note: '', transportFee: 0,
      amountPaid: 0, paymentMethod: null, paymentDate: '', balanceDueDate: '',
      lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', lotNumber: 'LO-FAR', expiryDate: formatDate(expiry), quantityPurchase: 5, purchaseUnit: 'kg', kgPerPurchaseUnit: 1, unitPrice: 1000 }],
    })
    await postFeedReceiptDemo(draft.id)

    const changedStock = (await listFeedStock()).find((row) => row.feedItemId === 101)!
    expect(changedStock.onHandKg).toBe(beforeStock.onHandKg + 5)
    expect(changedStock.nearestLotExpiryDate).toBe(isExistingNear ? beforeStock.nearestLotExpiryDate : null)
    await expect(postFeedReceiptDemo(draft.id)).rejects.toThrow('Chỉ có thể ghi nhận phiếu nháp.')
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(changedStock.onHandKg)
    expect((await listFeedReceipts()).find((row) => row.id === draft.id)?.status).toBe('POSTED')
  })

  it('records, lists, and voids supplier payments with voucher/payment versions', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockImplementation(async (path) => path.endsWith('/payments') ? paymentResult : receiptView({ version: 3 }))
    vi.mocked(transport.command).mockImplementation(async () => ({ ...paymentResult, payment: paymentResult.payments?.[0] ?? null }))
    const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport })

    expect(await api.payments(8130)).toMatchObject({ summary: { outstanding: 1000 }, payments: [{ id: 44, method: 'CASH' }] })
    const recorded = await api.recordPayment(8130, { amount: 500, method: 'BANK_TRANSFER', date: '2026-11-02', reference: 'MB-01', note: 'Trả đợt 2' }, { key: 'payment-intent' })
    expect(transport.command).toHaveBeenCalledWith('/api/farms/32/feed/receipts/8130/payments', {
      paymentDate: '2026-11-02', amount: 500, method: 'BANK_TRANSFER', reference: 'MB-01', note: 'Trả đợt 2', voucherVersion: 3,
    }, { key: 'payment-intent' })
    expect(recorded.payments?.[0].id).toBe(44)

    const voided = await api.voidPayment(8130, 44, 'Sai số tiền', 2, { key: 'payment-void-intent' })
    expect(transport.command).toHaveBeenLastCalledWith('/api/farms/32/payments/44/void', { reason: 'Sai số tiền', version: 2 }, { key: 'payment-void-intent' })
    expect(voided.summary.outstanding).toBe(1000)
  })

  it('reuses the original voucher version with an idempotency key after an ambiguous payment failure', async () => {
    const transport = makeTransport()
    let receiptReads = 0
    vi.mocked(transport.get).mockImplementation(async (path) => {
      if (path.endsWith('/payments')) return paymentResult
      if (path.endsWith('/attachments')) return []
      receiptReads += 1
      return receiptView({ version: receiptReads === 1 ? 3 : 4 })
    })
    vi.mocked(transport.command)
      .mockRejectedValueOnce(new Error('response timed out'))
      .mockResolvedValueOnce({ ...paymentResult, payment: paymentResult.payments?.[0] ?? null })
    const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport })
    const input = { amount: 500, method: 'BANK_TRANSFER' as const, date: '2026-11-02' }

    await expect(api.recordPayment(8130, input, { key: 'retry-same-payment' })).rejects.toThrow('response timed out')
    await api.recordPayment(8130, input, { key: 'retry-same-payment' })
    const firstBody = vi.mocked(transport.command).mock.calls[0]?.[1]
    const retryBody = vi.mocked(transport.command).mock.calls[1]?.[1]
    expect(firstBody).toEqual({ paymentDate: '2026-11-02', amount: 500, method: 'BANK_TRANSFER', reference: null, note: null, voucherVersion: 3 })
    expect(retryBody).toEqual(firstBody)
  })

  it('uses the receipt attachment routes for list, upload, download, and draft removal', async () => {
    const transport = makeTransport()
    const attachment = { id: 71, contentType: 'application/pdf', fileSize: 12, originalFilename: 'invoice.pdf', createdAt: '2026-11-01T08:00:00Z' }
    const fileBlob = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    vi.mocked(transport.get).mockImplementation(async (path) => path.endsWith('/attachments/71') ? fileBlob : [attachment])
    vi.mocked(transport.command).mockResolvedValue(attachment)
    const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport })

    expect(await api.attachments(8130)).toEqual([attachment])
    const file = new File(['%PDF-1.7'], 'invoice.pdf', { type: 'application/pdf' })
    expect(await api.uploadAttachment(8130, file, { key: 'attachment-intent' })).toEqual(attachment)
    const uploadCall = vi.mocked(transport.command).mock.calls[0]
    expect(uploadCall[0]).toBe('/api/farms/32/feed/receipts/8130/attachments')
    expect((uploadCall[1] as FormData).get('file')).toBe(file)
    expect(uploadCall[2]).toEqual({ key: 'attachment-intent' })
    expect(await api.downloadAttachment(8130, 71)).toBe(fileBlob)
    expect(transport.get).toHaveBeenLastCalledWith('/api/farms/32/feed/receipts/8130/attachments/71')
    expect(await api.removeAttachment(8130, 71, { key: 'remove-intent' })).toEqual(attachment)
    expect(transport.command).toHaveBeenLastCalledWith('/api/farms/32/feed/receipts/8130/attachments/71', undefined, { method: 'DELETE', key: 'remove-intent' })
  })

  it('loads payment attachment metadata and uses payment-scoped upload/download routes', async () => {
    const transport = makeTransport()
    const attachment = { id: 72, contentType: 'image/jpeg', fileSize: 3, originalFilename: 'transfer.jpg', createdAt: '2026-11-02T08:00:00Z' }
    const fileBlob = new Blob(['jpg'], { type: 'image/jpeg' })
    vi.mocked(transport.get).mockImplementation(async (path) => {
      if (path === '/api/farms/32/feed/receipts/8130') return receiptView()
      if (path === '/api/farms/32/feed/receipts/8130/payments') return paymentResult
      if (path.endsWith('/payments/44/attachments')) return [attachment]
      if (path.endsWith('/payments/44/attachments/72')) return fileBlob
      return []
    })
    vi.mocked(transport.command).mockResolvedValue(attachment)
    const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport })

    const receipt = await api.get('8130')
    expect(receipt.payments?.[0].attachments).toEqual([attachment])
    const file = new File(['jpg'], 'transfer.jpg', { type: 'image/jpeg' })
    expect(await api.uploadPaymentAttachment(8130, 44, file, { key: 'payment-attachment-intent' })).toEqual(attachment)
    expect(transport.command).toHaveBeenCalledWith('/api/farms/32/feed/receipts/8130/payments/44/attachments', expect.any(FormData), { key: 'payment-attachment-intent' })
    expect(await api.downloadPaymentAttachment(8130, 44, 72)).toBe(fileBlob)
    expect(transport.get).toHaveBeenLastCalledWith('/api/farms/32/feed/receipts/8130/payments/44/attachments/72')
  })

  it('voids a posted receipt only while stock covers it, removes the stock and keeps the reason (GBR-99)', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
    const api = createFeedReceiptApi({ mode: 'local', farmId: 1, transport: makeTransport() })
    const before = (await listFeedStock()).find((row) => row.feedItemId === 101)!

    // PNK-0030 received 6.000 kg of Cỏ voi but only 1.850 kg are left: the void is refused and nothing changes.
    expect((await api.voidCheck(8130)).find((row) => row.feedItemId === 101)).toMatchObject({ onHandKg: 1850, neededKg: 6000, ok: false })
    await expect(api.void(8130, 'Nhập nhầm', 1)).rejects.toThrow('không thể hủy')
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(before.onHandKg)

    // A receipt created and posted now can be voided again: the stock is taken back and the reason is kept.
    const day = new Date()
    const draft = await saveFeedReceiptDemoDraft({
      receiptDate: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`, supplierId: 201, supplierName: 'Đại lý TACN Hưng Thịnh – Sơn Tây',
      invoiceNumber: '', receivedBy: '', storageLocation: '', note: '', transportFee: 0, amountPaid: 0, paymentMethod: null, paymentDate: '', balanceDueDate: '',
      lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', lotNumber: null, expiryDate: null, quantityPurchase: 100, purchaseUnit: 'kg', kgPerPurchaseUnit: 1, unitPrice: 700 }],
    })
    await postFeedReceiptDemo(draft.id)
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(before.onHandKg + 100)
    await expect(api.void(draft.id, '  ', 1)).rejects.toThrow('Nhập lý do')
    const voided = await api.void(draft.id, 'Nhập trùng phiếu', 1)
    expect(voided).toMatchObject({ status: 'VOIDED', voidReason: 'Nhập trùng phiếu' })
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(before.onHandKg)
    await expect(api.void(draft.id, 'Lần hai', 2)).rejects.toThrow('Chỉ có thể hủy phiếu đã ghi nhận')
  })
})
