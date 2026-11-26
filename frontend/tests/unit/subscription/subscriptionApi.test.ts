import { describe, expect, it, vi } from 'vitest'
import { createSubscriptionApi } from '../../../src/features/subscription/api/subscriptionApi'
import { createSubscriptionDemoStore } from '../../../src/features/subscription/data/subscriptionDemoStore'
import { DEMO_START, SUBSCRIPTION_SEED } from '../../../src/features/subscription/data/subscriptionMock'
import { addYears, daysUntil, fmtClock, fmtPeriod, fmtVnd, periodStatus, planPeriod, renewalOpensAt, requestEligibility, toIso, vnTime } from '../../../src/features/subscription/domain/subscriptionRules'
import { SubscriptionError } from '../../../src/features/subscription/types'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })

function setup(seed = SUBSCRIPTION_SEED) {
  let now = DEMO_START
  const store = createSubscriptionDemoStore(seed, () => now)
  const api = createSubscriptionApi({ mode: 'local', farmId: 1, transport: transport(), store })
  return { store, api, advance: (ms: number) => { now += ms } }
}
const rejects = async (p: Promise<unknown>) => { try { await p } catch (e) { return e as SubscriptionError }; throw new Error('expected rejection') }

describe('quy tắc kỳ dịch vụ (GBR-71, GBR-73)', () => {
  it('ngày mở gia hạn là 90 ngày trước ngày cuối đã xác nhận', () => {
    expect(toIso(renewalOpensAt(vnTime(2026, 11, 15)))).toBe(toIso(vnTime(2026, 8, 16)))
  })
  it('kỳ mới bắt đầu ở max(xác nhận, hết kỳ cũ) và giữ ngày kỷ niệm', () => {
    const early = planPeriod(vnTime(2026, 10, 18, 9), vnTime(2026, 11, 15), 1)
    expect(fmtPeriod(early.start, early.end)).toBe('15/11/2026 → 14/11/2027')
    const gap = planPeriod(vnTime(2027, 1, 10, 9), vnTime(2026, 11, 15), 2)
    expect(fmtPeriod(gap.start, gap.end)).toBe('10/01/2027 → 10/01/2029')
  })
  it('29/02 về 28/02 ở năm không nhuận', () => {
    expect(toIso(addYears(vnTime(2028, 2, 29), 1))).toBe(toIso(vnTime(2029, 2, 28)))
  })

  it('TC-19-05/37: opens renewal exactly 90 days before confirmed expiry and blocks only before that boundary', () => {
    // The confirmed period boundary is exclusive, so a displayed 31/12 end is stored as 01/01.
    const latestEnd = vnTime(2027, 1, 1)
    const opensAt = vnTime(2026, 10, 2)
    expect(toIso(renewalOpensAt(latestEnd))).toBe(toIso(opensAt))
    expect(requestEligibility({ suspended: false, latestEnd: toIso(latestEnd), now: opensAt - 1, pricesAvailable: true }))
      .toMatchObject({ ok: false, reason: 'OUTSIDE_WINDOW', opensAt: toIso(opensAt) })
    expect(requestEligibility({ suspended: false, latestEnd: toIso(latestEnd), now: opensAt, pricesAvailable: true })).toEqual({ ok: true })
    expect(requestEligibility({ suspended: false, latestEnd: toIso(latestEnd), now: opensAt + 1, pricesAvailable: true })).toEqual({ ok: true })
    expect(requestEligibility({ suspended: true, latestEnd: toIso(latestEnd), now: opensAt, pricesAvailable: true })).toEqual({ ok: false, reason: 'SUSPENDED' })
  })

  it('TC-19-14/16: starts the next subscription period at the later of confirmation and prior expiry', () => {
    const continuous = planPeriod(vnTime(2027, 2, 1), vnTime(2027, 3, 15), 1)
    expect(toIso(continuous.start)).toBe(toIso(vnTime(2027, 3, 15)))
    expect(toIso(continuous.end)).toBe(toIso(vnTime(2028, 3, 15)))
    const afterExpiry = planPeriod(vnTime(2027, 2, 10), vnTime(2027, 1, 1), 1)
    expect(toIso(afterExpiry.start)).toBe(toIso(vnTime(2027, 2, 10)))
  })

  it('TC-19-36: counts 24 hours as one day, 23 hours as zero, and marks the exact end past', () => {
    const end = toIso(vnTime(2026, 11, 30, 12))
    expect(daysUntil(end, vnTime(2026, 11, 29, 12))).toBe(1)
    expect(daysUntil(end, vnTime(2026, 11, 29, 13))).toBe(0)
    expect(periodStatus('2026-11-01T00:00:00+07:00', end, vnTime(2026, 11, 30, 11, 59))).toBe('CURRENT')
    expect(periodStatus('2026-11-01T00:00:00+07:00', end, vnTime(2026, 11, 30, 12))).toBe('PAST')
  })
  it('định dạng tiền và bộ đếm', () => {
    expect(fmtVnd(1_200_000)).toBe('1.200.000 đ')
    expect(fmtClock(23 * 3_600_000 + 41 * 60_000 + 8000)).toBe('23:41:08')
  })
})

describe('subscriptionApi (store demo)', () => {
  it('tổng quan trại Yên Bài khớp frame: còn 27 ngày, mở gia hạn 16/08/2026, có yêu cầu đang chờ', async () => {
    const { api } = setup()
    const o = await api.getOverview(1)
    expect(o.serviceStatus).toBe('ACTIVE')
    expect(o.daysRemaining).toBe(27)
    expect(o.renewalOpensAt).toBe(toIso(vnTime(2026, 8, 16)))
    expect(o.pendingPayment?.quoteRef).toBe('BCF7K2Q9')
    expect(o.periods.map((p) => p.status)).toEqual(['PAST', 'CURRENT'])
    expect(o.eligibility).toEqual({ ok: true })
  })

  it('đã có yêu cầu còn hiệu lực thì không tạo thêm (GBR-70)', async () => {
    const { api } = setup()
    const e = await rejects(api.createPayment(1, { durationYears: 1 }))
    expect(e.code).toBe('PENDING_EXISTS')
    expect(e.detail.payment?.quoteRef).toBe('BCF7K2Q9')
  })

  it('yêu cầu quá 24 giờ chuyển EXPIRED, sau đó tạo yêu cầu mới với hạn 24 giờ', async () => {
    const { api, advance } = setup()
    advance(25 * 3_600_000)
    const p = await api.createPayment(1, { durationYears: 2 })
    expect(p).toMatchObject({ state: 'PENDING', durationYears: 2, amountVnd: 2_160_000, priceVersionId: 3, bankCode: 'MB' })
    expect(Date.parse(p.expiresAt) - Date.parse(p.requestedAt)).toBe(24 * 3_600_000)
    const list = await api.listPayments(1)
    expect(list.content.find((x) => x.quoteRef === 'BCF7K2Q9')?.state).toBe('EXPIRED')
  })

  it('giá đổi giữa lúc xem và lúc tạo thì báo giá cũ và giá mới, chưa tạo yêu cầu (AF2)', async () => {
    const { api, store } = setup()
    await store.publishPriceVersion({ id: 4, price1y: 1_320_000, price2y: 2_376_000, price3y: 3_366_000, effectiveAt: toIso(DEMO_START - 1000) })
    const e = await rejects(api.createPayment(2, { durationYears: 1, expectedPriceVersionId: 3 }))
    expect(e.code).toBe('PRICE_CHANGED')
    expect(e.detail.seen).toMatchObject({ version: 3, amountVnd: 1_200_000 })
    expect(e.detail.current).toMatchObject({ version: 4, amountVnd: 1_320_000 })
    expect((await api.listPayments(2)).content).toHaveLength(0)
    const ok = await api.createPayment(2, { durationYears: 1, expectedPriceVersionId: 4 })
    expect(ok.amountVnd).toBe(1_320_000)
    expect(ok.quoteRef).toBe('BCK4M7R2')
  })

  it('trại SUSPENDED không tạo được yêu cầu (GBR-71, D08)', async () => {
    const { api } = setup()
    const e = await rejects(api.createPayment(3, { durationYears: 1 }))
    expect(e.code).toBe('SUSPENDED')
    expect((await api.getOverview(3)).serviceStatus).toBe('SUSPENDED')
  })

  it('chưa thuận lợi: không có bảng giá thì không tạo được yêu cầu (MSG-FE19-04)', async () => {
    const { api, store } = setup()
    await store.setPricesAvailable(false)
    expect((await api.createPayment(2, { durationYears: 1 }).catch((e: SubscriptionError) => e.code))).toBe('PRICE_UNAVAILABLE')
  })

  it('giao dịch đúng mã, số tiền, trong hạn thì cấp kỳ mới rồi đóng cửa sổ gia hạn', async () => {
    const { api, store } = setup()
    const r = await store.receiveBankTransfer({ transactionId: 'T1', direction: 'IN', amountVnd: 1_200_000, content: 'BCF7K2Q9', paidAt: toIso(DEMO_START) })
    expect(r.status).toBe('CONFIRMED')
    const o = await api.getOverview(1)
    expect(o.latestEnd).toBe(toIso(vnTime(2027, 11, 15)))
    expect(o.futurePeriods).toHaveLength(1)
    expect(o.pendingPayment).toBeNull()
    const e = await rejects(api.createPayment(1, { durationYears: 1 }))
    expect(e.code).toBe('OUTSIDE_WINDOW')
    expect(e.detail.opensAt).toBe(toIso(vnTime(2027, 8, 16)))
    expect(await store.receiveBankTransfer({ transactionId: 'T1', direction: 'IN', amountVnd: 1_200_000, content: 'BCF7K2Q9', paidAt: toIso(DEMO_START) })).toMatchObject({ status: 'DUPLICATE' })
  })

  it('giao dịch sai số tiền hoặc ngoài cửa sổ không cấp kỳ (GBR-72)', async () => {
    const { api, store } = setup()
    expect((await store.receiveBankTransfer({ transactionId: 'T2', direction: 'IN', amountVnd: 1_000_000, content: 'BCF7K2Q9', paidAt: toIso(DEMO_START) })).status).toBe('AMOUNT_MISMATCH')
    expect((await store.receiveBankTransfer({ transactionId: 'T3', direction: 'IN', amountVnd: 1_200_000, content: 'BCF7K2Q9', paidAt: toIso(DEMO_START + 30 * 3_600_000) })).status).toBe('WINDOW_MISSED')
    expect((await store.receiveBankTransfer({ transactionId: 'T4', direction: 'IN', amountVnd: 1_200_000, content: 'khong co ma', paidAt: toIso(DEMO_START) })).status).toBe('CODE_NOT_MATCHED')
    expect((await api.getPayment(1, 'BCF7K2Q9')).state).toBe('PENDING')
  })

  it('thanh toán không gỡ tạm ngưng (GBR-15)', async () => {
    const seed = structuredClone(SUBSCRIPTION_SEED)
    const pending = { ...structuredClone(seed.farms[0].payments[0]), id: 2000, quoteRef: 'BCZ9Z9Z9' }
    seed.farms[2].payments.push(pending)
    const { api, store } = setup(seed)
    await store.receiveBankTransfer({ transactionId: 'T5', direction: 'IN', amountVnd: 1_200_000, content: 'BCZ9Z9Z9', paidAt: toIso(DEMO_START) })
    const o = await api.getOverview(3)
    expect(o.serviceStatus).toBe('SUSPENDED')
    expect(o.periods).toHaveLength(2)
  })

  it('lịch sử lọc theo mã, trạng thái, ngày và sắp xếp', async () => {
    const { api } = setup()
    expect((await api.listPayments(1)).content.map((p) => p.quoteRef)).toEqual(['BCF7K2Q9', 'BCE3P8L2', 'BCA9X2M1', 'BC77QK30'])
    expect((await api.listPayments(1, { q: 'e3p' })).content.map((p) => p.quoteRef)).toEqual(['BCE3P8L2'])
    expect((await api.listPayments(1, { state: 'PAID' })).content).toHaveLength(2)
    expect((await api.listPayments(1, { from: '2026-10-01', to: '2026-10-10' })).content.map((p) => p.quoteRef)).toEqual(['BCE3P8L2'])
    expect((await api.listPayments(1, { sort: 'requestedAt', dir: 'asc' })).content[0].quoteRef).toBe('BC77QK30')
    expect((await api.listPayments(2)).content).toEqual([])
  })

  it('kiểm tra lại: lỗi tra cứu giữ nguyên yêu cầu cũ; trạng thái chờ thì trả lại như cũ', async () => {
    const { api } = setup()
    const e = await rejects(api.refreshPayment(1, 'BCF7K2Q9', 'result-unavailable'))
    expect(e.code).toBe('RESULT_UNAVAILABLE')
    expect(e.detail.payment?.state).toBe('PENDING')
    expect((await api.refreshPayment(1, 'BCF7K2Q9')).state).toBe('PENDING')
    expect((await api.refreshPayment(1, 'BCF7K2Q9', 'bank-paid')).state).toBe('PAID')
    expect((await rejects(api.getPayment(1, 'KHONGCO'))).code).toBe('NOT_FOUND')
  })

  it('backend không dùng store khi API lỗi; lệnh tạo yêu cầu chưa tích hợp vẫn bị chặn', async () => {
    const store = { getOverview: vi.fn(), createPayment: vi.fn(), now: vi.fn() }
    const http = transport()
    const unavailable = new Error('API unavailable')
    http.get.mockRejectedValue(unavailable)
    const api = createSubscriptionApi({ mode: 'backend', farmId: 1, transport: http, store: store as never })
    await expect(api.getOverview(1)).rejects.toBe(unavailable)
    await expect(api.createPayment(1, { durationYears: 1 })).rejects.toThrow()
    expect(store.getOverview).not.toHaveBeenCalled()
    expect(store.createPayment).not.toHaveBeenCalled()
  })
})

describe('D38 hủy yêu cầu (store demo, cùng quy tắc backend)', () => {
  it('hủy yêu cầu đang chờ và tạo được yêu cầu mới; tiền trước lúc hủy vẫn xác nhận, từ lúc hủy thì không', async () => {
    const { api, store, advance } = setup()
    const pending = (await api.getOverview(1)).pendingPayment!
    advance(1000)
    const cancelled = await api.cancelPayment(1, pending, '  Đổi ý ', 'key')
    expect(cancelled).toMatchObject({ state: 'CANCELLED', cancelReason: 'Đổi ý' })
    expect((await rejects(api.cancelPayment(1, pending, '', 'key-2'))).code).toBe('STALE')
    expect((await api.createPayment(1, { durationYears: 1 })).state).toBe('PENDING')
    const at = Date.parse(cancelled.cancelledAt!)
    const late = await store.receiveBankTransfer({ transactionId: 'D38-late', direction: 'IN', amountVnd: pending.amountVnd, content: pending.quoteRef, paidAt: toIso(at) })
    expect(late.status).toBe('WINDOW_MISSED')
    const early = await store.receiveBankTransfer({ transactionId: 'D38-early', direction: 'IN', amountVnd: pending.amountVnd, content: pending.quoteRef, paidAt: toIso(at - 1) })
    expect(early.status).toBe('CONFIRMED')
    expect(early.payment).toMatchObject({ state: 'PAID', cancelledAt: cancelled.cancelledAt })
  })

  it('đã nhận giao dịch đúng mã (kể cả sai số tiền) thì không hủy được', async () => {
    const { api, store } = setup()
    const pending = (await api.getOverview(1)).pendingPayment!
    await store.receiveBankTransfer({ transactionId: 'D38-wrong', direction: 'IN', amountVnd: 1000, content: pending.quoteRef, paidAt: toIso(DEMO_START) })
    const e = await rejects(api.cancelPayment(1, pending, '', 'key'))
    expect(e.code).toBe('CANCEL_BLOCKED')
    expect(e.detail.code).toBe(pending.quoteRef)
    expect((await api.getPayment(1, pending.quoteRef)).state).toBe('PENDING')
  })
})
