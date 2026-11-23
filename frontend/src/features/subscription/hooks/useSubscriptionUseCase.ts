import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { subscriptionApi } from '../api/subscriptionApi'
import type { PaymentFilters } from '../types'

export interface SubscriptionHistoryInput {
  farmId: number
  paymentId?: string
  query: PaymentFilters
}

export interface SubscriptionBoundary {
  now: () => number
  entersFarmAfterPayment: boolean
}

/**
 * UI boundary for subscription capabilities that are not remote queries.
 * Pages consume these feature decisions without reaching the API adapter.
 */
export function useSubscriptionBoundary(): SubscriptionBoundary {
  const now = useCallback(() => subscriptionApi.now(), [])
  return { now, entersFarmAfterPayment: subscriptionApi.entersFarmAfterPayment }
}

/** Query boundary for the subscription payment history screen. */
export function useSubscriptionUseCase({ farmId, paymentId, query }: SubscriptionHistoryInput) {
  const list = useQuery(
    () => subscriptionApi.listPayments(farmId, query),
    [farmId, query.q, query.state, query.from, query.to, query.sort, query.dir, query.page],
  )
  const detail = useQuery(
    () => paymentId ? subscriptionApi.getPayment(farmId, paymentId) : Promise.resolve(null),
    [farmId, paymentId],
  )
  return {
    list,
    detail,
    paymentRouteId: subscriptionApi.paymentRouteId,
  }
}
