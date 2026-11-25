import { money } from '../../../shared/lib/format'

export type EntryPaymentField = 'date' | 'amount' | 'ref' | 'note'
export type EntryPaymentErrors = Partial<Record<EntryPaymentField, string>>
export const PAYMENT_REF_MAX = 100
export const PAYMENT_NOTE_MAX = 500

/**
 * Popup Ghi thanh toán #3–#8 (R-06-17): date required, not in the future (MSG-COM-07) and not before
 * the voucher date; amount a whole number > 0 and ≤ outstanding (MSG-FE06-13); reference ≤ 100; note ≤ 500.
 */
export function validateEntryPayment(
  input: { date: string; amount: number; ref?: string; note?: string },
  context: { today: string; voucherDate?: string; outstanding: number },
): EntryPaymentErrors {
  const errors: EntryPaymentErrors = {}
  if (!input.date) errors.date = 'Ngày thanh toán là bắt buộc.'
  else if (input.date > context.today) errors.date = 'Ngày thanh toán không được ở tương lai.'
  else if (context.voucherDate && input.date < context.voucherDate) errors.date = 'Ngày thanh toán không được trước ngày phiếu.'
  if (!Number.isInteger(input.amount) || input.amount <= 0) errors.amount = 'Số tiền phải là số nguyên lớn hơn 0.'
  else if (input.amount > context.outstanding) errors.amount = `Số tiền không được vượt quá ${money(context.outstanding)} đ.`
  if ((input.ref ?? '').length > PAYMENT_REF_MAX) errors.ref = `Số tham chiếu tối đa ${PAYMENT_REF_MAX} ký tự.`
  if ((input.note ?? '').length > PAYMENT_NOTE_MAX) errors.note = `Ghi chú tối đa ${PAYMENT_NOTE_MAX} ký tự.`
  return errors
}
