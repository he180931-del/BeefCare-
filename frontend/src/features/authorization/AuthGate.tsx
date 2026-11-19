import type { ReactNode } from 'react'
import { useAuth } from '../authentication/AuthContext'

export function AuthGate({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth()
  return authenticated ? children : null
}
