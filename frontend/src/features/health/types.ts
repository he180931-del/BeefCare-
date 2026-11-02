// Tên trường bám theo DTO trong openapi (HealthCaseRow, HealthProfile, TreatmentCommand...).
// Chỗ khác DTO được ghi chú tại trường đó.

export type CaseStatus = 'OPEN' | 'CHRONIC' | 'CLOSED'
export type CaseOutcome = 'RECOVERED' | 'DIED' | 'MISSING' | 'CLOSED_BY_EXIT'
export type Severity = 'MILD' | 'MODERATE' | 'SEVERE'
export type Progress = 'IMPROVED' | 'UNCHANGED' | 'WORSENED'
export type TreatmentRoute = 'INTRAMUSCULAR' | 'SUBCUTANEOUS' | 'INTRAVENOUS' | 'ORAL' | 'TOPICAL' | 'OTHER'
export type HealthState = 'HEALTHY' | 'MONITORING' | 'UNDER_TREATMENT'
/** OPENING = quan sát mở ca; OBSERVATION = quan sát bất thường nối vào ca đang có; FOLLOW_UP = lần theo dõi. */
export type EntryType = 'OPENING' | 'OBSERVATION' | 'FOLLOW_UP' | 'TREATMENT'
export type RecordStatus = 'VALID' | 'VOIDED'
export type CaseTab = 'open' | 'chronic' | 'closed' | 'all'
export type StatusAction = 'KEEP' | 'TO_CHRONIC' | 'TO_OPEN' | 'CLOSE'

export interface HealthCattle {
  code: string
  name: string
  earTag: string
  breed: string
  sex: string
  ageText: string
  stage: string
  penCode: string
  penName: string
  /** yyyy-mm-dd */
  entryDate: string
  status: 'ACTIVE' | 'EXITED'
  exitDate?: string
  exitType?: string
}

export interface Medicine {
  id: number
  name: string
  active: boolean
  /** Liều tham chiếu đề xuất ("30 ml"), ghi chú tham chiếu ("1 ml / 10 kg"), đường dùng và số ngày ngưng đề xuất. */
  defaultDose: string
  doseNote: string
  route: TreatmentRoute
  withdrawalDays: number
}

export interface PendingExit {
  id: number
  cattleCode: string
  caseCode: string
  /** DEATH, hoặc OTHER với lý do "Mất tích" (UC-FE10-03 AF4). */
  type: 'DEATH' | 'OTHER'
  reason: string
  date: string
  reportedBy: string
  status: 'PENDING'
}

export interface HealthCaseRow {
  id: number
  caseCode: string
  cattleCode: string
  cattleName: string
  breed: string
  sex: string
  penCode: string
  penName: string
  diagnosis: string
  signs: string
  suspectedContagious: boolean
  severity: Severity
  /** yyyy-mm-dd; openedAt là yyyy-mm-ddThh:mm */
  openedDate: string
  openedAt: string
  status: CaseStatus
  chronicSince?: string
  outcome?: CaseOutcome
  treatmentCount: number
  /** Số ngày mở (ngày 1 = ngày mở ca). */
  day: number
  version: number
}

export interface HealthCaseCard {
  id: number
  caseCode: string
  status: CaseStatus
  severity: Severity
  diagnosis: string
  signs: string
  openingSigns: string
  suspectedContagious: boolean
  openedAt: string
  openedDate: string
  chronicSince?: string
  outcome?: CaseOutcome
  closedAt?: string
  treatmentCount: number
  day: number
  /** Ngày hết ngưng sử dụng thịt lớn nhất trong các điều trị hợp lệ của ca. */
  withdrawalEndDate: string | null
  /** Thời điểm của lần ghi hợp lệ gần nhất (mốc tối thiểu khi đóng ca). */
  latestEntryAt: string
  version: number
}

export interface HealthTimelineRow {
  id: number
  caseId: number
  caseCode: string
  type: EntryType
  occurredAt: string
  /** Dòng mô tả đã dựng sẵn để hiển thị. */
  details: string
  recordedBy: string
  status: RecordStatus
  corrected: boolean
  linkedVaccinationId?: number
  version: number
  temperatureC: number | null
  progress?: Progress
  description?: string
  medicineId?: number
  medicineName?: string
  dose?: string
  route?: TreatmentRoute
  courseDays?: number
  withdrawalDays?: number
  veterinaryAdvice?: string
  withdrawalEndDate?: string
}

export interface HealthProfile {
  cattle: HealthCattle
  healthState: HealthState
  withdrawalEndDate: string | null
  suspectedContagious: boolean
  pendingExit: PendingExit | null
  activeCases: HealthCaseCard[]
  previousCases: HealthCaseCard[]
  timeline: HealthTimelineRow[]
}

export interface HealthCaseCounts { open: number; chronic: number; closed: number; all: number }
export interface HealthCaseList {
  rows: HealthCaseRow[]
  counts: HealthCaseCounts
  pens: Array<{ code: string; name: string }>
}

export interface HealthCaseFilters {
  tab?: CaseTab
  search?: string
  severity?: Severity | ''
  penCode?: string
  /** Kỳ mở ca (yyyy-mm-dd); chỉ lọc ca đã đóng, ca đang mở và mạn tính luôn hiện. */
  from?: string
  to?: string
  sort?: 'openedAt' | 'caseCode'
  dir?: 'asc' | 'desc'
}

export interface OpenCaseCommand {
  existingCaseId?: number
  expectedVersion?: number
  observedAt: string
  /** Khác DTO: tên người quan sát thay vì observerId (danh sách thành viên chưa có API). */
  observer: string
  temperatureC: number | null
  signs: string
  diagnosis: string
  suspectedContagious: boolean
  severity: Severity | ''
}

export interface FollowUpCommand {
  expectedVersion?: number
  observedAt: string
  temperatureC: number | null
  progress: Progress | ''
  description: string
  observer?: string
}

export interface TreatmentCommand {
  expectedVersion?: number
  medicineId: number | null
  treatmentTime: string
  dose: string
  route: TreatmentRoute | ''
  courseDays: number | null
  withdrawalDays: number | null
  performer: string
  veterinaryAdvice: string
}

export interface StatusCommand {
  expectedVersion?: number
  action: StatusAction
  /** Diễn biến mới, lưu thành một lần theo dõi khi có nội dung. */
  progressText: string
  diagnosis: string
  suspectedContagious: boolean
  outcome?: CaseOutcome | ''
  /** Khác DTO (closingDate): có cả giờ. */
  closedAt?: string
  confirmedBy: string
}

export interface CorrectEntryCommand {
  expectedVersion?: number
  reason: string
  observedAt?: string
  temperatureC?: number | null
  progress?: Progress | ''
  description?: string
  observer?: string
  medicineId?: number | null
  treatmentTime?: string
  dose?: string
  route?: TreatmentRoute | ''
  courseDays?: number | null
  withdrawalDays?: number | null
  performer?: string
}

export interface VoidEntryCommand { expectedVersion?: number; reason: string }

export type CaseResultKind = 'OPENED' | 'ADDED' | 'FOLLOWED' | 'KEPT' | 'CHRONIC' | 'REOPENED' | 'CLOSED'
export interface HealthCaseResult {
  id: number
  caseCode: string
  cattleCode: string
  status: CaseStatus
  version: number
  observationId: number | null
  healthState: HealthState
  kind: CaseResultKind
  outcome?: CaseOutcome
  /** Phiếu xuất "Chết / mất" chờ Chủ trại, tạo khi đóng ca Chết hoặc Mất tích. */
  deathVoucher: PendingExit | null
}

export interface TreatmentResult {
  id: number
  caseId: number
  caseCode: string
  caseVersion: number
  caseStatus: CaseStatus
  withdrawalEndDate: string
  courseDays: number
  medicineName: string
  healthState: HealthState
  returnedToOpen: boolean
}

export interface RecordResult {
  id: number
  status: RecordStatus
  version: number
  healthState: HealthState
  action: 'CORRECTED' | 'VOIDED'
  recordType: 'TREATMENT' | 'FOLLOW_UP'
  cattleCode: string
  withdrawalBefore: string | null
  withdrawalAfter: string | null
}

export interface HealthFormOptions {
  medicines: Medicine[]
  members: string[]
  diagnoses: string[]
}
