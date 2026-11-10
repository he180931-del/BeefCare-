import { asRecord, backendFarmId, backendMode, backendTransport, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'
import { subscriptionDemoStore, type SubscriptionDemoStore } from '../data/subscriptionDemoStore'
import type { CreatePaymentCommand, Payment, PaymentFilters, PaymentPage, RefreshDemo, SubscriptionOverview } from '../types'
import { SubscriptionError, type PriceQuote } from '../types'

/** A missing overview contract is an API error; it must never be filled with demo fields. */
function readOverview(value: unknown, farmId: number): SubscriptionOverview {
  const row = asRecord(value)
  if (row.farmId !== farmId || typeof row.farmName !== 'string'
    || !['PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(String(row.serviceStatus))
    || !['CURRENT', 'FUTURE_ONLY', 'NONE'].includes(String(row.entitlementStatus))
    || typeof row.suspended !== 'boolean' || !Array.isArray(row.periods) || !Array.isArray(row.futurePeriods)
    || typeof asRecord(row.eligibility).ok !== 'boolean'
    || ['currentPrices', 'pendingPayment', 'renewalOpensAt', 'latestEnd', 'suspendedSince', 'currentPeriod', 'daysRemaining'].some((key) => !(key in row))) {
    throw new Error('Dữ liệu gói dịch vụ từ máy chủ không đầy đủ hoặc không thuộc trại đang xem.')
  }
  return {
    farmId, farmName: row.farmName, serviceStatus: row.serviceStatus as SubscriptionOverview['serviceStatus'],
    latestEnd: row.latestEnd as string | null, entitlementStatus: row.entitlementStatus as SubscriptionOverview['entitlementStatus'],
    currentPrices: row.currentPrices as SubscriptionOverview['currentPrices'], pendingPayment: row.pendingPayment === null ? null : readPayment(row.pendingPayment),
    renewalOpensAt: row.renewalOpensAt as string | null, suspended: row.suspended, suspendedSince: row.suspendedSince as string | null,
    currentPeriod: row.currentPeriod as SubscriptionOverview['currentPeriod'], daysRemaining: row.daysRemaining as number | null,
    futurePeriods: row.futurePeriods as SubscriptionOverview['futurePeriods'], periods: row.periods as SubscriptionOverview['periods'],
    eligibility: row.eligibility as SubscriptionOverview['eligibility'],
  }
}

function readPayment(value: unknown): Payment {
  const row = asRecord(value)
  if (typeof row.id !== 'number' || typeof row.quoteRef !== 'string' || ![1, 2, 3].includes(Number(row.durationYears))
    || typeof row.amountVnd !== 'number' || !['PENDING', 'PAID', 'EXPIRED'].includes(String(row.state))
    || typeof row.requestedAt !== 'string' || typeof row.expiresAt !== 'string' || typeof row.priceVersionId !== 'number') {
    throw new Error('Dữ liệu yêu cầu thanh toán từ máy chủ không đầy đủ.')
  }
  // Old requests may lack a bank snapshot; display that absence, never substitute a receiving account.
  return {
    id: row.id, quoteRef: row.quoteRef, durationYears: row.durationYears as Payment['durationYears'], amountVnd: row.amountVnd,
    state: row.state as Payment['state'], requestedAt: row.requestedAt, expiresAt: row.expiresAt, priceVersionId: row.priceVersionId,
    purchasedStart: row.purchasedStart as string | null | undefined, purchasedEnd: row.purchasedEnd as string | null | undefined,
    receiptCode: row.receiptCode as string | null | undefined, qrImageUrl: row.qrImageUrl as string | null | undefined,
    bankCode: textValue(row.bankCode), accountNumber: textValue(row.accountNumber), accountName: textValue(row.accountName),
    reopened: row.reopened as boolean | undefined,
    bankPaidAt: row.bankPaidAt as string | null | undefined, receivedAt: row.receivedAt as string | null | undefined,
    confirmedAt: row.confirmedAt as string | null | undefined, confirmationSource: row.confirmationSource as Payment['confirmationSource'],
  }
}

export function createSubscriptionApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: SubscriptionDemoStore }) {
  void farmId
  const getPayment = async (farm: number, id: string): Promise<Payment> => {
    if (mode !== 'backend') return store.getPayment(farm, id)
    if (!/^\d+$/.test(id) || Number(id) <= 0) throw new Error('Mã yêu cầu thanh toán không hợp lệ.')
    return readPayment(await transport.get(transport.farmPath(farm, `/subscription/payments/${id}`)))
  }
  return {
    // chưa có API: đồng hồ phía client (backend dùng giờ hệ thống)
    now(): number { return mode === 'backend' ? Date.now() : store.now() },
    // GET /api/farms/{farmId}/subscription
    async getOverview(farm: number) {
      return mode === 'backend' ? readOverview(await transport.get(transport.farmPath(farm, '/subscription')), farm) : store.getOverview(farm)
    },
    // SCR-60 / D16: filter and count before paging, with no backend-to-demo fallback.
    async listPayments(farm: number, filters: PaymentFilters = {}): Promise<PaymentPage> {
      if (filters.from && filters.to && filters.from > filters.to) throw new Error('Ngày bắt đầu không được sau ngày kết thúc.')
      const page = filters.page ?? 0
      if (mode !== 'backend') {
        const rows = await store.listPayments(farm, filters)
        return { content: rows.slice(page * 20, (page + 1) * 20), number: page, size: 20, totalElements: rows.length, totalPages: Math.ceil(rows.length / 20) }
      }
      const query = new URLSearchParams()
      if (filters.q?.trim()) query.set('q', filters.q.trim())
      if (filters.state) query.set('status', filters.state)
      if (filters.from) query.set('from', filters.from)
      if (filters.to) query.set('to', filters.to)
      query.set('sort', filters.sort ?? 'requestedAt')
      query.set('dir', filters.dir ?? 'desc')
      query.set('page', String(page))
      const row = asRecord(await transport.get(transport.farmPath(farm, `/subscription/payments?${query}`)))
      if (!Array.isArray(row.content) || !Number.isInteger(row.number) || row.number !== page || row.size !== 20
        || !Number.isInteger(row.totalElements) || Number(row.totalElements) < 0
        || !Number.isInteger(row.totalPages) || Number(row.totalPages) < 0 || row.content.length > 20) {
        throw new Error('Dữ liệu lịch sử thanh toán từ máy chủ không đầy đủ hoặc không hợp lệ.')
      }
      return { content: row.content.map(readPayment), number: row.number as number, size: 20,
        totalElements: row.totalElements as number, totalPages: row.totalPages as number }
    },
    // GET /api/farms/{farmId}/subscription/payments/{paymentId} (mock tra theo mã quoteRef)
    getPayment,
    // POST /api/farms/{farmId}/subscription/payments
    async createPayment(farm: number, command: CreatePaymentCommand): Promise<Payment> {
      if (mode !== 'backend') return store.createPayment(farm, command)
      if (![1, 2, 3].includes(command.durationYears)) throw new SubscriptionError('INVALID_TERM', 'Vui lòng chọn kỳ hạn.')
      if (!command.expectedPriceVersionId) throw new SubscriptionError('PRICE_UNAVAILABLE', 'Vui lòng xem lại bảng giá.')
      try {
        return readPayment(await transport.command(transport.farmPath(farm, '/subscription/payments'), {
          durationYears: command.durationYears, reviewedPriceVersion: command.expectedPriceVersionId,
        }, { key: command.idempotencyKey }))
      } catch (error) {
        if (!(error instanceof BackendError)) throw error
        const p = error.params
        if (error.code === 'MSG-FE19-02') throw new SubscriptionError('PRICE_CHANGED', error.message,
          { seen: p.seen as PriceQuote, current: p.current as PriceQuote })
        if (error.code === 'MSG-FE19-03') throw new SubscriptionError('OUTSIDE_WINDOW', error.message,
          { confirmedEnd: p.confirmedEnd as string, opensAt: p.opensAt as string })
        if (error.code === 'MSG-FE19-09') throw new SubscriptionError('SUSPENDED', error.message,
          { farmName: p.farmName as string, paidUntil: p.paidUntil as string | null })
        if (error.code === 'MSG-FE19-04') throw new SubscriptionError('PRICE_UNAVAILABLE', error.message)
        throw error
      }
    },
    // GET /api/farms/{farmId}/subscription/payments/{paymentId} (Kiểm tra lại)
    async refreshPayment(farm: number, code: string, demo?: RefreshDemo) { return mode === 'backend' ? getPayment(farm, code) : store.refreshPayment(farm, code, demo) },
  }
}
export type SubscriptionApi = ReturnType<typeof createSubscriptionApi>
export const subscriptionApi = createSubscriptionApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: subscriptionDemoStore })
