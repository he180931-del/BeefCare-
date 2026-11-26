import type { EntryDeclarationLine } from './domain/entryDeclarations'

export type CattleStatus = 'ACTIVE' | 'EXIT_PENDING' | 'EXITED' | 'VOIDED'

export type CattleCode = string
/** Serialized pen identifier; kept local to avoid a type dependency cycle with Pen Management. */
export type PenCode = string

export type Tone = 'ok' | 'err' | 'warn' | 'info' | 'grey'
export interface StatusChip { label: string; tone?: Tone }
export interface CattleEvent {
  id: string
  at: string
  cat: string
  title: string
  badge: StatusChip
  detail: string
  meta: string
  /** FE-16 record status; absent = VALID. REVISION is the original value of a corrected record (shown with "Hiện chỉnh sửa"). */
  status?: 'VALID' | 'CORRECTED' | 'EXCLUDED' | 'VOIDED' | 'REVISION'
  /** "Đã sửa" / "Đã loại" / "Đã hủy" tag (SCR-50 #6). */
  marker?: string
  /** Reason of a correction, exclusion or void. */
  reason?: string
  /** Basis tag: Đo / Ước tính / Lịch sử / Tại trại (SCR-50 #5). */
  basis?: string
  /** Profile tab that holds the source record (R-16-06); '' is the overview tab. */
  tab?: string
  /** Entry / exit voucher of the event when the viewer may open it (Technician gets none). */
  voucher?: { kind: 'entry' | 'exit'; code: string }
  /** Care / reproduction record that the source tab can correct or void (R-16-07). */
  correctable?: boolean
  /** True when canOpen / canCorrect came from the backend (A1), which already applied the viewer's role. */
  accessFromBackend?: boolean
  /** The viewer may not open the source record: "Xem chi tiết" answers MSG-FE16-01 (R-16-06). */
  openDenied?: boolean
  /** Id of the source record, passed to the source tab as ?r= to open its correction popup. */
  sourceId?: number
  sourceType?: string
  healthCaseId?: number
  revisionSource?: { version: number; occurredAt?: string | null; values: Record<string, unknown> }
}
export interface QrHistoryRow { code: string; status: string; from: string; to: string; reason: string; by: string; note?: string }
export interface BarnHistoryRow { from: string; to: string; barn: string; reason: string; warningReason?: string; by: string }
export type ImportRecordField = [key: string, label: string, current: string, next: string]
export interface ImportRecord { plan: string; date: string; by: string; onlyImportEvents?: boolean; fields: ImportRecordField[] }
export interface CattleCare {
  last: string
  adg: string
  bcs: string
  healthCase: string
  repro: string
  vaccine: StatusChip
  reminders: Array<{ title: string; due: { label: string; tone?: Tone } }>
}

export interface Cattle {
  code: CattleCode
  tag?: string
  name?: string
  breed?: string
  sex?: string
  barn: PenCode | null
  status: CattleStatus
  events?: CattleEvent[]
  entryVoucherId?: string
  entryLineNo?: number
  exitVoucherId?: string | null
  lastExitVoucherId?: string
  lastPen?: PenCode
  qrHistory?: QrHistoryRow[]
  barnHistory?: BarnHistoryRow[]
  withdrawalUntil?: string
  group?: string
  date?: string
  estimated?: boolean
  ageMonths?: number
  weight?: number | null
  weightEst?: boolean
  weightDate?: string
  ageShort?: string
  ageLong?: string
  months?: number
  purpose?: string
  purposeId?: number
  purposeSince?: string
  stage?: string
  /** dd/mm/yyyy effective date of the current life stage (SCR-19 #13). */
  stageSince?: string
  /** Backend enum kept separately from the translated display label. */
  lifeStage?: string
  herdGroup?: string
  exitPending?: boolean
  birthDateAccuracy?: string
  colourMarkings?: string
  notes?: string
  barnTag?: string
  barnSince?: string
  health?: StatusChip | null
  repro?: StatusChip | null
  headerBadges?: Array<[string, Tone]>
  headerAge?: boolean
  internalId?: string
  birth?: string
  source?: string
  mother?: string
  father?: string
  description?: string
  qr?: string
  qrFrom?: string
  qrFromWho?: string
  care?: CattleCare
  importRecord?: ImportRecord | null
  exitStatusLabel?: string
  /** EXITED only: exit type and date for MSG-COM-13. */
  exitTypeLabel?: string
  exitDateLabel?: string
  /** An OPEN health case carries the contagious flag (§3.2, SCR-19 #18). */
  suspectedContagious?: boolean
  expectedCalvingDate?: string
  expectedBasis?: string
  /** GBR-55; only set for females awaiting breeding, in estrus or post-calving. */
  breedingEligible?: boolean
  failedBreedingConditions?: string[]
  backendId?: number
  backendVersion?: number
  canUpdate?: boolean
  canChangePurpose?: boolean
  qrUnavailable?: boolean
  timelineUnavailable?: boolean
  inList?: boolean
  [key: string]: unknown
}
export interface CattleInput {
  code?: string
  barn?: PenCode | null
  tag?: string
  breed?: string
  sex?: string
  ageMonths?: number
  weight?: number | null
  estimated?: boolean
  purpose?: string
  stage?: string
  group?: string
  date?: string
  withdrawalUntil?: string
  [key: string]: unknown
}

/** Production-facing cattle view model. Demo seed data may satisfy this shape but does not own it. */
export type CattleViewModel = Cattle & {
  barn: string
  photoUrl?: string
  status: CattleStatus
  ageShort: string
  ageLong: string
  months: number
  purpose: string
  stage: string
  inList: boolean
  weight: number | null
  weightDate: string
  headerBadges: Array<[string, Tone]>
  qr: string
  qrHistory: NonNullable<Cattle['qrHistory']>
  barnHistory: NonNullable<Cattle['barnHistory']>
  events: NonNullable<Cattle['events']>
  care: CattleCare
  /** D82, SCR-19 #11: khai báo lịch sử trước nhập; không có khi bò sinh tại trại hoặc không có khai báo. */
  entryDeclarations?: EntryDeclarationLine[]
}
