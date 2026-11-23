import { expect, it } from 'vitest'
import { buildEntryLineChanges, emptyEntryLineForm } from '../../../src/features/herd-entry/domain/entryLineCorrection'
import type { EntryCattleDetail, EntryCow, HerdEntry } from '../../../src/features/herd-entry/types'

const record: HerdEntry = { id: 'PN-H', status: 'Đã nhập', entryType: 'PURCHASE', date: '2026-10-20' }
const history: EntryCow['hist'] = { vaccine: 'Có', vaccineItems: [{ vaccineId: 1, vaccineName: 'LMLM', vaccineDate: '2026-03-01', vaccineSource: 'Sổ cũ' }],
  disease: 'Có', diseaseNote: 'Đã khỏi', repro: 'Có', earlierCalvings: 2, pregnantAtEntry: 'YES', pregnancyMonths: 4 }
const line: EntryCattleDetail = { sexCode: 'FEMALE', hist: history }
const build = (hist: EntryCow['hist'], form = emptyEntryLineForm()) => buildEntryLineChanges(record, line, form, hist)

it('only sends the changed disease block, keeping normalized vaccination and reproduction absent', () => {
  const result = build({ ...history, vaccineItems: [{ ...history.vaccineItems![0], vaccineName: ' LMLM ', vaccineDate: '03/2026', vaccineSource: ' Sổ cũ ' }], diseaseNote: ' Đã tiêm thuốc, khỏi ' })
  expect(result).toEqual({ changes: { disease: { status: 'KNOWN', description: 'Đã tiêm thuốc, khỏi' } }, error: null })
})
it('preserves ordered vaccine rows and converts month dates with the shared draft date mapper', () => {
  const result = build({ ...history, vaccineItems: [...history.vaccineItems!, { vaccineName: ' Tụ huyết trùng ', vaccineDate: '05/2026', vaccineSource: ' Người bán ' }] })
  expect(result.error).toBeNull()
  expect(result.changes.vaccination?.items).toEqual([
    { vaccineId: 1, vaccineName: 'LMLM', date: '2026-03-01', informationSource: 'Sổ cũ' },
    { vaccineId: null, vaccineName: 'Tụ huyết trùng', date: '2026-05-01', informationSource: 'Người bán' },
  ])
  expect(result.changes).not.toHaveProperty('reproduction')
})
it.each([['Không', 'NONE'], ['Không rõ', 'UNKNOWN']])('preserves %s separately and drops inactive vaccination details', (value, status) => {
  expect(build({ ...history, vaccine: value }).changes.vaccination).toEqual({ status, informationSource: null, items: [] })
})
it('keeps unchanged history blocks absent', () => expect(build(structuredClone(history))).toEqual({ changes: {}, error: null }))
it('does not submit reproduction on a new male sex; the backend clears the old declaration', () => {
  expect(build({ ...history, earlierCalvings: 3 }, { ...emptyEntryLineForm(), sex: 'MALE' })).toEqual({ changes: { sex: 'MALE' }, error: null })
})
it('keeps all declaration blocks out of FARM_BORN corrections', () => {
  expect(buildEntryLineChanges({ ...record, entryType: 'FARM_BORN' }, line, emptyEntryLineForm(), { ...history, diseaseNote: 'Khác' }).changes).toEqual({})
})
it.each([
  { vaccine: 'Có', vaccineItems: [] },
  { diseaseNote: ' ' },
  { pregnancyMonths: 0 }, { pregnancyMonths: 10 }, { pregnancyMonths: 1.5 },
  { earlierCalvings: -1 }, { earlierCalvings: 16 },
])('validates required/conditional history fields: %j', patch => {
  expect(build({ ...history, ...patch }).error).not.toBeNull()
})
it('does not send stale pregnancy months after changing to NO', () => {
  expect(build({ ...history, pregnantAtEntry: 'NO' }).changes.reproduction).toEqual({ status: 'KNOWN', earlierCalvings: 2, pregnantAtEntry: 'NO', estMonthsPregnant: null, description: null })
})
