const TZ = 'Asia/Ho_Chi_Minh'
const parts = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', ...opts }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]))

export const formatDayMonth = (iso: string) => { const p = parts(iso, { day: '2-digit', month: '2-digit' }); return `${p.day}/${p.month}` }
export const formatTime = (iso: string) => { const p = parts(iso, { hour: '2-digit', minute: '2-digit' }); return `${p.hour}:${p.minute}` }
export const formatDayMonthTime = (iso: string) => `${formatDayMonth(iso)} ${formatTime(iso)}`
export const formatFull = (iso: string) => { const p = parts(iso, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` }
export const formatFullDate = (iso: string) => formatFull(iso).slice(0, 10)

export const ROLE_LABEL = { OWNER: 'Chủ trại', MANAGER: 'Quản lý', TECHNICIAN: 'Kỹ thuật viên' } as const
