import { seedPens } from '../../../data/pensData'
import { createCollection } from '../../../api/client'
import { migrateHerdStorage } from '../../../api/storageMigrations'
import { penSchema } from '../../../api/collectionSchemas'
import { backendFarmId, backendMode, backendTransport, asRecord, asRows, numberValue, textValue } from '../../../api/backendTransport'
import type { Pen } from '../../../types'

// Backend mode is authoritative for pen management. Do not initialize the
// local collection (which reads/writes localStorage) when the real API is on.
const pens = backendMode === 'backend' ? null : (() => {
  migrateHerdStorage()
  return createCollection<Pen, 'code'>('pens', seedPens, { schema: penSchema })
})()

const normalize = (pen: Pen): Pen => ({
  ...pen,
  minMonths: pen.minAge ?? 0,
  minKg: pen.minWeight ?? 0,
  tag: pen.accept ?? pen.stage ?? pen.name,
})

type BackendPen = {
  id?: number; code?: string; name?: string; capacity?: number; description?: string
  status?: string; headcount?: number; acceptsSummary?: string; version?: number
  currentCriteria?: {
    purposeTypes?: string[]; lifeStages?: string[]; sex?: string; minAgeMonths?: number; minWeightKg?: number
    criteria?: { purposeTypes?: string[]; lifeStages?: string[]; sex?: string; minAgeMonths?: number; minWeightKg?: number } | null
  } | null
}

// The backend contract stores enums, while the pen screens intentionally show
// Vietnamese labels. Never send those labels back to Jackson: a label such as
// "Sinh sản" is not a valid PurposeType and results in a 400 before the
// controller can run its normal validation.
const PURPOSE_LABELS: Record<string, string> = {
  BREEDING: 'Sinh sản',
  FATTENING: 'Vỗ béo',
  SIRE: 'Đực giống',
  UNDECIDED: 'Chưa xác định',
}
const STAGE_LABELS: Record<string, string> = {
  UNWEANED_CALF: 'Bê theo mẹ',
  WEANED_CALF: 'Bê cai sữa',
  YOUNG_STOCK: 'Bò tơ',
  ADULT: 'Bò trưởng thành',
}
const SEX_LABELS: Record<string, string> = {
  MALE: 'Đực',
  FEMALE: 'Cái',
  BOTH: 'Cả hai',
}
const PURPOSE_CODES: Record<string, string> = {
  'Sinh sản': 'BREEDING',
  'Nuôi thương phẩm': 'FATTENING',
  'Vỗ béo': 'FATTENING',
  'Đực giống': 'SIRE',
  'Chưa xác định': 'UNDECIDED',
}
const STAGE_CODES: Record<string, string> = {
  'Bê': 'UNWEANED_CALF',
  'Bê theo mẹ': 'UNWEANED_CALF',
  'Bê cai sữa': 'WEANED_CALF',
  'Bò tơ': 'YOUNG_STOCK',
  'Bò cái sinh sản': 'ADULT',
  'Bò chửa': 'ADULT',
  'Bò chửa cận đẻ': 'ADULT',
  'Vỗ béo': 'ADULT',
  'Đực giống': 'ADULT',
  'Bò trưởng thành': 'ADULT',
}

/**
 * The list endpoint also exposes acceptsSummary for compact table rendering.
 * Older backend responses may omit currentCriteria on the list DTO, so keep
 * the summary as a lossless fallback instead of showing raw enum names.
 */
const criteriaFromSummary = (summary: string) => {
  const tokens = summary.split('|').map((token) => token.trim()).filter(Boolean)
  const purposeTypes = tokens.filter((token) => Object.prototype.hasOwnProperty.call(PURPOSE_LABELS, token))
  const lifeStages = tokens.filter((token) => Object.prototype.hasOwnProperty.call(STAGE_LABELS, token))
  const sex = tokens.find((token) => Object.prototype.hasOwnProperty.call(SEX_LABELS, token))
  const age = summary.match(/age\s*>=\s*(\d+)\s*months?/i)
  const weight = summary.match(/weight\s*>=\s*([\d.]+)\s*kg/i)
  return {
    purposeTypes,
    lifeStages,
    sex,
    minAgeMonths: age ? Number(age[1]) : undefined,
    minWeightKg: weight ? Number(weight[1]) : undefined,
  }
}

export const mapBackendPen = (value: unknown): Pen => {
  const row = value as BackendPen
  // PenDTO.currentCriteria is a version envelope; actual constraints live
  // under `currentCriteria.criteria`. Accept the flat shape too for older
  // fixtures, but never silently drop the nested backend values.
  const nestedCriteria = row.currentCriteria?.criteria ?? row.currentCriteria ?? {}
  const summaryCriteria = criteriaFromSummary(textValue(row.acceptsSummary))
  const criteria = {
    purposeTypes: nestedCriteria.purposeTypes?.length ? nestedCriteria.purposeTypes : summaryCriteria.purposeTypes,
    lifeStages: nestedCriteria.lifeStages?.length ? nestedCriteria.lifeStages : summaryCriteria.lifeStages,
    sex: nestedCriteria.sex ?? summaryCriteria.sex,
    minAgeMonths: nestedCriteria.minAgeMonths ?? summaryCriteria.minAgeMonths,
    minWeightKg: nestedCriteria.minWeightKg ?? summaryCriteria.minWeightKg,
  }
  const mappedPurpose = criteria.purposeTypes?.map((value) => PURPOSE_LABELS[value] ?? value).join(', ') ?? ''
  const mappedStage = criteria.lifeStages?.map((value) => STAGE_LABELS[value] ?? value).join(', ') ?? ''
  const mappedSex = SEX_LABELS[textValue(criteria.sex)] ?? textValue(criteria.sex)
  const mappedThresholds = [
    criteria.minAgeMonths == null ? '' : `tuổi ≥ ${criteria.minAgeMonths} tháng`,
    criteria.minWeightKg == null ? '' : `cân ≥ ${criteria.minWeightKg} kg`,
  ].filter(Boolean).join(' · ')
  const mappedAccept = [mappedPurpose, mappedStage, mappedSex, mappedThresholds].filter(Boolean).join(' | ')
  return {
    id: numberValue(row.id), code: textValue(row.code), name: textValue(row.name, textValue(row.code)),
    count: numberValue(row.headcount), capacity: numberValue(row.capacity),
    status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', cows: [],
    accept: mappedAccept || (textValue(row.acceptsSummary) === 'All' ? 'Mọi mục đích' : ''), purpose: mappedPurpose,
    stage: mappedStage, minAge: criteria.minAgeMonths ?? null,
    minWeight: criteria.minWeightKg ?? null, minAgeOp: criteria.minAgeMonths == null ? undefined : '≥',
    minMonths: criteria.minAgeMonths ?? 0, minWeightOp: criteria.minWeightKg == null ? undefined : '≥',
    minKg: criteria.minWeightKg ?? 0, sex: mappedSex, desc: textValue(row.description),
    version: row.version == null ? undefined : `v${row.version}`,
  }
}

const criteriaPayload = (pen: Pen) => ({
  purposeTypes: pen.purpose && !['Mọi mục đích', '—'].includes(pen.purpose)
    ? [PURPOSE_CODES[pen.purpose] ?? pen.purpose].filter((value) => ['BREEDING', 'FATTENING', 'SIRE', 'UNDECIDED'].includes(value))
    : [],
  lifeStages: pen.stage && !['Mọi giai đoạn', '—'].includes(pen.stage)
    ? [STAGE_CODES[pen.stage] ?? pen.stage].filter((value) => ['UNWEANED_CALF', 'WEANED_CALF', 'YOUNG_STOCK', 'ADULT'].includes(value))
    : [],
  ...(pen.sex && !['Cả hai', ''].includes(pen.sex) ? { sex: pen.sex === 'Đực' ? 'MALE' : 'FEMALE' } : {}),
  minAgeMonths: pen.minAge ?? null,
  minWeightKg: pen.minWeight ?? null,
})

const backendApi = {
  list: async (): Promise<Pen[]> => {
    const response = await backendTransport.get(backendTransport.farmPath(backendFarmId, '/pens'))
    const body = asRecord(response)
    return (Array.isArray(response) ? asRows(response) : asRows(body.pens)).map(mapBackendPen)
  },
  create: async (pen: Pen): Promise<Pen> => mapBackendPen(await backendTransport.command(backendTransport.farmPath(backendFarmId, '/pens'), {
    code: pen.code, name: pen.name, capacity: pen.capacity, description: pen.desc ?? '', criteria: criteriaPayload(pen), initialStatus: pen.status,
  })),
  update: async (pen: Pen): Promise<Pen> => {
    if (pen.id == null) throw new Error('Không xác định được chuồng trên backend')
    const expectedVersion = pen.version == null
      ? undefined
      : Number(String(pen.version).replace(/^v/, '').split(' · ')[0])
    return mapBackendPen(await backendTransport.command(backendTransport.farmPath(backendFarmId, `/pens/${pen.id}`), {
      code: pen.code, name: pen.name, capacity: pen.capacity, description: pen.desc ?? '', criteria: criteriaPayload(pen), ...(expectedVersion == null || Number.isNaN(expectedVersion) ? {} : { expectedVersion }),
    }, { method: 'PUT' }))
  },
  changeAvailability: async (pen: Pen, status: 'ACTIVE' | 'INACTIVE', note: { date: string; reason: string }): Promise<Pen> => {
    if (pen.id == null) throw new Error('Không xác định được chuồng trên backend')
    const expectedVersion = pen.version == null
      ? undefined
      : Number(String(pen.version).replace(/^v/, '').split(' · ')[0])
    return mapBackendPen(await backendTransport.command(backendTransport.farmPath(backendFarmId, `/pens/${pen.id}/availability`), {
      status,
      effectiveDate: note.date,
      reason: note.reason,
      ...(expectedVersion == null || Number.isNaN(expectedVersion) ? {} : { expectedVersion }),
    }, { method: 'POST' }))
  },
}

// Chuồng trại: mã chuồng là khoá. Backend mode never consults localStorage.
export const penApi = backendMode === 'backend' ? backendApi : {
  list: () => pens!.list(),
  create: (pen: Pen) => pens!.create(normalize(pen)),
  update: (pen: Pen) => pens!.update(pen.code, normalize(pen)),
  changeAvailability: async (pen: Pen, status: 'ACTIVE' | 'INACTIVE', note: { date: string; reason: string }) =>
    pens!.update(pen.code, normalize({ ...pen, status, statusNote: note })),
}
