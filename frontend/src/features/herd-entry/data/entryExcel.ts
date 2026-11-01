import type { BadgeTone } from '../../../components/ui'
import type { EntryCow } from '../../../types'

export const ENTRY_EXCEL_HEADERS = [
  'Số thẻ tai',
  'Tên gọi',
  'Giống *',
  'Giới tính *',
  'Tháng sinh (MM/YYYY) *',
  'Độ chính xác ngày sinh *',
  'Giai đoạn sống *',
  'Mục đích nuôi *',
  'Cân nhập (kg) *',
  'Cơ sở cân *',
  'Chuồng nhận *',
  'Đơn giá (đ/kg)',
] as const

export interface EntryExcelPreviewRow {
  line: number
  tag: string
  breed: string
  sex: string
  kg: number
  barn: string
  result: { tone: BadgeTone; text: string }
  cow: EntryCow | null
}

const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => typeof value === 'number'
  ? value
  : Number(text(value).replace(/\s/g, '').replace(/,/g, ''))

const birthMonth = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
  }
  const raw = text(value)
  const monthYear = /^(0?[1-9]|1[0-2])\/(\d{4})$/.exec(raw)
  if (monthYear) return `${monthYear[2]}-${monthYear[1].padStart(2, '0')}`
  const yearMonth = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw)
  return yearMonth ? `${yearMonth[1]}-${yearMonth[2]}` : null
}

export function parseEntryExcelRows(sheet: ReadonlyArray<ReadonlyArray<unknown>>): EntryExcelPreviewRow[] {
  if (!sheet.length) throw new Error('File Excel không có dữ liệu.')
  const header = sheet[0].map(text)
  const missing = ENTRY_EXCEL_HEADERS.filter((name) => !header.includes(name))
  if (missing.length) throw new Error(`File không đúng mẫu. Thiếu cột: ${missing.join(', ')}.`)

  const index = Object.fromEntries(ENTRY_EXCEL_HEADERS.map((name) => [name, header.indexOf(name)])) as Record<(typeof ENTRY_EXCEL_HEADERS)[number], number>
  const sourceRows = sheet.slice(1).filter((row) => row.some((cell) => text(cell) !== ''))
  if (sourceRows.length > 200) throw new Error('Mỗi file chỉ được nhập tối đa 200 dòng dữ liệu.')

  const seenTags = new Set<string>()
  return sourceRows.map((row, rowIndex) => {
    const get = (name: (typeof ENTRY_EXCEL_HEADERS)[number]) => row[index[name]]
    const tag = text(get('Số thẻ tai'))
    const name = text(get('Tên gọi'))
    const breed = text(get('Giống *'))
    const sex = text(get('Giới tính *'))
    const dob = birthMonth(get('Tháng sinh (MM/YYYY) *'))
    const dobAccuracy = text(get('Độ chính xác ngày sinh *'))
    const stage = text(get('Giai đoạn sống *'))
    const purpose = text(get('Mục đích nuôi *'))
    const weight = number(get('Cân nhập (kg) *'))
    const weightBasis = text(get('Cơ sở cân *'))
    const barn = text(get('Chuồng nhận *')).toUpperCase()
    const unitPrice = number(get('Đơn giá (đ/kg)'))
    const errors: string[] = []

    if (!breed) errors.push('thiếu giống')
    if (!['Đực', 'Cái'].includes(sex)) errors.push('giới tính phải là Đực hoặc Cái')
    if (!dob) errors.push('tháng sinh phải có dạng MM/YYYY')
    if (!['Chính xác', 'Ước tính', 'Không rõ'].includes(dobAccuracy)) errors.push('độ chính xác ngày sinh không hợp lệ')
    if (!stage) errors.push('thiếu giai đoạn sống')
    if (!purpose) errors.push('thiếu mục đích nuôi')
    if (!Number.isFinite(weight) || weight < 1 || weight > 1500) errors.push('cân nhập phải từ 1 đến 1500 kg')
    if (!['Cân thực tế', 'Ước tính'].includes(weightBasis)) errors.push('cơ sở cân không hợp lệ')
    if (!['A1', 'A2', 'B1', 'B2', 'C1'].includes(barn)) errors.push('chuồng nhận không hợp lệ')
    if (!Number.isFinite(unitPrice) || unitPrice < 0) errors.push('đơn giá không hợp lệ')
    if (tag && seenTags.has(tag.toLocaleUpperCase('vi-VN'))) errors.push('thẻ tai bị trùng trong file')
    if (tag) seenTags.add(tag.toLocaleUpperCase('vi-VN'))

    const result = errors.length
      ? { tone: 'err' as const, text: `Lỗi · ${errors.join('; ')}` }
      : tag
        ? { tone: 'ok' as const, text: 'Hợp lệ' }
        : { tone: 'warn' as const, text: 'Cảnh báo · chưa có thẻ tai' }

    const cow: EntryCow | null = errors.length ? null : {
      tag,
      name,
      breed,
      sex,
      dob: dob!,
      dobAccuracy,
      stage,
      purpose,
      weight,
      estimated: weightBasis === 'Ước tính',
      barn,
      unitPrice,
      hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
    }

    return { line: rowIndex + 2, tag, breed, sex, kg: Number.isFinite(weight) ? weight : 0, barn, result, cow }
  })
}
