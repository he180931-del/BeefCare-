import { useRef, useState } from 'react'
import { Field, Modal, ModalButton, ModalFooter, Note, Textarea } from './index'
import { VoucherCommandError } from './VoucherCommandError'
import { canVoidVoucherPayment, type VoidVoucherPaymentInput, type VoucherPayment } from '../domain/voucherPayment'
import { dmy, money } from '../lib/format'

export function VoidVoucherPaymentModal({ payment, onVoid, onSuccess, onReload, onClose }: {
  payment: VoucherPayment
  onVoid: (id: number, input: VoidVoucherPaymentInput) => Promise<unknown>
  onSuccess: (payment: VoucherPayment) => Promise<void>
  onReload: () => Promise<unknown>
  onClose: () => void
}) {
  const [snapshot] = useState(payment)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const inFlight = useRef(false)
  const valid = canVoidVoucherPayment(snapshot) && reason.trim().length > 0 && reason.trim().length <= 500
  const submit = async () => {
    if (!valid || inFlight.current) return
    inFlight.current = true; setSaving(true); setError(null)
    try {
      await onVoid(snapshot.id!, { reason: reason.trim(), version: snapshot.version })
      await onSuccess(snapshot)
    } catch (nextError) { setError(nextError) }
    finally { inFlight.current = false; setSaving(false) }
  }
  return <Modal title="Hủy khoản thanh toán" width={560} onClose={() => { if (!inFlight.current) onClose() }}>
    <Note>Hủy khoản thanh toán {money(snapshot.amount)} đ ngày {dmy(snapshot.date)}? Nhập lý do. Khoản này vẫn nằm trong lịch sử phiếu.</Note>
    <Field label="Lý do hủy *" id="voucher-payment-void-reason">
      <Textarea id="voucher-payment-void-reason" maxLength={500} rows={3} disabled={saving} value={reason} onChange={event => setReason(event.target.value)} />
    </Field>
    <VoucherCommandError error={error} onReload={onReload} />
    <ModalFooter>
      <ModalButton disabled={saving} onClick={onClose}>Đóng</ModalButton>
      <ModalButton variant="danger" disabled={!valid || saving} onClick={() => { void submit() }}>{saving ? 'Đang hủy…' : 'Hủy khoản'}</ModalButton>
    </ModalFooter>
  </Modal>
}
