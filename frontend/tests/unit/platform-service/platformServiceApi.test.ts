import { describe, expect, it, vi } from 'vitest'
import { createPlatformServiceApi } from '../../../src/features/platform-service/api/platformServiceApi'
import { createPlatformServiceDemoStore } from '../../../src/features/platform-service/data/platformServiceDemoStore'
import { nextPeriod, renewalOpens } from '../../../src/features/platform-service/domain/servicePeriods'
import { parseVnd, validPrice } from '../../../src/features/platform-service/domain/pricing'

const NOW = '2026-10-19T21:00:00'
function setup() {
  const store = createPlatformServiceDemoStore(undefined, () => NOW)
  const transport = { get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }
  return { store, transport, api: createPlatformServiceApi({ mode: 'local', farmId: 1, transport, store }) }
}

describe('periods and prices', () => {
  it('starts a renewal after the latest confirmed end and keeps the anniversary', () => {
    expect(nextPeriod('2026-10-18', '2026-11-14', 1)).toEqual({ start: '2026-11-15', end: '2027-11-14' })
    expect(nextPeriod('2026-10-18', '2026-09-30', 2)).toEqual({ start: '2026-10-18', end: '2028-10-17' })
    expect(nextPeriod('2027-12-01', null, 1).end).toBe('2028-11-30')
    expect(renewalOpens('2027-11-14')).toBe('2027-08-16')
  })
  it('validates whole VND prices', () => {
    expect(parseVnd('1.200.000')).toBe(1200000)
    expect(validPrice(parseVnd('0'))).toBe(false)
    expect(validPrice(parseVnd('1.5'))).toBe(false)
  })
})

describe('farm service', () => {
  it('lists totals from platform counts and filters', async () => {
    const { api } = setup()
    const all = await api.listFarms()
    expect(all.total).toBe(128)
    expect(all.tiles).toMatchObject({ active: 104, pending: 11, expired: 9, suspended: 4 })
    expect((await api.listFarms({ status: 'SUSPENDED' })).items.map((f) => f.farmName)).toEqual(['Trại Suối Hai'])
    expect((await api.listFarms({ q: 'lvbinh' })).items).toHaveLength(1)
  })
  it('requires a reason, rejects repeats and stale versions, and restore keeps periods', async () => {
    const { api } = setup()
    const suoiHai = (await api.listFarms({ status: 'SUSPENDED' })).items[0]!
    await expect(api.restoreFarm(3, { reason: '  ', version: suoiHai.version })).rejects.toThrow('bắt buộc')
    await expect(api.suspendFarm(3, { reason: 'x', version: suoiHai.version })).rejects.toThrow('đã ở trạng thái')
    await expect(api.restoreFarm(3, { reason: 'ok', version: 99 })).rejects.toThrow('đã được thay đổi')
    const restored = await api.restoreFarm(3, { reason: 'Chủ trại xác nhận', version: suoiHai.version })
    expect(restored.serviceStatus).toBe('ACTIVE')
    expect(restored.coverageEnd).toBe('2027-03-02')
    expect((await api.suspendFarm(2, { reason: 'Vi phạm', version: 1 })).serviceStatus).toBe('SUSPENDED')
    expect((await api.restoreFarm(2, { reason: 'Xong', version: 2 })).serviceStatus).toBe('PENDING_PAYMENT')
  })
})

describe('reconciliation', () => {
  it('blocks accept on a mistyped code until the PM explicitly selects the candidate', async () => {
    const { api } = setup()
    const [cand] = await api.listCandidates(842)
    expect(cand?.code).toBe('BCF7K2Q9')
    await expect(api.reviewEvidence(842, { decision: 'ACCEPT', paymentId: cand!.id, reason: 'ok', version: 1 })).rejects.toThrow('chưa khớp chính xác')
    await expect(api.reviewEvidence(842, { decision: 'HOLD', reason: '', version: 1 })).rejects.toThrow('bắt buộc')
    const held = await api.reviewEvidence(842, { decision: 'HOLD', reason: 'Cần xác minh mã', version: 1 })
    expect(held.evidence.reviewStatus).toBe('HOLD')
    expect((await api.paymentTiles()).hold).toBe(2)
  })
  it('accepting grants the next period once', async () => {
    const { api } = setup()
    const [cand] = await api.listCandidates(843)
    const res = await api.reviewEvidence(843, { decision: 'ACCEPT', paymentId: cand!.id, reason: 'Nguồn tin cậy', version: 1 })
    expect(res.period).toEqual({ start: '2026-11-15', end: '2027-11-14' })
    expect(res.receiptCode).toBe('RC-26-0412')
    const detail = await api.getSubscription(1)
    expect(detail.periods.map((p) => p.state)).toEqual(['CURRENT', 'FUTURE'])
    expect(detail.summary.confirmedUntil).toBe('2027-11-14')
    expect(detail.renewalOpens).toBe('2027-08-16')
    expect(await api.listCandidates(842)).toEqual([])
    expect((await api.paymentTiles()).pendingRequests).toBe(6)
  })
  it('accepting for a suspended farm leaves it suspended', async () => {
    const { api, store } = setup()
    await api.suspendFarm(1, { reason: 'Kiểm tra', version: 3 })
    const [cand] = await api.listCandidates(843)
    await api.reviewEvidence(843, { decision: 'ACCEPT', paymentId: cand!.id, reason: 'ok', version: 1 })
    expect((await store.listFarms({ q: 'Yên Bài' })).items[0]?.serviceStatus).toBe('SUSPENDED')
  })
  it('locks for return, records the result and refuses to unlock afterwards', async () => {
    const { api } = setup()
    await expect(api.lockForReturn(842, { reason: '', version: 1 })).rejects.toThrow('bắt buộc')
    const locked = await api.lockForReturn(842, { reason: 'Khoản không nhận được', version: 1 })
    expect((await api.listEvidence({ status: 'LOCKED' })).map((e) => e.id)).toEqual([842])
    await expect(api.reviewEvidence(842, { decision: 'HOLD', reason: 'x', version: locked.version })).rejects.toThrow('khóa')
    await api.recordReturn(842, { reference: 'OUT-1', paidOutAt: '2026-10-18T11:20', result: 'Đã trả', verifier: 'Quân', version: locked.version })
    await expect(api.unlockReturn(842, { reason: 'a', verification: 'b', version: locked.version + 1 })).rejects.toThrow('đã xác minh hoàn')
  })
})

describe('plan prices', () => {
  const cmd = { price1y: 1100000, price2y: 2000000, price3y: 2900000, mode: 'SCHEDULE' as const, effectiveAt: '2027-01-01T00:00', terms: 'Cùng chức năng' }
  it('publishes a scheduled v4, rejects bad input and withdraws only scheduled versions', async () => {
    const { api } = setup()
    await expect(api.publishPrice({ ...cmd, price1y: 0 })).rejects.toThrow('1.000')
    await expect(api.publishPrice({ ...cmd, effectiveAt: '2026-10-01T00:00' })).rejects.toThrow('quá khứ')
    const v4 = await api.publishPrice(cmd)
    expect([v4.version, v4.status]).toEqual([4, 'SCHEDULED'])
    await expect(api.publishPrice(cmd)).rejects.toThrow('v4')
    const list = await api.listPriceVersions()
    expect(list.find((v) => v.version === 3)?.status).toBe('EFFECTIVE')
    await expect(api.withdrawPrice(3, 'x')).rejects.toThrow('đã lên lịch')
    await api.withdrawPrice(4, 'Nhập sai')
    expect((await api.listPriceVersions())[0]?.status).toBe('WITHDRAWN')
  })
  it('apply now supersedes the old version', async () => {
    const { api } = setup()
    const v4 = await api.publishPrice({ ...cmd, mode: 'NOW' })
    expect(v4.status).toBe('EFFECTIVE')
    expect((await api.listPriceVersions()).find((v) => v.version === 3)?.status).toBe('SUPERSEDED')
  })
})

describe('backend mode', () => {
  it('rejects and never touches the store', async () => {
    const { store, transport } = setup()
    const spy = vi.spyOn(store, 'listFarms')
    const api = createPlatformServiceApi({ mode: 'backend', farmId: 1, transport, store })
    await expect(api.listFarms()).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })
})
