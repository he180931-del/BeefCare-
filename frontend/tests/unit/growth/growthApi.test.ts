import { describe, expect, it, vi } from 'vitest'
import { createGrowthApi } from '../../../src/features/growth/api/growthApi'
import { createGrowthDemoStore } from '../../../src/features/growth/data/growthDemoStore'
import { GrowthLargeChangeError, GrowthValidationError, basisOf, tapeWeightKg } from '../../../src/features/growth/domain/growthRules'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
const make = () => {
  const store = createGrowthDemoStore()
  return { store, api: createGrowthApi({ mode: 'local', farmId: 1, transport: transport() as never, store }) }
}
const base = { measuredAt: '2026-10-20T07:30', measuredBy: 1, measuredByName: 'Trần Quốc Long' }

describe('quy tắc tính toán', () => {
  it('công thức thước dây 88,4 × VN² × DTC và cơ sở số liệu theo phương pháp', () => {
    expect(tapeWeightKg(158, 132)).toBe(291.3)
    expect(basisOf('SCALE')).toBe('MEASURED')
    expect(basisOf('TAPE')).toBe('ESTIMATED')
    expect(basisOf('ESTIMATE')).toBe('ESTIMATED')
  })
})

describe('ghi nhận cân & BCS', () => {
  it('lưu cân điện tử là số đo thực tế và cập nhật chỉ số', async () => {
    const { api } = make()
    const rec = await api.record('BC-000203', { ...base, method: 'SCALE', weightKg: 322, bcs: 3 })
    expect(rec).toMatchObject({ basis: 'MEASURED', status: 'VALID', weightKg: 322 })
    const profile = await api.getProfile('BC-000203')
    expect(profile.latest).toMatchObject({ kg: 322, basis: 'MEASURED' })
    expect(profile.count).toBe(10)
  })

  it('tự tính cân nặng từ thước dây khi không nhập cân', async () => {
    const { api } = make()
    const rec = await api.record('BC-000203', { ...base, method: 'TAPE', heartGirthCm: 158, bodyLengthCm: 132 })
    expect(rec).toMatchObject({ weightKg: 291.3, basis: 'ESTIMATED' })
  })

  it('cho phép chỉ ghi BCS', async () => {
    const { api } = make()
    const rec = await api.record('BC-000203', { ...base, bcs: 3.5 })
    expect(rec.weightKg).toBeUndefined()
    expect((await api.getProfile('BC-000203')).latestBcs).toBe(3.5)
  })

  it.each([
    ['không có cân và BCS', { ...base }, 'form'],
    ['cân nặng ngoài khoảng', { ...base, method: 'SCALE', weightKg: 1600 }, 'weightKg'],
    ['cân nặng không dương', { ...base, method: 'SCALE', weightKg: 0 }, 'weightKg'],
    ['có cân nhưng thiếu phương pháp', { ...base, weightKg: 300 }, 'method'],
    ['thời điểm ở tương lai', { ...base, measuredAt: '2026-10-21T07:30', bcs: 3 }, 'measuredAt'],
    ['trước ngày nhập đàn', { ...base, measuredAt: '2025-03-01T07:30', bcs: 3 }, 'measuredAt'],
    ['BCS ngoài thang', { ...base, bcs: 2.2 }, 'bcs'],
    ['vòng ngực ngoài khoảng', { ...base, method: 'TAPE', heartGirthCm: 20, bodyLengthCm: 130, weightKg: 300 }, 'heartGirthCm'],
  ])('từ chối: %s', async (_name, cmd, field) => {
    const { api, store } = make()
    const before = (await store.getProfile('BC-000203')).count
    await expect(api.record('BC-000203', cmd as never)).rejects.toSatisfy((e: unknown) => e instanceof GrowthValidationError && Boolean(e.fields[field as 'form']))
    expect((await store.getProfile('BC-000203')).count).toBe(before)
  })

  it('đòi xác nhận khi cân lệch hơn 20% so với lần cân trong 30 ngày', async () => {
    const { api } = make()
    const cmd = { ...base, method: 'SCALE' as const, weightKg: 400 }
    await expect(api.record('BC-000203', cmd)).rejects.toBeInstanceOf(GrowthLargeChangeError)
    await expect(api.record('BC-000203', { ...cmd, acknowledgedLargeChange: true })).resolves.toMatchObject({ weightKg: 400 })
  })
})

describe('sửa hoặc loại trừ bản ghi', () => {
  const findByDate = async (api: ReturnType<typeof make>['api'], day: string) => (await api.getProfile('BC-000203')).records.find((r) => r.measuredAt.startsWith(day))!

  it('sửa giá trị giữ bản ghi gốc trong lịch sử thay đổi', async () => {
    const { api } = make()
    const target = await findByDate(api, '2026-08-15')
    const next = await api.correct('BC-000203', target.id, { action: 'CORRECT', values: { weightKg: 295 }, reason: 'Nhập nhầm', expectedVersion: target.version })
    expect(next).toMatchObject({ weightKg: 295, corrected: true, version: target.version + 1 })
    expect(next.revisions.at(-1)).toMatchObject({ reason: 'Nhập nhầm', before: { weightKg: 293 } })
  })

  it('loại trừ bản ghi thì không còn trong biểu đồ và ADG', async () => {
    const { api } = make()
    const target = await findByDate(api, '2026-10-10')
    await api.correct('BC-000203', target.id, { action: 'EXCLUDE', reason: 'Cân sai', expectedVersion: target.version })
    const profile = await api.getProfile('BC-000203')
    expect(profile.latest?.kg).toBe(306)
    expect(profile.chart.some((p) => p.at.startsWith('2026-10-10'))).toBe(false)
    expect(profile.records.find((r) => r.id === target.id)?.status).toBe('EXCLUDED')
  })

  it('bắt buộc có lý do và phát hiện bản ghi đã bị đổi', async () => {
    const { api } = make()
    const target = await findByDate(api, '2026-08-15')
    await expect(api.correct('BC-000203', target.id, { action: 'EXCLUDE', reason: ' ', expectedVersion: target.version })).rejects.toBeInstanceOf(GrowthValidationError)
    await expect(api.correct('BC-000203', target.id, { action: 'EXCLUDE', reason: 'x', expectedVersion: target.version + 5 })).rejects.toThrow(/đã thay đổi/)
  })
})

describe('danh sách đàn', () => {
  it('suy ra tình trạng và lọc theo tìm kiếm, chuồng', async () => {
    const { api } = make()
    const all = await api.listHerd({ size: 50 })
    const status = (code: string) => all.rows.find((r) => r.code === code)?.status
    expect(status('BC-000219')).toBe('OVERDUE')
    expect(status('BC-000203')).toBe('LOW_ADG')
    expect(status('BC-000087')).toBe('LOW_BCS')
    expect(status('BC-000125')).toBe('NORMAL')
    expect(all.tiles.overdue).toBeGreaterThan(0)
    expect((await api.listHerd({ q: 'bão' })).rows.map((r) => r.code)).toEqual(['BC-000203'])
    expect((await api.listHerd({ penCode: 'B1', size: 50 })).rows.every((r) => r.penCode === 'B1')).toBe(true)
  })
})

describe('chế độ backend', () => {
  it('không đọc hay ghi mock', async () => {
    const store = createGrowthDemoStore()
    const spies = [vi.spyOn(store, 'listHerd'), vi.spyOn(store, 'record'), vi.spyOn(store, 'getProfile')]
    const api = createGrowthApi({ mode: 'backend', farmId: 1, transport: transport() as never, store })
    await expect(api.listHerd()).rejects.toThrow(/Chưa tích hợp/)
    await expect(api.record('BC-000203', { ...base, bcs: 3 })).rejects.toThrow(/Chưa tích hợp/)
    await expect(api.getProfile('BC-000203')).rejects.toThrow(/Chưa tích hợp/)
    spies.forEach((s) => expect(s).not.toHaveBeenCalled())
  })
})
