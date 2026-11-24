import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveHerdExit = vi.fn()

vi.mock('../../../src/features/herd-exit/api/index', async (importOriginal) => ({
  ...(({ newExitVoucherId, exitPenShift }) => ({ newExitVoucherId, exitPenShift }))(await importOriginal<typeof import('../../../src/features/herd-exit/api/index')>()),
  herdExitApi: { list: async () => [], get: async () => null, checks: vi.fn() },
  getExitDraftState: (rows: unknown[], id?: string) => ({ type: 'Bán', row: id ? rows.find((row: any) => row.id === id) : undefined }),
  saveHerdExit,
  confirmHerdExit: vi.fn(),
  downloadExitAttachment: vi.fn(),
  removeExitAttachment: vi.fn(),
  cancelHerdExit: vi.fn(),
  dismissHerdExit: vi.fn(),
  listExitBuyers: async () => [],
  listSelectableExitCattle: async () => [],
  pens: { list: async () => [] },
}))

describe('herd-exit required-field validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveHerdExit.mockResolvedValue({ id: 'PX-TEST-1' })
  })

  it('shows the reason error in the active form and does not save a non-sale draft without a reason', async () => {
    const user = userEvent.setup()
    const { default: ExportNew } = await import('../../../src/features/herd-exit/pages/ExportNew')
    render(<MemoryRouter initialEntries={['/herd-exit/new']}><Routes><Route path="/herd-exit/new" element={<ExportNew />} /></Routes></MemoryRouter>)

    await screen.findByText('1. Thông tin phiếu')
    await user.click(screen.getByRole('button', { name: 'Chết / mất' }))
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))

    expect(saveHerdExit).not.toHaveBeenCalled()
    expect(screen.getByText('Vui lòng nhập nguyên nhân.')).toBeInTheDocument()
  })

  it('requires a buyer for a cull voucher', async () => {
    const user = userEvent.setup()
    const { default: ExportNew } = await import('../../../src/features/herd-exit/pages/ExportNew')
    render(<MemoryRouter initialEntries={['/herd-exit/new']}><Routes><Route path="/herd-exit/new" element={<ExportNew />} /></Routes></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: 'Loại thải' }))
    expect(screen.getByRole('combobox', { name: 'Người mua / thương lái' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    expect(screen.getByText('Vui lòng chọn người mua.')).toBeInTheDocument()
    expect(saveHerdExit).not.toHaveBeenCalled()
  })

  it('collects an explicit loss kind and requires carcass disposal only for death', async () => {
    const user = userEvent.setup()
    const { default: ExportNew } = await import('../../../src/features/herd-exit/pages/ExportNew')
    render(<MemoryRouter initialEntries={['/herd-exit/new']}><Routes><Route path="/herd-exit/new" element={<ExportNew />} /></Routes></MemoryRouter>)

    await screen.findByText('1. Thông tin phiếu')
    await user.click(screen.getByRole('button', { name: 'Chết / mất' }))
    expect(screen.getByRole('combobox', { name: 'Loại chết / mất' })).toHaveValue('DIED')
    expect(screen.getByLabelText('Nguyên nhân chết')).toBeInTheDocument()
    expect(screen.getByLabelText('Phương án xử lý xác')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Loại chết / mất' }), 'MISSING')
    expect(screen.getByLabelText('Nguyên nhân mất tích')).toBeInTheDocument()
    expect(screen.queryByLabelText('Phương án xử lý xác')).not.toBeInTheDocument()
  })

  it('TC-13-05: sale without buyer and other without destination are rejected before save', async () => {
    const user = userEvent.setup()
    const { default: ExportNew } = await import('../../../src/features/herd-exit/pages/ExportNew')
    const { unmount } = render(<MemoryRouter initialEntries={['/herd-exit/new']}><Routes><Route path="/herd-exit/new" element={<ExportNew />} /></Routes></MemoryRouter>)

    await screen.findByText('1. Thông tin phiếu')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    expect(screen.getByText('Vui lòng chọn người mua.')).toBeInTheDocument()
    expect(saveHerdExit).not.toHaveBeenCalled()

    unmount()
    render(<MemoryRouter initialEntries={['/herd-exit/new']}><Routes><Route path="/herd-exit/new" element={<ExportNew />} /></Routes></MemoryRouter>)
    await screen.findByText('1. Thông tin phiếu')
    await user.click(screen.getByRole('button', { name: 'Khác' }))
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    expect(screen.getByText('Vui lòng nhập nơi đến.')).toBeInTheDocument()
    expect(saveHerdExit).not.toHaveBeenCalled()
  })
})
