import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { farmWorkspaceApi } from '../../../src/features/farm-workspace/api/farmWorkspaceApi'
import OwnerRegistrationPage from '../../../src/features/farm-workspace/pages/OwnerRegistrationPage'

describe('SCR-07 Owner registration', () => {
  it('hides the terms checkbox when the backend says registration already accepted it', async () => {
    const getProfile = vi.spyOn(farmWorkspaceApi, 'getProfile').mockResolvedValue({
      id: 7, email: 'owner@example.test', fullName: 'Nguyễn Văn An', phone: '', emailVerified: true,
      passwordSignInEnabled: true, googleSignInLinked: false, ownerRegistrationCompleted: false,
      termsAccepted: true, platformRole: null, farms: [],
    })
    const session: Session = {
      role: 'OWNER', fullName: 'Nguyễn Văn An', email: 'owner@example.test', farmId: null, farmName: null,
      ownerRegistrationCompleted: false, logout: vi.fn(async () => undefined),
    }

    render(<SessionContext.Provider value={session}><MemoryRouter><OwnerRegistrationPage /></MemoryRouter></SessionContext.Provider>)

    await waitFor(() => expect(getProfile).toHaveBeenCalled())
    // Read-only value: the whole address and its status stay visible (it wraps on phones) and nothing is editable.
    const email = await screen.findByLabelText('Thư điện tử đăng nhập')
    await waitFor(() => expect(email).toHaveTextContent('owner@example.test · đã xác minh'))
    expect(email.tagName).toBe('OUTPUT')
    expect(email).toHaveClass('wrap-anywhere')
    expect(screen.queryByRole('textbox', { name: 'Thư điện tử đăng nhập' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    getProfile.mockRestore()
  })
})
