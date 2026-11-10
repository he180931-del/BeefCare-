import { BackendError } from '../../../api/backendClient'
import { asRecord, asRows, textValue, type BackendTransport } from '../../../api/backendTransport'
import { GROWTH_FILTER_OPTIONS } from '../data/growthMock'
import { buildProfile } from '../domain/growthSummary'
import { GrowthLargeChangeError, GrowthValidationError, type GrowthFieldKey } from '../domain/growthRules'
import type {
  CorrectGrowthCommand, GrowthBasis, GrowthCattle, GrowthFilterOptions, GrowthFilters, GrowthFormOptions, GrowthHerdPage,
  GrowthHerdRow, GrowthHerdStatus, GrowthMethod, GrowthProfile, GrowthRecord, GrowthRecordStatus, GrowthWindow,
  HerdGroup, LifeStage, RecordGrowthCommand,
} from '../types'

/**
 * Adapter FE-08 cho chế độ backend.
 * Route: GET /growth, GET /cattle/resolve, GET /cattle/{id}/growth, POST /cattle/{id}/growth, POST .../{recordId}/correction,
 * GET /pens, GET /members. Giờ trại cố định UTC+7 (Asia/Ho_Chi_Minh) vì trang trại đều ở Việt Nam.
 */
export const HERD_PAGE_SIZE = 7
const FARM_OFFSET = '+07:00'
const FARM_OFFSET_MS = 7 * 3600_000

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined)

/** Instant ISO → 'yyyy-mm-ddTHH:mm' theo giờ trại. */
export const toFarmTime = (instant: unknown): string => {
  const ms = Date.parse(textValue(instant))
  if (Number.isNaN(ms)) return ''
  return new Date(ms + FARM_OFFSET_MS).toISOString().slice(0, 16)
}
/** 'yyyy-mm-ddTHH:mm' giờ trại → Instant có offset để backend đọc đúng. */
export const toInstant = (farmTime: string): string => (farmTime.length === 16 ? `${farmTime}:00${FARM_OFFSET}` : farmTime)
const farmNow = (clock: () => Date) => toFarmTime(clock().toISOString())

// Backend dùng OTHER cho "ước lượng" và cho bản ghi chỉ có BCS.
const toMethod = (method: unknown, weightKg: number | undefined): GrowthMethod | undefined => {
  if (method === 'SCALE' || method === 'TAPE') return method
  return method === 'OTHER' && weightKg !== undefined ? 'ESTIMATE' : undefined
}
const fromMethod = (method?: GrowthMethod) => (method === 'ESTIMATE' ? 'OTHER' : method)
const toBasis = (value: unknown): GrowthBasis | undefined => (value === 'MEASURED' || value === 'ESTIMATED' ? value : undefined)
const toStatus = (value: unknown): GrowthRecordStatus => (value === 'EXCLUDED' || value === 'VOIDED' ? value : 'VALID')

export function mapRecord(raw: unknown, cattleCode: string): GrowthRecord {
  const r = asRecord(raw)
  const weightKg = num(r.weightKg)
  return {
    id: num(r.id) ?? 0,
    cattleCode,
    measuredAt: toFarmTime(r.measuredAt),
    recordedAt: toFarmTime(r.recordedAt),
    measuredBy: num(r.measuredBy) ?? 0,
    measuredByName: textValue(r.measuredByName),
    method: toMethod(r.method, weightKg),
    weightKg,
    basis: toBasis(r.basis),
    heartGirthCm: num(r.heartGirthCm),
    bodyLengthCm: num(r.bodyLengthCm),
    bcs: num(r.bcs),
    note: text(r.note),
    status: toStatus(r.status),
    corrected: r.corrected === true || r.status === 'CORRECTED',
    version: num(r.version) ?? 0,
    // Backend chưa trả lịch sử sửa (GAP-FE08-01).
    revisions: [],
  }
}

export function mapCattle(raw: unknown): GrowthCattle {
  const p = asRecord(raw)
  return {
    code: textValue(p.displayCode),
    name: text(p.name),
    earTag: text(p.earTagNumber),
    breed: textValue(p.breedName),
    sex: p.sex === 'FEMALE' ? 'Cái' : 'Đực',
    penCode: textValue(p.penCode),
    penName: textValue(p.penName),
    herdGroup: (text(p.herdGroup) ?? 'OTHER') as HerdGroup,
    lifeStage: textValue(p.lifeStage) as LifeStage,
    herdEntryDate: textValue(asRecord(p.entry).entryDate),
    // Backend chưa trả cân mục tiêu (GAP-FE08-02).
    targetWeightKg: undefined,
    status: p.herdStatus === 'ACTIVE' || p.herdStatus === undefined ? 'ACTIVE' : 'EXITED',
  }
}

const rowStatus = (flags: unknown): GrowthHerdStatus => {
  const list = Array.isArray(flags) ? flags : []
  if (list.includes('WEIGHING_OVERDUE')) return 'OVERDUE'
  if (list.includes('LOW_ADG')) return 'LOW_ADG'
  if (list.includes('LOW_BCS')) return 'LOW_BCS'
  return 'NORMAL'
}

export function mapHerdRow(raw: unknown): GrowthHerdRow {
  const r = asRecord(raw)
  return {
    code: textValue(r.code),
    breed: textValue(r.breed),
    sex: r.sex === 'FEMALE' ? 'Cái' : 'Đực',
    penCode: textValue(r.penCode),
    penName: textValue(r.penName),
    latestWeightKg: num(r.weightKg),
    latestBasis: toBasis(r.basis),
    weighedAt: text(r.weighedOn),
    adg: num(r.adg),
    bcs: num(r.bcs),
    status: rowStatus(r.flags),
  }
}

const FIELD_KEYS: GrowthFieldKey[] = ['measuredAt', 'method', 'weightKg', 'heartGirthCm', 'bodyLengthCm', 'bcs', 'note', 'reason']
const FIELD_MESSAGE: Record<string, string> = {
  measuredAt: 'Thời điểm đo không hợp lệ.',
  method: 'Chọn phương pháp đo.',
  weightKg: 'Cân nặng phải từ 1 đến 1.500 kg, tối đa 1 chữ số thập phân.',
  heartGirthCm: 'Vòng ngực phải từ 50 đến 300 cm.',
  bodyLengthCm: 'Dài thân phải từ 30 đến 250 cm.',
  bcs: 'BCS không đúng thang điểm của trại.',
  note: 'Ghi chú tối đa 500 ký tự.',
  reason: 'Nhập lý do (tối đa 500 ký tự).',
}

/** Đổi lỗi backend sang lỗi màn hình đang bắt (GrowthLargeChangeError / GrowthValidationError). */
export function mapGrowthError(error: unknown): unknown {
  if (!(error instanceof BackendError)) return error
  if (error.code === 'MSG-FE08-04') {
    const p = error.params
    return new GrowthLargeChangeError(num(p.new) ?? 0, num(p.last) ?? 0, textValue(p.date))
  }
  if (error.code === 'MSG-FE08-02') return new GrowthValidationError({ form: 'Nhập ít nhất cân nặng hoặc BCS.' })
  const fields: Partial<Record<GrowthFieldKey, string>> = {}
  const field = textValue(error.params.field)
  if (field === 'tapeDimensions') fields.heartGirthCm = 'Chỉ nhập vòng ngực, dài thân khi đo bằng thước dây.'
  else if ((FIELD_KEYS as string[]).includes(field)) fields[field as GrowthFieldKey] = FIELD_MESSAGE[field]
  for (const fe of error.fieldErrors) {
    const key = fe.field.replace(/^values\./, '')
    if ((FIELD_KEYS as string[]).includes(key)) fields[key as GrowthFieldKey] = FIELD_MESSAGE[key] ?? fe.message
  }
  return Object.keys(fields).length ? new GrowthValidationError(fields) : error
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value))
  const s = search.toString()
  return s ? `?${s}` : ''
}

export function createGrowthBackend({ farmId, transport, clock = () => new Date() }: { farmId: string | number; transport: BackendTransport; clock?: () => Date }) {
  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  const resolved = new Map<string, { cattleId: number; cattle: GrowthCattle }>()
  const records = new Map<number, GrowthRecord>()

  async function resolve(code: string) {
    const hit = resolved.get(code)
    if (hit) return hit
    const body = asRecord(await transport.get(path(`/cattle/resolve${query({ code })}`)))
    const cattleId = num(body.cattleId)
    if (cattleId === undefined) throw new Error(`Không tìm thấy bò ${code}.`)
    const value = { cattleId, cattle: mapCattle(body.cattle) }
    resolved.set(code, value)
    return value
  }

  async function pens() {
    const response = await transport.get(path('/pens'))
    const rows = Array.isArray(response) ? asRows(response) : asRows(asRecord(response).pens)
    return rows.map((p) => ({ id: num(p.id), code: textValue(p.code), name: textValue(p.name, textValue(p.code)) }))
  }

  async function run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      throw mapGrowthError(error)
    }
  }

  const measurement = (cmd: RecordGrowthCommand) => ({
    measuredAt: toInstant(cmd.measuredAt),
    measuredBy: cmd.measuredBy ?? null,
    method: fromMethod(cmd.method) ?? null,
    // Không gửi basis: backend suy ra từ method (GBR-37).
    weightKg: cmd.weightKg ?? null,
    heartGirthCm: cmd.heartGirthCm ?? null,
    bodyLengthCm: cmd.bodyLengthCm ?? null,
    bcs: cmd.bcs ?? null,
    note: cmd.note ?? null,
    acknowledgedLargeChange: cmd.acknowledgedLargeChange === true,
  })

  return {
    async listHerd(filters: GrowthFilters = {}): Promise<GrowthHerdPage> {
      const penId = filters.penCode ? (await pens()).find((p) => p.code === filters.penCode)?.id : undefined
      const page = Math.max(1, filters.page ?? 1)
      const size = filters.size ?? HERD_PAGE_SIZE
      const sort = filters.dir === 'asc' ? 'weighedOn' : filters.dir === 'desc' ? '-weighedOn' : undefined
      const body = asRecord(await transport.get(path(`/growth${query({
        q: filters.q?.trim(), penId, herdGroup: filters.herdGroup, lifeStage: filters.lifeStage,
        windowDays: filters.windowDays ?? 90, page: page - 1, size, sort,
      })}`)))
      const summary = asRecord(body.summary)
      const total = num(body.total) ?? 0
      return {
        rows: asRows(body.items).map(mapHerdRow),
        total,
        page: (num(body.page) ?? page - 1) + 1,
        size: num(body.size) ?? size,
        // Backend chỉ trả tổng sau lọc; dùng làm số bò đang theo dõi (GAP-FE08-03).
        activeCount: total,
        windowDays: (num(body.windowDays) ?? filters.windowDays ?? 90) as GrowthWindow,
        tiles: {
          overdue: num(summary.WEIGHING_OVERDUE) ?? 0,
          lowAdg: num(summary.LOW_ADG) ?? 0,
          lowBcs: num(summary.LOW_BCS) ?? 0,
          weighings30: num(summary.WEIGHINGS_30_DAYS) ?? 0,
        },
      }
    },

    async filterOptions(): Promise<GrowthFilterOptions> {
      return {
        pens: (await pens()).map((p) => ({ code: p.code, label: p.name })),
        herdGroups: structuredClone(GROWTH_FILTER_OPTIONS.herdGroups),
        lifeStages: structuredClone(GROWTH_FILTER_OPTIONS.lifeStages),
      }
    },

    async getProfile(code: string): Promise<GrowthProfile> {
      const { cattleId, cattle } = await resolve(code)
      const body = asRecord(await transport.get(path(`/cattle/${cattleId}/growth?windowDays=90`)))
      const list = asRows(body.records).map((r) => mapRecord(r, code))
      list.forEach((r) => records.set(r.id, r))
      const profile = buildProfile(cattle, list, farmNow(clock))
      // Số liệu tổng hợp lấy theo backend; phần còn lại (biểu đồ, ADG từng dòng) tính lại từ records.
      return {
        ...profile,
        adg90: num(body.adg),
        latestBcs: num(body.latestBcs),
        nextWeighingDate: text(body.nextWeighing),
        count: num(body.measurements) ?? profile.count,
        projection: undefined,
      }
    },

    async formOptions(code: string): Promise<GrowthFormOptions> {
      const [{ cattle }, members] = await Promise.all([resolve(code), transport.get(path('/members'))])
      const list = Array.isArray(members) ? asRows(members) : asRows(asRecord(members).members ?? asRecord(members).items)
      return {
        cattle,
        members: list
          .filter((m) => m.status === undefined || m.status === 'ACTIVE')
          .map((m) => ({ id: num(m.userId) ?? num(m.id) ?? 0, name: textValue(m.fullName, textValue(m.email)) })),
        now: farmNow(clock),
      }
    },

    async record(code: string, command: RecordGrowthCommand): Promise<GrowthRecord> {
      return run(async () => {
        const { cattleId } = await resolve(code)
        const saved = mapRecord(await transport.command(path(`/cattle/${cattleId}/growth`), measurement(command)), code)
        records.set(saved.id, saved)
        return saved
      })
    },

    async correct(code: string, recordId: number, command: CorrectGrowthCommand): Promise<GrowthRecord> {
      return run(async () => {
        const { cattleId } = await resolve(code)
        const before = records.get(recordId)
        // Correction.values là Measurement đầy đủ (measuredAt bắt buộc): ghép giá trị cũ với phần người dùng sửa.
        const values = command.action === 'CORRECT'
          ? measurement({
            measuredAt: command.values?.measuredAt ?? before?.measuredAt ?? '',
            measuredBy: before?.measuredBy,
            method: command.values?.method ?? before?.method,
            weightKg: pick(command.values, 'weightKg', before?.weightKg),
            heartGirthCm: pick(command.values, 'heartGirthCm', before?.heartGirthCm),
            bodyLengthCm: pick(command.values, 'bodyLengthCm', before?.bodyLengthCm),
            bcs: pick(command.values, 'bcs', before?.bcs),
            note: before?.note,
            acknowledgedLargeChange: true,
          })
          : null
        const saved = mapRecord(await transport.command(path(`/cattle/${cattleId}/growth/${recordId}/correction`), {
          action: command.action, values, reason: command.reason, expectedVersion: command.expectedVersion,
        }), code)
        records.set(saved.id, saved)
        return saved
      })
    },
  }
}

// Giữ giá trị cũ khi người dùng không đụng tới trường; trường có trong values (kể cả undefined) là ý định xoá.
function pick<K extends 'weightKg' | 'heartGirthCm' | 'bodyLengthCm' | 'bcs'>(values: CorrectGrowthCommand['values'], key: K, fallback: number | undefined) {
  return values && Object.hasOwn(values, key) ? values[key] : fallback
}
