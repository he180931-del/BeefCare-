import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SessionContext } from '../../../src/app/session/sessionContext'
import { AccountShell } from '../../../src/features/account/components/AccountShell'
import { ProfileCard } from '../../../src/features/account/components/ProfileParts'
import type { AccountProfile } from '../../../src/features/account/types'

const profile: AccountProfile = {
  id: 1,
  email: 'lam@example.test',
  fullName: 'Kiều Đức Lâm',
  phone: '0909090909',
  emailVerified: true,
  passwordSignInEnabled: true,
  googleSignInLinked: true,
  ownerRegistrationCompleted: true,
  status: 'ACTIVE',
  signInMethods: ['PASSWORD', 'GOOGLE'],
  hasPassword: true,
  platformRole: null,
  farms: [],
}

describe('shared account layout', () => {
  it('uses horizontal account navigation on narrow screens and a 220px sidebar on desktop', () => {
    const { container } = render(
      <SessionContext.Provider value={{ role: 'OWNER', fullName: 'Kiều Đức Lâm', email: 'lam@example.test', farmId: null, farmName: null, logout: vi.fn() }}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AccountShell active="profile"><p>Nội dung tài khoản</p></AccountShell>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Tài khoản' })
    expect(screen.getByRole('heading', { name: 'Tài khoản & phân quyền' })).toHaveClass('text-base', 'font-bold', 'text-white')
    expect(screen.getByRole('link', { name: 'Về trại' })).toHaveClass('text-sm', 'font-bold')
    expect(navigation).toHaveClass('flex', 'bg-side', 'md:h-full', 'md:w-[220px]', 'md:flex-col', 'md:px-3', 'md:pb-3', 'md:pt-2')
    expect(navigation.closest('aside')).toHaveClass('md:h-full', 'md:py-12')
    expect(navigation.closest('aside')).not.toHaveClass('md:sticky')
    expect(screen.getByRole('link', { name: 'Hồ sơ' })).toHaveClass('bg-side-active', 'text-white')
    expect(screen.getByRole('link', { name: 'Hồ sơ' })).toHaveAttribute('aria-current', 'page')

    const main = container.querySelector('main')
    const layout = container.querySelector('main > div')
    expect(main).toHaveClass('md:h-[calc(100vh-73px)]', 'md:overflow-hidden', 'md:py-0')
    expect(layout).toHaveClass('md:grid', 'md:h-full', 'md:grid-cols-[220px_minmax(0,1fr)]', 'md:items-stretch', 'md:gap-8')
    expect(layout?.children[1]).toHaveClass('md:h-full', 'md:overflow-y-auto', 'md:py-12')
  })

  it('lets the profile card fill the content column and spaces its major sections', () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfileCard
          profile={profile}
          headline="Tài khoản BeefCare"
          values={{ fullName: profile.fullName, phone: profile.phone }}
          onChange={vi.fn()}
          errors={{}}
          onSubmit={vi.fn()}
          onPassword={vi.fn()}
        />
      </MemoryRouter>,
    )

    const card = screen.getByRole('heading', { name: 'Hồ sơ cá nhân' }).closest('section')
    expect(card?.parentElement).toHaveClass('w-full', 'max-w-none')
    expect(screen.getByText(profile.fullName).parentElement?.parentElement).toHaveClass('gap-4', 'pb-2')
    expect(container.querySelector('#profile-form')).toHaveClass('gap-6')
    expect(container.querySelector('#profile-form > div')).toHaveClass('gap-x-6', 'gap-y-5')
    expect(screen.getByRole('button', { name: 'Đổi mật khẩu' }).parentElement).toHaveClass('pt-2')
  })
})
