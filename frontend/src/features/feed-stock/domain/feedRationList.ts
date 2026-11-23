import { businessDate } from '../../../shared/lib/date/farmTime'
import type { FeedRation } from '../types/feedRation'

/** Trạng thái hiệu lực của một phiên bản khẩu phần tại ngày `today` (mặc định hôm nay theo giờ trại). */
export const rationStatusForDate = (row: Pick<FeedRation, 'effectiveFrom' | 'effectiveTo'> & Partial<Pick<FeedRation, 'status'>>, today = businessDate()) => {
  if (row.status === 'CANCELLED') return 'CANCELLED'
  if (row.effectiveFrom > today) return 'SCHEDULED'
  if (row.effectiveTo && row.effectiveTo < today) return 'ENDED'
  return 'EFFECTIVE'
}

export type FeedRationStatusFilter = 'CURRENT' | 'ENDED' | 'CANCELLED' | 'ALL'
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
      : filters.status === 'CANCELLED'
        ? status === 'CANCELLED'
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
