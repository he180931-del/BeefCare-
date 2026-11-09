export type CattleStatus = 'ACTIVE' | 'EXIT_PENDING' | 'EXITED' | 'VOIDED'
export type PenStatus = 'ACTIVE' | 'INACTIVE'
export type EntryStatus = 'Nháp' | 'Đã nhập' | 'Đã hủy'
export type ExitStatus = 'Nháp' | 'Chờ xác nhận' | 'Đã xuất' | 'Đã hủy' | 'Đã bác'
export type EntryType = 'Mua ngoài' | 'Bê sinh tại trại'
export type ExitType = 'Bán' | 'Chết / mất' | 'Loại thải' | 'Khác'
export type CattleCode = string
export type PenCode = string

export type PenCowLink = [CattleCode, string]

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
}
export interface QrHistoryRow { code: string; status: string; from: string; to: string; reason: string; by: string; note?: string }
export interface BarnHistoryRow { from: string; to: string; barn: string; reason: string; by: string }
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

export interface Pen {
  id?: number
  code: PenCode
  name: string
  count: number
  capacity: number
  status: PenStatus
  cows: PenCowLink[]
  accept?: string
  purpose?: string
  stage?: string
  minAge?: number | null
  minAgeOp?: string
  minWeight?: number | null
  minWeightOp?: string
  minMonths?: number
  minKg?: number
  sex?: string
  tag?: string
  version?: string
  /** Backend optimistic-lock version of the pen (sent back as expectedVersion). */
  lockVersion?: number
  /** Current reception-criteria version (SCR-17 field 12). */
  criteriaVersionNo?: number
  criteriaEffectiveFrom?: string
  desc?: string
  /** Reception constraints returned by the backend pen catalogue. */
  receptionCriteria?: {
    purposeTypes?: string[]
    lifeStages?: string[]
    sex?: string
    minAgeMonths?: number | null
    minWeightKg?: number | null
  }
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
  hist?: { vaccine: string; vaccineNote?: string; vaccineName?: string; vaccineDate?: string; vaccineSource?: string; disease: string; diseaseNote?: string; repro: string; pregnantAtEntry?: string; pregnancyMonths?: number }
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
  /** Backend weight-basis selection; null means the user has not selected a weighing basis yet. */
  weightBasis?: 'MEASURED' | 'ESTIMATED' | null
  barn: PenCode
  unitPrice: number
  /** Pricing basis selected for this cattle line. Backend currently stores voucher-level basis. */
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
  plate?: string
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
