import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext } from '../../../src/app/session/sessionContext'
import { financeDemoStore } from '../../../src/features/platform-finance/data/financeDemoStore'
import { backendTransport } from '../../../src/shared/api/backendTransport'

vi.mock('../../../src/features/platform-finance/api/financeApi', async () => {
  const { createFinanceApi } = await vi.importActual<typeof import('../../../src/features/platform-finance/api/financeApi')>('../../../src/features/platform-finance/api/financeApi')
  return { financeApi: createFinanceApi({ mode: 'local', farmId: 0, transport: backendTransport, store: financeDemoStore }) }
})

import ReceiptRoutes from '../../../src/features/platform-finance/pages/ReceiptRoutes'

const pm = { role: 'PM' as const, fullName: 'Đỗ Minh Quân', email: 'quan@beefcare.vn', farmId: 0, farmName: '', logout: async () => {} }

const renderAt = (path = '/nen-tang/bien-nhan') => render(
  <SessionContext.Provider value={pm}>
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/nen-tang/bien-nhan/*" element={<ReceiptRoutes />} /></Routes>
    </MemoryRouter>
  </SessionContext.Provider>,
)

beforeEach(async () => { await financeDemoStore.reset() })

describe('SCR-70 receipt pagination', () => {
  it('returns to the last valid page when a filter shrinks the result set', async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(await screen.findByRole('button', { name: '8' }))
    expect(await screen.findByText('Hiển thị 2 / 37 biên nhận')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Tìm biên nhận'), 'RC-26-0412')

    expect(await screen.findByText('Hiển thị 1 / 1 biên nhận')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'RC-26-0412' })).toBeInTheDocument()
  })

  it('clears a selection that is no longer on the active page', async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(await screen.findByRole('button', { name: '2' }))
    const secondPageReceipt = (await screen.findAllByRole('button', { name: /^RC-/ }))[0]
    const selectedCode = secondPageReceipt.textContent ?? ''
    await user.click(secondPageReceipt)
    expect((await screen.findAllByText(`Biên nhận ${selectedCode} · Chỉ đọc`)).length).toBeGreaterThan(0)

    await user.type(screen.getByLabelText('Tìm biên nhận'), 'RC-26-0412')

    expect((await screen.findAllByText('RC-26-0412')).length).toBeGreaterThan(0)
    expect(screen.queryByText(`Biên nhận ${selectedCode} · Chỉ đọc`)).toBeNull()
  })
})
