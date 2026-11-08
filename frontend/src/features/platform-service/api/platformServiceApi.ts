import { asRecord, asRows, backendFarmId, backendMode, backendTransport, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { platformServiceDemoStore, type PlatformServiceDemoStore } from '../data/platformServiceDemoStore'
import { lastVnDay, vnDateOf } from '../domain/dates'
import type {
  ChangeFarmCommand, ChangeOptions, EvidenceFilters, FarmFilters, FarmListResult, FarmOverview, FarmServicePreview, LockCommand, PaymentFilters, PriceDraft,
  PublishPriceCommand, ReturnCommand, ReviewCommand, ServiceStatus, SubscriptionFilters, UnlockCommand,
} from '../types'

const STATUSES: readonly ServiceStatus[] = ['ACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'SUSPENDED']
const status = (value: unknown): ServiceStatus => {
  if (typeof value === 'string' && (STATUSES as readonly string[]).includes(value)) return value as ServiceStatus
  throw new Error('Dữ liệu máy chủ không có trạng thái dịch vụ hợp lệ.')
}
const instant = (value: unknown) => typeof value === 'string' && value ? value : null
// The backend sends instants; the screens work with Viet Nam dates, and a period end is shown as its last covered day.
const day = (value: unknown) => { const at = instant(value); return at ? vnDateOf(at) : null }
const lastDay = (value: unknown) => { const at = instant(value); return at ? lastVnDay(at) : null }

/** `GET /api/platform/farms` row (UC-FE02-04). The popup fields come from the preview, not from the list. */
function farmOverview(value: unknown): FarmOverview {
  const row = asRecord(value)
  return {
    farmId: numberValue(row.farmId), farmName: textValue(row.farmName), ownerName: textValue(row.ownerName), ownerEmail: textValue(row.ownerEmail),
    serviceStatus: status(row.serviceStatus), coverageEnd: lastDay(row.coverageEnd), suspended: row.suspended === true,
    suspendedSince: day(row.suspendedAt), suspendedBy: null, suspendReason: null, herdSize: numberValue(row.activeCattle),
    periodStart: null, periodEnd: null, version: numberValue(row.version),
  }
}

/** `GET /api/platform/farms/{farmId}` (popup of UC-FE02-05). */
function farmServicePreview(value: unknown): FarmServicePreview {
  const row = asRecord(value)
  return {
    farmId: numberValue(row.farmId), farmName: textValue(row.farmName), ownerName: textValue(row.ownerName), ownerEmail: textValue(row.ownerEmail),
    herdSize: numberValue(row.activeCattle), serviceStatus: status(row.serviceStatus), suspendedSince: day(row.suspendedAt),
    suspendedBy: typeof row.suspendedBy === 'string' ? row.suspendedBy : null, suspendReason: typeof row.previousReason === 'string' ? row.previousReason : null,
    periodStart: day(row.periodStart), periodEnd: lastDay(row.periodEnd), coverageEnd: lastDay(row.coverageEnd),
    statusAfterRestore: status(row.statusAfterRestore), version: numberValue(row.version),
  }
}

function farmList(value: unknown): FarmListResult {
  const body = asRecord(value)
  const tiles = asRecord(body.tiles)
  return {
    items: asRows(body.items).map(farmOverview), total: numberValue(body.total),
    tiles: {
      total: numberValue(tiles.total), active: numberValue(tiles.active), activePercent: numberValue(tiles.activePercent),
      pending: numberValue(tiles.pendingPayment), expired: numberValue(tiles.expired), suspended: numberValue(tiles.suspended),
    },
  }
}

export function createPlatformServiceApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: PlatformServiceDemoStore }) {
  void farmId
  // FE-19 platform screens (subscriptions, reconciliation, prices) are not wired yet; backend mode never reads the mock.
  const requireLocal = () => { if (mode === 'backend') throw backendPending('dịch vụ trang trại và thanh toán') }
  const change = async (id: number, action: 'suspend' | 'restore', cmd: ChangeFarmCommand, options?: ChangeOptions) => {
    const key = options?.idempotencyKey
    return farmOverview(await transport.command(`/api/platform/farms/${id}/${action}`, cmd, key ? { method: 'POST', key } : { method: 'POST' }))
  }
  return {
    // GET /api/platform/farms (UC-FE02-04); at most 100 rows, the screen has no paging.
    async listFarms(filters: FarmFilters = {}): Promise<FarmListResult> {
      if (mode !== 'backend') return store.listFarms(filters)
      const query = new URLSearchParams()
      if (filters.q?.trim()) query.set('q', filters.q.trim())
      if (filters.status) query.set('status', filters.status)
      if (filters.sort) query.set('sort', filters.sort)
      query.set('size', '100')
      return farmList(await transport.get(`/api/platform/farms?${query}`))
    },
    // GET /api/platform/farms/{farmId} (popup of UC-FE02-05)
    async getFarmService(id: number): Promise<FarmServicePreview> {
      return mode === 'backend' ? farmServicePreview(await transport.get(`/api/platform/farms/${id}`)) : store.getFarmService(id)
    },
    // POST /api/platform/farms/{farmId}/suspend
    async suspendFarm(id: number, cmd: ChangeFarmCommand, options?: ChangeOptions) {
      return mode === 'backend' ? change(id, 'suspend', cmd, options) : store.suspendFarm(id, cmd, options)
    },
    // POST /api/platform/farms/{farmId}/restore
    async restoreFarm(id: number, cmd: ChangeFarmCommand, options?: ChangeOptions) {
      return mode === 'backend' ? change(id, 'restore', cmd, options) : store.restoreFarm(id, cmd, options)
    },
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
