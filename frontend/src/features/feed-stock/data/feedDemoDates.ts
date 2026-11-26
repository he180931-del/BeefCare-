import { addCalendarDays, businessDate, businessDateTime } from '../../../shared/lib/date/farmTime'
// Demo seeds are anchored on today so "today", "not in the future" and expiry rules behave like live data.
export const isoDate = businessDate
export const daysFromToday = (offset: number) => addCalendarDays(businessDate(), offset)
export const today = businessDate
export function isoAt(offset: number, time: string) {
  return `${daysFromToday(offset)}T${time}:00`
}

export const localNowIso = businessDateTime
