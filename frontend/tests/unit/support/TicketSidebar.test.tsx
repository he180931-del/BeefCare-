import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StatusHistoryCard } from '../../../src/features/support/components/TicketSidebar'
import type { Ticket } from '../../../src/features/support/types'

describe('StatusHistoryCard', () => {
  it('keeps status history in a bounded scroll region and paginates every ten events', async () => {
    const user = userEvent.setup()
    const ticket = {
      history: Array.from({ length: 11 }, (_, index) => ({
        at: `2026-10-18T10:${String(index).padStart(2, '0')}:00`,
        event: 'IN_PROGRESS' as const,
        status: 'IN_PROGRESS' as const,
        actor: 'Nhân viên hỗ trợ',
      })),
    } as Ticket

    render(<StatusHistoryCard ticket={ticket} />)

    const history = screen.getByRole('region', { name: 'Danh sách lịch sử trạng thái' })
    expect(history).toHaveClass('max-h-[360px]', 'overflow-y-auto')
    expect(within(history).getAllByRole('row')).toHaveLength(11)
    expect(screen.getByText('Hiển thị 10 / 11 sự kiện')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '2' }))
    expect(within(history).getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('Hiển thị 1 / 11 sự kiện')).toBeInTheDocument()
  })
})
