// Input validation moved out of src/features/growth/domain/growthRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import { fmtDate } from '../domain/growthFormat'
import { BCS_SCALE, GIRTH_RANGE, type GrowthFieldErrors, LENGTH_RANGE, type MeasurementInput, NOTE_MAX, WEIGHT_MAX, WEIGHT_MIN, round } from '../domain/growthRules'

const present = (n: number | undefined): n is number => n !== undefined && n !== null && !Number.isNaN(n)

/** UC-FE08-01 bước 4 và GBR-38: trả về lỗi theo từng trường (rỗng nếu hợp lệ). */
export function validateMeasurement(input: MeasurementInput, ctx: { now: string; herdEntryDate: string }): GrowthFieldErrors {
  const e: GrowthFieldErrors = {}
  const { measuredAt, method, weightKg, heartGirthCm, bodyLengthCm, bcs, note } = input
  if (!measuredAt) e.measuredAt = 'Thời điểm đo là bắt buộc.'
  else if (measuredAt > ctx.now) e.measuredAt = 'Thời điểm không được ở tương lai.'
  else if (measuredAt.slice(0, 10) < ctx.herdEntryDate) e.measuredAt = `Thời điểm không được trước ngày nhập đàn (${fmtDate(ctx.herdEntryDate)}).`

  if (!present(weightKg) && !present(bcs)) e.form = 'Nhập cân nặng, BCS hoặc cả hai.'
  if (present(weightKg)) {
    if (weightKg < WEIGHT_MIN || weightKg > WEIGHT_MAX) e.weightKg = 'Cân nặng phải từ 1 đến 1.500 kg.'
    else if (round(weightKg, 1) !== weightKg) e.weightKg = 'Cân nặng chỉ nhận tối đa 1 chữ số thập phân.'
    if (!method) e.method = 'Phương pháp là bắt buộc khi có cân nặng.'
  }
  if (present(heartGirthCm) && (heartGirthCm < GIRTH_RANGE[0] || heartGirthCm > GIRTH_RANGE[1])) e.heartGirthCm = 'Vòng ngực phải từ 50 đến 300 cm.'
  if (present(bodyLengthCm) && (bodyLengthCm < LENGTH_RANGE[0] || bodyLengthCm > LENGTH_RANGE[1])) e.bodyLengthCm = 'Dài thân chéo phải từ 30 đến 250 cm.'
  if (present(bcs) && !BCS_SCALE.includes(bcs)) e.bcs = 'BCS phải nằm trong thang 1,0 – 5,0 (bước 0,5).'
  if (note && note.length > NOTE_MAX) e.note = 'Ghi chú tối đa 500 ký tự.'
  return e
}

export function validateReason(reason: string | undefined): GrowthFieldErrors {
  if (!reason?.trim()) return { reason: 'Lý do là bắt buộc.' }
  if (reason.length > NOTE_MAX) return { reason: 'Lý do tối đa 500 ký tự.' }
  return {}
}
