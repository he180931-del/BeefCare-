import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { RecordScreen } from '../../../src/features/records/pages/RecordScreens'

describe('RecordScreen', () => {
  it('shows compact identity, status and parent information', () => {
    render(<RecordScreen screen={screenById('SCR-27')!} state="success" />)
    expect(screen.getByRole('heading', { name: 'VN-0248 · Bò cái 248' })).toBeInTheDocument()
    expect(screen.getByText('Mẹ: VN-0102')).toBeInTheDocument()
    expect(screen.getByText('Đang nuôi')).toBeInTheDocument()
  })

  it('keeps timeline events in newest-first order without card soup', () => {
    const { container } = render(<RecordScreen screen={screenById('SCR-79')!} state="success" />)
    const times = screen.getAllByRole('time').map((element) => element.getAttribute('datetime'))
    expect(times).toEqual(['2026-11-02', '2026-10-28', '2026-10-20'])
    expect(container.querySelectorAll('.rounded-xl')).toHaveLength(0)
  })
})
