import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { BackendError, createBackendClient } from '../../api/backendClient'
import { userFacingError } from '../../api/userFacingError'

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

  return (
    <main className="grid min-h-screen place-items-center bg-page px-4">
      <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-field bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-ink">Đăng nhập BeefCare</h1>
          <p className="mt-1 text-sm text-subtle">Đăng nhập để vào trang trại.</p>
        </div>
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">Email<input aria-label="Email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-lg border border-field px-3 font-normal" /></label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">Mật khẩu<input aria-label="Mật khẩu" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-lg border border-field px-3 font-normal" /></label>
        <label className="flex items-center gap-2 text-sm text-subtle"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Ghi nhớ đăng nhập</label>
        <button type="submit" disabled={submitting} className="h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60">{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </main>
  )
}
