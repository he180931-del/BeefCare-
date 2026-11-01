import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'
import { resetFeedRationDemoStore } from '../../../src/features/feed-stock/api/feedRationApi'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('SCR-81/82 rations', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedRationDemoStore()
  })

  it('filters rations by status, herd group and effective date', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/khau-phan')
    await screen.findByRole('table')

    expect(screen.getByRole('tab', { name: 'Khẩu phần' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('row', { name: /KP-01/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /KP-02/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /KP-03/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Đã kết thúc' }))
    expect(screen.getByRole('row', { name: /KP-03/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /KP-01/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Tất cả' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhóm đàn' }), 'FATTENING')
    expect(screen.getByRole('row', { name: /KP-02/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /KP-01/ })).not.toBeInTheDocument()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowText = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: tomorrowText } })
    expect(screen.queryByRole('row', { name: /KP-02/ })).not.toBeInTheDocument()
  })

  it('opens the editor from the tab and creates a local ration that appears in the list', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an')
    await screen.findByRole('heading', { name: 'Quản lý thức ăn' })
    await user.click(screen.getByRole('tab', { name: 'Khẩu phần' }))
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Tạo khẩu phần' }))
    expect(await screen.findByRole('heading', { name: 'Tạo khẩu phần' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Tên khẩu phần'), 'Khẩu phần kiểm thử')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhóm đàn' }), 'FATTENING')
    await user.click(screen.getByLabelText(/B1.*46 con/))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.clear(screen.getByLabelText('Kg/đầu/cữ 1 dòng 1'))
    await user.type(screen.getByLabelText('Kg/đầu/cữ 1 dòng 1'), '0.5')
    await user.clear(screen.getByLabelText('Kg/đầu/cữ 2 dòng 1'))
    await user.type(screen.getByLabelText('Kg/đầu/cữ 2 dòng 1'), '0.4')
    await user.click(screen.getByRole('button', { name: 'Lưu khẩu phần' }))

    expect(await screen.findByRole('heading', { name: 'Danh sách khẩu phần' })).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /KP-04.*Khẩu phần kiểm thử/ })).toBeInTheDocument()
  })

  it('shows validation errors before creating an incomplete ration', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/khau-phan/moi')
    await screen.findByRole('heading', { name: 'Tạo khẩu phần' })

    await user.click(screen.getByRole('button', { name: 'Lưu khẩu phần' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nhập tên khẩu phần.')
    await user.type(screen.getByLabelText('Tên khẩu phần'), 'Chưa đủ dữ liệu')
    await user.click(screen.getByRole('button', { name: 'Lưu khẩu phần' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chọn ít nhất một chuồng.')
  })
})
