import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { HerdExit } from '../../../src/features/herd-exit/types'

const state = vi.hoisted(() => ({ get: vi.fn(), cancel: vi.fn(), role: 'OWNER' }))
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/app/session/sessionContext', async original => ({ ...(await original<typeof import('../../../src/app/session/sessionContext')>()), useSession: () => ({ role: state.role }) }))
vi.mock('../../../src/features/herd-exit/api/index', async original => ({
  ...(await original<typeof import('../../../src/features/herd-exit/api/index')>()),
  exitPaymentVoidEnabled: true, herdExitApi: { get: state.get }, cancelHerdExit: state.cancel,
  exitCancelLinks: async () => ({ serverChecked: true }), exitVoidCheck: async () => null, listExitCancelPens: async () => [], exitCancelDefaults: () => ({ reason: '' }),
}))
import ExportDetail from '../../../src/features/herd-exit/pages/ExportDetail'

const sold: HerdExit = {
  id: 'PX-2026-0007', backendId: 7, version: 4, status: 'Đã xuất', type: 'Bán', date: '2026-10-15', who: 'Lò mổ Hà Đông', count: 2, weightKg: 690, weightEstimated: true, total: 1000, due: 0,
  detail: {
    buyer: 'Lò mổ Hà Đông', buyerPhone: '0243 555 018', createdAt: '2026-10-14T13:30:00Z', confirmedBy: 'An', confirmedAt: '2026-10-15T00:10:00Z',
    cows: [
      { code: 'BC-1', tag: 'VN-1', breed: 'Zebu đỏ', sex: 'Đực', weight: 352, weightBasis: 'MEASURED', barn: 'B1', amount: 500, current: 'EXITED' },
      { code: 'BC-2', tag: 'VN-2', breed: 'Lai Sind', sex: '—', weight: 338, weightBasis: 'ESTIMATED', estimated: true, barn: 'B1', amount: 500, current: 'EXITED' },
    ],
    history: [{ time: '2026-10-14T13:30:00Z', actor: 'An', text: 'Tạo phiếu' }, { time: '2026-10-14T13:30:00Z', actor: 'An', text: 'Tạo phiếu' }],
  },
}
beforeEach(() => { state.role = 'OWNER'; state.get.mockReset().mockResolvedValue(structuredClone(sold)); state.cancel.mockReset() })
const open = () => render(<MemoryRouter initialEntries={['/herd-exit/PX-2026-0007']}><Routes><Route path="/herd-exit/:id" element={<ExportDetail />} /></Routes></MemoryRouter>)

it('shows buyer, creation and confirmation times, cattle links, weight basis and history with actor', async () => {
  open()
  await screen.findByText('Phiếu xuất PX-2026-0007')
  expect(screen.getByText('Người mua')).toBeInTheDocument()
  expect(screen.getByText('14/10/2026 20:30')).toBeInTheDocument()
  expect(screen.getByText('An · 15/10/2026 07:10')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'BC-1' })).toHaveAttribute('href', '/cattle/BC-1')
  expect(screen.getByText('352 kg · Đo')).toBeInTheDocument()
  expect(screen.getByText('~338 kg · UT')).toBeInTheDocument()
  expect(screen.getByText('Lai Sind · —')).toBeInTheDocument()
  expect(screen.getAllByText('14/10 20:30 · An · Tạo phiếu')).toHaveLength(2)
  expect(screen.getByText(/Hủy phiếu đưa cả 2 con về ACTIVE\.$/)).toBeInTheDocument()
  expect(screen.queryByText(/GBR-26/)).not.toBeInTheDocument()
})

it('shows "Nơi đến" for an Other voucher', async () => {
  state.get.mockResolvedValue({ ...sold, type: 'Khác', who: 'Trại giống Ba Vì', total: null, detail: { ...sold.detail, buyer: '', destination: 'Trại giống Ba Vì' } })
  open()
  await screen.findByText('Phiếu xuất PX-2026-0007')
  expect(screen.getByText('Nơi đến')).toBeInTheDocument()
  expect(screen.queryByText('Người mua')).not.toBeInTheDocument()
  expect(screen.queryByText('Liên hệ')).not.toBeInTheDocument()
})

it.each([['Đã bác', 'Bác bởi', 'Lý do bác'], ['Đã hủy', 'Hủy bởi', 'Lý do hủy']] as const)('shows who closed a %s voucher and why, without the void button', async (status, by, reasonLabel) => {
  state.get.mockResolvedValue({ ...sold, status, reason: 'Khách trả lại', cancelReason: 'Khách trả lại', detail: { ...sold.detail, closedBy: 'Bình', closedAt: '2026-10-16T02:00:00Z' } })
  open()
  await screen.findByText('Phiếu xuất PX-2026-0007')
  expect(screen.getByText(by)).toBeInTheDocument()
  expect(screen.getByText('Bình · 16/10/2026 09:00')).toBeInTheDocument()
  expect(screen.getByText(reasonLabel)).toBeInTheDocument()
  expect(screen.getByText('Khách trả lại')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hủy phiếu' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Hủy phiếu đưa cả/)).not.toBeInTheDocument()
})

it('hides the void button from a Manager', async () => {
  state.role = 'MANAGER'
  open()
  await screen.findByText('Phiếu xuất PX-2026-0007')
  expect(screen.queryByRole('button', { name: 'Hủy phiếu' })).not.toBeInTheDocument()
})

it('after voiding shows MSG-FE13-05 and the review list per cattle', async () => {
  const user = userEvent.setup()
  state.cancel.mockResolvedValue({
    voucher: { ...sold, status: 'Đã hủy' }, message: 'Đã hủy phiếu PX-2026-0007. 2 con quay lại đàn. Các mục bị hủy khi xuất được liệt kê để xem lại.',
    reviewList: [{ cattleId: 1, cattleCode: 'BC-1', cancelledDoseIds: [11, 12], cancelledReminderIds: [21], closedCaseIds: [31], closedPregnancyId: null, pendingCalfIds: [] }],
  })
  open()
  await user.click(await screen.findByRole('button', { name: 'Hủy phiếu' }))
  await user.type(screen.getByRole('textbox', { name: /Lý do hủy/ }), 'Khách trả lại')
  await user.click(screen.getByRole('button', { name: 'Hủy phiếu xuất' }))
  expect(await screen.findByText('Đã hủy phiếu PX-2026-0007. 2 con quay lại đàn. Các mục bị hủy khi xuất được liệt kê để xem lại.')).toBeInTheDocument()
  const review = screen.getByRole('list', { name: 'Cần xem lại sau khi hủy' })
  expect(within(review).getByRole('link', { name: '2 mũi tiêm đã hủy' })).toHaveAttribute('href', '/cattle/BC-1?tab=vaccine')
  expect(within(review).getByText('1 nhắc việc đã hủy')).toBeInTheDocument()
  expect(within(review).getByRole('link', { name: '1 ca sức khỏe đã đóng' })).toHaveAttribute('href', '/cattle/BC-1?tab=health')
})

it('shows a notice handed over by navigation once', async () => {
  render(<MemoryRouter initialEntries={[{ pathname: '/herd-exit/PX-2026-0007', state: { notice: 'Đã xác nhận phiếu PX-2026-0007: 2 con đã rời đàn.' } }]}><Routes><Route path="/herd-exit/:id" element={<ExportDetail />} /></Routes></MemoryRouter>)
  expect(await screen.findByText('Đã xác nhận phiếu PX-2026-0007: 2 con đã rời đàn.')).toBeInTheDocument()
})
