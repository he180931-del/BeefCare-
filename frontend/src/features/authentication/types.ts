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
