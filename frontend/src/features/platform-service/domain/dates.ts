const pad = (n: number) => String(n).padStart(2, '0')

/** Giờ Việt Nam (UTC+7) dạng yyyy-mm-ddTHH:mm:ss. */
export function vnNow(d = new Date()) {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 19)
}
export const toDate = (iso: string) => iso.slice(0, 10)

function parse(d: string) {
  const [y = 1970, m = 1, day = 1] = d.split('-').map(Number)
  return { y, m, day }
}
function format(t: Date) {
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
export function addDays(d: string, n: number) {
  const { y, m, day } = parse(d)
  const t = new Date(Date.UTC(y, m - 1, day))
  t.setUTCDate(t.getUTCDate() + n)
  return format(t)
}
/** 29/02 + n năm sang năm không nhuận thành 28/02 (GBR-73). */
export function addYears(d: string, n: number) {
  const { y, m, day } = parse(d)
  const t = new Date(Date.UTC(y + n, m - 1, day))
  if (t.getUTCMonth() !== m - 1) return format(new Date(Date.UTC(y + n, m - 1, 28)))
  return format(t)
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return `${iso.slice(11, 16)} ${fmtDate(iso)}`
}
export function fmtShort(iso: string) {
  return `${iso.slice(11, 16)} ${fmtDate(iso).slice(0, 5)}`
}
export function fmtSeconds(iso: string | null | undefined) {
  if (!iso) return '—'
  return `${iso.slice(11, 19)} ${fmtDate(iso)}`
}
export function fmtMoney(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
export const fmtVnd = (n: number) => `${fmtMoney(n)} đ`
