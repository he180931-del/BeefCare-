import { addDays, dateOf, daysBetween, fmtDate, fmtDateTime } from './healthFormat'
import type { HealthState } from '../types'

export const MSG = {
  required: (field: string) => `${field} là bắt buộc.`,
  future: 'Thời điểm không được ở tương lai.',
  beforeEntry: (date: string) => `Thời điểm không được trước ngày nhập đàn (${fmtDate(date)}).`,
  beforeCase: (at: string, what: string) => `Thời điểm không được trước ${fmtDateTime(at)}, ${what}.`,
  temperature: 'Thân nhiệt phải trong khoảng 35,0 – 43,0 °C.',
  changed: 'Bản ghi đã được thay đổi hoặc không còn ở trạng thái cho phép thao tác. Vui lòng tải lại và kiểm tra trước khi thử lại.',
  exited: (code: string, date: string, type: string) => `${code} đã rời đàn ngày ${fmtDate(date)} (${type}). Hồ sơ chỉ được xem.`,
  pendingExit: 'Bò đang chờ xác nhận chết / mất nên chưa nhận thêm sự kiện chăm sóc mới.',
  inactiveMedicine: (name: string) => `${name} đã ngưng sử dụng, không thể chọn cho bản ghi mới.`,
  voidOpening: 'Lần ghi mở ca không thể hủy. Hãy sửa lại, hoặc đóng ca kèm lý do.',
}

/** Ngày của lần dùng cuối = ngày dùng đầu + (số ngày liệu trình − 1). */
export const lastDoseDate = (administeredAt: string, courseDays: number) => addDays(dateOf(administeredAt), Math.max(courseDays, 1) - 1)

/** GBR-46: hết ngưng = ngày dùng cuối + số ngày ngưng. */
export const withdrawalEnd = (administeredAt: string, courseDays: number, withdrawalDays: number) => addDays(lastDoseDate(administeredAt, courseDays), withdrawalDays)

interface TreatmentLike { status: string; type: string; occurredAt: string; courseDays?: number; withdrawalDays?: number }

/** Ngày hết ngưng muộn nhất trong các điều trị hợp lệ; null khi không có. */
export function latestWithdrawalEnd(entries: TreatmentLike[]): string | null {
  let latest: string | null = null
  for (const e of entries) {
    if (e.type !== 'TREATMENT' || e.status !== 'VALID') continue
    const end = withdrawalEnd(e.occurredAt, e.courseDays ?? 1, e.withdrawalDays ?? 0)
    if (!latest || end > latest) latest = end
  }
  return latest
}

/** GBR-45. */
export function computeHealthState(
  cases: Array<{ id: number; status: string }>,
  entries: Array<{ caseId: number; type: string; status: string }>,
): HealthState {
  const active = cases.filter((c) => c.status === 'OPEN' || c.status === 'CHRONIC')
  const treating = cases.some((c) => c.status === 'OPEN' && entries.some((e) => e.caseId === c.id && e.type === 'TREATMENT' && e.status === 'VALID'))
  if (treating) return 'UNDER_TREATMENT'
  return active.length > 0 ? 'MONITORING' : 'HEALTHY'
}

/** Ngày 1 là ngày mở ca. */
export const caseDay = (openedAt: string, now: string) => daysBetween(openedAt, now) + 1

export const isWithdrawalActive = (end: string | null | undefined, now: string): end is string => !!end && end >= dateOf(now)
