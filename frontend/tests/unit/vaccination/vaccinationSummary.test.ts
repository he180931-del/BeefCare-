import { describe, expect, it } from 'vitest'
import { cattleVaccinationSummary } from '../../../src/features/vaccination/domain/vaccinationRules'

// SCR-34 (D78): dòng tóm tắt đầu tab Tiêm phòng của hồ sơ bò, dựng từ dữ liệu tab đang hiển thị.
const dose = (state: 'OVERDUE' | 'DUE' | 'UPCOMING') => ({ state })
const record = (status: 'VALID' | 'VOIDED', withdrawalEndDate?: string) => ({ status, withdrawalEndDate })

describe('tóm tắt tiêm phòng của một con bò', () => {
  it('đếm mũi còn theo lịch, mũi quá hạn và số lần đã tiêm còn hiệu lực', () => {
    const summary = cattleVaccinationSummary(
      [dose('OVERDUE'), dose('OVERDUE'), dose('DUE'), dose('UPCOMING')],
      [record('VALID'), record('VALID'), record('VOIDED')],
      '2026-11-26',
    )
    expect(summary).toMatchObject({ scheduled: 4, overdue: 2, done: 2 })
  })

  it('lấy ngày ngưng thịt muộn nhất còn hiệu lực, bỏ qua bản ghi đã hủy và ngày đã qua', () => {
    const summary = cattleVaccinationSummary(
      [],
      [record('VALID', '2026-11-20'), record('VALID', '2026-12-05'), record('VALID', '2026-12-01'), record('VOIDED', '2027-01-01')],
      '2026-11-26',
    )
    expect(summary.withdrawalEnd).toBe('2026-12-05')
  })

  it('không có ngưng thịt còn hiệu lực thì bỏ trống', () => {
    expect(cattleVaccinationSummary([], [record('VALID', '2026-11-25'), record('VALID')], '2026-11-26').withdrawalEnd).toBeUndefined()
  })
})
