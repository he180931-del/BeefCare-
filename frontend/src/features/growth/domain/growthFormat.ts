const pad = (n: number) => String(n).padStart(2, '0')

export const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
export const fmtDateTime = (iso: string) => `${fmtDate(iso)} ${iso.slice(11, 16)}`
export const fmtDayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const fmtDec = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',')
export const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : fmtDec(n, 1))

/** Số ngày (có phần lẻ) kể từ 1970 của 'yyyy-mm-dd' hoặc 'yyyy-mm-ddTHH:mm'; dùng để trừ hai mốc thời gian. */
export function dayFloat(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const hh = Number(iso.slice(11, 13) || 0)
  const mm = Number(iso.slice(14, 16) || 0)
  return Date.UTC(y, m - 1, d, hh, mm) / 86_400_000
}

export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.slice(0, 10).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
