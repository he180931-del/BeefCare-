const pad = (n: number) => String(n).padStart(2, '0')

export const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
export const fmtDateTime = (iso: string) => `${fmtDate(iso)} ${iso.slice(11, 16)}`
export const fmtDayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const fmtMonthYear = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`

const parts = (iso: string) => iso.slice(0, 10).split('-').map(Number) as [number, number, number]

export function dayNumber(iso: string): number {
  const [y, m, d] = parts(iso)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

const fromDayNumber = (n: number) => {
  const t = new Date(n * 86_400_000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export const addDays = (iso: string, days: number) => fromDayNumber(dayNumber(iso) + days)

/** Cộng tháng, kẹp ngày về cuối tháng (31/08 + 6 tháng = 28/02). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parts(iso)
  const first = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`
}
