export const money = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('vi-VN'))

export const kg = (n: number | null | undefined) => `${money(n)} kg`

export const dmy = (iso: string | null | undefined) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const dm = (iso: string | null | undefined) => dmy(iso).slice(0, 5)
