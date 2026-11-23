import { useEffect, useState } from 'react'
import { pageLoader, writeCurrentFarmId } from '../../../app/session/currentFarm'
import { BackendError } from '../../../shared/api/backendClient'
import { userFacingError } from '../../../shared/api/userFacingError'
import { LoadingBlock } from '../../../shared/ui'
import { STORAGE_BLOCKED, enterFarm, farmWorkspaceError } from '../../farm-workspace'
import { fmtPeriod } from '../domain/subscriptionRules'
import type { Payment } from '../types'
import { PaymentSuccessDialog, rememberPaymentSuccess } from './PaymentSuccessDialog'

export default function PaidTransfer({ farmId, payment, checkAccess, onClose }: {
  farmId: number
  payment: Payment
  checkAccess: boolean
  onClose: () => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const { quoteRef, purchasedStart, purchasedEnd } = payment
  const period = purchasedStart && purchasedEnd ? fmtPeriod(purchasedStart, purchasedEnd) : null

  useEffect(() => {
    const controller = new AbortController()
    const load = (target: string) => {
      rememberPaymentSuccess(farmId, { quoteRef, period })
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
  }, [farmId, quoteRef, period, checkAccess, attempt])

  if (error) {
    return <PaymentSuccessDialog confirmation={{ quoteRef, period }} error={error} onClose={onClose} onRetry={() => {
      setError(null)
      setAttempt((value) => value + 1)
    }} />
  }

  return <LoadingBlock>Đang vào trại…</LoadingBlock>
}
