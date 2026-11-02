import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import App from '../../../src/App'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { resetFeedReceiptDemoStore } from '../../../src/features/feed-stock/api/feedReceiptApi'

const session = (role: Session['role']): Session => ({ role, fullName: 'Người dùng thử', email: 'demo@beefcare.local', farmId: 1, farmName: 'Trại thử', logout: async () => undefined })

function renderApp(path: string, role?: Session['role']) {
  const tree: ReactNode = <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
  return render(role ? <SessionContext.Provider value={session(role)}>{tree}</SessionContext.Provider> : tree)
}

describe('SCR-83 feeding log', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
  })

  it('opens from the feed management tab, shows the day tiles and exposes the record dialog', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/khau-phan')

    await user.click(await screen.findByRole('tab', { name: 'Nhật ký cho ăn' }))
    expect(await screen.findByRole('tabpanel', { name: 'Nhật ký cho ăn' })).toBeInTheDocument()
    // 8 of 10 sessions are recorded; A1 and B2 still miss the afternoon feeding.
    expect(await screen.findByText('8 / 10')).toBeInTheDocument()
    expect(screen.getByText('A1, B2 chưa ghi cữ chiều')).toBeInTheDocument()
    expect(screen.getByText('−0,9%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ghi cữ cho ăn' }))
    expect(await screen.findByRole('dialog', { name: 'Ghi cữ cho ăn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Điền theo kế hoạch' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu & trừ kho' })).toBeInTheDocument()
  })

  it('refuses a session that is already recorded, then records the missing afternoon feeding from the plan', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/nhat-ky')
    await screen.findByRole('tabpanel', { name: 'Nhật ký cho ăn' })
    await user.click(await screen.findByRole('button', { name: 'Ghi cữ cho ăn' }))

    const dialog = screen.getByRole('dialog', { name: 'Ghi cữ cho ăn' })
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Chuồng' }), '1')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Cữ' }), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Điền theo kế hoạch' }))
    await user.click(within(dialog).getByRole('button', { name: 'Lưu & trừ kho' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A1 đã có bản ghi cữ sáng')

    const before = (await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Cữ' }), '2')
    await user.click(within(dialog).getByRole('button', { name: 'Điền theo kế hoạch' }))
    expect(within(dialog).getByText(/Lưu sẽ trừ kho 158 kg \(5,4 kg\/con\)/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Lưu & trừ kho' }))

    expect(await screen.findByText('Đã ghi cữ cho ăn của A1 (chiều). Đã trừ 158 kg khỏi kho.')).toBeInTheDocument()
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg).toBe(before - 130.5)
    expect(await screen.findByText('9 / 10')).toBeInTheDocument()
  })

  it('corrects a record only with a reason and shows the stock difference, then voids it and returns the stock', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/nhat-ky')
    const rowOf = async () => (await screen.findByText('B1 – Vỗ béo')).closest('tr')!

    await user.click(within(await rowOf()).getByLabelText('Thao tác B1'))
    await user.click(within(await rowOf()).getByRole('menuitem', { name: 'Sửa cữ sáng' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sửa bản ghi cho ăn' })
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Nhập lý do sửa, tối thiểu 5 ký tự.')

    const ngo = (await listFeedStock()).find((feed) => feed.feedItemId === 106)!.onHandKg
    await user.clear(within(dialog).getByLabelText('Giá trị mới TA-06'))
    await user.type(within(dialog).getByLabelText('Giá trị mới TA-06'), '23')
    expect(within(dialog).getByText('trừ thêm 3 kg')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Lý do *'), 'Ghi thiếu 3 kg cám ngô')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText(/Đã sửa bản ghi B1/)).toBeInTheDocument()
    expect((await listFeedStock()).find((feed) => feed.feedItemId === 106)!.onHandKg).toBe(ngo - 3)

    await waitFor(async () => expect(within(await rowOf()).getByLabelText('Thao tác B1')).toBeInTheDocument())
    await user.click(within(await rowOf()).getByLabelText('Thao tác B1'))
    await user.click(within(await rowOf()).getByRole('menuitem', { name: 'Hủy cữ sáng' }))
    const voidDialog = await screen.findByRole('dialog', { name: 'Sửa bản ghi cho ăn' })
    expect(within(voidDialog).getByText(/hoàn lại kho toàn bộ 253 kg/)).toBeInTheDocument()
    await user.type(within(voidDialog).getByLabelText('Lý do *'), 'Chọn nhầm chuồng')
    await user.click(within(voidDialog).getByRole('button', { name: 'Xác nhận hủy bản ghi' }))
    expect(await screen.findByText(/Đã hủy bản ghi B1/)).toBeInTheDocument()
    expect((await listFeedStock()).find((feed) => feed.feedItemId === 106)!.onHandKg).toBe(ngo - 3 + 23)
  })

  it('quick-fills the missing sessions from the ration', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/nhat-ky')
    await user.click(await screen.findByRole('button', { name: 'Ghi nhanh theo khẩu phần' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ghi nhanh theo khẩu phần' })
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(2)
    await user.click(within(dialog).getByRole('button', { name: /Ghi 2 cữ theo kế hoạch/ }))

    expect(await screen.findByText(/Đã ghi 2 cữ theo khẩu phần/)).toBeInTheDocument()
    expect(await screen.findByText('10 / 10')).toBeInTheDocument()
  })

  it('is read-only for the owner: nothing to record, correct or void', async () => {
    renderApp('/thuc-an/nhat-ky', 'OWNER')
    await screen.findByRole('tabpanel', { name: 'Nhật ký cho ăn' })
    expect(await screen.findByText('8 / 10')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi cữ cho ăn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi nhanh theo khẩu phần' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Thao tác B1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ghi cữ A1/ })).not.toBeInTheDocument()
  })
})
