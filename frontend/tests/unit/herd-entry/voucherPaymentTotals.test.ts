import { expect, it } from 'vitest'
import { recordedTotal } from '../../../src/shared/domain/voucherPayment'
import { entryPaymentTotals } from '../../../src/features/herd-entry/domain/entryPaymentTotals'
import { exitPaymentTotals } from '../../../src/features/herd-exit/domain/exitPaymentTotals'

const payments = [
  { date: '2026-10-20', by: 'Owner', method: 'Tiền mặt', ref: '—', amount: 3000000, status: 'VOIDED' as const },
  { date: '2026-10-20', by: 'Manager', method: 'Tiền mặt', ref: '—', amount: 2000000, status: 'RECORDED' as const },
  { date: '2026-10-20', by: 'Owner', method: 'Tiền mặt', ref: '—', amount: 1000000 },
]
it('counts only recorded payments, retaining compatibility with legacy demo rows without status', () => {
  expect(recordedTotal(payments)).toBe(3000000)
  expect(recordedTotal([])).toBe(0)
})
it('uses authoritative entry totals, including zero, even if payment rows disagree', () => {
  expect(entryPaymentTotals({ id: 'PN', status: 'Đã nhập', total: 10000000, paid: 0, debt: 10000000, detail: { payments } })).toEqual({ paid: 0, outstanding: 10000000 })
})
it('uses authoritative exit collection rather than the initial deposit or sum of rows', () => {
  expect(exitPaymentTotals({ id: 'PX', status: 'Đã xuất', total: 10000000, collected: 2000000, due: 8000000, detail: { payments } })).toEqual({ collected: 2000000, outstanding: 8000000 })
})
it('falls back to recorded totals and derived nonnegative outstanding when server totals are absent', () => {
  expect(entryPaymentTotals({ id: 'PN', status: 'Đã nhập', total: 10000000, detail: { payments } })).toEqual({ paid: 3000000, outstanding: 7000000 })
  expect(exitPaymentTotals({ id: 'PX', status: 'Đã xuất', total: 10000000, detail: { payments } })).toEqual({ collected: 3000000, outstanding: 7000000 })
  expect(entryPaymentTotals({ id: 'PN', status: 'Đã nhập', total: 1, detail: { payments } }).outstanding).toBe(0)
})
