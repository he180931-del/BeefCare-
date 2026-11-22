import type { BackendTransport } from './backendTransport'
import { asRecord, asRows, nullableNumber, numberValue, textValue } from './parse'
import { requireVersion } from './snapshotVersion'
import type { VoidVoucherPaymentInput, VoucherPayment, VoucherPaymentResult } from '../domain/voucherPayment'

export const mapVoucherPayment = (value: unknown): VoucherPayment => {
  const row = asRecord(value)
  return {
    id: nullableNumber(row.id) ?? undefined, version: nullableNumber(row.version) ?? undefined,
    // Old demo/legacy payment rows did not include status; they represented recorded payments.
    status: row.status === 'VOIDED' ? 'VOIDED' : 'RECORDED',
    date: textValue(row.paymentDate ?? row.date), by: textValue(row.recordedByName ?? row.recordedBy ?? row.createdBy, '—'),
    method: row.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', ref: textValue(row.reference, '—'), amount: numberValue(row.amount),
    note: textValue(row.note), voidReason: textValue(row.voidReason), voidedAt: textValue(row.voidedAt),
  }
}
export const mapVoucherPayments = (value: unknown): VoucherPayment[] => asRows(value).map(mapVoucherPayment)

async function intentDigest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
  }
  // Same deterministic fallback as existing voucher commands on non-secure local HTTP.
  let first = 0x811c9dc5, second = 0x9e3779b9
  for (const byte of bytes) { first = Math.imul(first ^ byte, 0x01000193); second = Math.imul(second ^ byte, 0x85ebca6b) }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

export async function voidVoucherPayment(transport: BackendTransport, farmId: string | number | null, paymentId: number, input: VoidVoucherPaymentInput): Promise<VoucherPaymentResult> {
  const version = requireVersion(input.version)
  const reason = input.reason.trim()
  if (!reason || reason.length > 500) throw new Error('Lý do hủy là bắt buộc và không quá 500 ký tự.')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw new Error('Không tìm thấy khoản thanh toán hợp lệ.')
  const body = { reason, version }
  // Fixed, alphabetically ordered primitive fields give a canonical representation of this intent.
  const key = `beefcare-voucher-payment-void-${await intentDigest(JSON.stringify({ paymentId, reason, version }))}`
  const result = asRecord(await transport.command(transport.farmPath(farmId, `/payments/${paymentId}/void`), body, { key }))
  const summary = asRecord(result.summary)
  return { payment: mapVoucherPayment(result.payment), summary: {
    total: numberValue(summary.total), paid: numberValue(summary.paid), outstanding: numberValue(summary.outstanding),
    overpaid: numberValue(summary.overpaid), voucherVersion: nullableNumber(summary.voucherVersion) ?? undefined,
  } }
}
