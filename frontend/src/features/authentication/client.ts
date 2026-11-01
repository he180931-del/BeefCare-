import { createBackendClient } from '../../api/backendClient'
import type { AuthClient, RegistrationRequest } from './types'

export function createBackendAuthClient(): AuthClient {
  const api = createBackendClient({ baseUrl: import.meta.env.VITE_BEEFCARE_API_URL || '' })
  return {
    mode: 'backend',
    isAuthenticated: api.isAuthenticated,
    login: api.login,
    logout: api.logout,
    register: (request: RegistrationRequest) => api.request<void>('/api/register', { method: 'POST', body: request }),
    resendVerification: (email) => api.request<void>('/api/account/verification/resend', { method: 'POST', body: { email } }),
    requestPasswordReset: (email) => api.request<void>('/api/account/reset-password/init', { method: 'POST', body: { email } }),
    validatePasswordReset: (token) => api.get<{ valid: boolean; email?: string }>(`/api/account/reset-password/validate?token=${encodeURIComponent(token)}`),
    resetPassword: (token, newPassword, confirmPassword) => api.request<void>('/api/account/reset-password/finish', {
      method: 'POST', body: { key: token, newPassword, confirmPassword },
    }),
    getPublicLanding: () => api.get('/api/public/landing'),
    getPublicPrices: () => api.get('/api/public/prices'),
  }
}

/** Explicit local-only client. State exists only in this closure and the current page memory. */
export function createMockAuthClient(): AuthClient {
  let authenticated = false
  return {
    mode: 'mock',
    isAuthenticated: async () => authenticated,
    login: async (email, password) => {
      if (!email || !password) throw new Error('Email hoặc mật khẩu không đúng.')
      authenticated = true
    },
    logout: async () => { authenticated = false },
    register: async () => undefined,
    resendVerification: async () => undefined,
    requestPasswordReset: async () => undefined,
    validatePasswordReset: async (token) => ({ valid: Boolean(token), email: undefined }),
    resetPassword: async () => undefined,
    getPublicLanding: async () => ({}),
    getPublicPrices: async () => { throw new Error('Giá gói chưa khả dụng trong bản mô phỏng.') },
  }
}

const authMode = (import.meta.env as ImportMetaEnv & { VITE_BEEFCARE_AUTH_MODE?: string }).VITE_BEEFCARE_AUTH_MODE
export const defaultAuthClient: AuthClient = authMode === 'mock'
  ? createMockAuthClient()
  : createBackendAuthClient()
