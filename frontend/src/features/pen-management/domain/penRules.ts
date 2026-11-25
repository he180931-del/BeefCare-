import { businessDate } from '../../../shared/lib/date/farmTime'
import type { Pen } from '../types'

/** Enum values of the backend reception criteria (SRS §3.2 Pen Reception Criteria). */
export const PURPOSE_TYPES = ['BREEDING', 'FATTENING', 'SIRE', 'UNDECIDED'] as const
export const LIFE_STAGES = ['UNWEANED_CALF', 'WEANED_CALF', 'YOUNG_STOCK', 'ADULT'] as const
export const SEXES = ['MALE', 'FEMALE'] as const
export type PurposeType = typeof PURPOSE_TYPES[number]
export type LifeStage = typeof LIFE_STAGES[number]
export type CriteriaSex = typeof SEXES[number]

export const PEN_STATUS_LABELS: Record<Pen['status'], string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
}

export const PURPOSE_LABELS: Record<PurposeType, string> = {
  BREEDING: 'Sinh sản',
  FATTENING: 'Vỗ béo',
  SIRE: 'Đực giống',
  UNDECIDED: 'Chưa xác định',
}
export const STAGE_LABELS: Record<LifeStage, string> = {
  UNWEANED_CALF: 'Bê chưa cai sữa',
  WEANED_CALF: 'Bê đã cai sữa',
  YOUNG_STOCK: 'Bò tơ',
  ADULT: 'Trưởng thành',
}
export const SEX_LABELS: Record<CriteriaSex, string> = { MALE: 'Đực', FEMALE: 'Cái' }

/** Criterion types of the Create / Edit Pen popup; each type appears at most once (field 5). */
export const CRITERION_TYPES = ['PURPOSE_TYPE', 'LIFE_STAGE', 'SEX', 'MIN_AGE_MONTHS', 'MIN_WEIGHT_KG'] as const
export type CriterionType = typeof CRITERION_TYPES[number]
export const CRITERION_LABELS: Record<CriterionType, string> = {
  PURPOSE_TYPE: 'Loại mục đích',
  LIFE_STAGE: 'Giai đoạn',
  SEX: 'Giới tính',
  MIN_AGE_MONTHS: 'Tuổi tối thiểu (tháng)',
  MIN_WEIGHT_KG: 'Cân tối thiểu (kg)',
}

export type ReceptionCriteria = {
  purposeTypes?: string[]
  lifeStages?: string[]
  sex?: string
  minAgeMonths?: number | null
  minWeightKg?: number | null
}

/** Legacy local-demo labels of the pen seed, mapped to the backend enums. */
const LEGACY_PURPOSE: Record<string, PurposeType> = {
  'Sinh sản': 'BREEDING', 'Nuôi thương phẩm': 'FATTENING', 'Vỗ béo': 'FATTENING', 'Đực giống': 'SIRE', 'Chưa xác định': 'UNDECIDED',
}
const LEGACY_STAGE: Record<string, LifeStage> = {
  'Bê': 'UNWEANED_CALF', 'Bê theo mẹ': 'UNWEANED_CALF', 'Bê chưa cai sữa': 'UNWEANED_CALF', 'Bê cai sữa': 'WEANED_CALF',
  'Bê đã cai sữa': 'WEANED_CALF', 'Bò tơ': 'YOUNG_STOCK', 'Bò cái sinh sản': 'ADULT', 'Bò chửa': 'ADULT',
  'Bò chửa cận đẻ': 'ADULT', 'Vỗ béo': 'ADULT', 'Đực giống': 'ADULT', 'Bò trưởng thành': 'ADULT', 'Trưởng thành': 'ADULT',
}

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === 'string' && (list as readonly string[]).includes(value)

/** Canonical criteria of a pen: the backend value when present, else derived from the local-demo labels. */
export function criteriaOf(pen: Pen): ReceptionCriteria {
  if (pen.receptionCriteria) return pen.receptionCriteria
  const purpose = pen.purpose ? LEGACY_PURPOSE[pen.purpose] : undefined
  const stage = pen.stage ? LEGACY_STAGE[pen.stage] : undefined
  const sex = pen.sex === 'Đực' ? 'MALE' : pen.sex === 'Cái' ? 'FEMALE' : undefined
  return {
    purposeTypes: purpose ? [purpose] : [],
    lifeStages: stage ? [stage] : [],
    sex,
    minAgeMonths: pen.minAge ?? null,
    minWeightKg: pen.minWeight == null || pen.minWeight === 0 ? null : pen.minWeight,
  }
}

/** One row per criterion that is set: [criterion label, value text]. Empty list = accepts every cattle. */
export function criteriaRows(c: ReceptionCriteria): Array<[string, string]> {
  const rows: Array<[string, string]> = []
  const purposes = (c.purposeTypes ?? []).filter((v) => isOneOf(PURPOSE_TYPES, v)) as PurposeType[]
  const stages = (c.lifeStages ?? []).filter((v) => isOneOf(LIFE_STAGES, v)) as LifeStage[]
  if (purposes.length) rows.push([CRITERION_LABELS.PURPOSE_TYPE, purposes.map((v) => PURPOSE_LABELS[v]).join(', ')])
  if (stages.length) rows.push([CRITERION_LABELS.LIFE_STAGE, stages.map((v) => STAGE_LABELS[v]).join(', ')])
  if (isOneOf(SEXES, c.sex)) rows.push([CRITERION_LABELS.SEX, SEX_LABELS[c.sex]])
  if (c.minAgeMonths != null) rows.push([CRITERION_LABELS.MIN_AGE_MONTHS, `≥ ${c.minAgeMonths} tháng`])
  if (c.minWeightKg != null) rows.push([CRITERION_LABELS.MIN_WEIGHT_KG, `≥ ${c.minWeightKg} kg`])
  return rows
}

/** SCR-17 column "Accepts": purposes and stages accepted, "Tất cả" when the pen has no criterion. */
export function acceptsSummary(c: ReceptionCriteria): string {
  const rows = criteriaRows(c)
  if (rows.length === 0) return 'Tất cả'
  const main = rows.filter(([label]) => label === CRITERION_LABELS.PURPOSE_TYPE || label === CRITERION_LABELS.LIFE_STAGE).map(([, value]) => value)
  return (main.length ? main : rows.map(([, value]) => value)).join(' · ')
}

/** SCR-17 header: "n chuồng · used/total chỗ"; places count ACTIVE pens only (TC-04-25). */
export function headerSummary(pens: Pen[]): { penCount: number; used: number; total: number } {
  const active = pens.filter((p) => p.status === 'ACTIVE')
  return {
    penCount: pens.length,
    used: active.reduce((sum, p) => sum + p.count, 0),
    total: active.reduce((sum, p) => sum + p.capacity, 0),
  }
}

/** Today in the browser's local time, as yyyy-mm-dd. */
export const todayIso = businessDate
export const dmy = (iso: string | null | undefined): string => (iso ? iso.split('-').reverse().join('/') : '—')

export const PEN_CODE_PATTERN = /^[A-Za-z0-9-]{1,20}$/
export type PenFormValues = {
  code: string
  name: string
  capacity: string
  description: string
  criteria: Partial<Record<CriterionType, string[] | string>>
}
export type PenFormErrors = Partial<Record<'code' | 'name' | 'capacity' | 'description' | CriterionType, string>>

/** Criteria of the form as the backend payload; absent types mean "not set" (no criterion = accepts every cattle). */
export function criteriaFromForm(criteria: PenFormValues['criteria']): ReceptionCriteria {
  const list = (value: string[] | string | undefined) => (Array.isArray(value) ? value : value ? [value] : [])
  return {
    purposeTypes: list(criteria.PURPOSE_TYPE).filter((v) => isOneOf(PURPOSE_TYPES, v)),
    lifeStages: list(criteria.LIFE_STAGE).filter((v) => isOneOf(LIFE_STAGES, v)),
    ...(isOneOf(SEXES, list(criteria.SEX)[0]) ? { sex: list(criteria.SEX)[0] } : {}),
    minAgeMonths: typeof criteria.MIN_AGE_MONTHS === 'string' && criteria.MIN_AGE_MONTHS.trim() ? Number(criteria.MIN_AGE_MONTHS) : null,
    minWeightKg: typeof criteria.MIN_WEIGHT_KG === 'string' && criteria.MIN_WEIGHT_KG.trim() ? Number(criteria.MIN_WEIGHT_KG) : null,
  }
}

/** Criteria of a pen as editable form rows. */
export function formFromCriteria(c: ReceptionCriteria): PenFormValues['criteria'] {
  const form: PenFormValues['criteria'] = {}
  if (c.purposeTypes?.length) form.PURPOSE_TYPE = [...c.purposeTypes]
  if (c.lifeStages?.length) form.LIFE_STAGE = [...c.lifeStages]
  if (c.sex) form.SEX = c.sex
  if (c.minAgeMonths != null) form.MIN_AGE_MONTHS = String(c.minAgeMonths)
  if (c.minWeightKg != null) form.MIN_WEIGHT_KG = String(c.minWeightKg)
  return form
}

export type AvailabilityErrors = Partial<Record<'date' | 'reason', string>>

/** Situation hints of a cattle in the pen detail (backend PenCattleDTO.hints) as short Vietnamese text. */
export function situationText(hints: Array<{ code?: string; params?: Record<string, unknown> }>, exitPending = false): string {
  const parts: string[] = []
  for (const hint of hints) {
    if (hint.code === 'PREGNANT') {
      const due = typeof hint.params?.expectedCalvingDate === 'string' ? hint.params.expectedCalvingDate : null
      parts.push(due ? `Mang thai · dự sinh ${dmy(due)}` : 'Mang thai')
    } else if (hint.code === 'EXIT_PENDING') parts.push('Đang chờ xuất đàn')
    else if (hint.code === 'PEN_MOVE_SUGGESTED') parts.push('Gợi ý chuyển chuồng')
  }
  if (exitPending && !parts.includes('Đang chờ xuất đàn')) parts.push('Đang chờ xuất đàn')
  return parts.join(' · ') || '—'
}
