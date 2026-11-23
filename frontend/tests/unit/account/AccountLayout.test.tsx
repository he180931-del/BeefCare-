import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AccountDialog } from '../../../src/features/account/components/AccountDialog'
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AccountDialog active="permissions" onTabChange={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Tài khoản' })
    expect(screen.getByRole('heading', { name: 'Cài đặt' })).toHaveClass('text-xl', 'font-bold', 'text-brand-dark')
    expect(screen.getByRole('dialog', { name: 'Cài đặt' })).toHaveClass('max-w-[940px]', 'h-[min(640px,calc(100vh-1.5rem))]', 'overflow-hidden', 'flex-col')
    expect(screen.getByTestId('account-dialog-header')).toHaveClass('border-b', 'bg-white')
    expect(screen.getByTestId('account-dialog-body')).toHaveClass('md:grid', 'md:grid-cols-[220px_minmax(0,1fr)]')
    expect(navigation).toHaveClass('flex', 'overflow-x-auto', 'md:h-full', 'md:flex-col', 'md:overflow-visible')
    expect(navigation.closest('aside')).toHaveClass('bg-[#176448]', 'md:h-full')
    expect(screen.getByRole('button', { name: 'Hồ sơ' })).toHaveClass('text-white')
    expect(screen.getByRole('button', { name: 'Quyền theo vai trò' })).toHaveClass('bg-[#28785c]', 'text-white')
    expect(screen.getByRole('button', { name: 'Quyền theo vai trò' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('account-dialog-content')).toHaveClass('md:min-h-0', 'md:overflow-y-auto', 'md:h-full')
    expect(screen.getByTestId('account-dialog-content')).not.toHaveClass('overflow-y-auto')
    expect(container.querySelector('[data-testid="account-dialog-backdrop"]')).toHaveClass('fixed', 'inset-0')
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
