// Tên trường bám DTO trong openapi (RecordVaccinations, DeferDose, CorrectVaccination, ...); phần suy ra là của màn hình.
export type HerdGroup = 'CALVES' | 'FATTENING' | 'BREEDING_BULLS' | 'BREEDING_FEMALES' | 'YOUNG_STOCK' | 'OTHER'
export type LifeStage = 'UNWEANED_CALF' | 'WEANED_CALF' | 'YOUNG_STOCK' | 'ADULT'
export type VaccineRoute = 'IM' | 'SC' | 'ORAL' | 'IN' | 'OTHER'
export type VaccinationSource = 'ON_FARM' | 'HISTORICAL'
export type DoseStatus = 'PLANNED' | 'DEFERRED' | 'DONE' | 'CANCELLED'
/** Trạng thái hiển thị suy ra từ ngày dự kiến (GBR-43). */
export type DueState = 'OVERDUE' | 'DUE' | 'UPCOMING' | 'DEFERRED' | 'DONE'
export type DoseTab = 'all' | 'overdue' | 'due' | 'upcoming' | 'deferred' | 'done'

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
  newExpectedDate?: string
  status: DoseStatus
  deferralReason?: string
  deferralNote?: string
  version: number
  vaccinationId?: number
  prior?: { status: DoseStatus; newExpectedDate?: string; deferralReason?: string }
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
  penName: string
  scheduleId: number
  scheduleName: string
  scheduleShort: string
  doseNo: number
  doseCount: number
  kind: 'DOSE' | 'BOOSTER'
  doseText: string
  dueDate: string
  effectiveDate: string
  newExpectedDate?: string
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

export interface DoseFilters { scheduleId?: number; tab?: DoseTab; page?: number; size?: number; dir?: 'asc' | 'desc' }
export interface DosePage { rows: DoseRow[]; total: number; page: number; size: number; counts: Record<DoseTab, number> }

export interface PlannedDoseRow { label: string; date: string; count: number; badge: string; tone: 'ok' | 'warn' | 'outline' }
export interface ScheduleDetail { schedule: Schedule; vaccine: VaccineItem; targetCount: number; plannedRows: PlannedDoseRow[] }

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
  decision: 'VACCINATE' | 'DEFER'
  deferralReason?: string
  newExpectedDate?: string
}
export interface RecordVaccinationsCommand {
  vaccineId?: number
  source: VaccinationSource
  administeredAt: string
  batchNo?: string
  dose?: string
  route?: VaccineRoute
  withdrawalDays?: number
  vaccinator?: string
  animals: VaccinationAnimal[]
}
export interface VaccinationBatchResult { vaccinatedCount: number; deferredCount: number; vaccinationIds: number[]; skipped: Array<{ cattleCode: string; message: string }>; message: string }

export interface DeferDoseCommand { expectedVersion: number; reason: string; newExpectedDate?: string; note?: string }
export interface CorrectVaccinationCommand {
  expectedVersion: number
  vaccineId?: number
  administeredAt: string
  batchNo?: string
  dose?: string
  route?: VaccineRoute
  withdrawalDays?: number
  vaccinator?: string
  reason: string
}
export interface VoidRecordCommand { expectedVersion: number; reason: string }

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
