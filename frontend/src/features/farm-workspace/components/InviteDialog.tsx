import { useState, type FormEvent } from 'react'
import { Icon } from '../../../components/Icon'
import Modal, { ModalFooter } from '../../../components/Modal'
import { Button, Field, inputCls, Note, Segmented, Select } from '../../../components/ui'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import type { FarmRole, InviteMemberInput } from '../types'
import { validateInvite, type FormErrors } from '../validation'
import { PermissionChecklist } from './PermissionChecklist'
import { farmWorkspaceError, FieldError, formatDate, roleLabel } from './WorkspaceUi'

const fullWidth = '[&>div]:flex [&>div]:w-full [&_button]:flex-1'

/** UC-FE03-01 (popup "Invite Member"), mở bằng `?m=invite` từ Thành viên và Lời mời. */
export function InviteDialog({ farmId, farmName, active, onClose, onSent }: {
  farmId: number; farmName?: string; active: boolean; onClose: () => void; onSent: (message: string) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<FarmRole, 'OWNER'> | ''>('')
  const [validityDays, setValidityDays] = useState<3 | 7 | 14>(7)
  const [errors, setErrors] = useState<FormErrors<InviteMemberInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const input = { email, role, validityDays } as Partial<InviteMemberInput>
    const next = validateInvite(input)
    setErrors(next); setError(null)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const created = await farmWorkspaceApi.inviteMember(farmId, { ...(input as InviteMemberInput), email: email.trim() })
      onSent(`Đã gửi lời mời tới ${created.email}. Lời mời hết hạn vào ${formatDate(created.expiresAt)}.`)
    } catch (reason) { setError(farmWorkspaceError(reason, 'Không thể gửi lời mời.')) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Mời thành viên" sub={farmName} width={560} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Note tone="err">{error}</Note>}
        {!active && <Note tone="warn">Lời mời, đổi vai trò và kích hoạt lại cần dịch vụ trang trại đang hoạt động.</Note>}
        <Field label="Thư điện tử người nhận *" id="invite-email">
          <input id="invite-email" type="email" maxLength={254} autoComplete="email" placeholder="phamtuan.kt@gmail.com" value={email} onChange={(event) => setEmail(event.target.value)} className={inputCls} />
          <FieldError>{errors.email}</FieldError>
        </Field>
        <Field label="Vai trò *">
          <div className={fullWidth}><Segmented value={role} onChange={(value) => setRole(value as Exclude<FarmRole, 'OWNER'>)} options={[{ value: 'MANAGER', label: 'Quản lý' }, { value: 'TECHNICIAN', label: 'Kỹ thuật viên' }]} /></div>
          <FieldError>{errors.role}</FieldError>
        </Field>
        <Field label="Quyền của vai trò">
          {role
            ? <div className="max-h-48 overflow-y-auto rounded-lg bg-page p-3"><PermissionChecklist role={role} /></div>
            : <p className="m-0 flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" disabled aria-hidden="true" className="size-3.5" />Chọn vai trò để xem các quyền cố định.</p>}
        </Field>
        <Field label="Hết hạn sau" id="invite-validity">
          <Select className="[&_select]:!bg-white" id="invite-validity" value={validityDays} onChange={(event) => setValidityDays(Number(event.target.value) as 3 | 7 | 14)}>
            <option value={3}>3 ngày</option><option value={7}>7 ngày</option><option value={14}>14 ngày</option>
          </Select>
        </Field>
        <ModalFooter compact>
          <Button size="lg" onClick={onClose}>Hủy</Button>
          <Button size="lg" variant="primary" type="submit" disabled={saving || !role || !active} title={role ? undefined : `Chọn vai trò ${roleLabel('MANAGER')} hoặc ${roleLabel('TECHNICIAN')} trước`}><Icon name="send" size={16} />{saving ? 'Đang gửi…' : 'Gửi lời mời'}</Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
