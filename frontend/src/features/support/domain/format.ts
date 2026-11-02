// Thời điểm lưu dạng chuỗi ISO cục bộ ("2026-10-18T09:40:00") nên hiển thị không phụ thuộc múi giờ.
const pad = (n: number) => String(n).padStart(2, '0')

export const toLocalIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

function parts(iso: string) {
  const [date, time = '00:00'] = iso.split('T')
  const [y, m, d] = date.split('-')
  return { y, m, d, hm: time.slice(0, 5) }
}

/** 18/10 09:40 */
export const formatDayTime = (iso: string) => {
  const p = parts(iso)
  return `${p.d}/${p.m} ${p.hm}`
}
/** 18/10/2026 */
export const formatDate = (iso: string) => {
  const p = parts(iso)
  return `${p.d}/${p.m}/${p.y}`
}
/** 18/10/2026 09:40 */
export const formatDateTime = (iso: string) => {
  const p = parts(iso)
  return `${p.d}/${p.m}/${p.y} ${p.hm}`
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}
