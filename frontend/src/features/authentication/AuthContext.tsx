import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom'
import { BackendError } from '../../api/backendClient'
import { notifySessionSignedOut, onSessionExpired, onSessionSignedOut } from '../../api/sessionLifecycle'
import { userFacingError } from '../../api/userFacingError'
import { defaultAuthClient } from './client'
import { GuestAuthFlow } from './pages/GuestAuthFlow'
import { takeInvitationLink } from './invitationReturn'
import { clearSelectedFarmOnDevice } from '../farm-workspace/selectedFarm'
import type { AuthClient } from './types'
import { AUTH_PATH } from './domain/authErrors'

export type { AuthClient } from './types'

type AuthContextValue = { authenticated: boolean; mode: 'backend' | 'mock'; logout: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

function loginErrorMessage(error: unknown): string {
  const backendError = error instanceof BackendError ? error : null
  const code = backendError?.code?.toLowerCase() || ''
  const message = backendError?.message?.toLowerCase() || (error instanceof Error ? error.message.toLowerCase() : '')
  if (code === 'msg-fe01-11') return 'Email chưa được xác minh. Vui lòng mở email xác minh hoặc gửi lại liên kết.'
  if (
    (backendError?.status === 401 && (!code || code === 'msg-fe01-01' || /bad credentials|invalid credentials|email.*mật khẩu|email.*password/.test(message)))
    || ((backendError?.status === 400 || backendError?.status === 422) && (code === 'error.validation' || message.includes('error.validation')))
    || message.includes('error.validation')
    || /bad credentials|invalid credentials|email.*mật khẩu|email.*password/.test(message)
  ) return 'Email hoặc mật khẩu không đúng.'
  return userFacingError(error, 'Đăng nhập không thành công.')
}

export function AuthProvider({ client = defaultAuthClient, children }: { client?: AuthClient; children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'anonymous' | 'authenticated' | 'suspended'>('checking')
  const [error, setError] = useState<string | null>(null)
  const hasRouter = useInRouterContext()
  const expireSession = useCallback(() => {
    clearSelectedFarmOnDevice()
    setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    let active = true
    setStatus('checking')
    setError(null)
    client.isAuthenticated().then((ok) => {
      if (active) setStatus(ok ? 'authenticated' : 'anonymous')
    }).catch((reason: unknown) => {
      if (active) {
        if (reason instanceof BackendError && reason.code === 'MSG-FE01-03') {
          setStatus('suspended')
        } else {
          setError('Không thể kiểm tra phiên đăng nhập với máy chủ. Hãy thử đăng nhập lại hoặc kiểm tra kết nối.')
          setStatus('anonymous')
        }
      }
    })
    return () => { active = false }
  }, [client])

  const value = useMemo<AuthContextValue>(() => ({
    authenticated: status === 'authenticated',
    mode: client.mode ?? 'backend',
    logout: async () => {
      let logoutFailed = false
      try {
        await client.logout()
      } catch {
        logoutFailed = true
      }
      clearSelectedFarmOnDevice()
      setError(logoutFailed
        ? 'Không thể xác nhận đăng xuất với máy chủ. Phiên trên thiết bị này đã được xóa; bạn có thể đăng nhập lại.'
        : null)
      notifySessionSignedOut()
      setStatus('anonymous')
    },
  }), [client, status])

  if (status === 'checking') return <div className="grid min-h-screen place-items-center text-sm text-subtle">Đang kiểm tra phiên đăng nhập…</div>
  return (
    <AuthContext.Provider value={value}>
      {status === 'authenticated' && hasRouter && <SessionRedirect onExpired={expireSession} />}
      {status === 'authenticated' && hasRouter && <InvitationResume />}
      {status === 'authenticated'
        ? children
        : hasRouter
          ? <GuestAuthFlow client={client} initialError={error} forceSuspended={status === 'suspended'} onExitSuspended={() => { setError(null); setStatus('anonymous') }} onAuthenticated={() => setStatus('authenticated')} />
          : <LegacyLoginForm client={client} initialError={error} onSuccess={() => setStatus('authenticated')} />}
    </AuthContext.Provider>
  )
}

/** After any sign-in (password, Google or e-mail verification), reopen an invitation link the visitor started from (D28). */
function InvitationResume() {
  const navigate = useNavigate()
  const location = useLocation()
  const current = location.pathname + location.search
  useEffect(() => {
    const target = takeInvitationLink(current)
    if (target) navigate(target, { replace: true })
    // Only the moment of signing in matters; later navigation must not be redirected again.
  }, [])
  return null
}

function SessionRedirect({ onExpired }: { onExpired: () => void }) {
  const navigate = useNavigate()
  useEffect(() => {
    const stopListeningForExpiry = onSessionExpired(() => {
      onExpired()
      navigate(AUTH_PATH.signIn, { replace: true })
    })
    const stopListeningForSignOut = onSessionSignedOut(() => {
      navigate(AUTH_PATH.signIn, { replace: true })
    })
    return () => {
      stopListeningForExpiry()
      stopListeningForSignOut()
    }
  }, [navigate, onExpired])
  return null
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

/** Keeps headless provider integrations usable; the application itself is always mounted under BrowserRouter. */
function LegacyLoginForm({ client, initialError, onSuccess }: { client: AuthClient; initialError: string | null; onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState(initialError)
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setSubmitting(true)
    try { await client.login(email.trim().toLocaleLowerCase('en-US'), password, remember); onSuccess() }
    catch (reason) { setError(loginErrorMessage(reason)) }
    finally { setSubmitting(false) }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-page px-4">
      <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-field bg-white p-8 shadow-sm">
        <div><h1 className="text-2xl font-bold text-ink">Đăng nhập BeefCare</h1><p className="mt-1 text-sm text-subtle">Đăng nhập để vào trang trại.</p></div>
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">Email<input aria-label="Email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-lg border border-field px-3 font-normal" /></label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">Mật khẩu<input aria-label="Mật khẩu" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-lg border border-field px-3 font-normal" /></label>
        <label className="flex items-center gap-2 text-sm text-subtle"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Ghi nhớ đăng nhập</label>
        <button type="submit" disabled={submitting} className="h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60">{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </main>
  )
}
