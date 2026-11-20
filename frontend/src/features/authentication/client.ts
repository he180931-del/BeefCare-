import { createBackendClient } from '../../shared/api/backendClient'
import type { AuthClient, RegistrationRequest } from './types'
import { demo } from '../../demo/demoModules'

export function createBackendAuthClient(): AuthClient {
  const api = createBackendClient({ baseUrl: import.meta.env.VITE_BEEFCARE_API_URL || '' })
  return {
    mode: 'backend',
    isAuthenticated: api.isAuthenticated,
    login: api.login,
    logout: api.logout,
    register: (request: RegistrationRequest) => api.request<void>('/api/register', { method: 'POST', body: request }),
    resendVerification: (email) => api.request<{ nextAllowedAt: string }>('/api/account/verification/resend', { method: 'POST', body: { email } }),
    requestPasswordReset: (email) => api.request<void>('/api/account/reset-password/init', { method: 'POST', body: { email } }),
    validatePasswordReset: (token) => api.get<{ valid: boolean; email?: string }>(`/api/account/reset-password/validate?token=${encodeURIComponent(token)}`),
    resetPassword: (token, newPassword, confirmPassword) => api.request<void>('/api/account/reset-password/finish', {
      method: 'POST', body: { key: token, newPassword, confirmPassword },
    }),
    getPublicLanding: () => api.get('/api/public/landing'),
    getPublicPrices: () => api.get('/api/public/prices'),
  }
}

const authMode = (import.meta.env as ImportMetaEnv & { VITE_BEEFCARE_AUTH_MODE?: string }).VITE_BEEFCARE_AUTH_MODE
export const defaultAuthClient: AuthClient = authMode === 'mock'
  ? demo.mockAuth.createMockAuthClient()
  : createBackendAuthClient()
