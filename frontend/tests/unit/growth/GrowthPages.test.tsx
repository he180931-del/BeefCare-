import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
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
  it('Quản lý ghi nhận được lần cân mới và danh sách cập nhật', async () => {
    const user = userEvent.setup()
    renderAs('MANAGER', <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth')
    await screen.findByText('Lịch sử đo')
    await user.click(screen.getByRole('button', { name: /Ghi nhận cân & BCS/ }))
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

  it.each(['OWNER', 'TECHNICIAN'] as const)('%s chỉ xem, không có nút ghi nhận và cột Thao tác', async (role) => {
    renderAs(role, <GrowthProfileTab cattleCode="BC-000203" />, '/?tab=growth&m=record')
    await screen.findByText('Lịch sử đo')
    expect(screen.queryByRole('button', { name: /Ghi nhận cân & BCS/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Thao tác')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bò chưa có lần đo hiện trạng thái rỗng', async () => {
    renderAs('MANAGER', <GrowthProfileTab cattleCode="BC-000219" />, '/?tab=growth')
    expect(await screen.findByText('Chưa có lần đo nào')).toBeInTheDocument()
  })

  it('bản kỹ thuật viên chỉ đọc', async () => {
    renderAs('TECHNICIAN', <GrowthTechnicianTab cattleCode="BC-000203" />)
    expect(await screen.findByText('Cân nặng 3 tháng')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
