// Tên trường bám DTO trong openapi (Measurement, Record, Correction); phần suy ra là của màn hình.
export type GrowthMethod = 'SCALE' | 'TAPE' | 'ESTIMATE'
export type GrowthBasis = 'MEASURED' | 'ESTIMATED'
export type GrowthRecordStatus = 'VALID' | 'EXCLUDED' | 'VOIDED'
export type HerdGroup = 'CALVES' | 'FATTENING' | 'BREEDING_BULLS' | 'BREEDING_FEMALES' | 'YOUNG_STOCK' | 'OTHER'
export type LifeStage = 'UNWEANED_CALF' | 'WEANED_CALF' | 'YOUNG_STOCK' | 'ADULT'
export type GrowthWindow = 30 | 90 | 180

export interface GrowthCattle {
  code: string
  name?: string
  earTag?: string
  breed: string
  sex: 'Đực' | 'Cái'
  penCode: string
  penName: string
  herdGroup: HerdGroup
  lifeStage: LifeStage
  herdEntryDate: string // yyyy-mm-dd
  targetWeightKg?: number
  status: 'ACTIVE' | 'EXITED'
}

export interface GrowthRevision {
  at: string
  by: string
  action: 'CORRECT' | 'EXCLUDE'
  reason: string
  before: { measuredAt: string; method?: GrowthMethod; weightKg?: number; bcs?: number }
}

export interface GrowthRecord {
  id: number
  cattleCode: string
  measuredAt: string // yyyy-mm-ddTHH:mm (giờ trại)
  recordedAt: string
  measuredBy: number
  measuredByName: string
  method?: GrowthMethod
  weightKg?: number
  basis?: GrowthBasis
  heartGirthCm?: number
  bodyLengthCm?: number
  bcs?: number
  note?: string
  status: GrowthRecordStatus
  corrected: boolean
  version: number
  revisions: GrowthRevision[]
}

export interface GrowthMember { id: number; name: string }

export interface RecordGrowthCommand {
  measuredAt: string
  measuredBy?: number
  measuredByName?: string
  method?: GrowthMethod
  weightKg?: number
  heartGirthCm?: number
  bodyLengthCm?: number
  bcs?: number
  note?: string
  acknowledgedLargeChange?: boolean
}

export interface CorrectGrowthCommand {
  action: 'CORRECT' | 'EXCLUDE'
  values?: Partial<Pick<RecordGrowthCommand, 'measuredAt' | 'method' | 'weightKg' | 'heartGirthCm' | 'bodyLengthCm' | 'bcs'>>
  reason: string
  expectedVersion: number
}

export interface GrowthFilters {
  q?: string
  penCode?: string
  herdGroup?: string
  lifeStage?: string
  windowDays?: GrowthWindow
  page?: number
  size?: number
  dir?: 'asc' | 'desc' // sắp xếp theo ngày cân
}

export type GrowthHerdStatus = 'OVERDUE' | 'LOW_ADG' | 'LOW_BCS' | 'NORMAL'

export interface GrowthHerdRow {
  code: string
  name?: string
  breed: string
  sex: string
  penCode: string
  penName: string
  latestWeightKg?: number
  latestBasis?: GrowthBasis
  weighedAt?: string
  adg?: number
  bcs?: number
  status: GrowthHerdStatus
}

export interface GrowthHerdPage {
  rows: GrowthHerdRow[]
  total: number
  page: number
  size: number
  activeCount: number
  windowDays: GrowthWindow
  tiles: { overdue: number; lowAdg: number; lowBcs: number; weighings30: number }
}

export interface GrowthProjection {
  state: 'PROJECTED' | 'REACHED' | 'INSUFFICIENT'
  targetKg: number
  missingKg: number
  adg60?: number
  days?: number
  projectedDate?: string
}

export interface GrowthChartPoint { at: string; kg: number; basis: GrowthBasis }

export interface GrowthProfile {
  cattle: GrowthCattle
  records: GrowthRecord[] // mới nhất trước, gồm bản ghi đã loại trừ
  rowAdg: Record<number, number | undefined>
  latest?: { kg: number; basis: GrowthBasis; at: string }
  adg90?: number
  latestBcs?: number
  count: number
  correctedCount: number
  nextWeighingDate?: string
  projection?: GrowthProjection
  chart: GrowthChartPoint[]
}

export interface GrowthFormOptions {
  cattle: GrowthCattle
  members: GrowthMember[]
  now: string
}

export interface GrowthFilterOptions {
  pens: Array<{ code: string; label: string }>
  herdGroups: Array<{ value: HerdGroup; label: string }>
  lifeStages: Array<{ value: LifeStage; label: string }>
}
