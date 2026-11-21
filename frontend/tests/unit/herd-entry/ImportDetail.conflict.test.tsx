import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import type { HerdEntry } from '../../../src/features/herd-entry/types'

const state = vi.hoisted(() => ({ get: vi.fn(), payment: vi.fn(), cancel: vi.fn() }))
vi.mock('../../../src/features/herd-entry/api/index', async (original) => ({
  ...(await original<typeof import('../../../src/features/herd-entry/api/index')>()),
  herdEntryApi: { get: state.get, recordPayment: state.payment },
  voidHerdEntry: state.cancel,
}))
import ImportDetail from '../../../src/features/herd-entry/pages/ImportDetail'

const row: HerdEntry = {
  id: 'PN-2026-0041', backendId: 41, version: 3, status: 'Đã nhập', type: 'Mua ngoài',
  date: '2026-10-29', source: 'Nguồn thử', count: 1, total: 1000, debt: 500,
  detail: { cows: [{ code: 'BC-001', tag: 'VN1', breed: 'Lai Sind', barn: 'A1', weight: 100 }], payments: [], docs: [], history: [] },
}
beforeEach(() => {
  state.get.mockReset().mockResolvedValue(structuredClone(row))
  state.payment.mockReset().mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' }))
  state.cancel.mockReset().mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' }))
})
function renderPage() {
  return render(<MemoryRouter initialEntries={[`/herd-entry/${row.id}`]}><Routes><Route path="/herd-entry/:id" element={<ImportDetail />} /></Routes></MemoryRouter>)
}
describe('entry detail snapshot conflicts', () => {
  it('keeps the payment popup and values on conflict/Stay, then reloads the voucher explicitly', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Ghi nhận thanh toán' }))
    const fields = screen.getAllByRole('textbox')
    await user.clear(fields.at(-1)!); await user.type(fields.at(-1)!, 'Ghi chu chua luu')
    state.get.mockResolvedValue({ ...row, version: 9, debt: 100 })
    await user.click(screen.getByRole('button', { name: 'Lưu thanh toán' }))
    await screen.findByRole('button', { name: 'Tải bản mới nhất' })
    expect(state.payment).toHaveBeenCalledWith(row.id, expect.objectContaining({ note: 'Ghi chu chua luu' }), { voucherVersion: 3, backendId: 41 })
    expect(state.get).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Ở lại' }))
    expect(screen.getByDisplayValue('Ghi chu chua luu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu thanh toán' })).toBeInTheDocument()
    state.payment.mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' }))
    await user.click(screen.getByRole('button', { name: 'Lưu thanh toán' }))
    await user.click(await screen.findByRole('button', { name: 'Tải bản mới nhất' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu thanh toán' })).not.toBeInTheDocument())
    expect(state.get).toHaveBeenCalledTimes(2)
    expect(state.payment).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Ghi nhận thanh toán' }))
    await user.click(screen.getByRole('button', { name: 'Lưu thanh toán' }))
    await waitFor(() => expect(state.payment).toHaveBeenLastCalledWith(row.id, expect.anything(), { voucherVersion: 9, backendId: 41 }))
  })

  it('retains the cancellation reason and sends the loaded snapshot without refetching on 409', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Hủy phiếu' }))
    const reason = screen.getByDisplayValue('Ghi nhầm nguồn – bò thực tế mua của hộ ông Lê Văn C')
    await user.clear(reason); await user.type(reason, 'Ly do dang nhap')
    await user.click(screen.getByRole('button', { name: 'Hủy phiếu nhập' }))
    await screen.findByRole('button', { name: 'Tải bản mới nhất' })
    expect(state.cancel).toHaveBeenCalledWith(row.id, row.detail!.cows, expect.objectContaining({ cancelReason: 'Ly do dang nhap' }), { expectedVersion: 3, backendId: 41 })
    await user.click(screen.getByRole('button', { name: 'Ở lại' }))
    expect(screen.getByDisplayValue('Ly do dang nhap')).toBeInTheDocument()
    expect(state.get).toHaveBeenCalledTimes(1)
    expect(state.cancel).toHaveBeenCalledTimes(1)
  })
})
