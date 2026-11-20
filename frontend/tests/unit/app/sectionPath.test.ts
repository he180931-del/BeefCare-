import { describe, expect, it } from 'vitest'
import { sectionPath } from '../../../src/app/session/currentFarm'

describe('sectionPath', () => {
  it.each([
    ['/cattle/BC-1', { code: 'BC-1' }, '/cattle'],
    ['/cattle/BC-1/sinh-san/de', { code: 'BC-1' }, '/cattle'],
    ['/kt/dan-bo/BC-1/lich-su', { '*': 'BC-1/lich-su' }, '/kt/dan-bo'],
    ['/can-nang', { '*': '' }, '/can-nang'],
    ['/thuc-an/phieu-nhap/PNTA-2026-0003', { id: 'PNTA-2026-0003' }, '/thuc-an/phieu-nhap'],
    ['/cattle/B%C3%92-1', { code: 'BÒ-1' }, '/cattle'],
    ['/tong-quan', {}, '/tong-quan'],
  ])('%s → %s', (pathname, params, expected) => {
    expect(sectionPath(pathname, params)).toBe(expected)
  })
})
