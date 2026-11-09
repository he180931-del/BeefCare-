// Tên trường theo PaymentDTO / SubscriptionOverview / PriceDTO trong openapi; phần thêm cho UI ghi chú ở từng trường.
export type Term = 1 | 2 | 3
export type PaymentState = 'PENDING' | 'PAID' | 'EXPIRED'
export type ServiceStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
export type Coverage = 'CURRENT' | 'FUTURE_ONLY' | 'NONE'
export type PeriodStatus = 'CURRENT' | 'FUTURE' | 'PAST'

export interface PriceDTO {
  id: number // mock: id trùng số phiên bản (v3 -> 3)
  price1y: number
  price2y: number
  price3y: number
  effectiveAt: string
}

export interface PaymentDTO {
  id: number
  quoteRef: string
  durationYears: Term
  amountVnd: number
  state: PaymentState
  requestedAt: string
  expiresAt: string
  purchasedStart?: string | null
  purchasedEnd?: string | null // cuối kỳ, nửa mở [start, end)
  receiptCode?: string | null
  priceVersionId: number
  bankCode: string | null
  accountNumber: string | null
  accountName: string | null
  qrImageUrl?: string | null
  reopened?: boolean
  bankPaidAt?: string | null
  receivedAt?: string | null
  confirmedAt?: string | null
  confirmationSource?: 'SEPAY' | 'PM' | null
}

/** Presentation values keep a missing legacy bank snapshot visible as empty. */
export interface Payment extends Omit<PaymentDTO, 'bankCode' | 'accountNumber' | 'accountName'> {
  // Missing legacy bank snapshots are empty for presentation; never replaced with a demo receiving account.
  bankCode: string
  accountNumber: string
  accountName: string
  bankPaidAt?: string | null
  receivedAt?: string | null
  confirmedAt?: string | null
}

export interface PurchasedPeriod {
  paymentCode: string
  durationYears: Term
  amountVnd: number
  start: string
  end: string
  status: PeriodStatus
}

export type RequestEligibility =
  | { ok: true }
  | { ok: false; reason: 'SUSPENDED' }
  | { ok: false; reason: 'PRICE_UNAVAILABLE' }
  | { ok: false; reason: 'OUTSIDE_WINDOW'; opensAt: string }

export interface SubscriptionOverview {
  farmId: number
  serviceStatus: ServiceStatus
  latestEnd: string | null
  entitlementStatus: Coverage
  currentPrices: PriceDTO | null
  pendingPayment: Payment | null
  renewalOpensAt: string | null
  // SCR-57: returned by the Owner subscription overview endpoint.
  farmName: string
  suspended: boolean
  suspendedSince: string | null
  currentPeriod: PurchasedPeriod | null
  daysRemaining: number | null
  futurePeriods: PurchasedPeriod[]
  periods: PurchasedPeriod[]
  eligibility: RequestEligibility
}

export interface CreatePaymentCommand {
  durationYears: Term
  /** Phiên bản đã xem, adapter gửi reviewedPriceVersion (bắt buộc trong backend mode). */
  expectedPriceVersionId?: number
  idempotencyKey?: string
}

export interface PaymentFilters {
  q?: string
  state?: PaymentState | ''
  from?: string // yyyy-mm-dd
  to?: string
  sort?: 'requestedAt' | 'expiresAt'
  dir?: 'asc' | 'desc'
  page?: number // zero-based; SCR-60 uses 20 rows per page
}

export interface PaymentPage {
  content: Payment[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export type RefreshDemo = 'bank-paid' | 'result-unavailable'

export interface PriceQuote {
  version: number
  term: Term
  amountVnd: number
}

export type StateDialogState =
  | { kind: 'expired'; payment: Payment }
  | { kind: 'pending-exists'; payment: Payment }
  | { kind: 'renewal-closed'; confirmedEnd: string; opensAt: string }
  | { kind: 'suspended'; farmName: string; paidUntil: string | null }
  | { kind: 'price-changed'; seen: PriceQuote; current: PriceQuote }
  | { kind: 'price-unavailable' }
  | { kind: 'result-unavailable'; payment: Payment; checkedAt: string }

export type SubscriptionErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_TERM'
  | 'SUSPENDED'
  | 'OUTSIDE_WINDOW'
  | 'PENDING_EXISTS'
  | 'PRICE_CHANGED'
  | 'PRICE_UNAVAILABLE'
  | 'RESULT_UNAVAILABLE'

export interface SubscriptionErrorDetail {
  payment?: Payment
  farmName?: string
  paidUntil?: string | null
  confirmedEnd?: string
  opensAt?: string
  seen?: PriceQuote
  current?: PriceQuote
  checkedAt?: string
}

export class SubscriptionError extends Error {
  code: SubscriptionErrorCode
  detail: SubscriptionErrorDetail
  constructor(code: SubscriptionErrorCode, message: string, detail: SubscriptionErrorDetail = {}) {
    super(message)
    this.name = 'SubscriptionError'
    this.code = code
    this.detail = detail
  }
}

export interface FarmRecord {
  id: number
  name: string
  suspended: boolean
  suspendedSince: string | null
  payments: Payment[]
}

export interface SubscriptionSeed {
  farms: FarmRecord[]
  prices: PriceDTO[]
}

export interface BankTransfer {
  transactionId: string
  direction: 'IN' | 'OUT'
  amountVnd: number
  content: string
  paidAt: string
  accountNumber?: string
}

export type TransferStatus =
  | 'CONFIRMED'
  | 'DUPLICATE'
  | 'CODE_NOT_MATCHED'
  | 'OUTGOING'
  | 'ACCOUNT_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'WINDOW_MISSED'
  | 'ALREADY_ALLOCATED'

export interface TransferResult {
  status: TransferStatus
  payment: Payment | null
}
