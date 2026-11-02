const TZ = 'Asia/Ho_Chi_Minh'

const parts = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', ...opts }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]))

/** yyyy-MM-dd theo múi giờ của trại. */
export const dateKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
export const formatDayMonth = (iso: string) => { const p = parts(iso, { day: '2-digit', month: '2-digit' }); return `${p.day}/${p.month}` }
export const formatTime = (iso: string) => { const p = parts(iso, { hour: '2-digit', minute: '2-digit' }); return `${p.hour}:${p.minute}` }
export const formatDateTime = (iso: string) => { const p = parts(iso, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}` }

/** 'yyyy-mm-dd' -> 'dd/mm/yyyy' */
export const formatKey = (key: string) => { const [y, m, d] = key.split('-'); return `${d}/${m}/${y}` }
export const formatKeyShort = (key: string) => { const [, m, d] = key.split('-'); return `${d}/${m}` }
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const weekdayOf = (key: string) => WEEKDAY[new Date(`${key}T00:00:00Z`).getUTCDay()]

export const dayNumber = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000)
export const diffDays = (fromKey: string, toKey: string) => dayNumber(toKey) - dayNumber(fromKey)

export const fmtInt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
export const fmtDec = (n: number, digits = 2) => n.toFixed(digits).replace('.', ',')
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : 0)
