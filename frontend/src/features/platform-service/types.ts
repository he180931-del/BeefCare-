export type ServiceStatus = 'ACTIVE' | 'PENDING_PAYMENT' | 'EXPIRED' | 'SUSPENDED'
export type TermYears = 1 | 2 | 3

export interface PurchasedPeriod {
  paymentCode: string
  receiptCode: string
  termYears: TermYears
  /** yyyy-mm-dd, ngày đầu của kỳ */
  start: string
  /** yyyy-mm-dd, ngày cuối cùng của kỳ (đã gồm) */
  end: string
  /** yyyy-mm-ddTHH:mm:ss giờ Việt Nam */
  confirmedAt: string
}

export interface PlatformFarm {
  farmId: number
  farmName: string
  ownerName: string
  ownerEmail: string
  subscriptionCode: string | null
  serviceStatus: ServiceStatus
  herdSize: number
  suspended: boolean
  suspendedSince: string | null
  suspendedBy: string | null
  suspendReason: string | null
  periods: PurchasedPeriod[]
  version: number
}

// FarmOverview (openapi) + các trường hiển thị của SCR-12
export interface FarmOverview {
  farmId: number
  farmName: string
  ownerName: string
  ownerEmail: string
  serviceStatus: ServiceStatus
  coverageEnd: string | null
  suspended: boolean
  suspendedSince: string | null
  suspendedBy: string | null
  suspendReason: string | null
  herdSize: number
  periodStart: string | null
  periodEnd: string | null
  version: number
}
export interface FarmFilters { q?: string; status?: ServiceStatus | '' }
export interface FarmTiles { total: number; active: number; pending: number; expired: number; suspended: number }
export interface FarmListResult { items: FarmOverview[]; total: number; tiles: FarmTiles }
export interface ChangeFarmCommand { reason: string; version: number }

export type PeriodState = 'CURRENT' | 'FUTURE' | 'PAST'
export interface PeriodView extends PurchasedPeriod { state: PeriodState }
export interface SubscriptionRow {
  farmId: number
  farmName: string
  ownerName: string
  ownerEmail: string
  serviceStatus: ServiceStatus
  subscriptionCode: string | null
  currentStart: string | null
  currentEnd: string | null
  confirmedUntil: string | null
  paymentCodes: string[]
}
export interface SubscriptionDetail {
  summary: SubscriptionRow
  suspended: boolean
  suspendedSince: string | null
  renewalOpens: string | null
  latestPurchase: PurchasedPeriod | null
  periods: PeriodView[]
  emptyMessage: string | null
}
export interface SubscriptionFilters { q?: string; status?: ServiceStatus | ''; endFrom?: string; endTo?: string }

export type PaymentState = 'PENDING' | 'PAID' | 'EXPIRED'
export interface PlatformPayment {
  id: number
  code: string
  farmId: number
  farmName: string
  termYears: TermYears
  amount: number
  state: PaymentState
  createdAt: string
  expiresAt: string
  priceVersion: number
  recipient: string
  evidenceId: number | null
  receiptCode: string | null
  confirmedAt: string | null
  purchasedStart: string | null
  purchasedEnd: string | null
}
export interface PaymentFilters { q?: string; state?: PaymentState | '' }

export type ReviewStatus = 'TO_REVIEW' | 'HOLD' | 'REJECTED' | 'ACCEPTED' | 'AUTO_CONFIRMED'
export type MatchResult = 'EXACT_CODE' | 'CODE_MISMATCH' | 'AUTO_PAID' | 'REQUEST_EXPIRED' | 'NO_REQUEST' | 'AMOUNT_MISMATCH' | 'OUTGOING'
export interface EvidenceEvent { at: string; by: string; text: string }
export interface Evidence {
  id: number
  provider: string
  environment: string
  accountNamespace: string
  transactionId: string
  amount: number
  direction: 'IN' | 'OUT'
  receivingAccount: string
  content: string
  bankPaidAt: string
  receivedAt: string
  deliveries: string
  matchResult: MatchResult
  reviewStatus: ReviewStatus
  reviewReason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  lockedForReturn: boolean
  lockReason: string | null
  lockedBy: string | null
  lockedAt: string | null
  lockReference: string | null
  returnReference: string | null
  returnResult: string | null
  manualIncomePosted: boolean
  paymentId: number | null
  version: number
  history: EvidenceEvent[]
}
export interface EvidenceFilters { status?: '' | 'TO_REVIEW' | 'HOLD' | 'REJECTED' | 'ACCEPTED' | 'LOCKED'; bankFrom?: string; bankTo?: string }
export interface PaymentTiles { unmatched: number; pendingRequests: number; hold: number; lockedForReturn: number }

export type ReviewDecision = 'ACCEPT' | 'HOLD' | 'REJECT'
export interface ReviewCommand {
  decision: ReviewDecision
  paymentId?: number | null
  reason: string
  /** PM chủ động chọn ứng viên khi mã bị gõ sai (GBR-72) */
  explicitSelection?: boolean
  version: number
}
export interface ReviewResult { evidence: Evidence; payment: PlatformPayment | null; period: { start: string; end: string } | null; receiptCode: string | null; confirmedAt: string | null }
export interface LockCommand { reason: string; reference?: string; version: number }
export interface UnlockCommand { reason: string; verification: string; version: number }
export interface ReturnCommand { reference: string; paidOutAt: string; result: string; verifier: string; version: number }

export interface PriceVersion {
  version: number
  price1y: number
  price2y: number
  price3y: number
  effectiveAt: string
  terms: string
  publishedBy: string
  publishedAt: string
  withdrawn: boolean
  withdrawReason: string | null
}
export type PriceStatus = 'EFFECTIVE' | 'SCHEDULED' | 'SUPERSEDED' | 'WITHDRAWN'
export interface PriceVersionView extends PriceVersion { status: PriceStatus }
export interface PriceDraft { price1y: string; price2y: string; price3y: string; mode: 'NOW' | 'SCHEDULE'; effectiveAt: string; terms: string }
export interface PublishPriceCommand { price1y: number; price2y: number; price3y: number; mode: 'NOW' | 'SCHEDULE'; effectiveAt: string; terms: string }
