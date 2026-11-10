import { asRecord, backendTransport, type BackendTransport } from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'

/** UC-FE19-06 (D19): PM reconciliation commands and SePay lookup. Backend only; never falls back to the demo store. */
export type Decision = 'ACCEPT' | 'HOLD' | 'REJECT'
export interface ReviewCommand { decision: Decision; paymentId: number | null; reason: string; version: number }
export interface ReturnChange { reason: string; version: number }
export interface ReturnRecord { reference: string; returnDate: string; result: string; version: number }
export interface CommandResult { id: number; version: number; reviewStatus: string; lockedForReturn: boolean; paymentId: number | null }
export interface LookupResult { duplicate: boolean; evidenceId: number; reviewStatus: string; paymentId: number | null }
export interface LookupRow {
  transactionId: number; bankPaidAt: string; amount: number; direction: 'IN' | 'OUT'; content: string | null; referenceCode: string | null; evidenceId: number | null
}
export interface LookupPage { items: LookupRow[]; limit: number }

export const REASON_MAX = 1000
export const LOOKUP_MAX_DAYS = 31
export const DECISION_TEXT: Record<Decision, string> = { ACCEPT: 'Chấp nhận', HOLD: 'Tạm giữ', REJECT: 'Từ chối' }

/** MSG-FE19-11 params.reason → the rule shown to the PM. */
export const BLOCK_TEXT: Record<string, string> = {
  NO_CANDIDATE: 'mã chuyển khoản không chính xác và chưa chọn yêu cầu ứng viên',
  EVIDENCE_ALLOCATED: 'chứng từ đã được phân bổ cho một thanh toán',
  LOCKED_FOR_RETURN: 'chứng từ đang khóa hoàn trả',
  OUTGOING: 'đây là giao dịch chuyển ra',
  REQUEST_NOT_PENDING: 'yêu cầu không còn chờ thanh toán',
  REQUEST_ALLOCATED: 'yêu cầu đã có chứng từ khác',
  OUTSIDE_WINDOW: 'giờ ngân hàng nằm ngoài thời hạn của yêu cầu',
  AMOUNT_MISMATCH: 'số tiền không khớp số tiền yêu cầu',
  ACCOUNT_MISMATCH: 'tài khoản nhận không khớp yêu cầu',
  MANUAL_INCOME: 'giao dịch đã được ghi là khoản thu thủ công',
  // D22: an exact code identifies its farm; only that farm's requests can be funded by it.
  OTHER_FARM: 'yêu cầu đã chọn thuộc trại khác với mã chuyển khoản',
}

const FIELD_TEXT: Record<string, string> = {
  reason: 'lý do', decision: 'quyết định', reference: 'mã giao dịch chiều ra', returnDate: 'ngày hoàn trả', result: 'kết quả hoàn trả', from: 'ngày bắt đầu', to: 'ngày kết thúc',
}

/** A stale record (MSG-COM-05) must be reloaded by the caller before the PM tries again. */
export const isStale = (error: unknown) => error instanceof BackendError && error.code === 'MSG-COM-05'

export function reconciliationError(error: unknown, decision?: Decision): string {
  if (!(error instanceof BackendError)) return error instanceof Error && error.message ? error.message : 'Không thể lưu dữ liệu. Vui lòng thử lại.'
  const field = String(error.params.field ?? '')
  if (error.code === 'MSG-FE19-11') {
    const rule = BLOCK_TEXT[String(error.params.reason ?? '')] ?? 'không đạt điều kiện xác nhận'
    return decision && decision !== 'ACCEPT' ? `Không thể lưu quyết định: ${rule}.` : `Không thể chấp nhận chứng từ này: ${rule}.`
  }
  if (error.code === 'MSG-COM-05') return 'Chứng từ vừa thay đổi (ví dụ SePay vừa xác nhận). Dữ liệu mới đã được tải lại, vui lòng kiểm tra rồi thử lại.'
  if (error.code === 'MSG-COM-06') return `Vui lòng nhập ${FIELD_TEXT[field] ?? 'trường bắt buộc'}.`
  if (error.code === 'MSG-COM-07') return 'Ngày hoàn trả không được ở tương lai.'
  if (error.code === 'MSG-COM-10' && field === 'returnDate') return 'Ngày hoàn trả không được trước ngày ngân hàng nhận tiền.'
  if (error.code === 'MSG-COM-10' && field === 'to') return `Khoảng tra cứu tối đa ${LOOKUP_MAX_DAYS} ngày.`
  if (error.code === 'MSG-COM-10') return `${FIELD_TEXT[field] ?? 'Giá trị'} không hợp lệ.`
  if (error.code === 'MSG-COM-11') return 'Ngày bắt đầu không được sau ngày kết thúc.'
  if (error.code === 'MSG-COM-08') return 'Mục đã chọn không còn khả dụng. Vui lòng tải lại.'
  if (error.code === 'MSG-COM-19') return 'Thao tác trùng khóa với một yêu cầu khác. Vui lòng thử lại.'
  if (error.status === 503) return 'Chưa cấu hình tra cứu SePay ở môi trường này.'
  if (error.status === 404) return 'Không tìm thấy giao dịch trên SePay.'
  // 502: SePay did not answer, or answered with data BeefCare cannot store (nothing was saved).
  if (error.status === 502) return 'SePay không phản hồi hoặc trả dữ liệu không hợp lệ. Vui lòng thử lại.'
  if (error.status === 409) return 'Giao dịch đã có chứng từ với nội dung khác. Vui lòng kiểm tra lại.'
  return 'Không thể lưu dữ liệu. Vui lòng thử lại.'
}

const invalid = () => new Error('Dữ liệu đối soát từ máy chủ không hợp lệ.')
const id = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const nullableText = (v: unknown) => v === null || typeof v === 'string'
const instant = (v: unknown): v is string => typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))

function commandResult(value: unknown): CommandResult {
  const e = asRecord(value)
  if (!id(e.id) || !count(e.version) || typeof e.reviewStatus !== 'string' || typeof e.lockedForReturn !== 'boolean'
    || !(e.paymentId === null || id(e.paymentId))) throw invalid()
  return { id: e.id, version: e.version, reviewStatus: e.reviewStatus, lockedForReturn: e.lockedForReturn, paymentId: e.paymentId as number | null }
}

function lookupRow(value: unknown): LookupRow {
  const r = asRecord(value)
  if (!id(r.transactionId) || !instant(r.bankPaidAt) || typeof r.amount !== 'number' || !Number.isFinite(r.amount) || r.amount < 0
    || !['IN', 'OUT'].includes(r.direction as string) || !nullableText(r.content) || !nullableText(r.referenceCode)
    || !(r.evidenceId === null || id(r.evidenceId))) throw invalid()
  return r as unknown as LookupRow
}

export function createPlatformReconciliationApi(transport: BackendTransport) {
  const post = async (evidenceId: number, action: string, body: unknown, key: string) => {
    if (!id(evidenceId)) throw invalid()
    return commandResult(await transport.command(`/api/platform/payments/evidence/${evidenceId}/${action}`, body, { method: 'POST', key }))
  }
  return {
    review: (evidenceId: number, cmd: ReviewCommand, key: string) => post(evidenceId, 'review', cmd, key),
    lock: (evidenceId: number, cmd: ReturnChange, key: string) => post(evidenceId, 'lock-return', cmd, key),
    unlock: (evidenceId: number, cmd: ReturnChange, key: string) => post(evidenceId, 'unlock-return', cmd, key),
    recordReturn: (evidenceId: number, cmd: ReturnRecord, key: string) => post(evidenceId, 'record-return', cmd, key),
    /** API-03 by ID: stores the transaction as evidence once; repeating it returns the same evidence. */
    async lookupById(transactionId: number): Promise<LookupResult> {
      if (!id(transactionId)) throw invalid()
      const r = asRecord(await transport.command(`/api/platform/payments/lookup/${transactionId}`, {}, { method: 'POST' }))
      if (typeof r.duplicate !== 'boolean' || !id(r.evidenceId) || typeof r.reviewStatus !== 'string'
        || !(r.paymentId === null || id(r.paymentId))) throw invalid()
      return { duplicate: r.duplicate, evidenceId: r.evidenceId, reviewStatus: r.reviewStatus, paymentId: r.paymentId as number | null }
    },
    /** API-03 by period (D19): read-only list; rows are stored one by one with lookupById. */
    async lookupPeriod(from: string, to: string): Promise<LookupPage> {
      const p = asRecord(await transport.get(`/api/platform/payments/lookup?${new URLSearchParams({ from, to })}`))
      if (!Array.isArray(p.items) || !id(p.limit) || p.items.length > p.limit) throw invalid()
      return { items: p.items.map(lookupRow), limit: p.limit }
    },
  }
}
export const platformReconciliationApi = createPlatformReconciliationApi(backendTransport)
