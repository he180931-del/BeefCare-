import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, type AuthClient } from '../../../src/features/authentication'
import { rememberInvitationLink, takeInvitationLink } from '../../../src/features/authentication/invitationReturn'

const KEY = 'beefcare.pendingInvitation'
const LINK = '/invitation/accept?token=abc'

beforeEach(() => localStorage.clear())

describe('invitation link across sign-in (UC-FE01-02 AF2, UC-FE03-04 AF3, D28)', () => {
  it('keeps only an internal invitation link and hands it back once', () => {
    rememberInvitationLink('/chon-trai')
    rememberInvitationLink('/invitation/accept')
    rememberInvitationLink('//evil.example/invitation/accept?token=x')
    expect(localStorage.getItem(KEY)).toBeNull()
    rememberInvitationLink(LINK, 1_000)
    expect(takeInvitationLink('/chon-trai', 2_000)).toBe(LINK)
    expect(takeInvitationLink('/chon-trai', 3_000)).toBeNull()
  })

  it('forgets a stale link and does not redirect to the page already open', () => {
    rememberInvitationLink(LINK, 0)
    expect(takeInvitationLink('/owner-registration', 24 * 60 * 60 * 1000 + 1)).toBeNull()
    rememberInvitationLink(LINK, 0)
    expect(takeInvitationLink(LINK, 10)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('remembers the link while signed out and reopens it after a sign-in that returns elsewhere', async () => {
    const signedOut: AuthClient = { isAuthenticated: vi.fn().mockResolvedValue(false), login: vi.fn(), logout: vi.fn() }
    const guest = render(<MemoryRouter initialEntries={[LINK]}><AuthProvider client={signedOut}><p>app</p></AuthProvider></MemoryRouter>)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').path).toBe(LINK))
    guest.unmount()

    // Google sign-in or e-mail verification lands on another page in a new app load
    const Where = () => <p>at {useLocation().pathname + useLocation().search}</p>
    const signedIn: AuthClient = { isAuthenticated: vi.fn().mockResolvedValue(true), login: vi.fn(), logout: vi.fn() }
    render(<MemoryRouter initialEntries={['/owner-registration']}><AuthProvider client={signedIn}><Routes><Route path="*" element={<Where />} /></Routes></AuthProvider></MemoryRouter>)
    expect(await screen.findByText(`at ${LINK}`)).toBeInTheDocument()
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
