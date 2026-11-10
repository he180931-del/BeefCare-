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
  it('counts every farm in the tiles, while the search and status filter only narrow the list', async () => {
    const { api } = setup()
    const all = await api.listFarms()
    expect(all.total).toBe(6)
    expect(all.tiles).toMatchObject({ total: 128, active: 104, activePercent: 81, pending: 11, expired: 9, suspended: 4 })
    const suspended = await api.listFarms({ status: 'SUSPENDED' })
    expect(suspended.items.map((f) => f.farmName)).toEqual(['Trại Suối Hai'])
    expect(suspended.tiles.total).toBe(128)
    expect((await api.listFarms({ q: 'lvbinh' })).items).toHaveLength(1)
  })
  it('sorts by farm name (default), status or coverage end; farms without an end come last', async () => {
    const { api } = setup()
    expect((await api.listFarms()).items.map((f) => f.farmName)).toEqual(['Trại bò Yên Bài – Ba Vì', 'Trại Mai Pha', 'Trại Suối Hai', 'Trại Tản Lĩnh', 'Trại Tòng Bạt', 'Trại Vân Hòa'])
    expect((await api.listFarms({ sort: 'coverageEnd' })).items.map((f) => f.farmId)).toEqual([6, 4, 1, 3, 5, 2])
    expect((await api.listFarms({ sort: '-coverageEnd' })).items.map((f) => f.farmId)).toEqual([5, 3, 1, 4, 6, 2])
  })
  it('previews the restore popup: when, by whom and why, the purchased period and the status after restore', async () => {
    const { api } = setup()
    expect(await api.getFarmService(3)).toMatchObject({
      farmName: 'Trại Suối Hai', herdSize: 61, serviceStatus: 'SUSPENDED', suspendedSince: '2026-09-28', suspendedBy: 'Đỗ Minh Quân',
      suspendReason: 'Nghi vấn chia sẻ tài khoản cho trại khác', periodStart: '2026-03-03', periodEnd: '2027-03-02', coverageEnd: '2027-03-02', statusAfterRestore: 'ACTIVE',
    })
    expect((await api.getFarmService(2)).statusAfterRestore).toBe('PENDING_PAYMENT')
    expect((await api.getFarmService(6)).statusAfterRestore).toBe('EXPIRED')
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
  // The legacy demo price store behind planPriceApi's explicit local adapter (D23: no saved draft).
  it('publishes a scheduled v4, rejects bad input and withdraws only scheduled versions', async () => {
    const { store } = setup()
    await expect(store.publishPrice({ ...cmd, price1y: 0 })).rejects.toThrow('1.000')
    await expect(store.publishPrice({ ...cmd, effectiveAt: '2026-10-01T00:00' })).rejects.toThrow('quá khứ')
    const v4 = await store.publishPrice(cmd)
    expect([v4.version, v4.status]).toEqual([4, 'SCHEDULED'])
    await expect(store.publishPrice(cmd)).rejects.toThrow('v4')
    const list = await store.listPriceVersions()
    expect(list.find((v) => v.version === 3)?.status).toBe('EFFECTIVE')
    await expect(store.withdrawPrice(3, 'x')).rejects.toThrow('đã lên lịch')
    await store.withdrawPrice(4, 'Nhập sai')
    expect((await store.listPriceVersions())[0]?.status).toBe('WITHDRAWN')
  })
  it('apply now supersedes the old version', async () => {
    const { store } = setup()
    const v4 = await store.publishPrice({ ...cmd, mode: 'NOW' })
    expect(v4.status).toBe('EFFECTIVE')
    expect((await store.listPriceVersions()).find((v) => v.version === 3)?.status).toBe('SUPERSEDED')
  })
})

describe('backend mode', () => {
  it('UC-FE02-04 reads the overview from the backend and shows the last day of the coverage', async () => {
    const { store, transport } = setup()
    const spy = vi.spyOn(store, 'listFarms')
    transport.get.mockResolvedValueOnce({
      tiles: { total: 10, active: 6, activePercent: 60, pendingPayment: 1, expired: 2, suspended: 1 }, total: 1,
      items: [{ farmId: 7, farmName: 'Trại A', ownerId: 3, ownerName: 'Hùng', ownerEmail: 'h@x.vn', serviceStatus: 'SUSPENDED', coverageEnd: '2027-01-14T17:00:00Z', suspended: true, suspendedAt: '2026-11-01T03:00:00Z', activeCattle: 12, version: 4 }],
    })
    const api = createPlatformServiceApi({ mode: 'backend', farmId: 1, transport, store })
    const result = await api.listFarms({ q: 'Trại A', status: 'SUSPENDED', sort: '-coverageEnd' })
    expect(transport.get).toHaveBeenCalledWith(`/api/platform/farms?${new URLSearchParams({ q: 'Trại A', status: 'SUSPENDED', sort: '-coverageEnd', size: '100' })}`)
    expect(result.tiles).toEqual({ total: 10, active: 6, activePercent: 60, pending: 1, expired: 2, suspended: 1 })
    expect(result.total).toBe(1)
    // The period ends at 15/01/2027 00:00 in Viet Nam (exclusive), so its last day is 14/01/2027.
    expect(result.items[0]).toMatchObject({ farmId: 7, coverageEnd: '2027-01-14', suspended: true, suspendedSince: '2026-11-01', herdSize: 12, version: 4 })
    expect(spy).not.toHaveBeenCalled()
  })

  it('UC-FE02-05 reads the popup preview and sends the change with the dialog request key', async () => {
    const { store, transport } = setup()
    const api = createPlatformServiceApi({ mode: 'backend', farmId: 1, transport, store })
    transport.get.mockResolvedValueOnce({
      farmId: 7, farmName: 'Trại A', ownerName: 'Hùng', ownerEmail: 'h@x.vn', activeCattle: 12, serviceStatus: 'SUSPENDED', suspendedAt: '2026-11-01T03:00:00Z',
      suspendedBy: 'Quân', previousReason: 'Vi phạm', periodStart: '2026-01-15T03:00:00Z', periodEnd: '2027-01-14T17:00:00Z', coverageEnd: '2027-01-14T17:00:00Z',
      statusAfterRestore: 'ACTIVE', version: 5,
    })
    expect(await api.getFarmService(7)).toMatchObject({
      farmName: 'Trại A', herdSize: 12, suspendedSince: '2026-11-01', suspendedBy: 'Quân', suspendReason: 'Vi phạm',
      periodStart: '2026-01-15', periodEnd: '2027-01-14', coverageEnd: '2027-01-14', statusAfterRestore: 'ACTIVE', version: 5,
    })
    expect(transport.get).toHaveBeenCalledWith('/api/platform/farms/7')
    transport.command.mockResolvedValueOnce({ farmId: 7, farmName: 'Trại A', ownerName: 'Hùng', ownerEmail: 'h@x.vn', serviceStatus: 'ACTIVE', coverageEnd: '2027-01-14T17:00:00Z', suspended: false, suspendedAt: null, activeCattle: 12, version: 6 })
    const restored = await api.restoreFarm(7, { reason: 'Đã xác minh', version: 5 }, { idempotencyKey: 'key-7' })
    expect(transport.command).toHaveBeenCalledWith('/api/platform/farms/7/restore', { reason: 'Đã xác minh', version: 5 }, { method: 'POST', key: 'key-7' })
    expect(restored).toMatchObject({ serviceStatus: 'ACTIVE', suspended: false, version: 6 })
  })

  it('keeps legacy reconciliation unavailable in backend mode, never touches the store and has no legacy price/draft methods', async () => {
    const { store, transport } = setup()
    const spy = vi.spyOn(store, 'listEvidence')
    const api = createPlatformServiceApi({ mode: 'backend', farmId: 1, transport, store })
    await expect(api.listEvidence()).rejects.toThrow('Chưa tích hợp')
    for (const legacy of ['listPriceVersions', 'getPriceDraft', 'savePriceDraft', 'publishPrice', 'withdrawPrice']) expect(legacy in api).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })
})
