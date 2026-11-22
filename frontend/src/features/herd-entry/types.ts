import type { CattleCode } from '../cattle'
import type { PenCode } from '../pen-management'

export interface EntryCattleDetail {
  entryId?: number
  lineStatus?: 'VALID' | 'VOID'
  lineVersion?: number
  cattleId?: number
  weightBasis?: EntryWeightBasis
  breedId?: number
  sexCode?: EntrySexCode
  birthDate?: string
  birthDateAccuracy?: EntryBirthAccuracy
  damCode?: string
  sireCode?: string
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

export interface EntryDocument { ext?: string; name: string; [key: string]: unknown }
export interface EntryPayment { date: string; by: string; method: string; ref: string; amount: number; [key: string]: unknown }

export type EntryStatus = 'Nháp' | 'Đã nhập' | 'Đã hủy'

export type EntryType = 'Mua ngoài' | 'Bê sinh tại trại'

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
  /** Backend weight-basis selection; null means the user has not selected a weighing basis yet. */
  weightBasis?: 'MEASURED' | 'ESTIMATED' | null
  barn: PenCode
  unitPrice: number
  /** Compatibility copy of the voucher pricing basis; rows cannot select their own basis. */
  pricing?: 'kg' | 'con'
  hist: {
    vaccine: string
    vaccineNote?: string
    vaccineId?: number
    vaccineName?: string
    vaccineDate?: string
    vaccineSource?: string
    vaccineItems?: Array<{ vaccineId?: number; vaccineName?: string; vaccineDate?: string; vaccineSource?: string }>
    disease: string
    diseaseNote?: string
    /** Backend stores one disease.description string (max 1,000 chars). */
    repro: string
    earlierCalvings?: number
    pregnantAtEntry?: string
    pregnancyMonths?: number
    reproductionNote?: string
  }
  [key: string]: unknown
}

export interface EntryCalf {
  name: string
  tag: string
  mother: string
  father: string
  damId?: number
  sireId?: number
  sireSource?: string
  externalSireName?: string
  semenBatch?: string
  sireBreed?: string
  born: string
  sex: string
  weight: number
  estimated: boolean
  purpose: string
  picked: boolean
  barn: string
  [key: string]: unknown
}

export interface EntryDetail {
  sourceName?: string
  quarantine?: string
  phone?: string
  plate?: string
  by?: string
  note?: string
  cows?: EntryCattleDetail[]
  cowsTotal?: number
  freight?: number
  payments?: EntryPayment[]
  docs?: EntryDocument[]
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
  plate?: string
  receiver?: string
  note?: string
  freight?: number
  paid?: number
  method?: string
  due?: string
  printQr?: boolean
  docs?: EntryDocument[]
  [key: string]: unknown
}

export interface HerdEntry {
  id: string
  backendId?: number
  version?: number
  sellerId?: number
  entryType?: 'PURCHASE' | 'FARM_BORN'
  pricingBasis?: 'PER_KG' | 'PER_HEAD'
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

export type EntryWeightBasis = 'MEASURED' | 'ESTIMATED'
export type EntrySexCode = 'MALE' | 'FEMALE'
export type EntryBirthAccuracy = 'EXACT' | 'ESTIMATED' | 'UNKNOWN'
export type EntryLineChanges = {
  entryDate?: string | null
  sellerId?: number | null
  quarantineCertNo?: string | null
  vehiclePlate?: string | null
  entryWeightKg?: number | null
  weightBasis?: EntryWeightBasis | null
  unitPrice?: number | null
  breedId?: number | null
  sex?: EntrySexCode | null
  birthDate?: string | null
  birthDateAccuracy?: EntryBirthAccuracy | null
}
export type EntryLineVoidInput = { reason: string; expectedVersion: number | undefined }
export type EntryLineCorrectionInput = EntryLineVoidInput & { voucherVersion: number | undefined; changes: EntryLineChanges }
export type EntryLineVoidCheck = {
  entryId?: number
  lineNo?: number
  cattleId?: number
  cattleCode: string
  eventsAfterEntry: string[]
  canVoid: boolean
  reason: string | null
}
export type EntryLineNotice = { code: string; params: Record<string, unknown>; message: string }
export type EntryLineCommandResult = { notice: EntryLineNotice | null; overpaidNotice: EntryLineNotice | null }
