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
    expect(navigation.closest('aside')).toHaveClass('bg-[#2a765b]', 'md:h-full')
    expect(screen.getByRole('button', { name: 'Hồ sơ' })).toHaveClass('text-white')
    expect(screen.getByRole('button', { name: 'Quyền theo vai trò' })).toHaveClass('bg-[#3b8b6d]', 'text-white')
    expect(screen.getByRole('button', { name: 'Quyền theo vai trò' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('account-dialog-content')).toHaveClass('@container', 'md:min-h-0', 'md:overflow-y-auto', 'md:h-full')
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

    expect(screen.queryByRole('heading', { name: 'Hồ sơ cá nhân' })).not.toBeInTheDocument()
    expect(screen.getByTestId('profile-bento-grid')).toHaveClass('grid', 'gap-4', '@min-[560px]:grid-cols-[1.2fr_0.9fr]')
    expect(screen.getByTestId('profile-bento-identity')).toHaveClass('rounded-2xl', 'bg-[#edf5f0]', 'text-ink')
    expect(container.querySelector('#profile-form > div')).toHaveClass('flex', 'flex-col', 'gap-4')
    expect(screen.getByRole('button', { name: 'Đổi mật khẩu' })).toBeInTheDocument()
  })

  it('organizes profile data into Bento identity, personal, and security tiles', () => {
    render(
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

    expect(screen.getByTestId('profile-bento-identity')).toBeInTheDocument()
    expect(screen.getByTestId('profile-bento-personal')).toContainElement(screen.getByLabelText('Họ và tên *'))
    expect(screen.getByTestId('profile-bento-personal')).toContainElement(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(screen.getByTestId('profile-bento-status')).toContainElement(screen.getByText('Email đã xác minh'))
    expect(screen.getByTestId('profile-bento-security')).toContainElement(screen.getByText(/Email - mật khẩu/))
  })
})
