import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DoseStatusBadge } from '../../../src/features/vaccination/components/vaccinationParts'
import { dueStateOf } from '../../../src/features/vaccination/domain/vaccinationRules'
import { dayNumber } from '../../../src/features/vaccination/domain/vaccinationFormat'
import type { ComponentProps } from 'react'

function row(dueDate: string): ComponentProps<typeof DoseStatusBadge>['row'] {
  const state = dueStateOf({ status: 'PLANNED', dueDate }, '2026-11-05')
  return {
    state,
    daysOverdue: state === 'OVERDUE' ? dayNumber('2026-11-05') - dayNumber(dueDate) : 0,
    dueDate,
  }
}

describe('vaccination due status presentation', () => {
  it('TC-09-29: shows due, upcoming, and the exact one-day overdue label on 05/11', () => {
    const rows = [row('2026-11-10'), row('2026-11-13'), row('2026-11-04')]
    expect(rows.map((value) => value.state)).toEqual(['DUE', 'UPCOMING', 'OVERDUE'])

    render(<>{rows.map((value, index) => <DoseStatusBadge key={index} row={value} />)}</>)

    expect(screen.getByText('Đến hạn 10/11')).toBeInTheDocument()
    expect(screen.getByText('Sắp tới')).toBeInTheDocument()
    expect(screen.getByText('Quá hạn 1 ngày')).toBeInTheDocument()
  })
})
