import { useEffect, useRef, useState } from 'react'
import { BackendError } from '../../../api/backendClient'
import { subscriptionApi } from '../api/subscriptionApi'
import { paymentLabel } from '../components/shared'
import type { Payment, RefreshDemo } from '../types'

/** Scoped reads, one request at a time. Late responses cannot replace another farm/payment. */
export function usePaymentStatus(farmId: number, id: string, demo?: RefreshDemo) {
  const scope = `${farmId}:${id}`
  const [state, setState] = useState<{ scope: string; payment: Payment | null; loading: boolean; checking: boolean; error: unknown; notice: string }>(
    { scope, payment: null, loading: true, checking: false, error: null, notice: '' })
  const refresh = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    let active = true
    let busy = false
    let current: Payment | null = null
    let poll: ReturnType<typeof setTimeout> | undefined
    let expiry: ReturnType<typeof setTimeout> | undefined
    const clear = () => { clearTimeout(poll); clearTimeout(expiry) }
    setState({ scope, payment: null, loading: true, checking: false, error: null, notice: '' })

    async function read(initial = false, manual = false) {
      if (!active || busy) return
      busy = true
      clear()
      if (!initial) setState((s) => ({ ...s, checking: true }))
      try {
        const result = initial ? await subscriptionApi.getPayment(farmId, id) : await subscriptionApi.refreshPayment(farmId, id, demo)
        if (!active) return
        current = result
        setState({ scope, payment: result, loading: false, checking: false, error: null, notice: '' })
      } catch (error) {
        if (!active) return
        if (error instanceof BackendError && [401, 403, 404].includes(error.status)) current = null
        const last = current
        setState({ scope, payment: last, loading: false, checking: false, error: last ? null : error,
          notice: last ? `Không lấy được kết quả thanh toán mới nhất. Trạng thái gần nhất: ${paymentLabel(last.state)}. Vui lòng thử lại.` : '' })
        if (manual) throw error
      } finally {
        busy = false
        if (active && current?.state === 'PENDING') {
          const remaining = Date.parse(current.expiresAt) - subscriptionApi.now()
          if (remaining > 0) {
            poll = setTimeout(() => { void read() }, 5000)
            expiry = setTimeout(() => { void read() }, remaining)
          }
        }
      }
    }
    refresh.current = () => read(false, true)
    void read(true)
    return () => { active = false; clear() }
  }, [farmId, id, demo, scope])

  return { ...(state.scope === scope ? state : { payment: null, loading: true, checking: false, error: null, notice: '' }),
    refresh: () => refresh.current() }
}
