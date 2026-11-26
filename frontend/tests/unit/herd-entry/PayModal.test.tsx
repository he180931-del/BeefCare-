import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HerdEntry } from '../../../src/features/herd-entry/types'

const record: HerdEntry = {
  id: 'PN-2026-0041', date: '2026-10-29', type: 'Mua ngoài', status: 'Đã nhập', source: 'Trang trại Mộc Châu', count: 1,
  weight: 320, total: 1000000, debt: 250000, detail: { payments: [] },
}

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('PayModal backend defaults', () => {
  it('starts a backend payment with the current UTC+7 date and blank non-domain demo fields', async () => {
    vi.setSystemTime(new Date('2026-10-29T17:00:00Z'))
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

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-30', ref: '', note: '' }))
  })

  async function backendModal(onSave = vi.fn()) {
    vi.setSystemTime(new Date('2026-10-30T03:00:00Z'))
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    const { default: PayModal } = await import('../../../src/features/herd-entry/components/PayModal')
    render(<MemoryRouter><PayModal record={record} onSave={onSave} onClose={vi.fn()} /></MemoryRouter>)
    return onSave
  }
  const setDate = (value: string) => fireEvent.change(screen.getByLabelText('Ngày thanh toán', { selector: 'input' }), { target: { value } })
  const setAmount = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Số tiền (đ)' }), { target: { value } })
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Lưu thanh toán' }))

  it('uses the spec title with the seller name', async () => {
    await backendModal()
    expect(screen.getByText('Ghi thanh toán – PN-2026-0041')).toBeInTheDocument()
    expect(screen.getByText('Người bán: Trang trại Mộc Châu')).toBeInTheDocument()
  })

  it.each([
    ['2026-10-31', 'Ngày thanh toán không được ở tương lai.'],
    ['2026-10-28', 'Ngày thanh toán không được trước ngày phiếu.'],
    ['', 'Ngày thanh toán là bắt buộc.'],
  ])('rejects payment date %s under the field without calling the API', async (date, message) => {
    const onSave = await backendModal()
    setDate(date)
    save()
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it.each([
    ['250001', 'Số tiền không được vượt quá 250.000 đ.'],
    ['0', 'Số tiền phải là số nguyên lớn hơn 0.'],
  ])('rejects amount %s under the field without calling the API', async (amount, message) => {
    const onSave = await backendModal()
    setAmount(amount)
    save()
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('limits reference to 100 and note to 500 characters', async () => {
    await backendModal()
    expect(screen.getByRole('textbox', { name: /Số tham chiếu/ })).toHaveAttribute('maxLength', '100')
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toHaveAttribute('maxLength', '500')
  })

  it('saves a valid payment on the voucher date', async () => {
    const onSave = await backendModal()
    setDate('2026-10-29')
    setAmount('100000')
    save()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-29', amount: 100000 }))
  })
})
