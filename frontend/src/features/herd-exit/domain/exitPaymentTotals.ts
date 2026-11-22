import { recordedTotal } from '../../../shared/domain/voucherPayment'
import type { HerdExit } from '../types'

export function exitPaymentTotals(record: HerdExit) {
  const collected = record.collected ?? recordedTotal(record.detail?.payments)
  return { collected, outstanding: record.due ?? Math.max((record.total ?? 0) - collected, 0) }
}
