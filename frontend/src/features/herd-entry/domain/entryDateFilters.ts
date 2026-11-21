export function previousQuarterStart(date: string): string {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7)) - 1
  const currentQuarterStart = Math.floor(month / 3) * 3
  const previousQuarterMonth = currentQuarterStart - 3
  const previousYear = previousQuarterMonth < 0 ? year - 1 : year
  const normalizedMonth = (previousQuarterMonth + 12) % 12 + 1
  return `${previousYear}-${String(normalizedMonth).padStart(2, '0')}-01`
}
