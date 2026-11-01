import { FEED_STOCK_MOCK } from './feedStockMock'
import type { FeedRation, FeedRationComponent } from '../types/feedRation'

/** Synthetic rows for local demos only; IDs and quantities are not farm data. */
const localDate = (offsetDays = 0) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const rationStatusForDate = (row: Pick<FeedRation, 'effectiveFrom' | 'effectiveTo'>, today = localDate()) => {
  if (row.effectiveFrom > today) return 'SCHEDULED'
  if (row.effectiveTo && row.effectiveTo < today) return 'ENDED'
  return 'EFFECTIVE'
}

function component(feedItemId: number, session1Kg: number, session2Kg: number, session3Kg = 0): FeedRationComponent {
  const feed = FEED_STOCK_MOCK.find((row) => row.feedItemId === feedItemId)!
  const dailyKg = session1Kg + session2Kg + session3Kg
  const unitCost = feed.onHandKg > 0 ? feed.stockValue / feed.onHandKg : null
  return {
    feedItemId,
    feedCode: feed.code,
    feedName: feed.name,
    session1Kg,
    session2Kg,
    session3Kg,
    dailyKg,
    estimatedDailyCost: unitCost === null ? null : Math.round(dailyKg * unitCost),
  }
}

export const FEED_RATION_MOCK: FeedRation[] = [
  {
    id: 8001,
    rationCode: 'KP-01',
    versionNo: 1,
    name: 'Khẩu phần bò sinh sản',
    herdGroup: 'BREEDING_FEMALES',
    basis: 'Bản minh họa',
    effectiveFrom: localDate(-45),
    effectiveTo: null,
    status: 'EFFECTIVE',
    sessionsPerDay: 2,
    sessionTimes: ['06:30', '16:30'],
    penIds: [1, 2],
    components: [component(101, 0.5, 0.5), component(102, 0.25, 0.25)],
  },
  {
    id: 8002,
    rationCode: 'KP-02',
    versionNo: 1,
    name: 'Khẩu phần vỗ béo',
    herdGroup: 'FATTENING',
    basis: 'Bản minh họa',
    effectiveFrom: localDate(14),
    effectiveTo: null,
    status: 'SCHEDULED',
    sessionsPerDay: 2,
    sessionTimes: ['06:30', '16:30'],
    penIds: [4],
    components: [component(102, 0.6, 0.6)],
  },
  {
    id: 8003,
    rationCode: 'KP-03',
    versionNo: 1,
    name: 'Khẩu phần bê',
    herdGroup: 'CALVES',
    basis: 'Bản minh họa',
    effectiveFrom: localDate(-120),
    effectiveTo: localDate(-30),
    status: 'ENDED',
    sessionsPerDay: 2,
    sessionTimes: ['06:30', '16:30'],
    penIds: [3],
    components: [component(103, 0.2, 0.2)],
  },
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

export function summarizeFeedRations(rows: readonly FeedRation[], pens: readonly { id: number; headcount: number; status: string }[]) {
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
    pensWithoutRation: activePens.filter((pen) => pen.headcount > 0 && !effectiveByPen.has(pen.id)).length,
  }
}
