import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HerdExit } from '../../../src/types'

vi.mock('../../../src/features/herd-exit/api/index', () => ({ herdExitApi: { recordPayment: vi.fn() } }))

const row: HerdExit = {
  id: 'PX-2026-0007', date: '2026-10-29', type: 'Bán', status: 'Đã xuất', who: 'Lò mổ Hà Đông', count: 1,
  weight: 410, total: 1000000, due: 250000, detail: { payments: [], buyer: 'Lò mổ Hà Đông' },
}

afterEach(() => vi.unstubAllEnvs())

describe('CollectModal local statement preview', () => {
  it('shows a visible statement preview and lets the user close it', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'local')
    const { default: CollectModal } = await import('../../../src/features/herd-exit/components/CollectModal')
    const user = userEvent.setup()
    render(<MemoryRouter><CollectModal row={row} onClose={vi.fn()} /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Xem tệp sao-ke-2210.pdf' }))
    expect(screen.getByRole('status')).toHaveTextContent('Sao kê chuyển khoản · dữ liệu cục bộ')
    expect(screen.getByRole('status')).toHaveTextContent('250.000 đ')

    await user.click(screen.getByRole('button', { name: 'Đóng xem trước' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
