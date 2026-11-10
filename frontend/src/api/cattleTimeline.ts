import type { CattleEvent, Tone } from '../types'

/** One event of GET /api/farms/{farmId}/cattle/{id}/timeline (CattleTimelineService.Event). */
export type BackendTimeline = {
  category?: string
  type?: string
  sourceId?: number | null
  occurredAt?: string | null
  recordedAt?: string | null
  recorder?: string | null
  status?: string | null
  corrected?: boolean
  values?: Record<string, unknown> | null
  correction?: Record<string, unknown> | null
  /** A1: the viewer may open the source record (R-16-06). */
  canOpen?: boolean
  /** A1: the viewer may correct / void it from the timeline, same rule as the source command (R-16-07). */
  canCorrect?: boolean
}

/** SCR-50 #1 chips, in the order of the spec. */
export const TIMELINE_FILTERS = [
  ['all', 'Tất cả'],
  ['qr', 'Định danh & QR'],
  ['stage', 'Mục đích / giai đoạn'],
  ['barn', 'Chuồng'],
  ['weight', 'Cân & BCS'],
  ['vaccine', 'Tiêm phòng'],
  ['health', 'Sức khỏe'],
  ['repro', 'Sinh sản'],
  ['entryExit', 'Nhập & xuất'],
] as const

const CATEGORY: Record<string, string> = {
  IDENTIFICATION_QR: 'qr', ENTRY_EXIT: 'entryExit', PEN: 'barn', PURPOSE_STAGE: 'stage', GROWTH: 'weight', VACCINATION: 'vaccine', HEALTH: 'health', REPRODUCTION: 'repro',
}
/** Profile tab that holds the source record of each category (R-16-06). */
const SOURCE_TAB: Record<string, string> = { qr: 'qr', stage: '', barn: 'barns', weight: 'growth', vaccine: 'vaccine', health: 'health', repro: 'repro' }
/** Categories whose records the source tab corrects or voids from the timeline (R-16-07, Q5: not health). */
const CORRECTABLE = new Set(['weight', 'vaccine', 'repro'])

const LIFE_STAGE: Record<string, string> = { UNWEANED_CALF: 'Bê chưa cai sữa', WEANED_CALF: 'Bê cai sữa', YOUNG_STOCK: 'Bò tơ', ADULT: 'Trưởng thành' }
const EXIT_TYPE: Record<string, string> = { SALE: 'Bán', CULL: 'Loại thải', DEATH: 'Chết', OTHER: 'Khác' }
const EXIT_STATUS: Record<string, string> = { DRAFT: 'Nháp', PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', DISMISSED: 'Đã bỏ', VOIDED: 'Đã hủy' }
const REPLACEMENT: Record<string, string> = { LOST: 'Mất', DAMAGED: 'Hỏng', OTHER: 'Khác' }
const REPRO_TYPE: Record<string, string> = { ESTRUS: 'Động dục', BREEDING: 'Phối giống', PREGNANCY_CHECK: 'Khám thai' }
const REPRO_METHOD: Record<string, string> = { AI: 'thụ tinh nhân tạo', NATURAL: 'phối tự nhiên' }
const PREGNANCY_UPDATE: Record<string, string> = { COMPLICATION: 'biến chứng', LOSS: 'mất thai' }
const QR_STATUS: Record<string, string> = { ACTIVE: 'đang dùng', REPLACED: 'đã thay', RETIRED: 'đã thu hồi' }
const HEALTH_OUTCOME: Record<string, string> = { RECOVERED: 'Đã khỏi', DIED: 'Chết', MISSING: 'Mất', CLOSED_BY_EXIT: 'Đóng do xuất đàn' }

const str = (value: unknown): string => (value == null ? '' : String(value))
const num = (value: unknown): string => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? String(Number(n.toFixed(2))) : str(value)
}
const join = (...parts: unknown[]) => parts.filter((part) => part !== false && part != null).map(str).filter((part) => part.trim()).join(' · ')
const pad = (n: number) => String(n).padStart(2, '0')

/** dd/mm/yyyy, plus HH:mm when the instant is not a date-only value (start of day). */
export function timeLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split('-').reverse().join('/')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  return d.getHours() === 0 && d.getMinutes() === 0 ? date : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const dateOnly = (value: unknown) => {
  const v = str(value)
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split('-').reverse().join('/') : v
}
/** Local yyyy-mm-ddTHH:mm of an instant, used to sort and to group by month in the viewer's time zone. */
const localKey = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** SCR-50 #8: "Xảy ra … · ghi … · bởi …". */
export function timelineMeta(occurredAt?: string | null, recordedAt?: string | null, recorder?: string | null): string {
  return join(occurredAt && `Xảy ra ${timeLabel(occurredAt)}`, recordedAt && `ghi ${timeLabel(recordedAt)}`, recorder && `bởi ${recorder}`)
}

type Described = { title: string; detail: string; basis?: string; reason?: string }

/** Title + main value (SCR-50 #4) and details (#7) of each source record, in Vietnamese. */
function describe(type: string, v: Record<string, unknown>, status: string): Described {
  switch (type) {
    case 'HERD_ENTRY': {
      const farmBorn = v.source === 'FARM_BORN'
      return {
        title: farmBorn ? 'Nhập đàn – bê sinh tại trại' : 'Nhập đàn – mua ngoài',
        detail: join(v.weight != null && `Cân nhập ${num(v.weight)} kg`, v.voucherCode && `Phiếu ${str(v.voucherCode)}`),
        basis: v.basis === 'ESTIMATED' ? 'Ước tính' : v.basis === 'MEASURED' ? 'Đo' : undefined,
      }
    }
    case 'HERD_EXIT':
      return {
        title: `Xuất đàn – ${EXIT_TYPE[str(v.exitType)] ?? str(v.exitType)}`,
        detail: join(EXIT_STATUS[status] ?? status, v.date && `ngày ${dateOnly(v.date)}`, v.voucherCode && `Phiếu ${str(v.voucherCode)}`),
      }
    case 'PEN_ASSIGNMENT':
      return {
        title: `Vào chuồng ${str(v.penCode)}`,
        detail: join(v.toDate ? `đến ${dateOnly(v.toDate)}` : 'đang ở', v.reason && `Lý do: ${str(v.reason)}`),
      }
    case 'QR_ISSUED':
      return {
        title: `Cấp thẻ QR ${str(v.tagCode)}`,
        detail: join(QR_STATUS[status] && `Thẻ ${QR_STATUS[status]}`, v.reason && `Bị thay vì: ${REPLACEMENT[str(v.reason)] ?? str(v.reason)}`),
      }
    case 'PROFILE_CHANGE': {
      const group = str(v.fieldGroup)
      const reason = v.reason ? `Lý do: ${str(v.reason)}` : ''
      if (group === 'LIFE_STAGE') return { title: `Đổi giai đoạn: ${LIFE_STAGE[str(v.oldValue)] ?? str(v.oldValue)} → ${LIFE_STAGE[str(v.newValue)] ?? str(v.newValue)}`, detail: reason }
      if (group === 'PURPOSE') return { title: 'Đổi mục đích sản xuất', detail: reason }
      if (group === 'EAR_TAG') return { title: `Đổi số tai: ${str(v.oldValue) || 'Gắn tai sau'} → ${str(v.newValue) || 'Gắn tai sau'}`, detail: reason }
      return { title: 'Cập nhật tên, màu lông hoặc ghi chú', detail: reason }
    }
    case 'GROWTH_ASSESSMENT':
      return {
        title: join(v.weightKg != null && `Cân ${num(v.weightKg)} kg`, v.bcs != null && `BCS ${num(v.bcs)}`) || 'Đánh giá tăng trưởng',
        detail: join(v.method && `Phương pháp ${str(v.method).toLowerCase()}`),
        basis: v.basis === 'ESTIMATED' ? 'Ước tính' : v.basis === 'MEASURED' ? 'Đo' : undefined,
        reason: str(v.reason) || undefined,
      }
    case 'VACCINATION_RECORD':
      return {
        title: `Tiêm ${str(v.vaccine) || 'vắc-xin'}`,
        detail: join(v.batchNo && `Lô ${str(v.batchNo)}`, v.dose && `Liều ${str(v.dose)}`, v.withdrawalEndDate && `Ngưng sử dụng thịt đến ${dateOnly(v.withdrawalEndDate)}`),
        basis: v.source === 'HISTORICAL' ? 'Lịch sử' : 'Tại trại',
        reason: str(v.reason) || undefined,
      }
    case 'HEALTH_CASE_CLOSED':
      return { title: `Đóng ca bệnh ${str(v.caseCode)}`.trim(), detail: HEALTH_OUTCOME[str(v.outcome)] ?? str(v.outcome) }
    case 'HEALTH_OBSERVATION':
      return { title: 'Theo dõi sức khỏe', detail: join(v.signs), reason: str(v.reason) || undefined }
    case 'TREATMENT':
      return {
        title: `Điều trị – ${str(v.medicine) || 'thuốc'}`,
        detail: join(v.dose && `Liều ${str(v.dose)}`, v.route && `Đường ${str(v.route)}`, v.courseDays != null && `${str(v.courseDays)} ngày`, v.withdrawalEndDate && `Ngưng sử dụng thịt đến ${dateOnly(v.withdrawalEndDate)}`),
        reason: str(v.reason) || undefined,
      }
    case 'PREGNANCY_UPDATE':
      return { title: `Cập nhật thai${PREGNANCY_UPDATE[str(v.type)] ? ` – ${PREGNANCY_UPDATE[str(v.type)]}` : ''}`, detail: join(v.details), reason: str(v.reason) || undefined }
    case 'CALVING_EVENT':
      return { title: 'Đẻ', detail: join(v.course && `Diễn biến ${str(v.course).toLowerCase()}`, v.damCondition && `Mẹ ${str(v.damCondition).toLowerCase()}`, v.retainedPlacenta === true && 'Sót nhau'), reason: str(v.reason) || undefined }
    default:
      if (REPRO_TYPE[type]) {
        return {
          title: REPRO_TYPE[type],
          detail: join(REPRO_METHOD[str(v.method)] ?? str(v.method), v.result && `Kết quả ${str(v.result).toLowerCase()}`, v.description),
          reason: str(v.reason) || undefined,
        }
      }
      return { title: 'Sự kiện khác', detail: join(...Object.values(v)) }
  }
}

const VOID_STATUSES = new Set(['VOIDED', 'VOID'])

/**
 * Maps one backend event to the shared CattleEvent of the profile (SCR-50). Records excluded or voided, and the
 * original values of corrected records (REVISION), are kept with a status so the tab hides them until
 * "Hiện chỉnh sửa" is on (R-16-04).
 */
export function mapTimeline(event: BackendTimeline, index: number): CattleEvent {
  const cat = CATEGORY[str(event.category)] ?? 'health'
  const raw = str(event.status) || 'VALID'
  const type = str(event.type)
  const at = event.occurredAt ? localKey(event.occurredAt) : event.recordedAt ? localKey(event.recordedAt) : ''
  const meta = timelineMeta(event.occurredAt, event.recordedAt, event.recorder)
  const id = `${type}-${event.sourceId ?? 'x'}-${index}`

  if (type === 'REVISION') {
    const correction = event.correction ?? {}
    const original = (event.values?.original ?? {}) as Record<string, unknown>
    const sourceType = str(correction.sourceType)
    const before = describe(sourceType, typeof original === 'object' && original ? original : {}, 'VALID')
    const action = raw === 'VOID' ? 'Bản ghi trước khi hủy' : raw === 'EXCLUDE' ? 'Bản ghi trước khi loại' : 'Giá trị trước khi sửa'
    return {
      id, at, cat, status: 'REVISION', title: `${action}: ${before.title}`, detail: before.detail, meta,
      badge: { label: 'Bản gốc', tone: 'grey' }, marker: 'Bản gốc', reason: str(correction.reason) || undefined,
    }
  }

  const described = describe(type, event.values ?? {}, raw)
  const status: CattleEvent['status'] = VOID_STATUSES.has(raw) ? 'VOIDED' : raw === 'EXCLUDED' ? 'EXCLUDED' : raw === 'CORRECTED' || event.corrected ? 'CORRECTED' : 'VALID'
  const marker = status === 'VOIDED' ? 'Đã hủy' : status === 'EXCLUDED' ? 'Đã loại' : status === 'CORRECTED' ? 'Đã sửa' : undefined
  const tone: Tone = status === 'VALID' ? 'info' : status === 'CORRECTED' ? 'warn' : 'grey'
  const values = event.values ?? {}
  const voucherCode = str(values.voucherCode)
  const fromBackend = typeof event.canCorrect === 'boolean' || typeof event.canOpen === 'boolean'
  const heuristic = CORRECTABLE.has(cat) && (status === 'VALID' || status === 'CORRECTED')
  return {
    id, at, cat, status, marker, meta,
    title: described.title,
    detail: described.detail,
    basis: described.basis,
    reason: status === 'VALID' ? undefined : described.reason,
    badge: { label: marker ?? described.basis ?? '', tone },
    tab: type === 'PROFILE_CHANGE' ? '' : SOURCE_TAB[cat],
    voucher: voucherCode && event.canOpen !== false ? { kind: type === 'HERD_EXIT' ? 'exit' : 'entry', code: voucherCode } : undefined,
    correctable: typeof event.canCorrect === 'boolean' ? event.canCorrect && CORRECTABLE.has(cat) : heuristic,
    accessFromBackend: fromBackend,
    openDenied: event.canOpen === false,
    sourceId: typeof event.sourceId === 'number' ? event.sourceId : undefined,
    sourceType: type,
    revisionSource: event.canCorrect && typeof values.version === 'number' ? { version: values.version, occurredAt: event.occurredAt, values } : undefined,
  }
}
