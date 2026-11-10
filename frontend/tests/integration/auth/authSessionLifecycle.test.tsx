import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth, type AuthClient } from '../../../src/features/authentication/AuthContext'
import { SELECTED_FARM_STORAGE_KEY } from '../../../src/features/farm-workspace/selectedFarm'
import { BackendError } from '../../../src/api/backendClient'

function AuthenticatedWorkspace() {
  const { authenticated, logout } = useAuth()
  return (
    <div>
      <h1>Trang chủ Quản lý Trại bò</h1>
      <p data-testid="auth-status">{authenticated ? 'ĐÃ ĐĂNG NHẬP' : 'CHƯA ĐĂNG NHẬP'}</p>
      <button type="button" onClick={() => logout()}>Đăng xuất</button>
    </div>
  )
}

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>
}

describe('Auth Session Lifecycle Integration Tests (FE-01 & FE-02)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('TC-AUTH-INT01: End-to-end session lifecycle: login -> authenticated workspace -> logout -> public page -> login form', async () => {
    let authState = false
    const user = userEvent.setup()

    const mockClient: AuthClient = {
      isAuthenticated: vi.fn(async () => authState),
      login: vi.fn(async (_username, _password, _rememberMe) => {
        authState = true
      }),
      logout: vi.fn(async () => {
        authState = false
      }),
    }

    // "/" is now the public landing page (SCR-01), so the sign-in screen is reached from its own path.
    render(
      <MemoryRouter initialEntries={['/sign-in']}>
        <AuthProvider client={mockClient}>
          <AuthenticatedWorkspace />
        </AuthProvider>
      </MemoryRouter>
    )

    // 1. Kiểm tra màn hình đăng nhập ban đầu
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument()
    expect(screen.queryByText('Trang chủ Quản lý Trại bò')).not.toBeInTheDocument()

    // 2. Nhập thông tin tài khoản và đăng nhập
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText('Mật khẩu')
    const submitButton = screen.getByRole('button', { name: 'Đăng nhập' })

    await user.type(emailInput, 'manager@beefcare.local')
    await user.type(passwordInput, 'beefcare-dev-password')
    await user.click(submitButton)

    // 3. Chuyển sang màn hình trang chủ quản lý trại bò đã đăng nhập
    expect(await screen.findByText('Trang chủ Quản lý Trại bò')).toBeInTheDocument()
    expect(screen.getByTestId('auth-status')).toHaveTextContent('ĐÃ ĐĂNG NHẬP')
    expect(mockClient.login).toHaveBeenCalledWith('manager@beefcare.local', 'beefcare-dev-password', false)

    // 4. Thực hiện đăng xuất
    localStorage.setItem(SELECTED_FARM_STORAGE_KEY, '42')
    const logoutButton = screen.getByRole('button', { name: /đăng xuất/i })
    await user.click(logoutButton)

    // 5. Phiên đã kết thúc: chuyển thẳng về biểu mẫu đăng nhập
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByText('Trang chủ Quản lý Trại bò')).not.toBeInTheDocument()
    expect(mockClient.logout).toHaveBeenCalled()
    expect(localStorage.getItem(SELECTED_FARM_STORAGE_KEY)).toBeNull()
  })

  it('TC-AUTH-INT02: a rejected authenticated request clears the local session and opens sign-in', async () => {
    const mockClient: AuthClient = {
      isAuthenticated: vi.fn(async () => true),
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
    }
    localStorage.setItem(SELECTED_FARM_STORAGE_KEY, '42')

    render(
      <MemoryRouter initialEntries={['/ho-tro']}>
        <CurrentPath />
        <AuthProvider client={mockClient}>
          <AuthenticatedWorkspace />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Trang chủ Quản lý Trại bò')).toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('beefcare:session-expired')))

    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByText('Trang chủ Quản lý Trại bò')).not.toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/sign-in')
    expect(localStorage.getItem(SELECTED_FARM_STORAGE_KEY)).toBeNull()
  })

  it('TC-AUTH-INT03: manual sign-out still opens sign-in when the server session cannot be closed', async () => {
    const user = userEvent.setup()
    const mockClient: AuthClient = {
      isAuthenticated: vi.fn(async () => true),
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => { throw new BackendError(403, { message: 'forbidden' }) }),
    }
    localStorage.setItem(SELECTED_FARM_STORAGE_KEY, '42')

    render(
      <MemoryRouter initialEntries={['/tong-quan']}>
        <CurrentPath />
        <AuthProvider client={mockClient}>
          <AuthenticatedWorkspace />
        </AuthProvider>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Đăng xuất' }))

    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/sign-in')
    expect(localStorage.getItem(SELECTED_FARM_STORAGE_KEY)).toBeNull()
  })
})
