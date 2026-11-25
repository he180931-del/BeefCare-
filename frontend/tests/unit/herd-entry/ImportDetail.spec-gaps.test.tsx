import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { HerdEntry } from '../../../src/features/herd-entry/types'

const state = vi.hoisted(() => ({ get: vi.fn(), recordPayment: vi.fn(), voidEntry: vi.fn(), check: vi.fn() }))
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/app/session/sessionContext', async original => ({ ...(await original<typeof import('../../../src/app/session/sessionContext')>()), useSession: () => ({ role: 'OWNER' }) }))
vi.mock('../../../src/features/herd-entry/api/index', async original => ({
  ...(await original<typeof import('../../../src/features/herd-entry/api/index')>()),
  entryLineCorrectionEnabled: true, entryPaymentVoidEnabled: true, entryHistoryDemoEnabled: false,
  herdEntryApi: { get: state.get, recordPayment: state.recordPayment }, voidHerdEntry: state.voidEntry, entryVoucherVoidCheck: state.check,
}))
import ImportDetail from '../../../src/features/herd-entry/pages/ImportDetail'

const posted: HerdEntry = {
  id: 'PN-2026-0041', backendId: 41, version: 3, date: '2026-10-29', type: 'Mua ngoài', entryType: 'PURCHASE', status: 'Đã nhập', source: 'Trại Mộc Châu', count: 2,
  total: 10000000, paid: 0, debt: 10000000, createdBy: 'Nguyễn A', createdAt: '2026-10-29T01:00:00Z', postedBy: 'Trần B', postedAt: '2026-10-29T02:30:00Z',
  detail: { sourceName: 'Trại Mộc Châu', payments: [], docs: [], history: ['29/10/2026 09:30 · Trần B · Ghi sổ, tạo 2 con: BC-1, BC-2'], cows: [
    { entryId: 1, lineStatus: 'VALID', herdStatus: 'ACTIVE', code: 'BC-1', tag: 'VN1', barn: 'A1', weight: 300, weightBasis: 'ESTIMATED', current: 'ACTIVE · A1' },
    { entryId: 2, lineStatus: 'VALID', herdStatus: 'EXITED', code: 'BC-2', tag: 'VN2', barn: 'A1', weight: 310, weightBasis: 'MEASURED', current: 'EXITED · A1' },
  ] },
}
beforeEach(() => {
  state.get.mockReset().mockResolvedValue(structuredClone(posted))
  state.recordPayment.mockReset(); state.voidEntry.mockReset(); state.check.mockReset()
})
const page = () => render(<MemoryRouter initialEntries={['/herd-entry/PN-2026-0041']}><Routes><Route path="/herd-entry/:id" element={<ImportDetail />} /></Routes></MemoryRouter>)

it('links cattle codes, marks estimated weights and offers Sửa / Hủy only for ACTIVE cattle', async () => {
  page()
  const link = await screen.findByRole('link', { name: 'BC-1' })
  expect(link).toHaveAttribute('href', '/cattle/BC-1')
  const active = screen.getByRole('row', { name: /BC-1/ })
  expect(within(active).getByText('300 kg UT')).toBeInTheDocument()
  expect(within(active).getByRole('button', { name: 'Sửa / Hủy' })).toBeInTheDocument()
  const exited = screen.getByRole('row', { name: /BC-2/ })
  expect(within(exited).queryByRole('button', { name: 'Sửa / Hủy' })).not.toBeInTheDocument()
  expect(within(exited).getByText('310 kg')).toBeInTheDocument()
})

it('shows creator and poster with UTC+7 time and the formatted history', async () => {
  page()
  expect(await screen.findByText('Nguyễn A · 29/10/2026 08:00')).toBeInTheDocument()
  expect(screen.getByText('Trần B · 29/10/2026 09:30')).toBeInTheDocument()
  expect(screen.getByText('29/10/2026 09:30 · Trần B · Ghi sổ, tạo 2 con: BC-1, BC-2')).toBeInTheDocument()
})

it.each([
  ['Nháp' as const],
  ['Đã hủy' as const],
])('does not render Hủy phiếu for a %s voucher', async status => {
  state.get.mockResolvedValue({ ...structuredClone(posted), status, cancelReason: 'Ghi nhầm', voidedBy: 'Lê C', voidedAt: '2026-10-30T03:00:00Z' })
  page()
  await screen.findByText('Thông tin phiếu')
  expect(screen.queryByRole('button', { name: 'Hủy phiếu' })).not.toBeInTheDocument()
  if (status === 'Đã hủy') {
    expect(screen.getByText('Lê C · 30/10/2026 10:00')).toBeInTheDocument()
    expect(screen.getAllByText(/Ghi nhầm/).length).toBeGreaterThan(0)
  }
})

it('shows MSG-FE06-14 with the outstanding amount of the reloaded voucher', async () => {
  state.recordPayment.mockResolvedValue({})
  const user = userEvent.setup()
  page()
  await user.click(await screen.findByRole('button', { name: 'Ghi thanh toán' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Số tiền (đ)' }), { target: { value: '4000000' } })
  fireEvent.change(screen.getByLabelText('Ngày thanh toán', { selector: 'input' }), { target: { value: '2026-10-30' } })
  state.get.mockResolvedValue({ ...structuredClone(posted), version: 4, paid: 4000000, debt: 6000000 })
  await user.click(screen.getByRole('button', { name: 'Lưu thanh toán' }))
  expect(await screen.findByText('Đã ghi 4.000.000 đ cho PN-2026-0041. Còn lại: 6.000.000 đ.')).toBeInTheDocument()
  expect(state.recordPayment).toHaveBeenCalledWith('PN-2026-0041', expect.objectContaining({ amount: 4000000, date: '2026-10-30' }), { voucherVersion: 3, backendId: 41 })
})

it('shows MSG-FE06-22 after the voucher is voided', async () => {
  state.check.mockResolvedValue({ canVoid: true, paid: 0, confirm: null, blocked: null, rows: [
    { entryId: 1, cattleCode: 'BC-1', eventsAfterEntry: [], canVoid: true, reason: null },
  ] })
  state.voidEntry.mockResolvedValue({ record: { ...posted, status: 'Đã hủy' }, notice: 'Đã hủy phiếu PN-2026-0041.' })
  const user = userEvent.setup()
  page()
  await user.click(await screen.findByRole('button', { name: 'Hủy phiếu' }))
  await screen.findByText('Hủy được')
  await user.type(screen.getByRole('textbox', { name: /Lý do hủy/ }), 'Ghi nhầm nguồn')
  await user.click(screen.getByRole('button', { name: 'Hủy phiếu nhập' }))
  await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
  expect(await screen.findByText('Đã hủy phiếu PN-2026-0041.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(state.voidEntry).toHaveBeenCalledWith('PN-2026-0041', expect.any(Array), expect.objectContaining({ cancelReason: 'Ghi nhầm nguồn' }), { expectedVersion: 3, backendId: 41 })
})
