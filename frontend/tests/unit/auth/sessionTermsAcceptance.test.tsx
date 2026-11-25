import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthProvider } from '../../../src/features/authentication'
import type { AuthClient } from '../../../src/features/authentication/types'
import { SessionProvider } from '../../../src/app/session/SessionProvider'

const transport = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn() }))
vi.mock('../../../src/shared/api/backendTransport', () => ({
  backendTransport: { ...transport, farmPath: vi.fn() },
}))

const client: AuthClient = {
  mode: 'backend',
  isAuthenticated: vi.fn().mockResolvedValue(true),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
}

const profile = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  fullName: 'Nguyễn Văn An',
  email: 'an@example.test',
  ownerRegistrationCompleted: false,
  googleSignInLinked: true,
  termsAccepted: false,
  platformRole: null,
  farms: [],
  ...overrides,
})

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="route">{location.pathname}</output>
}

function renderSession() {
  return render(<MemoryRouter><AuthProvider client={client}><SessionProvider><LocationProbe /><div>Nội dung ứng dụng</div></SessionProvider></AuthProvider></MemoryRouter>)
}

describe('Google terms acceptance session gate', () => {
  beforeEach(() => {
    sessionStorage.clear()
    transport.get.mockReset()
    transport.command.mockReset()
    vi.mocked(client.isAuthenticated).mockResolvedValue(true)
    vi.mocked(client.logout).mockResolvedValue(undefined)
  })

  it('keeps an unconsented Google account outside the application until acceptance succeeds', async () => {
    const user = userEvent.setup()
    transport.get.mockResolvedValueOnce(profile()).mockResolvedValueOnce(profile({ termsAccepted: true }))
    transport.command.mockResolvedValue({ termsAccepted: true, termsAcceptedAt: '2026-11-23T08:00:00Z' })
    renderSession()

    expect(await screen.findByRole('heading', { name: 'Điều khoản và chính sách' })).toBeInTheDocument()
    expect(screen.queryByText('Nội dung ứng dụng')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đồng ý và xác nhận' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Điều khoản sử dụng' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Đồng ý và xác nhận' }))

    await waitFor(() => expect(transport.command).toHaveBeenCalledWith('/api/account/terms-acceptance', { accepted: true }, { method: 'POST' }))
    expect(await screen.findByText('Nội dung ứng dụng')).toBeInTheDocument()
    expect(screen.getByLabelText('route')).toHaveTextContent('/owner-registration')
  })

  it.each([
    ['an email account', { googleSignInLinked: false, termsAccepted: false }],
    ['an already-consented Google account', { googleSignInLinked: true, termsAccepted: true }],
  ])('does not gate %s', async (_label, state) => {
    transport.get.mockResolvedValue(profile(state))
    renderSession()
    expect(await screen.findByText('Nội dung ứng dụng')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Điều khoản và chính sách' })).not.toBeInTheDocument()
  })
})
