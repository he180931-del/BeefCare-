import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

  it('tự chuyển truy cập tài khoản sang không gắn trại và xóa farmId khỏi payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(null)
    render(
      <NewTicketForm
        farms={[{ id: 1, name: 'Trại của tôi' }]}
        initial={{ category: '', farmId: 1 }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'Danh mục' }), 'ACCOUNT_ACCESS')
    expect(screen.getByRole('button', { name: 'Không gắn trại' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Trang trại' })).toBeDisabled()
    expect(screen.getByLabelText('Trang trại liên quan', { selector: 'select' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Tiêu đề' }), 'Không đăng nhập được')
    await user.type(screen.getByRole('textbox', { name: 'Mô tả chi tiết' }), 'Cần hỗ trợ tài khoản')
    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ scope: 'ACCOUNT', farmId: null })))
  })

  it('chuẩn hóa phạm vi khi form được mở sẵn với danh mục truy cập tài khoản', () => {
    render(
      <NewTicketForm
        farms={[{ id: 1, name: 'Trại của tôi' }]}
        initial={{ category: 'ACCOUNT_ACCESS', farmId: 1 }}
        onSubmit={vi.fn().mockResolvedValue(null)}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Không gắn trại' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Trang trại' })).toBeDisabled()
    expect(screen.getByLabelText('Trang trại liên quan', { selector: 'select' })).toBeDisabled()
  })

  it('ép danh mục thanh toán gắn với trại và giải thích ngay trên màn hình', async () => {
    const user = userEvent.setup()
    render(
      <NewTicketForm
        farms={[{ id: 1, name: 'Trại của tôi' }]}
        initial={{ category: '', farmId: 1 }}
        onSubmit={vi.fn().mockResolvedValue(null)}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Không gắn trại' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Danh mục' }), 'PAYMENT')

    expect(screen.getByRole('button', { name: 'Trang trại' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Không gắn trại' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Trang trại liên quan' })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Trang trại liên quan' })).toHaveValue('')
    expect(screen.getByText('Danh mục này bắt buộc gắn với trang trại.')).toBeInTheDocument()
  })

  it('báo cần chọn trại khi chuyển từ không gắn trại về phạm vi trại', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(null)
    render(
      <NewTicketForm
        farms={[{ id: 1, name: 'Trại của tôi' }]}
        initial={{ category: '', farmId: 1 }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Không gắn trại' }))
    await user.click(screen.getByRole('button', { name: 'Trang trại' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Danh mục' }), 'FARM_SERVICE')
    await user.type(screen.getByRole('textbox', { name: 'Tiêu đề' }), 'Cần hỗ trợ trại')
    await user.type(screen.getByRole('textbox', { name: 'Mô tả chi tiết' }), 'Mô tả yêu cầu')
    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    expect(await screen.findByText('Vui lòng chọn trang trại liên quan.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
