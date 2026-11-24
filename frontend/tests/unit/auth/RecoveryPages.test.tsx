import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { ResetPasswordPage } from '../../../src/features/authentication/pages/RecoveryPages'
import type { AuthClient } from '../../../src/features/authentication/types'

const TOKEN = 'reset-token-sentinel'
const EMAIL = 'owner@example.test'

function openResetPage(client: AuthClient) {
  return render(<BrowserRouter><ResetPasswordPage client={client} /></BrowserRouter>)
}

function resetLocation() {
  window.history.replaceState({}, '', `/resetpassword?token=${TOKEN}&email=${encodeURIComponent(EMAIL)}`)
}

function clientWithValidToken() {
  return {
    mode: 'backend',
    isAuthenticated: vi.fn().mockResolvedValue(false),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    validatePasswordReset: vi.fn().mockResolvedValue({ valid: true, email: EMAIL }),
    resetPassword: vi.fn().mockResolvedValue(undefined),
  } satisfies AuthClient
}

beforeEach(() => {
  resetLocation()
  localStorage.clear()
  sessionStorage.clear()
  document.cookie = ''
})

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

describe('ResetPasswordPage token secrecy contract', () => {
  it('captures the token once and replaces history without token or email', async () => {
    const client = clientWithValidToken()

    openResetPage(client)

    expect(await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeInTheDocument()
    expect(client.validatePasswordReset).toHaveBeenCalledOnce()
    expect(client.validatePasswordReset).toHaveBeenCalledWith(TOKEN)
    expect(window.location.pathname).toBe('/resetpassword')
    expect(window.location.search).toBe('')
    expect(window.location.href).not.toContain(TOKEN)
    expect(window.location.href).not.toContain(EMAIL)
    expect(localStorage.getItem('beefcare.resetToken')).toBeNull()
    expect(sessionStorage.getItem('beefcare.resetToken')).toBeNull()
    expect(document.cookie).not.toContain(TOKEN)
  })

  it('submits the captured token while preserving existing mismatch validation', async () => {
    const user = userEvent.setup()
    const client = clientWithValidToken()

    openResetPage(client)
    await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' })
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'ResetPassword-88')
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Mismatch-88')
    await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))

    expect(await screen.findByText('Mật khẩu xác nhận chưa khớp.')).toBeInTheDocument()
    expect(client.resetPassword).not.toHaveBeenCalled()

    await user.clear(screen.getByPlaceholderText('Nhập lại mật khẩu mới'))
    await user.type(screen.getByPlaceholderText('Nhập lại mật khẩu mới'), 'ResetPassword-88')
    await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))

    await waitFor(() => expect(client.resetPassword).toHaveBeenCalledWith(TOKEN, 'ResetPassword-88', 'ResetPassword-88'))
  })

  it('does not recover a reset token after reloading the scrubbed URL', async () => {
    const client = clientWithValidToken()
    const first = openResetPage(client)
    await screen.findByRole('heading', { name: 'Đặt mật khẩu mới' })
    first.unmount()

    openResetPage(client)

    await waitFor(() => expect(screen.queryByText('Liên kết đã hết hạn')).toBeInTheDocument())
    expect(client.validatePasswordReset).toHaveBeenCalledOnce()
    expect(client.validatePasswordReset).not.toHaveBeenCalledWith('')
    expect(window.location.search).toBe('')
  })
})
