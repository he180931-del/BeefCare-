import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HerdExit } from '../../../src/types'

const exitApi = vi.hoisted(() => ({ recordPayment: vi.fn() }))
vi.mock('../../../src/features/herd-exit/api/index', () => ({ herdExitApi: exitApi }))

const localIsoToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const row: HerdExit = {
  id: 'PX-2026-0061', date: '2026-10-29', type: 'Bán', status: 'Đã xuất', who: 'Lò mổ Hà Đông', count: 1,
  weight: 410, total: 1000000, due: 250000, detail: { payments: [], buyer: 'Lò mổ Hà Đông' },
}

afterEach(() => {
  exitApi.recordPayment.mockReset()
  vi.unstubAllEnvs()
})

describe('CollectModal backend defaults', () => {
  it('starts a backend collection with local today and blank reference/note/demo statement', async () => {
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    exitApi.recordPayment.mockResolvedValue(row)
    const { default: CollectModal } = await import('../../../src/features/herd-exit/components/CollectModal')
    const user = userEvent.setup()
    render(<MemoryRouter><CollectModal row={row} onClose={vi.fn()} /></MemoryRouter>)

    expect(screen.queryByText('sao-ke-2210.pdf')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Chọn ngày')).toHaveValue(localIsoToday())
    expect(screen.getAllByRole('textbox').at(-1)).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Lưu khoản thu' }))

    expect(exitApi.recordPayment).toHaveBeenCalledWith(row.id, expect.objectContaining({ date: localIsoToday(), ref: '', note: '' }))
  })
})
