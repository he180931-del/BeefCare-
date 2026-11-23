import { describe, expect, it } from 'vitest'
import { isStandardDose, joinDose, parseDoseAmount, splitDose } from '../../../src/shared/lib/dose'

describe('liều số + đơn vị (D65)', () => {
  it('tách liều chuẩn, giữ nguyên liều cũ không theo chuẩn', () => {
    expect(splitDose('30 ml')).toEqual({ amount: '30', unit: 'ml', legacy: false })
    expect(splitDose('2.5ML')).toEqual({ amount: '2,5', unit: 'ml', legacy: false })
    expect(splitDose('1 viên')).toEqual({ amount: '1', unit: 'viên', legacy: false })
    expect(splitDose('1 ml / 10 kg').legacy).toBe(true)
    expect(splitDose('3 ống').legacy).toBe(true)
    expect(splitDose('')).toEqual({ amount: '', unit: 'ml', legacy: false })
  })

  it('đọc số liều nghiêm và ghép chuỗi lưu', () => {
    expect(parseDoseAmount('2,5')).toBe(2.5)
    expect(parseDoseAmount('')).toBeNull()
    expect(parseDoseAmount('0')).toBeNaN()
    expect(parseDoseAmount('abc')).toBeNaN()
    expect(joinDose('2.5', 'ml')).toBe('2,5 ml')
    expect(joinDose(' ', 'ml')).toBe('')
    expect([isStandardDose('30 ml'), isStandardDose('30'), isStandardDose('0 ml'), isStandardDose('3 ống')]).toEqual([true, false, false, false])
  })
})

