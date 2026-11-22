import { recordedTotal } from '../../../shared/domain/voucherPayment'
import type { HerdEntry } from '../types'

export function entryPaymentTotals(record: HerdEntry) {
  const paid = record.paid ?? recordedTotal(record.detail?.payments)
  return { paid, outstanding: record.debt ?? Math.max((record.total ?? 0) - paid, 0) }
}
