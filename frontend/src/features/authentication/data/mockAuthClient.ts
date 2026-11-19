import { MOCK_EXISTING_ACCOUNT_EMAIL, MOCK_LANDING, MOCK_PRICES, MOCK_SUSPENDED_EMAIL, MOCK_WRONG_CREDENTIALS_EMAIL } from './authMock'
import { DEMO_PASSWORD, DEMO_USERS, readMockUserEmail, writeMockUserEmail } from './demoUsers'
import type { AuthClient } from '../types'

/** Lỗi mô phỏng có `code` và `status` như BackendError để trang đăng nhập hiển thị đúng khung. */
class MockAuthError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

/** Explicit local-only client. Only the chosen demo email is kept, in sessionStorage, so a reload stays signed in. */
export function createMockAuthClient(): AuthClient {
  return {
    mode: 'mock',
    demoAccounts: DEMO_USERS.map(({ label, email }) => ({ label, email, password: DEMO_PASSWORD })),
    demoErrorEmails: { wrongCredentials: MOCK_WRONG_CREDENTIALS_EMAIL, suspended: MOCK_SUSPENDED_EMAIL },
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
    resendVerification: async () => ({ nextAllowedAt: new Date(Date.now() + 60_000).toISOString() }),
    requestPasswordReset: async () => undefined,
    validatePasswordReset: async (token) => ({ valid: token !== 'het-han' && Boolean(token), email: 'ngoc.tran@example.com' }),
    resetPassword: async () => undefined,
    getPublicLanding: async () => structuredClone(MOCK_LANDING),
    getPublicPrices: async () => ({ ...MOCK_PRICES }),
  }
}
