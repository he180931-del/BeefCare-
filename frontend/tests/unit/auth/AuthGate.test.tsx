import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, type AuthClient } from '../../../src/features/authentication'
import { AuthGate } from '../../../src/features/authorization'

const client = (overrides: Partial<AuthClient> = {}): AuthClient => ({
  isAuthenticated: vi.fn().mockResolvedValue(false),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe('AuthGate', () => {
  it('shows the login form when there is no authenticated session', async () => {
    render(<AuthProvider client={client()}><AuthGate><div>protected page</div></AuthGate></AuthProvider>)

    expect(await screen.findByRole('heading', { name: 'Đăng nhập BeefCare' })).toBeInTheDocument()
    expect(screen.queryByText('protected page')).not.toBeInTheDocument()
  })

  it('renders protected pages after a successful login', async () => {
    const api = client()
    render(<AuthProvider client={api}><AuthGate><div>protected page</div></AuthGate></AuthProvider>)
    await screen.findByRole('heading', { name: 'Đăng nhập BeefCare' })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@beefcare.local' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'BeefCare123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    await waitFor(() => expect(screen.getByText('protected page')).toBeInTheDocument())
    expect(api.login).toHaveBeenCalledWith('owner@beefcare.local', 'BeefCare123!', false)
  })

  it('shows a useful error when login fails', async () => {
    const api = client({ login: vi.fn().mockRejectedValue(new Error('Email hoặc mật khẩu không đúng.')) })
    render(<AuthProvider client={api}><AuthGate><div>protected page</div></AuthGate></AuthProvider>)
    await screen.findByRole('heading', { name: 'Đăng nhập BeefCare' })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@beefcare.local' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.')
  })
})
