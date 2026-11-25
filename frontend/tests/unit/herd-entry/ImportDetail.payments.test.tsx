import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import type { HerdEntry } from '../../../src/features/herd-entry/types'

const state = vi.hoisted(() => ({ get: vi.fn(), voidPayment: vi.fn(), role: 'OWNER', backend: true }))
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/app/session/sessionContext', async original => ({ ...(await original<typeof import('../../../src/app/session/sessionContext')>()), useSession: () => ({ role: state.role }) }))
vi.mock('../../../src/features/herd-entry/api/index', async original => ({
  ...(await original<typeof import('../../../src/features/herd-entry/api/index')>()),
  get entryPaymentVoidEnabled() { return state.backend }, herdEntryApi: { get: state.get }, voidEntryPayment: state.voidPayment,
}))
import ImportDetail from '../../../src/features/herd-entry/pages/ImportDetail'
import PayModal from '../../../src/features/herd-entry/components/PayModal'
import CancelModal from '../../../src/features/herd-entry/components/CancelModal'

const first = { id: 11, version: 0, status: 'RECORDED' as const, date: '2026-10-20', by: 'Owner', method: 'Tiền mặt', ref: '—', amount: 3000000, note: 'Đợt đầu' }
const row: HerdEntry = { id: 'PN-1', version: 9, date: '2026-10-20', status: 'Đã nhập', total: 10000000, paid: 5000000, debt: 5000000,
  detail: { payments: [first, { ...first, id: 12, version: 2, amount: 2000000 }], cows: [], history: [] } }
const latest: HerdEntry = { ...row, version: 10, paid: 2000000, debt: 8000000,
  detail: { ...row.detail, payments: [{ ...first, status: 'VOIDED', voidReason: 'Nhập nhầm', voidedAt: '2026-11-22T18:05:00Z' }, row.detail!.payments![1]] } }
beforeEach(() => { state.role = 'OWNER'; state.backend = true; state.get.mockReset().mockResolvedValue(structuredClone(row)); state.voidPayment.mockReset().mockResolvedValue({}) })
function page() { return render(<MemoryRouter initialEntries={['/herd-entry/PN-1']}><Routes><Route path="/herd-entry/:id" element={<ImportDetail />} /></Routes></MemoryRouter>) }
async function open() { const user = userEvent.setup(); page(); const buttons = await screen.findAllByRole('button', { name: 'Hủy' }); await user.click(buttons[0]); return user }

it.each(['OWNER', 'MANAGER'])('lets %s void a payment with its opened payment version and refetch server totals', async role => {
  state.role = role
  const user = await open()
  expect(screen.getByText(/Hủy khoản thanh toán 3.000.000 đ ngày 20\/10\/2026/)).toBeInTheDocument()
  const submit = screen.getByRole('button', { name: 'Hủy khoản' })
  expect(submit).toBeDisabled()
  const reason = screen.getByRole('textbox', { name: /Lý do hủy/ })
  fireEvent.change(reason, { target: { value: 'x'.repeat(501) } }); expect(submit).toBeDisabled()
  fireEvent.change(reason, { target: { value: '  Nhập nhầm  ' } })
  state.get.mockResolvedValue(latest)
  await user.click(submit)
  expect(state.voidPayment).toHaveBeenCalledWith(11, { reason: 'Nhập nhầm', version: 0 })
  await waitFor(() => expect(state.get).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByText('Đã hủy khoản thanh toán 3.000.000 đ.')).toBeInTheDocument()
  expect(screen.getByText('8.000.000 đ')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ghi thanh toán' })).toBeInTheDocument()
  const voided = screen.getByRole('row', { name: /Nhập nhầm/ })
  expect(within(voided).getByText('Đã hủy')).toBeInTheDocument()
  expect(within(voided).getByText('3.000.000')).toHaveClass('line-through')
  expect(within(voided).getByText(/23\/11\/2026 01:05/)).toBeInTheDocument()
  expect(within(voided).queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
})
it('retains reason on 409 and Stay, never refreshes the snapshot on retry, and reloads only explicitly', async () => {
  state.voidPayment.mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' }))
  const user = await open()
  await user.type(screen.getByRole('textbox', { name: /Lý do hủy/ }), 'Lý do đang nhập')
  await user.click(screen.getByRole('button', { name: 'Hủy khoản' }))
  await user.click(await screen.findByRole('button', { name: 'Ở lại' }))
  expect(screen.getByRole('textbox', { name: /Lý do hủy/ })).toHaveValue('Lý do đang nhập')
  expect(state.get).toHaveBeenCalledTimes(1)
  state.voidPayment.mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' }))
  await user.click(screen.getByRole('button', { name: 'Hủy khoản' }))
  await screen.findByRole('button', { name: 'Tải bản mới nhất' })
  expect(state.voidPayment.mock.calls).toEqual([[11, { reason: 'Lý do đang nhập', version: 0 }], [11, { reason: 'Lý do đang nhập', version: 0 }]])
  expect(state.get).toHaveBeenCalledTimes(1)
  state.get.mockResolvedValue(latest)
  await user.click(screen.getByRole('button', { name: 'Tải bản mới nhất' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(state.get).toHaveBeenCalledTimes(2)
})
it('keeps the popup and reason after a permission failure', async () => {
  state.voidPayment.mockRejectedValue(new BackendError(403, { code: 'MSG-COM-01' }))
  const user = await open()
  await user.type(screen.getByRole('textbox', { name: /Lý do hủy/ }), 'Ghi nhầm')
  await user.click(screen.getByRole('button', { name: 'Hủy khoản' }))
  expect(await screen.findByText(/không có quyền/i)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /Lý do hủy/ })).toHaveValue('Ghi nhầm')
  expect(state.get).toHaveBeenCalledTimes(1)
})
it('sends one request and locks the form while a void is in flight', async () => {
  let finish!: () => void
  state.voidPayment.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const user = await open()
  await user.type(screen.getByRole('textbox', { name: /Lý do hủy/ }), 'Nhập nhầm')
  await user.dblClick(screen.getByRole('button', { name: 'Hủy khoản' }))
  expect(state.voidPayment).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('textbox', { name: /Lý do hủy/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Đang hủy…' })).toBeDisabled()
  finish()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
it('uses the same server paid amount in the recording and whole-voucher void dialogs', async () => {
  const view = render(<MemoryRouter><PayModal record={latest} onSave={vi.fn()} onClose={vi.fn()} /></MemoryRouter>)
  expect(screen.getByText('2.000.000 đ')).toBeInTheDocument()
  expect(screen.getByText('8.000.000 đ')).toBeInTheDocument()
  view.unmount()
  render(<MemoryRouter><CancelModal record={latest} onConfirm={vi.fn()} onClose={vi.fn()} /></MemoryRouter>)
  expect(await screen.findByText(/Khoản đã thanh toán 2.000.000 đ vẫn giữ trong lịch sử/)).toBeInTheDocument()
})
it.each(['TECHNICIAN', ''])('hides entry payment commands from role %s', async role => {
  state.role = role; page(); await screen.findByText('PN-1', { exact: false })
  expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ghi thanh toán' })).not.toBeInTheDocument()
})
it.each(['Nháp', 'Đã hủy'] as const)('hides payment void on a %s voucher', async status => {
  state.get.mockResolvedValue({ ...row, status }); page(); await screen.findByText(/Phiếu nhập PN-1/)
  expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
})
it('hides void in local mode and for missing ids/versions or already voided payments', async () => {
  state.backend = false; const view = page(); await screen.findByText(/Phiếu nhập PN-1/)
  expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
  view.unmount(); state.backend = true
  state.get.mockResolvedValue({ ...row, detail: { payments: [{ ...first, id: undefined }, { ...first, id: 12, version: undefined }, { ...first, id: 13, status: 'VOIDED' }] } })
  page(); await screen.findByText(/Phiếu nhập PN-1/)
  expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
})
it('renders duplicate references without duplicate React keys', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  try { page(); await screen.findAllByText('Đợt đầu'); expect(errors.mock.calls.filter(([message]) => String(message).includes('same key'))).toEqual([]) }
  finally { errors.mockRestore() }
})
