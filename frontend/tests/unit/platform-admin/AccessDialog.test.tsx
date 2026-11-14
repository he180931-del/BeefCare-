import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackendError } from '../../../src/api/backendClient'
import { platformAdminApi } from '../../../src/features/platform-admin/api/platformAdminApi'
import AccessDialog from '../../../src/features/platform-admin/components/AccessDialog'
import type { AccountDetail } from '../../../src/features/platform-admin/types'

const account: AccountDetail = {
  id: 12, email: 'an@x.vn', fullName: 'An', accountStatus: 'ACTIVE', platformRole: 'CS', platformAccessStatus: 'ACTIVE', emailVerified: true,
  farmCount: 0, farmRoles: [], platformAccessVersion: 3, signInMethods: ['GOOGLE'], createdAt: '2025-01-15T02:30:00Z', lastSignInAt: null,
  ownerRegistrationCompleted: false, ownerRegistrationCompletedAt: null, ownedFarms: [], version: 4, actions: ['SUSPEND'], accessActions: ['CHANGE', 'REVOKE'],
}

const backendError = (status: number, code: string, params: Record<string, unknown> = {}) => new BackendError(status, { code, params })

afterEach(() => { vi.restoreAllMocks() })

function renderDialog(overrides: Partial<Parameters<typeof AccessDialog>[0]> = {}) {
  const props = { account, onClose: vi.fn(), onDone: vi.fn(), onRefused: vi.fn(), ...overrides }
  render(<MemoryRouter><AccessDialog {...props} /></MemoryRouter>)
  return props
}

describe('Popup quyền nhân viên nền tảng (UC9, D33)', () => {
  it('hành động theo accessActions; lịch sử A11 (đổi vai trò, người làm, dòng không có người làm, giờ Asia/Ho_Chi_Minh)', async () => {
    vi.spyOn(platformAdminApi, 'accountHistory').mockResolvedValue([
      { id: 2, action: 'CHANGE', roleBefore: 'PM', statusBefore: 'ACTIVE', roleAfter: 'CS', statusAfter: 'ACTIVE', reason: 'Đổi nhóm', byName: 'Nam', byEmail: 'nam@x.vn', at: '2026-11-01T01:00:00Z' },
      { id: 1, action: 'GRANT', roleBefore: null, statusBefore: null, roleAfter: 'PM', statusAfter: 'ACTIVE', reason: 'Bổ sung', byName: null, byEmail: null, at: '2026-10-01T01:00:00Z' },
    ])
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    expect(within(dialog).getByLabelText('Đổi vai trò')).toBeChecked()
    expect(within(dialog).getByLabelText('Thu hồi quyền')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Cấp quyền')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Đổi sang PM' })).toBeInTheDocument()
    expect(await within(dialog).findByText(/PM → CS · Đổi nhóm · Nam · 01\/11\/2026 08:00/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Bổ sung · Hệ thống · 01\/10\/2026 08:00/)).toBeInTheDocument()
  })

  it('lỗi lưu giữ popup và thử lại bằng cùng Idempotency-Key; thành công MSG-FE03-19', async () => {
    const user = userEvent.setup()
    vi.spyOn(platformAdminApi, 'accountHistory').mockResolvedValue([])
    const change = vi.spyOn(platformAdminApi, 'changePlatformAccess')
      .mockRejectedValueOnce(backendError(500, 'MSG-COM-02'))
      .mockResolvedValueOnce({ ...account, platformAccessStatus: 'REVOKED', platformAccessVersion: 4, accessActions: ['RESTORE'] })
    const props = renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    await user.click(within(dialog).getByLabelText('Thu hồi quyền'))
    await user.type(within(dialog).getByPlaceholderText(/Nhập lý do/), '  Nghỉ việc  ')
    await user.click(within(dialog).getByRole('button', { name: 'Thu hồi quyền CS' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Thu hồi quyền CS' }))

    expect(change).toHaveBeenCalledTimes(2)
    const [first, second] = change.mock.calls
    expect(first[1]).toEqual({ operation: 'REVOKE', role: undefined, reason: 'Nghỉ việc', expectedVersion: 3 })
    expect(second[2]).toBe(first[2])
    expect(props.onDone).toHaveBeenCalledWith('Quyền CS của an@x.vn đã được thu hồi.')
  })

  it('lỗi nghiệp vụ (FE03-22, COM-05…) gọi onRefused để đóng popup và tải lại', async () => {
    const user = userEvent.setup()
    vi.spyOn(platformAdminApi, 'accountHistory').mockResolvedValue([])
    vi.spyOn(platformAdminApi, 'changePlatformAccess').mockRejectedValueOnce(backendError(409, 'MSG-FE03-22', { email: 'an@x.vn' }))
    const props = renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    await user.type(within(dialog).getByPlaceholderText(/Nhập lý do/), 'Đổi nhóm làm việc')
    await user.click(within(dialog).getByRole('button', { name: 'Đổi sang PM' }))
    expect(props.onRefused).toHaveBeenCalledWith('Tài khoản an@x.vn đang tạm ngưng. Hãy khôi phục tài khoản trước khi cấp, đổi hoặc khôi phục quyền.')
  })

  it('tài khoản bị tạm ngưng không có thao tác: hiện MSG-FE03-22, chỉ nút Đóng', async () => {
    vi.spyOn(platformAdminApi, 'accountHistory').mockResolvedValue([])
    renderDialog({ account: { ...account, accountStatus: 'SUSPENDED', platformAccessStatus: 'REVOKED', accessActions: [] } })
    const dialog = screen.getByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    expect(within(dialog).getByText(/an@x\.vn đang tạm ngưng/)).toBeInTheDocument()
    expect(within(dialog).queryByPlaceholderText(/Nhập lý do/)).not.toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: 'Đóng' }).length).toBeGreaterThan(1) // ✕ và nút Đóng ở chân popup
    expect(within(dialog).queryByRole('button', { name: /Thu hồi|Đổi sang|Cấp quyền|Khôi phục/ })).not.toBeInTheDocument()
  })
})
