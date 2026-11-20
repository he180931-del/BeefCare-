import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../features/authentication'
import { AuthGate } from '../../features/authorization'
import { SessionProvider } from '../session/SessionProvider'

/** Thứ tự bắt buộc: Router → Auth → AuthGate → Session → Routes (docs/frontend-refactor-guide.md §6.1). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider><AuthGate><SessionProvider>{children}</SessionProvider></AuthGate></AuthProvider>
    </BrowserRouter>
  )
}
