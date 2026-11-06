import { createBackendClient } from '../../api/backendClient'
import { MOCK_EXISTING_ACCOUNT_EMAIL, MOCK_LANDING, MOCK_PRICES, MOCK_SUSPENDED_EMAIL, MOCK_WRONG_CREDENTIALS_EMAIL } from './data/authMock'
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

/** Lỗi mô phỏng có `code` và `status` như BackendError để trang đăng nhập hiển thị đúng khung. */
class MockAuthError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

/** Explicit local-only client. Only the chosen demo email is kept, in sessionStorage, so a reload stays signed in. */
export function createMockAuthClient(): AuthClient {
  return {
    mode: 'mock',
    isAuthenticated: async () => Boolean(readMockUserEmail()),
    login: async (email, password) => {
      const key = email.trim().toLowerCase()
      if (!email || !password || key === MOCK_WRONG_CREDENTIALS_EMAIL) throw new MockAuthError(401, 'MSG-FE01-01', 'Email hoặc mật khẩu chưa chính xác.')
      if (key === MOCK_SUSPENDED_EMAIL) throw new MockAuthError(403, 'MSG-FE01-03', 'Tài khoản đang tạm ngưng.')
      writeMockUserEmail(email)
    },
    logout: async () => { writeMockUserEmail(null) },
    register: async (request) => {
      if (request.email.trim().toLowerCase() === MOCK_EXISTING_ACCOUNT_EMAIL) throw new MockAuthError(409, 'MSG-FE01-10', 'Email đã có tài khoản.')
    },
    resendVerification: async () => undefined,
    requestPasswordReset: async () => undefined,
    validatePasswordReset: async (token) => ({ valid: token !== 'het-han' && Boolean(token), email: 'ngoc.tran@example.com' }),
    resetPassword: async () => undefined,
    getPublicLanding: async () => structuredClone(MOCK_LANDING),
    getPublicPrices: async () => ({ ...MOCK_PRICES }),
  }
}

const authMode = (import.meta.env as ImportMetaEnv & { VITE_BEEFCARE_AUTH_MODE?: string }).VITE_BEEFCARE_AUTH_MODE
export const defaultAuthClient: AuthClient = authMode === 'mock'
  ? createMockAuthClient()
  : createBackendAuthClient()
