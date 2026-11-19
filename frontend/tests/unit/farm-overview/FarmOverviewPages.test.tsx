import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { farmOverviewApi } from '../../../src/features/farm-overview/api/farmOverviewApi'
import { farmOverviewDemoStore } from '../../../src/features/farm-overview/data/farmOverviewDemoStore'
import { announcementsDemoStore } from '../../../src/features/farm-announcements/data/announcementsDemoStore'
import FarmDashboardPage from '../../../src/features/farm-overview/pages/FarmDashboardPage'
import RemindersPage from '../../../src/features/farm-overview/pages/RemindersPage'
import ManagementReportPage from '../../../src/features/farm-overview/pages/ManagementReportPage'
import TechnicianHomePage from '../../../src/features/farm-overview/pages/TechnicianHomePage'
import TechnicianRemindersPage from '../../../src/features/farm-overview/pages/TechnicianRemindersPage'
import type { ReminderItem } from '../../../src/features/farm-overview/types'

const session = (role: Session['role'], fullName: string): Session => ({ role, fullName, email: 'a@b.vn', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => {} })
const OWNER = session('OWNER', 'Nguyễn Văn Hùng')
const MANAGER = session('MANAGER', 'Trần Quốc Long')
const TECH = session('TECHNICIAN', 'Lê Thị Mai')

const renderAt = (path: string, ui: ReactElement, who: Session = OWNER) =>
  render(<SessionContext.Provider value={who}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></SessionContext.Provider>)

beforeEach(async () => {
  await farmOverviewDemoStore.reset()
  await announcementsDemoStore.reset()
})

describe('farm dashboard', () => {
  it('shows the indicators and attention list and narrows them with the pen filter', async () => {
    const user = userEvent.setup()
    renderAt('/tong-quan', <FarmDashboardPage />)
    expect(await screen.findByRole('heading', { name: 'Trại bò Yên Bài – Ba Vì' })).toBeInTheDocument()
    expect(screen.getByText('Zebu đỏ 142 · Lai Sind 106')).toBeInTheDocument()
    expect(screen.getByText('Mũi LMLM lần 2 – quá hạn 2 ngày')).toBeInTheDocument()
    expect(screen.getByText('0,62 kg/ngày')).toBeInTheDocument()
    expect(screen.getByText('248 / 300')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mở hồ sơ BC-000024' })).toHaveAttribute('href', '/cattle/BC-000024?tab=vaccine')

    await user.click(screen.getByText('Xem bộ lọc và thống kê chi tiết'))
    await user.selectOptions(screen.getByLabelText('Chuồng'), 'D1')
    expect(await screen.findByText('40 / 40')).toBeInTheDocument()
    expect(screen.getByText('Mũi LMLM lần 2 – quá hạn 2 ngày')).toBeInTheDocument()
    expect(screen.getByText('Đạt khối lượng xuất chuồng · 452 kg')).toBeInTheDocument()
  })

  it('puts real reminders before statistics and links the overdue count to its filtered list', async () => {
    renderAt('/tong-quan', <FarmDashboardPage />)
    const heading = await screen.findByRole('heading', { name: 'Việc cần làm' })
    expect(heading).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem 2 việc quá hạn' })).toHaveAttribute('href', '/nhac-viec?muc-do=OVERDUE')
    expect(screen.getAllByRole('link', { name: 'Cập nhật hồ sơ' }).map((link) => link.getAttribute('href'))).toContain('/cattle/BC-000021?tab=vaccine')
    expect(screen.getByRole('heading', { name: 'Ghi chép nhanh' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chọn bò để ghi chép' })).toHaveAttribute('href', '/cattle')
    expect(screen.getByText('Cảnh báo tổng quan')).toBeInTheDocument()
    expect(heading.compareDocumentPosition(screen.getByText('Cảnh báo tổng quan')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('explains why ADG is missing for a 7 day period', async () => {
    const user = userEvent.setup()
    renderAt('/tong-quan', <FarmDashboardPage />)
    await user.click(await screen.findByRole('button', { name: '7 ngày' }))
    expect(await screen.findByText('Cần kỳ từ 14 ngày để tính mức tăng cân')).toBeInTheDocument()
  })

  it('shows the getting started steps for a new farm, lets the user mark one and hide the panel', async () => {
    const user = userEvent.setup()
    const reminderSpy = vi.spyOn(farmOverviewApi, 'listReminders').mockResolvedValue({ today: '2026-10-20', timeZone: 'Asia/Ho_Chi_Minh', items: [] })
    renderAt('/tong-quan?demo=new-farm', <FarmDashboardPage />)
    expect(await screen.findByText('Bắt đầu sử dụng')).toBeInTheDocument()
    expect(screen.getByText('0 con đang nuôi', { exact: false })).toBeInTheDocument()
    expect(screen.getAllByText('Đã xong')).toHaveLength(2)
    await user.click(screen.getAllByRole('button', { name: 'Đánh dấu đã xong' })[0])
    await waitFor(() => expect(screen.getAllByText('Đã xong')).toHaveLength(3))
    await user.click(screen.getByRole('button', { name: 'Ẩn hướng dẫn' }))
    expect(await screen.findByRole('heading', { name: 'Việc cần làm' })).toBeInTheDocument()
    expect(screen.getByText('Không có nhắc việc cần làm.')).toBeInTheDocument()
    reminderSpy.mockRestore()
  })

  it('does not link the pending exit voucher for a Manager', async () => {
    renderAt('/tong-quan', <FarmDashboardPage />, MANAGER)
    const warningCard = await screen.findByText('Cảnh báo tổng quan')
    const row = within(warningCard.closest('section') as HTMLElement).getByText(/BC-000061/).closest('li') as HTMLElement
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/nhac-viec')
    expect(within(row).getByRole('link')).toHaveTextContent('Mở danh sách nhắc việc')
  })

  it('opens a reminder list by type when its synthetic reminder id has no safe detail target', async () => {
    const list = await farmOverviewDemoStore.listReminders('OWNER')
    const item = { ...list.items[0], id: 'REM-10:computed:changes-each-fetch', to: null, openLabel: null, profileTo: null, type: 'health' as const }
    const spy = vi.spyOn(farmOverviewApi, 'listReminders').mockResolvedValue({ ...list, items: [item] })
    renderAt('/tong-quan', <FarmDashboardPage />)
    const action = await screen.findByRole('link', { name: 'Xem nhắc việc · Sức khỏe' })
    expect(action).toHaveAttribute('href', '/nhac-viec?loai=health')
    expect(action.getAttribute('href')).not.toContain('m=chi-tiet')
    spy.mockRestore()
  })

  it('shows an error block with retry when the figures cannot be calculated', async () => {
    const spy = vi.spyOn(farmOverviewApi, 'getDashboard').mockRejectedValueOnce(new Error('boom'))
    renderAt('/tong-quan', <FarmDashboardPage />)
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('reminders', () => {
  it('groups reminders, filters by tab and search, and opens the detail without resolving it', async () => {
    const user = userEvent.setup()
    renderAt('/nhac-viec', <RemindersPage />)
    expect(await screen.findByText('QUÁ HẠN · 2')).toBeInTheDocument()
    expect(screen.getByText('17 kết quả')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quá hạn' }))
    expect(screen.getByText('2 kết quả')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tất cả' }))

    await user.type(screen.getByRole('searchbox', { name: 'Tìm nhắc việc' }), 'BC-000142')
    await user.click(screen.getByRole('button', { name: 'Lọc' }))
    expect(await screen.findByText('1 kết quả')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Chi tiết: Khung phối gợi ý/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('REM-02 · Khung phối giống')).toBeInTheDocument()
    expect(within(dialog).getByText(/GBR-63/)).toBeInTheDocument()
  })

  it('loads a type and urgency from the dashboard deep link into both the controls and list', async () => {
    renderAt('/nhac-viec?loai=vaccination&muc-do=OVERDUE', <RemindersPage />)
    expect(await screen.findByRole('searchbox', { name: 'Tìm nhắc việc' })).toBeInTheDocument()
    expect(screen.getByLabelText('Loại nhắc việc')).toHaveValue('vaccination')
    expect(screen.getByText('1 kết quả')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chi tiết: Tiêm nhắc lại mũi 2/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chi tiết: Tái khám sau điều trị/ })).not.toBeInTheDocument()
  })

  it('keeps an unapplied search draft when switching urgency tabs', async () => {
    const user = userEvent.setup()
    renderAt('/nhac-viec', <RemindersPage />)
    const search = await screen.findByRole('searchbox', { name: 'Tìm nhắc việc' })
    await user.type(search, 'BC-000142')
    await user.click(screen.getByRole('button', { name: 'Quá hạn' }))
    expect(search).toHaveValue('BC-000142')
  })

  it('shows the missing-basis message for a reminder without a due date', async () => {
    const user = userEvent.setup()
    renderAt('/nhac-viec?m=chi-tiet&r=13', <RemindersPage />)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Chưa xác định hạn: thiếu khoảng nghỉ sau đẻ (tham số trại).')).toBeInTheDocument()
    await user.click(within(dialog).getByText('Đóng'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows projected cattle, source summary and parameter values in the detail', async () => {
    const item: ReminderItem = {
      id: 22, rule: 'REM-03 · Đến hạn khám thai', type: 'pregnancy-check', title: 'Đến hạn khám thai',
      code: 'C-1', breed: 'Lai Sind', pen: 'P1', dueAt: '2026-11-15T04:00:00Z', urgency: 'TODAY', lifecycleStatus: 'ACTIVE',
      basis: 'CONFIRMED', basisValues: { PREGNANCY_CHECK_DAYS: 28 }, parameterVersion: 4,
      source: 'Phối giống 18/10/2026 · kết quả BRED', sourceSummary: 'Phối giống 18/10/2026 · kết quả BRED',
      cattleId: 1, sex: 'FEMALE', ageMonths: 30, sourceType: 'HERD_ENTRY', sourceId: '44',
      cattleProfileTarget: { type: 'CATTLE_PROFILE', id: 1, cattleId: 1, penId: null, date: null, sessionNo: null, code: 'C-1' },
      sourceTarget: { type: 'HERD_ENTRY', id: 44, cattleId: 1, penId: null, date: null, sessionNo: null, code: null },
      profileTo: '/cattle/C-1', to: '/herd-entry/44', openLabel: 'Xem phiếu nhập',
    }
    const spy = vi.spyOn(farmOverviewApi, 'listReminders').mockResolvedValue({ today: '2026-11-15', timeZone: 'Asia/Ho_Chi_Minh', items: [item] })
    renderAt('/nhac-viec?m=chi-tiet&r=22', <RemindersPage />)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('C-1 · Lai Sind · chuồng P1')).toBeInTheDocument()
    expect(within(dialog).getByText('Cái')).toBeInTheDocument()
    expect(within(dialog).getByText('30 tháng')).toBeInTheDocument()
    expect(within(dialog).getByText('Phối giống 18/10/2026 · kết quả BRED')).toBeInTheDocument()
    expect(within(dialog).getByText(/Thời gian đến hạn khám thai: 28 ngày/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Mở hồ sơ bò' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Xem phiếu nhập' })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows an empty state when no reminder matches and an error state when loading fails', async () => {
    const user = userEvent.setup()
    renderAt('/nhac-viec', <RemindersPage />)
    await user.type(await screen.findByRole('searchbox', { name: 'Tìm nhắc việc' }), 'khong-co')
    await user.click(screen.getByRole('button', { name: 'Lọc' }))
    expect(await screen.findByText('Không có nhắc việc phù hợp')).toBeInTheDocument()
  })

  it('hides management-only reminders from a Technician', async () => {
    const user = userEvent.setup()
    renderAt('/kt/nhac-viec', <TechnicianRemindersPage />, TECH)
    expect(await screen.findByRole('button', { name: 'Quá hạn (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hôm nay (4)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sắp tới (7)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sắp tới (7)' }))
    expect(screen.queryByText(/chờ chủ trại/)).not.toBeInTheDocument()
    expect(screen.getByText(/Chỉ xem\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cân định kỳ/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('shows an error block for a Technician when loading fails', async () => {
    const spy = vi.spyOn(farmOverviewApi, 'listReminders').mockRejectedValueOnce(new Error('boom'))
    renderAt('/kt/nhac-viec', <TechnicianRemindersPage />, TECH)
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('management report', () => {
  it('opens RPT-05 with totals, switches report type and filters by pen', async () => {
    const user = userEvent.setup()
    renderAt('/bao-cao', <ManagementReportPage />)
    expect(await screen.findByText('Đậu thai lần phối đầu')).toBeInTheDocument()
    expect(screen.getByText('TTNT 33 · tự nhiên 8')).toBeInTheDocument()
    expect(screen.getByText('Thiếu dữ liệu (4 con)')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Chuồng'), 'A2')
    await user.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    await waitFor(() => expect(screen.queryByText('Thiếu dữ liệu (4 con)')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'RPT-04 Sức khỏe & điều trị' }))
    await user.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    expect(await screen.findByText('Ca mở trong kỳ')).toBeInTheDocument()
    expect(screen.getByText('Kết quả sức khỏe và điều trị')).toBeInTheDocument()
  })
})

describe('technician home', () => {
  it('greets by given name and links to announcements, reminders, scan and rations', async () => {
    renderAt('/kt', <TechnicianHomePage />, TECH)
    expect(await screen.findByRole('heading', { name: 'Chào Mai' })).toBeInTheDocument()
    expect(screen.getByText('Lịch tiêm LMLM mũi 2 cho đàn sinh sản – tuần 19–24/10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quét thẻ tai QR/ })).toBeInTheDocument()
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/kt/thong-bao', '/kt/nhac-viec', '/kt/thuc-an']))
    expect(screen.getByText('2 bữa ăn chưa ghi')).toBeInTheDocument()
    expect(screen.getByText(/^Trại bò Yên Bài – Ba Vì · /)).toBeInTheDocument()
    expect(screen.getByText('Nhắc việc hôm nay (6)')).toBeInTheDocument()
  })

  it('says so when no reminder is due and every feeding session is recorded', async () => {
    const spy = vi.spyOn(farmOverviewApi, 'getTechnicianHome').mockResolvedValue({ today: '2026-11-15', reminders: [], unrecordedFeedings: 0 })
    renderAt('/kt', <TechnicianHomePage />, TECH)
    expect(await screen.findByText('Không có bữa ăn chưa ghi.')).toBeInTheDocument()
    expect(screen.getByText('Nhắc việc hôm nay (0)')).toBeInTheDocument()
    expect(screen.getByText('Hôm nay chưa có nhắc việc.')).toBeInTheDocument()
    spy.mockRestore()
  })
})
