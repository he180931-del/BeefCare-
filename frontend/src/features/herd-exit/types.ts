import type { CattleDetail, DocumentRow, Payment } from '../../types'
import type { CattleCode } from '../cattle'

export type ExitStatus = 'Nháp' | 'Chờ xác nhận' | 'Đã xuất' | 'Đã hủy' | 'Đã bác'

export type ExitType = 'Bán' | 'Chết / mất' | 'Loại thải' | 'Khác'

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

export interface ExitDetail {
  death?: boolean
  lossType?: string
  date?: string
  source?: string
  reporter?: string
  reason?: string
  disposal?: string
  cow?: CattleDetail
  cows?: CattleDetail[]
  cowsTotal?: number
  payments?: Payment[]
  docs?: DocumentRow[]
  history?: string[]
  buyer?: string
  barnShift?: string
  checks?: Array<[string, string, boolean?]>
  deduction?: number
  [key: string]: unknown
}

export interface ExitDraft {
  type?: ExitType
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
  docs?: DocumentRow[]
  [key: string]: unknown
}

export interface HerdExit {
  id: string
  date?: string
  type?: ExitType
  who?: string
  sub?: string
  count?: number
  weight?: string | number | null
  total?: number | null
  due?: number | null
  dueNote?: string
  status: ExitStatus
  detail?: ExitDetail
  draft?: ExitDraft
  reason?: string
  note?: string
  [key: string]: unknown
}
