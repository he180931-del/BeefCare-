/** Canonical API value and fixed business offset for all of BeefCare. */
export const FARM_TIME_ZONE_ID = 'Asia/Ho_Chi_Minh'
// IANA uses reversed signs for the fixed Etc/GMT zones.
export const DEFAULT_FARM_TIME_ZONE = 'Etc/GMT-7'
export const BUSINESS_OFFSET = '+07:00'
export const ACCEPTED_FARM_TIME_ZONES = new Set([FARM_TIME_ZONE_ID, 'Asia/Bangkok', 'Asia/Vientiane', BUSINESS_OFFSET, 'UTC+07:00'])
export const BUSINESS_OFFSET_MS = 7 * 60 * 60 * 1000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/

/** Local form/demo dates use UTC+7. Instants with an explicit offset keep their meaning. */
export function parseBusinessTime(value: string): number {
  if (DATE_ONLY.test(value)) return Date.parse(`${value}T00:00:00${BUSINESS_OFFSET}`)
  if (LOCAL_DATE_TIME.test(value)) return Date.parse(`${value.replace(' ', 'T')}${BUSINESS_OFFSET}`)
  return Date.parse(value)
}

export function businessDateTime(date = new Date()): string {
  const wallTime = new Date(date.getTime() + BUSINESS_OFFSET_MS)
  return Number.isNaN(wallTime.getTime()) ? '' : wallTime.toISOString().slice(0, 19)
}

export const businessDate = (date = new Date()): string => businessDateTime(date).slice(0, 10)

export function addCalendarDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function toBusinessTime(instant: unknown): string {
  return typeof instant === 'string' ? businessDateTime(new Date(parseBusinessTime(instant))) : ''
}

/** Instant ISO → yyyy-mm-ddTHH:mm at UTC+7. */
export const toFarmLocal = (instant: unknown) => toBusinessTime(instant).slice(0, 16)

/** Local form time → ISO timestamp with the fixed UTC+7 offset. */
export function fromFarmLocal(local: string): string {
  if (!LOCAL_DATE_TIME.test(local)) return local
  const iso = local.replace(' ', 'T')
  return `${iso.length === 16 ? `${iso}:00` : iso}${BUSINESS_OFFSET}`
}
