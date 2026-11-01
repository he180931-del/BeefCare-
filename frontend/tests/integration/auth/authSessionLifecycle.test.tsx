import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth, type AuthClient } from '../../../src/features/authentication/AuthContext'

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

describe('Auth Session Lifecycle Integration Tests (FE-01 & FE-02)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('TC-AUTH-INT01: End-to-end session lifecycle: login -> authenticated workspace -> logout -> login form', async () => {
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

    render(
      <MemoryRouter>
        <AuthProvider client={mockClient}>
          <AuthenticatedWorkspace />
        </AuthProvider>
      </MemoryRouter>
    )

    // 1. Kiểm tra màn hình đăng nhập ban đầu
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mật khẩu/i)).toBeInTheDocument()
    expect(screen.queryByText('Trang chủ Quản lý Trại bò')).not.toBeInTheDocument()

    // 2. Nhập thông tin tài khoản và đăng nhập
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/mật khẩu/i)
    const submitButton = screen.getByRole('button', { name: /đăng nhập/i })

    await user.type(emailInput, 'manager@beefcare.local')
    await user.type(passwordInput, 'beefcare-dev-password')
    await user.click(submitButton)

    // 3. Chuyển sang màn hình trang chủ quản lý trại bò đã đăng nhập
    expect(await screen.findByText('Trang chủ Quản lý Trại bò')).toBeInTheDocument()
    expect(screen.getByTestId('auth-status')).toHaveTextContent('ĐÃ ĐĂNG NHẬP')
    expect(mockClient.login).toHaveBeenCalledWith('manager@beefcare.local', 'beefcare-dev-password', false)

    // 4. Thực hiện đăng xuất
    const logoutButton = screen.getByRole('button', { name: /đăng xuất/i })
    await user.click(logoutButton)

    // 5. Quay trở lại màn hình đăng nhập, phiên đã kết thúc
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByText('Trang chủ Quản lý Trại bò')).not.toBeInTheDocument()
    expect(mockClient.logout).toHaveBeenCalled()
  })
})
