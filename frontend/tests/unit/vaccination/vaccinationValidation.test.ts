import { describe, expect, it } from 'vitest'
import { validateDefer, validateSchedule } from '../../../src/features/vaccination/validation/vaccinationValidation'

// Characterization (golden master) of the SCR-33/34 defer and schedule input rules, recorded on the code before they
// moved out of domain/ (refactor phase 2). The snapshots are the behaviour to keep.
type Schedule = Parameters<typeof validateSchedule>[0]
type Context = Parameters<typeof validateSchedule>[1]
const schedule = (patch: Partial<Schedule> = {}): Schedule => ({
  name: 'LMLM bê', vaccineId: 3, firstDueDate: '2026-12-01', doseCount: 2, intervalDays: 28, boosterIntervalMonths: 6, ...patch,
} as Schedule)
const ctx = (patch: Partial<Context> = {}): Context => ({ activeNames: ['Tụ huyết trùng'], ...patch } as Context)

describe('validateDefer', () => {
  it('needs a reason, a date from today and a short note', () => {
    expect(validateDefer({ reason: 'Bò đang sốt', newExpectedDate: '2026-11-25', note: '' }, '2026-11-19')).toMatchInlineSnapshot(`{}`)
    expect(validateDefer({ reason: '', newExpectedDate: '2026-11-18', note: 'x'.repeat(256) }, '2026-11-19')).toMatchInlineSnapshot(`
      {
        "newExpectedDate": "Ngày mới phải từ hôm nay trở đi.",
        "note": "Ghi chú tối đa 255 ký tự.",
        "reason": "Lý do chưa tiêm là bắt buộc.",
      }
    `)
  })
})

describe('validateSchedule', () => {
  it('accepts a complete schedule', () => {
    expect(validateSchedule(schedule(), ctx())).toMatchInlineSnapshot(`{}`)
  })

  it('reports name, vaccine, start date, doses, interval and booster errors', () => {
    expect(validateSchedule(schedule({ name: '  ', vaccineId: undefined, firstDueDate: '', doseCount: 0, intervalDays: 0, boosterIntervalMonths: 61 }), ctx())).toMatchInlineSnapshot(`
      {
        "boosterIntervalMonths": "Nhắc lại sau phải từ 1 đến 60 tháng.",
        "doseCount": "Số mũi phải là số nguyên từ 1 đến 10.",
        "firstDueDate": "Ngày bắt đầu là bắt buộc.",
        "intervalDays": "Cách giữa mũi phải từ 1 đến 365 ngày.",
        "name": "Tên lịch là bắt buộc.",
        "vaccineId": "Vắc-xin là bắt buộc.",
      }
    `)
    expect(validateSchedule(schedule({ name: 'tụ huyết trùng', doseCount: 3, intervalDays: undefined }), ctx())).toMatchInlineSnapshot(`
      {
        "intervalDays": "Cách giữa mũi là bắt buộc khi có từ 2 mũi.",
        "name": "Đã có lịch đang chạy tên tụ huyết trùng.",
      }
    `)
    expect(validateSchedule(schedule({ name: 'x'.repeat(101), doseCount: 11 }), ctx({ vaccine: { name: 'Vắc-xin cũ', active: false } as Context['vaccine'] }))).toMatchInlineSnapshot(`
      {
        "doseCount": "Số mũi phải là số nguyên từ 1 đến 10.",
        "name": "Tên lịch tối đa 100 ký tự.",
        "vaccineId": "Vắc-xin cũ đã ngừng sử dụng, không thể chọn cho bản ghi mới.",
      }
    `)
  })
})
