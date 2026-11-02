import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { VaccinationProfileTab, VaccinationTechnicianTab } from '../../../src/features/vaccination'
import { vaccinationApi } from '../../../src/features/vaccination/api/vaccinationApi'
import { vaccinationDemoStore } from '../../../src/features/vaccination/data/vaccinationDemoStore'
import VaccinationRoutes from '../../../src/features/vaccination/pages/VaccinationRoutes'

const session = (role: Session['role']): Session => ({ role, fullName: 'Trần Quốc Long', email: 'x@y.vn', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => {} })
const renderAs = (role: Session['role'] | null, ui: React.ReactNode, path: string) =>
  render(
    <SessionContext.Provider value={role ? session(role) : null}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </SessionContext.Provider>,
  )
const app = (role: Session['role'] | null, path = '/tiem-phong') =>
  renderAs(role, <Routes><Route path="/tiem-phong/*" element={<VaccinationRoutes />} /></Routes>, path)

beforeEach(async () => {
  await vaccinationDemoStore.reset()
})

describe('lịch tiêm phòng /tiem-phong', () => {
  it('Quản lý chọn nhiều mũi, ghi nhận hàng loạt và có kiểm tra số lô', async () => {
    const user = userEvent.setup()
    app('MANAGER')
    expect(await screen.findByText('BC-000131')).toBeInTheDocument()
    expect(screen.getByText('Đã tiêm 61 / 86')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Chọn BC-000131'))
    await user.click(screen.getByLabelText('Chọn BC-000154'))
    await user.click(screen.getByRole('button', { name: 'Ghi nhận 2 mũi đã chọn' }))
    expect(await screen.findByRole('heading', { name: 'Ghi nhận tiêm – LMLM 2026 · mũi 2/2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu 2 mũi tiêm' }))
    expect(await screen.findByText('Số lô là bắt buộc khi tiêm tại trại.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Số lô'), 'AFT-2609-17')
    await user.click(screen.getByRole('button', { name: 'Lưu 2 mũi tiêm' }))
    expect(await screen.findByText(/Đã ghi nhận 2 mũi tiêm; hoãn 0 mũi/)).toBeInTheDocument()
    expect(await screen.findByText('Quá hạn (10)')).toBeInTheDocument()
  })

  it('hoãn một mũi cần lý do', async () => {
    const user = userEvent.setup()
    app('MANAGER')
    await screen.findByText('BC-000131')
    await user.click(screen.getAllByRole('button', { name: 'Hoãn' })[0])
    await screen.findByLabelText('Lý do chưa tiêm')
    await user.click(screen.getByRole('button', { name: 'Lưu hoãn' }))
    expect(await screen.findByText('Lý do chưa tiêm là bắt buộc.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Lý do chưa tiêm'), 'Bò yếu')
    await user.click(screen.getByRole('button', { name: 'Lưu hoãn' }))
    expect(await screen.findByText(/Đã hoãn mũi tiêm/)).toBeInTheDocument()
    expect(await screen.findByText('Quá hạn (11)')).toBeInTheDocument()
  })

  it('báo lỗi tải và cho thử lại', async () => {
    const spy = vi.spyOn(vaccinationApi, 'listSchedules').mockRejectedValueOnce(new Error('boom'))
    app('OWNER')
    await userEvent.click(await screen.findByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText('BC-000131')).toBeInTheDocument()
    spy.mockRestore()
  })

  it.each(['OWNER', 'TECHNICIAN'] as const)('%s chỉ xem: không có ô chọn, thao tác, ghi nhận hay quản lý lịch', async (role) => {
    app(role)
    await screen.findByText('BC-000131')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Thao tác')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ghi nhận tiêm/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quản lý lịch' })).not.toBeInTheDocument()
  })

  it('Chủ trại mở màn quản lý lịch thì bị chặn', async () => {
    app('OWNER', '/tiem-phong/quan-ly')
    expect(await screen.findByText('Chỉ Quản lý mới thực hiện được thao tác này')).toBeInTheDocument()
  })
})

describe('quản lý lịch /tiem-phong/quan-ly', () => {
  it('bỏ một con ra khỏi nhóm và chặn tên lịch trùng', async () => {
    const user = userEvent.setup()
    app('MANAGER', '/tiem-phong/quan-ly')
    expect(await screen.findByText('86 con khớp')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bỏ BC-000125 ra' }))
    expect(await screen.findByText('85 con khớp')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Tên lịch'))
    await user.type(screen.getByLabelText('Tên lịch'), 'Tụ huyết trùng – Toàn đàn')
    await user.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    expect(await screen.findByText(/Đã có lịch đang chạy tên/)).toBeInTheDocument()
  })
})

describe('lịch sử tiêm /tiem-phong/lich-su', () => {
  it('lọc theo nguồn và hiện "Không rõ" cho dữ liệu người bán không khai', async () => {
    const user = userEvent.setup()
    app('TECHNICIAN', '/tiem-phong/lich-su')
    expect(await screen.findByText(/Hiển thị 1–6 \//)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Nguồn'), 'HISTORICAL')
    expect(await screen.findByText('BC-000248 · Q')).toBeInTheDocument()
    expect(screen.getAllByText('Không rõ').length).toBeGreaterThan(0)
    await user.type(screen.getByLabelText('Tìm mã hiển thị, số tai'), 'zzz')
    expect(await screen.findByText('Không có mũi tiêm phù hợp')).toBeInTheDocument()
  })
})

describe('tab Tiêm phòng của hồ sơ bò', () => {
  it('hiện mũi theo lịch và lịch sử, hủy một bản ghi cần lý do', async () => {
    const user = userEvent.setup()
    renderAs('MANAGER', <VaccinationProfileTab cattleCode="BC-000125" />, '/?tab=vaccine')
    expect(await screen.findByText('Mũi tiêm theo lịch')).toBeInTheDocument()
    expect(screen.getByText('Quá hạn 5 ngày')).toBeInTheDocument()
    expect(screen.getByText(/Pasteurella · mũi 1 \(đã hủy\)/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Sửa · Hủy' })[0])
    await screen.findByLabelText('Hủy bản ghi')
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByLabelText('Hủy bản ghi'))
    await user.click(within(dialog).getByRole('button', { name: 'Hủy bản ghi' }))
    expect(await within(dialog).findByText('Lý do là bắt buộc.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Lý do'), 'Ghi nhầm bò')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy bản ghi' }))
    expect(await screen.findByText(/Bản ghi tiêm đã được hủy/)).toBeInTheDocument()
    expect(await screen.findAllByText(/đã hủy/)).not.toHaveLength(0)
  })

  it.each(['OWNER', 'TECHNICIAN'] as const)('%s chỉ xem', async (role) => {
    renderAs(role, <VaccinationProfileTab cattleCode="BC-000125" />, '/?tab=vaccine&m=defer')
    await screen.findByText('Lịch sử tiêm')
    expect(screen.queryByRole('button', { name: /Ghi nhận tiêm/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Thao tác')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bản kỹ thuật viên chỉ đọc', async () => {
    renderAs('TECHNICIAN', <VaccinationTechnicianTab cattleCode="BC-000125" />, '/')
    expect(await screen.findByText('Hạn 15/10/2026')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
