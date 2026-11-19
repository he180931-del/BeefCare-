import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BackendError } from '../../../api/backendClient'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import type { AuthClient, PasswordResetValidation } from '../types'
import { isValidEmail, normalizeEmail, validateReset } from '../validation'
import { Alert, AuthShell, Form, FormField, NoticePanel, primaryButtonClass } from '../components/AuthShell'
import { ActionLink, PasswordField } from '../components/AuthControls'
import { AUTH_PATH, emailFromState, friendlyAccountError, friendlyEmailRequestError, readError } from '../domain/authErrors'

const backToSignIn = <ActionLink to={AUTH_PATH.signIn}><Icon name="arrow-left" size={13} className="mr-1 inline" />Quay lại đăng nhập</ActionLink>

export function ForgotPasswordPage({ client }: { client: AuthClient }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(emailFromState(location.state) || new URLSearchParams(location.search).get('email') || '')
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null); setFieldError(undefined)
    if (!isValidEmail(email)) { setFieldError(email.trim() ? 'Email không hợp lệ.' : 'Vui lòng nhập email.'); return }
    if (!client.requestPasswordReset) { setError('Dịch vụ đặt lại mật khẩu chưa được nối với máy chủ.'); return }
    setBusy(true)
    try {
      await client.requestPasswordReset(normalizeEmail(email))
      navigate(AUTH_PATH.resetSent, { replace: true, state: { email: normalizeEmail(email) } })
    } catch (reason) { setError(friendlyEmailRequestError(reason)) }
    finally { setBusy(false) }
  }
  return (
    <AuthShell title="Quên mật khẩu" description="Nhập email tài khoản để nhận liên kết đặt lại mật khẩu." eyebrow="Khôi phục tài khoản" footer={backToSignIn} alert={error ? <Alert>{error}</Alert> : null}>
      <div className="space-y-5">
        <Form onSubmit={submit}>
          <FormField id="forgot-email" label="Email đăng ký" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError} placeholder="email@example.com" autoComplete="email" maxLength={254} required />
          <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}</button>
        </Form>
        <p className="m-0 rounded-[14px] bg-[#eef4ef] px-5 py-4 text-[13px] leading-5 text-subtle">Nếu bạn đăng nhập bằng Google, hãy khôi phục tài khoản trong Google.</p>
      </div>
    </AuthShell>
  )
}

export function InvalidLinkPage({ email, flow = 'reset' }: { email: string; flow?: 'reset' | 'verification' }) {
  const verification = flow === 'verification'
  return (
    <AuthShell title="Liên kết không còn hiệu lực" description={verification ? 'Liên kết xác minh đã hết hạn hoặc đã được sử dụng.' : 'Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.'} eyebrow="Cần gửi liên kết mới" footer={<ActionLink to={AUTH_PATH.signIn}>Quay lại đăng nhập</ActionLink>}>
      <div className="space-y-5">
        <NoticePanel title="Liên kết đã hết hạn">Yêu cầu liên kết mới để tiếp tục.</NoticePanel>
        <Link to={verification ? AUTH_PATH.verification : AUTH_PATH.forgot} state={email ? { email } : undefined} className={`${primaryButtonClass} no-underline`}>{verification ? 'Gửi lại email xác minh' : 'Yêu cầu liên kết mới'}</Link>
      </div>
    </AuthShell>
  )
}

export function ResetPasswordPage({ client }: { client: AuthClient }) {
  const location = useLocation()
  const navigate = useNavigate()
  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const token = query.get('token') || ''
  const initialEmail = normalizeEmail(query.get('email') || '')
  const [validation, setValidation] = useState<PasswordResetValidation | null>(null)
  const [checking, setChecking] = useState(true)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<ReturnType<typeof validateReset>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const checkLink = async () => {
    setChecking(true); setCheckError(null)
    if (!token || !client.validatePasswordReset) { setValidation({ valid: false }); setChecking(false); return }
    try { setValidation(await client.validatePasswordReset(token)) }
    catch (reason) {
      const { code } = readError(reason)
      if (code === 'MSG-FE01-06' || reason instanceof BackendError && reason.status === 400) setValidation({ valid: false })
      else setCheckError(userFacingError(reason, 'Không thể kiểm tra liên kết. Vui lòng thử lại.'))
    } finally { setChecking(false) }
  }
  useEffect(() => { void checkLink() }, [token, client])

  const email = validation?.email ? normalizeEmail(validation.email) : initialEmail
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null)
    const next = validateReset({ email, password, confirmPassword }); setErrors(next)
    if (Object.keys(next).length) return
    if (!client.resetPassword) { setError('Dịch vụ đặt lại mật khẩu chưa được nối với máy chủ.'); return }
    setBusy(true)
    try {
      await client.resetPassword(token, password, confirmPassword)
      navigate(`${AUTH_PATH.signIn}?reset=success`, { replace: true })
    } catch (reason) {
      const { code } = readError(reason)
      if (code === 'MSG-FE01-06') navigate(AUTH_PATH.invalid, { replace: true, state: { email } })
      else setError(friendlyAccountError(reason))
    } finally { setBusy(false) }
  }

  if (checking) return <AuthShell title="Đặt mật khẩu mới" description="Đang kiểm tra liên kết đặt lại mật khẩu…"><div className="animate-pulse rounded-xl bg-[#eef4ef] p-8 text-center text-sm text-subtle">Đang xác minh liên kết</div></AuthShell>
  if (checkError) return <AuthShell title="Chưa kiểm tra được liên kết" description="Kết nối máy chủ đang gặp sự cố." alert={<Alert>{checkError}</Alert>} footer={backToSignIn}><button type="button" className={primaryButtonClass} onClick={() => void checkLink()}>Thử lại</button></AuthShell>
  if (!validation?.valid) return <InvalidLinkPage email={initialEmail} />

  return (
    <AuthShell title="Đặt mật khẩu mới" description="Tạo mật khẩu mới để bảo vệ tài khoản của bạn." eyebrow="Thiết lập mật khẩu" footer={backToSignIn} alert={error ? <Alert>{error}</Alert> : null}>
      <Form onSubmit={submit}>
        {email && <FormField id="reset-email" label="Email tài khoản" value={email} readOnly />}
        <PasswordField id="reset-password" label="Mật khẩu mới" value={password} onChange={setPassword} error={errors.password} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
        <PasswordField id="reset-confirm" label="Nhập lại mật khẩu" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
        <p className="-mt-1 mb-0 text-xs text-subtle">Dùng mật khẩu đủ dài và khó đoán.</p>
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}</button>
      </Form>
    </AuthShell>
  )
}
