import {
  REQUEST_VALIDITY_MS, daysUntil, deriveServiceStatus, fmtDate, periodStatus, planPeriod, priceFor, renewalOpensAt, requestEligibility, toIso, toMs, versionLabel, vnDateKey,
} from '../domain/subscriptionRules'
import {
  SubscriptionError,
  type BankTransfer, type CreatePaymentCommand, type FarmRecord, type Payment, type PaymentFilters, type PriceDTO, type PriceQuote, type PurchasedPeriod,
  type RefreshDemo, type SubscriptionOverview, type SubscriptionSeed, type Term, type TransferResult,
} from '../types'
import { DEMO_START, SUBSCRIPTION_SEED } from './subscriptionMock'

const loadedAt = Date.now()
/** Đồng hồ demo: bắt đầu ở 18/10/2026 09:00:52 rồi chạy theo thời gian thực để bộ đếm ngược chạy thật. */
export const demoClock = () => DEMO_START + (Date.now() - loadedAt)

const NEXT_CODES = ['BCK4M7R2', 'BCH8T3W5', 'BCP2X9D5', 'BCN6V4J8']
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createSubscriptionDemoStore(seed: SubscriptionSeed = SUBSCRIPTION_SEED, clock: () => number = demoClock) {
  let farms = structuredClone(seed.farms)
  let prices = structuredClone(seed.prices)
  let pricesAvailable = true
  let nextCode = 0
  const evidence = new Map<string, TransferResult['status']>()

  const farmOf = (id: number): FarmRecord => {
    const f = farms.find((x) => x.id === id)
    if (!f) throw new SubscriptionError('NOT_FOUND', 'Không tìm thấy trang trại.')
    return f
  }
  // JOB-03: yêu cầu quá hạn chuyển sang EXPIRED
  const sweep = (f: FarmRecord) => {
    const now = clock()
    f.payments.forEach((p) => { if (p.state === 'PENDING' && toMs(p.expiresAt) <= now) p.state = 'EXPIRED' })
  }
  const effectivePrice = (): PriceDTO | null => {
    if (!pricesAvailable) return null
    const now = clock()
    return [...prices].filter((p) => toMs(p.effectiveAt) <= now).sort((a, b) => toMs(b.effectiveAt) - toMs(a.effectiveAt))[0] ?? null
  }
  const periodsOf = (f: FarmRecord): PurchasedPeriod[] => {
    const now = clock()
    return f.payments
      .filter((p) => p.state === 'PAID' && p.purchasedStart && p.purchasedEnd)
      .map((p) => ({ paymentCode: p.quoteRef, durationYears: p.durationYears, amountVnd: p.amountVnd, start: p.purchasedStart!, end: p.purchasedEnd!, status: periodStatus(p.purchasedStart!, p.purchasedEnd!, now) }))
      .sort((a, b) => toMs(a.start) - toMs(b.start))
  }
  const latestEndOf = (periods: PurchasedPeriod[]) => (periods.length ? toIso(Math.max(...periods.map((p) => toMs(p.end)))) : null)
  const quoteOf = (price: PriceDTO, term: Term): PriceQuote => ({ version: price.id, term, amountVnd: priceFor(price, term) })
  const newCode = () => {
    const used = new Set(farms.flatMap((f) => f.payments.map((p) => p.quoteRef)))
    for (;;) {
      const code = NEXT_CODES[nextCode++] ?? `BC${Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')}`
      if (!used.has(code)) return code
    }
  }

  function buildOverview(f: FarmRecord): SubscriptionOverview {
    sweep(f)
    const now = clock()
    const periods = periodsOf(f)
    const latestEnd = latestEndOf(periods)
    const current = periods.find((p) => p.status === 'CURRENT') ?? null
    const future = periods.filter((p) => p.status === 'FUTURE')
    const price = effectivePrice()
    return {
      farmId: f.id,
      farmName: f.name,
      serviceStatus: deriveServiceStatus({ suspended: f.suspended, hasPeriods: periods.length > 0, covered: !!current }),
      entitlementStatus: current ? 'CURRENT' : future.length ? 'FUTURE_ONLY' : 'NONE',
      suspended: f.suspended,
      suspendedSince: f.suspendedSince,
      latestEnd,
      renewalOpensAt: latestEnd ? toIso(renewalOpensAt(latestEnd)) : null,
      currentPeriod: current,
      daysRemaining: current ? daysUntil(current.end, now) : null,
      futurePeriods: future,
      periods,
      currentPrices: price,
      pendingPayment: f.payments.find((p) => p.state === 'PENDING') ?? null,
      eligibility: requestEligibility({ suspended: f.suspended, latestEnd, now, pricesAvailable: !!price }),
    }
  }

  const findPayment = (f: FarmRecord, code: string) => {
    sweep(f)
    const p = f.payments.find((x) => x.quoteRef === code)
    if (!p) throw new SubscriptionError('NOT_FOUND', 'Không tìm thấy yêu cầu thanh toán.')
    return p
  }

  /** Xác nhận chung cho webhook SePay và PM (GBR-72): chỉ PAID khi khớp mã, số tiền, tài khoản và cửa sổ thời gian. */
  function receiveBankTransfer(txn: BankTransfer): TransferResult {
    if (evidence.has(txn.transactionId)) return { status: 'DUPLICATE', payment: null }
    const content = txn.content.toUpperCase()
    const hit = farms.flatMap((f) => f.payments.map((p) => ({ f, p }))).find(({ p }) => content.includes(p.quoteRef))
    const paidAt = toMs(txn.paidAt)
    let status: TransferResult['status']
    if (txn.direction === 'OUT') status = 'OUTGOING'
    else if (!hit) status = 'CODE_NOT_MATCHED'
    else if ((txn.accountNumber ?? hit.p.accountNumber) !== hit.p.accountNumber) status = 'ACCOUNT_MISMATCH'
    else if (hit.p.state === 'PAID') status = 'ALREADY_ALLOCATED'
    else if (txn.amountVnd !== hit.p.amountVnd) status = 'AMOUNT_MISMATCH'
    else if (paidAt < toMs(hit.p.requestedAt) || paidAt >= toMs(hit.p.expiresAt)) status = 'WINDOW_MISSED'
    else status = 'CONFIRMED'
    evidence.set(txn.transactionId, status)
    if (status !== 'CONFIRMED' || !hit) return { status, payment: null }
    const confirmedAt = clock()
    const period = planPeriod(confirmedAt, latestEndOf(periodsOf(hit.f)), hit.p.durationYears)
    // Trại đang SUSPENDED vẫn nhận kỳ mua nhưng không được mở lại dịch vụ (GBR-15): suspended giữ nguyên.
    Object.assign(hit.p, {
      state: 'PAID', bankPaidAt: txn.paidAt, receivedAt: toIso(confirmedAt), confirmedAt: toIso(confirmedAt),
      purchasedStart: toIso(period.start), purchasedEnd: toIso(period.end), receiptCode: `BL-${hit.p.quoteRef}`,
    })
    return { status, payment: structuredClone(hit.p) }
  }

  return {
    now: () => clock(),
    async getOverview(farmId: number) { return structuredClone(buildOverview(farmOf(farmId))) },

    async listPayments(farmId: number, filters: PaymentFilters = {}) {
      const f = farmOf(farmId)
      sweep(f)
      const q = (filters.q ?? '').trim().toLowerCase()
      const key = filters.sort ?? 'requestedAt'
      const sign = filters.dir === 'asc' ? 1 : -1
      const rows = f.payments
        .filter((p) => !q || p.quoteRef.toLowerCase().includes(q))
        .filter((p) => !filters.state || p.state === filters.state)
        .filter((p) => !filters.from || vnDateKey(p.requestedAt) >= filters.from)
        .filter((p) => !filters.to || vnDateKey(p.requestedAt) <= filters.to)
        .sort((a, b) => sign * (toMs(a[key]) - toMs(b[key])))
      return structuredClone(rows)
    },

    async getPayment(farmId: number, code: string) { return structuredClone(findPayment(farmOf(farmId), code)) },

    async createPayment(farmId: number, command: CreatePaymentCommand) {
      if (![1, 2, 3].includes(command.durationYears)) throw new SubscriptionError('INVALID_TERM', 'Vui lòng chọn thời hạn 1, 2 hoặc 3 năm.')
      const f = farmOf(farmId)
      sweep(f)
      const overview = buildOverview(f)
      const price = overview.currentPrices
      if (f.suspended) throw new SubscriptionError('SUSPENDED', `${f.name} đang tạm ngưng dịch vụ nên chưa thể tạo yêu cầu thanh toán.`, { farmName: f.name, paidUntil: overview.latestEnd })
      if (!price) throw new SubscriptionError('PRICE_UNAVAILABLE', 'Chưa lấy được bảng giá gói.')
      if (!overview.eligibility.ok && overview.eligibility.reason === 'OUTSIDE_WINDOW') {
        const { opensAt } = overview.eligibility
        throw new SubscriptionError('OUTSIDE_WINDOW', `Gia hạn mở từ ${fmtDate(opensAt)}.`, { confirmedEnd: overview.latestEnd ?? '', opensAt })
      }
      if (overview.pendingPayment) throw new SubscriptionError('PENDING_EXISTS', `Bạn đã có yêu cầu thanh toán ${overview.pendingPayment.quoteRef} còn hiệu lực.`, { payment: structuredClone(overview.pendingPayment) })
      const expected = command.expectedPriceVersionId
      if (expected !== undefined && expected !== price.id) {
        const seen = prices.find((p) => p.id === expected)
        throw new SubscriptionError('PRICE_CHANGED', `Bảng giá đã đổi sang ${versionLabel(price.id)}. Vui lòng xem lại giá mới.`, {
          seen: seen ? quoteOf(seen, command.durationYears) : { version: expected, term: command.durationYears, amountVnd: 0 },
          current: quoteOf(price, command.durationYears),
        })
      }
      const now = clock()
      const payment: Payment = {
        id: Math.max(0, ...farms.flatMap((x) => x.payments.map((p) => p.id))) + 1,
        quoteRef: newCode(), durationYears: command.durationYears, amountVnd: priceFor(price, command.durationYears), state: 'PENDING',
        requestedAt: toIso(now), expiresAt: toIso(now + REQUEST_VALIDITY_MS), priceVersionId: price.id,
        bankCode: 'MB', accountNumber: '0386671863000', accountName: 'CONG TY TNHH BEEFCARE', qrImageUrl: null,
        purchasedStart: null, purchasedEnd: null, receiptCode: null, bankPaidAt: null, receivedAt: null, confirmedAt: null,
      }
      f.payments.push(payment)
      return structuredClone(payment)
    },

    /** Làm mới trạng thái. `demo` chỉ có ở mock: mô phỏng giao dịch về hoặc lỗi tra cứu. */
    async refreshPayment(farmId: number, code: string, demo?: RefreshDemo) {
      const f = farmOf(farmId)
      let p = findPayment(f, code)
      if (demo === 'result-unavailable') {
        throw new SubscriptionError('RESULT_UNAVAILABLE', 'Chưa lấy được kết quả thanh toán.', { payment: structuredClone(p), checkedAt: toIso(clock()) })
      }
      if (demo === 'bank-paid' && p.state !== 'PAID') {
        receiveBankTransfer({ transactionId: `DEMO-${p.quoteRef}`, direction: 'IN', amountVnd: p.amountVnd, content: p.quoteRef, paidAt: toIso(clock()) })
        p = findPayment(f, code)
      }
      return structuredClone(p)
    },

    // Hỗ trợ test và mô phỏng phía PM/SePay, không thuộc API Owner
    receiveBankTransfer: async (txn: BankTransfer) => receiveBankTransfer(txn),
    async publishPriceVersion(price: PriceDTO) { prices = [...prices, structuredClone(price)] },
    async setPricesAvailable(available: boolean) { pricesAvailable = available },
    async reset() {
      farms = structuredClone(seed.farms)
      prices = structuredClone(seed.prices)
      pricesAvailable = true
      nextCode = 0
      evidence.clear()
    },
  }
}
export type SubscriptionDemoStore = ReturnType<typeof createSubscriptionDemoStore>
export const subscriptionDemoStore = createSubscriptionDemoStore()
