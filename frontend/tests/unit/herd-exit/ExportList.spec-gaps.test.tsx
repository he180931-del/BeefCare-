import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ExitListResult, HerdExit } from '../../../src/features/herd-exit/types'

const state = vi.hoisted(() => ({ listPage: vi.fn(), role: 'OWNER' }))
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/app/session/sessionContext', async original => ({ ...(await original<typeof import('../../../src/app/session/sessionContext')>()), useSession: () => ({ role: state.role }) }))
vi.mock('../../../src/features/herd-exit/api/index', () => ({ herdExitApi: { listPage: state.listPage } }))
import ExportList from '../../../src/features/herd-exit/pages/ExportList'

const vouchers: HerdExit[] = [
  { id: 'PX-2026-0002', date: '2026-10-21', type: 'Chết / mất', status: 'Chờ xác nhận', who: 'Tiêu chảy cấp', sub: 'Ca sức khỏe HC-0418', count: 1, weightKg: 180, weightEstimated: true, pens: ['A2'], total: null, due: null },
  { id: 'PX-2026-0010', date: '2026-10-15', type: 'Bán', status: 'Đã xuất', who: 'Lò mổ Hà Đông', sub: 'KD-01', count: 4, weightKg: 1380, weightEstimated: false, pens: ['B1', 'B2'], total: 124200000, due: 12400000 },
  { id: 'PX-2026-0001', date: '2026-10-22', type: 'Bán', status: 'Nháp', who: 'Thương lái', count: 3, weightKg: null, total: 1, due: 1 },
  { id: 'PX-2026-0003', date: '2026-09-05', type: 'Chết / mất', status: 'Đã bác', who: 'Báo mất tích', count: 1, weightKg: null, total: null, due: null, reason: 'Đã tìm thấy bò' },
]
const page = (overrides: Partial<ExitListResult> = {}): ExitListResult => ({
  from: '2026-07-01', to: '2026-11-25', vouchers,
  tiles: { cattleExitedByType: { 'Bán': 4, 'Loại thải': 0, 'Chết / mất': 0, 'Khác': 2 }, cattleExited: 6, salesRevenue: 124200000, toCollect: 12400000, vouchersToCollect: 1, awaitingOwner: 3 },
  statusCounts: { ALL: 12, DRAFT: 1, PENDING: 3, CONFIRMED: 5, VOIDED: 2, DISMISSED: 1 },
  ...overrides,
})
beforeEach(() => { state.role = 'OWNER'; state.listPage.mockReset().mockResolvedValue(page()) })
const renderList = () => render(<MemoryRouter><ExportList /></MemoryRouter>)

it('uses the server default period, tiles and status counts, and refetches when the period or type changes', async () => {
  const user = userEvent.setup()
  renderList()
  expect(await screen.findByText('Con đã xuất (01/07 – 25/11)')).toBeInTheDocument()
  expect(state.listPage).toHaveBeenCalledWith({ from: '', to: '', type: '' })
  expect(screen.getByText('Bán 4 · Khác 2')).toBeInTheDocument()
  expect(screen.getByText('124.200.000 đ')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tất cả (12)' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Đã hủy / bác (3)' })).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Kỳ nhanh'), 'year')
  await waitFor(() => expect(state.listPage).toHaveBeenLastCalledWith({ from: expect.stringMatching(/^\d{4}-01-01$/), to: expect.any(String), type: '' }))
  await user.selectOptions(screen.getByLabelText('Loại xuất'), 'Loại thải')
  await waitFor(() => expect(state.listPage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'Loại thải' })))
})

it('shows MSG-COM-11 and does not refetch when the start date is after the end date', async () => {
  renderList()
  await screen.findByText('Con đã xuất (01/07 – 25/11)')
  const calls = state.listPage.mock.calls.length
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-12-01' } })
  expect(screen.getByRole('alert')).toHaveTextContent('Ngày bắt đầu không được sau ngày kết thúc.')
  expect(state.listPage).toHaveBeenCalledTimes(calls)
})

it('links each voucher code to its screen, shows weight, pens and close reason, and sorts by date / code', async () => {
  const user = userEvent.setup()
  renderList()
  const table = (await screen.findByText('PX-2026-0010')).closest('table')!
  expect(screen.getByRole('link', { name: 'PX-2026-0001' })).toHaveAttribute('href', '/herd-exit/new?id=PX-2026-0001')
  expect(screen.getByRole('link', { name: 'PX-2026-0002' })).toHaveAttribute('href', '/herd-exit/PX-2026-0002')
  expect(within(table).getByText('~180 kg')).toBeInTheDocument()
  expect(within(table).getByText('1.380 kg')).toBeInTheDocument()
  expect(within(table).getByText('Chuồng B1, B2')).toBeInTheDocument()
  expect(within(table).getByText('Đã tìm thấy bò')).toHaveAttribute('title', 'Đã tìm thấy bò')
  const codes = () => within(table).getAllByRole('link').map((link) => link.textContent)
  expect(codes()).toEqual(['PX-2026-0001', 'PX-2026-0002', 'PX-2026-0010', 'PX-2026-0003'])
  await user.click(screen.getByRole('button', { name: 'Sắp xếp theo mã phiếu' }))
  expect(codes()).toEqual(['PX-2026-0001', 'PX-2026-0002', 'PX-2026-0003', 'PX-2026-0010'])
  await user.click(screen.getByRole('button', { name: 'Sắp xếp theo mã phiếu' }))
  expect(codes()).toEqual(['PX-2026-0010', 'PX-2026-0003', 'PX-2026-0002', 'PX-2026-0001'])
})

it('shows a Vietnamese load error with retry instead of the raw error', async () => {
  const user = userEvent.setup()
  state.listPage.mockReset().mockRejectedValueOnce({ detail: 'boom' }).mockResolvedValue(page())
  renderList()
  expect(await screen.findByText('Không tải được danh sách phiếu xuất. Vui lòng thử lại.')).toBeInTheDocument()
  expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('PX-2026-0010')).toBeInTheDocument()
})
