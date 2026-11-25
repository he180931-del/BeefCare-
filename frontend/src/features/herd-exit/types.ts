import type { CattleCode } from '../cattle'
import type { VoucherPayment } from '../../shared/domain/voucherPayment'

export interface ExitCattleDetail {
  code?: CattleCode; tag?: string; breed?: string; sex?: string; barn?: string | null; weight?: number | null; amount?: number; current?: string; name?: string; dob?: string; dobAccuracy?: string; stage?: string; purpose?: string; estimated?: boolean; unitPrice?: number
  hist?: { vaccine: string; vaccineNote?: string; vaccineName?: string; vaccineDate?: string; vaccineSource?: string; disease: string; diseaseNote?: string; repro: string; pregnantAtEntry?: string; pregnancyMonths?: number }
  events?: string[]; age?: string; caseLine?: string[]; [key: string]: unknown
}
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
  history?: string[]
  buyer?: string
  buyerPhone?: string
  sourceHealthCaseId?: number
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
  weight?: string | number | null
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
