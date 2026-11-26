import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HerdExit } from '../../../src/features/herd-exit/types'
import { BackendError } from '../../../src/shared/api/backendClient'

const exitApi = vi.hoisted(() => ({ recordPayment: vi.fn() }))
// The defaults come from the real adapter, evaluated after the test switches to the backend.
vi.mock('../../../src/features/herd-exit/api/index', async (importOriginal) => ({
  herdExitApi: exitApi,
  exitCollectionDefaults: (await importOriginal<typeof import('../../../src/features/herd-exit/api/index')>()).exitCollectionDefaults,
}))

const row: HerdExit = {
  id: 'PX-2026-0061', backendId: 61, version: 3, date: '2026-10-29', type: 'Bán', status: 'Đã xuất', who: 'Lò mổ Hà Đông', count: 1,
  weight: 410, total: 1000000, due: 250000, detail: { payments: [], buyer: 'Lò mổ Hà Đông' },
}

afterEach(() => {
  vi.useRealTimers()
  exitApi.recordPayment.mockReset()
  vi.unstubAllEnvs()
})

describe('CollectModal backend defaults', () => {
  it('keeps the collection popup and note after a version conflict without retry or reload', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    exitApi.recordPayment.mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' }))
    const { default: CollectModal } = await import('../../../src/features/herd-exit/components/CollectModal')
    const user = userEvent.setup()
    const onClose = vi.fn(), onReload = vi.fn()
    render(<MemoryRouter><CollectModal row={row} onClose={onClose} onReload={onReload} /></MemoryRouter>)
    const note = screen.getByRole('textbox', { name: 'Ghi chú' })
    await user.type(note, 'Khoan thu dang nhap')
    await user.click(screen.getByLabelText('Tiền mặt'))
    await user.click(screen.getByRole('button', { name: 'Lưu khoản thu' }))
    await screen.findByRole('button', { name: 'Tải bản mới nhất' })
    expect(exitApi.recordPayment).toHaveBeenCalledWith(row.id, expect.objectContaining({ note: 'Khoan thu dang nhap' }), { voucherVersion: 3, backendId: 61 })
    await user.click(screen.getByRole('button', { name: 'Ở lại' }))
    expect(screen.getByDisplayValue('Khoan thu dang nhap')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(onReload).not.toHaveBeenCalled()
    expect(exitApi.recordPayment).toHaveBeenCalledTimes(1)
  })

  it('starts a backend collection with the current UTC+7 date and blank reference/note/demo statement', async () => {
    vi.setSystemTime(new Date('2026-10-29T17:00:00Z'))
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    exitApi.recordPayment.mockResolvedValue(row)
    const { default: CollectModal } = await import('../../../src/features/herd-exit/components/CollectModal')
    const user = userEvent.setup()
    render(<MemoryRouter><CollectModal row={row} onClose={vi.fn()} onReload={vi.fn()} /></MemoryRouter>)

    expect(screen.queryByText('sao-ke-2210.pdf')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Chọn ngày thu')).toHaveValue('2026-10-30')
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toHaveValue('')
    await user.click(screen.getByLabelText('Chuyển khoản'))
    await user.click(screen.getByRole('button', { name: 'Lưu khoản thu' }))

    expect(exitApi.recordPayment).toHaveBeenCalledWith(row.id, expect.objectContaining({ date: '2026-10-30', ref: '', note: '' }), { voucherVersion: 3, backendId: 61 })
  })

  it('titles the popup per spec, has no preselected method and validates before calling the API', async () => {
    vi.setSystemTime(new Date('2026-10-30T03:00:00Z'))
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    const { default: CollectModal } = await import('../../../src/features/herd-exit/components/CollectModal')
    const user = userEvent.setup()
    render(<MemoryRouter><CollectModal row={row} onClose={vi.fn()} onReload={vi.fn()} /></MemoryRouter>)
    expect(screen.getByText('Ghi thu tiền – PX-2026-0061')).toBeInTheDocument()
    expect(screen.getByLabelText('Tiền mặt')).not.toBeChecked()
    expect(screen.getByLabelText('Chuyển khoản')).not.toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Tham chiếu' })).toHaveAttribute('maxlength', '100')
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toHaveAttribute('maxlength', '500')
    await user.click(screen.getByRole('button', { name: 'Lưu khoản thu' }))
    expect(screen.getByText('Hình thức là bắt buộc.')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Tiền mặt'))
    const date = screen.getByLabelText('Chọn ngày thu')
    fireEvent.change(date, { target: { value: '2026-10-31' } })
    expect(screen.getByText('Thời điểm không được ở tương lai.')).toBeInTheDocument()
    fireEvent.change(date, { target: { value: '2026-10-28' } })
    expect(screen.getByText('Ngày thu không hợp lệ: không được trước ngày xuất 29/10/2026.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu khoản thu' }))
    expect(exitApi.recordPayment).not.toHaveBeenCalled()
    fireEvent.change(date, { target: { value: '2026-10-30' } })
    const amount = screen.getByDisplayValue('250.000')
    await user.clear(amount)
    await user.type(amount, '300000')
    expect(screen.getByText('Số tiền không được vượt quá 250.000 đ.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu khoản thu' }))
    expect(exitApi.recordPayment).not.toHaveBeenCalled()
  })

  it('reports MSG-FE06-14 after saving', async () => {
    vi.setSystemTime(new Date('2026-10-30T03:00:00Z'))
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    exitApi.recordPayment.mockResolvedValue({ ...row, due: 0 })
    const { default: CollectModal } = await import('../../../src/features/herd-exit/components/CollectModal')
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<MemoryRouter><CollectModal row={row} onClose={vi.fn()} onSaved={onSaved} onReload={vi.fn()} /></MemoryRouter>)
    await user.click(screen.getByLabelText('Tiền mặt'))
    await user.click(screen.getByRole('button', { name: 'Lưu khoản thu' }))
    expect(onSaved).toHaveBeenCalledWith('Đã ghi 250.000 đ cho phiếu PX-2026-0061. Còn lại: 0 đ.')
  })
})
