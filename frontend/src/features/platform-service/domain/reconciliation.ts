import type { Evidence, MatchResult, PlatformPayment, ReviewStatus } from '../types'

export const RECEIVING_ACCOUNT = 'MB 0386671863000'

export const maskTransaction = (id: string) => (id.length > 10 ? `${id.slice(0, 7)}…${id.slice(-3)}` : id)
export const evidenceCode = (id: number) => `EV-${String(id).padStart(4, '0')}`

/** Mã tham chiếu chỉ tính là khớp khi xuất hiện nguyên vẹn như một từ trong nội dung chuyển khoản. */
export function exactCodeMatches(content: string, payments: PlatformPayment[]) {
  const words = content.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
  return payments.filter((p) => words.includes(p.code.toUpperCase()))
}

export interface AcceptanceCheck { key: string; label: string; ok: boolean; detail: string }

/** GBR-72, GBR-74, GBR-84: các điều kiện bắt buộc để chấp nhận một chứng từ cho một yêu cầu. */
export function checkAcceptance(ev: Evidence, pay: PlatformPayment, explicitSelection: boolean): AcceptanceCheck[] {
  const exact = exactCodeMatches(ev.content, [pay]).length === 1
  const c = (key: string, label: string, ok: boolean, detail: string): AcceptanceCheck => ({ key, label, ok, detail: ok ? 'Đạt' : detail })
  return [
    c('code', 'Mã tham chiếu', exact || explicitSelection, 'Mã báo giá chưa khớp chính xác duy nhất'),
    c('amount', 'Số tiền', ev.amount === pay.amount, 'Số tiền không bằng số tiền của yêu cầu'),
    c('direction', 'Chiều tiền vào', ev.direction === 'IN', 'Đây là khoản chuyển ra'),
    c('account', 'Tài khoản nhận', ev.receivingAccount === RECEIVING_ACCOUNT, 'Sai tài khoản nhận'),
    c('window', 'Thời gian trong cửa sổ báo giá', ev.bankPaidAt >= pay.createdAt && ev.bankPaidAt < pay.expiresAt, 'Thời gian ngân hàng ghi nhận nằm ngoài cửa sổ báo giá'),
    c('allocation', 'Nguồn chưa phân bổ', ev.paymentId === null && pay.state !== 'PAID', 'Nguồn hoặc yêu cầu đã được phân bổ'),
    c('lock', 'Nguồn không khóa/hoàn', !ev.lockedForReturn, 'Nguồn đã khóa chờ hoàn tiền'),
    c('income', 'Chưa ghi thu thủ công', !ev.manualIncomePosted, 'Nguồn đã được ghi thu thủ công'),
  ]
}
export const blockReason = (checks: AcceptanceCheck[]) => checks.find((c) => !c.ok)?.detail ?? null

export function candidateSummary(checks: AcceptanceCheck[]) {
  const failed = checks.filter((c) => !c.ok)
  if (failed.length === 0) return { ok: true, text: 'Hợp lệ để chấp nhận' }
  if (failed.length === 1 && failed[0]?.key === 'code') return { ok: false, text: 'Khớp tiền, tài khoản, thời gian · lệch mã' }
  return { ok: false, text: `Không đạt: ${failed.map((f) => f.label.toLowerCase()).join(', ')}` }
}

/** Ứng viên: yêu cầu chưa thanh toán mà chứng từ có thể được xem xét cho (mã đúng, hoặc tiền + thời gian khớp). */
export function findCandidates(ev: Evidence, payments: PlatformPayment[]) {
  if (ev.direction !== 'IN' || ev.lockedForReturn || ev.paymentId !== null) return []
  const exact = new Set(exactCodeMatches(ev.content, payments).map((p) => p.id))
  return payments.filter((p) => p.state !== 'PAID' && (exact.has(p.id) || (p.amount === ev.amount && ev.bankPaidAt >= p.createdAt && ev.bankPaidAt < p.expiresAt)))
}

export const MATCH_LABEL: Record<MatchResult, string> = {
  EXACT_CODE: 'Khớp mã',
  CODE_MISMATCH: 'Không khớp mã',
  AUTO_PAID: 'Tự động · Đã thanh toán',
  REQUEST_EXPIRED: 'Yêu cầu đã hết hạn',
  NO_REQUEST: 'Không có yêu cầu',
  AMOUNT_MISMATCH: 'Sai số tiền',
  OUTGOING: 'Chuyển ra',
}
export const MATCH_TONE: Record<MatchResult, 'ok' | 'err' | 'warn' | 'outline'> = {
  EXACT_CODE: 'ok', CODE_MISMATCH: 'err', AUTO_PAID: 'ok', REQUEST_EXPIRED: 'warn', NO_REQUEST: 'outline', AMOUNT_MISMATCH: 'err', OUTGOING: 'outline',
}
export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  TO_REVIEW: 'Chưa xử lý', HOLD: 'Tạm giữ', REJECTED: 'Từ chối', ACCEPTED: 'Đã chấp nhận', AUTO_CONFIRMED: 'Tự động xác nhận',
}
export function evidenceStatusLabel(ev: Evidence) {
  return ev.lockedForReturn ? 'Đã khóa chờ hoàn' : REVIEW_LABEL[ev.reviewStatus]
}
export const PAYMENT_STATE_LABEL = { PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', EXPIRED: 'Hết hạn' } as const
