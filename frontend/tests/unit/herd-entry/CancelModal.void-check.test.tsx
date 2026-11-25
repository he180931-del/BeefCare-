import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { EntryVoucherVoidCheck, HerdEntry } from '../../../src/features/herd-entry/types'

const state = vi.hoisted(() => ({ check: vi.fn() }))
vi.mock('../../../src/features/herd-entry/api', async original => ({
  ...(await original<typeof import('../../../src/features/herd-entry/api')>()),
  entryVoucherVoidCheck: state.check,
}))
import CancelModal from '../../../src/features/herd-entry/components/CancelModal'

const record: HerdEntry = { id: 'PN-2026-0041', backendId: 41, version: 3, status: 'Đã nhập', type: 'Mua ngoài', date: '2026-10-29', count: 2, source: 'Trại Mộc Châu',
  detail: { sourceName: 'Trại Mộc Châu', cows: [{ code: 'BC-1', lineStatus: 'VALID', barn: 'A1' }, { code: 'BC-2', lineStatus: 'VALID', barn: 'B2' }] } }
const ok: EntryVoucherVoidCheck = { canVoid: true, paid: 2000000, confirm: null, blocked: null, rows: [
  { entryId: 1, cattleCode: 'BC-1', eventsAfterEntry: [], canVoid: true, reason: null },
  { entryId: 2, cattleCode: 'BC-2', eventsAfterEntry: [], canVoid: true, reason: null },
] }
beforeEach(() => { state.check.mockReset() })

it('starts with an empty reason (no demo text) and requires one before confirming', async () => {
  state.check.mockResolvedValue(ok)
  const onConfirm = vi.fn()
  const user = userEvent.setup()
  render(<CancelModal record={record} onClose={vi.fn()} onConfirm={onConfirm} />)
  const reason = screen.getByRole('textbox', { name: /Lý do hủy/ })
  expect(reason).toHaveValue('')
  expect(reason).toHaveAttribute('maxLength', '500')
  expect(screen.queryByText(/Lê Văn C/)).not.toBeInTheDocument()
  await screen.findAllByText('Hủy được')
  await user.click(screen.getByRole('button', { name: 'Hủy phiếu nhập' }))
  expect(screen.getByText('Lý do hủy là bắt buộc.')).toBeInTheDocument()
  expect(onConfirm).not.toHaveBeenCalled()
})

it('locks the void and shows MSG-FE06-21 when the backend blocks a cattle', async () => {
  state.check.mockResolvedValue({ ...ok, canVoid: false, rows: [ok.rows[0], { ...ok.rows[1], eventsAfterEntry: ['WEIGHT'], canVoid: false, reason: 'HAS_EVENTS' }],
    blocked: { code: 'MSG-FE06-21', params: {}, message: 'Không thể hủy phiếu PN-2026-0041: BC-2 đã có sự kiện khác. Hãy sửa hoặc hủy từng bản ghi.' } })
  render(<CancelModal record={record} onClose={vi.fn()} onConfirm={vi.fn()} />)
  expect(await screen.findByText('Bị chặn')).toBeInTheDocument()
  expect(screen.getByText('Cân nặng')).toBeInTheDocument()
  expect(screen.getByText(/Không thể hủy phiếu PN-2026-0041: BC-2/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hủy phiếu nhập' })).toBeDisabled()
  expect(state.check).toHaveBeenCalledWith(record)
})

it('builds MSG-FE06-21 from the blocked rows when the backend sends no message', async () => {
  state.check.mockResolvedValue({ ...ok, canVoid: false, rows: [{ ...ok.rows[0], canVoid: false, eventsAfterEntry: ['VACCINATION'] }, ok.rows[1]] })
  render(<CancelModal record={record} onClose={vi.fn()} onConfirm={vi.fn()} />)
  expect(await screen.findByText('Không thể hủy phiếu PN-2026-0041: BC-1 đã có sự kiện khác. Hãy sửa hoặc hủy từng bản ghi.')).toBeInTheDocument()
})

it('asks MSG-FE06-20 before calling the void and sends the trimmed reason', async () => {
  state.check.mockResolvedValue(ok)
  const onConfirm = vi.fn()
  const user = userEvent.setup()
  render(<CancelModal record={record} onClose={vi.fn()} onConfirm={onConfirm} />)
  await screen.findAllByText('Hủy được')
  await user.type(screen.getByRole('textbox', { name: /Lý do hủy/ }), '  Ghi nhầm nguồn  ')
  await user.click(screen.getByRole('button', { name: 'Hủy phiếu nhập' }))
  expect(onConfirm).not.toHaveBeenCalled()
  expect(screen.getByText('Hủy phiếu PN-2026-0041? 2 hồ sơ bò sẽ bị hủy, trả chỗ chuồng và thu hồi thẻ QR. Khoản đã trả 2.000.000 đ vẫn nằm trong lịch sử.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
  expect(onConfirm).toHaveBeenCalledWith('Ghi nhầm nguồn')
})

it('tells a farm-born voucher that the calves return to pending confirmation', async () => {
  state.check.mockResolvedValue(ok)
  render(<CancelModal record={{ ...record, type: 'Bê sinh tại trại', entryType: 'FARM_BORN' }} onClose={vi.fn()} onConfirm={vi.fn()} />)
  expect(await screen.findByText('Bê quay về danh sách chờ xác nhận.')).toBeInTheDocument()
})

it('shows a Vietnamese error with Thử lại when the void check fails', async () => {
  state.check.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(ok)
  const user = userEvent.setup()
  render(<CancelModal record={record} onClose={vi.fn()} onConfirm={vi.fn()} />)
  await user.click(await screen.findByRole('button', { name: 'Thử lại' }))
  await waitFor(() => expect(screen.getAllByText('Hủy được')).toHaveLength(2))
  expect(state.check).toHaveBeenCalledTimes(2)
})
