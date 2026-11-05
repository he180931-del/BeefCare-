import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { NotificationScreen } from '../../../src/features/notifications/pages/NotificationScreens'

describe('NotificationScreen large local tables', () => {
  beforeEach(() => window.localStorage.clear())

  it.each([
    ['SCR-73', 'owner' as const],
    ['SCR-76', 'pm' as const],
  ])('expands %s to a screen-specific 100-row preview with numbered pagination', (screenId, role) => {
    render(
      <MemoryRouter>
        <NotificationScreen screen={screenById(screenId as `SCR-${string}`)!} role={role} state="success" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '100 thông báo' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Phân trang bảng' })).toHaveTextContent('/ 100 dòng')
    expect(screen.getByRole('button', { name: 'Trang 1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Trang 2' })).toBeEnabled()
  })
})
