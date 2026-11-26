import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext } from '../../../src/app/session/sessionContext'
import { financeDemoStore } from '../../../src/features/platform-finance/data/financeDemoStore'
import ManualFinanceRoutes from '../../../src/features/platform-finance/pages/ManualFinanceRoutes'

const pm = { role: 'PM' as const, fullName: 'Đỗ Minh Quân', email: 'quan@beefcare.vn', farmId: 0, farmName: '', logout: async () => {} }
const renderAt = (path: string) =>
  render(
    <SessionContext.Provider value={pm}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/nen-tang/thu-chi/*" element={<ManualFinanceRoutes />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )

beforeEach(async () => { await financeDemoStore.reset() })

const pickerOptions = () => Array.from((document.getElementById('tx-pick') as HTMLSelectElement).options).map((o) => o.textContent ?? '')

describe('SCR-71 danh sách thu chi: gọn giao diện', () => {
  it('thanh lọc là một hàng riêng, tên trường ở trên ô; không còn thẻ "Thao tác theo trạng thái"', async () => {
    renderAt('/nen-tang/thu-chi')
    const filters = await screen.findByTestId('record-filters')
    for (const name of ['Danh mục', 'Từ ngày', 'Đến ngày', 'Loại', 'Phạm vi']) expect(within(filters).getByText(name)).toBeInTheDocument()
    expect(within(filters).getByLabelText('Danh mục')).toBeInTheDocument()
    expect(within(filters).queryByRole('heading')).toBeNull()
    expect(within(filters).queryByRole('button', { name: /Thêm khoản/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Thêm khoản/ })).toBeInTheDocument()
    expect(screen.queryByText('Thao tác theo trạng thái')).toBeNull()
  })
})

describe('SCR-72 form khoản: nguồn ngân hàng', () => {
  it('nguồn ngân hàng: ô số tiền và ngày vẫn hiện nhưng mờ và không nhập được; nhập thủ công thì nhập được', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi/moi')
    await screen.findAllByRole('button', { name: 'Lưu nháp' })
    expect(document.getElementById('fr-amount')).not.toHaveAttribute('readonly')
    await user.click(screen.getByRole('radio', { name: 'Giao dịch ngân hàng' }))
    expect(document.getElementById('fr-amount')).toHaveAttribute('readonly')
    expect(document.getElementById('fr-date')).toBeNull() // hộp ngày chỉ đọc không có ô chọn ẩn
    await user.click(screen.getByRole('radio', { name: 'Nhập thủ công' }))
    expect(document.getElementById('fr-amount')).not.toHaveAttribute('readonly')
    expect(document.getElementById('fr-date')).not.toBeNull()
  })

  it('khoản Chi chỉ chọn được giao dịch tiền ra', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi/moi')
    await user.click(await screen.findByRole('radio', { name: 'Giao dịch ngân hàng' }))
    await user.click(screen.getByRole('button', { name: 'Chọn chứng từ ngân hàng' }))
    await screen.findByLabelText('Tìm giao dịch đã xác thực')
    const options = pickerOptions().join('|')
    expect(options).toContain('EV-0835')
    expect(options).not.toContain('EV-0838')
    expect(options).not.toContain('EV-0846')
  })

  it('khoản Thu chỉ chọn được giao dịch tiền vào', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi/moi')
    await user.click(await screen.findByRole('radio', { name: 'Thu' }))
    await user.click(screen.getByRole('radio', { name: 'Giao dịch ngân hàng' }))
    await user.click(screen.getByRole('button', { name: 'Chọn chứng từ ngân hàng' }))
    await screen.findByLabelText('Tìm giao dịch đã xác thực')
    const options = pickerOptions().join('|')
    expect(options).toContain('EV-0838')
    expect(options).toContain('EV-0846')
    expect(options).not.toContain('EV-0835')
  })

  it('chọn giao dịch hiện số tiền và ngày chỉ đọc; đổi Thu/Chi thì bỏ giao dịch đã chọn', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi/moi')
    await user.click(await screen.findByRole('radio', { name: 'Thu' }))
    await user.click(screen.getByRole('radio', { name: 'Giao dịch ngân hàng' }))
    await user.click(screen.getByRole('button', { name: 'Chọn chứng từ ngân hàng' }))
    const select = await screen.findByLabelText('Tìm giao dịch đã xác thực')
    const option = Array.from((select as HTMLSelectElement).options).find((o) => (o.textContent ?? '').includes('EV-0846'))!
    await user.selectOptions(select, option.value)
    await user.click(screen.getByRole('button', { name: 'Dùng nguồn này' }))
    await waitFor(() => expect((document.getElementById('fr-amount') as HTMLInputElement).value).toBe('800.000'))
    expect(document.getElementById('fr-amount')).toHaveAttribute('readonly')
    await user.click(screen.getByRole('radio', { name: 'Chi' }))
    expect(screen.queryByText(/EV-0846/)).toBeNull()
    expect((document.getElementById('fr-amount') as HTMLInputElement).value).toBe('800.000')
  })
})

describe('SCR-72 form khoản: không tự động lưu', () => {
  it('sửa nháp chưa lưu thì Ghi sổ bị khóa, không lưu ngầm; lưu nháp xong mới ghi sổ được', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi/FR-0108')
    await screen.findByRole('button', { name: /Ghi sổ/ })
    await waitFor(() => expect(screen.getByRole('button', { name: /Ghi sổ/ })).toBeEnabled())
    const before = (await financeDemoStore.getRecord('FR-0108')).record.description
    await user.type(document.getElementById('fr-desc') as HTMLTextAreaElement, ' thêm')
    expect(screen.getByRole('button', { name: /Ghi sổ/ })).toBeDisabled()
    expect(screen.getByText(/Lưu nháp trước khi ghi sổ/)).toBeInTheDocument()
    expect((await financeDemoStore.getRecord('FR-0108')).record.description).toBe(before)
    await user.click(screen.getAllByRole('button', { name: 'Lưu nháp' })[0])
    expect(await screen.findByText(/đã được lưu ở trạng thái nháp/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Ghi sổ/ })).toBeEnabled())
    expect((await financeDemoStore.getRecord('FR-0108')).record.description).toBe(`${before} thêm`)
  })
})

describe('SCR-72 form khoản: đính kèm và nút lưu', () => {
  it('nút Chọn chứng từ ngân hàng luôn hiện: mờ khi nhập thủ công, sáng khi nguồn là giao dịch ngân hàng; không còn đính kèm tệp; có nút Lưu nháp ở cuối phiếu', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi/moi')
    expect((await screen.findAllByRole('button', { name: 'Lưu nháp' }))).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Chọn chứng từ ngân hàng/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Đính kèm/ })).toBeNull()
    expect(screen.queryByLabelText('Chọn tệp đính kèm')).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'Giao dịch ngân hàng' }))
    expect(screen.getByRole('button', { name: /Chọn chứng từ ngân hàng/ })).toBeEnabled()
  })
})
