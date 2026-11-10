import { seedPens } from '../../../data/pensData'
import { createCollection } from '../../../api/client'
import { migrateHerdStorage } from '../../../api/storageMigrations'
import { penSchema } from '../../../api/collectionSchemas'
import { moveBarn } from '../../../api/cattleApi'
import { backendFarmId, backendMode, backendTransport, asRecord, asRows, numberValue, textValue } from '../../../api/backendTransport'
import type { Pen } from '../../../types'
import type { ReceptionCriteria } from '../domain/penRules'

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

type BackendHint = { code?: string; params?: Record<string, unknown> }
type BackendPen = {
  id?: number; code?: string; name?: string; capacity?: number; description?: string
  status?: string; headcount?: number; acceptsSummary?: string; version?: number
  cattle?: Array<{ id?: number; code?: string; exitPending?: boolean; hints?: BackendHint[] }>
  currentCriteria?: {
    versionNo?: number; effectiveFrom?: string
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
  const tokens = summary.split('|').flatMap((token) => token.split('/')).map((token) => token.trim()).filter(Boolean)
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
    lockVersion: row.version ?? undefined,
    receptionCriteria: {
      purposeTypes: criteria.purposeTypes ?? [],
      lifeStages: criteria.lifeStages ?? [],
      ...(criteria.sex && criteria.sex !== 'BOTH' ? { sex: criteria.sex } : {}),
      minAgeMonths: criteria.minAgeMonths ?? null,
      minWeightKg: criteria.minWeightKg ?? null,
    },
    criteriaVersionNo: row.currentCriteria?.versionNo,
    criteriaEffectiveFrom: row.currentCriteria?.effectiveFrom,
  }
}

/** A cattle currently in a pen (A2 cattle[]): id, code and short situation hints. */
export type PenCattle = { id?: number; code: string; situation: string; hints: BackendHint[]; exitPending: boolean }
export type PenDetail = Pen & { cattleInPen: PenCattle[] }

/** Pen detail (A2): the list fields plus the cattle currently in the pen. */
export const mapBackendPenDetail = (value: unknown): PenDetail => {
  const row = value as BackendPen
  return {
    ...mapBackendPen(value),
    cattleInPen: (row.cattle ?? []).map((c) => ({
      id: c.id, code: textValue(c.code), hints: c.hints ?? [], exitPending: c.exitPending === true, situation: '',
    })),
  }
}

/** Optimistic-lock version of the pen the form was loaded with (never the criteria version). */
const lockVersionOf = (pen: Pen): number | undefined => {
  if (typeof pen.lockVersion === 'number') return pen.lockVersion
  if (pen.version == null) return undefined
  const parsed = Number(String(pen.version).replace(/^v/, '').split(' ')[0])
  return Number.isNaN(parsed) ? undefined : parsed
}

const legacyCriteriaPayload = (pen: Pen): ReceptionCriteria => ({
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

/** The enum criteria edited in the popup win; the label fields remain a fallback for older callers. */
const criteriaPayload = (pen: Pen): ReceptionCriteria => pen.receptionCriteria ? {
  purposeTypes: pen.receptionCriteria.purposeTypes ?? [],
  lifeStages: pen.receptionCriteria.lifeStages ?? [],
  ...(pen.receptionCriteria.sex ? { sex: pen.receptionCriteria.sex } : {}),
  minAgeMonths: pen.receptionCriteria.minAgeMonths ?? null,
  minWeightKg: pen.receptionCriteria.minWeightKg ?? null,
} : legacyCriteriaPayload(pen)

/** One row of the reception-check table (A6), per cattle. */
export type PenMoveCheckRow = {
  cattleId: number
  cattleCode: string
  currentPenCode?: string | null
  currentFromDate?: string | null
  alreadyInDestination: boolean
  error?: BackendHint | null
  warningReasonRequired: boolean
  results: Array<{ criterion: string; outcome: 'MET' | 'NOT_MET' | 'NOT_APPLICABLE'; expected?: string | null; actual?: string | null }>
}
export type PenMoveCheckResult = {
  destinationActive: boolean
  freePlaces: number
  capacity: number
  headcount: number
  movingCount: number
  blocked: boolean
  block?: BackendHint | null
  cattle: PenMoveCheckRow[]
}
export type MoveCattle = { id?: number; code: string }
export type PenMoveCommand = {
  cattle: MoveCattle[]
  from: Pen
  to: Pen
  moveDate: string
  reason: string
  warningReasons: Record<string, string>
}
export type PenMoveResult = { moved: number; skipped: Array<{ cattleCode: string }> }

const outcome = (value: unknown): PenMoveCheckRow['results'][number]['outcome'] =>
  value === 'MET' || value === 'NOT_MET' ? value : 'NOT_APPLICABLE'

const backendApi = {
  list: async (): Promise<Pen[]> => {
    const response = await backendTransport.get(backendTransport.farmPath(backendFarmId, '/pens'))
    const body = asRecord(response)
    return (Array.isArray(response) ? asRows(response) : asRows(body.pens)).map(mapBackendPen)
  },
  detail: async (pen: Pen): Promise<PenDetail> => {
    if (pen.id == null) return { ...pen, cattleInPen: [] }
    return mapBackendPenDetail(await backendTransport.get(backendTransport.farmPath(backendFarmId, `/pens/${pen.id}`)))
  },
  create: async (pen: Pen): Promise<Pen> => mapBackendPen(await backendTransport.command(backendTransport.farmPath(backendFarmId, '/pens'), {
    code: pen.code, name: pen.name, capacity: pen.capacity, description: pen.desc ?? '', criteria: criteriaPayload(pen), initialStatus: pen.status,
  })),
  update: async (pen: Pen): Promise<Pen> => {
    if (pen.id == null) throw new Error('Không xác định được chuồng trên backend')
    const expectedVersion = lockVersionOf(pen)
    return mapBackendPen(await backendTransport.command(backendTransport.farmPath(backendFarmId, `/pens/${pen.id}`), {
      code: pen.code, name: pen.name, capacity: pen.capacity, description: pen.desc ?? '', criteria: criteriaPayload(pen), ...(expectedVersion == null ? {} : { expectedVersion }),
    }, { method: 'PUT' }))
  },
  changeAvailability: async (pen: Pen, status: 'ACTIVE' | 'INACTIVE', note: { date: string; reason: string }): Promise<Pen> => {
    if (pen.id == null) throw new Error('Không xác định được chuồng trên backend')
    const expectedVersion = lockVersionOf(pen)
    return mapBackendPen(await backendTransport.command(backendTransport.farmPath(backendFarmId, `/pens/${pen.id}/availability`), {
      status,
      effectiveDate: note.date,
      reason: note.reason,
      ...(expectedVersion == null ? {} : { expectedVersion }),
    }, { method: 'POST' }))
  },
  checkMove: async (cattle: MoveCattle[], _from: Pen, to: Pen, moveDate: string): Promise<PenMoveCheckResult> => {
    const cattleIds = cattle.map((c) => c.id).filter((id): id is number => typeof id === 'number')
    const body = asRecord(await backendTransport.command(backendTransport.farmPath(backendFarmId, '/pen-moves/check'), { cattleIds, toPenId: to.id, moveDate }, { method: 'POST' }))
    return {
      destinationActive: body.destinationActive === true,
      freePlaces: numberValue(body.freePlaces),
      capacity: numberValue(body.capacity),
      headcount: numberValue(body.headcount),
      movingCount: numberValue(body.movingCount),
      blocked: body.blocked === true,
      block: (body.block ?? null) as BackendHint | null,
      cattle: asRows(body.cattle).map((row) => ({
        cattleId: numberValue(row.cattleId),
        cattleCode: textValue(row.cattleCode),
        currentPenCode: typeof row.currentPenCode === 'string' ? row.currentPenCode : null,
        currentFromDate: typeof row.currentFromDate === 'string' ? row.currentFromDate : null,
        alreadyInDestination: row.alreadyInDestination === true,
        error: (row.error ?? null) as BackendHint | null,
        warningReasonRequired: row.warningReasonRequired === true,
        results: asRows(row.results).map((r) => ({
          criterion: textValue(r.criterion),
          outcome: outcome(r.outcome),
          expected: typeof r.expected === 'string' ? r.expected : null,
          actual: typeof r.actual === 'string' ? r.actual : null,
        })),
      })),
    }
  },
  move: async (command: PenMoveCommand): Promise<PenMoveResult> => {
    const cattleIds = command.cattle.map((c) => c.id).filter((id): id is number => typeof id === 'number')
    const byCode = new Map(command.cattle.map((c) => [c.code, c.id]))
    const warningReasons = Object.fromEntries(
      Object.entries(command.warningReasons)
        .filter(([, reason]) => reason.trim())
        .map(([code, reason]) => [String(byCode.get(code) ?? code), reason.trim()]),
    )
    const body = asRecord(await backendTransport.command(backendTransport.farmPath(backendFarmId, '/pen-moves'), {
      cattleIds, toPenId: command.to.id, moveDate: command.moveDate, reason: command.reason, warningReasons,
    }, { method: 'POST' }))
    return { moved: asRows(body.moved).length, skipped: asRows(body.skipped).map((row) => ({ cattleCode: textValue(row.cattleCode) })) }
  },
}

/** Local demo: occupancy check only (the demo seed has no per-cattle profile to compare with the criteria). */
const localCheckMove = async (cattle: MoveCattle[], from: Pen, to: Pen): Promise<PenMoveCheckResult> => {
  const already = to.code === from.code
  const moving = already ? 0 : cattle.length
  const free = Math.max(0, to.capacity - to.count)
  const active = to.status === 'ACTIVE'
  const blocked = moving > 0 && (!active || moving > free)
  return {
    destinationActive: active, freePlaces: free, capacity: to.capacity, headcount: to.count, movingCount: moving, blocked,
    block: blocked ? { code: 'MSG-FE04-05', params: { pen_code: to.code, count: moving, free: active ? free : 0 } } : null,
    cattle: cattle.map((c, index) => ({
      cattleId: c.id ?? index, cattleCode: c.code, currentPenCode: from.code, currentFromDate: null,
      alreadyInDestination: already, error: null, warningReasonRequired: false, results: [],
    })),
  }
}

// Chuồng trại: mã chuồng là khoá. Backend mode never consults localStorage.
export const penApi = backendMode === 'backend' ? backendApi : {
  list: () => pens!.list(),
  detail: async (pen: Pen): Promise<PenDetail> => ({
    ...pen,
    cattleInPen: pen.cows.map(([code, situation]) => ({ code, situation, hints: [], exitPending: false })),
  }),
  create: (pen: Pen) => pens!.create(normalize(pen)),
  update: (pen: Pen) => pens!.update(pen.code, normalize(pen)),
  changeAvailability: async (pen: Pen, status: 'ACTIVE' | 'INACTIVE', note: { date: string; reason: string }) =>
    pens!.update(pen.code, normalize({ ...pen, status, statusNote: note })),
  checkMove: localCheckMove,
  move: async (command: PenMoveCommand): Promise<PenMoveResult> => {
    // Cattle known to the local cattle collection move through the shared adapter, which also updates both pens.
    // Seed links without a cattle record (demo rows) only move the pen link.
    const linkOnly: string[] = []
    for (const c of command.cattle) {
      const moved = await moveBarn(c.code, { to: command.to.code, date: command.moveDate, reason: command.reason, by: '' }).then(() => true, () => false)
      if (!moved) linkOnly.push(c.code)
    }
    if (linkOnly.length) {
      const codes = new Set(linkOnly)
      const fromPen = await pens!.get(command.from.code)
      const toPen = await pens!.get(command.to.code)
      const links = fromPen.cows.filter(([code]) => codes.has(code))
      await pens!.update(fromPen.code, { ...fromPen, count: Math.max(0, fromPen.count - links.length), cows: fromPen.cows.filter(([code]) => !codes.has(code)) })
      await pens!.update(toPen.code, { ...toPen, count: toPen.count + links.length, cows: [...toPen.cows, ...links] })
    }
    return { moved: command.cattle.length, skipped: [] }
  },
}
