import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
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
  it('shows the filters before the indicators and filters metrics while keeping the whole-farm tables', async () => {
    const user = userEvent.setup()
    renderAt('/tong-quan', <FarmDashboardPage />)
    expect(await screen.findByRole('heading', { name: 'Trại bò Yên Bài – Ba Vì' })).toBeInTheDocument()
    expect(screen.getByText('Zebu đỏ 142 · Lai Sind 106')).toBeInTheDocument()
    expect(screen.getByText('Mũi LMLM lần 2 – quá hạn 2 ngày')).toBeInTheDocument()
    expect(screen.getByText('0,62 kg/ngày')).toBeInTheDocument()
    expect(screen.getByText('248 / 300')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mở hồ sơ BC-000024/ })).toHaveAttribute('href', '/cattle/BC-000024?tab=vaccine')
    const penFilter = screen.getByRole('combobox', { name: 'Chuồng' })
    const primaryMetrics = screen.getByRole('region', { name: 'Chỉ số chính' })
    const quickRecordHeading = screen.getByRole('heading', { name: 'Ghi chép nhanh' })
    const attention = within(screen.getByRole('region', { name: 'Cần chú ý hôm nay' })).getByRole('table')
    const herdStructure = within(screen.getByRole('region', { name: 'Cơ cấu đàn' })).getByRole('table')
    const secondaryMetrics = screen.getByRole('region', { name: 'Chỉ số bổ sung' })
    expect(Array.from(attention.querySelectorAll('th'), (cell) => cell.textContent)).toEqual(['Bò', 'Chuồng', 'Vấn đề', 'Trạng thái'])
    expect(penFilter.compareDocumentPosition(primaryMetrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(primaryMetrics.compareDocumentPosition(quickRecordHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(quickRecordHeading.compareDocumentPosition(attention) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(attention.compareDocumentPosition(herdStructure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(herdStructure.compareDocumentPosition(secondaryMetrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.selectOptions(penFilter, 'D1')
    expect(await screen.findByText('40 / 40')).toBeInTheDocument()
    expect(within(attention).getByText('Mũi LMLM lần 2 – quá hạn 2 ngày')).toBeInTheDocument()
    expect(within(attention).getByText('Đạt khối lượng xuất chuồng · 452 kg')).toBeInTheDocument()
    expect(Array.from(herdStructure.querySelectorAll('th'), (cell) => cell.textContent)).toEqual(['Nhóm đàn', 'Số con', 'Mang thai'])
    expect(within(herdStructure).getByRole('row', { name: /Tổng/ })).toHaveTextContent('Tổng24841')
  })

  it('keeps quick recording and the reminders link without repeating the reminders as a second list (Figma Tab 15)', async () => {
    renderAt('/tong-quan', <FarmDashboardPage />)
    expect(await screen.findByRole('heading', { name: 'Ghi chép nhanh' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Việc cần làm' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chọn bò để ghi chép' })).toHaveAttribute('href', '/cattle')
    expect(screen.getByRole('link', { name: /xem tất cả nhắc việc/i })).toHaveAttribute('href', '/nhac-viec')
  })

  it('explains why ADG is missing for a 7 day period', async () => {
    const user = userEvent.setup()
    renderAt('/tong-quan', <FarmDashboardPage />)
    await user.click(await screen.findByRole('button', { name: '7 ngày' }))
    expect(await screen.findByText('Cần kỳ từ 14 ngày để tính mức tăng cân')).toBeInTheDocument()
  })

  it('shows the getting started steps for a new farm, lets the user mark one and hide the panel', async () => {
    const user = userEvent.setup()
    renderAt('/tong-quan?demo=new-farm', <FarmDashboardPage />)
    expect(await screen.findByText('Bắt đầu sử dụng')).toBeInTheDocument()
    expect(screen.getByText('0 con đang nuôi', { exact: false })).toBeInTheDocument()
    expect(screen.getAllByText('Đã xong')).toHaveLength(2)
    await user.click(screen.getAllByRole('button', { name: 'Đánh dấu đã xong' })[0])
    await waitFor(() => expect(screen.getAllByText('Đã xong')).toHaveLength(3))
    await user.click(screen.getByRole('button', { name: 'Ẩn hướng dẫn' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Bắt đầu sử dụng' })).not.toBeInTheDocument())
    expect(screen.getByRole('region', { name: 'Cần chú ý hôm nay' })).toHaveTextContent('Không có cảnh báo cần chú ý.')
  })

  it('keeps the getting started panel visible when dismiss fails', async () => {
    const user = userEvent.setup()
    const dismiss = vi.spyOn(farmOverviewApi, 'dismissGettingStarted').mockRejectedValueOnce(new Error('dismiss failed'))

    renderAt('/tong-quan?demo=new-farm', <FarmDashboardPage />)
    expect(await screen.findByRole('heading', { name: 'Bắt đầu sử dụng' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ẩn hướng dẫn' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('dismiss failed')
    expect(screen.getByRole('heading', { name: 'Bắt đầu sử dụng' })).toBeInTheDocument()

    dismiss.mockRestore()
  })

  it.each([
    ['Owner', OWNER],
    ['Manager', MANAGER],
  ] as const)('lets an authorized %s reopen a dismissed guide and close it without dismissing progress', async (_label, who) => {
    const user = userEvent.setup()
    const dismiss = vi.spyOn(farmOverviewApi, 'dismissGettingStarted')
    const view = renderAt('/tong-quan', <FarmDashboardPage />, who)

    expect(await screen.findByRole('button', { name: 'Hướng dẫn' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Bắt đầu sử dụng' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hướng dẫn' }))
    expect(await screen.findByRole('heading', { name: 'Bắt đầu sử dụng' })).toBeInTheDocument()
    expect(screen.getAllByText('Đã xong').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('heading', { name: 'Bắt đầu sử dụng' })).not.toBeInTheDocument()
    expect(dismiss).not.toHaveBeenCalled()

    view.unmount()
    dismiss.mockRestore()
  })

  it('lets an Owner reopen a completed guide with the completion state returned by the API', async () => {
    const user = userEvent.setup()
    const base = await farmOverviewDemoStore.getGettingStarted('default', 'OWNER')
    const completed = { ...base, visible: false, dismissed: false, allDone: true, steps: base.steps.map((step) => ({ ...step, done: true })) }
    const getGettingStarted = vi.spyOn(farmOverviewApi, 'getGettingStarted').mockResolvedValue(completed)

    renderAt('/tong-quan', <FarmDashboardPage />)
    expect(await screen.findByRole('button', { name: 'Hướng dẫn' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hướng dẫn' }))
    expect(await screen.findByRole('heading', { name: 'Bắt đầu sử dụng' })).toBeInTheDocument()
    expect(screen.getAllByText('Đã xong').length).toBeGreaterThan(0)
    expect(getGettingStarted).toHaveBeenCalled()

    getGettingStarted.mockRestore()
  })

  it('resets the locally opened guide when the farm session changes', async () => {
    const user = userEvent.setup()
    const view = renderAt('/tong-quan', <FarmDashboardPage />)
    expect(await screen.findByRole('button', { name: 'Hướng dẫn' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hướng dẫn' }))
    expect(await screen.findByRole('heading', { name: 'Bắt đầu sử dụng' })).toBeInTheDocument()

    const nextFarm = { ...OWNER, farmId: 2, farmName: 'Trại khác' }
    view.rerender(<SessionContext.Provider value={nextFarm}><MemoryRouter initialEntries={['/tong-quan']}><FarmDashboardPage /></MemoryRouter></SessionContext.Provider>)
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Bắt đầu sử dụng' })).not.toBeInTheDocument())
  })

  it('does not link the pending exit voucher for a Manager', async () => {
    renderAt('/tong-quan', <FarmDashboardPage />, MANAGER)
    const warningCard = await screen.findByRole('region', { name: 'Cần chú ý hôm nay' })
    const row = within(warningCard).getByRole('row', { name: /BC-000061/ })
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/nhac-viec')
    expect(within(row).getByRole('link')).toHaveAccessibleName(/Mở danh sách nhắc việc/)
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
    await screen.findByTestId('report-print-document')
    expect(within(document.querySelector('.report-result-screen') as HTMLElement).getByText('Đậu thai lần phối đầu')).toBeInTheDocument()
    expect(within(document.querySelector('.report-result-screen') as HTMLElement).getByText('Thiếu dữ liệu (4 con)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bộ lọc thêm' }))
    await user.selectOptions(screen.getByLabelText('Chuồng'), 'A2')
    await user.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    await waitFor(() => expect(screen.queryByText('Thiếu dữ liệu (4 con)')).not.toBeInTheDocument())

    fireEvent.change(screen.getByRole('combobox', { name: 'Loại báo cáo' }), { target: { value: 'RPT-04' } })
    await user.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    await waitFor(() => expect(within(document.querySelector('.report-result-screen') as HTMLElement).getByText('Ca mở trong kỳ')).toBeInTheDocument())
    expect(within(document.querySelector('.report-result-screen') as HTMLElement).getByRole('heading', { level: 2, name: 'Sức khỏe & điều trị' })).toBeInTheDocument()
  })

  it('prints the applied report boundary and keeps draft criteria out of print metadata', async () => {
    const user = userEvent.setup()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderAt('/bao-cao', <ManagementReportPage />)
    await screen.findByTestId('report-print-document')
    expect(within(document.querySelector('.report-result-screen') as HTMLElement).getByText('Đậu thai lần phối đầu')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Loại báo cáo' }), 'RPT-04')
    await user.click(screen.getByRole('button', { name: /In \/ xuất/ }))

    expect(print).toHaveBeenCalledTimes(1)
    const printDocument = screen.getByTestId('report-print-document')
    expect(printDocument).toHaveTextContent('BEEFCARE')
    expect(printDocument).toHaveTextContent('RPT-05')
    expect(printDocument).toHaveTextContent('Trại bò Yên Bài – Ba Vì')
    expect(printDocument).toHaveTextContent('Bộ lọc hỗ trợ')
    expect(printDocument).not.toHaveTextContent('RPT-04')
    expect(printDocument.querySelectorAll('button, form')).toHaveLength(0)
    expect(printDocument.parentElement?.querySelector('.management-report-screen')).toBeInTheDocument()
    print.mockRestore()
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
