export type Status = 'ACTIVE' | 'EXITED' | 'VOIDED' | 'DRAFT' | 'POSTED' | 'CANCELED' | string
export type CattleStatus = 'ACTIVE' | 'EXITED' | 'VOIDED' | string
export type PenStatus = 'ACTIVE' | 'INACTIVE' | string
export type CattleCode = string
export type PenCode = string

export interface Cattle {
  code: CattleCode
  tag?: string
  breed?: string
  sex?: string
  barn: PenCode | null
  status: CattleStatus
  events?: unknown[]
  [key: string]: unknown
}

export type PenCowLink = [CattleCode, string]

export interface Pen {
  code: PenCode
  name: string
  count: number
  capacity: number
  status: PenStatus
  cows: PenCowLink[]
  [key: string]: unknown
}

export interface HerdEntryDetail {
  id?: string
  code?: CattleCode
  [key: string]: unknown
}

export interface HerdEntry {
  id: string
  date: string
  type: string
  source: string
  count: number
  weight: number
  total: number | null
  debt: number | null
  status: string
  detail?: HerdEntryDetail[]
  draft?: Record<string, unknown>
  [key: string]: unknown
}

export interface HerdExit {
  id: string
  date: string
  type: string
  who: string
  sub?: string
  count: number
  weight: string | number
  total: number | null
  due: number | null
  status: string
  detail?: HerdEntryDetail[]
  draft?: Record<string, unknown>
  [key: string]: unknown
}

export type HerdEntryDraft = Record<string, unknown>
export type HerdExitDraft = Record<string, unknown>
export type Payment = Record<string, unknown>
export type CollectionRow = Record<string, unknown>
