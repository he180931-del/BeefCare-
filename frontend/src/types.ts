export type CattleStatus = 'ACTIVE' | 'EXITED' | 'VOIDED'
export type PenStatus = 'ACTIVE' | 'INACTIVE'
export type EntryStatus = 'Nháp' | 'Đã nhập' | 'Đã hủy'
export type ExitStatus = 'Nháp' | 'Chờ xác nhận' | 'Đã xuất' | 'Đã hủy' | 'Đã bác'
export type EntryType = 'Mua ngoài' | 'Bê sinh tại trại'
export type ExitType = 'Bán' | 'Chết / mất' | 'Loại thải' | 'Khác'
export type CattleCode = string
export type PenCode = string

export type PenCowLink = [CattleCode, string]

export interface Cattle {
  code: CattleCode
  tag?: string
  name?: string
  breed?: string
  sex?: string
  barn: PenCode | null
  status: CattleStatus
  events?: string[]
  entryVoucherId?: string
  entryLineNo?: number
  exitVoucherId?: string | null
  lastExitVoucherId?: string
  lastPen?: PenCode
  qrHistory?: Array<{ status?: string; [key: string]: unknown }>
  barnHistory?: Array<{ from?: string; to?: string; barn?: string; reason?: string; by?: string; [key: string]: unknown }>
  withdrawalUntil?: string
  ageMonths?: number
  weight?: number | null
  [key: string]: unknown
}
export type CattleInput = Partial<Cattle> & { code?: string; barn?: PenCode | null }

export interface Pen {
  code: PenCode
  name: string
  count: number
  capacity: number
  status: PenStatus
  cows: PenCowLink[]
  [key: string]: unknown
}

export interface CattleDetail {
  code?: CattleCode
  tag?: string
  breed?: string
  sex?: string
  barn?: string | null
  weight?: number | null
  amount?: number
  current?: string
  name?: string
  dob?: string
  dobAccuracy?: string
  stage?: string
  purpose?: string
  estimated?: boolean
  unitPrice?: number
  hist?: { vaccine: string; vaccineNote?: string; disease: string; repro: string }
  events?: string[]
  age?: string
  caseLine?: string[]
  [key: string]: unknown
}

export interface EntryCow {
  code?: CattleCode
  tag: string
  name: string
  breed: string
  sex: string
  dob: string
  dobAccuracy: string
  stage: string
  group?: string
  purpose: string
  ageMonths?: number
  weight: number
  estimated: boolean
  barn: PenCode
  unitPrice: number
  hist: { vaccine: string; vaccineNote?: string; disease: string; repro: string }
  [key: string]: unknown
}

export interface EntryCalf {
  name: string
  tag: string
  mother: string
  father: string
  born: string
  sex: string
  weight: number
  estimated: boolean
  purpose: string
  picked: boolean
  barn: string
  [key: string]: unknown
}

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

export interface DocumentRow { ext?: string; name: string; [key: string]: unknown }
export interface Payment { date: string; by: string; method: string; ref: string; amount: number; [key: string]: unknown }

export interface EntryDetail {
  sourceName?: string
  quarantine?: string
  phone?: string
  plate?: string
  by?: string
  note?: string
  cows?: CattleDetail[]
  cowsTotal?: number
  freight?: number
  payments?: Payment[]
  docs?: DocumentRow[]
  history?: string[]
  [key: string]: unknown
}

export interface EntryDraft {
  type?: EntryType
  date?: string
  cows?: EntryCow[]
  calves?: EntryCalf[]
  pricing?: 'kg' | 'con'
  sourceId?: string
  quarantine?: string
  receiver?: string
  note?: string
  freight?: number
  paid?: number
  method?: string
  due?: string
  printQr?: boolean
  docs?: DocumentRow[]
  [key: string]: unknown
}

export interface HerdEntry {
  id: string
  date?: string
  type?: EntryType
  source?: string
  count?: number
  weight?: number
  total?: number | null
  debt?: number | null
  status: EntryStatus
  detail?: EntryDetail
  draft?: EntryDraft
  cancelReason?: string
  pricing?: 'kg' | 'con'
  quarantine?: string
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

export type CollectionRow = Record<string, unknown>
