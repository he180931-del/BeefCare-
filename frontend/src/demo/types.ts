import type { CattleCode } from '../features/cattle/types'

// Shared by Herd Entry and Herd Exit: owner not decided yet.
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
  hist?: { vaccine: string; vaccineNote?: string; vaccineName?: string; vaccineDate?: string; vaccineSource?: string; disease: string; diseaseNote?: string; repro: string; pregnantAtEntry?: string; pregnancyMonths?: number }
  events?: string[]
  age?: string
  caseLine?: string[]
  [key: string]: unknown
}

export interface DocumentRow { ext?: string; name: string; [key: string]: unknown }
export interface Payment { date: string; by: string; method: string; ref: string; amount: number; [key: string]: unknown }

export type CollectionRow = Record<string, unknown>

// Compatibility path (refactor phase 2): these types moved to their feature. New code imports them from the feature.
export type { BarnHistoryRow, Cattle, CattleCare, CattleCode, CattleEvent, CattleInput, CattleStatus, ImportRecord, ImportRecordField, QrHistoryRow, StatusChip, Tone } from '../features/cattle/types'
export type { Pen, PenCode, PenCowLink, PenStatus } from '../features/pen-management/types'
export type { EntryCalf, EntryCow, EntryDetail, EntryDraft, EntryStatus, EntryType, HerdEntry } from '../features/herd-entry/types'
export type { ExitDetail, ExitDraft, ExitDraftCow, ExitStatus, ExitType, HerdExit } from '../features/herd-exit/types'
