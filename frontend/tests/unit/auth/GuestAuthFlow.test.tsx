import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, type AuthClient } from '../../../src/features/authentication'
import { AuthGate } from '../../../src/features/authorization'
import { createMockAuthClient } from '../../../src/features/authentication/client'

function renderAuth(client: AuthClient, path: string) {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider client={client}><AuthGate><div>Private content</div></AuthGate></AuthProvider></MemoryRouter>)
}

describe('guest authentication pages', () => {
  it('opens the password reset form from the public reset-password email route', async () => {
    const client: AuthClient = {
      mode: 'backend',
      isAuthenticated: vi.fn().mockResolvedValue(false),
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      validatePasswordReset: vi.fn().mockResolvedValue({ valid: true, email: 'owner@beefcare.vn' }),
    }

    renderAuth(client, '/reset-password?token=email-token')

    expect(await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('owner@beefcare.vn')).toBeInTheDocument()
  })

  it('navigates from registration to verification and keeps the mock session in memory', async () => {
    const user = userEvent.setup()
    const mock = createMockAuthClient()
    renderAuth(mock, '/dang-ky')

    await screen.findByRole('heading', { name: 'Tạo tài khoản chủ trại' })
    await user.type(screen.getByLabelText('Họ và tên'), 'Nguyen Van An')
    await user.type(screen.getByLabelText('Email'), ' OWNER@BEEFCARE.VN ')
    await user.type(screen.getByLabelText('Mật khẩu'), 'BeefCare123!')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'BeefCare123!')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await screen.findByRole('heading', { name: 'Xác minh email' })).toBeInTheDocument()
    expect(screen.getByText('owner@beefcare.vn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /thử lại sau (?:59|60)s/ })).toBeDisabled()
    expect(await mock.isAuthenticated()).toBe(false)

    await user.click(screen.getByRole('link', { name: 'Quay lại đăng nhập' }))
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    await user.type(screen.getByLabelText('Email'), 'owner@beefcare.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'BeefCare123!')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await waitFor(() => expect(screen.getByText('Private content')).toBeInTheDocument())
    expect(await mock.isAuthenticated()).toBe(true)
    expect(localStorage.length).toBe(0)
  })

  it('does not fall back to a mock session when backend sign-in fails', async () => {
    const user = userEvent.setup()
    const client: AuthClient = {
      mode: 'backend',
      isAuthenticated: vi.fn().mockResolvedValue(false),
      login: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
      logout: vi.fn().mockResolvedValue(undefined),
    }
    renderAuth(client, '/sign-in')

    await screen.findByRole('heading', { name: 'Đăng nhập' })
    await user.type(screen.getByLabelText('Email'), 'owner@beefcare.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'BeefCare123!')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối máy chủ')
    expect(client.login).toHaveBeenCalledOnce()
    expect(await client.isAuthenticated()).toBe(false)
    expect(screen.queryByText('Private content')).not.toBeInTheDocument()
    expect(screen.queryByText(/Chế độ mô phỏng/)).not.toBeInTheDocument()
  })

  it('explains a rejected Google sign-in from the OAuth callback', async () => {
    const client: AuthClient = {
      mode: 'backend',
      isAuthenticated: vi.fn().mockResolvedValue(false),
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
    }

    renderAuth(client, '/sign-in?error=google-sign-in')

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể đăng nhập với Google')
  })

  it('opens the suspended-account state for the backend suspension code', async () => {
    const user = userEvent.setup()
    const client: AuthClient = {
      mode: 'backend',
      isAuthenticated: vi.fn().mockResolvedValue(false),
      login: vi.fn().mockRejectedValue({ code: 'MSG-FE01-03', status: 403 }),
      logout: vi.fn().mockResolvedValue(undefined),
    }
    renderAuth(client, '/sign-in')
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    await user.type(screen.getByLabelText('Email'), 'owner@beefcare.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'BeefCare123!')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('heading', { name: 'Tài khoản đang tạm ngưng' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'tuanpqhe181869@fpt.edu.vn' })).toHaveAttribute('href', 'mailto:tuanpqhe181869@fpt.edu.vn')
  })

  it('keeps unverified-email errors distinct from incorrect credentials', async () => {
    const user = userEvent.setup()
    const client: AuthClient = {
      mode: 'backend',
      isAuthenticated: vi.fn().mockResolvedValue(false),
      login: vi.fn().mockRejectedValue({ code: 'MSG-FE01-11', status: 401 }),
      logout: vi.fn().mockResolvedValue(undefined),
      resendVerification: vi.fn().mockResolvedValue(undefined),
    }
    renderAuth(client, '/sign-in')
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    await user.type(screen.getByLabelText('Email'), 'owner@beefcare.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'BeefCare123!')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email chưa được xác minh')
    expect(screen.getByRole('alert')).not.toHaveTextContent('Email hoặc mật khẩu chưa chính xác')
    await user.click(screen.getByRole('link', { name: 'Gửi lại email xác minh' }))
    expect(await screen.findByRole('heading', { name: 'Xác minh email' })).toBeInTheDocument()
    expect(screen.getByText('owner@beefcare.vn')).toBeInTheDocument()
  })

  it('uses the verification resend time returned by the server', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const client: AuthClient = {
      mode: 'backend',
      isAuthenticated: vi.fn().mockResolvedValue(false),
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      resendVerification: vi.fn().mockResolvedValue({ nextAllowedAt: '2026-11-08T12:02:00Z' }),
    }
    renderAuth(client, '/xac-minh-email?email=owner%40beefcare.vn')

    await user.click(await screen.findByRole('button', { name: 'Gửi lại email xác minh' }))

    expect(await screen.findByRole('button', { name: /thử lại sau 1(?:19|20)s/ })).toBeDisabled()
    vi.useRealTimers()
  })
})
