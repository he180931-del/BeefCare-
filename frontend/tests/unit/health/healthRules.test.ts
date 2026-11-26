import { describe, expect, it } from 'vitest'
import { hasFollowUp, openCaseErrors, parseTemperature, reasonErrors, statusErrors, temperatureError, temperatureNeedsCheck, treatmentErrors } from '../../../src/features/health/validation/healthValidation'
import { withdrawalEnd } from '../../../src/features/health/domain/healthRules'

// Quy tắc trường FE-10 (spec mục 6) dùng chung cho chế độ local và backend.
const ctx = { now: '2026-11-05T12:00', entryDate: '2026-10-01' }
const openCase = { observedAt: '2026-11-01T10:00', temperatureC: 39.5, signs: 'Ho, sốt', diagnosis: '', severity: 'MILD' }
const treatment = {
  medicineId: 1,
  treatmentTime: '2026-11-01T11:00',
  dose: '30 ml',
  route: 'INTRAMUSCULAR',
  courseDays: 3,
  withdrawalDays: 7,
  performer: '',
  veterinaryAdvice: '',
}

describe('FE-10 – quy tắc trường dùng chung', () => {
  it('TC-10-09: calculates the meat withdrawal end after the last treatment dose', () => {
    expect(withdrawalEnd('2026-11-01T08:00', 3, 7)).toBe('2026-11-10')
  })
  it('TC-10-01: thân nhiệt 34,9 / 35,0 / 43,0 / 43,1 và tối đa 1 chữ số thập phân', () => {
    // D61: chỉ chặn số gõ nhầm ngoài 30–45 °C; ngoài 35–43 °C thì hỏi xác nhận.
    expect(temperatureError(29.9)).not.toBeNull()
    expect(temperatureError(30)).toBeNull()
    expect(temperatureError(45)).toBeNull()
    expect(temperatureError(45.1)).not.toBeNull()
    expect([34.9, 35, 43, 43.1].map(temperatureNeedsCheck)).toEqual([true, false, false, true])
    expect(temperatureNeedsCheck(null)).toBe(false)
    expect(temperatureNeedsCheck(46)).toBe(false)
    expect(temperatureError(39.55)).not.toBeNull()
    expect(temperatureError(null)).toBeNull()
    expect(parseTemperature('39,6')).toBe(39.6)
    expect(parseTemperature('')).toBeNull()
    expect(parseTemperature('abc')).toBeNaN()
  })

  it('TC-10-02: mở ca thiếu dấu hiệu và mức độ báo lỗi dưới từng ô', () => {
    expect(openCaseErrors(openCase, ctx)).toEqual({})
    const errors = openCaseErrors({ ...openCase, signs: '  ', severity: '' }, ctx)
    expect(Object.keys(errors).sort()).toEqual(['severity', 'signs'])
  })

  it('TC-10-02: giới hạn độ dài dấu hiệu 1.000 và chẩn đoán 100 ký tự', () => {
    const errors = openCaseErrors({ ...openCase, signs: 'a'.repeat(1001), diagnosis: 'b'.repeat(101) }, ctx)
    expect(Object.keys(errors).sort()).toEqual(['diagnosis', 'signs'])
    expect(openCaseErrors({ ...openCase, signs: 'a'.repeat(1000), diagnosis: 'b'.repeat(100) }, ctx)).toEqual({})
  })

  it('thời điểm quan sát: bắt buộc, không ở tương lai, không trước ngày nhập đàn', () => {
    expect(openCaseErrors({ ...openCase, observedAt: '' }, ctx).observedAt).toBeDefined()
    expect(openCaseErrors({ ...openCase, observedAt: '2026-11-05T12:01' }, ctx).observedAt).toBeDefined()
    expect(openCaseErrors({ ...openCase, observedAt: '2026-09-30T23:00' }, ctx).observedAt).toBeDefined()
  })

  it('TC-10-07 / D58: cập nhật ca trước lần ghi gần nhất bị chặn', () => {
    const cmd = { action: 'KEEP', observedAt: '2026-11-01T09:00', temperatureC: null, progress: 'IMPROVED', description: 'Ăn tốt hơn', diagnosis: '' }
    expect(statusErrors(cmd, { ...ctx, latestAt: '2026-11-01T10:00' }).observedAt).toContain('lần ghi gần nhất')
    expect(statusErrors({ ...cmd, observedAt: '2026-11-01T10:00' }, { ...ctx, latestAt: '2026-11-01T10:00' })).toEqual({})
  })

  it('D58: có phần theo dõi khi Giữ trạng thái hoặc khi nhập mô tả, diễn biến hay thân nhiệt', () => {
    const change = { action: 'TO_CHRONIC', description: '', progress: '', temperatureC: null }
    expect(hasFollowUp({ ...change, action: 'KEEP' })).toBe(true)
    expect(hasFollowUp(change)).toBe(false)
    expect(hasFollowUp({ ...change, description: 'Còn ho' })).toBe(true)
    expect(hasFollowUp({ ...change, progress: 'UNCHANGED' })).toBe(true)
    expect(hasFollowUp({ ...change, temperatureC: 39 })).toBe(true)
  })

  it('TC-10-08/09: điều trị hợp lệ; liệu trình và ngày ngưng để trống thì dùng mặc định', () => {
    expect(treatmentErrors(treatment, ctx)).toEqual({})
    expect(treatmentErrors({ ...treatment, courseDays: null, withdrawalDays: null }, ctx)).toEqual({})
  })

  it('điều trị: thuốc, liều, đường dùng bắt buộc; liệu trình 1–30, ngưng 0–365 khi có nhập', () => {
    const errors = treatmentErrors({ ...treatment, medicineId: null, dose: '', route: '', courseDays: 31, withdrawalDays: 366 }, ctx)
    expect(Object.keys(errors).sort()).toEqual(['courseDays', 'dose', 'medicineId', 'route', 'withdrawalDays'])
    expect(treatmentErrors({ ...treatment, courseDays: 0 }, ctx).courseDays).toBeDefined()
    expect(treatmentErrors({ ...treatment, courseDays: 2.5 }, ctx).courseDays).toBeDefined()
    expect(treatmentErrors({ ...treatment, withdrawalDays: 0 }, ctx)).toEqual({})
    expect(treatmentErrors({ ...treatment, route: 'NASAL' }, ctx).route).toBeDefined()
    expect(treatmentErrors({ ...treatment, dose: 'x'.repeat(51), performer: 'y'.repeat(101), veterinaryAdvice: 'z'.repeat(501) }, ctx))
      .toHaveProperty('dose')
  })

  it('điều trị không được trước lúc mở ca', () => {
    expect(treatmentErrors(treatment, { ...ctx, openedAt: '2026-11-01T12:00' }).treatmentTime).toBeDefined()
  })

  it('TC-10-17: đóng ca trước lần ghi gần nhất bị chặn; kết quả bắt buộc', () => {
    const cmd = { action: 'CLOSE', observedAt: '2026-11-02T08:00', temperatureC: null, progress: '', description: '', diagnosis: '', outcome: '' }
    const errors = statusErrors(cmd, { ...ctx, latestAt: '2026-11-03T08:00' })
    expect(Object.keys(errors).sort()).toEqual(['observedAt', 'outcome'])
    expect(statusErrors({ ...cmd, outcome: 'RECOVERED', observedAt: '2026-11-03T08:00' }, { ...ctx, latestAt: '2026-11-03T08:00' })).toEqual({})
  })

  it('TC-10-27: giữ trạng thái cần diễn biến và mô tả; đóng ca có mô tả cần diễn biến; phần theo dõi trống thì không', () => {
    const keep = { action: 'KEEP', observedAt: '2026-11-04T08:00', temperatureC: null, diagnosis: '' }
    expect(statusErrors({ ...keep, description: 'Ổn định', progress: '' }, ctx).progress).toBeDefined()
    expect(statusErrors({ ...keep, description: '', progress: 'UNCHANGED' }, ctx).description).toBeDefined()
    const close = { action: 'CLOSE', observedAt: '2026-11-04T08:00', temperatureC: null, diagnosis: '', outcome: 'RECOVERED' }
    expect(statusErrors({ ...close, description: 'Đã khỏi', progress: '' }, ctx).progress).toBeDefined()
    expect(statusErrors({ ...close, description: '', progress: '' }, ctx)).toEqual({})
    expect(statusErrors({ ...close, description: 'Đã khỏi', progress: 'IMPROVED' }, ctx)).toEqual({})
  })

  it('TC-10-22: sửa / hủy không có lý do hoặc lý do quá 500 ký tự bị chặn', () => {
    expect(reasonErrors('').reason).toBeDefined()
    expect(reasonErrors('   ').reason).toBeDefined()
    expect(reasonErrors('a'.repeat(501)).reason).toBeDefined()
    expect(reasonErrors('Ghi nhầm liều')).toEqual({})
  })
})
