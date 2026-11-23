import { expect, it } from 'vitest'
import { buildEntryLineChanges, emptyEntryLineForm } from '../../../src/features/herd-entry/domain/entryLineCorrection'
import type { EntryCattleDetail, HerdEntry } from '../../../src/features/herd-entry/types'

const record: HerdEntry = { id: 'PN-1', status: 'Đã nhập', entryType: 'PURCHASE', date: '2026-10-20', sellerId: 7 }
const line: EntryCattleDetail = { weight: 250, weightBasis: 'MEASURED', unitPrice: 1000, breedId: 21, sexCode: 'FEMALE', birthDate: '2023-02-01', birthDateAccuracy: 'ESTIMATED' }

it('ignores blanks and normalized unchanged values, including zero prices', () => {
  const result = buildEntryLineChanges(record, { ...line, unitPrice: 0 }, { ...emptyEntryLineForm(), entryWeightKg: '250.00', unitPrice: '0', quarantineCertNo: '   ' })
  expect(result).toEqual({ changes: {}, error: null })
})
it('requires an explicit basis for a changed weight and sends it even when unchanged', () => {
  const form = { ...emptyEntryLineForm(), entryWeightKg: '260' }
  expect(buildEntryLineChanges(record, line, form).error).toContain('cơ sở cân')
  expect(buildEntryLineChanges(record, line, { ...form, weightBasis: 'MEASURED' }).changes).toEqual({ entryWeightKg: 260, weightBasis: 'MEASURED' })
})
it.each(['0', '1500.1', '-1', 'NaN'])('rejects invalid weight %s', entryWeightKg => {
  expect(buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), entryWeightKg, weightBasis: 'MEASURED' }).error).toContain('1 đến 1.500')
})
it.each(['-1', '1.5', '9007199254740992'])('rejects invalid price %s', unitPrice => {
  expect(buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), unitPrice }).error).toContain('số nguyên')
})
it('keeps purchase-only fields out of farm-born corrections', () => {
  expect(buildEntryLineChanges({ ...record, entryType: 'FARM_BORN' }, line, { ...emptyEntryLineForm(), sex: 'MALE', unitPrice: '5', entryWeightKg: '260', weightBasis: 'MEASURED' }).changes).toEqual({ entryWeightKg: 260, weightBasis: 'MEASURED' })
})
it('sends the birth pair when only its date changes, preserving estimated accuracy', () => {
  expect(buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), birthDate: '2023-03-01' }).changes).toEqual({ birthDate: '2023-03-01', birthDateAccuracy: 'ESTIMATED' })
})
it('sends the birth pair when only accuracy changes, preserving the date', () => {
  expect(buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), birthDateAccuracy: 'EXACT' }).changes).toEqual({ birthDate: '2023-02-01', birthDateAccuracy: 'EXACT' })
})
it('requires a known date when selecting exact/estimated accuracy for an unknown birth', () => {
  expect(buildEntryLineChanges(record, { ...line, birthDate: undefined, birthDateAccuracy: 'UNKNOWN' }, { ...emptyEntryLineForm(), birthDateAccuracy: 'EXACT' }).error).toContain('ngày sinh')
})
it('rejects a future entry date and a birth date after the effective entry date', () => {
  expect(buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), entryDate: '2099-01-01' }).error).toContain('tương lai')
  expect(buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), birthDate: '2026-10-21', birthDateAccuracy: 'EXACT' }).error).toContain('ngày nhập')
})
it('normalizes an estimated birth date to the month before comparing changes', () => {
  expect(buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), birthDate: '2023-02-20' })).toEqual({ changes: {}, error: null })
})
it.each([['quarantineCertNo', 51], ['vehiclePlate', 21]] as const)('limits %s', (field, length) => {
  expect(buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), [field]: 'a'.repeat(length) }).error).not.toBeNull()
})
it('normalizes source text and sends changed catalogue ids, sex and a zero price without extra fields', () => {
  const result = buildEntryLineChanges(record, line, { ...emptyEntryLineForm(), sellerId: '8', breedId: '22', sex: 'MALE', quarantineCertNo: ' KD-2 ', vehiclePlate: ' 29C-123 ', unitPrice: '0' })
  expect(result).toEqual({ changes: { sellerId: 8, breedId: 22, sex: 'MALE', quarantineCertNo: 'KD-2', vehiclePlate: '29C-123', unitPrice: 0 }, error: null })
})
