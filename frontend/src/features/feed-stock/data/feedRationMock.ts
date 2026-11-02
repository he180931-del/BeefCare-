import { FEED_CATALOGUE_MOCK } from './feedCatalogueMock'
import { daysFromToday } from './feedDemoDates'
import type { FeedRation, FeedRationComponent } from '../types/feedRation'

/** Synthetic rows for local demos only; the rations and costs follow the Khẩu phần frames. */
export const rationStatusForDate = (row: Pick<FeedRation, 'effectiveFrom' | 'effectiveTo'>, today = daysFromToday(0)) => {
  if (row.effectiveFrom > today) return 'SCHEDULED'
  if (row.effectiveTo && row.effectiveTo < today) return 'ENDED'
  return 'EFFECTIVE'
}

function component(feedItemId: number, session1Kg: number, session2Kg: number, session3Kg = 0): FeedRationComponent {
  const feed = FEED_CATALOGUE_MOCK.find((row) => row.id === feedItemId)!
  const dailyKg = Math.round((session1Kg + session2Kg + session3Kg) * 1000) / 1000
  return {
    feedItemId,
    feedCode: feed.code,
    feedName: feed.name,
    session1Kg,
    session2Kg,
    session3Kg,
    dailyKg,
    estimatedDailyCost: Math.round(dailyKg * feed.unitCost),
  }
}

function ration(id: number, rationCode: string, versionNo: number, name: string, herdGroup: string, basis: string, from: number, to: number | null, penIds: number[], components: FeedRationComponent[]): FeedRation {
  const effectiveFrom = daysFromToday(from)
  const effectiveTo = to === null ? null : daysFromToday(to)
  return {
    id, rationCode, versionNo, name, herdGroup, basis, effectiveFrom, effectiveTo,
    status: rationStatusForDate({ effectiveFrom, effectiveTo }),
    sessionsPerDay: 2, sessionTimes: ['06:30', '16:30'], penIds, components,
  }
}

export const FEED_RATION_MOCK: FeedRation[] = [
  ration(8001, 'KP-01', 1, 'Bò cái sinh sản – duy trì', 'BREEDING_FEMALES', 'Theo tư vấn kỹ sư chăn nuôi', -21, null, [1, 2], [component(101, 4.5, 4.5), component(102, 0.6, 0.6), component(105, 0.35, 0.35)]),
  ration(8002, 'KP-02', 1, 'Vỗ béo giai đoạn cuối', 'FATTENING', 'Theo tư vấn kỹ sư chăn nuôi – tăng tinh 30 ngày cuối trước xuất bán', -37, 0, [4], [component(104, 5, 5), component(106, 0.5, 0.5)]),
  ration(8003, 'KP-02', 2, 'Vỗ béo giai đoạn cuối', 'FATTENING', 'Theo tư vấn kỹ sư chăn nuôi – tăng tinh 30 ngày cuối trước xuất bán', 1, null, [4], [component(104, 4.75, 4.75), component(106, 0.75, 0.75)]),
  ration(8004, 'KP-03', 1, 'Bò đực giống', 'BREEDING_BULLS', 'Duy trì thể trạng đực giống', -52, null, [5], [component(101, 3, 3), component(105, 0.5, 0.5), component(107, 0.025, 0.025)]),
  ration(8005, 'KP-04', 1, 'Bê con – tập ăn', 'CALVES', 'Tập ăn cho bê theo mẹ', -21, null, [3], [component(103, 1, 1), component(108, 0.25, 0.25)]),
  ration(8006, 'KP-06', 1, 'Vỗ béo giai đoạn đầu', 'FATTENING', 'Khẩu phần giai đoạn đầu', -143, -38, [4], [component(101, 3, 3), component(104, 2, 2), component(106, 0.25, 0.25)]),
]

export type FeedRationStatusFilter = 'CURRENT' | 'ENDED' | 'ALL'
export type FeedRationFilters = {
  query?: string
  status?: FeedRationStatusFilter
  herdGroup?: string | 'ALL'
  from?: string
  to?: string
}

export function filterFeedRations(rows: readonly FeedRation[], filters: FeedRationFilters = {}) {
  const query = filters.query?.trim().toLocaleLowerCase('vi') ?? ''
  return rows.filter((row) => {
    const status = row.status
    const statusMatches = filters.status === 'ENDED'
      ? status === 'ENDED'
      : filters.status === 'ALL'
        ? true
        : status === 'EFFECTIVE' || status === 'SCHEDULED'
    const groupMatches = !filters.herdGroup || filters.herdGroup === 'ALL' || row.herdGroup === filters.herdGroup
    const fromMatches = !filters.from || row.effectiveFrom >= filters.from
    const toMatches = !filters.to || row.effectiveFrom <= filters.to
    const searchText = `${row.rationCode} ${row.name} ${row.herdGroup} ${row.penIds.join(' ')}`.toLocaleLowerCase('vi')
    return statusMatches && groupMatches && fromMatches && toMatches && (!query || searchText.includes(query))
  })
}

export function summarizeFeedRations(rows: readonly FeedRation[], pens: readonly { id: number; name: string; headcount: number; status: string }[]) {
  const effective = rows.filter((row) => row.status === 'EFFECTIVE')
  const activePens = pens.filter((pen) => pen.status === 'ACTIVE')
  const effectiveByPen = new Map<number, FeedRation>()
  effective.forEach((ration) => ration.penIds.forEach((penId) => {
    if (!effectiveByPen.has(penId)) effectiveByPen.set(penId, ration)
  }))
  const coveredPens = activePens.filter((pen) => effectiveByPen.has(pen.id))
  const headCovered = coveredPens.reduce((sum, pen) => sum + pen.headcount, 0)
  const plannedDailyKg = coveredPens.reduce((sum, pen) => {
    const ration = effectiveByPen.get(pen.id)!
    return sum + pen.headcount * ration.components.reduce((total, item) => total + item.dailyKg, 0)
  }, 0)
  const plannedDailyCost = coveredPens.every((pen) => effectiveByPen.get(pen.id)!.components.every((item) => item.estimatedDailyCost !== null))
    ? coveredPens.reduce((sum, pen) => sum + pen.headcount * effectiveByPen.get(pen.id)!.components.reduce((total, item) => total + (item.estimatedDailyCost ?? 0), 0), 0)
    : null
  return {
    effectiveRations: effective.length,
    pensCovered: coveredPens.length,
    headCovered,
    plannedDailyKg,
    plannedKgPerHead: headCovered === 0 ? null : plannedDailyKg / headCovered,
    plannedDailyCost,
    plannedCostPerHead: headCovered === 0 || plannedDailyCost === null ? null : plannedDailyCost / headCovered,
    pensWithoutRation: activePens.filter((pen) => !effectiveByPen.has(pen.id)).length,
    pensWithoutRationNames: activePens.filter((pen) => !effectiveByPen.has(pen.id)).map((pen) => pen.headcount > 0 ? pen.name : `${pen.name} (đang trống)`),
  }
}
