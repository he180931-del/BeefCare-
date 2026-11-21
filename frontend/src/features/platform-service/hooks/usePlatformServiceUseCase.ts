import { useQuery } from '../../../shared/hooks/useQuery'
import { platformServiceApi } from '../api/platformServiceApi'
import { platformPaymentReadApi as paymentReadApi } from '../api/platformPaymentReadApi'
import { planPriceApi } from '../api/planPriceApi'
import type { EvidenceFilters, FarmFilters, SubscriptionFilters } from '../types'
import type { EvidenceReadFilters, PaymentReadFilters } from '../api/platformPaymentReadApi'

/** Feature query boundary for platform service and payment administration screens. */
export function useFarmList(filters: FarmFilters, refresh = 0) {
  return useQuery(() => platformServiceApi.listFarms(filters), [filters, refresh])
}

export function useFarmServicePreview(farmId: number) {
  return useQuery(() => platformServiceApi.getFarmService(farmId), [farmId])
}

export function useSubscriptionDetail(farmId: number, refresh = 0) {
  return useQuery(() => platformServiceApi.getSubscription(farmId), [farmId, refresh])
}

export function useSubscriptionList(filters: SubscriptionFilters, refresh = 0) {
  return useQuery(() => platformServiceApi.listSubscriptions(filters), [filters, refresh])
}

export function useSourcePayment(paymentId: number, farmId?: number) {
  return useQuery(async () => {
    if (!Number.isSafeInteger(paymentId) || paymentId <= 0) throw new Error('Mã thanh toán không hợp lệ.')
    const payment = await platformServiceApi.getPayment(paymentId)
    if (farmId !== undefined && payment.farmId !== farmId) throw new Error('Thanh toán không thuộc trại đã chọn.')
    return payment
  }, [paymentId, farmId])
}

export function useReconciliationQueries(filters: EvidenceFilters, selectedId: number, refresh = 0) {
  const list = useQuery(() => platformServiceApi.listEvidence(filters), [filters, refresh])
  const tiles = useQuery(() => platformServiceApi.paymentTiles(), [refresh])
  const payments = useQuery(() => platformServiceApi.listPayments(), [refresh])
  const selected = useQuery(() => platformServiceApi.getEvidence(selectedId), [selectedId, refresh])
  const candidates = useQuery(() => platformServiceApi.listCandidates(selectedId), [selectedId, refresh])
  return { list, tiles, payments, selected, candidates }
}

export function usePaymentReadTiles(refresh = 0) {
  return useQuery(paymentReadApi.tiles, [refresh])
}

export function usePaymentReadEvidence(id: number, refresh = 0) {
  return useQuery(() => Promise.all([paymentReadApi.evidenceDetail(id), paymentReadApi.candidates(id)]), [id, refresh])
}

export function usePaymentReadPayment(filters: PaymentReadFilters, refresh = 0) {
  return useQuery(() => paymentReadApi.payments(filters), [filters, refresh])
}

export function usePaymentReadPaymentDetail(id: number | null, refresh = 0) {
  return useQuery(async () => {
    if (id === null) throw new Error('Mã thanh toán không hợp lệ.')
    return paymentReadApi.payment(id)
  }, [id, refresh])
}

export function usePaymentReadEvidenceList(filters: EvidenceReadFilters, refresh = 0) {
  return useQuery(() => paymentReadApi.evidence(filters), [filters, refresh])
}

export function usePlanPriceList(page: number, refresh = 0) {
  return useQuery(() => planPriceApi.list(page), [page, refresh])
}
