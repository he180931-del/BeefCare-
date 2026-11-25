import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AddBuyerModal from '../../../src/features/herd-exit/components/AddBuyerModal'

describe('AddBuyerModal', () => {
  it('requires a name before saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<AddBuyerModal onClose={vi.fn()} onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Lưu người mua' }))
    expect(screen.getByText('Tên người mua là bắt buộc.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves trimmed buyer details', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ id: 'b4', name: 'Lò mổ mới', phone: '0900' })
    render(<AddBuyerModal onClose={vi.fn()} onSave={onSave} />)

    await user.type(screen.getByLabelText('Tên người mua / thương lái *'), '  Lò mổ mới  ')
    await user.type(screen.getByLabelText('Số điện thoại'), ' 0900 ')
    await user.type(screen.getByLabelText('Khu vực'), '  Ba Vì ')
    await user.click(screen.getByRole('button', { name: 'Lưu người mua' }))
    expect(onSave).toHaveBeenCalledWith({ name: 'Lò mổ mới', phone: '0900', area: 'Ba Vì' }, expect.objectContaining({ key: expect.stringMatching(/^beefcare-exit-buyer-/) }))
  })
})
