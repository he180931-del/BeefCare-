import type { BcsScale, NumericParameterKey, ParameterValues, ParameterVersionCommand } from '../types'
import { checkNumber, checkText, formatDate, required, type FieldErrorMap } from './catalogueRules'

export interface ParameterFieldDef {
  key: NumericParameterKey
  label: string
  /** Tên dùng trong dòng "Thay đổi" của lịch sử, khi khác nhãn ô. */
  changeLabel?: string
  unit: string
  min: number
  max: number
  integer?: boolean
  optional?: boolean
  hint?: string
}
export interface ParameterGroupDef {
  id: string
  title: string
  sub: string
  minCol: number
  hasBcs?: boolean
  fields: ParameterFieldDef[]
}

export const BCS_SCALES: Array<{ value: BcsScale; label: string }> = [
  { value: '1-5', label: '1–5 · 0,5' },
  { value: '1-9', label: '1–9 · 1' },
]

export const PARAMETER_GROUPS: ParameterGroupDef[] = [
  {
    id: 'life', title: 'Giai đoạn sống', sub: 'Đề xuất giai đoạn khi nhập đàn và nhắc chuyển giai đoạn', minCol: 140,
    fields: [
      { key: 'weaningAgeMonths', label: 'Tuổi cai sữa', unit: 'tháng', min: 3, max: 12 },
      { key: 'youngStockAgeMonths', label: 'Tuổi bò tơ', unit: 'tháng', min: 6, max: 24 },
      { key: 'adultAgeMonths', label: 'Tuổi trưởng thành', unit: 'tháng', min: 15, max: 48 },
    ],
  },
  {
    id: 'breeding', title: 'Điều kiện xét phối', sub: 'Dùng cho chỉ báo "Đạt / Chưa đạt"', minCol: 200,
    fields: [
      { key: 'minBreedingAgeMonths', label: 'Tuổi tối thiểu', unit: 'tháng', min: 6, max: 36 },
      { key: 'minBreedingWeightKg', label: 'Cân tối thiểu', changeLabel: 'Cân tối thiểu phối', unit: 'kg', min: 100, max: 600, integer: false },
    ],
  },
  {
    id: 'gestation', title: 'Thai kỳ & khám thai', sub: 'Tính ngày dự kiến đẻ và nhắc khám thai', minCol: 140,
    fields: [
      { key: 'gestationLengthDays', label: 'Thời gian mang thai', unit: 'ngày', min: 270, max: 300 },
      { key: 'pregnancyCheckDays', label: 'Khám thai sau phối', unit: 'ngày', min: 25, max: 90 },
      { key: 'recheckDays', label: 'Khám lại khi chưa rõ', unit: 'ngày', min: 7, max: 60 },
    ],
  },
  {
    id: 'calving', title: 'Chuẩn bị đẻ & sau đẻ', sub: 'Nhắc chuẩn bị chuồng đẻ và thời điểm phối lại', minCol: 200,
    fields: [
      { key: 'calvingPrepLeadDays', label: 'Nhắc chuẩn bị đẻ trước', unit: 'ngày', min: 1, max: 60 },
      { key: 'postCalvingIntervalDays', label: 'Nghỉ sau đẻ trước khi phối', unit: 'ngày', min: 20, max: 120 },
    ],
  },
  {
    id: 'window', title: 'Cửa sổ phối', sub: 'Gợi ý khung phối từ thời điểm động dục', minCol: 140,
    fields: [
      { key: 'windowStartHours', label: 'Bắt đầu sau', unit: 'giờ', min: 0, max: 24 },
      { key: 'windowEndHours', label: 'Kết thúc sau', unit: 'giờ', min: 1, max: 36 },
      { key: 'estrusCycleDays', label: 'Chu kỳ động dục', unit: 'ngày', min: 17, max: 25 },
    ],
  },
  {
    id: 'growth', title: 'Tăng trưởng & tiêm phòng', sub: 'Thang BCS, chu kỳ cân, nhắc tiêm, mục tiêu xuất bán', minCol: 110, hasBcs: true,
    fields: [
      { key: 'weighingIntervalDays', label: 'Chu kỳ cân', unit: 'ngày', min: 7, max: 180 },
      { key: 'vaccinationLeadDays', label: 'Nhắc tiêm trước', unit: 'ngày', min: 1, max: 30 },
      { key: 'targetFinishingWeightKg', label: 'Cân xuất mục tiêu', unit: 'kg', min: 150, max: 900, integer: false, optional: true, hint: 'Để trống = tắt' },
    ],
  },
]

export const PARAMETER_FIELDS: ParameterFieldDef[] = PARAMETER_GROUPS.flatMap((g) => g.fields)

export const DEFAULT_PARAMETERS: ParameterValues = {
  weaningAgeMonths: 6, youngStockAgeMonths: 12, adultAgeMonths: 24,
  minBreedingAgeMonths: 13, minBreedingWeightKg: 230,
  gestationLengthDays: 283, pregnancyCheckDays: 28, recheckDays: 14,
  calvingPrepLeadDays: 30, postCalvingIntervalDays: 45,
  windowStartHours: 8, windowEndHours: 12, estrusCycleDays: 21,
  bcsScale: '1-5', weighingIntervalDays: 30, vaccinationLeadDays: 7, targetFinishingWeightKg: 450,
}

export const rangeHint = (f: ParameterFieldDef) => f.hint ?? `${f.min} – ${f.max}`

/** Kiểm tra từng giá trị theo khoảng cho phép (MSG-FE18-06) và các quan hệ giữa các giá trị. */
export function validateParameters(v: ParameterValues): FieldErrorMap {
  const errors: FieldErrorMap = {}
  for (const f of PARAMETER_FIELDS) {
    const error = checkNumber(v[f.key], f.label, f.min, f.max, { integer: f.integer !== false, optional: f.optional })
    if (error) errors[f.key] = error
  }
  const ok = (k: NumericParameterKey) => !errors[k] && typeof v[k] === 'number'
  if (ok('weaningAgeMonths') && ok('youngStockAgeMonths') && v.youngStockAgeMonths! <= v.weaningAgeMonths!) {
    errors.youngStockAgeMonths = 'Tuổi bò tơ phải lớn hơn tuổi cai sữa.'
  }
  if (ok('youngStockAgeMonths') && ok('adultAgeMonths') && v.adultAgeMonths! <= v.youngStockAgeMonths!) {
    errors.adultAgeMonths = 'Tuổi trưởng thành phải lớn hơn tuổi bò tơ.'
  }
  if (ok('windowStartHours') && ok('windowEndHours') && v.windowEndHours! <= v.windowStartHours!) {
    errors.windowEndHours = 'Giờ kết thúc phải lớn hơn giờ bắt đầu.'
  }
  if (v.bcsScale !== '1-5' && v.bcsScale !== '1-9') errors.bcsScale = required('Thang BCS')
  return errors
}

export function validateParameterVersion(command: ParameterVersionCommand, today: string): FieldErrorMap {
  const errors = validateParameters(command.parameters)
  const note = checkText(command.sourceNote, 'Ghi chú nguồn', 255, true)
  if (note) errors.sourceNote = note
  if (!command.effectiveFrom) errors.effectiveFrom = required('Ngày áp dụng')
  else if (command.effectiveFrom < today) errors.effectiveFrom = 'Ngày áp dụng phải từ hôm nay trở đi.'
  return errors
}

/** Match backend precedence: effective date first, then version number. */
export function effectiveVersion<T extends { effectiveFrom: string; versionNo: number }>(versions: readonly T[], today: string): T | undefined {
  return versions.reduce<T | undefined>((current, candidate) => {
    if (candidate.effectiveFrom > today) return current
    if (!current || candidate.effectiveFrom > current.effectiveFrom ||
      (candidate.effectiveFrom === current.effectiveFrom && candidate.versionNo > current.versionNo)) return candidate
    return current
  }, undefined)
}

const fmt = (n: number | null) => (n === null ? 'tắt' : String(n).replace('.', ','))
const bcsLabel = (s: BcsScale) => BCS_SCALES.find((b) => b.value === s)?.label ?? s

/** Dòng "Thay đổi" của lịch sử: chỉ liệt kê giá trị đã đổi so với phiên bản liền trước. */
export function describeChanges(prev: ParameterValues | null, next: ParameterValues): string {
  if (!prev) return 'Khởi tạo theo giá trị mặc định'
  const parts: string[] = []
  for (const f of PARAMETER_FIELDS) {
    if (prev[f.key] === next[f.key]) continue
    parts.push(`${f.changeLabel ?? f.label} ${fmt(prev[f.key])} → ${fmt(next[f.key])}${next[f.key] === null ? '' : ` ${f.unit}`}`)
  }
  if (prev.bcsScale !== next.bcsScale) parts.push(`Thang BCS ${bcsLabel(prev.bcsScale)} → ${bcsLabel(next.bcsScale)}`)
  return parts.join('; ') || 'Không thay đổi giá trị'
}

export const versionSavedMessage = (versionNo: number, effectiveFrom: string) =>
  `Đã lưu phiên bản tham số v${versionNo}, áp dụng từ ${formatDate(effectiveFrom)}.` // MSG-FE18-05
