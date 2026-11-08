import { useLocation } from 'react-router-dom'
import type { AuthClient } from '../types'
import { normalizeEmail } from '../validation'
import { AUTH_PATH, emailFromState } from '../domain/authErrors'
import { PublicLandingPage } from './PublicLandingPage'
import { RegisterPage } from './RegisterPage'
import { SignInPage } from './SignInPage'
import { EmailSentPage } from './EmailSentPage'
import { ForgotPasswordPage, InvalidLinkPage, ResetPasswordPage } from './RecoveryPages'
import { SuspendedPage } from './SuspendedPage'

/** Các màn hình dành cho khách chưa đăng nhập; chọn màn hình theo đường dẫn. */
export function GuestAuthFlow({ client, onAuthenticated, initialError = null, forceSuspended = false }: { client: AuthClient; onAuthenticated: () => void; initialError?: string | null; forceSuspended?: boolean }) {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const path = location.pathname
  const mockNotice = client.mode === 'mock' ? <div className="fixed bottom-3 right-3 z-30 rounded-full border border-[#c7dfcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-brand shadow">Chế độ mô phỏng · dữ liệu chỉ ở bộ nhớ</div> : null
  let page
  if (forceSuspended || path === AUTH_PATH.suspended) page = <SuspendedPage />
  else if (path === AUTH_PATH.home) page = <PublicLandingPage client={client} />
  else if (path === AUTH_PATH.register) page = <RegisterPage client={client} />
  else if (path === AUTH_PATH.verification) page = <EmailSentPage client={client} kind="verification" />
  else if (path === AUTH_PATH.forgot) page = <ForgotPasswordPage client={client} />
  else if (path === AUTH_PATH.resetSent) page = <EmailSentPage client={client} kind="reset" />
  else if (path === AUTH_PATH.reset || path === '/reset-password') page = <ResetPasswordPage client={client} />
  else if (path === AUTH_PATH.invalid) page = <InvalidLinkPage email={emailFromState(location.state) || normalizeEmail(search.get('email') || '')} flow={search.get('type') === 'verification' ? 'verification' : 'reset'} />
  else if (path === AUTH_PATH.loginFailed) page = <SignInPage client={client} onAuthenticated={onAuthenticated} initialError={null} startFailed />
  else page = <SignInPage client={client} onAuthenticated={onAuthenticated} initialError={initialError} />
  return <>{page}{mockNotice}</>
}

export const guestAuthPaths = AUTH_PATH
