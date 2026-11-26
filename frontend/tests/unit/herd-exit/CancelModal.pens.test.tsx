import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import type { HerdExit } from '../../../src/features/herd-exit/types'

const api = vi.hoisted(() => ({ check: vi.fn(), pens: vi.fn(), cancel: vi.fn() }))
vi.mock('../../../src/features/herd-exit/api/index', () => ({
  exitVoidCheck: api.check, listExitCancelPens: api.pens, cancelHerdExit: api.cancel,
  exitCancelDefaults: () => ({ reason: '' }),
}))
import CancelModal from '../../../src/features/herd-exit/components/CancelModal'

const row: HerdExit = { id: 'PX-61', backendId: 61, version: 3, status: 'Đã xuất', type: 'Bán', count: 2, detail: { cows: [{ code: 'BC-1' }, { code: 'BC-2' }] } }
const cattle = (id: number, needsPenOverride = true) => ({ cattleId: id, cattleCode: `BC-${id - 100}`, needsPenOverride, lastPen: { penId: 1, penCode: 'A', active: false, freePlaces: 0 } })
const check = () => ({ voucherId: 61, code: 'PX-61', version: 99, voidable: true, cattle: [cattle(101), cattle(102)], occupancyAfter: [], message: { code: 'MSG-FE13-09', text: 'Chuồng A đã ngưng. Hãy chọn chuồng thay thế.' } })
const pens = () => [
  { id: 1, code: 'A', name: 'Chuồng A', status: 'INACTIVE', count: 0, capacity: 10, cows: [] },
  { id: 2, code: 'B', name: 'Chuồng B', status: 'ACTIVE', count: 9, capacity: 10, cows: [] },
  { id: 3, code: 'C', name: 'Chuồng C', status: 'ACTIVE', count: 0, capacity: 10, cows: [] },
]
const renderModal = () => {
  const callbacks = { onClose: vi.fn(), onCancelled: vi.fn(), onReload: vi.fn() }
  render(<MemoryRouter><CancelModal row={row} {...callbacks} /></MemoryRouter>)
  return callbacks
}
const submit = () => screen.getByRole('button', { name: 'Hủy phiếu xuất' })
const choose = (code: string) => screen.getByRole('combobox', { name: `Chuồng cho ${code}` })

beforeEach(() => {
  vi.clearAllMocks()
  api.check.mockResolvedValue(check())
  api.pens.mockResolvedValue(pens())
  api.cancel.mockResolvedValue({ ...row, status: 'Đã hủy' })
})

describe('exit cancellation replacement pens', () => {
  it('waits for both preflight requests before permitting cancellation', async () => {
    let finish!: (value: ReturnType<typeof check>) => void
    api.check.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderModal()
    expect(screen.getByText('Đang kiểm tra chuồng…')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
    expect(api.check).toHaveBeenCalledWith(row.id, 61)
    expect(api.pens).toHaveBeenCalledTimes(1)
    finish(check())
    expect(await screen.findByRole('combobox', { name: 'Chuồng cho BC-1' })).toBeInTheDocument()
  })

  it('shows the server occupancy and needs no overrides when the last pens have room', async () => {
    const user = userEvent.setup()
    api.check.mockResolvedValue({ ...check(), cattle: [cattle(101, false), cattle(102, false)], occupancyAfter: [{ penId: 2, penCode: 'B', capacity: 10, before: 7, after: 9 }], message: undefined })
    const handlers = renderModal()
    await waitFor(() => expect(screen.queryByText('Đang kiểm tra chuồng…')).not.toBeInTheDocument())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText(/B \(7\/10 → 9\/10\)/)).toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), '  Khách trả lại  ')
    await user.click(submit())
    await waitFor(() => expect(handlers.onCancelled).toHaveBeenCalledTimes(1))
    expect(api.cancel.mock.calls[0][3]).toEqual({ expectedVersion: 3, backendId: 61, penOverrides: {}, warningReasons: {} })
    expect(api.cancel.mock.calls[0][2].cancelReason).toBe('Khách trả lại')
  })

  it('requires a selection for each affected cow and reserves a last free place only once', async () => {
    const user = userEvent.setup()
    renderModal()
    expect(await screen.findByText(check().message.text)).toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), 'Trả lại')
    expect(submit()).toBeDisabled()
    expect(within(choose('BC-1')).queryByRole('option', { name: /Chuồng A/ })).not.toBeInTheDocument()
    await user.selectOptions(choose('BC-1'), '2')
    expect(within(choose('BC-1')).getByRole('option', { name: /Chuồng B/ })).toBeInTheDocument()
    expect(within(choose('BC-2')).queryByRole('option', { name: /Chuồng B/ })).not.toBeInTheDocument()
    expect(submit()).toBeDisabled()
    await user.selectOptions(choose('BC-2'), '3')
    await user.click(submit())
    await waitFor(() => expect(api.cancel).toHaveBeenCalledTimes(1))
    expect(api.cancel.mock.calls[0][3]).toEqual({ expectedVersion: 3, backendId: 61, penOverrides: { '101': 2, '102': 3 }, warningReasons: {} })
  })

  it('reserves automatic returns before offering room to an override', async () => {
    api.check.mockResolvedValue({ ...check(), cattle: [{ ...cattle(101, false), lastPen: { penId: 2, penCode: 'B', active: true, freePlaces: 1 } }, cattle(102)], occupancyAfter: [{ penId: 2, penCode: 'B', capacity: 10, before: 9, after: 10 }] })
    renderModal()
    await screen.findByRole('combobox', { name: 'Chuồng cho BC-2' })
    expect(screen.queryByRole('combobox', { name: 'Chuồng cho BC-1' })).not.toBeInTheDocument()
    expect(within(choose('BC-2')).queryByRole('option', { name: /Chuồng B/ })).not.toBeInTheDocument()
  })

  it('disables cancellation and explains when no active pen has a place', async () => {
    api.pens.mockResolvedValue(pens().map((pen) => ({ ...pen, count: pen.capacity })))
    renderModal()
    expect(await screen.findByText('Không còn chuồng ACTIVE đủ chỗ. Hãy mở thêm chuồng hoặc tăng sức chứa trước khi hủy.')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('shows and focuses the warning reason for the failing cow, retains other choices and retries with its reason', async () => {
    const user = userEvent.setup(), handlers = renderModal()
    api.cancel.mockRejectedValueOnce(new BackendError(422, { code: 'MSG-FE04-06', message: 'Cần lý do nhận BC-1 vào B.', params: { cattle_code: 'BC-1', pen_code: 'B', criteria: 'Chỉ nhận bò cái' } }))
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Chuồng cho BC-1' }), '2')
    await user.selectOptions(choose('BC-2'), '3')
    await user.type(screen.getByRole('textbox'), 'Khách trả lại')
    await user.click(submit())
    const warning = await screen.findByRole('textbox', { name: 'Lý do cảnh báo BC-1' })
    expect(warning).toHaveFocus()
    expect(screen.getByText('Chỉ nhận bò cái')).toBeInTheDocument()
    expect(screen.getByText('Cần lý do nhận BC-1 vào B.')).toBeInTheDocument()
    expect(choose('BC-1')).toHaveValue('2')
    expect(choose('BC-2')).toHaveValue('3')
    expect(screen.getByDisplayValue('Khách trả lại')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
    expect(handlers.onCancelled).not.toHaveBeenCalled()
    await user.type(warning, '  Nhận tạm để theo dõi  ')
    await user.click(submit())
    await waitFor(() => expect(handlers.onCancelled).toHaveBeenCalledTimes(1))
    expect(api.cancel.mock.calls[1][3]).toEqual({ expectedVersion: 3, backendId: 61, penOverrides: { '101': 2, '102': 3 }, warningReasons: { '101': 'Nhận tạm để theo dõi' } })
  })

  it('clears an old pen warning when a different pen is selected', async () => {
    const user = userEvent.setup()
    api.cancel.mockRejectedValueOnce(new BackendError(422, { code: 'MSG-FE04-06', params: { cattle_code: 'BC-1', criteria: 'Chỉ nhận bò cái' } }))
    renderModal()
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Chuồng cho BC-1' }), '2')
    await user.selectOptions(choose('BC-2'), '3')
    await user.type(screen.getByRole('textbox'), 'Trả lại')
    await user.click(submit())
    await screen.findByRole('textbox', { name: 'Lý do cảnh báo BC-1' })
    await user.selectOptions(choose('BC-1'), '3')
    expect(screen.queryByRole('textbox', { name: 'Lý do cảnh báo BC-1' })).not.toBeInTheDocument()
    expect(submit()).toBeEnabled()
  })

  it('refreshes on FE13-09, drops a newly full pen and keeps the reason and other valid choices', async () => {
    const user = userEvent.setup()
    api.cancel.mockRejectedValueOnce(new BackendError(422, { code: 'MSG-FE13-09', message: 'Chuồng B vừa đầy.', params: { pen: 'B', cattle_codes: ['BC-1'] } }))
    renderModal()
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Chuồng cho BC-1' }), '2')
    await user.selectOptions(choose('BC-2'), '3')
    await user.type(screen.getByRole('textbox'), 'Khách trả lại')
    api.pens.mockResolvedValue(pens().map((pen) => pen.id === 2 ? { ...pen, count: 10 } : pen))
    await user.click(submit())
    await waitFor(() => expect(api.check).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(choose('BC-1')).toHaveValue(''))
    expect(choose('BC-2')).toHaveValue('3')
    expect(choose('BC-1')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByDisplayValue('Khách trả lại')).toBeInTheDocument()
    expect(screen.getByText(/Đã bỏ lựa chọn.*BC-1/)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
    await user.selectOptions(choose('BC-1'), '3')
    await user.click(submit())
    await waitFor(() => expect(api.cancel).toHaveBeenCalledTimes(2))
    expect(api.cancel.mock.calls[1][3].expectedVersion).toBe(3)
  })

  it('retries a failed preflight without losing the entered reason', async () => {
    const user = userEvent.setup()
    api.check.mockRejectedValueOnce(new BackendError(500))
    renderModal()
    const retry = await screen.findByRole('button', { name: 'Thử lại' })
    await user.type(screen.getByRole('textbox'), 'Lý do đang nhập')
    await user.click(retry)
    await screen.findByRole('combobox', { name: 'Chuồng cho BC-1' })
    expect(api.check).toHaveBeenCalledTimes(2)
    expect(screen.getByDisplayValue('Lý do đang nhập')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('does not enable cancellation if either catalogue or void-check failed', async () => {
    const user = userEvent.setup()
    api.pens.mockRejectedValueOnce(new BackendError(500))
    renderModal()
    await screen.findByRole('button', { name: 'Thử lại' })
    await user.type(screen.getByRole('textbox'), 'Khách trả lại')
    expect(submit()).toBeDisabled()
    expect(api.cancel).not.toHaveBeenCalled()
  })

  it('shows the server message and blocks a non-voidable voucher', async () => {
    const user = userEvent.setup()
    api.check.mockResolvedValue({ ...check(), voidable: false, message: { code: 'MSG-COM-05', text: 'Phiếu này không còn hủy được.' } })
    renderModal()
    expect(await screen.findByText('Phiếu này không còn hủy được.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), 'Khách trả lại')
    expect(submit()).toBeDisabled()
  })
})
