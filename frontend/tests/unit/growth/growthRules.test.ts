import { describe, expect, it } from 'vitest'
import { adgBasis, adgBasisText, adgForWindow, finishingProgress, validWeights, weightAtNextWeighing } from '../../../src/features/growth/domain/growthRules'
import type { GrowthRecord } from '../../../src/features/growth/types'

const record = (id: number, measuredAt: string, weightKg: number | undefined, patch: Partial<GrowthRecord> = {}): GrowthRecord => ({
  id, cattleCode: 'BC-1', measuredAt, recordedAt: measuredAt, measuredBy: 1, measuredByName: 'A', method: 'SCALE', weightKg,
  basis: 'MEASURED', status: 'VALID', corrected: false, version: 1, revisions: [], ...patch,
})

describe('tiến độ chặng vỗ béo (Figma Tab 17)', () => {
  it('tính từ lần cân hợp lệ đầu tiên tới cân mục tiêu, bỏ bản ghi đã loại trừ và lần chỉ chấm BCS', () => {
    const records = [
      record(4, '2026-10-10T07:20', 318, { method: 'TAPE', basis: 'ESTIMATED' }),
      record(3, '2026-09-12T07:05', 306),
      record(2, '2026-09-02T07:00', 251, { status: 'EXCLUDED' }),
      record(5, '2026-07-01T07:00', undefined, { bcs: 3 }),
      record(1, '2026-07-20T07:10', 282),
    ]
    expect(finishingProgress(records, 380)).toEqual({
      percent: 37, currentKg: 318, currentAt: '2026-10-10T07:20', currentBasis: 'ESTIMATED', targetKg: 380, gainedKg: 36, plannedKg: 98, since: '2026-07-20T07:10',
    })
  })

  it('đủ 100% khi đã đạt mục tiêu, kể cả khi lần cân đầu đã vượt mục tiêu; không âm khi bò sụt cân', () => {
    expect(finishingProgress([record(1, '2026-07-01T07:00', 300), record(2, '2026-08-01T07:00', 385)], 380)?.percent).toBe(100)
    expect(finishingProgress([record(1, '2026-07-01T07:00', 390)], 380)).toMatchObject({ percent: 100, plannedKg: 0 })
    expect(finishingProgress([record(1, '2026-07-01T07:00', 300), record(2, '2026-08-01T07:00', 290)], 380)).toMatchObject({ percent: 0, gainedKg: -10 })
  })

  it('chưa có lần cân hợp lệ thì không có tiến độ', () => {
    expect(finishingProgress([record(1, '2026-07-01T07:00', 300, { status: 'EXCLUDED' })], 380)).toBeUndefined()
  })
})

describe('cân ước tính vào lần cân tới', () => {
  it('cân gần nhất + ADG 60 ngày × số ngày tới lần cân tới', () => {
    expect(weightAtNextWeighing(318, '2026-10-10T07:20', '2026-11-09', 0.44)).toBe(331.2)
  })

  it('không ước tính khi thiếu ADG 60 ngày hoặc chưa có lịch cân', () => {
    expect(weightAtNextWeighing(318, '2026-10-10T07:20', '2026-11-09', undefined)).toBeUndefined()
    expect(weightAtNextWeighing(318, '2026-10-10T07:20', undefined, 0.44)).toBeUndefined()
  })
})

describe('căn cứ ADG hiển thị theo số ngày thật, không ghi cứng tên kỳ', () => {
  const today = '2026-11-22'
  it('ADG 60 ngày của bò mới cân 40 ngày ghi "tính trên 40 ngày", bỏ lần cân ngoài kỳ', () => {
    const weights = validWeights([record(1, '2026-09-01T07:00', 300), record(2, '2026-10-13T07:00', 330), record(3, '2026-11-22T07:00', 362)])
    const basis = adgBasis(weights, 60, today)
    expect(basis).toEqual({ from: '2026-10-13', to: '2026-11-22', days: 40, count: 2 })
    expect(adgBasisText(adgForWindow(weights, 60, `${today}T23:59`), basis, 60)).toBe('Tính trên 40 ngày · 2 lần cân (13/10 → 22/11)')
  })
  it('nói rõ lý do khi chưa có ADG: hai lần cân quá gần hoặc chưa đủ lần cân trong kỳ', () => {
    const close = validWeights([record(1, '2026-11-13T07:00', 340), record(2, '2026-11-22T07:00', 350)])
    expect(adgBasisText(undefined, adgBasis(close, 60, today), 60)).toBe('2 lần cân chỉ cách 9 ngày · cần từ 14 ngày')
    const single = validWeights([record(1, '2026-11-01T07:00', 340)])
    expect(adgBasisText(undefined, adgBasis(single, 90, today), 90)).toBe('Cần ≥ 2 lần cân cách nhau từ 14 ngày trong 90 ngày gần nhất')
  })
})
