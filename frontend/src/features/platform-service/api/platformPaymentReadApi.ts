import { asRecord, backendTransport, type BackendTransport } from '../../../api/backendTransport'
import type { SourcePayment } from '../types'

export interface ReadPage<T> { items: T[]; total: number; page: number; size: number }
export interface EvidenceReadFilters { status: string; bankFrom: string; bankTo: string; page: number }
export interface PaymentReadFilters { q: string; state: string; page: number }
export interface EvidenceRow {
  id: number; provider: string; environment: string; accountNamespace: string; maskedTransactionId: string
  amount: number; direction: string | null; content: string | null; bankPaidAt: string; reviewStatus: string; matchResult: string
  reviewReason: string | null; receivingAccountMatches: boolean | null; paymentId: number | null; paymentCode: string | null; version: number
}
export interface EvidenceHistory {
  id: number; source: 'REVIEW' | 'EVENT'; action: string; reason: string | null; reference: string | null; result: string | null
  returnDate: string | null; pmId: number | null; pmName: string | null; at: string
  relatedPaymentId: number | null; relatedPaymentCode: string | null
}
export interface EvidenceDetail {
  summary: EvidenceRow; transactionId: string; receivingAccount: string | null; bank: string | null; referenceCode: string | null
  quoteRef: string | null; firstReceivedAt: string | null
  /** D19: the recorded return (once, immutable); null while not returned. */
  returnReference: string | null; returnDate: string | null; returnResult: string | null; history: EvidenceHistory[]
}
export interface PaymentRead extends SourcePayment {
  evidenceId: number | null; confirmedAt: string | null; confirmationSource: string | null; bankPaidAt: string | null; receivedAt: string | null
}
export interface CandidateRead {
  paymentId: number; quoteRef: string; farmId: number; farmName: string; amount: number; termYears: number; expiresAt: string; accountNamespace: string
}
export interface ReadTiles { pendingRequests: number; evidenceToReview: number; hold: number; lockedForReturn: number }

const invalid = () => new Error('Dữ liệu thanh toán từ máy chủ không hợp lệ hoặc không đầy đủ.')
const id = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const text = (v: unknown): v is string => typeof v === 'string'
const nullableText = (v: unknown): v is string | null => v === null || text(v)
const instant = (v: unknown): v is string => text(v) && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
const nullableInstant = (v: unknown) => v === null || instant(v)
const nullableId = (v: unknown) => v === null || id(v)
const nullableDate = (v: unknown) => v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
const money = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const statuses = ['TO_REVIEW', 'HOLD', 'REJECTED', 'ACCEPTED', 'LOCKED', 'PROCESSING', 'NO_ACTION']
export const MATCH_TEXT: Record<string, string> = {
  PAID_AUTO: 'Tự động xác nhận · PAID', PAID_PM: 'PM xác nhận · PAID', PAID: 'Đã xác nhận · PAID', EXACT_CODE: 'Khớp mã · chờ xác nhận',
  CODE_MISMATCH: 'Mã không khớp', NO_REQUEST: 'Không có yêu cầu', REQUEST_EXPIRED: 'Giờ ngân hàng sau hạn yêu cầu',
  OUTSIDE_WINDOW: 'Giờ ngân hàng trước yêu cầu', AMOUNT_MISMATCH: 'Sai số tiền', OUTGOING: 'Chuyển ra', ACCOUNT_MISMATCH: 'Sai tài khoản nhận', ALREADY_ALLOCATED: 'Yêu cầu đã có chứng từ',
}
export const REVIEW_TEXT: Record<string, string> = { TO_REVIEW: 'Cần xem', HOLD: 'Tạm giữ', REJECTED: 'Từ chối', ACCEPTED: 'Đã chấp nhận', LOCKED: 'Khóa hoàn trả', PROCESSING: 'Đang xử lý', NO_ACTION: 'Không cần xử lý' }
export const CONFIRMATION_SOURCE_TEXT: Record<string, string> = { SEPAY: 'Tự động qua SePay', PM: 'PM xác nhận' }
/** Fixed reasons written by SePayWebhookService during ingestion/settlement; PM-entered reasons are shown as stored. */
const SYSTEM_REASON_TEXT: Record<string, string> = {
  'Not an incoming transfer': 'Không phải giao dịch tiền vào',
  'Receiving account is not configured': 'Chưa cấu hình tài khoản nhận',
  'Receiving account does not match the configured account': 'Tài khoản nhận không khớp tài khoản đã cấu hình',
  'No payment reference found': 'Không tìm thấy mã thanh toán trong nội dung',
  'No matching payment request': 'Không có yêu cầu thanh toán khớp mã',
  'Payment request already has evidence': 'Yêu cầu thanh toán đã có chứng từ',
  'Transfer was sent to a different receiving account than the request': 'Chuyển tới tài khoản nhận khác với yêu cầu',
  'Bank transaction is already recognized as manual income': 'Giao dịch đã được ghi nhận là khoản thu thủ công',
  'Automatically matched by exact payment reference and amount': 'Tự động khớp đúng mã thanh toán và số tiền',
  'Payment request is not pending': 'Yêu cầu thanh toán không còn chờ thanh toán',
  'Bank-paid time is outside the request window': 'Giờ ngân hàng nằm ngoài thời hạn yêu cầu',
  'Transfer amount does not match the requested amount': 'Số tiền chuyển không khớp số tiền yêu cầu',
}
export const reasonText = (reason: string | null) => reason === null ? null : SYSTEM_REASON_TEXT[reason] ?? reason

function evidenceRow(value: unknown): EvidenceRow {
  const r = asRecord(value)
  if (!id(r.id) || !['provider', 'environment', 'accountNamespace', 'maskedTransactionId'].every((key) => text(r[key]))
    || !/^\*{4}\d{1,4}$/.test(r.maskedTransactionId as string) || !money(r.amount) || !nullableText(r.direction) || !nullableText(r.content)
    || !instant(r.bankPaidAt) || !statuses.includes(r.reviewStatus as string) || !Object.hasOwn(MATCH_TEXT, r.matchResult as string)
    || !nullableText(r.reviewReason) || !(r.receivingAccountMatches === null || typeof r.receivingAccountMatches === 'boolean')
    || !nullableId(r.paymentId) || !nullableText(r.paymentCode) || !count(r.version)) throw invalid()
  return r as unknown as EvidenceRow
}
function payment(value: unknown): PaymentRead {
  const p = asRecord(value)
  if (!id(p.id) || !id(p.farmId) || !text(p.farmName) || !text(p.quoteRef) || ![1, 2, 3].includes(p.termYears as number)
    || !money(p.amount) || !['PENDING', 'PAID', 'EXPIRED'].includes(p.state as string) || !instant(p.requestedAt) || !instant(p.expiresAt)
    || !nullableInstant(p.purchasedStart) || !nullableInstant(p.purchasedEnd) || !nullableText(p.receiptCode) || !nullableText(p.requestedByEmail)
    || !id(p.priceVersionId) || !nullableId(p.evidenceId) || !nullableInstant(p.confirmedAt) || !nullableText(p.confirmationSource)
    || !nullableInstant(p.bankPaidAt) || !nullableInstant(p.receivedAt)) throw invalid()
  return p as unknown as PaymentRead
}
function readPage<T>(value: unknown, parse: (v: unknown) => T): ReadPage<T> {
  const p = asRecord(value)
  if (!Array.isArray(p.items) || !count(p.total) || !count(p.page) || p.page > 107374182 || p.size !== 20
    || p.items.length > 20 || p.items.length > p.total) throw invalid()
  return { items: p.items.map(parse), total: p.total, page: p.page, size: 20 }
}
function history(value: unknown): EvidenceHistory {
  const h = asRecord(value)
  if (!id(h.id) || !['REVIEW', 'EVENT'].includes(h.source as string) || !text(h.action) || !instant(h.at)
    || !['reason', 'reference', 'result', 'pmName', 'relatedPaymentCode'].every((key) => nullableText(h[key])) || !nullableDate(h.returnDate)
    || !nullableId(h.pmId) || !nullableId(h.relatedPaymentId)
    || (h.relatedPaymentId === null) !== (h.relatedPaymentCode === null)) throw invalid()
  return h as unknown as EvidenceHistory
}
function detail(value: unknown): EvidenceDetail {
  const e = asRecord(value)
  if (!text(e.transactionId) || !/^\d+$/.test(e.transactionId) || !['receivingAccount', 'bank', 'referenceCode', 'quoteRef'].every((key) => nullableText(e[key]))
    || !nullableInstant(e.firstReceivedAt) || !nullableText(e.returnReference) || !nullableDate(e.returnDate) || !nullableText(e.returnResult)
    || !Array.isArray(e.history)) throw invalid()
  return { ...e, summary: evidenceRow(e.summary), history: e.history.map(history) } as unknown as EvidenceDetail
}
function candidates(value: unknown): CandidateRead[] {
  if (!Array.isArray(value)) throw invalid()
  return value.map((value) => {
    const c = asRecord(value)
    if (!id(c.paymentId) || !id(c.farmId) || !text(c.quoteRef) || !text(c.farmName) || !money(c.amount)
      || ![1, 2, 3].includes(c.termYears as number) || !instant(c.expiresAt) || !text(c.accountNamespace)) throw invalid()
    return c as unknown as CandidateRead
  })
}

/** UC5 exposes GETs only. Backend failures never use the local demo store. */
export function createPlatformPaymentReadApi(transport: BackendTransport) {
  return {
    async tiles(): Promise<ReadTiles> {
      const t = asRecord(await transport.get('/api/platform/payments/summary'))
      if (!['pendingRequests', 'evidenceToReview', 'hold', 'lockedForReturn'].every((key) => count(t[key]))) throw invalid()
      return t as unknown as ReadTiles
    },
    async evidence(f: EvidenceReadFilters) {
      const query = new URLSearchParams({ status: f.status, page: String(f.page), size: '20' })
      if (f.bankFrom) query.set('bankFrom', f.bankFrom)
      if (f.bankTo) query.set('bankTo', f.bankTo)
      return readPage(await transport.get(`/api/platform/payments/evidence?${query}`), evidenceRow)
    },
    async payments(f: PaymentReadFilters) {
      const query = new URLSearchParams({ page: String(f.page), size: '20' })
      if (f.q.trim()) query.set('q', f.q.trim())
      if (f.state) query.set('state', f.state)
      return readPage(await transport.get(`/api/platform/payments?${query}`), payment)
    },
    async evidenceDetail(idValue: number) {
      if (!id(idValue)) throw invalid()
      const e = detail(await transport.get(`/api/platform/payments/evidence/${idValue}`))
      if (e.summary.id !== idValue) throw invalid()
      return e
    },
    async candidates(idValue: number) {
      if (!id(idValue)) throw invalid()
      return candidates(await transport.get(`/api/platform/payments/evidence/${idValue}/candidates`))
    },
    async payment(idValue: number) {
      if (!id(idValue)) throw invalid()
      const p = payment(await transport.get(`/api/platform/payments/${idValue}`))
      if (p.id !== idValue) throw invalid()
      return p
    },
  }
}
export const platformPaymentReadApi = createPlatformPaymentReadApi(backendTransport)
