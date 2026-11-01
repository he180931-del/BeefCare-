/**
 * Unit tests for Login form behavior.
 * Covers: form validation, submit states, error display, remember-me,
 * and backend error code mapping (MSG-FE01-xx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

/* ------------------------------------------------------------------ */
/*  Helpers: build a fake AuthClient matching backendClient shape      */
/* ------------------------------------------------------------------ */
class BackendError extends Error {
  status: number
  body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    const code = (body?.code as string) ?? ''
    const msg = (body?.message as string) ?? `HTTP ${status}`
    super(msg || code || `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockRejectedValue(new BackendError(401, {})),
    getCsrf: vi.fn().mockResolvedValue({ token: 'csrf-tok' }),
    get: vi.fn(),
    command: vi.fn(),
    request: vi.fn(),
    farmPath: vi.fn(),
    newCommandKey: vi.fn(),
    ...overrides,
  }
}

/* lazy import so we can mock backendClient per test */
async function renderAuth(client: ReturnType<typeof fakeClient>) {
  // AuthContext imports backendClient; we intercept via the provider
  const { AuthProvider } = await import(
    '../../../src/features/authentication/AuthContext'
  )
  return render(
    <MemoryRouter initialEntries={['/dang-nhap']}>
      <AuthProvider client={client as never}>
        <div data-testid="protected">Protected content</div>
      </AuthProvider>
    </MemoryRouter>,
  )
}

/* ================================================================== */
/*  TC-AUTH-U01  Empty form cannot be submitted                       */
/* ================================================================== */
describe('TC-AUTH-U01: Empty form cannot be submitted', () => {
  it('email and password are required fields', async () => {
    const client = fakeClient()
    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText('Mật khẩu', { exact: true })

    expect(emailInput).toBeRequired()
    expect(passwordInput).toBeRequired()
    expect(client.login).not.toHaveBeenCalled()
  })
})

/* ================================================================== */
/*  TC-AUTH-U02  Successful login renders protected content            */
/* ================================================================== */
describe('TC-AUTH-U02: Successful login flow', () => {
  it('fills email + password, submits, shows protected content', async () => {
    const user = userEvent.setup()
    const client = fakeClient()

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/email/i), 'manager@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'beefcare-dev-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    await waitFor(() => {
      expect(client.login).toHaveBeenCalledWith(
        'manager@beefcare.local',
        'beefcare-dev-password',
        false,
      )
    })
  })
})

/* ================================================================== */
/*  TC-AUTH-U03  Remember-me checkbox passes true to login             */
/* ================================================================== */
describe('TC-AUTH-U03: Remember-me checkbox', () => {
  it('passes rememberMe=true when checkbox is checked', async () => {
    const user = userEvent.setup()
    const client = fakeClient()

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/email/i), 'owner@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'test-password-123')
    await user.click(screen.getByLabelText(/ghi nhớ/i))
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    await waitFor(() => {
      expect(client.login).toHaveBeenCalledWith(
        'owner@beefcare.local',
        'test-password-123',
        true,
      )
    })
  })
})

/* ================================================================== */
/*  TC-AUTH-U04  Wrong credentials shows error alert                   */
/* ================================================================== */
describe('TC-AUTH-U04: Wrong credentials error', () => {
  it('displays error when login returns 401 MSG-FE01-01', async () => {
    const user = userEvent.setup()
    const client = fakeClient({
      login: vi.fn().mockRejectedValue(
        new BackendError(401, { code: 'MSG-FE01-01', message: 'Email hoặc mật khẩu không đúng.' }),
      ),
    })

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/email/i), 'wrong@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert.textContent).toBe('Email hoặc mật khẩu không đúng.')
      expect(alert.textContent).not.toContain('error.validation')
    })
  })

  it('maps backend validation keys to the user-facing login message', async () => {
    const user = userEvent.setup()
    const client = fakeClient({
      login: vi.fn().mockRejectedValue(new BackendError(400, { code: 'error.validation', message: 'error.validation' })),
    })

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/email/i), 'wrong@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.')
    expect(screen.getByRole('alert')).not.toHaveTextContent('error.validation')
  })

  it('keeps network failures in Vietnamese instead of exposing fetch details', async () => {
    const user = userEvent.setup()
    const client = fakeClient({ login: vi.fn().mockRejectedValue(new Error('Failed to fetch')) })

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/email/i), 'owner@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Không thể kết nối máy chủ')
    expect(alert).not.toHaveTextContent('Failed to fetch')
  })
})

/* ================================================================== */
/*  TC-AUTH-U05  Account locked shows 423 error                        */
/* ================================================================== */
describe('TC-AUTH-U05: Account lockout (423)', () => {
  it('displays lockout error after 5 failed attempts', async () => {
    const user = userEvent.setup()
    const lockUntil = new Date(Date.now() + 15 * 60_000).toISOString()
    const client = fakeClient({
      login: vi.fn().mockRejectedValue(
        new BackendError(423, {
          code: 'MSG-FE01-02',
          message: `Password sign-in is locked. Try again after ${lockUntil}`,
          params: { time: lockUntil },
        }),
      ),
    })

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/email/i), 'locked@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'any-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})

/* ================================================================== */
/*  TC-AUTH-U06  Suspended account shows 403 error                     */
/* ================================================================== */
describe('TC-AUTH-U06: Suspended account (403)', () => {
  it('displays suspension error for MSG-FE01-03', async () => {
    const user = userEvent.setup()
    const client = fakeClient({
      login: vi.fn().mockRejectedValue(
        new BackendError(403, {
          code: 'MSG-FE01-03',
          message: 'The account suspended@beefcare.local cannot sign in at the moment.',
          params: { email: 'suspended@beefcare.local' },
        }),
      ),
    })

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/email/i), 'suspended@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'any-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})

/* ================================================================== */
/*  TC-AUTH-U07  Email is trimmed before sending                       */
/* ================================================================== */
describe('TC-AUTH-U07: Email trimming', () => {
  it('trims leading/trailing spaces from email', async () => {
    const user = userEvent.setup()
    const client = fakeClient()

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/email/i), '  manager@beefcare.local  ')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'beefcare-dev-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    await waitFor(() => {
      expect(client.login).toHaveBeenCalledWith(
        'manager@beefcare.local',
        'beefcare-dev-password',
        false,
      )
    })
  })
})

/* ================================================================== */
/*  TC-AUTH-U08  Button disabled while submitting                      */
/* ================================================================== */
describe('TC-AUTH-U08: Submit button disabled during login', () => {
  it('disables the submit button while waiting for response', async () => {
    const user = userEvent.setup()
    let resolveLogin: () => void
    const loginPromise = new Promise<void>((res) => { resolveLogin = res })
    const client = fakeClient({ login: vi.fn().mockReturnValue(loginPromise) })

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/email/i), 'owner@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'beefcare-dev-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    // While waiting, the button text changes and is disabled
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /đang đăng nhập/i })
      expect(btn).toBeDisabled()
    })

    resolveLogin!()
  })
})

/* ================================================================== */
/*  TC-AUTH-U09  Unverified email shows 401 error (MSG-FE01-11)        */
/* ================================================================== */
describe('TC-AUTH-U09: Unverified email (MSG-FE01-11)', () => {
  it('displays error when email not verified', async () => {
    const user = userEvent.setup()
    const client = fakeClient({
      login: vi.fn().mockRejectedValue(
        new BackendError(401, {
          code: 'MSG-FE01-11',
          message: 'Please verify your email before signing in.',
          params: { email: 'unverified@beefcare.local' },
        }),
      ),
    })

    await renderAuth(client)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/email/i), 'unverified@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'any-password')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
