import { describe, expect, it } from 'vitest'
import { dueStateOf } from '../../../src/features/vaccination/domain/vaccinationRules'

const dose = (dueDate: string): Parameters<typeof dueStateOf>[0] => ({ status: 'PLANNED', dueDate })

describe('vaccination due dates', () => {
  it('TC-09-29: separates overdue, due within seven days, and upcoming', () => {
    expect(dueStateOf(dose('2026-11-04'), '2026-11-05')).toBe('OVERDUE')
    expect(dueStateOf(dose('2026-11-10'), '2026-11-05')).toBe('DUE')
    expect(dueStateOf(dose('2026-11-13'), '2026-11-05')).toBe('UPCOMING')
  })
})
