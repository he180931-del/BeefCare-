import { addCalendarDays, businessDate } from '../../../shared/lib/date/farmTime'
import type { FeedStockRow } from '../types'
import type { FeedRation, FeedRationFormValues, FeedRationPenOption } from '../types/feedRation'

export const RATION_GROUPS = [
  { value: 'CALVES', label: 'Bê' },
  { value: 'FATTENING', label: 'Vỗ béo' },
  { value: 'BREEDING_BULLS', label: 'Đực giống' },
  { value: 'BREEDING_FEMALES', label: 'Bò cái sinh sản' },
  { value: 'YOUNG_STOCK', label: 'Bò tơ' },
  { value: 'OTHER', label: 'Khác' },
] as const

export const rationGroupLabel = (value: string) => (RATION_GROUPS.find((group) => group.value === value)?.label ?? value) || '—'

export function localRationDate(offsetDays = 0) {
  return addCalendarDays(businessDate(), offsetDays)
}

export function nextRationCode(rows: readonly FeedRation[]) {
  const next = Math.max(0, ...rows.map((row) => Number(row.rationCode.match(/^KP-(\d+)$/)?.[1] ?? 0))) + 1
  return `KP-${String(next).padStart(2, '0')}`
}

export function rationCodeDisplay(recordCode: string | undefined, rows: readonly FeedRation[], serverGeneratesCode: boolean) {
  if (recordCode) return recordCode
  return serverGeneratesCode ? 'Tự cấp mã khi lưu' : nextRationCode(rows)
}

export function initialFeedRationForm(record: FeedRation | null): FeedRationFormValues {
  const next = localRationDate(1)
  // Saving always creates a new version. A scheduled version's replacement starts the day after it.
  const afterRecord = record?.effectiveFrom && record.effectiveFrom >= next
    ? record.status === 'SCHEDULED'
      ? localRationDate(Math.max(1, Math.round((new Date(`${record.effectiveFrom}T00:00:00Z`).getTime() - new Date(`${localRationDate(0)}T00:00:00Z`).getTime()) / 86_400_000) + 1))
      : record.effectiveFrom
    : next
  return {
    name: record?.name ?? '',
    herdGroup: record?.herdGroup ?? '',
    basis: record?.basis ?? '',
    effectiveFrom: afterRecord,
    sessionsPerDay: record?.sessionsPerDay ?? 2,
    sessionTimes: record ? Array.from({ length: record.sessionsPerDay }, (_, index) => record.sessionTimes?.[index] ?? ['06:30', '16:30', '20:00'][index]) : ['06:30', '16:30'],
    penIds: record ? [...record.penIds] : [],
    components: record
      ? record.components.map((component) => ({
        feedItemId: String(component.feedItemId),
        session1Kg: String(component.session1Kg),
        session2Kg: String(component.session2Kg),
        session3Kg: String(component.session3Kg),
      }))
      : [{ feedItemId: '', session1Kg: '0', session2Kg: '0', session3Kg: '0' }],
  }
}

export function previewFeedRation(values: FeedRationFormValues, feeds: readonly FeedStockRow[], pens: readonly FeedRationPenOption[]) {
  const activePens = pens.filter((pen) => values.penIds.includes(pen.id))
  const headcount = activePens.reduce((sum, pen) => sum + pen.headcount, 0)
  const lines = values.components.map((component) => {
    const feed = feeds.find((row) => row.feedItemId === Number(component.feedItemId))
    const session1Kg = Number(component.session1Kg) || 0
    const session2Kg = values.sessionsPerDay >= 2 ? Number(component.session2Kg) || 0 : 0
    const session3Kg = values.sessionsPerDay >= 3 ? Number(component.session3Kg) || 0 : 0
    const dailyKg = session1Kg + session2Kg + session3Kg
    const unitCost = feed && feed.onHandKg > 0 ? feed.stockValue / feed.onHandKg : null
    const dailyCost = unitCost === null ? null : Math.round(dailyKg * unitCost)
    const plannedForPens = dailyKg * headcount
    return { component, feed, session1Kg, session2Kg, session3Kg, dailyKg, dailyCost, plannedForPens,
      daysOfCover: feed && plannedForPens > 0 ? feed.onHandKg / plannedForPens : null }
  })
  const dailyKgPerHead = lines.reduce((sum, line) => sum + line.dailyKg, 0)
  const dailyCostPerHead = lines.every((line) => line.dailyCost !== null) ? lines.reduce((sum, line) => sum + (line.dailyCost ?? 0), 0) : null
  return {
    lines,
    headcount,
    dailyKgPerHead,
    dailyCostPerHead,
    plannedDailyKg: dailyKgPerHead * headcount,
    plannedDailyCost: dailyCostPerHead === null ? null : dailyCostPerHead * headcount,
  }
}

export type { FeedRation }
