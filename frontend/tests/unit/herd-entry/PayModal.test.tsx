import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HerdEntry } from '../../../src/types'

const localIsoToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const record: HerdEntry = {
  id: 'PN-2026-0041', date: '2026-10-29', type: 'Mua ngoài', status: 'Đã nhập', source: 'Trang trại Mộc Châu', count: 1,
  weight: 320, total: 1000000, debt: 250000, detail: { payments: [] },
}

afterEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('PayModal backend defaults', () => {
  it('starts a backend payment with local today and blank non-domain demo fields', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    const { default: PayModal } = await import('../../../src/features/herd-entry/components/PayModal')
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<MemoryRouter><PayModal record={record} onSave={onSave} onClose={vi.fn()} /></MemoryRouter>)

    expect(screen.queryByText('uy-nhiem-chi-2210.jpg')).not.toBeInTheDocument()
    const fields = screen.getAllByRole('textbox')
    expect(fields.at(-2)).toHaveValue('')
    expect(fields.at(-1)).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Lưu thanh toán' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ date: localIsoToday(), ref: '', note: '' }))
  })

  it('TC-06-35: rejects an amount above the outstanding, a future date and a date before the voucher', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    const { default: PayModal } = await import('../../../src/features/herd-entry/components/PayModal')
    const { fireEvent } = await import('@testing-library/react')
    render(<MemoryRouter><PayModal record={record} onSave={vi.fn()} onClose={vi.fn()} /></MemoryRouter>)
    const save = screen.getByRole('button', { name: 'Lưu thanh toán' })
    const amount = screen.getAllByRole('textbox')[0]
    fireEvent.change(amount, { target: { value: '250001' } })
    expect(screen.getByText('Số tiền không được vượt quá 250.000 đ.')).toBeInTheDocument()
    expect(save).toBeDisabled()
    fireEvent.change(amount, { target: { value: '250000' } })
    expect(save).toBeEnabled()
    const date = screen.getByLabelText('Chọn ngày')
    fireEvent.change(date, { target: { value: '2999-01-01' } })
    expect(screen.getByText('Ngày thanh toán không được ở tương lai.')).toBeInTheDocument()
    fireEvent.change(date, { target: { value: '2026-10-28' } })
    expect(screen.getByText('Ngày thanh toán không được trước ngày phiếu 29/10/2026.')).toBeInTheDocument()
    expect(save).toBeDisabled()
  })
})
