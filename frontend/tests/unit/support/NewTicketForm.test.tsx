import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewTicketForm } from '../../../src/features/support/components/NewTicketForm'

describe('NewTicketForm (UC-FE20-01)', () => {
  it('đánh dấu trại liên quan là bắt buộc khi phạm vi là trang trại', async () => {
    const user = userEvent.setup()
    render(
      <NewTicketForm
        farms={[{ id: 1, name: 'Trại của tôi' }]}
        initial={{ category: '', farmId: 1 }}
        onSubmit={vi.fn().mockResolvedValue(null)}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText('Ưu tiên')).not.toBeInTheDocument()
    expect(screen.getByText('Trang trại liên quan *')).toBeInTheDocument()
    await user.click(screen.getByText('Không gắn trại'))
    expect(screen.getByLabelText('Trang trại liên quan', { selector: 'select' })).toBeDisabled()
  })
})
