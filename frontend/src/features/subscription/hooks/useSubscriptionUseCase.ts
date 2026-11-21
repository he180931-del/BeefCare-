import { useQuery } from '../../../shared/hooks/useQuery'
import { subscriptionApi } from '../api/subscriptionApi'
import type { PaymentFilters } from '../types'

export interface SubscriptionHistoryInput {
  farmId: number
  paymentId?: string
  query: PaymentFilters
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
