import { useRef } from 'react'
import { BackendError } from '../../../api/backendClient'
import { subscriptionApi } from '../api/subscriptionApi'
import { SubscriptionError, type Payment, type Term } from '../types'

/** One intent keeps its key across a lost response; changing the reviewed input starts another intent. */
export function usePaymentRequest(farmId: number) {
  const intent = useRef<{ input: string; key: string } | null>(null)
  const running = useRef<Promise<Payment> | null>(null)
  return (term: Term, priceVersion: number) => {
    if (running.current) return running.current
    const input = `${farmId}:${term}:${priceVersion}`
    if (intent.current?.input !== input) intent.current = { input, key: crypto.randomUUID() }
    const promise = subscriptionApi.createPayment(farmId, {
      durationYears: term, expectedPriceVersionId: priceVersion, idempotencyKey: intent.current.key,
    }).then((payment) => { intent.current = null; return payment }).catch((error: unknown) => {
      if (error instanceof SubscriptionError || error instanceof BackendError && error.status < 500) intent.current = null
      throw error
    }).finally(() => { running.current = null })
    running.current = promise
    return promise
  }
}
