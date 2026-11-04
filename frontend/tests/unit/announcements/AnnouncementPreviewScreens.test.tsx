import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AnnouncementPreviewScreen } from '../../../src/features/farm-announcements/pages/AnnouncementPreviewScreens'
import { screenById } from '../../../src/app/screenManifest'

function seedNotice(notice: Record<string, unknown>) {
  localStorage.setItem('beefcare-ui-demo', JSON.stringify({ account: { notices: [notice], 'selected-notice': { id: notice.id } } }))
}

describe('announcement screens', () => {
  it('shows role-group and active-member recipient selectors while composing', () => {
    render(<MemoryRouter><AnnouncementPreviewScreen screen={screenById('SCR-39')!} role="owner" state="success" /></MemoryRouter>)
    expect(screen.getByRole('checkbox', { name: 'Quản lý' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Kỹ thuật viên' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Trần Quốc Long/ })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Lê Minh An/ })).not.toBeInTheDocument()
  })

  it('blocks publishing a draft when the current demo user is not its author', () => {
    seedNotice({ id: 'TB-DRAFT', title: 'Bản nháp', body: 'Nội dung', audience: 'Kỹ thuật viên', recipients: ['Trần Quốc Long'], status: 'DRAFT', version: 1, date: '03/11/2026', history: [], delivery: 'Chưa phát hành', author: 'manager' })
    render(<MemoryRouter><AnnouncementPreviewScreen screen={screenById('SCR-40')!} role="owner" state="success" /></MemoryRouter>)
    expect(screen.getByText(/chỉ tác giả/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Phát hành' })).toBeDisabled()
  })

  it('hydrates editable title and body for a correction and requires a reason', () => {
    seedNotice({ id: 'TB-PUBLISHED', title: 'Tiêu đề cũ', body: 'Nội dung cũ', audience: 'Toàn trại', recipients: ['Trần Quốc Long'], status: 'PUBLISHED', version: 1, date: '02/11/2026', history: [], delivery: '1 đã đọc', author: 'owner' })
    render(<MemoryRouter><AnnouncementPreviewScreen screen={screenById('SCR-41')!} role="owner" state="success" /></MemoryRouter>)
    expect(screen.getByDisplayValue('Tiêu đề cũ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nội dung cũ')).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(3)
  })
})
