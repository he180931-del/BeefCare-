import type { GrowthCattle, GrowthFilters, GrowthHerdPage, GrowthHerdRow, GrowthHerdStatus, GrowthProfile, GrowthRecord, GrowthWindow } from '../types'
import { addDays, dayFloat } from './growthFormat'
import { adgForWindow, finishingProjection, rowAdgMap, validWeights, WEIGHING_INTERVAL_DAYS } from './growthRules'

const CHART_DAYS = 120
const PAGE_SIZE = 7

const latestBcs = (records: GrowthRecord[]) =>
  records
    .filter((r) => r.status === 'VALID' && r.bcs !== undefined)
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1))[0]?.bcs

export function buildHerdPage(cattle: GrowthCattle[], records: GrowthRecord[], filters: GrowthFilters, now: string): GrowthHerdPage {
  const windowDays: GrowthWindow = filters.windowDays ?? 90
  const byCattle = new Map<string, GrowthRecord[]>()
  records.forEach((r) => byCattle.set(r.cattleCode, [...(byCattle.get(r.cattleCode) ?? []), r]))

  const scoped = cattle.filter(
    (c) =>
      c.status === 'ACTIVE' &&
      (!filters.penCode || c.penCode === filters.penCode) &&
      (!filters.herdGroup || c.herdGroup === filters.herdGroup) &&
      (!filters.lifeStage || c.lifeStage === filters.lifeStage),
  )

  const stats = scoped.map((c) => {
    const recs = byCattle.get(c.code) ?? []
    const weights = validWeights(recs)
    const latest = weights[weights.length - 1]
    return { c, recs, weights, latest, adg: adgForWindow(weights, windowDays, now), bcs: latestBcs(recs) }
  })

  const penAdg = new Map<string, number[]>()
  stats.forEach((s) => s.adg !== undefined && penAdg.set(s.c.penCode, [...(penAdg.get(s.c.penCode) ?? []), s.adg]))
  const penAvg = (pen: string) => {
    const list = penAdg.get(pen) ?? []
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : undefined
  }

  const rowsAll: GrowthHerdRow[] = stats.map(({ c, latest, adg, bcs }) => {
    const overdue = !latest || dayFloat(now) - dayFloat(latest.at) > WEIGHING_INTERVAL_DAYS
    const avg = penAvg(c.penCode)
    const status: GrowthHerdStatus = overdue ? 'OVERDUE' : bcs !== undefined && bcs < 2.5 ? 'LOW_BCS' : adg !== undefined && avg !== undefined && adg < avg ? 'LOW_ADG' : 'NORMAL'
    return {
      code: c.code,
      name: c.name,
      breed: c.breed,
      sex: c.sex,
      penCode: c.penCode,
      penName: c.penName,
      latestWeightKg: latest?.kg,
      latestBasis: latest?.basis,
      weighedAt: latest?.at,
      adg,
      bcs,
      status,
    }
  })

  const cutoff = dayFloat(now) - 30
  const tiles = {
    overdue: rowsAll.filter((r) => r.status === 'OVERDUE').length,
    lowAdg: rowsAll.filter((r) => r.status === 'LOW_ADG').length,
    lowBcs: rowsAll.filter((r) => r.bcs !== undefined && r.bcs < 2.5).length,
    weighings30: stats.reduce((n, s) => n + s.weights.filter((w) => dayFloat(w.at) >= cutoff).length, 0),
  }

  const q = filters.q?.trim().toLowerCase()
  const cattleByCode = new Map(cattle.map((c) => [c.code, c]))
  const matched = rowsAll.filter((r) => {
    if (!q) return true
    const c = cattleByCode.get(r.code)
    return [r.code, r.name, c?.earTag].some((v) => v?.toLowerCase().includes(q))
  })
  const dir = filters.dir === 'asc' ? 1 : -1
  matched.sort((a, b) => {
    if (!a.weighedAt && !b.weighedAt) return a.code.localeCompare(b.code)
    if (!a.weighedAt) return 1
    if (!b.weighedAt) return -1
    return a.weighedAt === b.weighedAt ? a.code.localeCompare(b.code) : a.weighedAt < b.weighedAt ? -dir : dir
  })

  const size = filters.size ?? PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(matched.length / size))
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount)
  return { rows: matched.slice((page - 1) * size, page * size), total: matched.length, page, size, activeCount: scoped.length, windowDays, tiles }
}

export function buildProfile(cattle: GrowthCattle, records: GrowthRecord[], now: string): GrowthProfile {
  const sorted = [...records].filter((r) => r.status !== 'VOIDED').sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1))
  const weights = validWeights(sorted)
  const latest = weights[weights.length - 1]
  const cutoff = dayFloat(now) - CHART_DAYS
  return {
    cattle,
    records: sorted,
    rowAdg: rowAdgMap(weights),
    latest: latest && { kg: latest.kg, basis: latest.basis, at: latest.at },
    adg90: adgForWindow(weights, 90, now),
    latestBcs: latestBcs(sorted),
    count: sorted.length,
    correctedCount: sorted.filter((r) => r.corrected).length,
    nextWeighingDate: latest ? addDays(latest.at, WEIGHING_INTERVAL_DAYS) : undefined,
    projection: cattle.herdGroup === 'FATTENING' ? finishingProjection(weights, cattle.targetWeightKg, now) : undefined,
    chart: weights.filter((w) => dayFloat(w.at) >= cutoff).map((w) => ({ at: w.at, kg: w.kg, basis: w.basis })),
  }
}
