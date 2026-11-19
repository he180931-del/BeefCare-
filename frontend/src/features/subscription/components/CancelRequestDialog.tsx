import { useRef, useState } from 'react'
import { userFacingError } from '../../../api/userFacingError'
import Modal from '../../../components/Modal'
import { Button, Field, Note, Textarea } from '../../../components/ui'
import { DISCARD_PROMPT } from '../../farm-workspace/domain/discardPrompt'
import { CANCEL_REASON_MAX, subscriptionApi } from '../api/subscriptionApi'
import { stateFromError } from '../domain/subscriptionRules'
import { SubscriptionError, type Payment, type StateDialogState } from '../types'

interface Props {
  farmId: number
  payment: Payment
  onClose: () => void
  onCancelled: (payment: Payment) => void
  /** MSG-FE19-19: a transfer was received meanwhile; the page shows the dialog and reloads. */
  onBlocked: (state: StateDialogState) => void
  /** MSG-COM-05: the request changed (paid / expired / cancelled elsewhere); the page reloads with a notice. */
  onStale: (message: string) => void
}

/** MSG-FE19-17 (D38): confirm cancelling a PENDING request, with an optional reason. */
export default function CancelRequestDialog({ farmId, payment, onClose, onCancelled, onBlocked, onStale }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discarding, setDiscarding] = useState(false)
  // Table III-1: closing after typing a reason asks first (MSG-COM-14); an empty optional reason closes at once.
  const close = () => { if (busy) return; if (reason.trim() && !discarding) setDiscarding(true); else onClose() }
  // One key per intent: a retry after a network error resends the same reason with the same key.
  const intent = useRef<{ reason: string; key: string } | null>(null)
  const trimmed = reason.trim()
  const tooLong = trimmed.length > CANCEL_REASON_MAX

  async function confirm() {
    if (tooLong || busy) return
    if (intent.current?.reason !== trimmed) intent.current = { reason: trimmed, key: crypto.randomUUID() }
    setBusy(true)
    setError(null)
    try {
      onCancelled(await subscriptionApi.cancelPayment(farmId, payment, trimmed, intent.current.key))
    } catch (failure) {
      const blocked = stateFromError(failure)
      if (blocked?.kind === 'cancel-blocked') return onBlocked(blocked)
      if (failure instanceof SubscriptionError && failure.code === 'STALE') return onStale(failure.message)
      setError(userFacingError(failure, 'Không hủy được yêu cầu. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Hủy yêu cầu thanh toán" sub={payment.quoteRef} width={520} onClose={close}>
      <Note tone="warn">
        Hủy yêu cầu thanh toán {payment.quoteRef}? Mã thanh toán và mã QR của yêu cầu này sẽ không dùng được nữa. Nếu bạn đã chuyển khoản,
        đừng hủy: giao dịch sẽ được xác nhận tự động.
      </Note>
      <Field label="Lý do (không bắt buộc)" id="cancel-reason"
        hint={<span className={tooLong ? 'text-err-fg' : undefined}>{trimmed.length.toLocaleString('vi-VN')} / {CANCEL_REASON_MAX.toLocaleString('vi-VN')} ký tự</span>}>
        <Textarea id="cancel-reason" rows={3} value={reason} disabled={busy}
          onChange={(e) => { setReason(e.target.value); setError(null); setDiscarding(false) }} aria-invalid={tooLong || undefined} />
      </Field>
      {tooLong && <p role="alert" className="m-0 text-[12px] text-err-fg">Lý do tối đa {CANCEL_REASON_MAX.toLocaleString('vi-VN')} ký tự.</p>}
      {error && <Note tone="err">{error}</Note>}
      {discarding && <Note tone="warn">{DISCARD_PROMPT.question}</Note>}
      <div className="flex flex-wrap justify-end gap-3">
        {discarding ? <>
          <Button size="lg" onClick={() => setDiscarding(false)}>{DISCARD_PROMPT.keep}</Button>
          <Button size="lg" variant="danger" onClick={onClose}>{DISCARD_PROMPT.discard}</Button>
        </> : <>
          <Button size="lg" disabled={busy} onClick={close}>Quay lại</Button>
          <Button size="lg" variant="danger" disabled={busy || tooLong} onClick={() => void confirm()}>{busy ? 'Đang hủy…' : 'Hủy yêu cầu'}</Button>
        </>}
      </div>
    </Modal>
  )
}
