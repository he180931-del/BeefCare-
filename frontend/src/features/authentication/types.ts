export type RegistrationRequest = {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  termsAccepted: boolean
}

export type PasswordResetValidation = { valid: boolean; email?: string }
export type ResendResult = { nextAllowedAt: string }

/** Implementations must be selected explicitly; a failed backend request is never a reason to switch modes. */
export type AuthClient = {
  mode?: 'backend' | 'mock'
  /** Chỉ client mô phỏng: tài khoản theo vai trò để chọn nhanh trên trang đăng nhập. */
  demoAccounts?: ReadonlyArray<{ label: string; email: string; password: string }>
  /** Chỉ client mô phỏng: email mở khung lỗi sai thông tin và tài khoản tạm ngưng. */
  demoErrorEmails?: { wrongCredentials: string; suspended: string }
  isAuthenticated: () => Promise<boolean>
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
  register?: (request: RegistrationRequest) => Promise<void>
  resendVerification?: (email: string) => Promise<ResendResult>
  requestPasswordReset?: (email: string) => Promise<void>
  validatePasswordReset?: (token: string) => Promise<PasswordResetValidation>
  resetPassword?: (token: string, newPassword: string, confirmPassword: string) => Promise<void>
  getPublicLanding?: () => Promise<unknown>
  getPublicPrices?: () => Promise<unknown>
}

export type AuthStatusView = 'sign-in' | 'verification-sent' | 'reset-sent' | 'reset-success' | 'invalid-link' | 'suspended'
