/** Farm voucher bookkeeping; unrelated to subscription/platform payments. */
export interface VoucherPayment {
  id?: number
  version?: number
  status?: 'RECORDED' | 'VOIDED'
  date: string
  by: string
  method: string
  ref: string
  amount: number
  note?: string
  voidReason?: string
  voidedAt?: string
}

export type VoidVoucherPaymentInput = { reason: string; version: number | undefined }
export type VoucherPaymentResult = {
  payment: VoucherPayment
  summary: { total: number; paid: number; outstanding: number; overpaid: number; voucherVersion?: number }
}

export const recordedTotal = (payments: ReadonlyArray<Pick<VoucherPayment, 'amount' | 'status'>> = []): number =>
  payments.reduce((sum, payment) => sum + (payment.status === 'VOIDED' ? 0 : payment.amount), 0)

export const canVoidVoucherPayment = (payment: VoucherPayment): boolean => payment.status !== 'VOIDED'
  && Number.isInteger(payment.id) && payment.id! > 0 && Number.isInteger(payment.version) && payment.version! >= 0
