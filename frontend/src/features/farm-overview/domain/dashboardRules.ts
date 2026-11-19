import { diffDays } from './format'
import type { AttentionRow, DashboardFilters, DashboardSeed, DashboardView, HerdCell, HerdGroup, LifeStage, ViewerRole } from '../types'

export const HERD_GROUP_ORDER: HerdGroup[] = ['BREEDING_FEMALE', 'YOUNG_STOCK', 'FATTENING', 'CALF', 'BREEDING_BULL', 'OTHER']
export const HERD_GROUP_LABEL: Record<HerdGroup, string> = {
  BREEDING_FEMALE: 'Bò cái sinh sản', YOUNG_STOCK: 'Bò tơ', FATTENING: 'Vỗ béo', CALF: 'Bê', BREEDING_BULL: 'Đực giống', OTHER: 'Khác',
}
export const LIFE_STAGES: LifeStage[] = ['UNWEANED_CALF', 'WEANED_CALF', 'YOUNG_STOCK', 'ADULT']
export const LIFE_STAGE_LABEL: Record<LifeStage, string> = {
  UNWEANED_CALF: 'Bê chưa cai sữa', WEANED_CALF: 'Bê đã cai sữa', YOUNG_STOCK: 'Bò tơ', ADULT: 'Trưởng thành',
}

/** ADG của kỳ dài (> 60 ngày) thấp hơn kỳ 30 ngày trong dữ liệu mẫu. */
export const ADG_LONG_WINDOW_ADJUST = -0.03
/** GBR-39: ADG chỉ hiển thị khi hai lần cân cách nhau ít nhất 14 ngày. */
export const ADG_MIN_DAYS = 14

export function periodDays(f: DashboardFilters): number {
  if (f.period !== 'custom') return Number(f.period)
  if (!f.from || !f.to) return 30
  return diffDays(f.from, f.to) + 1
}

/** Trả về thông báo lỗi tiếng Việt hoặc null (MSG-COM-06, MSG-COM-11). */
export function validateFilters(f: DashboardFilters): string | null {
  if (f.period !== 'custom') return null
  if (!f.from || !f.to) return 'Kỳ là bắt buộc.'
  if (f.from > f.to) return 'Ngày bắt đầu không được sau ngày kết thúc.'
  return null
}

const sum = (cells: HerdCell[], key: keyof HerdCell) => cells.reduce((total, cell) => total + (cell[key] as number), 0)

export function filterCells(cells: HerdCell[], f: DashboardFilters) {
  return cells.filter((c) => (!f.pen || c.pen === f.pen) && (!f.herdGroup || c.group === f.herdGroup) && (!f.lifeStage || c.stage === f.lifeStage))
}

const wavg = (cells: HerdCell[]) => {
  const n = sum(cells, 'adgN')
  return cells.reduce((total, c) => total + c.adg30 * c.adgN, 0) / n
}
const round2 = (n: number) => Math.round(n * 100) / 100

export function buildDashboard(seed: DashboardSeed, f: DashboardFilters, role: ViewerRole): DashboardView {
  const cells = filterCells(seed.cells, f)
  const farmHead = sum(seed.cells, 'head')
  const empty = farmHead === 0
  const days = periodDays(f)
  const adj = days > 60 ? ADG_LONG_WINDOW_ADJUST : 0
  const adgCells = cells.filter((c) => c.adgN > 0).map((c) => ({ ...c, adg30: c.adg30 + adj }))

  const head = sum(cells, 'head')
  const groups = f.herdGroup ? [f.herdGroup] : HERD_GROUP_ORDER
  const structure = groups.map((group) => {
    const rows = cells.filter((c) => c.group === group)
    return { group, label: HERD_GROUP_LABEL[group], head: sum(rows, 'head'), pregnant: group === 'BREEDING_FEMALE' ? sum(rows, 'pregnant') : null }
  })

  const pens = seed.pens.filter((p) => !f.pen || p.code === f.pen)
  const penHeads = pens.map((p) => ({ capacity: p.capacity, head: sum(seed.cells.filter((c) => c.pen === p.code), 'head') }))
  const capacity = penHeads.reduce((t, p) => t + p.capacity, 0)
  const occupied = penHeads.reduce((t, p) => t + p.head, 0)

  const attention: AttentionRow[] = seed.attention
    .filter((a) => (!f.pen || a.pen === f.pen) && (!f.herdGroup || a.group === f.herdGroup) && (!f.lifeStage || a.stage === f.lifeStage))
    .map(({ to, ownerOnly, ...row }) => ({ ...row, to: ownerOnly && role !== 'OWNER' ? null : to }))

  return {
    farmName: seed.farmName,
    activeCattle: farmHead,
    serviceStatus: seed.serviceLabel,
    serviceUntil: seed.serviceUntil,
    generatedAt: seed.generatedAt,
    empty,
    pens: seed.pens,
    indicators: {
      m01: { total: head, zebu: sum(cells, 'zebu'), sind: head - sum(cells, 'zebu') },
      m02: { total: sum(cells, 'treating') + sum(cells, 'monitoring'), treating: sum(cells, 'treating'), withdrawal: sum(cells, 'withdrawal') },
      m03: { total: sum(cells, 'dosesDue'), overdue: sum(cells, 'dosesOverdue') },
      m04: { total: sum(cells, 'calving30'), within7: sum(cells, 'calving7') },
      m05: { rows: structure, total: head, pregnant: sum(cells, 'pregnant') },
      m06: {
        days,
        value: days >= ADG_MIN_DAYS && adgCells.length ? round2(wavg(adgCells)) : null,
        unavailable: days < ADG_MIN_DAYS ? 'PERIOD_TOO_SHORT' : adgCells.length ? null : 'NO_DATA',
        byGroup: HERD_GROUP_ORDER.flatMap((g) => {
          const rows = adgCells.filter((c) => c.group === g)
          return rows.length && days >= ADG_MIN_DAYS ? [{ label: HERD_GROUP_LABEL[g], value: round2(wavg(rows)) }] : []
        }),
      },
      m07: empty ? null : { total: sum(cells, 'weighOverdue') },
      m08: empty ? null : { head: occupied, capacity, percent: capacity ? Math.round((occupied * 100) / capacity) : 0, fullPens: penHeads.filter((p) => p.head >= p.capacity).length },
      m09: empty ? null : seed.reproduction,
    },
    attention,
  }
}
