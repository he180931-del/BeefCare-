import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveHerdExit = vi.fn()

vi.mock('../../../src/features/herd-exit/api/index', () => ({
  herdExitApi: { list: vi.fn().mockResolvedValue([]), get: vi.fn().mockResolvedValue(null), checks: vi.fn() },
  getExitDraftState: (rows: unknown[], id?: string) => ({ type: 'Bán', row: id ? rows.find((row: any) => row.id === id) : undefined }),
  saveHerdExit,
  confirmHerdExit: vi.fn(),
  downloadExitAttachment: vi.fn(),
  removeExitAttachment: vi.fn(),
  cancelHerdExit: vi.fn(),
  dismissHerdExit: vi.fn(),
  listExitBuyers: vi.fn().mockResolvedValue([]),
  listSelectableExitCattle: vi.fn().mockResolvedValue([]),
  pens: { list: vi.fn().mockResolvedValue([]) },
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
    expect(screen.getByText('Vui lòng nhập lý do xuất.')).toBeInTheDocument()
  })
})
