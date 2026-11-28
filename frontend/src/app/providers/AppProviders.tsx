import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../features/authentication'
import { AuthGate } from '../../features/authorization'
import { SessionProvider } from '../session/SessionProvider'
import { AccountDialogProvider } from '../../features/account'

/** Thứ tự bắt buộc: Router → Auth → AuthGate → Session → Routes. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider><AuthGate><SessionProvider><AccountDialogProvider>{children}</AccountDialogProvider></SessionProvider></AuthGate></AuthProvider>
    </BrowserRouter>
  )
}
