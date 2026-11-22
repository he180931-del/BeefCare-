import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { growthDemoStore } from '../../../src/features/growth/data/growthDemoStore'
import { growthApi } from '../../../src/features/growth/api/growthApi'
import GrowthRoutes from '../../../src/features/growth/pages/GrowthRoutes'
import { GrowthProfileTab, GrowthTechnicianTab } from '../../../src/features/growth'

const session = (role: Session['role']): Session => ({ role, fullName: 'Trần Quốc Long', email: 'x@y.vn', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => {} })
const renderAs = (role: Session['role'] | null, ui: React.ReactNode, path = '/') =>
  render(
    <SessionContext.Provider value={role ? session(role) : null}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </SessionContext.Provider>,
  )

beforeEach(async () => {
  await growthDemoStore.reset()
})

describe('danh sách đàn /can-nang', () => {
  it('hiện chỉ số, lọc theo tìm kiếm và báo rỗng khi không khớp', async () => {
    const user = userEvent.setup()
    renderAs('OWNER', <GrowthRoutes />, '/')
    expect(await screen.findByText('BC-000188')).toBeInTheDocument()
    expect(screen.getByText('chu kỳ cân 30 ngày')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Tìm mã hiển thị, số tai'), 'Hoa')
    expect(await screen.findByText('BC-000125 “Hoa Đỏ”')).toBeInTheDocument()
    expect(screen.queryByText('BC-000188')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Tìm mã hiển thị, số tai'))
    await user.type(screen.getByLabelText('Tìm mã hiển thị, số tai'), 'zzz')
    expect(await screen.findByText('Không có bò phù hợp')).toBeInTheDocument()
  })

  it('báo lỗi tải và cho thử lại', async () => {
    const spy = vi.spyOn(growthApi, 'listHerd').mockRejectedValueOnce(new Error('boom'))
    renderAs('OWNER', <GrowthRoutes />, '/')
    await userEvent.click(await screen.findByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText('BC-000188')).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('tab Tăng trưởng & BCS của hồ sơ bò', () => {
  it('ưu tiên dự kiến xuất bán và tiến độ vỗ béo, sau đó là biểu đồ và lịch sử đo (Figma Tab 17)', async () => {
    renderAs('OWNER', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth')
    const projection = await screen.findByRole('region', { name: 'Dự kiến xuất bán' })
    const progress = screen.getByRole('region', { name: 'Tiến độ vỗ béo' })
    const nextSteps = screen.getByRole('region', { name: 'Tăng cân và lần cân tới' })
    const trend = screen.getByRole('region', { name: 'Cân nặng theo thời gian' })
    const history = screen.getByRole('region', { name: 'Lịch sử đo' })

    expect(within(projection).getByText('Ước tính')).toBeInTheDocument()
    expect(within(projection).getByText('Đủ 380 kg vào khoảng')).toBeInTheDocument()
    expect(within(projection).getByText('04/03/2027')).toBeInTheDocument()
    expect(within(projection).getByText('145 ngày sau lần cân 10/10')).toBeInTheDocument()
    expect(within(projection).getByText('≥ 380 kg')).toBeInTheDocument()
    // Lần cân hợp lệ đầu tiên 205 kg (25/03, trước khung biểu đồ) → 318 kg (10/10), mục tiêu 380 kg: 113 / 175 kg.
    expect(within(progress).getByText('65%')).toBeInTheDocument()
    expect(within(progress).getByText('318 / 380 kg')).toBeInTheDocument()
    expect(within(progress).getByText('Đã tăng 113 / 175 kg từ 25/03')).toBeInTheDocument()
    expect(within(nextSteps).getByText('Cân tới · 09/11/2026')).toBeInTheDocument()
    expect(within(nextSteps).getByText('≈ 331 kg')).toBeInTheDocument()
    expect(projection.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(nextSteps.compareDocumentPosition(trend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(trend.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const chart = within(trend).getByRole('img', { name: 'Biểu đồ cân nặng theo thời gian' })
    expect(within(chart).getByText('318 kg')).toBeInTheDocument()
    expect(within(chart).queryByText('251 kg')).not.toBeInTheDocument()
    expect(within(history).getByText('251 kg')).toBeInTheDocument()
  })

  it('Quản lý ghi nhận được lần cân mới và danh sách cập nhật', async () => {
    const user = userEvent.setup()
    renderAs('MANAGER', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth&m=record')
    await screen.findByLabelText('Cân nặng')
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu đánh giá' }))
    expect(await within(dialog).findByText('Nhập cân nặng, BCS hoặc cả hai.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Cân nặng'), '322')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu đánh giá' }))
    expect(await screen.findByText('Đã lưu đánh giá cho BC-000203.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await screen.findAllByText('322 kg')).length).toBeGreaterThan(0)
  })

  it('tính cân nặng từ thước dây theo công thức', async () => {
    const user = userEvent.setup()
    renderAs('MANAGER', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth&m=record')
    await screen.findByLabelText('Cân nặng')
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByLabelText('Thước dây'))
    await user.type(within(dialog).getByLabelText('Vòng ngực (cm)'), '158')
    await user.type(within(dialog).getByLabelText('Dài thân chéo (cm)'), '132')
    expect(within(dialog).getByLabelText('Cân nặng')).toHaveValue(291.3)
  })

  it('sửa một bản ghi cần lý do', async () => {
    const user = userEvent.setup()
    renderAs('MANAGER', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth')
    await screen.findByText('Lịch sử đo')
    await user.click(screen.getAllByRole('button', { name: 'Sửa · Loại trừ' })[0])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByLabelText('Loại trừ bản ghi'))
    await user.click(within(dialog).getByRole('button', { name: 'Loại trừ bản ghi' }))
    expect(await within(dialog).findByText('Lý do là bắt buộc.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Lý do'), 'Cân sai')
    await user.click(within(dialog).getByRole('button', { name: 'Loại trừ bản ghi' }))
    expect(await screen.findByText(/Bản ghi đã được loại trừ/)).toBeInTheDocument()
  })

  it('D41: Chủ trại ghi nhận và sửa như Quản lý', async () => {
    renderAs('OWNER', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth&m=record')
    expect(await screen.findByLabelText('Cân nặng')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Sửa · Loại trừ' }).length).toBeGreaterThan(0)
  })

  it('TECHNICIAN chỉ xem, không có nút ghi nhận và cột Thao tác', async () => {
    renderAs('TECHNICIAN', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth&m=record')
    await screen.findByText('Lịch sử đo')
    expect(screen.queryByRole('button', { name: /Ghi nhận cân & BCS/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Thao tác')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // Lỗi phát hiện khi thử trên trình duyệt (16/11/2026): bò trên phiếu chết PENDING mất nút ghi cân mà không báo lý do.
  it('R-08-10: bò chờ xác nhận chết / mất báo lý do, không mở ghi mới nhưng vẫn sửa / loại trừ được', async () => {
    const real = await growthDemoStore.getProfile('BC-000203')
    const spy = vi.spyOn(growthApi, 'getProfile').mockResolvedValue({ ...real, cattle: { ...real.cattle, exitPending: true } })
    renderAs('MANAGER', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth&m=record')
    expect(await screen.findByText(/Chờ xác nhận chết \/ mất: BC-000203 không ghi được lần cân mới/)).toBeInTheDocument()
    expect(screen.getByText(/Vẫn sửa hoặc loại trừ được các bản ghi cân đã có/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Sửa · Loại trừ' }).length).toBeGreaterThan(0)
    spy.mockRestore()
  })

  it('bò chờ xác nhận chết / mất: Kỹ thuật viên chỉ thấy lý do, không thấy câu về sửa / loại trừ', async () => {
    const real = await growthDemoStore.getProfile('BC-000203')
    const spy = vi.spyOn(growthApi, 'getProfile').mockResolvedValue({ ...real, cattle: { ...real.cattle, exitPending: true } })
    renderAs('TECHNICIAN', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth')
    expect(await screen.findByText(/Chờ xác nhận chết \/ mất: BC-000203/)).toBeInTheDocument()
    expect(screen.queryByText(/Vẫn sửa hoặc loại trừ/)).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it('lần cân tới đã quá hạn: tô đỏ, ghi số ngày quá hạn mà vẫn giữ chữ "ước tính" cạnh số cân dự báo', async () => {
    const real = await growthDemoStore.getProfile('BC-000203')
    // Lần cân tới 09/11/2026 (10/10 + 30 ngày); hôm nay của trại 20/11/2026.
    const spy = vi.spyOn(growthApi, 'getProfile').mockResolvedValue({ ...real, today: '2026-11-20' })
    renderAs('MANAGER', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth')
    const nextSteps = await screen.findByRole('region', { name: 'Tăng cân và lần cân tới' })
    expect(within(nextSteps).getByText('≈ 331 kg')).toBeInTheDocument()
    expect(within(nextSteps).getByText('Quá hạn 11 ngày · Ước tính nếu giữ ADG hiện tại')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('bò chưa có lần đo hiện trạng thái rỗng', async () => {
    renderAs('MANAGER', <GrowthProfileTab cattleCode="BC-000219" />, '/?tab=growth')
    expect(await screen.findByText('Chưa có lần đo nào')).toBeInTheDocument()
    expect(screen.getByText('Chưa có lần cân hợp lệ để vẽ biểu đồ.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Dự kiến xuất bán' })).not.toBeInTheDocument()
    // Không có dự kiến: 5 chỉ số đứng chung một hàng trước biểu đồ.
    const summary = screen.getByRole('region', { name: 'Chỉ số tăng trưởng' })
    expect(within(summary).getByText('BCS gần nhất')).toBeInTheDocument()
    expect(within(summary).getByText('Số lần đo')).toBeInTheDocument()
    expect(summary.compareDocumentPosition(screen.getByRole('region', { name: 'Cân nặng theo thời gian' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('bản kỹ thuật viên chỉ đọc', async () => {
    renderAs('TECHNICIAN', <GrowthTechnicianTab cattleCode="BC-000203" />)
    expect(await screen.findByText('Cân nặng 3 tháng')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
