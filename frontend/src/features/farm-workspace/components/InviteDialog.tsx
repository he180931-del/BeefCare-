import { useState, type FormEvent } from 'react'
import { BackendError } from '../../../api/backendClient'
import { Icon } from '../../../components/Icon'
import Modal, { ModalFooter } from '../../../components/Modal'
import { Button, Field, inputCls, Note, Segmented, Select } from '../../../components/ui'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { useRequestKey } from '../hooks/useRequestKey'
import type { FarmRole, Invitation, InviteMemberInput, Membership } from '../types'
import { validateInvite, type FormErrors } from '../validation'
import { PermissionChecklist } from './PermissionChecklist'
import { MemberChangeDialog } from './MemberChangeDialog'
import { farmWorkspaceError, FieldError, invitationNotice, roleLabel } from './WorkspaceUi'

const fullWidth = '[&>div]:flex [&>div]:w-full [&_button]:flex-1'
type Alternative = { kind: 'resend'; invitation: Invitation } | { kind: 'reactivate'; member: Membership }

/** UC-FE03-01 (popup "Invite Member"), mở bằng `?m=invite` từ Thành viên và Lời mời. */
export function InviteDialog({ farmId, farmName, timeZone, active, onClose, onSent }: {
  farmId: number; farmName?: string; timeZone?: string; active: boolean; onClose: () => void; onSent: (message: string) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<FarmRole, 'OWNER'> | ''>('')
  const [validityDays, setValidityDays] = useState<3 | 7 | 14>(7)
  const [errors, setErrors] = useState<FormErrors<InviteMemberInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [alternative, setAlternative] = useState<Alternative | null>(null)
  const [reactivating, setReactivating] = useState<Membership | null>(null)
  const [discarding, setDiscarding] = useState(false)
  const createKey = useRequestKey(`invite:${farmId}`)
  const resendKey = useRequestKey(`invite-resend:${farmId}`)

  const close = () => {
    if (saving) return
    if (email || role || validityDays !== 7) setDiscarding(true)
    else onClose()
  }
  const discard = () => { createKey.clear(); resendKey.clear(); onClose() }
  const done = (message: string) => { createKey.clear(); resendKey.clear(); onSent(message) }

  const showFailure = async (reason: unknown) => {
    if (reason instanceof BackendError) {
      if (reason.code === 'MSG-FE03-02') { setErrors({ email: farmWorkspaceError(reason, '') }); return }
      // Load the existing row before offering a command; its version remains fixed until the Owner confirms.
      if (reason.code === 'MSG-FE03-03') {
        const invitationId = Number(reason.params.invitationId)
        if (!Number.isSafeInteger(invitationId) || invitationId < 1) throw new Error('Không xác định được lời mời. Tải lại danh sách rồi thử lại.')
        const result = await farmWorkspaceApi.listInvitations(farmId, { invitationId })
        const existing = result.items.find((row) => row.id === invitationId)
        if (!existing || existing.status !== 'PENDING') throw new Error('Lời mời đã thay đổi. Tải lại danh sách rồi thử lại.')
        setAlternative({ kind: 'resend', invitation: existing }); return
      }
      if (reason.code === 'MSG-FE03-21') {
        // A1 is the whole member list (D29), so the inactive membership named by MSG-FE03-21 is always in it.
        const { items } = await farmWorkspaceApi.listMembers(farmId)
        const existing = items.find((row) => row.id === Number(reason.params.membershipId))
        if (!existing || existing.status !== 'INACTIVE') throw new Error('Thành viên đã thay đổi. Tải lại danh sách rồi thử lại.')
        setAlternative({ kind: 'reactivate', member: existing }); return
      }
    }
    setError(farmWorkspaceError(reason, 'Không thể gửi lời mời.'))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || alternative?.kind === 'reactivate') return
    const input = { email: email.trim().toLowerCase(), role, validityDays } as Partial<InviteMemberInput>
    const next = validateInvite(input)
    setErrors(next); setError(null)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      if (alternative?.kind === 'resend') {
        const { id, version } = alternative.invitation
        const result = await farmWorkspaceApi.resendInvitation(farmId, id, { expectedVersion: version, idempotencyKey: resendKey.keyFor({ id, version }) })
        done(invitationNotice(result, true, timeZone))
      } else {
        const created = await farmWorkspaceApi.inviteMember(farmId, input as InviteMemberInput, { idempotencyKey: createKey.keyFor(input) })
        done(invitationNotice(created, false, timeZone))
      }
    } catch (reason) {
      try { await showFailure(reason) }
      catch (loadError) { setError(farmWorkspaceError(loadError, 'Không tải được lời mời hoặc thành viên hiện tại.')) }
    }
    finally { setSaving(false) }
  }

  if (reactivating) return <MemberChangeDialog farmId={farmId} member={reactivating} initialAction="REACTIVATE" active={active} onClose={() => setReactivating(null)} onDone={done} />

  return (
    <Modal title="Mời thành viên" sub={farmName} width={560} onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Note tone="err">{error}</Note>}
        {!active && <Note tone="warn">Lời mời, đổi vai trò và kích hoạt lại cần dịch vụ trang trại đang hoạt động.</Note>}
        <Field label="Thư điện tử người nhận *" id="invite-email">
          <input id="invite-email" type="email" maxLength={254} autoComplete="email" placeholder="ten@example.com" value={email} disabled={saving} onChange={(event) => { setEmail(event.target.value); setAlternative(null) }} className={inputCls} />
          <FieldError>{errors.email}</FieldError>
        </Field>
        <Field label="Vai trò *">
          <div className={fullWidth}><Segmented value={role} onChange={(value) => { setRole(value as Exclude<FarmRole, 'OWNER'>); setAlternative(null) }} options={[{ value: 'MANAGER', label: 'Quản lý', disabled: saving }, { value: 'TECHNICIAN', label: 'Kỹ thuật viên', disabled: saving }]} /></div>
          <FieldError>{errors.role}</FieldError>
        </Field>
        <Field label="Quyền của vai trò">
          {role
            ? <div className="max-h-48 overflow-y-auto rounded-lg bg-page p-3"><PermissionChecklist role={role} /></div>
            : <p className="m-0 flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" disabled aria-hidden="true" className="size-3.5" />Chọn vai trò để xem các quyền cố định.</p>}
        </Field>
        <Field label="Hết hạn sau" id="invite-validity">
          <Select className="[&_select]:!bg-white" id="invite-validity" value={validityDays} disabled={saving} onChange={(event) => { setValidityDays(Number(event.target.value) as 3 | 7 | 14); setAlternative(null) }}>
            <option value={3}>3 ngày</option><option value={7}>7 ngày</option><option value={14}>14 ngày</option>
          </Select>
        </Field>
        {alternative?.kind === 'resend' && <Note tone="warn"><p className="m-0">Đã có lời mời đang chờ cho email này.</p><p className="mb-0">Gửi lại lời mời cho {alternative.invitation.email} với vai trò {roleLabel(alternative.invitation.role)}, hiệu lực {alternative.invitation.validityDays} ngày?</p></Note>}
        {alternative?.kind === 'reactivate' && <Note tone="warn">{alternative.member.email} là thành viên đã ngưng. Kích hoạt lại thay vì mời? Vai trò hiện tại: {roleLabel(alternative.member.role)}.</Note>}
        {discarding && <Note tone="warn">Hủy thay đổi? Dữ liệu đã nhập sẽ không được lưu.</Note>}
        <ModalFooter compact>
          {discarding ? <>
            <Button size="lg" onClick={() => setDiscarding(false)}>Tiếp tục nhập</Button>
            <Button size="lg" variant="danger" onClick={discard}>Hủy thay đổi</Button>
          </> : <>
            <Button size="lg" disabled={saving} onClick={close}>Hủy</Button>
            {alternative && <Button size="lg" disabled={saving} onClick={() => setAlternative(null)}>Quay lại</Button>}
            {alternative?.kind === 'reactivate'
              ? <Button size="lg" variant="primary" disabled={saving || !active} onClick={() => setReactivating(alternative.member)}>Kích hoạt lại</Button>
              : <Button size="lg" variant="primary" type="submit" disabled={saving || !active}><Icon name="send" size={16} />{saving ? 'Đang gửi…' : alternative?.kind === 'resend' ? 'Gửi lại' : 'Gửi lời mời'}</Button>}
          </>}
        </ModalFooter>
      </form>
    </Modal>
  )
}
