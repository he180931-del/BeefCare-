import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import type { HerdExit } from '../../../src/features/herd-exit/types'

const cancel = vi.hoisted(() => vi.fn())
vi.mock('../../../src/features/herd-exit/api/index', () => ({
  cancelHerdExit: cancel,
  exitCancelDefaults: () => ({ reason: '' }),
  listExitCancelPens: async () => null,
}))
import CancelModal from '../../../src/features/herd-exit/components/CancelModal'

describe('exit cancellation conflict', () => {
  it('retains the reason and popup on 409/Stay, with explicit reload only', async () => {
    const user = userEvent.setup()
    const row: HerdExit = { id: 'PX-2026-0061', backendId: 61, version: 3, status: 'Đã xuất', type: 'Bán', detail: { cows: [] } }
    cancel.mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' }))
    const onClose = vi.fn(), onCancelled = vi.fn(), onReload = vi.fn()
    render(<MemoryRouter><CancelModal row={row} onClose={onClose} onCancelled={onCancelled} onReload={onReload} /></MemoryRouter>)
    await user.type(screen.getByRole('textbox'), 'Ly do huy dang nhap')
    await user.click(screen.getByRole('button', { name: 'Hủy phiếu xuất' }))
    await screen.findByRole('button', { name: 'Tải bản mới nhất' })
    expect(cancel).toHaveBeenCalledWith(row.id, [], expect.objectContaining({ cancelReason: 'Ly do huy dang nhap' }), { expectedVersion: 3, backendId: 61 })
    await user.click(screen.getByRole('button', { name: 'Ở lại' }))
    expect(screen.getByDisplayValue('Ly do huy dang nhap')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(onCancelled).not.toHaveBeenCalled()
    expect(onReload).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})
