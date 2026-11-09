// Tên trường theo DTO trong openapi (RecordDTO, CashReport, NotificationView).
export type RecordType = 'INCOME' | 'EXPENSE'
export type RecordScope = 'GENERAL' | 'FARM'
export type RecordState = 'DRAFT' | 'POSTED' | 'VOID'
export type RecordSourceType = 'MANUAL' | 'BANK'

export interface Farm { id: number; name: string }

export interface Receipt {
  code: string
  paymentCode: string
  farmId: number
  farmName: string
  termYears: 1 | 2 | 3
  amountVnd: number
  priceVersion: string
  /** Giờ ngân hàng ghi nhận (ISO, giờ Việt Nam). */
  bankPaidAt: string
  bankFirstSeenAt: string
  confirmedAt: string
  confirmedBy: 'SEPAY' | 'PM_ACCEPT'
  periodStart: string
  periodEnd: string
  evidenceCode: string
  evidenceLabel: string
}

export interface RecordHistory { id: number; action: string; changedAt: string; actor: string; reason?: string; detail?: string }

export interface FinanceRecord {
  id: number
  recordCode: string
  type: RecordType
  category: string
  amountVnd: number
  occurredOn: string
  scope: RecordScope
  farmId: number | null
  farmName: string
  documentNumber: string
  description: string
  sourceType: RecordSourceType
  sourceReference: string
  sourceEvidenceId: number | null
  state: RecordState
  version: number
  createdAt: string
  createdBy: string
  postedAt?: string
  postedBy?: string
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
  replacementOf?: string
  replacementRecordId?: number
  history: RecordHistory[]
}

export interface RecordFields {
  type: RecordType
  category: string
  amountVnd: number
  occurredOn: string
  scope: RecordScope
  farmId: number | null
  documentNumber: string
  description: string
  sourceType: RecordSourceType
  sourceEvidenceId: number | null
}

export type RecordErrors = Partial<Record<'category' | 'amountVnd' | 'occurredOn' | 'farmId' | 'documentNumber' | 'description' | 'sourceEvidenceId', string>>

export interface BankTransactionChoice {
  sourceReference: string
  transactionId: number
  /** ID của BankTransferEvidence để gửi vào sourceEvidenceId; transactionId là mã giao dịch ngân hàng hiển thị. */
  evidenceId?: number
  amount: number
  bankPaidAt: string
  direction: 'IN' | 'OUT'
  bank: string
  paymentReference: string
  /** Giao dịch đã được tính là biên nhận gói hoặc khoản đã ghi sổ (GBR-84). */
  claimedBy?: string
  evidenceCode: string
}

export interface RecordFilters { type?: RecordType | ''; category?: string; scope?: string; from?: string; to?: string; state?: RecordState | ''; page?: number; size?: number }
export interface ReceiptFilters { search?: string; farmId?: number | ''; from?: string; to?: string; page?: number; size?: number }

export type SourceFilter = 'BOTH' | 'RECEIPTS' | 'MANUAL'
export interface ReportCriteria { dateFrom: string; dateTo: string; farmId: number | null; sourceFilter: SourceFilter }
export interface ScopeTotals { scope: RecordScope | 'OTHER' | 'TOTAL'; farmId: number | null; farmName: string; subscriptionReceipts: number; otherIncome: number; expense: number }
export interface ReportLine { sourceType: 'RECEIPT' | 'MANUAL'; code: string; scope: RecordScope; farmName: string; direction: 'IN' | 'OUT'; category: string; amountVnd: number; cashDate: string; status: string; reference: string }
export interface ReportSummary { subscriptionReceipts: number; otherIncome: number; totalIncome: number; totalExpense: number; netCashFlow: number; scopes: ScopeTotals[]; dailyIncome: { date: string; income: number }[]; note: string }
export interface CashReport { id: number; code: string; expired: boolean; criteria: ReportCriteria; summary: ReportSummary; lines: ReportLine[]; generatedAt: string; expiresAt: string }

export type NoticeKind = 'RECON' | 'SUPPORT'
export interface PmNotice { id: number; kind: NoticeKind; title: string; summary: string; createdTime: string; readTime: string | null; actionLabel: string; href: string }
