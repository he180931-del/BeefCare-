import { useState, type FormEvent } from 'react'
import Modal, { ModalFooter } from '../../../components/Modal'
import { Button, DateInput, Field, inputCls, Note, Segmented } from '../../../components/ui'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { useRequestKey } from '../hooks/useRequestKey'
import type { ChangeMemberInput, Membership } from '../types'
import { farmToday, validateMemberChange, type FormErrors } from '../validation'
import { farmWorkspaceError, FieldError, roleLabel } from './WorkspaceUi'

const fullWidth = '[&>div]:flex [&>div]:w-full [&_button]:flex-1'

/** UC-FE03-06 (popup "Change Role / Deactivate Member"), mở bằng `?m=doi-vai-tro&id=<mã thành viên>`. */
export function MemberChangeDialog({ farmId, member, initialAction, active, onClose, onDone }: {
  farmId: number; member: Membership; initialAction?: ChangeMemberInput['action']; active: boolean; onClose: () => void; onDone: (message: string) => void
}) {
  const inactive = member.status === 'INACTIVE'
  const [action, setAction] = useState<ChangeMemberInput['action']>(inactive ? 'REACTIVATE' : initialAction ?? 'CHANGE_ROLE')
  const [role, setRole] = useState<'MANAGER' | 'TECHNICIAN'>(member.role === 'MANAGER' ? 'TECHNICIAN' : 'MANAGER')
  const [effectiveDate, setEffectiveDate] = useState(farmToday())
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FormErrors<ChangeMemberInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const requestKey = useRequestKey(`member-change:${farmId}:${member.id}`)
  const needsActiveFarm = action !== 'DEACTIVATE' && !active

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const payload: ChangeMemberInput = { action, role: action === 'CHANGE_ROLE' ? role : undefined, effectiveDate, reason }
    const next = validateMemberChange(payload)
    setErrors(next)
    if (Object.keys(next).length) return
    if (!confirming) { setConfirming(true); return }
    setSaving(true); setError(null)
    try {
      await farmWorkspaceApi.changeMember(farmId, member.id, payload, { expectedVersion: member.version, idempotencyKey: requestKey.keyFor({ ...payload, version: member.version }) })
      requestKey.clear(); onDone(`Đã cập nhật tư cách thành viên của ${member.fullName}.`)
    }
    catch (reasonError) { setError(farmWorkspaceError(reasonError, 'Không thể cập nhật thành viên.')); setConfirming(false) }
    finally { setSaving(false) }
  }
  const confirmText = action === 'CHANGE_ROLE' ? `Đổi ${member.fullName} từ ${roleLabel(member.role)} sang ${roleLabel(role)}? Quyền mới áp dụng từ thao tác tiếp theo.` : action === 'DEACTIVATE' ? `Ngừng hoạt động ${member.fullName}? Họ sẽ mất quyền vào trại từ thao tác tiếp theo.` : `Kích hoạt lại ${member.fullName}?`

  return (
    <Modal title={inactive ? 'Kích hoạt lại thành viên' : 'Đổi vai trò / ngừng hoạt động'} sub={`${member.fullName} · ${roleLabel(member.role)}`} width={560} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Note tone="err">{error}</Note>}
        {needsActiveFarm && <Note tone="warn">Đổi vai trò và kích hoạt lại cần dịch vụ trang trại đang hoạt động.</Note>}
        <Field label="Thành viên" id="member-info"><input id="member-info" readOnly value={`${member.fullName} · ${member.email} · ${roleLabel(member.role)}`} className={`${inputCls} text-subtle`} /></Field>
        <Field label="Hành động *">
          <div className={fullWidth}><Segmented value={action} onChange={(value) => { setAction(value as ChangeMemberInput['action']); setConfirming(false) }} options={inactive ? [{ value: 'REACTIVATE', label: 'Kích hoạt lại' }] : [{ value: 'CHANGE_ROLE', label: 'Đổi vai trò' }, { value: 'DEACTIVATE', label: 'Ngừng hoạt động' }]} /></div>
        </Field>
        {action === 'CHANGE_ROLE' && (
          <Field label="Vai trò mới *">
            <div className={fullWidth}><Segmented value={role} onChange={(value) => { setRole(value as 'MANAGER' | 'TECHNICIAN'); setConfirming(false) }} options={[{ value: 'MANAGER', label: 'Quản lý', disabled: member.role === 'MANAGER' }, { value: 'TECHNICIAN', label: 'Kỹ thuật viên', disabled: member.role === 'TECHNICIAN' }]} /></div>
            <FieldError>{errors.role}</FieldError>
          </Field>
        )}
        <Field label="Ngày hiệu lực *" id="member-date"><DateInput id="member-date" value={effectiveDate} onChange={setEffectiveDate} /><FieldError>{errors.effectiveDate}</FieldError></Field>
        <Field label="Lý do * (tối đa 500 ký tự)" id="member-reason">
          <textarea id="member-reason" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={inputCls} placeholder="Phân công quản lý khu chuồng C" />
          <FieldError>{errors.reason}</FieldError>
        </Field>
        {confirming && <Note tone="warn">{confirmText}</Note>}
        <ModalFooter compact>
          <Button size="lg" onClick={confirming ? () => setConfirming(false) : onClose}>{confirming ? 'Quay lại' : 'Hủy'}</Button>
          <Button size="lg" variant="primary" type="submit" disabled={saving || needsActiveFarm}>{saving ? 'Đang lưu…' : confirming ? 'Xác nhận thay đổi' : 'Lưu thay đổi'}</Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
