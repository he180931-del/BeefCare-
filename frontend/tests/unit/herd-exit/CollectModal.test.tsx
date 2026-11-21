import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HerdExit } from '../../../src/features/herd-exit/types'

const exitApi = vi.hoisted(() => ({ recordPayment: vi.fn() }))
// The defaults come from the real adapter, evaluated after the test switches to the backend.
vi.mock('../../../src/features/herd-exit/api/index', async (importOriginal) => ({
  herdExitApi: exitApi,
  exitCollectionDefaults: (await importOriginal<typeof import('../../../src/features/herd-exit/api/index')>()).exitCollectionDefaults,
}))

const row: HerdExit = {
  id: 'PX-2026-0061', date: '2026-10-29', type: 'Bán', status: 'Đã xuất', who: 'Lò mổ Hà Đông', count: 1,
  weight: 410, total: 1000000, due: 250000, detail: { payments: [], buyer: 'Lò mổ Hà Đông' },
}

afterEach(() => {
  vi.useRealTimers()
  exitApi.recordPayment.mockReset()
  vi.unstubAllEnvs()
})

describe('CollectModal backend defaults', () => {
  it('starts a backend collection with the current UTC+7 date and blank reference/note/demo statement', async () => {
    vi.setSystemTime(new Date('2026-10-29T17:00:00Z'))
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    exitApi.recordPayment.mockResolvedValue(row)
    const { default: CollectModal } = await import('../../../src/features/herd-exit/components/CollectModal')
    const user = userEvent.setup()
    render(<MemoryRouter><CollectModal row={row} onClose={vi.fn()} /></MemoryRouter>)

    expect(screen.queryByText('sao-ke-2210.pdf')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Chọn ngày')).toHaveValue('2026-10-30')
    expect(screen.getAllByRole('textbox').at(-1)).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Lưu khoản thu' }))

    expect(exitApi.recordPayment).toHaveBeenCalledWith(row.id, expect.objectContaining({ date: '2026-10-30', ref: '', note: '' }))
  })
})
