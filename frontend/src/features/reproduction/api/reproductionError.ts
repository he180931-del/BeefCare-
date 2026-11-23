import { userFacingError } from '../../../shared/api/userFacingError'
import { BackendError } from '../../../shared/api/backendClient'
import { textValue } from '../../../shared/api/parse'
import { toFarmLocal } from '../../../shared/lib/date/farmTime'
import { formatDate, ReproductionValidationError } from '../domain/reproductionRules'
import type { ReproductionIssue } from '../types'

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)

export function reproductionError(error: unknown, fallback: string): string {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; params?: Record<string, unknown> } : {}
  if (value.code === 'MSG-FE12-08') return 'Mã thẻ này đã được dùng cho một thẻ khác. Hãy nhập mã khác hoặc để hệ thống tạo mã.'
  return userFacingError(error, fallback)
}

export class ReproductionDuplicateError extends Error {
  constructor(message: string) { super(message); this.name = 'ReproductionDuplicateError' }
}

const FIELD: Record<string, string> = {
  observedAt: 'occurredAt', bredAt: 'occurredAt', checkedAt: 'occurredAt', occurredAt: 'occurredAt', birthAt: 'birthAt',
  tagCode: 'earTag', birthWeightKg: 'weight', weightBasis: 'weightBasis', penId: 'penId', sex: 'sex', purposeId: 'purpose', registration: 'registration',
  outcome: 'outcome', breedId: 'breed',
}
const LABEL: Record<string, string> = {
  occurredAt: 'Thời điểm', birthAt: 'Thời điểm đẻ', method: 'Phương pháp', sireSource: 'Nguồn đực giống', sireCattleId: 'Đực giống trong trại',
  sireBreed: 'Giống tinh / đực giống', sireBreedId: 'Giống tinh / đực giống', semenCode: 'Mã ống tinh / lô tinh', semenSupplier: 'Nhà cung cấp tinh',
  performerName: 'Người thực hiện', observerName: 'Người quan sát', examinerName: 'Người khám', attendantName: 'Người đỡ đẻ', result: 'Kết quả',
  estimatedMonths: 'Số tháng mang thai', details: 'Chi tiết', description: 'Mô tả', note: 'Ghi chú', reason: 'Lý do', type: 'Loại cập nhật',
  healthCaseId: 'Ca sức khỏe liên kết', calves: 'Kết quả bê', earTag: 'Mã thẻ tai / QR', weight: 'Cân sơ sinh', penId: 'Chuồng ban đầu', sex: 'Giới tính',
  purpose: 'Mục đích nuôi', registration: 'Hình thức đăng ký', outcome: 'Kết quả', breed: 'Giống', course: 'Kiểu đẻ', damCondition: 'Tình trạng bò mẹ',
}

/** Lỗi backend → ReproductionValidationError (theo ô, theo bê) hoặc Error tiếng Việt. */
export function mapReproductionError(error: unknown): unknown {
  if (!(error instanceof BackendError)) return error
  const code = textValue(error.code).replace(/^MSG-/, '')
  const p = error.params
  const rawField = textValue(p.field)
  const calfMatch = /^calves\[(\d+)\]\.(\w+)$/.exec(rawField)
  const calf = calfMatch ? Number(calfMatch[1]) : num(p.calf)
  const field = FIELD[calfMatch ? calfMatch[2] : rawField] ?? (calfMatch ? calfMatch[2] : rawField)
  const issue = (message: string): ReproductionValidationError => {
    const item: ReproductionIssue = { message }
    if (field) item.field = field
    if (calf !== undefined) item.calf = calf
    return new ReproductionValidationError([item])
  }
  const prefix = calf !== undefined ? `Bê số ${calf + 1}: ` : ''
  const at = (value: unknown) => (text(value) ? toFarmLocal(value).replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}).*$/, '$3/$2/$1 $4') : textValue(value))
  switch (code) {
    case 'FE11-03': return new ReproductionDuplicateError(`Đã có ${textValue(p.event_type, 'bản ghi')} tương tự của ${textValue(p.cattle_code)} lúc ${textValue(p.time) || at(p.at)}. Vẫn lưu?`)
    case 'FE11-04': return issue('Đực giống phải là một bò đực khác của trại này.')
    case 'FE11-05': return new Error(`${textValue(p.cattle_code)} đang có thai đã xác nhận. Hãy xem lại trạng thái sinh sản trước khi ghi.`)
    case 'FE11-07': return new Error(`Bản ghi này đang được các bản ghi sau dùng (${textValue(p.records)}). Hãy sửa hoặc hủy các bản ghi đó trước.`)
    case 'FE11-10': return issue(`Thời điểm không được sớm hơn ${textValue(p.event, 'sự kiện')} liên kết (${textValue(p.time) || at(p.at)}).`)
    case 'FE11-11': return new Error('Con này không được theo dõi sinh sản. Nếu thực sự đã khám thai hoặc đẻ, hãy ghi từ Thao tác khác.')
    case 'FE12-02': return new Error(`Lần khám này mâu thuẫn với lần khám hoặc thai đã có của ${textValue(p.cattle_code)}. Vui lòng xem lại.`)
    case 'FE12-06': return issue('Hãy thêm ít nhất một kết quả bê.')
    case 'FE12-07': return issue(`${prefix}Cân sơ sinh phải từ 1 đến 80 kg và cần cơ sở đo hoặc ước tính.`)
    case 'FE12-08': return issue(`${prefix}Mã thẻ ${textValue(p.tag_code, textValue(p.code))} đã được dùng trong trại.`)
    case 'FE12-12': return new Error(`Đã có lần đẻ hoặc thay đổi thai cho ${textValue(p.dam_code)}. Vui lòng tải lại và xem lại.`)
    case 'FE04-05': return issue(`${prefix}Chuồng ${textValue(p.pen_code)} không nhận thêm bê: chuồng đang ngừng sử dụng hoặc đã đầy.`)
    case 'FE05-12': return issue(`${prefix}Mục đích SIRE chỉ cho bò đực và mục đích BREEDING chỉ cho bò cái.`)
    case 'COM-07': return issue('Thời điểm không được ở tương lai.')
    case 'COM-15': return issue(`Thời điểm không được trước ngày nhập đàn (${formatDate(textValue(p.date))}).`)
    case 'COM-13': return new Error(`${textValue(p.cattle_code, 'Bò này')} đã rời đàn; không ghi thêm sự kiện.`)
    case 'COM-17': return new Error('Bò đang chờ xác nhận chết / mất; không ghi thêm sự kiện.')
    case 'COM-01': return new Error('Chỉ Chủ trại và Quản lý mới được ghi, sửa hoặc hủy sự kiện sinh sản.')
    case 'COM-05': return new Error('Dữ liệu đã thay đổi hoặc bản ghi không còn hợp lệ. Vui lòng tải lại trang.')
    case 'COM-06': return issue(`${prefix}${LABEL[field] ?? 'Trường này'} là bắt buộc.`)
    case 'COM-10': return issue(`${prefix}${LABEL[field] ?? 'Giá trị'} không hợp lệ.`)
    default: return error.status === 409 ? new Error('Dữ liệu đã thay đổi. Vui lòng tải lại trang.') : error
  }
}
