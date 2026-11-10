import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'
import { listFeedReceipts, resetFeedReceiptDemoStore } from '../../../src/features/feed-stock/api/feedReceiptApi'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { listFeedMovements } from '../../../src/features/feed-stock/api/feedMovementApi'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('SCR-79 posted receipt detail: payment and void', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
  })

  it('shows a posted receipt read-only without presenting current stock as historical stock', async () => {
    renderApp('/thuc-an/phieu-nhap/8129')
    expect(await screen.findByRole('heading', { name: 'Phiếu nhập kho PNK-2026-0029 · Đã ghi' })).toBeInTheDocument()
    expect(screen.getByLabelText('Đã thanh toán')).toHaveValue(16_500_000)
    expect(screen.getByLabelText('Đã thanh toán')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Còn nợ')).toHaveValue('2.500.000')
    expect(screen.getByText('Tồn kho hiện tại')).toBeInTheDocument()
    expect(screen.queryByText('Tồn trước → sau khi nhập')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu & cộng kho' })).not.toBeInTheDocument()
  })

  it('records a later payment that cannot exceed what is still owed', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/8129')
    await user.click(await screen.findByRole('button', { name: 'Ghi trả nhà cung cấp' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ghi trả nhà cung cấp' })

    await user.clear(within(dialog).getByRole('spinbutton'))
    await user.type(within(dialog).getByRole('spinbutton'), '3000000')
    await user.click(within(dialog).getByRole('button', { name: 'Ghi khoản trả' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Số tiền không được vượt quá 2.500.000 đ.')

    await user.clear(within(dialog).getByRole('spinbutton'))
    await user.type(within(dialog).getByRole('spinbutton'), '1000000')
    await user.click(within(dialog).getByRole('button', { name: 'Ghi khoản trả' }))
    expect(await screen.findByLabelText('Còn nợ')).toHaveValue('1.500.000')
    expect((await listFeedReceipts()).find((row) => row.id === 8129)?.amountPaid).toBe(17_500_000)
  })

  it('refuses to void a receipt whose stock is no longer covered and tells the user to adjust stock', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/8130?m=huy')
    const dialog = await screen.findByRole('dialog', { name: 'Hủy phiếu nhập kho PNK-2026-0030' })

    expect(await within(dialog).findByText('1.850 kg / 6.000 kg')).toBeInTheDocument()
    expect(within(dialog).getByText('Không đủ tồn')).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('phiếu điều chỉnh kho')
    expect(within(dialog).getByRole('button', { name: 'Hủy phiếu nhập kho' })).toBeDisabled()
    await user.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[1])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('voids a freshly posted receipt with a reason, takes the stock back and shows it in the movement history', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi?feedItemId=101')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '202')
    await user.type(screen.getByLabelText('Số lượng dòng 1'), '100')
    await user.type(screen.getByLabelText('Đơn giá dòng 1'), '700')
    await user.click(screen.getByRole('button', { name: 'Lưu & cộng kho' }))
    await screen.findByRole('heading', { name: 'Phiếu nhập kho' })
    const created = (await listFeedReceipts()).find((row) => row.code.endsWith('0032'))!
    expect(created.status).toBe('POSTED')
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(1950)

    await user.click(await screen.findByRole('button', { name: `Xem ${created.code}` }))
    await user.click(await screen.findByRole('button', { name: 'Hủy phiếu' }))
    const dialog = await screen.findByRole('dialog', { name: /Hủy phiếu nhập kho PNK-/ })
    expect(await within(dialog).findByText('Hủy được')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Hủy phiếu nhập kho' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Lý do hủy là bắt buộc.')
    await user.type(within(dialog).getByLabelText('Lý do hủy *'), 'Nhập trùng phiếu')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy phiếu nhập kho' }))

    expect(await screen.findByText(`Phiếu ${created.code} đã được hủy.`)).toBeInTheDocument()
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(1850)
    expect((await listFeedReceipts()).find((row) => row.id === created.id)).toMatchObject({ status: 'VOIDED', voidReason: 'Nhập trùng phiếu' })
    const movements = (await listFeedMovements(101)).filter((movement) => movement.sourceId === created.id)
    expect(movements[0]).toMatchObject({ movementType: 'RECEIPT_VOID', quantityKg: -100, balanceAfterKg: 1850 })
    expect(movements[1]).toMatchObject({ movementType: 'RECEIPT', quantityKg: 100, balanceAfterKg: 1950 })
  })
})
