import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import type { FeedReceipt } from '../types/feedReceipt'
import type { FeedReceiptDemoStore, FeedReceiptDraftInput } from '../types/feedReceiptDemo'
import { backendPending } from '../../../api/backendPending'
import { feedReceiptDemoStore } from '../data/feedReceiptDemoStore'

const backendMutationMessage = 'Thao tác ghi phiếu hiện chỉ hoạt động trong bản demo.'

function receiptView(row: Awaited<ReturnType<FeedReceiptDemoStore['get']>>): FeedReceipt {
  return {
    id: row.id,
    code: row.code,
    receiptDate: row.receiptDate,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    status: row.status,
    goodsAmount: row.goodsAmount,
    transportFee: row.transportFee,
    totalPayable: row.totalPayable,
    version: row.version,
    invoiceNumber: row.invoiceNumber,
    amountPaid: row.amountPaid,
    ...(row.voidReason ? { voidReason: row.voidReason } : {}),
    lines: row.lines.map((line) => ({
      id: line.id,
      feedItemId: line.feedItemId,
      feedCode: line.feedCode,
      feedName: line.feedName,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
      quantityPurchase: line.quantityPurchase,
      purchaseUnit: line.purchaseUnit,
      kgReceived: line.kgReceived,
      unitPrice: line.unitPrice,
      lineAmount: line.lineAmount,
    })),
  }
}

export function createFeedReceiptApi({
  mode,
  farmId,
  transport,
  mockRows,
  demoStore = feedReceiptDemoStore,
}: {
  mode: BackendMode
  farmId: string | number
  transport: BackendTransport
  mockRows?: readonly FeedReceipt[]
  demoStore?: FeedReceiptDemoStore
}) {
  return {
    async list(): Promise<FeedReceipt[]> {
      if (mode === 'backend') {
        return await transport.get(transport.farmPath(farmId, '/feed/receipts')) as FeedReceipt[]
      }
      if (mockRows) return mockRows.map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line })) }))
      return (await demoStore.list()).map(receiptView)
    },
    async get(id: string) {
      if (mode === 'backend') throw new Error('Bản xem và sửa phiếu chỉ hoạt động trong bản demo.')
      return demoStore.get(id)
    },
    async saveDraft(input: FeedReceiptDraftInput) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.saveDraft(input)
    },
    /** Preview of POST .../receipts/{id}/void: which feeds still cover the received quantity (GBR-99). */
    async voidCheck(id: number) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.voidCheck(id)
    },
    // POST /api/farms/{farmId}/feed/receipts/{receiptId}/void
    async void(id: number, reason: string, expectedVersion: number) {
      if (mode === 'backend') {
        await transport.command(transport.farmPath(farmId, `/feed/receipts/${id}/void`), { reason, expectedVersion })
        return null
      }
      return demoStore.void(id, reason)
    },
    async post(id: number) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.post(id)
    },
    // chưa có API: OpenAPI has no route to record a later payment on a feed receipt.
    async recordPayment(id: number, amount: number, method: 'CASH' | 'BANK_TRANSFER', date: string) {
      if (mode === 'backend') throw backendPending('ghi trả nhà cung cấp')
      return demoStore.recordPayment(id, amount, method, date)
    },
  }
}

const feedReceiptApi = createFeedReceiptApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

/** Reads real rows in backend mode; draft and post mutations persist only in local demo mode. */
export const listFeedReceipts = () => feedReceiptApi.list()
export const getFeedReceiptDemo = (id: string) => feedReceiptApi.get(id)
export const saveFeedReceiptDemoDraft = (input: FeedReceiptDraftInput) => feedReceiptApi.saveDraft(input)
export const postFeedReceiptDemo = (id: number) => feedReceiptApi.post(id)
export const voidFeedReceipt = (id: number, reason: string, expectedVersion: number) => feedReceiptApi.void(id, reason, expectedVersion)
export const recordFeedReceiptPayment = (id: number, amount: number, method: 'CASH' | 'BANK_TRANSFER', date: string) => feedReceiptApi.recordPayment(id, amount, method, date)
export const checkFeedReceiptVoid = (id: number) => feedReceiptApi.voidCheck(id)
export const resetFeedReceiptDemoStore = () => feedReceiptDemoStore.reset()
