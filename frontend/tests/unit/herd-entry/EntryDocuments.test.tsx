import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Docs, Dropzone } from '../../../src/components/ui'

describe('chứng từ phiếu nhập', () => {
  it('chuyển các tệp người dùng chọn cho biểu mẫu', async () => {
    const user = userEvent.setup()
    const onFiles = vi.fn()
    render(<Dropzone hint="PDF, JPG ≤ 10MB" onFiles={onFiles} />)
    const pdf = new File(['%PDF-1.4'], 'kiem-dich.pdf', { type: 'application/pdf' })

    await user.upload(screen.getByLabelText('Chọn chứng từ đính kèm'), pdf)

    expect(onFiles).toHaveBeenCalledWith([pdf])
  })

  it('cho phép xem và loại tệp đã chọn khỏi danh sách', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    const onRemove = vi.fn()
    render(<Docs docs={[{ name: 'kiem-dich.pdf', ext: 'PDF' }]} onView={onView} onRemove={onRemove} />)

    await user.click(screen.getByRole('button', { name: 'Xem kiem-dich.pdf' }))
    await user.click(screen.getByRole('button', { name: 'Xóa kiem-dich.pdf' }))

    expect(onView).toHaveBeenCalledWith(0)
    expect(onRemove).toHaveBeenCalledWith(0)
  })
})
