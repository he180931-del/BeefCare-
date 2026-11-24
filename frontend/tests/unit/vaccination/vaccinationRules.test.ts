import { describe, expect, it } from 'vitest'
import { dueStateOf } from '../../../src/features/vaccination/domain/vaccinationRules'
import type { ScheduledDose } from '../../../src/features/vaccination/types'

const dose = (dueDate: string): Pick<ScheduledDose, 'status' | 'dueDate' | 'newExpectedDate'> => ({ status: 'PLANNED', dueDate, newExpectedDate: null })

describe('vaccination due dates', () => {
  it('TC-09-29: separates overdue, due within seven days, and upcoming', () => {
    expect(dueStateOf(dose('2026-11-04'), '2026-11-05')).toBe('OVERDUE')
    expect(dueStateOf(dose('2026-11-10'), '2026-11-05')).toBe('DUE')
    expect(dueStateOf(dose('2026-11-13'), '2026-11-05')).toBe('UPCOMING')
  })
})
