import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext } from '../../../src/app/session/sessionContext'
import type { HerdExit } from '../../../src/features/herd-exit/types'
import { BackendError } from '../../../src/shared/api/backendClient'

const apiState = vi.hoisted(() => ({
  checks: vi.fn(),
  confirmed: vi.fn(),
  dismissed: vi.fn(),
  saved: vi.fn(),
  removedAttachment: vi.fn(),
}))

vi.mock('../../../src/features/herd-exit/api/index', () => ({
  herdExitApi: { checks: apiState.checks },
  confirmHerdExitOutcome: apiState.confirmed,
  dismissHerdExit: apiState.dismissed,
  downloadExitAttachment: vi.fn(),
  removeExitAttachment: apiState.removedAttachment,
  saveHerdExit: apiState.saved,
}))

import DeathView from '../../../src/features/herd-exit/components/DeathView'

const pendingDeath: HerdExit = {
  id: 'PX-2026-0008', backendId: 8, version: 7, date: '2026-10-21', type: 'Chết / mất', status: 'Chờ xác nhận', who: 'Ca HC-0418', count: 1,
  detail: {
    death: true, lossKind: 'DIED', lossType: 'Chết', sourceHealthCaseId: 418, date: '2026-10-21', source: 'Ca sức khỏe HC-0418', reporter: 'Trần Quốc Long', reason: 'Tiêu chảy cấp', disposal: 'Tiêu hủy / chôn lấp tại trại',
    cow: { code: 'BC-000156', tag: 'VN-0377', breed: 'Lai Sind', sex: 'Cái', age: '14 tháng', barn: 'A2', weight: 180, estimated: true, caseLine: ['HC-0418', 'đóng: Chết'] },
  },
}

beforeEach(() => {
  apiState.checks.mockReset()
  apiState.confirmed.mockReset()
  apiState.dismissed.mockReset()
  apiState.saved.mockReset()
  apiState.removedAttachment.mockReset()
  apiState.checks.mockResolvedValue({
    voucherId: 8, code: pendingDeath.id, version: 7, exitDate: pendingDeath.date, occupancy: [],
    cattle: [{ cattleId: 156, cattleCode: 'BC-000156', penId: 2, penCode: 'A2', hasWarnings: true, messages: [{ code: 'MSG-FE13-07', text: 'Cảnh báo cần xem' }] }],
  })
  apiState.confirmed.mockResolvedValue({ voucher: { ...pendingDeath, status: 'Đã xuất' }, message: 'Đã xác nhận phiếu PX-2026-0008: 1 con đã rời đàn.' })
})

describe('pending death/missing exit checks', () => {
  it('keeps the rejection reason after 409 and uses the voucher snapshot instead of newer checks', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    apiState.dismissed.mockRejectedValue(new BackendError(409, { code: 'MSG-COM-05' }))
    render(<MemoryRouter><DeathView row={{ ...pendingDeath, version: 3 }} onReload={onReload} /></MemoryRouter>)
    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByRole('button', { name: 'Bác đề xuất' }))
    await user.type(screen.getAllByRole('textbox').at(-1)!, 'Ly do bac dang nhap')
    await user.click(screen.getAllByRole('button', { name: 'Bác đề xuất' }).at(-1)!)
    await screen.findByRole('button', { name: 'Tải bản mới nhất' })
    expect(apiState.dismissed).toHaveBeenCalledWith(pendingDeath.id, 'Ly do bac dang nhap', 3, 8)
    await user.click(screen.getByRole('button', { name: 'Ở lại' }))
    expect(screen.getByDisplayValue('Ly do bac dang nhap')).toBeInTheDocument()
    expect(apiState.dismissed).toHaveBeenCalledTimes(1)
    expect(apiState.checks).toHaveBeenCalledTimes(1)
    expect(onReload).not.toHaveBeenCalled()
  })

  it('keeps a pending health-sourced voucher read-only for a Manager while Owner evidence remains available', async () => {
    const manager = { role: 'MANAGER' as const, fullName: 'Quản lý', email: 'manager@example.test', farmId: 1, farmName: 'Trại kiểm thử', logout: async () => undefined }
    render(<SessionContext.Provider value={manager}><MemoryRouter><DeathView row={pendingDeath} onReload={vi.fn()} /></MemoryRouter></SessionContext.Provider>)

    await screen.findByText('Cảnh báo cần xem')
    expect(screen.queryByLabelText('Chọn ngày chết / mất')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Tiêu chảy cấp')).toHaveAttribute('readonly')

    const otherDisposal = screen.getByLabelText('Giao thú y địa phương') as HTMLInputElement
    expect(otherDisposal).not.toBeChecked()
    fireEvent.click(otherDisposal)
    expect(otherDisposal).not.toBeChecked()
    expect(screen.getByText('Phiếu chờ xác nhận: chỉ Chủ trại được thêm hoặc xóa chứng từ; thành viên khác chỉ xem.')).toBeInTheDocument()
  })

  it('keeps the health-case loss kind read-only', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={pendingDeath} onReload={vi.fn()} /></MemoryRouter>)

    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByText('Mất tích'))

    expect(screen.getByText('Nguyên nhân / ghi chú *')).toBeInTheDocument()
    expect(screen.queryByText('Nguyên nhân mất tích *')).not.toBeInTheDocument()
  })

  it('loads real checks, requires acknowledgement, and confirms with the checks version', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={pendingDeath} onReload={vi.fn()} /></MemoryRouter>)

    expect(await screen.findByText('Cảnh báo cần xem')).toBeInTheDocument()
    expect(apiState.checks).toHaveBeenCalledWith(pendingDeath.id)
    const acknowledgement = screen.getByLabelText(/Tôi đã xem các mục trên/)
    expect(acknowledgement).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Xác nhận xuất đàn' })).toBeDisabled()

    await user.click(acknowledgement)
    await user.click(screen.getByRole('button', { name: 'Xác nhận xuất đàn' }))

    expect(apiState.confirmed).toHaveBeenCalledWith(pendingDeath.id, 7)
  })

  it('lets the Owner upload and remove evidence while the health-sourced voucher is pending', async () => {
    const user = userEvent.setup()
    const row = {
      ...pendingDeath,
      detail: { ...pendingDeath.detail, docs: [{ id: 91, name: 'old-report.pdf', ext: 'PDF' }] },
    }
    apiState.saved.mockResolvedValue(row)
    render(<MemoryRouter><DeathView row={row} onReload={vi.fn()} /></MemoryRouter>)

    await screen.findByText('Cảnh báo cần xem')
    const file = new File(['%PDF-1.4\n%%EOF\n'], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Thêm chứng từ bằng chứng'), { target: { files: [file] } })
    await user.click(screen.getByRole('button', { name: 'Lưu chứng từ (1)' }))

    expect(apiState.saved).toHaveBeenCalledWith(expect.objectContaining({ id: row.id, documents: [file] }))
    await user.click(screen.getByRole('button', { name: 'Xóa old-report.pdf' }))
    expect(apiState.removedAttachment).toHaveBeenCalledWith(row.id, 91)
  })

  it('dismisses a pending proposal with the loaded voucher version', async () => {
    apiState.dismissed.mockResolvedValue({ voucher: { ...pendingDeath, status: 'Đã bác' }, message: '' })
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={pendingDeath} onReload={vi.fn()} /></MemoryRouter>)

    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByRole('button', { name: 'Bác đề xuất' }))
    await user.type(screen.getAllByRole('textbox').at(-1)!, 'Ca sức khỏe sai')
    await user.click(screen.getAllByRole('button', { name: 'Bác đề xuất' }).at(-1)!)

    expect(apiState.dismissed).toHaveBeenCalledWith(pendingDeath.id, 'Ca sức khỏe sai', 7, 8)
  })

  it('invalidates acknowledgement after edits and requires a fresh checks snapshot before confirming', async () => {
    const initialChecks = {
      voucherId: 8, code: pendingDeath.id, version: 7, exitDate: pendingDeath.date, occupancy: [],
      cattle: [{ cattleId: 156, cattleCode: 'BC-000156', penId: 2, penCode: 'A2', hasWarnings: true, messages: [{ code: 'MSG-FE13-07', text: 'Cảnh báo cần xem' }] }],
    }
    apiState.checks.mockReset()
    apiState.checks.mockResolvedValueOnce(initialChecks).mockResolvedValueOnce({ ...initialChecks, version: 8, exitDate: '2026-10-22' })
    apiState.saved.mockResolvedValue({ ...pendingDeath, status: 'Nháp' })
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={pendingDeath} onReload={vi.fn()} /></MemoryRouter>)

    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByLabelText(/Tôi đã xem các mục trên/))
    const date = screen.getByLabelText('Chọn ngày chết / mất')
    fireEvent.change(date, { target: { value: '2026-10-22' } })

    expect(screen.getByLabelText(/Tôi đã xem các mục trên/)).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Xác nhận xuất đàn' })).toBeDisabled()
    expect(apiState.confirmed).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Lưu và kiểm tra lại' }))
    expect(apiState.checks).toHaveBeenCalledTimes(2)
    expect(apiState.saved).toHaveBeenCalledTimes(1)
    await user.click(screen.getByLabelText(/Tôi đã xem các mục trên/))
    await user.click(screen.getByRole('button', { name: 'Xác nhận xuất đàn' }))

    expect(apiState.saved).toHaveBeenCalledTimes(1)
    expect(apiState.confirmed).toHaveBeenCalledWith(pendingDeath.id, 8)
  })

  it('confirms and opens the voucher detail with the server notice (SCR-43 #13)', async () => {
    const user = userEvent.setup()
    function Notice() { const location = useLocation(); return <div>{`${location.pathname}|${(location.state as { notice?: string } | null)?.notice ?? ''}`}</div> }
    render(<MemoryRouter initialEntries={['/pending']}><Routes>
      <Route path="/pending" element={<DeathView row={pendingDeath} onReload={vi.fn()} />} />
      <Route path="/herd-exit/:id" element={<Notice />} />
    </Routes></MemoryRouter>)
    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByLabelText(/Tôi đã xem các mục trên/))
    await user.click(screen.getByRole('button', { name: 'Xác nhận xuất đàn' }))
    expect(await screen.findByText('/herd-exit/PX-2026-0008|Đã xác nhận phiếu PX-2026-0008: 1 con đã rời đàn.')).toBeInTheDocument()
  })

  it('dismisses even when the checks failed to load and returns to the list with the reopened-case notice', async () => {
    apiState.checks.mockReset().mockRejectedValue(new Error('down'))
    apiState.dismissed.mockResolvedValue({ voucher: { ...pendingDeath, status: 'Đã bác' }, message: '' })
    const user = userEvent.setup()
    function Notice() { const location = useLocation(); return <div>{`list|${(location.state as { notice?: string } | null)?.notice ?? ''}`}</div> }
    render(<MemoryRouter initialEntries={['/herd-exit/PX-2026-0008']}><Routes>
      <Route path="/herd-exit/PX-2026-0008" element={<DeathView row={{ ...pendingDeath, detail: { ...pendingDeath.detail, sourceHealthCaseCode: 'HC-0418' } }} onReload={vi.fn()} />} />
      <Route path="/herd-exit" element={<Notice />} />
    </Routes></MemoryRouter>)
    await screen.findByText(/Không tải được kiểm tra/)
    await user.click(screen.getByRole('button', { name: 'Bác đề xuất' }))
    await user.type(screen.getAllByRole('textbox').at(-1)!, 'Bò còn sống')
    await user.click(screen.getAllByRole('button', { name: 'Bác đề xuất' }).at(-1)!)
    expect(apiState.dismissed).toHaveBeenCalledWith(pendingDeath.id, 'Bò còn sống', 7, 8)
    expect(await screen.findByText('list|Đã bác phiếu PX-2026-0008. BC-000156 vẫn ở trong đàn; ca HC-0418 đã mở lại.')).toBeInTheDocument()
  })

  it('requires text for "Khác" disposal, sends "Khác: …" and never writes history or a hardcoded name', async () => {
    apiState.saved.mockResolvedValue({ ...pendingDeath, status: 'Nháp' })
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={pendingDeath} onReload={vi.fn()} /></MemoryRouter>)
    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByLabelText('Khác'))
    expect(screen.getByText('Nội dung xử lý xác là bắt buộc.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu và kiểm tra lại' })).toBeDisabled()
    await user.type(screen.getByLabelText('Xử lý xác khác'), 'Giao cơ sở xử lý')
    await user.click(screen.getByRole('button', { name: 'Lưu và kiểm tra lại' }))
    const request = apiState.saved.mock.calls[0][0]
    expect(request.record.detail.disposal).toBe('Khác: Giao cơ sở xử lý')
    expect(request.record.detail.history).toEqual([])
    expect(JSON.stringify(request)).not.toContain('N. V. Hùng')
  })

  it('reads a stored free-text disposal back as "Khác" and blocks an empty cause', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={{ ...pendingDeath, detail: { ...pendingDeath.detail, disposal: 'Khác: Bán cho cơ sở chế biến' } }} onReload={vi.fn()} /></MemoryRouter>)
    await screen.findByText('Cảnh báo cần xem')
    expect(screen.getByLabelText('Khác')).toBeChecked()
    expect(screen.getByLabelText('Xử lý xác khác')).toHaveValue('Bán cho cơ sở chế biến')
    expect(screen.getByRole('textbox', { name: 'Nguyên nhân / ghi chú' })).toHaveAttribute('maxlength', '1000')
    await user.clear(screen.getByRole('textbox', { name: 'Nguyên nhân / ghi chú' }))
    expect(screen.getByText('Nguyên nhân / ghi chú là bắt buộc.')).toBeInTheDocument()
  })

  it('shows "Chủ trại ghi trực tiếp" without a source case, and links the source case otherwise', async () => {
    const { detail } = pendingDeath
    const direct = { ...pendingDeath, detail: { ...detail, sourceHealthCaseId: undefined, source: '' } }
    const { unmount } = render(<MemoryRouter><DeathView row={direct} onReload={vi.fn()} /></MemoryRouter>)
    await screen.findByText('Cảnh báo cần xem')
    expect(screen.getByText('Chủ trại ghi trực tiếp')).toBeInTheDocument()
    expect(screen.queryByText(/Tạo tự động khi ca sức khỏe đóng/)).not.toBeInTheDocument()
    expect(screen.getByText('~180 kg · UT')).toBeInTheDocument()
    unmount()
    render(<MemoryRouter><DeathView row={pendingDeath} onReload={vi.fn()} /></MemoryRouter>)
    expect(await screen.findByRole('link', { name: 'Ca sức khỏe HC-0418' })).toHaveAttribute('href', '/cattle/BC-000156?tab=health')
  })
})
