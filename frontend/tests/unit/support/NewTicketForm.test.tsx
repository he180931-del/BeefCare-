import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewTicketForm } from '../../../src/features/support/components/NewTicketForm'

describe('NewTicketForm (Owner ticket composer)', () => {
  it('keeps the category selector but hides farm assignment and submits the active farm', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(null)
    render(<NewTicketForm activeFarmId={7} onSubmit={onSubmit} onCancel={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: 'Danh mục' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Trang trại liên quan/)).not.toBeInTheDocument()
    expect(screen.queryByText('Phạm vi *')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Danh mục' }), 'PAYMENT')
    await user.type(screen.getByRole('textbox', { name: 'Tiêu đề' }), 'Chuyển khoản chưa khớp')
    await user.type(screen.getByRole('textbox', { name: 'Mô tả chi tiết' }), 'Tôi cần kiểm tra giao dịch vừa gửi.')
    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      category: 'PAYMENT', scope: 'FARM', farmId: 7,
    })))
  })

  it('uses a compact attachment control for lightweight evidence files', async () => {
    const user = userEvent.setup()
    render(<NewTicketForm activeFarmId={7} onSubmit={vi.fn().mockResolvedValue(null)} onCancel={vi.fn()} />)

    const file = new File(['receipt'], 'chung-tu.pdf', { type: 'application/pdf' })
    expect(screen.getByText('Đính kèm tệp')).toBeInTheDocument()
    expect(screen.queryByText(/Không bắt buộc · PDF/)).not.toBeInTheDocument()
    await user.upload(screen.getByLabelText('Đính kèm tệp'), file)

    expect(screen.getByText('chung-tu.pdf')).toBeInTheDocument()
  })
})
