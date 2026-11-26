/**
 * D82, SCR-19 #11 "Khai báo khi nhập": khai báo lịch sử trước nhập đàn (GBR-30) đọc lại từ hồ sơ bò. "Không rõ" luôn
 * hiện là "Không rõ", không bao giờ thành "Không".
 */

/** Một nhóm khai báo backend trả trong `entry.declarations`. */
export interface BackendDeclaration {
  category?: string | null
  status?: string | null
  vaccines?: Array<{ name?: string | null; date?: string | null }> | null
  description?: string | null
  informationSource?: string | null
  earlierCalvings?: number | null
  pregnantAtEntry?: string | null
  estMonthsPregnant?: number | null
}

/** Một dòng hiển thị: nhóm và nội dung đã ghép sẵn. */
export interface EntryDeclarationLine {
  label: string
  value: string
}

const LABELS: Record<string, string> = { VACCINATION: 'Tiêm phòng', DISEASE: 'Bệnh đã biết', REPRODUCTION: 'Sinh sản' }
const ORDER = ['VACCINATION', 'DISEASE', 'REPRODUCTION']
const dmy = (value: string) => value.split('-').reverse().join('/')

function vaccines(row: BackendDeclaration): string {
  const items = (row.vaccines ?? []).map((v) => `${v.name?.trim() || 'Vắc-xin không rõ tên'} (${v.date ? dmy(v.date) : 'không rõ ngày'})`)
  const text = items.length ? items.join('; ') : 'Có'
  return row.informationSource?.trim() ? `${text} · nguồn: ${row.informationSource.trim()}` : text
}

function reproduction(row: BackendDeclaration): string {
  const pregnancy = row.pregnantAtEntry === 'YES'
    ? `mang thai${row.estMonthsPregnant ? ` ~${row.estMonthsPregnant} tháng` : ''} khi nhập`
    : row.pregnantAtEntry === 'NO' ? 'không mang thai' : 'không rõ mang thai'
  const parts = [row.earlierCalvings == null ? '' : `${row.earlierCalvings} lứa đã đẻ`, pregnancy, row.description?.trim() ?? '']
  const text = parts.filter(Boolean).join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function value(row: BackendDeclaration): string {
  if (row.status === 'NONE') return 'Không'
  if (row.status !== 'KNOWN') return 'Không rõ'
  if (row.category === 'VACCINATION') return vaccines(row)
  if (row.category === 'REPRODUCTION') return reproduction(row)
  return row.description?.trim() || 'Có'
}

/**
 * Các dòng "Khai báo khi nhập" theo thứ tự Tiêm phòng, Bệnh đã biết, Sinh sản. Không có khai báo (bò sinh tại trại,
 * dữ liệu cũ) thì trả `undefined` để giao diện ẩn hẳn mục.
 */
export function entryDeclarationLines(rows: BackendDeclaration[] | null | undefined): EntryDeclarationLine[] | undefined {
  const known = (rows ?? []).filter((row) => row.category && LABELS[row.category])
  if (!known.length) return undefined
  return [...known]
    .sort((a, b) => ORDER.indexOf(String(a.category)) - ORDER.indexOf(String(b.category)))
    .map((row) => ({ label: LABELS[String(row.category)], value: value(row) }))
}
