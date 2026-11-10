import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthClient, RegistrationRequest } from '../types'
import { normalizeEmail, validateRegistration } from '../validation'
import { Alert, AuthShell, Form, FormField, primaryButtonClass } from '../components/AuthShell'
import { ActionLink, Divider, GoogleButton, PasswordField } from '../components/AuthControls'
import { AUTH_PATH, friendlyAccountError } from '../domain/authErrors'

export function RegisterPage({ client }: { client: AuthClient }) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState<ReturnType<typeof validateRegistration>>({})
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setDuplicate(false)
    const request: RegistrationRequest = { fullName: fullName.trim(), email: normalizeEmail(email), password, confirmPassword, termsAccepted }
    const nextErrors = validateRegistration({ ...request })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (!client.register) { setError('Dịch vụ đăng ký chưa được nối với máy chủ.'); return }
    setSubmitting(true)
    try {
      await client.register(request)
      navigate(AUTH_PATH.verification, {
        replace: true,
        state: { email: request.email, nextAllowedAt: new Date(Date.now() + 60_000).toISOString() },
      })
    } catch (reason) {
      setError(friendlyAccountError(reason))
      setDuplicate(typeof reason === 'object' && reason !== null && 'code' in reason && (reason as { code?: unknown }).code === 'MSG-FE01-10')
    } finally { setSubmitting(false) }
  }

  return (
    <AuthShell
      title="Tạo tài khoản chủ trại"
      description="Tạo tài khoản để bắt đầu đăng ký trang trại."
      eyebrow="Đăng ký chủ trại"
      alert={error ? <Alert>{error}{duplicate && <span className="mt-2 flex gap-4"><ActionLink to={AUTH_PATH.signIn} state={{ email: normalizeEmail(email) }}>Đăng nhập</ActionLink><ActionLink to={AUTH_PATH.forgot} state={{ email: normalizeEmail(email) }}>Quên mật khẩu</ActionLink></span>}</Alert> : null}
      footer={<>Đã có tài khoản? <ActionLink to={AUTH_PATH.signIn}>Đăng nhập</ActionLink></>}
    >
      <div className="space-y-4">
        <GoogleButton client={client} label="Đăng ký bằng Google" />
        <Divider>hoặc dùng email</Divider>
        <Form onSubmit={submit}>
          <FormField id="register-name" label="Họ và tên" value={fullName} onChange={(event) => setFullName(event.target.value)} error={errors.fullName} placeholder="Tên chủ trại" autoComplete="name" maxLength={100} required />
          <FormField id="register-email" label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} placeholder="email@example.com" autoComplete="email" maxLength={254} required />
          <PasswordField id="register-password" label="Mật khẩu" value={password} onChange={setPassword} error={errors.password} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
          <PasswordField id="register-confirm-password" label="Xác nhận mật khẩu" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} placeholder="Nhập lại mật khẩu" autoComplete="new-password" />
          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-5 text-subtle">
              <input className="mt-0.5 size-5 shrink-0 accent-brand" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
              <span>Tôi đồng ý với <a href="/terms" className="font-bold text-brand underline">Điều khoản sử dụng</a> và <a href="/data-policy" className="font-bold text-brand underline">Chính sách dữ liệu</a>.</span>
            </label>
            {errors.termsAccepted && <span className="mt-1 block text-xs text-[#b54843]">{errors.termsAccepted}</span>}
          </div>
          <button type="submit" disabled={submitting} className={primaryButtonClass}>{submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</button>
        </Form>
      </div>
    </AuthShell>
  )
}
