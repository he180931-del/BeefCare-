import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { HerdExit } from '../../../src/features/herd-exit/types'

const state = vi.hoisted(() => ({ get: vi.fn(), voidPayment: vi.fn(), role: 'OWNER', backend: true }))
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/app/session/sessionContext', async original => ({ ...(await original<typeof import('../../../src/app/session/sessionContext')>()), useSession: () => ({ role: state.role }) }))
vi.mock('../../../src/features/herd-exit/api/index', async original => ({
  ...(await original<typeof import('../../../src/features/herd-exit/api/index')>()),
  get exitPaymentVoidEnabled() { return state.backend }, herdExitApi: { get: state.get }, voidExitPayment: state.voidPayment,
  exitCancelLinks: async () => ({ serverChecked: true }), exitVoidCheck: async () => null, listExitCancelPens: async () => [],
}))
import ExportDetail from '../../../src/features/herd-exit/pages/ExportDetail'

const first = { id: 21, version: 2, status: 'RECORDED' as const, date: '2026-10-20', by: 'Owner', method: 'Tiền mặt', ref: '—', amount: 3000000 }
const row: HerdExit = { id: 'PX-1', version: 12, status: 'Đã xuất', type: 'Bán', total: 10000000, collected: 5000000, due: 5000000,
  detail: { payments: [first, { ...first, id: 22, amount: 2000000 }], cows: [{ code: 'BC-1' }], history: [] } }
beforeEach(() => { state.role = 'OWNER'; state.backend = true; state.get.mockReset().mockResolvedValue(structuredClone(row)); state.voidPayment.mockReset().mockResolvedValue({}) })
function page() { return render(<MemoryRouter initialEntries={['/herd-exit/PX-1']}><Routes><Route path="/herd-exit/:id" element={<ExportDetail />} /></Routes></MemoryRouter>) }
it('lets Owner void a collection and shows server totals consistently in detail, collect and voucher-void dialogs', async () => {
  const user = userEvent.setup(); page()
  await user.click((await screen.findAllByRole('button', { name: 'Hủy' }))[0])
  await user.type(screen.getByRole('textbox', { name: /Lý do hủy/ }), 'Thu nhầm')
  state.get.mockResolvedValue({ ...row, collected: 2000000, due: 8000000, detail: { ...row.detail, payments: [{ ...first, status: 'VOIDED', voidReason: 'Thu nhầm' }, row.detail!.payments![1]] } })
  await user.click(screen.getByRole('button', { name: 'Hủy khoản' }))
  expect(state.voidPayment).toHaveBeenCalledWith(21, { reason: 'Thu nhầm', version: 2 })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByText('8.000.000 đ')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Ghi nhận thu tiền' }))
  expect(screen.getAllByText('2.000.000 đ')).toHaveLength(2)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy' }))
  await user.click(screen.getByRole('button', { name: 'Hủy phiếu' }))
  expect(await screen.findByText(/Tiền đã thu 2.000.000 đ vẫn giữ trong lịch sử/)).toBeInTheDocument()
  expect(state.get).toHaveBeenCalledTimes(2)
})
it('hides collection void and recording from Manager', async () => {
  state.role = 'MANAGER'; page(); await screen.findByText(/Phiếu xuất PX-1/)
  expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ghi nhận thu tiền' })).not.toBeInTheDocument()
})
it.each(['Nháp', 'Đã hủy'] as const)('hides collection void on %s', async status => {
  state.get.mockResolvedValue({ ...row, status }); page(); await screen.findByText(/Phiếu xuất PX-1/)
  expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
})
it('hides collection void in demo mode', async () => {
  state.backend = false; page(); await screen.findByText(/Phiếu xuất PX-1/)
  expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
})
it('uses server collection even when the detailed payment rows contain a voided amount', async () => {
  state.get.mockResolvedValue({ ...row, collected: 0, due: 10000000 }); page()
  await screen.findAllByText('10.000.000 đ')
  expect(screen.getByText('Đã thu').parentElement).toHaveTextContent('0 đ')
})
