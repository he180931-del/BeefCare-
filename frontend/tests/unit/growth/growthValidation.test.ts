import { describe, expect, it } from 'vitest'
import { validateMeasurement } from '../../../src/features/growth/validation/growthValidation'

// Characterization (golden master) of the SCR-25 measurement input rules, recorded on the code before they moved out of
// domain/ (refactor phase 2). The snapshots are the behaviour to keep.
type Input = Parameters<typeof validateMeasurement>[0]
const ctx = { now: '2026-11-19T10:00', herdEntryDate: '2026-03-01' }
const input = (patch: Partial<Input> = {}): Input => ({ measuredAt: '2026-11-19T08:00', method: 'SCALE', weightKg: 320.5, bcs: 3.5, ...patch } as Input)

describe('validateMeasurement', () => {
  it('accepts weight with a method, BCS, or both', () => {
    expect(validateMeasurement(input(), ctx)).toMatchInlineSnapshot(`{}`)
    expect(validateMeasurement(input({ weightKg: undefined, method: undefined }), ctx)).toMatchInlineSnapshot(`{}`)
  })

  it('reports time, value, precision and note errors', () => {
    expect(validateMeasurement(input({ measuredAt: '' }), ctx)).toMatchInlineSnapshot(`
      {
        "measuredAt": "Thời điểm đo là bắt buộc.",
      }
    `)
    expect(validateMeasurement(input({ measuredAt: '2026-11-19T11:00' }), ctx)).toMatchInlineSnapshot(`
      {
        "measuredAt": "Thời điểm không được ở tương lai.",
      }
    `)
    expect(validateMeasurement(input({ measuredAt: '2026-02-28T08:00' }), ctx)).toMatchInlineSnapshot(`
      {
        "measuredAt": "Thời điểm không được trước ngày nhập đàn (01/03/2026).",
      }
    `)
    expect(validateMeasurement(input({ weightKg: undefined, bcs: undefined }), ctx)).toMatchInlineSnapshot(`
      {
        "form": "Nhập cân nặng, BCS hoặc cả hai.",
      }
    `)
    expect(validateMeasurement(input({ weightKg: 1500.25, method: undefined, bcs: 5.2, heartGirthCm: 49, bodyLengthCm: 251, note: 'x'.repeat(501) } as Partial<Input>), ctx)).toMatchInlineSnapshot(`
      {
        "bcs": "BCS phải nằm trong thang 1,0 – 5,0 (bước 0,5).",
        "bodyLengthCm": "Dài thân chéo phải từ 30 đến 250 cm.",
        "heartGirthCm": "Vòng ngực phải từ 50 đến 300 cm.",
        "method": "Phương pháp là bắt buộc khi có cân nặng.",
        "note": "Ghi chú tối đa 500 ký tự.",
        "weightKg": "Cân nặng phải từ 1 đến 1.500 kg.",
      }
    `)
    expect(validateMeasurement(input({ weightKg: 0 }), ctx)).toMatchInlineSnapshot(`
      {
        "weightKg": "Cân nặng phải từ 1 đến 1.500 kg.",
      }
    `)
  })

  it('TC-08-02/03: checks exact weight limits and BCS values outside the half-step scale', () => {
    expect(validateMeasurement(input({ weightKg: 1 }), ctx)).not.toHaveProperty('weightKg')
    expect(validateMeasurement(input({ weightKg: 1500 }), ctx)).not.toHaveProperty('weightKg')
    expect(validateMeasurement(input({ weightKg: 1500.1 }), ctx).weightKg).toBe('Cân nặng phải từ 1 đến 1.500 kg.')
    expect(validateMeasurement(input({ bcs: 3.3 }), ctx).bcs).toBe('BCS phải nằm trong thang 1,0 – 5,0 (bước 0,5).')
    expect(validateMeasurement(input({ bcs: 5.5 }), ctx).bcs).toBe('BCS phải nằm trong thang 1,0 – 5,0 (bước 0,5).')
  })
})
