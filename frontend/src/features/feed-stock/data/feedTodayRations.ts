import type { FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedRation, FeedRationPenOption } from '../types/feedRation'
import type { FeedStockRow } from '../types'

export const TODAY_SESSION_LABELS: Record<number, string> = { 1: 'Sáng', 2: 'Chiều', 3: 'Tối' }

export type TodayRationLine = {
  feedItemId: number
  code: string
  name: string
  plannedKg: number
  outOfStock: boolean
}

export type TodayRationPen = {
  pen: FeedRationPenOption
  ration: FeedRation | null
  record: FeedFeedingRecord | null
  lines: TodayRationLine[]
  plannedTotalKg: number
  hasSession: boolean
}

export function effectiveRationForPen(rations: readonly FeedRation[], penId: number, date: string) {
  return rations
    .filter((ration) => ration.penIds.includes(penId)
      && ration.effectiveFrom <= date
      && (!ration.effectiveTo || ration.effectiveTo >= date))
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom)
      || right.versionNo - left.versionNo)[0] ?? null
}

export function sessionsForToday(pens: readonly FeedRationPenOption[], rations: readonly FeedRation[], date: string) {
  const activePens = pens.filter((pen) => pen.status === 'ACTIVE' && pen.headcount > 0)
  const maxSessions = activePens.reduce((maximum, pen) => {
    const ration = effectiveRationForPen(rations, pen.id, date)
    return Math.max(maximum, ration?.sessionsPerDay ?? 0)
  }, 0)
  return Array.from({ length: maxSessions }, (_, index) => index + 1)
}

export function buildTodayRationPens({
  pens,
  rations,
  records,
  stock,
  date,
  sessionNo,
}: {
  pens: readonly FeedRationPenOption[]
  rations: readonly FeedRation[]
  records: readonly FeedFeedingRecord[]
  stock: readonly FeedStockRow[]
  date: string
  sessionNo: number
}): TodayRationPen[] {
  return pens
    .filter((pen) => pen.status === 'ACTIVE' && pen.headcount > 0)
    .map((pen) => {
      const ration = effectiveRationForPen(rations, pen.id, date)
      const hasSession = Boolean(ration && sessionNo <= ration.sessionsPerDay)
      const record = records
        .filter((row) => row.penId === pen.id && row.feedingDate === date && row.sessionNo === sessionNo && row.status === 'VALID')
        .sort((left, right) => right.version - left.version)[0] ?? null
      const lines = hasSession && ration
        ? ration.components.flatMap((component) => {
          const perHeadKg = sessionNo === 1 ? component.session1Kg
            : sessionNo === 2 ? component.session2Kg
              : component.session3Kg
          const plannedKg = Math.round(perHeadKg * pen.headcount * 10) / 10
          if (plannedKg <= 0) return []
          const feedStock = stock.find((row) => row.feedItemId === component.feedItemId)
          return [{
            feedItemId: component.feedItemId,
            code: component.feedCode,
            name: component.feedName,
            plannedKg,
            outOfStock: feedStock?.status === 'OUT_OF_STOCK' || (feedStock !== undefined && feedStock.onHandKg <= 0),
          }]
        })
        : []
      return {
        pen,
        ration,
        record,
        lines,
        plannedTotalKg: lines.reduce((sum, line) => sum + line.plannedKg, 0),
        hasSession,
      }
    })
}

/** Expected vs recorded sessions of the day (REM-11): expected = pens with an effective ration, per session of that ration. */
export function summarizeTodaySessions(input: { pens: readonly FeedRationPenOption[]; rations: readonly FeedRation[]; records: readonly FeedFeedingRecord[]; stock: readonly FeedStockRow[]; date: string }) {
  let expected = 0
  let recorded = 0
  const missing: Array<{ pen: FeedRationPenOption; sessionNo: number }> = []
  for (const sessionNo of sessionsForToday(input.pens, input.rations, input.date)) {
    for (const row of buildTodayRationPens({ ...input, sessionNo })) {
      if (!row.hasSession) continue
      expected += 1
      if (row.record) recorded += 1
      else missing.push({ pen: row.pen, sessionNo })
    }
  }
  return { expected, recorded, missing }
}
