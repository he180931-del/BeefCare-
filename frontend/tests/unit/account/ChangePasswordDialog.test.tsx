import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ChangePasswordDialog } from '../../../src/features/account/components/ChangePasswordDialog'
import type { AccountIdentity, AccountProfile } from '../../../src/features/account/types'

const identity: AccountIdentity = { email: 'owner@example.test', fullName: 'Nguyễn Văn An', role: 'OWNER', farmName: 'Trại An', farmId: 1 }
const profile: AccountProfile = {
  id: 1, email: identity.email, fullName: identity.fullName, phone: '', emailVerified: true,
  passwordSignInEnabled: true, googleSignInLinked: false, ownerRegistrationCompleted: true,
  status: 'ACTIVE', signInMethods: ['PASSWORD'], hasPassword: true, platformRole: null, farms: [],
}

describe('ChangePasswordDialog', () => {
  it('lets the user reveal each password field', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ChangePasswordDialog identity={identity} profile={profile} returnTo="/ho-so" onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>)

    const current = document.getElementById('cp-current') as HTMLInputElement
    expect(current.type).toBe('password')
    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu hiện tại' }))
    expect(current.type).toBe('text')
    await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu hiện tại' }))
    expect(current.type).toBe('password')
  })
})
