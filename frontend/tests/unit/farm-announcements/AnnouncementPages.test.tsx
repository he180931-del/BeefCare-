import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { announcementsApi } from '../../../src/features/farm-announcements/api/announcementsApi'
import { announcementsDemoStore } from '../../../src/features/farm-announcements/data/announcementsDemoStore'
import AnnouncementRoutes from '../../../src/features/farm-announcements/pages/AnnouncementRoutes'
import TechnicianAnnouncementRoutes from '../../../src/features/farm-announcements/pages/TechnicianAnnouncementRoutes'

const session = (role: Session['role'], fullName: string): Session => ({ role, fullName, email: 'a@b.vn', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => {} })
const OWNER = session('OWNER', 'Nguyễn Văn Hùng')
const MANAGER = session('MANAGER', 'Trần Quốc Long')
const TECH = session('TECHNICIAN', 'Lê Thị Mai')

const renderDesk = (path: string, who: Session = MANAGER) =>
  render(
    <SessionContext.Provider value={who}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path="/thong-bao/*" element={<AnnouncementRoutes />} /></Routes></MemoryRouter>
    </SessionContext.Provider>,
  )
const renderTech = (path: string) =>
  render(
    <SessionContext.Provider value={TECH}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path="/kt/thong-bao/*" element={<TechnicianAnnouncementRoutes />} /></Routes></MemoryRouter>
    </SessionContext.Provider>,
  )

beforeEach(async () => { await announcementsDemoStore.reset() })

describe('announcement list and detail', () => {
  it('shows the author their announcements with delivery status, correction and history', async () => {
    const user = userEvent.setup()
    renderDesk('/thong-bao')
    expect(await screen.findByRole('button', { name: 'Tôi đã viết (4)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đã nhận (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bản nháp (1)' })).toBeInTheDocument()
    expect(await screen.findByText('Tình trạng nhận')).toBeInTheDocument()
    expect(screen.getAllByText('Đã gửi')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Đính chính/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Lịch sử phiên bản/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('v1')).toBeInTheDocument()
  })

  it('hides correction and delivery status on a received announcement and hides drafts from others', async () => {
    const user = userEvent.setup()
    renderDesk('/thong-bao')
    await user.click(await screen.findByRole('button', { name: 'Đã nhận (2)' }))
    expect(await screen.findAllByText('Chuẩn bị chuồng đẻ D cho 3 bò sắp đẻ')).toHaveLength(2)
    expect(screen.queryByText('Tình trạng nhận')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đính chính/ })).not.toBeInTheDocument()
  })

  it('keeps drafts private: the Owner sees no draft tab content from the Manager', async () => {
    renderDesk('/thong-bao', OWNER)
    expect(await screen.findByRole('button', { name: 'Bản nháp (0)' })).toBeInTheDocument()
    expect(screen.queryByText('Lịch cân định kỳ tháng 11')).not.toBeInTheDocument()
  })

  it('shows an error block with retry when the list cannot load', async () => {
    const spy = vi.spyOn(announcementsApi, 'list').mockRejectedValueOnce(new Error('boom'))
    renderDesk('/thong-bao')
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('editor, review and publish', () => {
  it('validates the title, saves a draft, reviews and publishes to the technicians', async () => {
    const user = userEvent.setup()
    renderDesk('/thong-bao/moi')
    expect(await screen.findByRole('checkbox', { name: /Tất cả Quản lý/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByText('Tiêu đề là bắt buộc.')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /Tiêu đề/ }), 'Họp giao ban thứ Hai')
    await user.click(screen.getByRole('checkbox', { name: /Tất cả Kỹ thuật viên/ }))
    expect(screen.getByText('Người nhận đã xác định (3)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByText('Đã lưu bản nháp thông báo.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Xem lại/ }))
    expect(await screen.findByText('Nội dung là bắt buộc.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Nội dung/ }), 'Họp lúc 7 giờ sáng.')
    await user.click(screen.getByRole('button', { name: /Xem lại/ }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('3 người · Lê Thị Mai, Phạm Văn Tú, Đinh Văn Sơn')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Đăng thông báo/ }))

    expect(await screen.findByText('Đã đăng thông báo tới 3 người nhận.')).toBeInTheDocument()
    expect((await announcementsApi.list({ name: 'Lê Thị Mai', role: 'TECHNICIAN' })).some((a) => a.title === 'Họp giao ban thứ Hai' && a.unread)).toBe(true)
  })

  it('keeps the draft and shows the message when no eligible recipient is chosen', async () => {
    const user = userEvent.setup()
    renderDesk('/thong-bao/moi')
    await user.type(await screen.findByRole('textbox', { name: /Tiêu đề/ }), 'Không có người nhận')
    await user.type(screen.getByRole('textbox', { name: /Nội dung/ }), 'Nội dung')
    await user.click(screen.getByRole('button', { name: /Xem lại/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByRole('button', { name: /Đăng thông báo/ }))
    expect(await within(dialog).findByText(/Không có người nhận hợp lệ/)).toBeInTheDocument()
    const drafts = (await announcementsApi.list({ name: 'Trần Quốc Long', role: 'MANAGER' })).filter((a) => a.state === 'DRAFT')
    expect(drafts).toHaveLength(2)
  })

  it('refuses a Technician in the editor', async () => {
    renderDesk('/thong-bao/moi', TECH)
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeInTheDocument()
  })
})

describe('correction', () => {
  it('requires a reason, then publishes the next version and returns to the list', async () => {
    const user = userEvent.setup()
    renderDesk('/thong-bao/1/dinh-chinh')
    const publish = await screen.findByRole('button', { name: /Đăng phiên bản 2/ })
    await user.click(publish)
    expect(await screen.findByText('Lý do đính chính là bắt buộc.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Lý do đính chính/ }), 'Đổi ngày tiêm sang thứ Ba')
    await user.click(publish)
    expect(await screen.findByText('Đã đăng phiên bản 2 của thông báo.')).toBeInTheDocument()
    await waitFor(async () => expect((await announcementsApi.get(1, { name: 'Trần Quốc Long', role: 'MANAGER' })).version).toBe(2))
  })

  it('only lets the author correct (the Owner has no override)', async () => {
    renderDesk('/thong-bao/1/dinh-chinh', OWNER)
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đăng phiên bản/ })).not.toBeInTheDocument()
  })
})

describe('technician announcements', () => {
  it('lists unread first, marks an announcement read when opened and offers no correction', async () => {
    const user = userEvent.setup()
    renderTech('/kt/thong-bao')
    expect(await screen.findByRole('button', { name: 'Chưa đọc (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tất cả (6)' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Lịch tiêm LMLM mũi 2/ }))
    expect(await screen.findByText(/Đã đánh dấu đã đọc lúc \d\d:\d\d\./)).toBeInTheDocument()
    expect(screen.getByText(/Kỹ thuật viên chỉ xem, không đính chính/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đính chính/ })).not.toBeInTheDocument()
    expect((await announcementsApi.listUnread({ name: 'Lê Thị Mai', role: 'TECHNICIAN' }))).toHaveLength(0)
  })
})
