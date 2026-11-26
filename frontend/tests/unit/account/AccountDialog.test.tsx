import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AccountMenu } from '../../../src/features/account'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { AccountDialogProvider } from '../../../src/features/account/components/AccountDialogContext'

const session: Session = {
  role: 'OWNER',
  fullName: 'Kiều Đức Lâm',
  email: 'lam@example.test',
  farmId: null,
  farmName: null,
  logout: vi.fn(),
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderAccountMenu({ currentSession = session, path = '/chon-trai' }: { currentSession?: Session | null; path?: string } = {}) {
  return render(
    <SessionContext.Provider value={currentSession}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AccountDialogProvider>
          <AccountMenu fallbackName="Người dùng" fallbackInitials="ND" />
          <LocationProbe />
        </AccountDialogProvider>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

async function openAccountDialog() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Kiều Đức Lâm/ }))
  await user.click(screen.getByRole('menuitem', { name: 'Hồ sơ của tôi' }))
  return user
}

describe('shared account dialog', () => {
  it('opens over the current page without changing its URL', async () => {
    renderAccountMenu({ path: '/chon-trai?from=dashboard' })
    await openAccountDialog()

    expect(await screen.findByRole('dialog', { name: 'Cài đặt' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/chon-trai?from=dashboard')
    expect(screen.getByRole('heading', { name: 'Hồ sơ của tôi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đóng cài đặt' })).toHaveFocus()
  })

  it('closes with the close button, backdrop and Escape', async () => {
    const user = await openAccountDialogAfterRender()
    await user.click(screen.getByRole('button', { name: 'Đóng cài đặt' }))
    expect(screen.queryByRole('dialog', { name: 'Cài đặt' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Kiều Đức Lâm/ })).toHaveFocus())

    await openAccountDialog()
    await user.click(screen.getByTestId('account-dialog-backdrop'))
    expect(screen.queryByRole('dialog', { name: 'Cài đặt' })).not.toBeInTheDocument()

    await openAccountDialog()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Cài đặt' })).not.toBeInTheDocument()
  })

  it('does not render account content without an authenticated session', async () => {
    const user = userEvent.setup()
    renderAccountMenu({ currentSession: null })
    await user.click(screen.getByRole('button', { name: 'Người dùng' }))
    await user.click(screen.getByRole('menuitem', { name: 'Hồ sơ của tôi' }))
    expect(screen.queryByRole('dialog', { name: 'Cài đặt' })).not.toBeInTheDocument()
  })
})

async function openAccountDialogAfterRender() {
  renderAccountMenu()
  return openAccountDialog()
}
