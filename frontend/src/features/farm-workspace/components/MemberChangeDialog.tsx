import { useState, type FormEvent } from 'react'
import { BackendError } from '../../../api/backendClient'
import Modal, { ModalFooter } from '../../../components/Modal'
import { Button, DateInput, Field, inputCls, Note, Segmented } from '../../../components/ui'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { DISCARD_PROMPT } from '../../../shared/ui'
import { useRequestKey } from '../hooks/useRequestKey'
import type { ChangeMemberInput, MemberAction, Membership } from '../types'
import { farmToday, MEMBER_REASON_RULE, validateMemberChange, type FormErrors } from '../validation'
import { farmWorkspaceError, FieldError, roleLabel } from './WorkspaceUi'

const fullWidth = '[&>div]:flex [&>div]:w-full [&_button]:flex-1'
// UC-FE03-06 E2/E3/E5 or a member that left this farm: the row on screen is outdated, so the list is read again (D30).
const STALE = ['MSG-FE03-04', 'MSG-FE03-20', 'MSG-COM-05', 'MSG-COM-08']
const FIELD_MESSAGES: Record<string, Partial<Record<keyof ChangeMemberInput, string>>> = {
  'MSG-COM-06': { action: 'Chọn hành động.', role: 'Chọn vai trò mới.', effectiveDate: 'Ngày hiệu lực là bắt buộc.', reason: 'Lý do là bắt buộc.' },
  'MSG-COM-07': { effectiveDate: 'Ngày hiệu lực không được ở tương lai.' },
  'MSG-COM-10': { action: 'Thành viên đã ngưng chỉ có thể được kích hoạt lại.', role: 'Chọn vai trò mới.', reason: MEMBER_REASON_RULE },
}
type Step = 'form' | 'confirm' | 'discard'

/**
 * Popup "Đổi vai trò / Ngưng thành viên" (UC-FE03-06, D30), opened from SCR-13 (`?m=doi-vai-tro&id=…`) or from the Invite
 * popup on MSG-FE03-21. Save asks for confirmation (MSG-FE03-11 / 12, reactivation: own text) inside the popup; the
 * version sent is the one seen when it opened. Outdated rows go back to the list (`onStale`); a save or network failure
 * keeps the popup and the same Idempotency-Key.
 */
export function MemberChangeDialog({ farmId, farmName, member, initialAction, active, onClose, onDone, onStale }: {
  farmId: number; farmName: string; timeZone: string; member: Membership; initialAction?: MemberAction; active: boolean
  onClose: () => void; onDone: (message: string) => void; onStale: (message: string) => void
}) {
  const inactive = member.status === 'INACTIVE'
  const today = farmToday()
  const startAction: MemberAction = inactive ? 'REACTIVATE' : initialAction === 'DEACTIVATE' ? 'DEACTIVATE' : 'CHANGE_ROLE'
  const otherRole = member.role === 'MANAGER' ? 'TECHNICIAN' : 'MANAGER'
  const [action, setAction] = useState<MemberAction>(startAction)
  const [role, setRole] = useState<'MANAGER' | 'TECHNICIAN'>(otherRole)
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FormErrors<ChangeMemberInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [saving, setSaving] = useState(false)
  const requestKey = useRequestKey(`member-change:${farmId}:${member.id}`)
  const name = member.fullName.trim() || member.email
  const needsActiveFarm = action !== 'DEACTIVATE' && !active
  const dirty = action !== startAction || effectiveDate !== today || reason.trim() !== ''
  const payload: ChangeMemberInput = { action, role: action === 'CHANGE_ROLE' ? role : undefined, effectiveDate, reason: reason.trim() }

  const close = () => {
    if (saving) return
    if (dirty && step !== 'discard') setStep('discard')
    else onClose()
  }
  const discard = () => { requestKey.clear(); onClose() }

  const review = (event: FormEvent) => {
    event.preventDefault()
    if (saving || needsActiveFarm) return
    const next = validateMemberChange(payload, today)
    setErrors(next); setError(null)
    if (!Object.keys(next).length) setStep('confirm')
  }

  const save = async () => {
    if (saving) return
    setSaving(true); setError(null)
    try {
      await farmWorkspaceApi.changeMember(farmId, member.id, payload, { expectedVersion: member.version, idempotencyKey: requestKey.keyFor({ ...payload, version: member.version }) })
      requestKey.clear(); onDone(`Đã cập nhật thành viên ${name}.`) // MSG-FE03-13
    } catch (reasonError) {
      const message = farmWorkspaceError(reasonError, 'Không thể cập nhật thành viên.')
      if (reasonError instanceof BackendError) {
        const code = reasonError.code?.toUpperCase() ?? ''
        if (STALE.includes(code) || reasonError.status === 404) {
          // Show the reason and the server's current rows; never retry with a newer version (BR-D31).
          requestKey.clear(); onStale(message); return
        }
        const field = String(reasonError.params.field ?? '') as keyof ChangeMemberInput
        const fieldMessage = FIELD_MESSAGES[code]?.[field]
        if (fieldMessage) { requestKey.clear(); setErrors({ [field]: fieldMessage }); setStep('form'); return }
      }
      setError(message) // save or network failure: keep the confirmation and its key (GBR-88)
    } finally { setSaving(false) }
  }

  const confirmText = action === 'CHANGE_ROLE'
    ? `Đổi ${name} từ ${roleLabel(member.role)} sang ${roleLabel(role)}? Quyền mới áp dụng từ thao tác kế tiếp.` // MSG-FE03-12
    : action === 'DEACTIVATE'
      ? `Ngưng ${name}? Người này sẽ mất quyền vào ${farmName} từ thao tác kế tiếp.` // MSG-FE03-11
      : `Kích hoạt lại ${name} với vai trò ${roleLabel(member.role)}? Người này vào lại ${farmName} từ thao tác kế tiếp.` // D30
  const editing = step === 'form'

  return (
    <Modal title={inactive ? 'Kích hoạt lại thành viên' : 'Đổi vai trò / ngưng thành viên'} sub={`${name} · ${roleLabel(member.role)}`} width={560} onClose={close}>
      <form onSubmit={review} className="flex flex-col gap-4" noValidate>
        {error && <Note tone="err">{error}</Note>}
        {needsActiveFarm && <Note tone="warn">Mời thành viên, đổi vai trò và kích hoạt lại cần trại đang hoạt động (ACTIVE).</Note>}
        {/* Read-only text that wraps: a one-line input cut the role and status off on phones. */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span id="member-info-label" className="text-xs font-medium text-ink">Thành viên</span>
          <p aria-labelledby="member-info-label" className="m-0 rounded-xl bg-page px-2.5 py-3 text-sm text-subtle [overflow-wrap:anywhere]">
            {`${name} · ${member.email} · ${roleLabel(member.role)} · ${inactive ? 'Đã ngưng' : 'Đang hoạt động'}`}
          </p>
        </div>
        <Field label="Hành động *">
          <div className={fullWidth}><Segmented value={action} onChange={(value) => { if (editing) setAction(value as MemberAction) }} options={inactive
            ? [{ value: 'REACTIVATE', label: 'Kích hoạt lại', disabled: !editing }]
            : [{ value: 'CHANGE_ROLE', label: 'Đổi vai trò', disabled: !editing || !active }, { value: 'DEACTIVATE', label: 'Ngưng', disabled: !editing }]} /></div>
          <FieldError>{errors.action}</FieldError>
        </Field>
        {action === 'CHANGE_ROLE' && (
          <Field label="Vai trò mới *">
            <div className={fullWidth}><Segmented value={role} onChange={(value) => { if (editing) setRole(value as 'MANAGER' | 'TECHNICIAN') }} options={[{ value: 'MANAGER', label: 'Quản lý', disabled: !editing || member.role === 'MANAGER' }, { value: 'TECHNICIAN', label: 'Kỹ thuật viên', disabled: !editing || member.role === 'TECHNICIAN' }]} /></div>
            <FieldError>{errors.role}</FieldError>
          </Field>
        )}
        <Field label="Ngày hiệu lực *" id="member-date"><DateInput id="member-date" value={effectiveDate} readOnly={!editing} onChange={setEffectiveDate} /><FieldError>{errors.effectiveDate}</FieldError></Field>
        <Field label="Lý do * (5–500 ký tự)" id="member-reason">
          <textarea id="member-reason" rows={2} maxLength={500} value={reason} readOnly={!editing} onChange={(event) => setReason(event.target.value)} className={`${inputCls} resize-none`} placeholder="Phân công quản lý khu chuồng C" />
          <FieldError>{errors.reason}</FieldError>
        </Field>
        {step === 'confirm' && <Note tone="warn">{confirmText}</Note>}
        {step === 'discard' && <Note tone="warn">{DISCARD_PROMPT.question}</Note>}
        <ModalFooter compact>
          {step === 'discard' ? <>
            <Button size="lg" onClick={() => setStep('form')}>{DISCARD_PROMPT.keep}</Button>
            <Button size="lg" variant="danger" onClick={discard}>{DISCARD_PROMPT.discard}</Button>
          </> : step === 'confirm' ? <>
            <Button size="lg" disabled={saving} onClick={() => { setStep('form'); setError(null) }}>Quay lại</Button>
            <Button size="lg" variant="primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Xác nhận'}</Button>
          </> : <>
            <Button size="lg" onClick={close}>Hủy</Button>
            <Button size="lg" variant="primary" type="submit" disabled={needsActiveFarm}>Lưu thay đổi</Button>
          </>}
        </ModalFooter>
      </form>
    </Modal>
  )
}
