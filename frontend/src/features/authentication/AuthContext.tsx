import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { BackendError, createBackendClient } from '../../api/backendClient'
import { userFacingError } from '../../api/userFacingError'
import logo from '../../assets/logo.png'
import farm from '../../assets/farm.png'

export type AuthClient = {
  isAuthenticated: () => Promise<boolean>
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
}

const defaultClient = createBackendClient({ baseUrl: import.meta.env.VITE_BEEFCARE_API_URL || '' })
const AuthContext = createContext<{ authenticated: boolean; logout: () => Promise<void> } | null>(null)

function loginErrorMessage(error: unknown): string {
  const backendError = error instanceof BackendError ? error : null
  const code = backendError?.code?.toLowerCase() || ''
  const message = backendError?.message?.toLowerCase() || (error instanceof Error ? error.message.toLowerCase() : '')

  // Do not expose the backend validation key (or the credential details) on the sign-in form.
  // FE01-01 is deliberately generic so the UI does not reveal whether an account exists.
  if (
    (backendError?.status === 401 && (!code || code === 'msg-fe01-01' || /bad credentials|invalid credentials|email.*mật khẩu|email.*password/.test(message)))
    || ((backendError?.status === 400 || backendError?.status === 422) && (code === 'error.validation' || message.includes('error.validation')))
    || message.includes('error.validation')
    || /bad credentials|invalid credentials|email.*mật khẩu|email.*password/.test(message)
  ) {
    return 'Email hoặc mật khẩu không đúng.'
  }

  return userFacingError(error, 'Đăng nhập không thành công.')
}

export function AuthProvider({ client = defaultClient, children }: { client?: AuthClient; children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'anonymous' | 'authenticated'>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    client.isAuthenticated().then((ok) => {
      if (active) setStatus(ok ? 'authenticated' : 'anonymous')
    }).catch(() => {
      if (active) {
        setError('Không thể kết nối máy chủ xác thực.')
        setStatus('anonymous')
      }
    })
    return () => { active = false }
  }, [client])

  const value = useMemo(() => ({
    authenticated: status === 'authenticated',
    logout: async () => {
      await client.logout()
      setStatus('anonymous')
    },
  }), [client, status])

  if (status === 'checking') return <div className="grid min-h-screen place-items-center text-sm text-subtle">Đang kiểm tra phiên đăng nhập…</div>
  return <AuthContext.Provider value={value}>{status === 'authenticated' ? children : <LoginForm client={client} initialError={error} onSuccess={() => setStatus('authenticated')} />}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

function LoginForm({ client, initialError, onSuccess }: { client: AuthClient; initialError: string | null; onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(initialError)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await client.login(email.trim(), password, remember)
      onSuccess()
    } catch (reason) {
      setError(loginErrorMessage(reason))
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="min-h-screen bg-white text-ink md:grid md:grid-cols-[minmax(300px,38vw)_minmax(0,1fr)] lg:grid-cols-[minmax(420px,44vw)_minmax(0,1fr)]">
    <aside className="relative hidden min-h-screen overflow-hidden bg-side px-7 py-7 text-white md:flex md:flex-col lg:px-10 lg:py-9">
      <a href="/ui/scr-01" className="relative z-10 inline-flex w-fit items-center gap-3 text-2xl font-bold text-white no-underline"><img src={logo} alt="" className="size-11 rounded-[10px] object-cover" />BeefCare</a>
      <div className="relative z-10 mt-14 max-w-lg lg:mt-20"><h2 className="m-0 text-[28px] font-bold leading-[1.2] text-white lg:text-[38px]">Mỗi con bò một hồ sơ.<br />Cả trang trại trong tầm tay.</h2><p className="mb-0 mt-5 max-w-md text-sm leading-6 text-[#d7ebdf] lg:text-base lg:leading-7">Ghi nhận ngay tại chuồng, theo dõi sức khỏe và sinh sản, nhận đúng việc cần làm trên máy tính bảng hoặc điện thoại.</p></div>
      <div className="relative z-10 mt-auto -mx-7 -mb-7 lg:-mx-10 lg:-mb-9"><img src={farm} alt="Minh họa trang trại bò" className="mx-auto w-full max-w-[680px] object-contain" /></div>
    </aside>
    <section className="flex min-h-screen min-w-0 flex-col bg-page">
      <header className="flex min-h-16 items-center justify-between border-b border-rule px-5 sm:px-8 lg:px-12"><a href="/ui/scr-01" className="inline-flex items-center gap-2 text-xl font-bold text-brand no-underline md:hidden"><img src={logo} alt="" className="size-9 rounded-lg object-cover" />BeefCare</a><a href="/ui/scr-01" className="ml-auto text-sm font-semibold text-subtle no-underline hover:text-brand">Về trang giới thiệu</a></header>
      <div className="flex flex-1 items-center px-5 py-9 sm:px-8 md:py-12 lg:px-14"><form onSubmit={submit} className="mx-auto flex w-full max-w-[540px] flex-col gap-5" noValidate>
        <div><h1 className="m-0 text-[30px] font-bold leading-tight text-ink sm:text-[36px]">Đăng nhập</h1><p className="mb-0 mt-3 text-sm leading-6 text-subtle">Tiếp tục quản lý trang trại và công việc hôm nay.</p></div>
        {error && <div role="alert" className="border-l-[3px] border-err-fg bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"><strong className="block">Đăng nhập chưa thành công</strong>{error}</div>}
        <label className="flex flex-col gap-2 text-sm font-semibold text-ink">Email<input aria-label="Email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-[52px] rounded-[10px] border border-field bg-white px-4 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" placeholder="name@example.com" /></label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-ink">Mật khẩu<span className="relative"><input aria-label="Mật khẩu" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-[52px] w-full rounded-[10px] border border-field bg-white px-4 pr-20 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" placeholder="Nhập mật khẩu" /><button type="button" className="absolute inset-y-0 right-0 cursor-pointer px-4 text-xs font-semibold text-brand hover:underline" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ẩn' : 'Hiện'}</button></span></label>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><label className="flex cursor-pointer items-center gap-2 text-subtle"><input className="size-4 accent-brand" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Ghi nhớ đăng nhập</label><a href="/ui/scr-05" className="font-semibold text-brand no-underline hover:underline">Quên mật khẩu?</a></div>
        <button type="submit" disabled={submitting} className="inline-flex h-[54px] cursor-pointer items-center justify-center rounded-[10px] bg-brand px-5 text-base font-bold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-wait disabled:opacity-60">{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        <p className="m-0 text-center text-sm text-subtle">Chưa có tài khoản? <a href="/ui/scr-03" className="font-semibold text-brand no-underline hover:underline">Đăng ký Chủ trại</a></p>
      </form></div>
      <footer className="flex flex-col gap-1 border-t border-rule px-5 py-4 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><span>© 2026 BeefCare</span><span>Hỗ trợ: 0386 671 863 · tuanpqhe181869@fpt.edu.vn</span></footer>
    </section>
  </main>
}
