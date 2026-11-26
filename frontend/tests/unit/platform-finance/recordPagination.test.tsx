import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext } from '../../../src/app/session/sessionContext'
import { financeApi } from '../../../src/features/platform-finance/api/financeApi'
import RecordListPage from '../../../src/features/platform-finance/pages/RecordListPage'

const pm = { role: 'PM' as const, fullName: 'Đỗ Minh Quân', email: 'quan@beefcare.vn', farmId: 0, farmName: '', logout: async () => {} }

const renderPage = () => render(
  <SessionContext.Provider value={pm}>
    <MemoryRouter initialEntries={['/nen-tang/thu-chi']}>
      <Routes><Route path="/nen-tang/thu-chi" element={<RecordListPage />} /></Routes>
    </MemoryRouter>
  </SessionContext.Provider>,
)

describe('SCR-71 phân trang thu chi thủ công', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(financeApi, 'listFarms').mockResolvedValue([])
    vi.spyOn(financeApi, 'listCategories').mockResolvedValue({ income: ['CAT-INCOME'], expense: ['CAT-EXPENSE'] })
  })

  it('điều hướng sang trang kế tiếp và gọi API với trang mới', async () => {
    const listRecords = vi.spyOn(financeApi, 'listRecords').mockImplementation(async (filters = {}) => ({
      rows: [{ recordCode: `FR-${filters.page ?? 1}`, type: 'INCOME', category: 'CAT-INCOME', amountVnd: 100, occurredOn: '2026-11-01', scope: 'GENERAL', farmName: '', state: 'POSTED', description: 'Dòng hiện tại' } as never],
      total: 15,
      page: filters.page ?? 1,
      pageCount: 3,
      counts: { ALL: 15, DRAFT: 0, POSTED: 15, VOID: 0 },
    }))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('FR-1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))

    expect(await screen.findByText('FR-2')).toBeInTheDocument()
    expect(listRecords).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('tự clamp về trang hợp lệ khi kết quả mới không còn trang hiện tại', async () => {
    const listRecords = vi.spyOn(financeApi, 'listRecords').mockImplementation(async (filters = {}) => {
      const page = filters.page ?? 1
      const outOfRange = page > 1
      return {
        rows: outOfRange ? [] : [{ recordCode: 'FR-1', type: 'INCOME', category: 'CAT-INCOME', amountVnd: 100, occurredOn: '2026-11-01', scope: 'GENERAL', farmName: '', state: 'POSTED', description: 'Dòng hiện tại' } as never],
        total: outOfRange ? 5 : 15,
        page,
        pageCount: outOfRange ? 1 : 3,
        counts: { ALL: outOfRange ? 5 : 15, DRAFT: 0, POSTED: outOfRange ? 5 : 15, VOID: 0 },
      }
    })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('FR-1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(await screen.findByText('FR-1')).toBeInTheDocument()
    await waitFor(() => expect(listRecords).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
    expect(screen.queryByText('Không có kết quả phù hợp')).toBeNull()
  })

  it('reset trang 1 khi đổi bộ lọc hoặc tab trạng thái', async () => {
    const listRecords = vi.spyOn(financeApi, 'listRecords').mockImplementation(async (filters = {}) => ({
      rows: [{ recordCode: `FR-${filters.page ?? 1}`, type: 'INCOME', category: 'CAT-INCOME', amountVnd: 100, occurredOn: '2026-11-01', scope: 'GENERAL', farmName: '', state: filters.state || 'POSTED', description: 'Dòng hiện tại' } as never],
      total: 15,
      page: filters.page ?? 1,
      pageCount: 3,
      counts: { ALL: 15, DRAFT: 1, POSTED: 14, VOID: 0 },
    }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('FR-1')
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    await screen.findByText('FR-2')

    await user.selectOptions(screen.getByLabelText('Loại'), 'EXPENSE')
    await waitFor(() => expect(listRecords).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'EXPENSE', page: 1 })))

    await user.click(screen.getByRole('button', { name: /Nháp 1/ }))
    await waitFor(() => expect(listRecords).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'DRAFT', page: 1 })))
  })
})
