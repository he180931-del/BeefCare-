import { describe, expect, it } from 'vitest'
import { healthHistorySummary } from '../../../src/features/health/domain/healthRules'

// SCR-37 (D79): lịch sử bệnh từ trước đến nay của một con bò.
describe('tổng hợp lịch sử sức khỏe', () => {
  it('đếm mọi ca, cộng số lần điều trị và lấy ngày mở của ca gần nhất', () => {
    expect(healthHistorySummary([
      { treatmentCount: 2, openedDate: '2026-03-04' },
      { treatmentCount: 0, openedDate: '2026-11-02' },
      { treatmentCount: 3, openedDate: '2025-12-20' },
    ])).toEqual({ cases: 3, treatments: 5, lastOpened: '2026-11-02' })
  })

  it('bò chưa từng bệnh: 0 ca, 0 lần điều trị, không có ca gần nhất', () => {
    expect(healthHistorySummary([])).toEqual({ cases: 0, treatments: 0, lastOpened: undefined })
  })
})
