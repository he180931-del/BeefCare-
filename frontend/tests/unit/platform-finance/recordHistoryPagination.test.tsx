import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext } from '../../../src/app/session/sessionContext'
import { financeApi } from '../../../src/features/platform-finance/api/financeApi'
import RecordFormPage from '../../../src/features/platform-finance/pages/RecordFormPage'

const pm = { role: 'PM' as const, fullName: 'Đỗ Minh Quân', email: 'quan@beefcare.vn', farmId: 0, farmName: '', logout: async () => {} }
const history = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, action: `Thao tác ${index + 1}`, changedAt: `2026-11-${String(index + 1).padStart(2, '0')}T10:00:00+07:00`, actor: 'PM' }))

const renderPage = () => render(
  <SessionContext.Provider value={pm}>
    <MemoryRouter initialEntries={['/nen-tang/thu-chi/FR-0001']}>
      <Routes><Route path="/nen-tang/thu-chi/:code" element={<RecordFormPage />} /></Routes>
    </MemoryRouter>
  </SessionContext.Provider>,
)

describe('SCR-72 phân trang lịch sử thao tác', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(financeApi, 'listFarms').mockResolvedValue([])
    vi.spyOn(financeApi, 'listCategories').mockResolvedValue({ income: ['CAT-INCOME'], expense: ['CAT-EXPENSE'] })
    vi.spyOn(financeApi, 'listBankTransactions').mockResolvedValue([])
    vi.spyOn(financeApi, 'getRecord').mockResolvedValue({
      record: { recordCode: 'FR-0001', type: 'EXPENSE', category: 'CAT-EXPENSE', amountVnd: 100, occurredOn: '2026-10-01', scope: 'GENERAL', farmId: null, farmName: '', documentNumber: '', description: 'Khoản test', sourceType: 'MANUAL', sourceReference: '', sourceEvidenceId: null, state: 'DRAFT', version: 1, createdAt: '2026-10-01T10:00:00+07:00', createdBy: 'PM', history },
      history,
    } as never)
  })

  it('hiển thị 5 thao tác mỗi trang và chuyển trang bằng Pagination chung', async () => {
    const user = userEvent.setup()
    renderPage()

    expect((await screen.findAllByText(/Thao tác 1/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Thao tác 5/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/^Thao tác 6 ·/)).toBeNull()
    expect(screen.getByText('Hiển thị 5 / 11 thao tác')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect((await screen.findAllByText(/^Thao tác 6 ·/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^Thao tác 10 ·/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/^Thao tác 1 ·/)).toBeNull()
  })

  it('clamp về trang hợp lệ khi lịch sử thay đổi và reset khi đổi record', async () => {
    const user = userEvent.setup()
    const getRecord = vi.mocked(financeApi.getRecord)
    renderPage()
    await screen.findAllByText(/Thao tác 1/)
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect((await screen.findAllByText(/^Thao tác 11 ·/)).length).toBeGreaterThan(0)

    getRecord.mockResolvedValueOnce({
      record: { recordCode: 'FR-0001', type: 'EXPENSE', category: 'CAT-EXPENSE', amountVnd: 100, occurredOn: '2026-10-01', scope: 'GENERAL', farmId: null, farmName: '', documentNumber: '', description: 'Khoản test', sourceType: 'MANUAL', sourceReference: '', sourceEvidenceId: null, state: 'DRAFT', version: 2, createdAt: '2026-10-01T10:00:00+07:00', createdBy: 'PM', history: history.slice(0, 3) },
      history: history.slice(0, 3),
    } as never)
    vi.spyOn(financeApi, 'saveDraft').mockResolvedValue({ recordCode: 'FR-0001' } as never)
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(screen.queryByText(/^Thao tác 11 ·/)).toBeNull())
    await waitFor(() => expect(getRecord).toHaveBeenCalled())
  })
})
