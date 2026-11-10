import { asRecord, asRows, backendFarmId, backendMode, backendTransport, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { platformServiceDemoStore, type PlatformServiceDemoStore } from '../data/platformServiceDemoStore'
import { lastVnDay, vnDateOf } from '../domain/dates'
import type {
  ChangeFarmCommand, ChangeOptions, EvidenceFilters, FarmFilters, FarmListResult, FarmOverview, FarmServicePreview, LockCommand, PaymentFilters, PriceDraft,
  PublishPriceCommand, ReturnCommand, ReviewCommand, ServiceStatus, SourcePayment, SubscriptionDetail, SubscriptionFilters, SubscriptionPage, SubscriptionRow, PeriodState, PeriodView, TermYears, UnlockCommand,
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

const invalidSubscription = () => new Error('Dữ liệu gói từ máy chủ không đầy đủ hoặc không hợp lệ.')
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const nullableString = (value: unknown): value is string | null => value === null || typeof value === 'string'
const isInstant = (value: unknown): value is string => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const nullableInstant = (value: unknown) => value === null || isInstant(value)

function subscriptionRow(value: unknown): SubscriptionRow {
  const row = asRecord(value)
  if (!isId(row.farmId) || typeof row.farmName !== 'string' || !nullableString(row.ownerName) || !nullableString(row.ownerEmail)
    || !nullableInstant(row.currentStart) || !nullableInstant(row.currentEnd) || !nullableInstant(row.confirmedUntil)
    || !Array.isArray(row.paymentCodes) || row.paymentCodes.some((code) => typeof code !== 'string')) throw invalidSubscription()
  return { farmId: row.farmId, farmName: row.farmName, ownerName: row.ownerName, ownerEmail: row.ownerEmail,
    serviceStatus: status(row.serviceStatus), subscriptionCode: null, currentStart: row.currentStart as string | null,
    currentEnd: row.currentEnd as string | null, confirmedUntil: row.confirmedUntil as string | null, paymentCodes: row.paymentCodes as string[] }
}

const PERIOD_STATUSES: readonly PeriodState[] = ['CURRENT', 'FUTURE', 'PAST']
/** The period status comes from the server read clock, the same one as the summary (D17); the browser clock is never used. */
function subscriptionPeriod(value: unknown): PeriodView {
  const p = asRecord(value)
  if (!isId(p.paymentId) || typeof p.paymentCode !== 'string' || !nullableString(p.receiptCode)
    || ![1, 2, 3].includes(p.termYears as number) || !isInstant(p.start) || !isInstant(p.end) || !nullableInstant(p.confirmedAt)
    || !PERIOD_STATUSES.includes(p.status as PeriodState)) throw invalidSubscription()
  return { paymentId: p.paymentId, paymentCode: p.paymentCode, receiptCode: p.receiptCode, termYears: p.termYears as TermYears,
    start: p.start, end: p.end, confirmedAt: p.confirmedAt as string | null, state: p.status as PeriodState }
}

function subscriptionDetail(value: unknown): SubscriptionDetail {
  const body = asRecord(value)
  if (!(body.subscriptionId === null || isId(body.subscriptionId)) || typeof body.suspended !== 'boolean'
    || !nullableInstant(body.suspendedSince) || !nullableInstant(body.renewalOpens) || !Array.isArray(body.periods)
    || !nullableString(body.emptyMessage) || !('latestPurchase' in body)) throw invalidSubscription()
  const periods = body.periods.map(subscriptionPeriod)
  return { summary: subscriptionRow(body.summary), subscriptionId: body.subscriptionId, suspended: body.suspended,
    suspendedSince: body.suspendedSince as string | null, renewalOpens: body.renewalOpens as string | null, periods,
    latestPurchase: body.latestPurchase === null ? null : subscriptionPeriod(body.latestPurchase),
    emptyMessage: periods.length ? null : body.subscriptionId === null ? 'Chưa có gói: không có kỳ hay ngày kết thúc.' : 'Đã có đăng ký, chưa có kỳ đã mua.' }
}

function subscriptionPage(value: unknown): SubscriptionPage {
  const body = asRecord(value)
  if (!Array.isArray(body.items) || !Number.isSafeInteger(body.total) || (body.total as number) < 0
    || !Number.isInteger(body.page) || (body.page as number) < 0 || body.size !== 20) throw invalidSubscription()
  return { items: body.items.map(subscriptionRow), total: body.total as number, page: body.page as number, size: 20 }
}

function sourcePayment(value: unknown): SourcePayment {
  const p = asRecord(value)
  if (!isId(p.id) || !isId(p.farmId) || typeof p.farmName !== 'string' || typeof p.quoteRef !== 'string'
    || ![1, 2, 3].includes(p.termYears as number) || typeof p.amount !== 'number' || !Number.isSafeInteger(p.amount) || p.amount <= 0
    || !['PENDING', 'PAID', 'EXPIRED'].includes(p.state as string) || !isInstant(p.requestedAt) || !isInstant(p.expiresAt)
    || !nullableInstant(p.purchasedStart) || !nullableInstant(p.purchasedEnd) || !nullableString(p.receiptCode)
    || !nullableString(p.requestedByEmail) || !isId(p.priceVersionId)) throw invalidSubscription()
  return {
    id: p.id, farmId: p.farmId, farmName: p.farmName, quoteRef: p.quoteRef,
    termYears: p.termYears as TermYears, amount: p.amount, state: p.state as SourcePayment['state'],
    requestedAt: p.requestedAt, expiresAt: p.expiresAt, purchasedStart: p.purchasedStart as string | null,
    purchasedEnd: p.purchasedEnd as string | null, receiptCode: p.receiptCode as string | null,
    requestedByEmail: p.requestedByEmail as string | null, priceVersionId: p.priceVersionId,
  }
}

export function createPlatformServiceApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: PlatformServiceDemoStore }) {
  void farmId
  // UC4 has a backend adapter; reconciliation commands and prices remain separate scopes.
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
    async listSubscriptions(filters: SubscriptionFilters = {}): Promise<SubscriptionPage> {
      if (filters.endFrom && filters.endTo && filters.endFrom > filters.endTo) throw new Error('Ngày bắt đầu không được sau ngày kết thúc.')
      if (mode !== 'backend') {
        const rows = (await store.listSubscriptions(filters)).sort((a, b) => a.confirmedUntil === null ? b.confirmedUntil === null ? a.farmId - b.farmId : 1 : b.confirmedUntil === null ? -1
          : (filters.dir === 'asc' ? 1 : -1) * a.confirmedUntil.localeCompare(b.confirmedUntil) || a.farmId - b.farmId)
        const page = filters.page ?? 0
        return { items: rows.slice(page * 20, page * 20 + 20), total: rows.length, page, size: 20 }
      }
      const query = new URLSearchParams()
      if (filters.q?.trim()) query.set('q', filters.q.trim())
      query.set('coverage', filters.coverage ?? 'ALL')
      if (filters.status) query.set('serviceStatus', filters.status)
      if (filters.endFrom) query.set('endFrom', filters.endFrom)
      if (filters.endTo) query.set('endTo', filters.endTo)
      query.set('sort', 'confirmedUntil'); query.set('dir', filters.dir ?? 'desc'); query.set('page', String(filters.page ?? 0)); query.set('size', '20')
      return subscriptionPage(await transport.get(`/api/platform/subscriptions?${query}`))
    },
    // GET /api/platform/subscriptions/{farmId}
    async getSubscription(id: number): Promise<SubscriptionDetail> {
      if (mode === 'backend') {
        const detail = subscriptionDetail(await transport.get(`/api/platform/subscriptions/${id}`))
        if (detail.summary.farmId !== id) throw invalidSubscription()
        return detail
      }
      const detail = await store.getSubscription(id)
      const payments = await store.listPayments()
      return { ...detail, periods: detail.periods.map((p) => ({ ...p, paymentId: payments.find((payment) => payment.code === p.paymentCode)?.id })) }
    },
    async getPayment(id: number): Promise<SourcePayment> {
      if (mode === 'backend') {
        const payment = sourcePayment(await transport.get(`/api/platform/payments/${id}`))
        if (payment.id !== id) throw invalidSubscription()
        return payment
      }
      const payment = (await store.listPayments()).find((p) => p.id === id)
      if (!payment) throw new Error('Không tìm thấy thanh toán.')
      const period = (await store.getSubscription(payment.farmId)).periods.find((p) => p.paymentCode === payment.code)
      return { id: payment.id, farmId: payment.farmId, farmName: payment.farmName, quoteRef: payment.code, termYears: payment.termYears,
        amount: payment.amount, state: payment.state, requestedAt: payment.createdAt, expiresAt: payment.expiresAt,
        purchasedStart: period?.start ?? null, purchasedEnd: period?.end ?? null, receiptCode: period?.receiptCode ?? null,
        requestedByEmail: null, priceVersionId: payment.priceVersion }
    },
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
