import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import CashFlowReportPage from '../../../src/features/farm-overview/pages/CashFlowReportPage'
import { cashFlowReportApi } from '../../../src/features/farm-overview/api/cashFlowReportApi'
import type { FarmCashFlowView } from '../../../src/features/farm-overview/api/cashFlowReportApi'

const session = (role: Session['role'], farmRoles?: Session['farmRoles']): Session => ({ role, fullName: 'Nguyễn Văn Hùng', email: 'owner@example.test', farmId: 7, farmName: 'Trại Yên Bài', farmRoles, logout: async () => {} })

const view: FarmCashFlowView = {
  generatedAt: '2026-11-26T05:00:00Z', totalIncome: 125000, totalExpense: 40000, netCashFlow: 85000, totalElements: 1,
  items: [{ id: 'HERD_EXIT:91', source: 'HERD_EXIT', direction: 'IN', cashDate: '2026-11-24', amountVnd: 125000, documentId: 45, documentCode: 'PX-2026-0045', method: 'CASH' }],
}

const renderAt = (role: Session['role'] = 'OWNER', farmRoles?: Session['farmRoles']) => render(
  <SessionContext.Provider value={session(role, farmRoles)}><MemoryRouter initialEntries={['/bao-cao-thu-chi']}><CashFlowReportPage /></MemoryRouter></SessionContext.Provider>,
)

describe('farm cash flow report', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('applies controlled filters only after submit, shows source rows and opens the source voucher', async () => {
    const user = userEvent.setup()
    const getReport = vi.spyOn(cashFlowReportApi, 'getReport').mockResolvedValue(view)
    renderAt()

    expect(await screen.findByRole('heading', { name: 'Báo cáo thu chi' })).toBeInTheDocument()
    expect(screen.getByText(/Dòng tiền của Trại Yên Bài/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Báo cáo quản lý' })).toHaveAttribute('href', '/bao-cao')
    expect(screen.getByRole('link', { name: 'Báo cáo thu chi' })).toHaveAttribute('href', '/bao-cao-thu-chi')

    const source = screen.getByRole('combobox', { name: 'Nguồn' })
    await user.selectOptions(source, 'HERD_EXIT')
    expect(getReport).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    await waitFor(() => expect(getReport).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'HERD_EXIT', page: 0 })))

    expect((await screen.findAllByText((text) => text.includes('125.000'))).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Thu xuất đàn').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Xem chứng từ PX-2026-0045' }).every((link) => link.getAttribute('href') === '/herd-exit/45')).toBe(true)
  })

  it('hides subscription sources from managers and distinguishes retryable errors from empty results', async () => {
    const getReport = vi.spyOn(cashFlowReportApi, 'getReport')
      .mockRejectedValueOnce(new Error('Không tải được báo cáo'))
      .mockResolvedValueOnce({ ...view, totalIncome: 0, totalExpense: 0, netCashFlow: 0, totalElements: 0, items: [] })
    renderAt('MANAGER')

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được báo cáo')
    expect(screen.queryByRole('option', { name: 'Gói dịch vụ' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Không có khoản phù hợp trong kỳ đã chọn.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getReport).toHaveBeenCalledTimes(2)
  })

  it('uses the role held in the selected farm when an account has different farm roles', async () => {
    vi.spyOn(cashFlowReportApi, 'getReport').mockResolvedValue(view)
    renderAt('OWNER', { 7: 'MANAGER', 11: 'OWNER' })

    expect(await screen.findByRole('heading', { name: 'Báo cáo thu chi' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Gói dịch vụ' })).not.toBeInTheDocument()
  })

  it('uses stable page filters and navigates to the next page without changing the period', async () => {
    const getReport = vi.spyOn(cashFlowReportApi, 'getReport').mockResolvedValue({ ...view, totalElements: 21 })
    const user = userEvent.setup()
    renderAt()

    await waitFor(() => expect(getReport).toHaveBeenCalledTimes(1))
    const from = screen.getByLabelText('Từ ngày') as HTMLInputElement
    const to = screen.getByLabelText('Đến ngày') as HTMLInputElement
    const expectedPeriod = [from.value, to.value]
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))

    await waitFor(() => expect(getReport).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, from: expectedPeriod[0], to: expectedPeriod[1] })))
    expect(getReport).toHaveBeenCalledTimes(2)
  })
})
