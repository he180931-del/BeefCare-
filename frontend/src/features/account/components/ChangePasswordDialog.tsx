import { useState, type FormEvent } from 'react'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import Modal, { ModalFooter } from '../../../components/Modal'
import { Button, Field, inputCls, Note } from '../../../components/ui'
import { accountApi } from '../api/accountApi'
import { MOCK_PASSWORD } from '../data/accountMock'
import { validatePasswordChange } from '../domain/profileRules'
import type { AccountIdentity, AccountProfile, PasswordErrors } from '../types'

const errorText = (message?: string) => message ? <span className="text-xs text-err-fg">{message}</span> : null

type PasswordFieldKey = 'current' | 'new' | 'confirm'

function PasswordInput({ id, label, autoComplete, value, onChange, visible, onToggle }: {
  id: string; label: string; autoComplete: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        maxLength={128}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputCls} pr-11`}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-subtle hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`}
        aria-pressed={visible}
        onClick={onToggle}
      >
        <Icon name="eye" size={18} />
      </button>
    </div>
  )
}

/** UC-FE01-06. Tài khoản có Google: xác thực lại trong 5 phút thì không cần mật khẩu hiện tại (D07); chưa có mật khẩu thì phải xác thực lại. */
export function ChangePasswordDialog({ identity, profile, onClose, onChanged, googleReauthenticated = false, returnTo }: {
  identity: AccountIdentity; profile: AccountProfile; onClose: () => void; onChanged: (message: string) => void; googleReauthenticated?: boolean; returnTo: string
}) {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState<Record<PasswordFieldKey, boolean>>({ current: false, new: false, confirm: false })
  const [reauthed, setReauthed] = useState(googleReauthenticated)
  const hasPassword = profile.passwordSignInEnabled
  const needsReauth = !hasPassword && !reauthed
  const requireCurrent = hasPassword && !reauthed
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }))
  const toggleVisibility = (key: PasswordFieldKey) => setVisible((current) => ({ ...current, [key]: !current[key] }))

  const reauthenticate = async () => {
    setError(null)
    try {
      const result = await accountApi.reauthenticateWithGoogle(identity, returnTo)
      if (result.redirectTo) window.location.assign(result.redirectTo)
      else setReauthed(true)
    } catch (reason) { setError(userFacingError(reason, 'Không xác thực lại được với Google.')) }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const input = { currentPassword: requireCurrent ? values.currentPassword : undefined, newPassword: values.newPassword, confirmPassword: values.confirmPassword }
    const next = validatePasswordChange(input, { email: profile.email, requireCurrent })
    setErrors(next); setError(null)
    if (Object.keys(next).length) return
    setSaving(true)
    try { onChanged((await accountApi.changePassword(identity, input)).message) }
    catch (reason) {
      const message = userFacingError(reason, 'Không đổi được mật khẩu. Vui lòng thử lại.')
      const wrongCurrent = (reason as { code?: unknown })?.code === 'MSG-FE01-16' || message.startsWith('Mật khẩu hiện tại')
      if (wrongCurrent) setErrors({ currentPassword: 'Mật khẩu hiện tại không đúng.' })
      else setError(message)
    } finally { setSaving(false) }
  }

  return (
    <Modal title={hasPassword ? 'Đổi mật khẩu' : 'Thêm mật khẩu'} sub={profile.email} width={520} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Note tone="err">{error}</Note>}
        {needsReauth && <Note tone="info">Tài khoản này chưa có mật khẩu. Xác thực lại với Google để thêm mật khẩu.</Note>}
        {requireCurrent && (
          <Field label="Mật khẩu hiện tại *" id="cp-current">
            <PasswordInput id="cp-current" label="mật khẩu hiện tại" autoComplete="current-password" value={values.currentPassword} onChange={(value) => set('currentPassword', value)} visible={visible.current} onToggle={() => toggleVisibility('current')} />
            {errorText(errors.currentPassword)}
          </Field>
        )}
        {!needsReauth && (<>
          <Field label="Mật khẩu mới *" id="cp-new">
            <PasswordInput id="cp-new" label="mật khẩu mới" autoComplete="new-password" value={values.newPassword} onChange={(value) => set('newPassword', value)} visible={visible.new} onToggle={() => toggleVisibility('new')} />
            {errorText(errors.newPassword)}
          </Field>
          <Field label="Nhập lại mật khẩu mới *" id="cp-confirm">
            <PasswordInput id="cp-confirm" label="mật khẩu xác nhận" autoComplete="new-password" value={values.confirmPassword} onChange={(value) => set('confirmPassword', value)} visible={visible.confirm} onToggle={() => toggleVisibility('confirm')} />
            {errorText(errors.confirmPassword)}
          </Field>
        </>)}
        {profile.googleSignInLinked && !reauthed && (
          <div className="text-xs text-subtle">{hasPassword ? 'Quên mật khẩu hiện tại? ' : ''}<Button variant="link" size="sm" onClick={reauthenticate}>Xác thực lại với Google</Button></div>
        )}
        {reauthed && <Note tone="ok">Đã xác thực lại với Google. Bạn không cần nhập mật khẩu hiện tại.</Note>}
        {backendMode === 'local' && hasPassword && <p className="m-0 text-[11px] text-subtle">Bản mô phỏng: mật khẩu hiện tại là {MOCK_PASSWORD}.</p>}
        <ModalFooter compact>
          <Button size="lg" onClick={onClose}>Hủy</Button>
          <Button size="lg" variant="primary" type="submit" disabled={saving || needsReauth}><Icon name="lock" size={16} />{saving ? 'Đang lưu…' : hasPassword ? 'Đổi mật khẩu' : 'Thêm mật khẩu'}</Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
