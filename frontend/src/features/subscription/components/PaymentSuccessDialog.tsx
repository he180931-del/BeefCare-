import { useEffect, useState } from 'react'
import { asRecord } from '../../../shared/api/parse'
import { Button, Modal, ModalFooter, Note } from '../../../shared/ui'

const SUCCESS_KEY = 'beefcare.subscription.paymentSuccess'

interface Confirmation {
  quoteRef: string
  period: string | null
}

/** The confirmation is optional: when the browser refuses to keep it, the paid farm still opens without the dialog. */
export function rememberPaymentSuccess(farmId: number, confirmation: Confirmation) {
  try {
    sessionStorage.setItem(SUCCESS_KEY, JSON.stringify({ farmId, ...confirmation }))
  } catch {
    // Entering the farm matters more than showing the confirmation there.
  }
}

export function PaymentSuccessDialog({ confirmation, error, onClose, onRetry }: {
  confirmation: Confirmation
  error?: string
  onClose: () => void
  onRetry?: () => void
}) {
  return (
    <Modal title="Thanh toán thành công" width={560} onClose={onClose}>
      <Note tone="ok">
        Thanh toán {confirmation.quoteRef} đã được xác nhận.
        {confirmation.period && <> Kỳ dịch vụ {confirmation.period}.</>}
      </Note>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter>
        {onRetry && <Button onClick={onClose}>Đóng xác nhận</Button>}
        <Button autoFocus variant="primary" onClick={onRetry ?? onClose}>{onRetry ? 'Thử vào trại lại' : 'Tiếp tục'}</Button>
      </ModalFooter>
    </Modal>
  )
}

export function PaymentSuccessOnArrival({ farmId }: { farmId: number | null }) {
  const [confirmation, setConfirmation] = useState<(Confirmation & { farmId: number }) | null>(null)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SUCCESS_KEY)
      if (saved === null) return
      sessionStorage.removeItem(SUCCESS_KEY)
      const { farmId: paidFarm, quoteRef, period } = asRecord(JSON.parse(saved))
      if (farmId !== null && paidFarm === farmId && typeof quoteRef === 'string') {
        setConfirmation({ farmId, quoteRef, period: typeof period === 'string' ? period : null })
      }
    } catch {
      // The confirmation is optional for a direct visit to the farm dashboard.
    }
  }, [farmId])

  return confirmation?.farmId === farmId && <PaymentSuccessDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
}
