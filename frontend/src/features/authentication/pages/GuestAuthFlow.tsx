import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BackendError } from '../../../api/backendClient'
import { userFacingError } from '../../../api/userFacingError'
import type { AuthClient, PasswordResetValidation, RegistrationRequest } from '../types'
import { isValidEmail, normalizeEmail, validateRegistration, validateReset, validateSignIn } from '../validation'
import { Alert, AuthShell, Brand, Form, FormField, primaryButtonClass, secondaryButtonClass } from '../components/AuthShell'

const PATH = {
  home: '/', signIn: '/dang-nhap', register: '/dang-ky', verification: '/xac-minh-email',
  forgot: '/quen-mat-khau', resetSent: '/kiem-tra-email', reset: '/dat-lai-mat-khau',
  invalid: '/lien-ket-khong-con-hieu-luc', suspended: '/tai-khoan-tam-ngung', loginFailed: '/dang-nhap-that-bai',
} as const

const AUTH_PATHS = new Set<string>(Object.values(PATH).filter((path) => path !== PATH.home))
const emailFromState = (state: unknown): string => {
  if (typeof state !== 'object' || state === null || !('email' in state)) return ''
  return typeof (state as { email?: unknown }).email === 'string' ? normalizeEmail((state as { email: string }).email) : ''
}
const readError = (error: unknown) => ({
  code: error instanceof BackendError ? error.code : typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '',
  status: error instanceof BackendError ? error.status : typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : 0,
  params: error instanceof BackendError ? error.params : typeof error === 'object' && error !== null && 'params' in error ? (error as { params?: Record<string, unknown> }).params ?? {} : {},
})

function friendlyLoginError(error: unknown): string {
  const { code, status, params } = readError(error)
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '').toLowerCase()
      : ''
  if (code === 'MSG-FE01-11') return 'Email chưa được xác minh. Vui lòng mở email xác minh hoặc gửi lại liên kết.'
  if (
    code === 'MSG-FE01-01'
    || status === 401
    || (code ?? '').toLowerCase() === 'error.validation'
    || message.includes('error.validation')
  ) return 'Email hoặc mật khẩu không đúng.'
  if (code === 'MSG-FE01-02' || status === 423) {
    const time = typeof params.time === 'string' ? new Date(params.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null
    return `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút${time ? ` (sau ${time})` : ''}.`
  }
  if (code === 'MSG-FE01-03') return 'Tài khoản đang tạm ngưng.'
  return userFacingError(error, 'Đăng nhập không thành công. Vui lòng thử lại.')
}

function friendlyAccountError(error: unknown): string {
  const { code, status } = readError(error)
  if (code === 'MSG-FE01-10') return 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.'
  if (code === 'MSG-FE01-14') return 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách dữ liệu.'
  if (code === 'MSG-FE01-08') return 'Mật khẩu cần từ 8 đến 128 ký tự và không được trùng với email.'
  if (code === 'MSG-FE01-09') return 'Mật khẩu xác nhận chưa khớp.'
  if (status === 409) return 'Thông tin tài khoản đã được sử dụng. Vui lòng kiểm tra email.'
  if (status === 400 || status === 422) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.'
  return userFacingError(error, 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
}

function friendlyEmailRequestError(error: unknown): string {
  const { status } = readError(error)
  if (status === 429) return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
  if (status === 400 || status === 422) return 'Yêu cầu chưa hợp lệ. Vui lòng kiểm tra email rồi thử lại.'
  return userFacingError(error, 'Chưa gửi được email. Vui lòng thử lại sau.')
}

function ActionLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="font-semibold text-brand underline-offset-4 hover:underline">{children}</Link>
}

function PasswordField({ label, id, value, onChange, error, autoComplete, maxLength = 128 }: {
  label: string; id: string; value: string; onChange: (value: string) => void; error?: string; autoComplete?: string; maxLength?: number
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <FormField id={id} label={label} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} error={error} autoComplete={autoComplete} maxLength={maxLength} required />
      <button type="button" className="absolute right-3 top-[39px] rounded px-1 text-xs font-medium text-subtle hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/20" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible((shown) => !shown)}>
        {visible ? 'Ẩn' : 'Hiện'}
      </button>
    </div>
  )
}

function GoogleButton({ client }: { client: AuthClient }) {
  if (client.mode === 'mock') return <button type="button" disabled className={secondaryButtonClass} title="Google OAuth chỉ khả dụng khi nối máy chủ">◎ <span>Tiếp tục với Google</span></button>
  return <a href="/oauth2/authorization/google" className={secondaryButtonClass}>◎ <span>Tiếp tục với Google</span></a>
}

function SignInPage({ client, onAuthenticated, initialError }: { client: AuthClient; onAuthenticated: () => void; initialError: string | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<ReturnType<typeof validateSignIn>>({})
  const [error, setError] = useState<string | null>(initialError)
  const [unverified, setUnverified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const resetSuccess = new URLSearchParams(location.search).get('reset') === 'success'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setUnverified(false)
    const nextErrors = validateSignIn({ email, password })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    try {
      await client.login(normalizeEmail(email), password, remember)
      onAuthenticated()
      if (AUTH_PATHS.has(location.pathname)) navigate('/', { replace: true })
    } catch (reason) {
      const { code } = readError(reason)
      setError(friendlyLoginError(reason))
      setUnverified(code === 'MSG-FE01-11')
      if (code === 'MSG-FE01-03') navigate(PATH.suspended, { state: { email: normalizeEmail(email) } })
    } finally { setSubmitting(false) }
  }

  return (
    <AuthShell title="Đăng nhập BeefCare" description="Đăng nhập để tiếp tục quản lý trang trại của bạn." footer={<>Chưa có tài khoản chủ trại? <ActionLink to={PATH.register}>Đăng ký</ActionLink></>} alert={resetSuccess ? <Alert tone="success">Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.</Alert> : error ? <Alert>{error}{unverified && <span className="mt-2 block"><Link to={PATH.verification} state={{ email: normalizeEmail(email) }} className="font-semibold text-brand underline-offset-4 hover:underline">Gửi lại email xác minh</Link></span>}</Alert> : null}>
      <div className="space-y-4">
        <GoogleButton client={client} />
        <div className="flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-rule" />hoặc đăng nhập bằng email<span className="h-px flex-1 bg-rule" /></div>
        <Form onSubmit={submit}>
          <FormField id="signin-email" label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} autoComplete="username" maxLength={254} required />
          <PasswordField id="signin-password" label="Mật khẩu" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
          <div className="flex items-center justify-between gap-4 text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-subtle"><input className="size-4 accent-brand" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Ghi nhớ đăng nhập</label>
            <ActionLink to={PATH.forgot}>Quên mật khẩu?</ActionLink>
          </div>
          <button type="submit" disabled={submitting} className={primaryButtonClass}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </Form>
      </div>
    </AuthShell>
  )
}

function RegisterPage({ client }: { client: AuthClient }) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState<ReturnType<typeof validateRegistration>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const request: RegistrationRequest = { fullName: fullName.trim(), email: normalizeEmail(email), password, confirmPassword, termsAccepted }
    const nextErrors = validateRegistration({ ...request })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (!client.register) { setError('Dịch vụ đăng ký chưa được nối với máy chủ.'); return }
    setSubmitting(true)
    try {
      await client.register(request)
      navigate(PATH.verification, { replace: true, state: { email: request.email } })
    } catch (reason) { setError(friendlyAccountError(reason)) }
    finally { setSubmitting(false) }
  }

  return (
    <AuthShell title="Tạo tài khoản chủ trại" description="Tạo tài khoản BeefCare để bắt đầu quản lý trang trại." footer={<>Đã có tài khoản? <ActionLink to={PATH.signIn}>Đăng nhập</ActionLink></>} alert={error ? <Alert>{error}</Alert> : null}>
      <div className="space-y-4">
        <GoogleButton client={client} />
        <div className="flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-rule" />hoặc đăng ký bằng email<span className="h-px flex-1 bg-rule" /></div>
        <Form onSubmit={submit}>
          <FormField id="register-name" label="Họ và tên" value={fullName} onChange={(event) => setFullName(event.target.value)} error={errors.fullName} autoComplete="name" maxLength={100} required />
          <FormField id="register-email" label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} autoComplete="email" maxLength={254} required />
          <PasswordField id="register-password" label="Mật khẩu" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" />
          <PasswordField id="register-confirm-password" label="Xác nhận mật khẩu" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} autoComplete="new-password" />
          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-subtle">
              <input className="mt-0.5 size-4 shrink-0 accent-brand" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
              <span>Tôi đồng ý với <a href="/terms" className="font-semibold text-brand underline">Điều khoản sử dụng</a> và <a href="/data-policy" className="font-semibold text-brand underline">Chính sách dữ liệu</a>.</span>
            </label>
            {errors.termsAccepted && <span className="mt-1 block text-xs text-red-700">{errors.termsAccepted}</span>}
          </div>
          <button type="submit" disabled={submitting} className={primaryButtonClass}>{submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</button>
        </Form>
      </div>
    </AuthShell>
  )
}

function ResendControl({ onSend, label, disabledLabel = 'Đã gửi' }: { onSend: () => Promise<void>; label: string; disabledLabel?: string }) {
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])
  const send = async () => {
    setBusy(true); setError(null)
    try { await onSend(); setSeconds(60) }
    catch (reason) { setError(friendlyEmailRequestError(reason)) }
    finally { setBusy(false) }
  }
  return <div className="mt-5">
    <button type="button" onClick={send} disabled={busy || seconds > 0} className="w-full rounded-xl border border-field bg-white px-4 py-3 text-sm font-semibold text-brand hover:border-brand disabled:cursor-not-allowed disabled:text-muted">
      {busy ? 'Đang gửi…' : seconds > 0 ? `${disabledLabel} · thử lại sau ${seconds}s` : label}
    </button>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    <p className="mt-2 text-center text-[11px] leading-4 text-subtle">Có thể gửi tối đa 5 email trong một giờ cho mỗi địa chỉ.</p>
  </div>
}

function EmailSentPage({ client, kind }: { client: AuthClient; kind: 'verification' | 'reset' }) {
  const location = useLocation()
  const email = emailFromState(location.state) || normalizeEmail(new URLSearchParams(location.search).get('email') || '')
  const verification = kind === 'verification'
  const resend = verification ? client.resendVerification : client.requestPasswordReset
  const title = verification ? 'Kiểm tra email của bạn' : 'Kiểm tra hộp thư đến'
  return (
    <AuthShell title={title} description={verification ? 'Chúng tôi đã gửi liên kết xác minh để kích hoạt tài khoản BeefCare.' : 'Nếu email này có tài khoản phù hợp, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.'} footer={<ActionLink to={PATH.signIn}>Quay lại đăng nhập</ActionLink>}>
      <div className="rounded-2xl border border-[#e2ebe3] bg-[#f7faf7] p-5 text-center">
        <div aria-hidden="true" className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[#e5f3e9] text-2xl text-brand">✉</div>
        <p className="text-sm leading-6 text-subtle">{verification ? 'Liên kết xác minh được gửi đến' : 'Nếu địa chỉ đã đăng ký, email hướng dẫn sẽ được gửi đến'}</p>
        <p className="mt-1 break-all font-semibold text-ink">{email || 'địa chỉ email bạn vừa nhập'}</p>
        <p className="mt-3 text-xs leading-5 text-subtle">Vui lòng kiểm tra cả thư mục spam. Liên kết chỉ dùng được một lần và có thời hạn.</p>
      </div>
      {resend && email && <ResendControl onSend={() => resend(email)} label={verification ? 'Gửi lại email xác minh' : 'Gửi lại hướng dẫn'} />}
    </AuthShell>
  )
}

function ForgotPasswordPage({ client }: { client: AuthClient }) {
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
      navigate(PATH.resetSent, { replace: true, state: { email: normalizeEmail(email) } })
    } catch (reason) { setError(friendlyEmailRequestError(reason)) }
    finally { setBusy(false) }
  }
  return (
    <AuthShell title="Quên mật khẩu?" description="Nhập email tài khoản. Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu nếu địa chỉ này đã đăng ký." footer={<ActionLink to={PATH.signIn}>Quay lại đăng nhập</ActionLink>} alert={error ? <Alert>{error}</Alert> : null}>
      <Form onSubmit={submit}>
        <FormField id="forgot-email" label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError} autoComplete="email" maxLength={254} required />
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}</button>
      </Form>
    </AuthShell>
  )
}

function ResetPasswordPage({ client }: { client: AuthClient }) {
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
      navigate(`${PATH.signIn}?reset=success`, { replace: true })
    } catch (reason) {
      const { code } = readError(reason)
      if (code === 'MSG-FE01-06') navigate(PATH.invalid, { replace: true, state: { email } })
      else setError(friendlyAccountError(reason))
    } finally { setBusy(false) }
  }

  if (checking) return <AuthShell title="Đặt mật khẩu mới" description="Đang kiểm tra liên kết đặt lại mật khẩu…"><div className="animate-pulse rounded-xl bg-page p-8 text-center text-sm text-subtle">Đang xác minh liên kết</div></AuthShell>
  if (checkError) return <AuthShell title="Chưa kiểm tra được liên kết" description="Kết nối máy chủ đang gặp sự cố." alert={<Alert>{checkError}</Alert>} footer={<ActionLink to={PATH.signIn}>Quay lại đăng nhập</ActionLink>}><button type="button" className={primaryButtonClass} onClick={() => void checkLink()}>Thử lại</button></AuthShell>
  if (!validation?.valid) return <InvalidLinkPage email={initialEmail} />

  return (
    <AuthShell title="Đặt mật khẩu mới" description="Tạo mật khẩu mới cho tài khoản BeefCare của bạn." footer={<ActionLink to={PATH.signIn}>Quay lại đăng nhập</ActionLink>} alert={error ? <Alert>{error}</Alert> : null}>
      {email ? <FormField id="reset-email" label="Email tài khoản" value={email} readOnly /> : <Alert tone="info">Liên kết đã được xác minh. API hiện chưa trả email tài khoản về giao diện.</Alert>}
      <Form onSubmit={submit}>
        <PasswordField id="reset-password" label="Mật khẩu mới" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" />
        <PasswordField id="reset-confirm" label="Xác nhận mật khẩu mới" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} autoComplete="new-password" />
        <p className="-mt-1 text-xs text-subtle">Mật khẩu gồm 8–128 ký tự và không trùng email.</p>
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}</button>
      </Form>
    </AuthShell>
  )
}

function InvalidLinkPage({ email, flow = 'reset' }: { email: string; flow?: 'reset' | 'verification' }) {
  const verification = flow === 'verification'
  const nextPath = verification ? PATH.verification : PATH.forgot
  return <AuthShell title={verification ? 'Liên kết xác minh không còn hiệu lực' : 'Liên kết không còn hiệu lực'} description="Liên kết đã hết hạn hoặc đã được sử dụng. Hãy gửi một liên kết mới để tiếp tục." footer={<ActionLink to={PATH.signIn}>Quay lại đăng nhập</ActionLink>}>
    <Alert>{verification ? 'Liên kết xác minh tài khoản không còn dùng được.' : 'Liên kết đặt lại mật khẩu không còn dùng được.'}</Alert>
    <Link to={nextPath} state={email ? { email } : undefined} className={primaryButtonClass}>{verification ? 'Gửi lại email xác minh' : 'Gửi liên kết mới'}</Link>
  </AuthShell>
}

function SuspendedPage() {
  const location = useLocation()
  const email = emailFromState(location.state)
  return <AuthShell title="Tài khoản đang tạm ngưng" description="Tài khoản hiện chưa thể đăng nhập. Vui lòng liên hệ BeefCare để được hỗ trợ." footer={<ActionLink to={PATH.signIn}>Quay lại đăng nhập</ActionLink>}>
    <Alert>Không thể tạo phiên đăng nhập cho tài khoản {email ? <strong>{email}</strong> : 'này'}.</Alert>
    <div className="rounded-xl border border-field bg-page p-4 text-sm leading-6 text-subtle">
      <p className="font-semibold text-ink">Liên hệ BeefCare</p>
      <a className="block text-brand underline" href="mailto:tuanpqhe181869@fpt.edu.vn">tuanpqhe181869@fpt.edu.vn</a>
      <a className="block text-brand underline" href="tel:+84386671863">0386 671 863</a>
    </div>
  </AuthShell>
}

type Prices = { price1y?: number; price2y?: number; price3y?: number }
type LandingContent = { introduction?: string; features?: Array<{ title?: string; description?: string }>; faq?: Array<{ question?: string; answer?: string }>; contactEmail?: string }
function formatPrice(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? `${new Intl.NumberFormat('vi-VN').format(value)} đ` : null
}

function PublicLandingPage({ client }: { client: AuthClient }) {
  const navigate = useNavigate()
  const [published, setPublished] = useState<LandingContent | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [loading, setLoading] = useState(false)
  const [priceError, setPriceError] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  useEffect(() => {
    let active = true
    if (!client.getPublicLanding) return () => { active = false }
    client.getPublicLanding().then((result) => {
      if (active && result && typeof result === 'object') setPublished(result as LandingContent)
    }).catch(() => { /* SRS copy remains available; prices never use this fallback. */ })
    return () => { active = false }
  }, [client])
  const loadPrices = async () => {
    setLoading(true); setPriceError(false)
    try {
      if (!client.getPublicPrices) throw new Error('Bảng giá chưa được nối với máy chủ.')
      const result = await client.getPublicPrices()
      const value = result as Prices
      if (![value?.price1y, value?.price2y, value?.price3y].every((price) => typeof price === 'number' && Number.isFinite(price))) throw new Error('Bảng giá hiện chưa khả dụng.')
      setPrices(value)
    } catch { setPrices(null); setPriceError(true) }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadPrices() }, [client])
  const defaultFeatures: Array<[string, string]> = [
    ['Hồ sơ riêng cho từng con bò', 'Theo dõi thông tin và lịch sử của từng cá thể.'],
    ['Theo dõi tăng trưởng và thể trạng', 'Cập nhật cân nặng và điểm thể trạng theo thời gian.'],
    ['Quản lý tiêm phòng, sức khỏe', 'Ghi nhận các sự kiện chăm sóc và sức khỏe.'],
    ['Sinh sản và quá trình đẻ', 'Theo dõi sinh sản và các mốc quan trọng.'],
    ['Nhắc việc và thông báo trang trại', 'Giúp đội ngũ theo sát công việc cần thực hiện.'],
    ['Quản lý nhiều trang trại độc lập', 'Tách dữ liệu theo từng trang trại và quyền thành viên.'],
  ]
  const features: Array<[string, string]> = (published?.features?.filter((item) => item.title?.trim()).map((item): [string, string] => [item.title as string, item.description || 'Thông tin trang trại được tổ chức rõ ràng trên BeefCare.']) || defaultFeatures).slice(0, 6)
  const defaultQuestions: Array<[string, string]> = [
    ['BeefCare phù hợp với trang trại quy mô nào?', 'BeefCare hướng tới các trang trại bò thịt quy mô khoảng 150–300 con.'],
    ['Có cần cài ứng dụng không?', 'Không. Bạn có thể sử dụng BeefCare trên trình duyệt.'],
    ['Các thời hạn dịch vụ khác nhau thế nào?', 'Bạn có thể chọn gói 1, 2 hoặc 3 năm cho mỗi trang trại.'],
    ['Thanh toán và kích hoạt dịch vụ thế nào?', 'Chủ trại chuyển khoản theo hướng dẫn sau khi đăng ký gói dịch vụ.'],
    ['Dữ liệu giữa các trang trại có tách biệt không?', 'Dữ liệu được quản lý riêng theo từng trang trại và quyền thành viên.'],
  ]
  const questions: Array<[string, string]> = published?.faq?.filter((item) => item.question?.trim() && item.answer?.trim()).map((item): [string, string] => [item.question as string, item.answer as string]) || defaultQuestions
  const contactEmail = published?.contactEmail?.trim() || 'tuanpqhe181869@fpt.edu.vn'
  return (
    <main className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-20 border-b border-[#e6ece7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <a href="#top" aria-label="BeefCare, đầu trang"><Brand /></a>
          <nav className="hidden items-center gap-6 text-xs font-medium text-subtle lg:flex" aria-label="Điều hướng trang">
            <a href="#features" className="hover:text-brand">Tính năng</a><a href="#steps" className="hover:text-brand">Cách hoạt động</a><a href="#pricing" className="hover:text-brand">Bảng giá</a><a href="#faq" className="hover:text-brand">Câu hỏi</a><a href="#contact" className="hover:text-brand">Liên hệ</a>
          </nav>
          <div className="flex items-center gap-2"><button type="button" className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-brand sm:block" onClick={() => navigate(PATH.signIn)}>Đăng nhập</button><button type="button" className="rounded-lg bg-brand px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark" onClick={() => navigate(PATH.register)}>Đăng ký chủ trại</button></div>
        </div>
      </header>
      <section id="top" className="overflow-hidden bg-[#f5f9f5]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <span className="inline-flex rounded-full border border-[#dce9df] bg-white px-3.5 py-1.5 text-xs font-semibold text-brand">Dành cho trang trại bò thịt 150–300 con</span>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.15] tracking-tight text-[#123c2c] sm:text-5xl">Quản lý trang trại bò thịt, rõ ràng từ hôm nay.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-subtle">{published?.introduction?.trim() || 'Theo dõi hồ sơ đàn bò, lịch chăm sóc và công việc trang trại trên một nền tảng tiếng Việt dễ sử dụng.'}</p>
            <div className="mt-7 flex flex-wrap gap-3"><button type="button" className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark" onClick={() => navigate(PATH.register)}>Bắt đầu với BeefCare</button>{client.mode === 'mock' ? <button type="button" disabled className="rounded-xl border border-[#cadbce] bg-white px-5 py-3 text-sm font-semibold text-muted" title="Google OAuth chỉ khả dụng khi nối máy chủ">Tiếp tục với Google</button> : <a href="/oauth2/authorization/google" className="rounded-xl border border-[#cadbce] bg-white px-5 py-3 text-sm font-semibold text-brand hover:border-brand">Tiếp tục với Google</a>}<a href="#pricing" className="rounded-xl border border-[#cadbce] bg-white px-5 py-3 text-sm font-semibold text-brand hover:border-brand">Xem bảng giá</a></div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-subtle"><span>✓ Không cần cài ứng dụng</span><span>✓ Dữ liệu riêng theo trang trại</span><span>✓ Giao diện tiếng Việt</span></div>
          </div>
          <div aria-label="Minh họa trang trại bò" className="relative mx-auto grid aspect-[1.12] w-full max-w-[520px] place-items-center overflow-hidden rounded-[32px] bg-[#dfeee0]">
            <div className="absolute bottom-0 h-[42%] w-full rounded-t-[50%] bg-[#bfdcba]" /><div className="absolute bottom-0 left-0 h-[26%] w-full bg-[#8fbd8e]" />
            <div className="absolute left-[12%] top-[16%] size-24 rounded-full bg-[#f3cf83]" />
            <svg viewBox="0 0 420 300" className="relative z-10 w-[82%] drop-shadow-lg" role="img" aria-label="Bò khỏe mạnh trên đồng cỏ">
              <path d="M82 119c12-34 40-54 86-55l92 2c31 1 55 18 64 42l38 18c13 6 20 18 18 31l-5 37c-2 12-12 19-24 19h-18l-8 56h-19l-4-56H151l-10 56h-19l-2-59c-28-9-44-29-47-56l-4-34c-2-15 4-25 13-31z" fill="#f8f7ec" stroke="#4d7259" strokeWidth="5" />
              <path d="M104 116c12-18 30-25 48-24 16 1 25 9 25 23-2 15-19 23-44 24-17 1-31-7-29-23zm107-35c13-11 30-11 38 1 6 9 2 19-10 23-14 5-32 1-35-8-2-6 1-12 7-16zm78 18c18-7 31 0 33 12 2 11-11 18-25 19-17 1-30-5-31-14-1-7 8-14 23-17z" fill="#6d5841" />
              <path d="M337 134l35-6 18 9-8 12-31 6zm-2 15 38 4 11 10-7 11-37-4" fill="#f8f7ec" stroke="#4d7259" strokeWidth="4" />
              <circle cx="344" cy="115" r="4" fill="#183528" /><path d="M116 229h25m113 0h28" stroke="#4d7259" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <div className="absolute bottom-5 left-5 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg"><span className="block text-[10px] uppercase tracking-wide text-subtle">Hồ sơ đàn bò</span><span className="mt-1 block text-sm font-bold text-ink">Từng cá thể, một lịch sử</span></div>
          </div>
        </div>
      </section>
      <section className="border-y border-[#e7eee8] bg-white"><div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-8 text-center sm:grid-cols-4 sm:px-8"><Stat value="1" label="hồ sơ cho mỗi con"/><Stat value="8" label="nhóm sự kiện chăm sóc"/><Stat value="7" label="vai trò thành viên"/><Stat value="1–3 năm" label="thời hạn dịch vụ"/></div></section>
      <section id="features" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20"><SectionTitle eyebrow="Quản lý đầy đủ" title="Mọi hoạt động của đàn bò, ở cùng một nơi" description="Ghi nhận thông tin nhất quán để chủ trại và đội ngũ theo dõi công việc dễ dàng hơn."/><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(([title, description], index) => <article key={title} className="rounded-2xl border border-[#e5ece6] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf4eb] font-bold text-brand">0{index + 1}</span><h3 className="mt-4 text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-subtle">{description}</p></article>)}</div></section>
      <section id="steps" className="bg-[#f5f9f5] px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="Bắt đầu đơn giản" title="Từ thẻ tai đến quyết định chăm sóc"/><div className="mt-10 grid gap-4 md:grid-cols-4">{['Quét mã QR trên thẻ tai', 'Mở đúng hồ sơ cá thể', 'Ghi nhận hoạt động thực tế', 'Theo dõi tiến độ và nhắc việc'].map((text, index) => <div key={text} className="rounded-2xl bg-white p-5"><span className="text-xs font-bold text-brand">BƯỚC 0{index + 1}</span><p className="mt-4 text-sm font-semibold leading-6">{text}</p></div>)}</div></div></section>
      <section id="pricing" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20"><SectionTitle eyebrow="Chi phí theo trang trại" title="Chọn thời hạn phù hợp" description="Mức giá được lấy từ phiên bản bảng giá đang có hiệu lực."/><div className="mt-9 grid gap-4 md:grid-cols-3">{[1,2,3].map((years) => {
        const price = prices ? formatPrice(prices[`price${years}y` as keyof Prices]) : null
        return <article key={years} className={`rounded-2xl border p-6 ${years === 2 ? 'border-brand bg-[#f5faf6] shadow-sm' : 'border-[#e5ece6] bg-white'}`}><p className="text-sm font-semibold">{years} năm</p><p className="mt-4 text-2xl font-bold text-ink">{loading ? 'Đang tải…' : price ?? 'Chưa khả dụng'}</p><p className="mt-2 text-xs text-subtle">Mỗi trang trại</p></article>
      })}</div>{priceError && <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7d8b8] bg-[#fff9ed] px-4 py-3 text-sm text-[#70511a]"><span>Bảng giá hiện chưa khả dụng. Vui lòng thử lại sau.</span><button type="button" className="font-semibold underline" onClick={() => void loadPrices()} disabled={loading}>Thử tải lại</button></div>}</section>
      <section id="faq" className="bg-[#f5f9f5] px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-3xl"><SectionTitle eyebrow="Câu hỏi thường gặp" title="Điều bạn cần biết"/><div className="mt-8 divide-y divide-[#dce7de] rounded-2xl border border-[#dce7de] bg-white px-5">{questions.map(([question, answer], index) => <div key={question} className="py-4"><button type="button" className="flex w-full items-center justify-between gap-4 text-left text-sm font-semibold" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{question}<span className="text-brand">{openFaq === index ? '−' : '+'}</span></button>{openFaq === index && <p className="mt-3 text-sm leading-6 text-subtle">{answer}</p>}</div>)}</div></div></section>
      <section id="contact" className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div><span className="text-xs font-bold uppercase tracking-wide text-brand">Cần hỗ trợ?</span><h2 className="mt-2 text-2xl font-bold">Trao đổi cùng BeefCare</h2></div><div className="text-sm leading-7 text-subtle"><a className="block text-brand underline" href={`mailto:${contactEmail}`}>{contactEmail}</a><a className="text-brand underline" href="tel:+84386671863">0386 671 863</a></div></section>
      <footer className="border-t border-[#e6ece7] px-5 py-5 text-center text-xs text-subtle">© BeefCare · Quản lý trang trại bò thịt</footer>
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) { return <div><p className="text-xl font-bold text-brand">{value}</p><p className="mt-1 text-xs text-subtle">{label}</p></div> }
function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) { return <div className="max-w-2xl"><span className="text-xs font-bold uppercase tracking-wide text-brand">{eyebrow}</span><h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h2>{description && <p className="mt-3 text-sm leading-6 text-subtle">{description}</p>}</div> }

export function GuestAuthFlow({ client, onAuthenticated, initialError = null }: { client: AuthClient; onAuthenticated: () => void; initialError?: string | null }) {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const path = location.pathname
  const mockNotice = client.mode === 'mock' ? <div className="fixed bottom-3 right-3 z-30 rounded-full border border-[#c7dfcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-brand shadow">Chế độ mô phỏng · dữ liệu chỉ ở bộ nhớ</div> : null
  let page
  if (path === PATH.home) page = <PublicLandingPage client={client} />
  else if (path === PATH.register) page = <RegisterPage client={client} />
  else if (path === PATH.verification) page = <EmailSentPage client={client} kind="verification" />
  else if (path === PATH.forgot) page = <ForgotPasswordPage client={client} />
  else if (path === PATH.resetSent) page = <EmailSentPage client={client} kind="reset" />
  else if (path === PATH.reset) page = <ResetPasswordPage client={client} />
  else if (path === PATH.invalid) page = <InvalidLinkPage email={emailFromState(location.state) || normalizeEmail(search.get('email') || '')} flow={search.get('type') === 'verification' ? 'verification' : 'reset'} />
  else if (path === PATH.suspended) page = <SuspendedPage />
  else if (path === PATH.loginFailed) page = <SignInPage client={client} onAuthenticated={onAuthenticated} initialError="Email hoặc mật khẩu không đúng." />
  else page = <SignInPage client={client} onAuthenticated={onAuthenticated} initialError={initialError} />
  return <>{page}{mockNotice}</>
}

export const guestAuthPaths = PATH
