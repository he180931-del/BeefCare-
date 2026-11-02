// Demo seeds are anchored on today so "today", "not in the future" and expiry rules behave like live data.
const pad = (value: number) => String(value).padStart(2, '0')
export const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export function daysFromToday(offset: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return isoDate(date)
}
export const today = () => daysFromToday(0)
export function isoAt(offset: number, time: string) {
  return `${daysFromToday(offset)}T${time}:00`
}
