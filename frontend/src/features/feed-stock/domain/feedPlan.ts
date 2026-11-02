import type { FeedRation, FeedRationPenOption } from '../types/feedRation'

export const SESSION_NAMES: Record<number, string> = { 1: 'sáng', 2: 'chiều', 3: 'tối' }
export const DEFAULT_SESSION_TIMES: Record<number, string> = { 1: '06:30', 2: '16:30', 3: '20:00' }

const roundKg = (value: number) => Math.round(value * 10) / 10

/** Planned quantity of one session = kg per head of the ration × headcount of the pen (GBR-102). */
export function planForSession(ration: FeedRation | null, pen: FeedRationPenOption | undefined, sessionNo: number) {
  if (!ration || !pen || sessionNo > ration.sessionsPerDay) return [] as Array<{ feedItemId: number; plannedKg: number }>
  return ration.components.flatMap((line) => {
    const perHead = sessionNo === 1 ? line.session1Kg : sessionNo === 2 ? line.session2Kg : line.session3Kg
    const plannedKg = roundKg(perHead * pen.headcount)
    return plannedKg > 0 ? [{ feedItemId: line.feedItemId, plannedKg }] : []
  })
}

/** Time of a session: the first ration that defines one, otherwise the default 06:30 / 16:30. */
export function sessionTimeFor(rations: readonly FeedRation[], sessionNo: number) {
  return rations.find((ration) => ration.sessionTimes?.[sessionNo - 1])?.sessionTimes?.[sessionNo - 1] ?? DEFAULT_SESSION_TIMES[sessionNo] ?? ''
}

/** "Trần Quốc Long" -> "T. Q. Long". */
export function shortPersonName(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? '—'
  return `${parts.slice(0, -1).map((part) => `${part[0]}.`).join(' ')} ${parts[parts.length - 1]}`
}
