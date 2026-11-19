import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext } from '../../../src/features/authorization/sessionContext'
import { notificationsApi } from '../../../src/features/notifications/api/notificationsApi'
import { notificationsDemoStore } from '../../../src/features/notifications/data/notificationsDemoStore'
import MyNotificationsPage from '../../../src/features/notifications/pages/MyNotificationsPage'

const session = { role: 'OWNER' as const, fullName: 'Nguyễn Văn Hùng', email: 'hung@beefcare.vn', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => {} }
const renderPage = () =>
  render(
    <SessionContext.Provider value={session}>
      <MemoryRouter initialEntries={['/thong-bao-cua-toi']}>
        <Routes>
          <Route path="/thong-bao-cua-toi" element={<MyNotificationsPage />} />
          <Route path="/ho-tro/:id" element={<div>Mở ticket</div>} />
          <Route path="/goi-dich-vu" element={<div>Mở gói dịch vụ</div>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )

beforeEach(() => {
  vi.restoreAllMocks()
  void notificationsDemoStore.reset()
})

describe('SCR-45 thông báo của tôi', () => {
  it('hiện số đếm các tab, thời gian tương đối và dấu chưa đọc', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Yêu cầu thanh toán BCF7K2Q9 đang chờ chuyển khoản')).toBeInTheDocument()
    expect(screen.getByText('Tất cả (9)')).toBeInTheDocument()
    expect(screen.getByText('Gói & thanh toán (5)')).toBeInTheDocument()
    expect(screen.getByText('5 phút trước')).toBeInTheDocument()
    expect(screen.getByText('Hôm qua 16:05')).toBeInTheDocument()
    expect(screen.getAllByText(/Chưa đọc/)).toHaveLength(2)

    await user.click(screen.getByText('Hỗ trợ (4)'))
    expect(screen.getByText('Bộ phận hỗ trợ đã trả lời ticket TK-1042')).toBeInTheDocument()
    expect(screen.queryByText('Trại Suối Hai đang bị tạm ngưng dịch vụ')).not.toBeInTheDocument()
  })

  it('đánh dấu tất cả đã đọc', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Đánh dấu đã đọc tất cả/ }))
    expect(await screen.findByText('Tất cả thông báo đã được đánh dấu là đã đọc.')).toBeInTheDocument()
    expect(screen.queryByText(/Chưa đọc/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Đánh dấu đã đọc tất cả/ })).toBeDisabled()
  })

  it('mở thông báo ticket: đánh dấu đã đọc rồi chuyển tới ticket', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Bộ phận hỗ trợ đã trả lời ticket TK-1042/ }))
    expect(await screen.findByText('Mở ticket')).toBeInTheDocument()
    expect((await notificationsApi.listMine()).filter((n) => n.readTime === null)).toHaveLength(1)
  })

  it('lỗi tải hiện nút thử lại; danh sách rỗng hiện trạng thái trống', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(notificationsApi, 'listMine').mockRejectedValueOnce(new Error('boom'))
    const first = renderPage()
    await user.click(await screen.findByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText('Tất cả (9)')).toBeInTheDocument()
    first.unmount()

    spy.mockResolvedValueOnce([])
    renderPage()
    const empty = await screen.findByText('Chưa có thông báo')
    expect(within(empty.parentElement!).getByText(/Thông báo về gói/)).toBeInTheDocument()
  })
})
