import type { FeedStockRow } from '../types'
import type { FeedReceipt } from './feedReceipt'

export type FeedReceiptDemoLine = FeedReceipt['lines'][number] & {
  kgPerPurchaseUnit: number
}

/** Local-only fields used by the demo form. These are not part of ReceiptView. */
export type FeedReceiptDemoRecord = Omit<FeedReceipt, 'lines'> & {
  invoiceNumber: string
  receivedBy: string
  storageLocation: string
  note: string
  amountPaid: number
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | null
  paymentDate: string
  balanceDueDate: string
  /** Reason entered when the receipt was voided (ReceiptView has no field for it yet). */
  voidReason?: string
  lines: FeedReceiptDemoLine[]
  [key: string]: unknown
}

export type FeedReceiptDraftLineInput = {
  id?: number
  feedItemId: number
  feedCode: string
  feedName: string
  lotNumber: string | null
  expiryDate: string | null
  quantityPurchase: number
  purchaseUnit: string
  kgPerPurchaseUnit: number
  unitPrice: number
}

export type FeedReceiptDraftInput = {
  id?: number
  receiptDate: string
  supplierId: number
  supplierName: string
  invoiceNumber: string
  receivedBy: string
  storageLocation: string
  note: string
  transportFee: number
  amountPaid: number
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | null
  paymentDate: string
  balanceDueDate: string
  lines: FeedReceiptDraftLineInput[]
}

export type FeedReceiptDemoStore = {
  list: () => Promise<FeedReceiptDemoRecord[]>
  get: (id: string) => Promise<FeedReceiptDemoRecord>
  saveDraft: (input: FeedReceiptDraftInput) => Promise<FeedReceiptDemoRecord>
  post: (id: number) => Promise<FeedReceiptDemoRecord>
  void: (id: number, reason: string) => Promise<FeedReceiptDemoRecord>
  voidCheck: (id: number) => Promise<FeedReceiptVoidCheckRow[]>
  reset: () => Promise<void>
}

export type FeedReceiptVoidCheckRow = { feedItemId: number; code: string; name: string; onHandKg: number; neededKg: number; ok: boolean }

export type FeedReceiptDemoStockStore = {
  list: () => Promise<FeedStockRow[]>
}
