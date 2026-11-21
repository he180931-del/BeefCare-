import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HerdExit } from '../../../src/types'

const apiState = vi.hoisted(() => ({
  checks: vi.fn(),
  confirmed: vi.fn(),
  dismissed: vi.fn(),
  saved: vi.fn(),
  removedAttachment: vi.fn(),
}))

vi.mock('../../../src/features/herd-exit/api/index', () => ({
  herdExitApi: { checks: apiState.checks },
  confirmHerdExit: apiState.confirmed,
  dismissHerdExit: apiState.dismissed,
  downloadExitAttachment: vi.fn(),
  removeExitAttachment: apiState.removedAttachment,
  saveHerdExit: apiState.saved,
}))

import DeathView from '../../../src/features/herd-exit/components/DeathView'

const pendingDeath: HerdExit = {
  id: 'PX-2026-0008', date: '2026-10-21', type: 'Chết / mất', status: 'Chờ xác nhận', who: 'Ca HC-0418', count: 1,
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
  apiState.confirmed.mockResolvedValue({ ...pendingDeath, status: 'Đã xuất' })
})

describe('pending death/missing exit checks', () => {
  it('keeps the health-case loss kind read-only', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={pendingDeath} /></MemoryRouter>)

    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByText('Mất tích'))

    expect(screen.getByText('Nguyên nhân / ghi chú *')).toBeInTheDocument()
    expect(screen.queryByText('Nguyên nhân mất tích *')).not.toBeInTheDocument()
  })

  it('loads real checks, requires acknowledgement, and confirms with the checks version', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={pendingDeath} /></MemoryRouter>)

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
    render(<MemoryRouter><DeathView row={row} /></MemoryRouter>)

    await screen.findByText('Cảnh báo cần xem')
    const file = new File(['%PDF-1.4\n%%EOF\n'], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Thêm chứng từ bằng chứng'), { target: { files: [file] } })
    await user.click(screen.getByRole('button', { name: 'Lưu chứng từ (1)' }))

    expect(apiState.saved).toHaveBeenCalledWith(expect.objectContaining({ id: row.id, documents: [file] }))
    await user.click(screen.getByRole('button', { name: 'Xóa old-report.pdf' }))
    expect(apiState.removedAttachment).toHaveBeenCalledWith(row.id, 91)
  })

  it('dismisses a pending proposal with the live checks version', async () => {
    apiState.dismissed.mockResolvedValue({ ...pendingDeath, status: 'Đã bác' })
    const user = userEvent.setup()
    render(<MemoryRouter><DeathView row={pendingDeath} /></MemoryRouter>)

    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByRole('button', { name: 'Bác đề xuất' }))
    await user.type(screen.getAllByRole('textbox').at(-1)!, 'Ca sức khỏe sai')
    await user.click(screen.getAllByRole('button', { name: 'Bác đề xuất' }).at(-1)!)

    expect(apiState.dismissed).toHaveBeenCalledWith(pendingDeath.id, 'Ca sức khỏe sai', 7)
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
    render(<MemoryRouter><DeathView row={pendingDeath} /></MemoryRouter>)

    await screen.findByText('Cảnh báo cần xem')
    await user.click(screen.getByLabelText(/Tôi đã xem các mục trên/))
    const date = screen.getAllByLabelText('Chọn ngày')[0]
    fireEvent.change(date, { target: { value: '2026-10-22' } })

    expect(screen.getByLabelText(/Tôi đã xem các mục trên/)).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Xác nhận xuất đàn' })).toBeDisabled()
    expect(apiState.confirmed).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Kiểm tra lại' }))
    expect(apiState.checks).toHaveBeenCalledTimes(2)
    expect(apiState.saved).toHaveBeenCalledTimes(1)
    await user.click(screen.getByLabelText(/Tôi đã xem các mục trên/))
    await user.click(screen.getByRole('button', { name: 'Xác nhận xuất đàn' }))

    expect(apiState.saved).toHaveBeenCalledTimes(1)
    expect(apiState.confirmed).toHaveBeenCalledWith(pendingDeath.id, 8)
  })
})
