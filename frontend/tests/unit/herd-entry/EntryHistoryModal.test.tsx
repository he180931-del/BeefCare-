import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import EntryLineModal from '../../../src/features/herd-entry/components/EntryLineModal'
import type { EntryCattleDetail, HerdEntry } from '../../../src/features/herd-entry/types'

const { correct } = vi.hoisted(() => ({ correct: vi.fn() }))
vi.mock('../../../src/features/herd-entry/api/index', () => ({
  correctEntryLine: correct, voidEntryLine: vi.fn(),
  entryVoidCheck: async () => ({ canVoid: false, eventsAfterEntry: [] }),
  listEntryBreeds: async () => [], listEntrySellers: async () => [],
  listEntryVaccines: async () => [{ id: 1, code: 'LMLM', name: 'LMLM', available: true }],
}))
beforeEach(() => correct.mockReset().mockResolvedValue({ notice: null, overpaidNotice: null }))
afterEach(cleanup)

const history = { vaccine: 'Có', vaccineItems: [{ vaccineId: 1, vaccineName: 'LMLM', vaccineDate: '2026-03-01' }],
  disease: 'Không rõ', repro: 'Có', earlierCalvings: 2, pregnantAtEntry: 'YES', pregnancyMonths: 4 }
const line: EntryCattleDetail = { entryId: 91, lineVersion: 0, code: 'BC-001', sexCode: 'FEMALE', hist: history }
const record: HerdEntry = { id: 'PN-H', version: 3, status: 'Đã nhập', entryType: 'PURCHASE', date: '2026-10-20', detail: { cows: [line] } }
function open(r = record, l = line) {
  const success = vi.fn().mockResolvedValue(undefined)
  render(<EntryLineModal record={r} line={l} onSuccess={success} onClose={vi.fn()} onReload={vi.fn()} onVoidVoucher={vi.fn()} />)
  return success
}

it('shows the persisted summary and prefills the shared history editor for a posted purchase', async () => {
  open(); const user = userEvent.setup()
  expect(screen.getByText(/Tiêm: Có · 1 vắc-xin/)).toHaveTextContent('Sinh sản: Có · 2 lứa · mang thai ~4 tháng')
  await user.click(screen.getByRole('button', { name: 'Sửa khai báo lịch sử' }))
  await user.click(screen.getByRole('button', { name: 'Chi tiết tiêm phòng' }))
  expect(screen.getByLabelText('Tên vaccine')).toHaveValue('LMLM')
  expect(screen.getByLabelText('Ngày tiêm 1')).toHaveValue('2026-03-01')
})

it('validates a KNOWN disease, sends only its changed block and preserves the observed versions', async () => {
  const success = open(); const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Sửa khai báo lịch sử' }))
  await user.click(within(screen.getByRole('row', { name: /^Bệnh đã biết/ })).getByRole('radio', { name: 'Có' }))
  await user.click(screen.getByRole('button', { name: 'Áp dụng lịch sử' }))
  expect(screen.getByText('Vui lòng mô tả bệnh đã biết.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Chi tiết bệnh đã biết' }))
  await user.type(screen.getByRole('textbox', { name: 'Mô tả bệnh' }), 'Đã khỏi bệnh trước nhập')
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  await user.click(screen.getByRole('button', { name: 'Áp dụng lịch sử' }))
  await user.type(screen.getByRole('textbox', { name: 'Lý do' }), 'Bổ sung khai báo')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Lưu' }))
  await waitFor(() => expect(success).toHaveBeenCalledOnce())
  expect(correct).toHaveBeenCalledWith(91, { reason: 'Bổ sung khai báo', expectedVersion: 0, voucherVersion: 3,
    changes: { disease: { status: 'KNOWN', description: 'Đã khỏi bệnh trước nhập' } } })
})

it('rejects months outside 1–9 and parity outside 0–15', async () => {
  open(); const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Sửa khai báo lịch sử' }))
  await user.click(screen.getByRole('button', { name: 'Chi tiết sinh sản' }))
  fireEvent.change(screen.getByLabelText('Số tháng mang thai'), { target: { value: '10' } })
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  expect(screen.getAllByText('Số tháng mang thai phải từ 1 đến 9.').length).toBeGreaterThan(0)
  fireEvent.change(screen.getByLabelText('Số tháng mang thai'), { target: { value: '9' } })
  fireEvent.change(screen.getByLabelText('Số lứa đã đẻ trước nhập đàn'), { target: { value: '16' } })
  await user.click(screen.getByRole('button', { name: 'Lưu chi tiết' }))
  await user.click(screen.getByRole('button', { name: 'Áp dụng lịch sử' }))
  expect(screen.getByText('Vui lòng nhập số lứa đã đẻ từ 0 đến 15.')).toBeInTheDocument()
  expect(correct).not.toHaveBeenCalled()
})

it('hides reproduction for the effective male sex and displays the removal note', async () => {
  open(); const user = userEvent.setup()
  await user.selectOptions(screen.getByLabelText('Giới tính mới'), 'MALE')
  await user.click(screen.getByRole('button', { name: 'Sửa khai báo lịch sử' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Khai báo lịch sử trước nhập' }))
  expect(dialog.queryByRole('button', { name: 'Chi tiết sinh sản' })).not.toBeInTheDocument()
  expect(dialog.getByText('Khai báo sinh sản sẽ bị bỏ vì bò là đực.')).toBeInTheDocument()
})

it('never offers declaration editing on FARM_BORN', async () => {
  open({ ...record, entryType: 'FARM_BORN' })
  await waitFor(() => expect(screen.queryByText('Đang kiểm tra…')).not.toBeInTheDocument())
  expect(screen.queryByText('Khai báo lịch sử')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sửa khai báo lịch sử' })).not.toBeInTheDocument()
})
