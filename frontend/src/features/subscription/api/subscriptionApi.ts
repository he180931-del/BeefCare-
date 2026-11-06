import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { subscriptionDemoStore, type SubscriptionDemoStore } from '../data/subscriptionDemoStore'
import type { CreatePaymentCommand, PaymentFilters, RefreshDemo } from '../types'

export function createSubscriptionApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: SubscriptionDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('gói dịch vụ') }
  return {
    // chưa có API: đồng hồ phía client (backend dùng giờ hệ thống)
    now(): number { return mode === 'backend' ? Date.now() : store.now() },
    // GET /api/farms/{farmId}/subscription
    async getOverview(farm: number) { requireLocal(); return store.getOverview(farm) },
    // GET /api/farms/{farmId}/subscription/payments (openapi chưa có tham số lọc/sắp xếp)
    async listPayments(farm: number, filters: PaymentFilters = {}) { requireLocal(); return store.listPayments(farm, filters) },
    // GET /api/farms/{farmId}/subscription/payments/{paymentId} (mock tra theo mã quoteRef)
    async getPayment(farm: number, code: string) { requireLocal(); return store.getPayment(farm, code) },
    // POST /api/farms/{farmId}/subscription/payments
    async createPayment(farm: number, command: CreatePaymentCommand) { requireLocal(); return store.createPayment(farm, command) },
    // GET /api/farms/{farmId}/subscription/payments/{paymentId} (Kiểm tra lại)
    async refreshPayment(farm: number, code: string, demo?: RefreshDemo) { requireLocal(); return store.refreshPayment(farm, code, demo) },
  }
}
export type SubscriptionApi = ReturnType<typeof createSubscriptionApi>
export const subscriptionApi = createSubscriptionApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: subscriptionDemoStore })
