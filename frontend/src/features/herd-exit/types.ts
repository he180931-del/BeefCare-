import type { CattleCode } from '../cattle'
import type { VoucherPayment } from '../../shared/domain/voucherPayment'

export interface ExitCattleDetail {
  code?: CattleCode; tag?: string; breed?: string; sex?: string; barn?: string | null; weight?: number | null; amount?: number; current?: string; name?: string; dob?: string; dobAccuracy?: string; stage?: string; purpose?: string; estimated?: boolean; weightBasis?: 'MEASURED' | 'ESTIMATED' | null; unitPrice?: number
  hist?: { vaccine: string; vaccineNote?: string; vaccineName?: string; vaccineDate?: string; vaccineSource?: string; disease: string; diseaseNote?: string; repro: string; pregnantAtEntry?: string; pregnancyMonths?: number }
  events?: string[]; age?: string; caseLine?: string[]; [key: string]: unknown
}
/** One line of the voucher history (SCR-76 #7): business time, actor and text as the server recorded them. */
export interface ExitHistoryEntry { time?: string; type?: string; actor?: string; text: string }

/** What a confirmed exit closed or cancelled for one cattle; returned for review when the voucher is voided (R-13-12). */
export interface ExitReviewItem {
  cattleId: number
  cattleCode: string
  cancelledDoseIds: number[]
  cancelledReminderIds: number[]
  closedCaseIds: number[]
  closedPregnancyId: number | null
  pendingCalfIds: number[]
}

/** Result of voiding a confirmed voucher (A10): the voided voucher, MSG-FE13-05 text and the review list. */
export interface ExitVoidOutcome { voucher: HerdExit; message: string; reviewList: ExitReviewItem[] }

/** Result of confirming or dismissing a voucher: the voucher and the server's success text (MSG-FE13-02 / -04 / -10). */
export interface ExitCommandOutcome { voucher: HerdExit; message: string }

export interface ExitDocument { ext?: string; name: string; [key: string]: unknown }
export type ExitPayment = VoucherPayment

export interface ExitBuyer {
  id: string
  name: string
  phone: string
  area?: string
  note?: string
  active?: boolean
  version?: number
}

export interface ExitBuyerInput {
  name: string
  phone: string
  area?: string
}

export type ExitStatus = 'Nháp' | 'Chờ xác nhận' | 'Đã xuất' | 'Đã hủy' | 'Đã bác'

export type ExitType = 'Bán' | 'Chết / mất' | 'Loại thải' | 'Khác'
export type LossKind = 'DIED' | 'MISSING'

export interface ExitDraftCow {
  code: CattleCode
  tag?: string
  breed?: string
  sex?: string
  age?: string
  group?: string
  stage?: string
  barn?: string
  weightNote?: string
  withdrawalUntil?: string
  openCase?: string
  weight: number
  unitPrice: number
  estimated: boolean
  [key: string]: unknown
}

export interface ExitCandidateCow {
  code: string
  backendId?: number
  tag: string
  breed: string
  sex: string
  age: string
  group: string
  groupKey?: string
  stage: string
  stageKey?: string
  barn: string
  weight: number
  weightNote: string
  estimated: boolean
  unitPrice: number
  withdrawalUntil?: string
  openCase?: string
  penCount?: number
  penCapacity?: number
}

export interface ExitDetail {
  death?: boolean
  lossKind?: LossKind
  lossType?: string
  date?: string
  source?: string
  reporter?: string
  reason?: string
  disposal?: string
  cow?: ExitCattleDetail
  cows?: ExitCattleDetail[]
  cowsTotal?: number
  payments?: ExitPayment[]
  docs?: ExitDocument[]
  history?: ExitHistoryEntry[]
  buyer?: string
  destination?: string
  createdAt?: string
  confirmedBy?: string
  confirmedAt?: string
  closedBy?: string
  closedAt?: string
  buyerPhone?: string
  sourceHealthCaseId?: number
  sourceHealthCaseCode?: string
  barnShift?: string
  checks?: Array<[string, string, boolean?]>
  deduction?: number
  [key: string]: unknown
}

export interface ExitDraft {
  type?: ExitType
  lossKind?: LossKind
  deathCause?: string
  carcassDisposal?: string
  date?: string
  buyerId?: string
  quarantine?: string
  plate?: string
  note?: string
  pricing?: 'kg' | 'con'
  deduction?: number
  collected?: number
  method?: string
  dueDate?: string
  cows?: ExitDraftCow[]
  docs?: ExitDocument[]
  [key: string]: unknown
}

export interface HerdExit {
  id: string
  backendId?: number
  version?: number
  date?: string
  type?: ExitType
  who?: string
  sub?: string
  count?: number
  /** Legacy display text kept by local drafts; backend rows use weightKg / weightEstimated. */
  weight?: string | number | null
  weightKg?: number | null
  weightEstimated?: boolean
  pens?: string[]
  total?: number | null
  collected?: number
  due?: number | null
  dueNote?: string
  status: ExitStatus
  detail?: ExitDetail
  draft?: ExitDraft
  reason?: string
  note?: string
  [key: string]: unknown
}

/** SCR-41 filters sent to `GET /exit-vouchers`; an empty period lets the server use its default (previous quarter start → today). */
export interface ExitListQuery { from?: string; to?: string; type?: ExitType | '' }

/** SCR-41 tiles (#5–#8) computed by the server for the period and type. */
export interface ExitListTiles {
  cattleExitedByType: Record<ExitType, number>
  cattleExited: number
  salesRevenue: number
  toCollect: number
  vouchersToCollect: number
  awaitingOwner: number
}

/** Tab keys of SCR-41; counts come from the server's statusCounts. */
export type ExitStatusCountKey = 'ALL' | 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'VOIDED' | 'DISMISSED'

export interface ExitListResult {
  from: string
  to: string
  tiles: ExitListTiles
  statusCounts: Record<ExitStatusCountKey, number>
  vouchers: HerdExit[]
}
