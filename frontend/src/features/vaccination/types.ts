// Tên trường bám DTO trong openapi (RecordVaccinations, CorrectVaccination, ...); phần suy ra là của màn hình.
export type HerdGroup = 'CALVES' | 'FATTENING' | 'BREEDING_BULLS' | 'BREEDING_FEMALES' | 'YOUNG_STOCK' | 'OTHER'
export type LifeStage = 'UNWEANED_CALF' | 'WEANED_CALF' | 'YOUNG_STOCK' | 'ADULT'
export type VaccineRoute = 'IM' | 'SC' | 'ORAL' | 'IN' | 'OTHER'
export type VaccinationSource = 'ON_FARM' | 'HISTORICAL'
/** Trạng thái mũi theo lịch: chờ tiêm, đã tiêm, đã hủy. Không còn hoãn (D46). */
export type DoseStatus = 'PLANNED' | 'DONE' | 'CANCELLED'
/** Trạng thái hiển thị suy ra từ hạn tiêm và số ngày nhắc của trại (GBR-43). */
export type DueState = 'OVERDUE' | 'DUE' | 'UPCOMING' | 'DONE'
/** Tab danh sách mũi (D46): bỏ tab Sắp tới và Đã hoãn. */
export type DoseTab = 'all' | 'overdue' | 'due' | 'done'

export interface VaccineItem {
  id: number
  name: string
  shortName: string
  disease: string
  referenceDose: number
  doseUnit: string
  route: VaccineRoute
  withdrawalDays: number
  active: boolean
}

export interface VaccCattle {
  code: string
  name?: string
  breed: string
  sex: 'Đực' | 'Cái'
  penCode: string
  penName: string
  herdGroup: HerdGroup
  lifeStage: LifeStage
  herdEntryDate: string
  status: 'ACTIVE' | 'EXITED'
}

export interface ScheduleTarget {
  penCodes: string[]
  herdGroups: HerdGroup[]
  lifeStages: LifeStage[]
  excluded: string[]
  added: string[]
}

export interface Schedule {
  id: number
  name: string
  vaccineId: number
  firstDueDate: string
  doseCount: number
  intervalDays?: number
  boosterIntervalMonths?: number
  status: 'ACTIVE' | 'STOPPED'
  /** Lịch đang chạy nhưng không còn mũi chờ tiêm: bị khóa, chỉ xem (D46). */
  completed: boolean
  version: number
  target: ScheduleTarget
  stopReason?: string
}

export interface ScheduledDose {
  id: number
  scheduleId: number
  cattleCode: string
  doseNo: number
  kind: 'DOSE' | 'BOOSTER'
  dueDate: string
  status: DoseStatus
  version: number
  vaccinationId?: number
  doneAt?: string
}

export interface VaccinationRevision {
  at: string
  by: string
  action: 'CORRECT' | 'VOID'
  reason: string
  before: { vaccineId: number; administeredAt: string; batchNo?: string; dose?: string; route?: VaccineRoute; withdrawalDays: number; vaccinator?: string }
}

export interface VaccinationRecord {
  id: number
  cattleCode: string
  vaccineId?: number
  vaccineLabel: string
  doseText?: string
  scheduledDoseId?: number
  spawnedDoseId?: number
  batchNo?: string
  dose?: string
  route?: VaccineRoute
  /** Mô tả đường tiêm khi route = OTHER (D45), ví dụ "Tiêm tĩnh mạch". */
  routeText?: string
  administeredAt: string // yyyy-mm-ddTHH:mm
  precision: 'EXACT' | 'MONTH'
  source: VaccinationSource
  vaccinator?: string
  withdrawalDays: number
  withdrawalEndDate?: string
  reactionCaseCode?: string
  reactionNote?: string
  status: 'VALID' | 'VOIDED'
  corrected: boolean
  version: number
  revisions: VaccinationRevision[]
}

export interface DoseRow {
  id: number
  cattleCode: string
  cattleName?: string
  breed: string
  sex: string
  penCode: string
  penName: string
  herdGroup: HerdGroup
  scheduleId: number
  /** Vắc-xin của lịch: một lần ghi theo lô chỉ dùng một vắc-xin (D47). */
  vaccineId: number
  scheduleName: string
  scheduleShort: string
  doseNo: number
  doseCount: number
  kind: 'DOSE' | 'BOOSTER'
  doseText: string
  dueDate: string
  state: DueState
  daysOverdue: number
  rawStatus: DoseStatus
  doneAt?: string
  version: number
}

export interface ScheduleCard {
  schedule: Schedule
  vaccine: VaccineItem
  targetCount: number
  doneCount: number
  overdueCount: number
}

/** D47: lọc như màn chọn bò vào phiếu – tìm theo mã / tên bò, chuồng, nhóm đàn. */
export interface DoseFilters { scheduleId?: number; tab?: DoseTab; q?: string; penCode?: string; herdGroup?: HerdGroup; page?: number; size?: number; dir?: 'asc' | 'desc' }
/** {@code leadDays}: số ngày nhắc trước của trại (tham số VACCINATION_LEAD_DAYS) – tab "Đến hạn trong N ngày". */
/** {@code selectable}: mọi mũi chưa tiêm khớp bộ lọc (mọi trang) kèm vắc-xin – dùng cho "Chọn tất cả" (D47). */
export interface DosePage { rows: DoseRow[]; total: number; page: number; size: number; counts: Record<DoseTab, number>; leadDays: number; selectable: Array<{ id: number; vaccineId: number }> }

export interface PlannedDoseRow { label: string; date: string; count: number; badge: string; tone: 'ok' | 'warn' | 'outline' }
/** {@code hasDoneDoses}: lịch đã có mũi được tiêm – khóa vắc-xin, ngày tiêm, khoảng cách giữa mũi (D46). */
export interface ScheduleDetail { schedule: Schedule; vaccine: VaccineItem; targetCount: number; plannedRows: PlannedDoseRow[]; hasDoneDoses: boolean }

export interface ScheduleCommand {
  name: string
  vaccineId?: number
  firstDueDate: string
  doseCount?: number
  intervalDays?: number
  boosterIntervalMonths?: number
  target: ScheduleTarget
  expectedVersion?: number
}
export interface ScheduleResult { schedule: Schedule; targetCount: number; plannedDoseCount: number; message: string }

export interface VaccinationAnimal {
  cattleCode: string
  scheduledDoseId?: number
  expectedDoseVersion?: number
}
export interface RecordVaccinationsCommand {
  vaccineId?: number
  source: VaccinationSource
  administeredAt: string
  dose?: string
  route?: VaccineRoute
  /** Bắt buộc khi route = OTHER (D45). */
  routeOther?: string
  withdrawalDays?: number
  vaccinator?: string
  animals: VaccinationAnimal[]
}
export interface VaccinationBatchResult { vaccinatedCount: number; vaccinationIds: number[]; skipped: Array<{ cattleCode: string; message: string }>; message: string }

export interface CorrectVaccinationCommand {
  expectedVersion: number
  vaccineId?: number
  administeredAt: string
  dose?: string
  route?: VaccineRoute
  /** Bắt buộc khi route = OTHER (D45). */
  routeOther?: string
  withdrawalDays?: number
  vaccinator?: string
  /** Ghi chú lần sửa, không bắt buộc, tối đa 500 ký tự (D53). Trường API vẫn là {@code reason}. */
  note?: string
}
/** Xóa bản ghi tiêm chỉ cần xác nhận, không có lý do (D53). */
export interface VoidRecordCommand { expectedVersion: number }

export interface HistoryFilters { q?: string; vaccineId?: number; source?: VaccinationSource; from?: string; to?: string; page?: number; size?: number }
export interface HistoryRow extends VaccinationRecord { penCode: string }
export interface HistoryPage { rows: HistoryRow[]; total: number; page: number; size: number; from: string; to: string }

export interface CattleVaccination { cattle: VaccCattle; doses: DoseRow[]; records: VaccinationRecord[] }

export interface RecordContextRow { cattle: VaccCattle; dose?: DoseRow }
export interface VaccinationOptions {
  vaccines: VaccineItem[]
  members: Array<{ id: number; name: string }>
  pens: Array<{ code: string; label: string }>
  herdGroups: Array<{ value: HerdGroup; label: string }>
  lifeStages: Array<{ value: LifeStage; label: string }>
  now: string
}
export interface RecordContext { rows: RecordContextRow[]; options: VaccinationOptions; title: string; vaccineId?: number }
