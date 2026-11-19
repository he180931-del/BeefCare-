import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { platformServiceDemoStore, type PlatformServiceDemoStore } from '../data/platformServiceDemoStore'
import type {
  ChangeFarmCommand, EvidenceFilters, FarmFilters, LockCommand, PaymentFilters, PriceDraft, PublishPriceCommand, ReturnCommand, ReviewCommand, SubscriptionFilters, UnlockCommand,
} from '../types'

export function createPlatformServiceApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: PlatformServiceDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('dịch vụ trang trại và thanh toán') }
  return {
    // GET /api/platform/farms
    async listFarms(filters: FarmFilters = {}) { requireLocal(); return store.listFarms(filters) },
    // POST /api/platform/farms/{farmId}/suspend
    async suspendFarm(id: number, cmd: ChangeFarmCommand) { requireLocal(); return store.suspendFarm(id, cmd) },
    // POST /api/platform/farms/{farmId}/restore
    async restoreFarm(id: number, cmd: ChangeFarmCommand) { requireLocal(); return store.restoreFarm(id, cmd) },
    // GET /api/platform/subscriptions
    async listSubscriptions(filters: SubscriptionFilters = {}) { requireLocal(); return store.listSubscriptions(filters) },
    // GET /api/platform/subscriptions/{farmId}
    async getSubscription(id: number) { requireLocal(); return store.getSubscription(id) },
    // GET /api/platform/payments/summary
    async paymentTiles() { requireLocal(); return store.paymentTiles() },
    // GET /api/platform/payments/evidence
    async listEvidence(filters: EvidenceFilters = {}) { requireLocal(); return store.listEvidence(filters) },
    // chưa có API (một chứng từ; hiện lấy từ GET /api/platform/payments/evidence)
    async getEvidence(id: number) { requireLocal(); return store.getEvidence(id) },
    // GET /api/platform/payments
    async listPayments(filters: PaymentFilters = {}) { requireLocal(); return store.listPayments(filters) },
    // GET /api/platform/payments/evidence/{evidenceId}/candidates
    async listCandidates(evidenceId: number) { requireLocal(); return store.listCandidates(evidenceId) },
    // POST /api/platform/payments/evidence/{evidenceId}/review
    async reviewEvidence(evidenceId: number, cmd: ReviewCommand) { requireLocal(); return store.reviewEvidence(evidenceId, cmd) },
    // POST /api/platform/payments/evidence/{evidenceId}/lock-return
    async lockForReturn(evidenceId: number, cmd: LockCommand) { requireLocal(); return store.lockForReturn(evidenceId, cmd) },
    // POST /api/platform/payments/evidence/{evidenceId}/unlock-return
    async unlockReturn(evidenceId: number, cmd: UnlockCommand) { requireLocal(); return store.unlockReturn(evidenceId, cmd) },
    // POST /api/platform/payments/evidence/{evidenceId}/record-return
    async recordReturn(evidenceId: number, cmd: ReturnCommand) { requireLocal(); return store.recordReturn(evidenceId, cmd) },
    // GET /api/platform/plan-prices
    async listPriceVersions() { requireLocal(); return store.listPriceVersions() },
    // chưa có API (bản nháp bảng giá)
    async getPriceDraft() { requireLocal(); return store.getPriceDraft() },
    // chưa có API (bản nháp bảng giá)
    async savePriceDraft(draft: PriceDraft) { requireLocal(); return store.savePriceDraft(draft) },
    // POST /api/platform/plan-prices
    async publishPrice(cmd: PublishPriceCommand) { requireLocal(); return store.publishPrice(cmd) },
    // chưa có API (rút lại phiên bản đã lên lịch, UC-FE19-07 AF1)
    async withdrawPrice(version: number, reason: string) { requireLocal(); return store.withdrawPrice(version, reason) },
  }
}
export type PlatformServiceApi = ReturnType<typeof createPlatformServiceApi>
export const platformServiceApi = createPlatformServiceApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: platformServiceDemoStore })
