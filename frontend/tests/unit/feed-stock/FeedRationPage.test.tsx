import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    // Default: effective and scheduled versions; the stopped KP-06 is hidden.
    expect(screen.getByRole('row', { name: /KP-01/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /KP-02.*\(v1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /KP-02.*\(v2\)/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /KP-06/ })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Trạng thái' }), 'ENDED')
    expect(screen.getByRole('row', { name: /KP-06/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /KP-01/ })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Trạng thái' }), 'ALL')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhóm đàn' }), 'FATTENING')
    expect(screen.getByRole('row', { name: /KP-02.*\(v1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /KP-06/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /KP-01/ })).not.toBeInTheDocument()
    const today = new Date()
    const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: todayText } })
    expect(screen.queryByRole('row', { name: /KP-02.*\(v2\)/ })).not.toBeInTheDocument()
  })

  it('shows the frame tiles from the seeded rations', async () => {
    renderApp('/thuc-an/khau-phan')
    await screen.findByRole('table')

    expect(screen.getByText('cho 5 chuồng · 119 con')).toBeInTheDocument()
    expect(screen.getByText('1.213 kg')).toBeInTheDocument()
    expect(screen.getByText('3.239.440 đ')).toBeInTheDocument()
    expect(screen.getByText('C1 – Cách ly (đang trống)')).toBeInTheDocument()
  })

  it('cancels a scheduled version so the previous version stays effective', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/khau-phan')
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Hủy phiên bản KP-02 v2' }))
    const dialog = await screen.findByRole('dialog', { name: /Hủy phiên bản KP-02 v2/ })
    await user.click(within(dialog).getByRole('button', { name: 'Hủy phiên bản' }))

    expect(await screen.findByText(/Đã hủy phiên bản KP-02 v2/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('row', { name: /KP-02.*\(v2\)/ })).not.toBeInTheDocument())
    // v1 lost its end date again, so it is effective without an end and can be stopped.
    expect(screen.getByRole('row', { name: /KP-02/ })).toHaveTextContent('từ ')
    expect(screen.getByRole('button', { name: 'Ngừng KP-02 v1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hủy phiên bản/ })).not.toBeInTheDocument()
  })

  it('stops an effective ration from a future date and refuses a date that is not in the future', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/khau-phan')
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Ngừng KP-03 v1' }))
    const dialog = await screen.findByRole('dialog', { name: /Ngừng khẩu phần KP-03 v1/ })
    await user.click(within(dialog).getByRole('button', { name: 'Ngừng khẩu phần' }))

    // Default end date is tomorrow: the ration gets an end date and the stop button disappears.
    expect(await screen.findByText(/KP-03 v1 sẽ ngừng áp dụng sau ngày/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ngừng KP-03 v1' })).not.toBeInTheDocument())
    expect(screen.getByRole('row', { name: /KP-03/ })).toHaveTextContent('–')
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
    await user.click(screen.getByLabelText(/C1.*0 con/))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.clear(screen.getByLabelText('Kg/đầu/cữ 1 dòng 1'))
    await user.type(screen.getByLabelText('Kg/đầu/cữ 1 dòng 1'), '0.5')
    await user.clear(screen.getByLabelText('Kg/đầu/cữ 2 dòng 1'))
    await user.type(screen.getByLabelText('Kg/đầu/cữ 2 dòng 1'), '0.4')
    await user.click(screen.getByRole('button', { name: 'Lưu khẩu phần' }))

    expect(await screen.findByRole('heading', { name: 'Khẩu phần' })).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /KP-07.*Khẩu phần kiểm thử/ })).toBeInTheDocument()
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
