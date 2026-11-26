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
  /** ReceiptView extras are optional until the backend's detailed receipt contract is deployed. */
  invoiceNumber?: string
  receivedBy?: string
  storageLocation?: string
  note?: string
  amountPaid?: number
  initialPaymentAmount?: number
  outstanding?: number
  paymentState?: string
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | null
  paymentDate?: string
  paymentDueDate?: string
  createdById?: number | null
  createdByName?: string
  createdAt?: string
  postedById?: number | null
  voidReason?: string
  voidedById?: number | null
  postedAt?: string
  postedByName?: string
  voidedAt?: string
  voidedByName?: string
  payments?: FeedReceiptPayment[]
}

export type FeedReceiptPayment = {
  id: number
  voucherType: string
  voucherId: number
  voucherCode: string
  direction: string
  paymentDate: string
  amount: number
  method: 'CASH' | 'BANK_TRANSFER'
  reference?: string | null
  note?: string | null
  status: string
  recordedById?: number | null
  recordedByName?: string | null
  recordedAt?: string | null
  voidReason?: string | null
  voidedAt?: string | null
  version?: number | null
  attachments?: FeedReceiptAttachment[]
}

export type FeedReceiptPaymentSummary = {
  voucherType: string
  voucherId: number
  voucherCode: string
  total: number
  paid: number
  outstanding: number
  overpaid: number
  state: string
  voucherVersion: number
}

export type FeedReceiptPaymentResult = {
  payment: FeedReceiptPayment | null
  summary: FeedReceiptPaymentSummary
  payments: FeedReceiptPayment[] | null
}

export type FeedReceiptAttachment = {
  id: number
  contentType: string
  fileSize: number
  originalFilename: string
  createdAt: string
}

export type FeedReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED'

export type FeedReceiptFilters = {
  query?: string
  status?: FeedReceiptStatus | 'ALL'
  from?: string
  to?: string
  supplierId?: number | 'ALL'
}
