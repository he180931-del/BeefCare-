import type { CorrectGrowthCommand, GrowthCattle, GrowthFilters, GrowthFormOptions, GrowthRecord, RecordGrowthCommand } from '../types'
import { GrowthLargeChangeError, GrowthValidationError, basisOf, largeChangeAgainst, tapeWeightKg, validWeights, validateMeasurement, validateReason } from '../domain/growthRules'
import { buildHerdPage, buildProfile } from '../domain/growthSummary'
import { GROWTH_DEMO, GROWTH_FILTER_OPTIONS, GROWTH_MEMBERS, GROWTH_NOW } from './growthMock'

const unknownCattle = (code: string): GrowthCattle => ({
  code,
  breed: '',
  sex: 'Cái',
  penCode: '',
  penName: '',
  herdGroup: 'OTHER',
  lifeStage: 'ADULT',
  herdEntryDate: '2020-01-01',
  status: 'ACTIVE',
})

export function createGrowthDemoStore(seed = GROWTH_DEMO, now: () => string = () => GROWTH_NOW) {
  let cattle = structuredClone(seed.cattle)
  let records = structuredClone(seed.records)
  let nextId = seed.nextId

  const cattleOf = (code: string) => cattle.find((c) => c.code === code) ?? unknownCattle(code)
  const recordsOf = (code: string) => records.filter((r) => r.cattleCode === code)
  const assertActive = (c: GrowthCattle) => {
    if (c.status !== 'ACTIVE') throw new Error(`${c.code} đã rời đàn. Bản ghi chỉ để xem.`)
  }

  /** Tính cân nặng từ thước dây khi người dùng không nhập cân. */
  const withTapeWeight = <T extends { method?: string; weightKg?: number; heartGirthCm?: number; bodyLengthCm?: number }>(v: T): T =>
    v.method === 'TAPE' && v.weightKg === undefined && v.heartGirthCm !== undefined && v.bodyLengthCm !== undefined
      ? { ...v, weightKg: tapeWeightKg(v.heartGirthCm, v.bodyLengthCm) }
      : v

  return {
    async listHerd(filters: GrowthFilters) {
      return structuredClone(buildHerdPage(cattle, records, filters, now()))
    },
    async filterOptions() {
      return structuredClone(GROWTH_FILTER_OPTIONS)
    },
    async getProfile(code: string) {
      return structuredClone(buildProfile(cattleOf(code), recordsOf(code), now()))
    },
    async formOptions(code: string): Promise<GrowthFormOptions> {
      return structuredClone({ cattle: cattleOf(code), members: GROWTH_MEMBERS, now: now() })
    },
    async record(code: string, command: RecordGrowthCommand) {
      const c = cattleOf(code)
      assertActive(c)
      const values = withTapeWeight(command)
      const errors = validateMeasurement(values, { now: now(), herdEntryDate: c.herdEntryDate })
      if (Object.keys(errors).length) throw new GrowthValidationError(errors)
      if (values.weightKg !== undefined && !command.acknowledgedLargeChange) {
        const last = largeChangeAgainst(validWeights(recordsOf(code)), values.measuredAt, values.weightKg)
        if (last) throw new GrowthLargeChangeError(values.weightKg, last.kg, last.at)
      }
      const by = GROWTH_MEMBERS.find((m) => m.id === command.measuredBy)
      const row: GrowthRecord = {
        id: nextId++,
        cattleCode: code,
        measuredAt: values.measuredAt,
        recordedAt: now(),
        measuredBy: command.measuredBy ?? 0,
        measuredByName: command.measuredByName ?? by?.name ?? 'Quản lý trại',
        method: values.weightKg !== undefined ? values.method : undefined,
        weightKg: values.weightKg,
        basis: values.weightKg !== undefined ? basisOf(values.method) : undefined,
        heartGirthCm: values.method === 'TAPE' ? values.heartGirthCm : undefined,
        bodyLengthCm: values.method === 'TAPE' ? values.bodyLengthCm : undefined,
        bcs: values.bcs,
        note: values.note?.trim() || undefined,
        status: 'VALID',
        corrected: false,
        version: 1,
        revisions: [],
      }
      records.push(row)
      return structuredClone(row)
    },
    async correct(code: string, recordId: number, command: CorrectGrowthCommand) {
      const c = cattleOf(code)
      assertActive(c)
      const row = records.find((r) => r.id === recordId && r.cattleCode === code)
      if (!row) throw new Error('Không tìm thấy bản ghi cân.')
      if (row.version !== command.expectedVersion || row.status !== 'VALID') throw new Error('Bản ghi đã thay đổi. Vui lòng tải lại và kiểm tra trước khi thử lại.')
      const reasonErrors = validateReason(command.reason)
      if (Object.keys(reasonErrors).length) throw new GrowthValidationError(reasonErrors)

      const before = { measuredAt: row.measuredAt, method: row.method, weightKg: row.weightKg, bcs: row.bcs }
      let next = { ...row }
      if (command.action === 'CORRECT') {
        const merged = withTapeWeight({
          measuredAt: command.values?.measuredAt ?? row.measuredAt,
          method: command.values?.method ?? row.method,
          weightKg: command.values && 'weightKg' in command.values ? command.values.weightKg : row.weightKg,
          heartGirthCm: command.values && 'heartGirthCm' in command.values ? command.values.heartGirthCm : row.heartGirthCm,
          bodyLengthCm: command.values && 'bodyLengthCm' in command.values ? command.values.bodyLengthCm : row.bodyLengthCm,
          bcs: command.values && 'bcs' in command.values ? command.values.bcs : row.bcs,
          note: row.note,
        })
        const errors = validateMeasurement(merged, { now: now(), herdEntryDate: c.herdEntryDate })
        if (Object.keys(errors).length) throw new GrowthValidationError(errors)
        next = { ...next, ...merged, basis: merged.weightKg !== undefined ? basisOf(merged.method) : undefined, corrected: true }
      } else {
        next.status = 'EXCLUDED'
      }
      next.version = row.version + 1
      next.revisions = [...row.revisions, { at: now(), by: 'Quản lý trại', action: command.action, reason: command.reason.trim(), before }]
      records = records.map((r) => (r.id === row.id ? next : r))
      return structuredClone(next)
    },
    async reset() {
      cattle = structuredClone(seed.cattle)
      records = structuredClone(seed.records)
      nextId = seed.nextId
    },
  }
}
export type GrowthDemoStore = ReturnType<typeof createGrowthDemoStore>
export const growthDemoStore = createGrowthDemoStore()
