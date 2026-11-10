import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'
import { resetFeedCatalogueDemoStore } from '../../../src/features/feed-stock/data/feedReceiptDemoStore'
import * as feedCatalogueApi from '../../../src/features/feed-stock/api/feedCatalogueApi'
import { listFeedCatalogue } from '../../../src/features/feed-stock/api/feedCatalogueApi'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('SCR-84 feed catalogue', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedCatalogueDemoStore()
  })

  it('lists the 8 feeds with their purchase unit, minimum level and average cost, and edits the selected row in the side panel', async () => {
    const saveFeed = vi.spyOn(feedCatalogueApi, 'saveFeedCatalogueItem')
    const user = userEvent.setup()
    renderApp('/thuc-an/danh-muc?feed=TA-06')
    await screen.findByRole('table')

    expect(screen.getByRole('button', { name: 'Thức ăn (8)' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /TA-05 Cám hỗn hợp Tinh kg Bao 25 kg 500 11\.600 đ/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /TA-08 Sữa thay thế Cho bê kg Bao 20 kg 5 36\.000 đ/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /TA-06/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Sửa thức ăn TA-06')).toBeInTheDocument()
    // A feed with stock keeps its code and stock unit.
    expect(screen.getByLabelText('Mã *')).toHaveAttribute('readonly')

    await user.clear(screen.getByLabelText('Mức tồn tối thiểu'))
    await user.type(screen.getByLabelText('Mức tồn tối thiểu'), '300')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(await screen.findByText('Cám ngô đã được lưu.')).toBeInTheDocument()
    expect(saveFeed).toHaveBeenCalledWith(expect.objectContaining({ id: 106, expectedVersion: 2 }))
    expect((await listFeedCatalogue()).find((item) => item.code === 'TA-06')?.minimumStockKg).toBe(300)
  })

  it('stops a feed instead of deleting it and hides it from the default "Đang dùng" list', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/danh-muc?feed=TA-03')
    await screen.findByRole('table')

    await user.click(screen.getByRole('radio', { name: 'Ngừng dùng' }))
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Cỏ non đã được lưu.')).toBeInTheDocument()

    expect((await listFeedCatalogue()).find((item) => item.code === 'TA-03')).toMatchObject({ available: false })
    // The saved row stays visible because the status filter widens to all rows.
    expect(await screen.findByRole('row', { name: /TA-03 Cỏ non.*Ngừng dùng/ })).toBeInTheDocument()
  })

  it('adds a feed with the next code and validates the conversion', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/danh-muc')
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Thêm thức ăn' }))
    expect(screen.getByLabelText('Mã *')).toHaveValue('TA-09')
    await user.type(screen.getByLabelText('Tên thức ăn *'), 'Bột đậu nành')
    await user.selectOptions(screen.getByLabelText('Nhóm *'), 'CONCENTRATE')
    await user.clear(screen.getByLabelText('Quy đổi'))
    await user.type(screen.getByLabelText('Quy đổi'), '0')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Quy đổi phải lớn hơn 0.')

    await user.clear(screen.getByLabelText('Quy đổi'))
    await user.type(screen.getByLabelText('Quy đổi'), '1')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Bột đậu nành đã được lưu.')).toBeInTheDocument()
    expect(within(await screen.findByRole('table')).getByRole('row', { name: /TA-09 Bột đậu nành/ })).toBeInTheDocument()
  })

  it('switches to the suppliers list and edits a supplier in a dialog', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/danh-muc')
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nhà cung cấp (4)' }))
    expect(await screen.findByRole('row', { name: /Đại lý TACN Hưng Thịnh – Sơn Tây 0977 222 315/ })).toBeInTheDocument()
    await user.click(within(screen.getByRole('row', { name: /HTX cỏ Ba Vì/ })).getByRole('button', { name: 'Sửa' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sửa nhà cung cấp' })
    await user.clear(within(dialog).getByLabelText('Điện thoại'))
    await user.type(within(dialog).getByLabelText('Điện thoại'), '0912000111')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu nhà cung cấp' }))
    expect(await screen.findByText('HTX cỏ Ba Vì đã được lưu.')).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /HTX cỏ Ba Vì.*0912000111/ })).toBeInTheDocument()
  })
})
