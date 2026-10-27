export const money = (n) => (n == null ? '—' : Number(n).toLocaleString('vi-VN'))

export const kg = (n) => `${money(n)} kg`

export const dmy = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const dm = (iso) => dmy(iso).slice(0, 5)
