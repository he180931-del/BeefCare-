import { createBackendClient } from '../../api/backendClient'
import { readMockUserEmail, writeMockUserEmail } from './demoUsers'
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

/** Explicit local-only client. Only the chosen demo email is kept, in sessionStorage, so a reload stays signed in. */
export function createMockAuthClient(): AuthClient {
  return {
    mode: 'mock',
    isAuthenticated: async () => Boolean(readMockUserEmail()),
    login: async (email, password) => {
      if (!email || !password) throw new Error('Email hoặc mật khẩu không đúng.')
      writeMockUserEmail(email)
    },
    logout: async () => { writeMockUserEmail(null) },
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
