/** Response rows match backend ReceiptView / ReceiptLineView exactly. */
export type FeedReceiptLine = {
  id: number
  feedItemId: number
  feedCode: string
  feedName: string
  lotNumber: string | null
  expiryDate: string | null
  quantityPurchase: number
  purchaseUnit: string | null
  kgReceived: number
  unitPrice: number
  lineAmount: number
}

/** Keep status open-ended because the backend DTO exposes String, not an enum. */
export type FeedReceipt = {
  id: number
  code: string
  receiptDate: string
  supplierId: number
  supplierName: string
  status: string
  goodsAmount: number
  transportFee: number
  totalPayable: number
  version: number
  lines: FeedReceiptLine[]
  /** Local-demo extras shown in the list; ReceiptView does not carry them, so backend rows leave them undefined. */
  invoiceNumber?: string
  amountPaid?: number
  voidReason?: string
}

export type FeedReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED'

export type FeedReceiptFilters = {
  query?: string
  status?: FeedReceiptStatus | 'ALL'
  from?: string
  to?: string
  supplierId?: number | 'ALL'
}
