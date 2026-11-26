import { useEffect, useState } from 'react'
import { pageLoader, writeCurrentFarmId } from '../../../app/session/currentFarm'
import { BackendError } from '../../../shared/api/backendClient'
import { userFacingError } from '../../../shared/api/userFacingError'
import { LoadingBlock } from '../../../shared/ui'
import { STORAGE_BLOCKED, enterFarm, farmWorkspaceError } from '../../farm-workspace'
import { subscriptionApi } from '../api/subscriptionApi'
import { fmtPeriod } from '../domain/subscriptionRules'
import type { Payment } from '../types'
import { PaymentSuccessDialog, rememberPaymentSuccess, type Confirmation } from './PaymentSuccessDialog'

export default function PaidTransfer({ farmId, farmName, payment, checkAccess, onClose }: {
  farmId: number
  farmName?: string
  payment: Payment
  checkAccess: boolean
  onClose: () => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // This component is keyed by the paid request and keeps its receipt during farm entry and retry.
  const [confirmation] = useState<Confirmation>(() => ({
    paymentRouteId: subscriptionApi.paymentRouteId(payment),
    quoteRef: payment.quoteRef,
    amountVnd: payment.amountVnd,
    durationYears: payment.durationYears,
    period: payment.purchasedStart && payment.purchasedEnd ? fmtPeriod(payment.purchasedStart, payment.purchasedEnd) : '',
    bankPaidAt: payment.bankPaidAt ?? '',
    confirmedAt: payment.confirmedAt ?? '',
    receiptCode: payment.receiptCode ?? '',
  }))

  useEffect(() => {
    const controller = new AbortController()
    const load = (target: string) => {
      rememberPaymentSuccess(farmId, confirmation)
      pageLoader.replace(target)
    }

    async function openFarm() {
      if (controller.signal.aborted) return
      try {
        if (checkAccess) {
          const blocked = await enterFarm(farmId, () => '/tong-quan', { signal: controller.signal, load })
          if (blocked && !controller.signal.aborted) setError(blocked)
        } else if (writeCurrentFarmId(farmId)) {
          // The demo payment and farm workspace stores have separate fixtures.
          load('/tong-quan')
        } else {
          setError(STORAGE_BLOCKED)
        }
      } catch (reason) {
        if (controller.signal.aborted) return
        const fallback = 'Chưa vào được trang trại. Vui lòng thử lại.'
        setError(reason instanceof BackendError ? farmWorkspaceError(reason, fallback) : userFacingError(reason, fallback))
      }
    }

    queueMicrotask(() => void openFarm())
    return () => controller.abort()
  }, [farmId, confirmation, checkAccess, attempt])

  if (error) {
    return <PaymentSuccessDialog confirmation={confirmation} farmName={farmName} error={error} onClose={onClose} onRetry={() => {
      setError(null)
      setAttempt((value) => value + 1)
    }} />
  }

  return <LoadingBlock>Đang vào trại…</LoadingBlock>
}
