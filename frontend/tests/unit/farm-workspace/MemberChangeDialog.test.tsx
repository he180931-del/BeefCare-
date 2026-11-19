import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackendError } from '../../../src/api/backendClient'
import { MemberChangeDialog } from '../../../src/features/farm-workspace/components/MemberChangeDialog'
import type { MemberAction, Membership } from '../../../src/features/farm-workspace/types'
import { farmToday, MEMBER_REASON_RULE, validateMemberChange } from '../../../src/features/farm-workspace/validation'

const api = vi.hoisted(() => ({ changeMember: vi.fn() }))
vi.mock('../../../src/features/farm-workspace/api/farmWorkspaceApi', () => ({ farmWorkspaceApi: api }))

const manager: Membership = { id: 52, userId: 8, fullName: 'Trần Quốc Long', email: 'long@example.test', role: 'MANAGER', status: 'ACTIVE', joinedAt: '2024-05-02T02:00:00Z', version: 4, actions: ['CHANGE_ROLE', 'DEACTIVATE'] }
const inactive: Membership = { ...manager, id: 53, fullName: 'Bùi Văn Khoa', email: 'khoa@example.test', role: 'TECHNICIAN', status: 'INACTIVE', version: 2, actions: ['REACTIVATE'] }
const handlers = { onClose: vi.fn(), onDone: vi.fn(), onStale: vi.fn() }
const open = (member: Membership, initialAction?: MemberAction, active = true) => render(
  <MemberChangeDialog farmId={401} farmName="Trại kiểm thử" timeZone="Asia/Ho_Chi_Minh" member={member} initialAction={initialAction} active={active} {...handlers} />,
)
async function fillAndReview(reason = 'Sắp xếp lại công việc') {
  const user = userEvent.setup()
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Lý do * (5–500 ký tự)'), reason)
  await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
  return { user, dialog }
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  api.changeMember.mockResolvedValue({ ...manager, version: 5 })
})

describe('UC-FE03-06 popup (D30)', () => {
  it('asks MSG-FE03-11 before deactivating and sends the version seen, then reports MSG-FE03-13', async () => {
    open(manager, 'DEACTIVATE')
    const { user, dialog } = await fillAndReview('  Nghỉ việc cuối tháng  ')
    expect(within(dialog).getByText('Ngưng Trần Quốc Long? Người này sẽ mất quyền vào Trại kiểm thử từ thao tác kế tiếp.')).toBeInTheDocument()
    expect(api.changeMember).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    expect(api.changeMember).toHaveBeenCalledWith(401, 52, { action: 'DEACTIVATE', role: undefined, effectiveDate: farmToday(), reason: 'Nghỉ việc cuối tháng' }, { expectedVersion: 4, idempotencyKey: expect.any(String) })
    expect(handlers.onDone).toHaveBeenCalledWith('Đã cập nhật thành viên Trần Quốc Long.')
  })

  it('asks MSG-FE03-12 with the old and new role, and lets the Owner go back without saving', async () => {
    open(manager)
    const { user, dialog } = await fillAndReview()
    expect(within(dialog).getByText('Đổi Trần Quốc Long từ Quản lý sang Kỹ thuật viên? Quyền mới áp dụng từ thao tác kế tiếp.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
    expect(within(dialog).getByRole('button', { name: 'Lưu thay đổi' })).toBeInTheDocument()
    expect(api.changeMember).not.toHaveBeenCalled()
  })

  it('confirms a reactivation with the current role and farm', async () => {
    open(inactive)
    expect(screen.getByRole('dialog', { name: 'Kích hoạt lại thành viên' })).toBeInTheDocument()
    // Shown as wrapping text, not a one-line read-only input that cuts the role and status off on phones.
    const memberInfo = screen.getByLabelText('Thành viên')
    expect(memberInfo.tagName).not.toBe('INPUT')
    expect(memberInfo).toHaveTextContent('Bùi Văn Khoa · khoa@example.test · Kỹ thuật viên · Đã ngưng')
    const { dialog } = await fillAndReview('Quay lại làm việc')
    expect(within(dialog).getByText('Kích hoạt lại Bùi Văn Khoa với vai trò Kỹ thuật viên? Người này vào lại Trại kiểm thử từ thao tác kế tiếp.')).toBeInTheDocument()
  })

  it.each(['MSG-FE03-20', 'MSG-FE03-04', 'MSG-COM-05', 'MSG-COM-08'])('hands %s back to the list without retrying', async (code) => {
    api.changeMember.mockRejectedValue(new BackendError(code === 'MSG-COM-08' ? 404 : code === 'MSG-FE03-04' ? 403 : 409, { code }))
    open(manager, 'DEACTIVATE')
    const { user, dialog } = await fillAndReview()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    expect(handlers.onStale).toHaveBeenCalledTimes(1)
    expect(api.changeMember).toHaveBeenCalledTimes(1)
    expect(handlers.onDone).not.toHaveBeenCalled()
  })

  it('keeps the confirmation and the same key after a network failure', async () => {
    api.changeMember.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    open(manager, 'DEACTIVATE')
    const { user, dialog } = await fillAndReview()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    expect(await within(dialog).findByText('Failed to fetch')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    expect(api.changeMember).toHaveBeenCalledTimes(2)
    expect(api.changeMember.mock.calls[1][3].idempotencyKey).toBe(api.changeMember.mock.calls[0][3].idempotencyKey)
    expect(handlers.onDone).toHaveBeenCalledTimes(1)
  })

  it('shows a server field error under its field', async () => {
    api.changeMember.mockRejectedValue(new BackendError(400, { code: 'MSG-COM-10', params: { field: 'reason' } }))
    open(manager, 'DEACTIVATE')
    const { user, dialog } = await fillAndReview()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    expect(await within(dialog).findByText(MEMBER_REASON_RULE)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Lưu thay đổi' })).toBeInTheDocument()
  })

  it('asks MSG-COM-14 before discarding entered data and closes at once when nothing was entered', async () => {
    const user = userEvent.setup()
    const view = open(manager)
    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
    view.unmount()
    open(manager)
    await user.type(screen.getByLabelText('Lý do * (5–500 ký tự)'), 'Đang nhập dở')
    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.getByText('Bỏ thông tin đã nhập?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tiếp tục nhập' }))
    expect(screen.getByLabelText('Lý do * (5–500 ký tự)')).toHaveValue('Đang nhập dở')
    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    await user.click(screen.getByRole('button', { name: 'Bỏ' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(2)
    expect(api.changeMember).not.toHaveBeenCalled()
  })

  it('keeps only Deactivate usable while the farm is not ACTIVE', async () => {
    const view = open(manager, 'DEACTIVATE', false)
    expect(screen.getByRole('button', { name: 'Đổi vai trò' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled()
    view.unmount()
    open(inactive, undefined, false)
    expect(screen.getByText('Mời thành viên, đổi vai trò và kích hoạt lại cần trại đang hoạt động (ACTIVE).')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
  })
})

describe('UC6 input rules (D30, Table III-1)', () => {
  const base = { action: 'DEACTIVATE' as const, effectiveDate: '2026-11-14', reason: 'Nghỉ việc' }
  it('checks the reason, the date and the new role like the server', () => {
    expect(validateMemberChange(base, '2026-11-14')).toEqual({})
    expect(validateMemberChange({ ...base, reason: '   ' }, '2026-11-14').reason).toBe('Lý do là bắt buộc.')
    expect(validateMemberChange({ ...base, reason: 'a b c d' }, '2026-11-14').reason).toBe(MEMBER_REASON_RULE)
    expect(validateMemberChange({ ...base, reason: ' ab cde ' }, '2026-11-14').reason).toBeUndefined()
    expect(validateMemberChange({ ...base, reason: 'x'.repeat(501) }, '2026-11-14').reason).toBe(MEMBER_REASON_RULE)
    expect(validateMemberChange({ ...base, effectiveDate: '' }, '2026-11-14').effectiveDate).toBe('Ngày hiệu lực là bắt buộc.')
    expect(validateMemberChange({ ...base, effectiveDate: '2026-11-15' }, '2026-11-14').effectiveDate).toBe('Ngày hiệu lực không được ở tương lai.')
    expect(validateMemberChange({ ...base, effectiveDate: '2020-01-01' }, '2026-11-14').effectiveDate).toBeUndefined()
    expect(validateMemberChange({ ...base, action: 'CHANGE_ROLE' }, '2026-11-14').role).toBe('Chọn vai trò mới.')
  })

  it('takes "today" in the farm time zone', () => {
    const now = new Date('2026-10-28T12:00:00Z')
    expect(farmToday(now)).toBe('2026-10-28')
    expect(farmToday(new Date('2026-10-28T17:00:00Z'))).toBe('2026-10-29')
  })
})
