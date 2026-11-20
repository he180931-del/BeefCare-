import { describe, expect, it } from 'vitest'
import { finishingProgress, weightAtNextWeighing } from '../../../src/features/growth/domain/growthRules'
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
