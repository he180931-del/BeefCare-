import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackendError } from '../../../src/api/backendClient'
import { platformAdminApi } from '../../../src/features/platform-admin/api/platformAdminApi'
import AccountStatusDialog, { statusChangeOutcome } from '../../../src/features/platform-admin/components/AccountStatusDialog'
import type { AccountDetail } from '../../../src/features/platform-admin/types'

const account: AccountDetail = {
  id: 12, email: 'an@x.vn', fullName: 'An', accountStatus: 'ACTIVE', platformRole: 'CS', platformAccessStatus: 'ACTIVE', emailVerified: true,
  farmCount: 0, farmRoles: [], platformAccessVersion: 1, signInMethods: ['GOOGLE'], createdAt: '2025-01-15T02:30:00Z', lastSignInAt: null,
  ownerRegistrationCompleted: false, ownerRegistrationCompletedAt: null, ownedFarms: [], version: 4, actions: ['SUSPEND'],
}

const backendError = (status: number, code: string, params: Record<string, unknown> = {}) => new BackendError(status, { code, params })

afterEach(() => { vi.restoreAllMocks() })

describe('A12: phân loại lỗi (D32)', () => {
  it('lỗi nghiệp vụ đóng hộp thoại và tải lại; lỗi lý do về trường; lỗi lưu / mạng giữ hộp thoại', () => {
    expect(statusChangeOutcome(backendError(409, 'MSG-FE03-20', { target: 'an@x.vn', value: 'status' }), 'x@x.vn'))
      .toEqual({ kind: 'refused', message: 'Không có thay đổi: an@x.vn đã ở trạng thái này.' })
    expect(statusChangeOutcome(backendError(409, 'MSG-FE03-17'), 'an@x.vn')).toMatchObject({ kind: 'refused', message: /Phải luôn còn ít nhất một System Admin/ })
    expect(statusChangeOutcome(backendError(409, 'MSG-COM-05'), 'an@x.vn')).toMatchObject({ kind: 'refused', message: /đã được thay đổi/ })
    expect(statusChangeOutcome(backendError(404, 'MSG-COM-08'), 'an@x.vn')).toMatchObject({ kind: 'refused', message: /không còn khả dụng/ })
    expect(statusChangeOutcome(backendError(403, 'MSG-COM-01'), 'an@x.vn')).toMatchObject({ kind: 'refused' })
    expect(statusChangeOutcome(backendError(400, 'MSG-COM-10', { field: 'reason' }), 'an@x.vn')).toMatchObject({ kind: 'field', message: /từ 5 đến 500/ })
    expect(statusChangeOutcome(backendError(400, 'MSG-COM-06', { field: 'reason' }), 'an@x.vn')).toEqual({ kind: 'field', message: 'Lý do là bắt buộc.' })
    expect(statusChangeOutcome(backendError(500, 'MSG-COM-02'), 'an@x.vn').kind).toBe('retry')
    expect(statusChangeOutcome(new TypeError('Failed to fetch'), 'an@x.vn').kind).toBe('retry')
  })
})

function renderDialog(overrides: Partial<Parameters<typeof AccountStatusDialog>[0]> = {}) {
  const props = { account, reason: 'Nghi ngờ lộ mật khẩu', onReason: vi.fn(), onClose: vi.fn(), onDone: vi.fn(), onRefused: vi.fn(), ...overrides }
  render(<MemoryRouter><AccountStatusDialog {...props} /></MemoryRouter>)
  return props
}

describe('Hộp thoại Tạm ngưng tài khoản (UC8, D32)', () => {
  it('lỗi lưu giữ hộp thoại và thử lại bằng cùng Idempotency-Key; thành công báo MSG-FE03-16', async () => {
    const user = userEvent.setup()
    const suspend = vi.spyOn(platformAdminApi, 'suspendAccount')
      .mockRejectedValueOnce(backendError(500, 'MSG-COM-02'))
      .mockResolvedValueOnce({ ...account, accountStatus: 'SUSPENDED', version: 5, actions: ['RESTORE'] })
    const props = renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Tạm ngưng tài khoản' })
    expect(within(dialog).getByText('Tạm ngưng tài khoản an@x.vn? Người dùng sẽ không đăng nhập được.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Tạm ngưng tài khoản' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(props.onRefused).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Tạm ngưng tài khoản' }))

    expect(suspend).toHaveBeenCalledTimes(2)
    const [first, second] = suspend.mock.calls
    expect(first[1]).toEqual({ reason: 'Nghi ngờ lộ mật khẩu', expectedVersion: 4 })
    expect(first[2]).toEqual(expect.any(String))
    expect(second[2]).toBe(first[2])
    expect(props.onDone).toHaveBeenCalledWith('Tài khoản an@x.vn hiện là Tạm ngưng.')
  })

  it('lỗi nghiệp vụ gọi onRefused; lần gửi sau dùng khóa mới', async () => {
    const user = userEvent.setup()
    const suspend = vi.spyOn(platformAdminApi, 'suspendAccount')
      .mockRejectedValueOnce(backendError(409, 'MSG-COM-05'))
      .mockRejectedValueOnce(backendError(500, 'MSG-COM-02'))
    const props = renderDialog()
    const confirm = screen.getByRole('button', { name: 'Tạm ngưng tài khoản' })
    await user.click(confirm)
    expect(props.onRefused).toHaveBeenCalledWith(expect.stringMatching(/đã được thay đổi/))
    await user.click(confirm)
    expect(suspend.mock.calls[1][2]).not.toBe(suspend.mock.calls[0][2])
  })

  it('khôi phục: câu MSG-FE03-15 và lý do quá ngắn không gửi lệnh', async () => {
    const user = userEvent.setup()
    const restore = vi.spyOn(platformAdminApi, 'restoreAccount')
    renderDialog({ account: { ...account, accountStatus: 'SUSPENDED', actions: ['RESTORE'] }, reason: 'abc' })
    const dialog = screen.getByRole('dialog', { name: 'Khôi phục tài khoản' })
    expect(within(dialog).getByText('Khôi phục tài khoản an@x.vn? Các vai trò và membership đã thu hồi sẽ không được trả lại.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Khôi phục tài khoản' }))
    expect(within(dialog).getByText(/Lý do cần từ 5 đến 500 ký tự/)).toBeInTheDocument()
    expect(restore).not.toHaveBeenCalled()
  })
})
