import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { HerdEntry } from '../../../src/features/herd-entry/types'
import { businessDate } from '../../../src/shared/lib/date/farmTime'

const state = vi.hoisted(() => ({ listView: vi.fn(), sellers: vi.fn(), pending: vi.fn() }))
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/features/herd-entry/api', () => ({ herdEntryApi: { listView: state.listView }, listEntrySellers: state.sellers, listPendingEntryCalves: state.pending }))
import ImportList from '../../../src/features/herd-entry/pages/ImportList'

const today = businessDate()
const voucher = (n: number, extra: Partial<HerdEntry> = {}): HerdEntry => ({
  id: `PN-2026-${String(n).padStart(4, '0')}`, date: today, type: 'Mua ngoài', status: 'Đã nhập', source: `Người bán ${n}`, count: 1, weight: 300, total: 1000, debt: 0, ...extra,
})
beforeEach(() => {
  state.sellers.mockReset().mockResolvedValue([])
  state.pending.mockReset().mockResolvedValue([])
  state.listView.mockReset()
})
const page = () => render(<MemoryRouter><ImportList /></MemoryRouter>)
const dataRows = () => screen.getAllByRole('row').filter(row => /PN-2026-/.test(row.textContent ?? ''))

it('pages 23 vouchers 10 per page with real Trước / Sau buttons', async () => {
  state.listView.mockResolvedValue({ rows: Array.from({ length: 23 }, (_, i) => voucher(i + 1)), tiles: {}, counts: { ALL: 23 } })
  const user = userEvent.setup()
  page()
  await screen.findByText('Hiển thị 1–10 / 23 phiếu')
  expect(dataRows()).toHaveLength(10)
  const prev = screen.getByRole('button', { name: 'Trước' })
  const next = screen.getByRole('button', { name: 'Sau' })
  expect(prev).toBeDisabled()
  expect(screen.getByText('Trang 1/3')).toBeInTheDocument()
  await user.click(next); await user.click(next)
  expect(screen.getByText('Hiển thị 21–23 / 23 phiếu')).toBeInTheDocument()
  expect(dataRows()).toHaveLength(3)
  expect(next).toBeDisabled()
  await user.click(screen.getByRole('button', { name: /Đã nhập/ }))
  expect(screen.getByText('Trang 1/3')).toBeInTheDocument()
})

it('shows dams, quarantine certificate, estimated weights, void reason and owed vouchers', async () => {
  state.listView.mockResolvedValue({ rows: [
    voucher(1, { type: 'Bê sinh tại trại', source: '', damCodes: ['BC-10', 'BC-11'], estimatedWeightCount: 2, count: 2 }),
    voucher(2, { quarantine: 'KD-22', status: 'Đã hủy', cancelReason: 'Ghi nhầm nguồn' }),
  ], tiles: { owedToSellers: 5000, owedVouchers: [{ id: 1, code: 'PN-1', outstanding: 3000 }, { id: 2, code: 'PN-2', outstanding: 2000 }] }, counts: { ALL: 2 } })
  page()
  const calf = await screen.findByRole('row', { name: /PN-2026-0001/ })
  expect(within(calf).getByText('Mẹ: BC-10, BC-11')).toBeInTheDocument()
  expect(within(calf).getByText('2 con cân UT')).toBeInTheDocument()
  const voided = screen.getByRole('row', { name: /PN-2026-0002/ })
  expect(within(voided).getByText('GKD KD-22')).toBeInTheDocument()
  expect(within(voided).getByText('Ghi nhầm nguồn')).toHaveAttribute('title', 'Ghi nhầm nguồn')
  expect(screen.getByText('2 phiếu còn nợ')).toBeInTheDocument()
  expect(screen.queryByText('Theo dữ liệu backend')).not.toBeInTheDocument()
})

it('sorts by entry date (newest first by default) and by voucher code', async () => {
  state.listView.mockResolvedValue({ rows: [voucher(1, { date: '2026-11-01' }), voucher(2, { date: today }), voucher(3, { date: '2026-10-15' })], tiles: {}, counts: { ALL: 3 } })
  const user = userEvent.setup()
  page()
  await screen.findByText('Hiển thị 1–3 / 3 phiếu')
  const codes = () => dataRows().map(row => row.textContent?.match(/PN-2026-\d{4}/)?.[0])
  expect(codes()).toEqual(['PN-2026-0002', 'PN-2026-0001', 'PN-2026-0003'])
  await user.click(screen.getByRole('button', { name: /Mã phiếu/ }))
  expect(codes()).toEqual(['PN-2026-0001', 'PN-2026-0002', 'PN-2026-0003'])
  await user.click(screen.getByRole('button', { name: /Mã phiếu/ }))
  expect(codes()).toEqual(['PN-2026-0003', 'PN-2026-0002', 'PN-2026-0001'])
})

it('shows a Vietnamese load error with Thử lại', async () => {
  state.listView.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce({ rows: [voucher(1)], tiles: {}, counts: { ALL: 1 } })
  const user = userEvent.setup()
  page()
  await user.click(await screen.findByRole('button', { name: 'Thử lại' }))
  expect(screen.queryByText(/Error: Failed/)).not.toBeInTheDocument()
  await waitFor(() => expect(dataRows()).toHaveLength(1))
})
