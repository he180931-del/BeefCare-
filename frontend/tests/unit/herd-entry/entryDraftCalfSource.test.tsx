import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useEntryEditor } from '../../../src/features/herd-entry/hooks/useEntryEditor'
import type { EntryCalf } from '../../../src/features/herd-entry/types'

it('reopens an old draft with current A11 birth facts while preserving selected pen and purpose', () => {
  const old: EntryCalf = { calfOutcomeId: 17, name: 'Bê số 1', tag: 'CALF-17', mother: 'OLD-DAM', father: 'OLD-SIRE',
    damId: 1, sireId: 2, sireSource: 'INTERNAL', born: '2026-10-01', sex: 'Đực', weight: 20, estimated: false,
    picked: true, barn: 'CHOSEN', penId: 3, purpose: 'Vỗ béo', purposeId: 4 }
  const source: EntryCalf = { ...old, mother: 'SOURCE-DAM', father: 'Không rõ', damId: 5, sireId: undefined,
    sireSource: undefined, born: '2026-10-02', sex: 'Cái', weight: 31, picked: false, barn: 'PROPOSED', penId: 6, purpose: 'Chưa xác định', purposeId: 7 }
  const { result } = renderHook(() => useEntryEditor({ draft: { calves: [old] }, pendingCalves: [source], pens: [], isBuy: false,
    defaults: { recordId: '', date: '', quarantine: '', receiver: '', note: '', cows: [], freight: 0, paid: 0, method: '', due: '' } }))
  expect(result.current.calves[0]).toMatchObject({ mother: 'SOURCE-DAM', father: 'Không rõ', damId: 5, sireId: undefined,
    sireSource: undefined, born: '2026-10-02', sex: 'Cái', weight: 31, picked: true, barn: 'CHOSEN', penId: 3, purposeId: 4 })
  expect(old.mother).toBe('OLD-DAM')
})
