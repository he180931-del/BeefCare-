import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'
import { resetFeedReceiptDemoStore } from '../../../src/features/feed-stock/api/feedReceiptApi'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('SCR-83 feeding log', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
  })

  it('opens from the feed management tab and exposes the local record flow', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/khau-phan')

    await user.click(await screen.findByRole('tab', { name: 'Nhật ký cho ăn' }))
    expect(await screen.findByRole('tabpanel', { name: 'Nhật ký cho ăn' })).toBeInTheDocument()
    expect(screen.getByText('Dữ liệu minh họa')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ghi cữ cho ăn' }))
    expect(await screen.findByRole('dialog', { name: 'Ghi cữ cho ăn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Điền theo kế hoạch' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu & trừ kho' })).toBeInTheDocument()
  })

  it('shows the exact stock deduction after recording and requires a reason to correct', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/nhat-ky')
    await screen.findByRole('tabpanel', { name: 'Nhật ký cho ăn' })
    await user.click(screen.getByRole('button', { name: 'Ghi cữ cho ăn' }))

    const dialog = screen.getByRole('dialog', { name: 'Ghi cữ cho ăn' })
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Chuồng' }), '1')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Cữ' }), '1')
    await user.click(screen.getByRole('button', { name: 'Điền theo kế hoạch' }))
    await user.click(screen.getByRole('button', { name: 'Lưu & trừ kho' }))

    expect(await screen.findByText(/Đã ghi cữ cho ăn trong bản demo/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Sửa cữ' })).toBeInTheDocument()
    expect(screen.getByText(/TA-01/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sửa cữ' }))
    expect(await screen.findByRole('dialog', { name: 'Sửa bản ghi cho ăn' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(screen.getByText('Nhập lý do sửa, tối thiểu 5 ký tự.')).toBeInTheDocument()
  })
})
