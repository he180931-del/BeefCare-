import { useMemo } from 'react'
import { backendTransport } from '../../../shared/api/backendTransport'
import { defaultAuthClient } from '../client'
import type { AuthClient } from '../types'

/**
 * Feature-owned orchestration boundary for authentication and the signed-in
 * session profile.  Pages/providers keep navigation and view state here, but
 * do not reach the transport or client directly.
 */
export function useAuthenticationUseCase(client: AuthClient = defaultAuthClient) {
  return useMemo(() => ({
    client,
    isAuthenticated: () => client.isAuthenticated(),
    logout: () => client.logout(),
    loadSessionProfile: () => backendTransport.get('/api/account/profile'),
    requestPasswordReset: client.requestPasswordReset,
    validatePasswordReset: client.validatePasswordReset,
    resetPassword: client.resetPassword,
  }), [client])
}
