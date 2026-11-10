import test from 'node:test'
import assert from 'node:assert/strict'
import { createBackendClient } from '../../src/api/backendClient'
import { createFeedReceiptApi } from '../../src/features/feed-stock/api/feedReceiptApi'

const receiptView = (status: string, version: number) => ({
  id: 8130, code: 'PNK-2026-0030', receiptDate: '2026-11-01', supplierId: 201, supplierName: 'NCC 1',
  invoiceNumber: null, receivedBy: null, storageLocation: null, note: null, status,
  goodsAmount: 1200, transportFee: 100, totalPayable: 1300, amountPaid: status === 'DRAFT' ? 0 : 300,
  outstandingAmount: status === 'DRAFT' ? 1300 : 1000, initialPaymentAmount: 300, initialPaymentMethod: 'CASH',
  initialPaymentDate: '2026-11-01', paymentDueDate: '2026-11-15', paymentState: status === 'DRAFT' ? 'UNPAID' : 'PARTIAL',
  version, createdById: 1, createdByName: 'Owner', createdAt: '2026-11-01T08:00:00Z',
  postedById: status === 'DRAFT' ? null : 1, postedByName: status === 'DRAFT' ? null : 'Owner', postedAt: status === 'DRAFT' ? null : '2026-11-01T08:05:00Z',
  voidReason: null, voidedById: null, voidedByName: null, voidedAt: null,
  lines: [{ id: 22, feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', lotNumber: null, expiryDate: null, quantityPurchase: 2, purchaseUnit: 'Bao', kgReceived: 50, unitPrice: 600, lineAmount: 1200 }],
})

test('receipt create, post, and later payment use relative farm routes, CSRF, versions and idempotency keys', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const payment = { id: 44, voucherType: 'FEED_RECEIPT', voucherId: 8130, voucherCode: 'PNK-2026-0030', direction: 'PAY', paymentDate: '2026-11-02', amount: 300, method: 'CASH', reference: null, note: null, status: 'RECORDED', recordedById: 1, recordedByName: 'Owner', recordedAt: '2026-11-02T08:00:00Z', voidReason: null, voidedAt: null, version: 0 }
  const paymentResult = {
    payment,
    summary: { voucherType: 'FEED_RECEIPT', voucherId: 8130, voucherCode: 'PNK-2026-0030', total: 1300, paid: 300, outstanding: 1000, overpaid: 0, state: 'PARTIAL', voucherVersion: 2 },
    payments: [payment],
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    const pathname = new URL(url).pathname
    calls.push({ url, init })
    if (pathname === '/api/csrf') return Response.json({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' })
    if (pathname === '/api/farms/32/feed/receipts' && init?.method === 'POST') return Response.json(receiptView('DRAFT', 0))
    if (pathname === '/api/farms/32/feed/receipts/8130/post' && init?.method === 'POST') return Response.json(receiptView('POSTED', 1))
    if (pathname === '/api/farms/32/feed/receipts/8130' && init?.method === 'GET') return Response.json(receiptView('POSTED', 1))
    if (pathname === '/api/farms/32/feed/receipts/8130/payments' && init?.method === 'POST') return Response.json(paymentResult)
    if (pathname === '/api/farms/32/feed/receipts/8130/payments' && init?.method === 'GET') return Response.json(paymentResult)
    if (pathname === '/api/farms/32/feed/receipts/8130/payments/44/attachments') return Response.json([])
    throw new Error(`Unexpected ${init?.method ?? 'GET'} ${pathname}`)
  }
  const transport = createBackendClient({ baseUrl: 'http://backend.test', fetchImpl })
  const api = createFeedReceiptApi({ mode: 'backend', farmId: 32, transport })
  const input = {
    receiptDate: '2026-11-01', supplierId: 201, supplierName: 'NCC 1', invoiceNumber: '', receivedBy: '',
    storageLocation: '', note: '', transportFee: 100, amountPaid: 300, paymentMethod: 'CASH' as const,
    paymentDate: '2026-11-01', balanceDueDate: '2026-11-15',
    lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', lotNumber: null, expiryDate: null, quantityPurchase: 2, purchaseUnit: 'Bao', kgPerPurchaseUnit: 25, unitPrice: 600 }],
  }

  const draft = await api.saveDraft(input, { key: 'receipt-create-key' })
  assert.equal(draft.status, 'DRAFT')
  const createCall = calls.find((call) => new URL(call.url).pathname === '/api/farms/32/feed/receipts' && call.init?.method === 'POST')!
  assert.equal((createCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'receipt-create-key')
  assert.equal((createCall.init?.headers as Record<string, string>)['X-XSRF-TOKEN'], 'csrf-token')
  assert.equal(createCall.init?.credentials, 'include')
  assert.deepEqual(JSON.parse(String(createCall.init?.body)), {
    receiptDate: '2026-11-01', supplierId: 201, invoiceNumber: null, receivedBy: null, storageLocation: null, note: null,
    transportFee: 100, amountPaid: 300, method: 'CASH', paymentDate: '2026-11-01', paymentDueDate: '2026-11-15',
    lines: [{ feedItemId: 101, lotNumber: null, expiryDate: null, quantityPurchase: 2, purchaseUnit: 'Bao', unitPrice: 600 }], postNow: false,
  })

  await api.post(draft.id, draft.version, { key: 'receipt-post-key' })
  const postCall = calls.find((call) => new URL(call.url).pathname.endsWith('/8130/post'))!
  assert.deepEqual(JSON.parse(String(postCall.init?.body)), { expectedVersion: 0 })
  assert.equal((postCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'receipt-post-key')
  assert.equal((postCall.init?.headers as Record<string, string>)['X-XSRF-TOKEN'], 'csrf-token')

  const paid = await api.recordPayment(8130, { amount: 300, method: 'CASH', date: '2026-11-02' }, { key: 'receipt-payment-key' })
  assert.equal(paid.summary.outstanding, 1000)
  const paymentCall = calls.find((call) => new URL(call.url).pathname.endsWith('/payments') && call.init?.method === 'POST')!
  assert.deepEqual(JSON.parse(String(paymentCall.init?.body)), {
    paymentDate: '2026-11-02', amount: 300, method: 'CASH', reference: null, note: null, voucherVersion: 1,
  })
  assert.equal((paymentCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'receipt-payment-key')
  assert.equal((paymentCall.init?.headers as Record<string, string>)['X-XSRF-TOKEN'], 'csrf-token')
  assert.equal(paymentCall.init?.credentials, 'include')
})
