import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFeedCatalogueApi } from '../../../src/features/feed-stock/api/feedCatalogueApi'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { feedCatalogueDemoStore, resetFeedCatalogueDemoStore } from '../../../src/features/feed-stock/data/feedReceiptDemoStore'
import { initialFeedReceiptForm, validateFeedReceiptForm } from '../../../src/features/feed-stock/data/feedReceiptForm'
import type { BackendTransport } from '../../../src/api/backendTransport'
import type { FeedCatalogueDemoStore } from '../../../src/features/feed-stock/types/feedCatalogue'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => []),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})

const feedInput = (overrides: Record<string, unknown> = {}) => ({
  code: 'TA-09',
  name: 'Cỏ voi demo',
  group: 'GREEN_ROUGHAGE' as const,
  purchaseUnit: 'bó',
  kgPerPurchaseUnit: 12,
  minimumStockKg: 45,
  nutritionNote: 'Mẫu tổng hợp',
  available: true,
  ...overrides,
})

describe('SCR-84 feed catalogue and supplier boundary', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedCatalogueDemoStore()
  })

  it('creates and edits feeds in the shared stock projection, and retains inactive items', async () => {
    const api = createFeedCatalogueApi({ mode: 'local', farmId: 1, transport: makeTransport() })
    const created = await api.saveFeed(feedInput())
    let row = (await listFeedStock()).find((item) => item.feedItemId === created.id)!
    expect(row).toMatchObject({ code: 'TA-09', name: 'Cỏ voi demo', group: 'GREEN_ROUGHAGE', minimumStockKg: 45, onHandKg: 0, available: true })

    await api.saveFeed({ ...feedInput({ name: 'Cỏ voi cập nhật', minimumStockKg: 80 }), id: created.id })
    row = (await listFeedStock()).find((item) => item.feedItemId === created.id)!
    expect(row).toMatchObject({ name: 'Cỏ voi cập nhật', minimumStockKg: 80 })

    await api.setFeedAvailable(created.id, false)
    expect((await listFeedStock()).find((item) => item.feedItemId === created.id)).toMatchObject({ available: false, name: 'Cỏ voi cập nhật' })
    expect((await api.listFeeds()).find((item) => item.id === created.id)?.available).toBe(false)
    const receiptForm = initialFeedReceiptForm(null)
    receiptForm.receiptDate = new Date().toISOString().slice(0, 10)
    receiptForm.supplierId = '201'
    receiptForm.lines = [{ feedItemId: String(created.id), lotNumber: '', expiryDate: '', quantityPurchase: '1', purchaseUnit: 'bó', unitPrice: '1000' }]
    expect(validateFeedReceiptForm(receiptForm, await listFeedStock(), await api.listSuppliers())).toBe('Chọn thức ăn cho dòng 1.')
  })

  it('rejects duplicate codes, invalid conversion, and changing code after stock movements', async () => {
    const api = createFeedCatalogueApi({ mode: 'local', farmId: 1, transport: makeTransport() })
    await expect(api.saveFeed(feedInput({ code: 'TA-01' }))).rejects.toThrow('Mã thức ăn đã tồn tại.')
    await expect(api.saveFeed(feedInput({ kgPerPurchaseUnit: 0 }))).rejects.toThrow('Quy đổi phải lớn hơn 0.')
    await expect(api.saveFeed({ ...feedInput({ code: 'TA-09' }), id: 101 })).rejects.toThrow('không thể đổi mã')
    expect((await api.listFeeds()).some((item) => item.code === 'TA-09')).toBe(false)
  })

  it('shares supplier additions and status changes with the receipt form data boundary', async () => {
    const api = createFeedCatalogueApi({ mode: 'local', farmId: 1, transport: makeTransport() })
    const supplier = await api.saveSupplier({ name: 'Nhà cung cấp demo', phone: '0900000000', area: 'Ba Vì', note: '' })
    expect((await api.listSuppliers()).some((item) => item.id === supplier.id && item.name === 'Nhà cung cấp demo')).toBe(true)
    const form = initialFeedReceiptForm(null)
    form.receiptDate = new Date().toISOString().slice(0, 10)
    form.supplierId = String(supplier.id)
    form.lines = [{ feedItemId: '101', lotNumber: '', expiryDate: '', quantityPurchase: '1', purchaseUnit: 'kg', unitPrice: '1000' }]
    expect(validateFeedReceiptForm(form, await listFeedStock(), await api.listSuppliers())).toBeNull()
    await api.setSupplierActive(supplier.id, false)
    const updatedSuppliers = await api.listSuppliers()
    expect(updatedSuppliers.find((item) => item.id === supplier.id)?.active).toBe(false)
    expect(validateFeedReceiptForm(form, await listFeedStock(), updatedSuppliers)).toBe('Chọn nhà cung cấp.')
    expect((await api.listSuppliers()).find((item) => item.id === 201)?.name).toBe('Đại lý TACN Hưng Thịnh – Sơn Tây')
  })

  it('reads server catalogue and supplier lists without local fallback, and blocks backend mutations', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get)
      .mockResolvedValueOnce([{ id: 7, code: 'TA-77', name: 'Tồn server', feedGroup: 'TMR', purchaseUnit: 'bao', kgPerPurchaseUnit: 20, stockUnit: 'kg', minimumStockKg: 5, available: true, version: 1 }])
      .mockResolvedValueOnce([{ id: 8, name: 'NCC server', supplier: true, phone: '', area: '', note: '', status: 'ACTIVE', version: 1 }])
    const demoStore: FeedCatalogueDemoStore = {
      listFeeds: vi.fn(async () => []), saveFeed: vi.fn(), setFeedAvailable: vi.fn(),
      listSuppliers: vi.fn(async () => []), saveSupplier: vi.fn(), setSupplierActive: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedCatalogueApi({ mode: 'backend', farmId: 32, transport, demoStore })

    expect(await api.listFeeds()).toMatchObject([{ id: 7, code: 'TA-77', name: 'Tồn server', group: 'TMR', available: true }])
    expect(await api.listSuppliers()).toMatchObject([{ id: 8, name: 'NCC server', active: true }])
    expect(transport.get).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/catalogue')
    expect(transport.get).toHaveBeenNthCalledWith(2, '/api/farms/32/trading-partners?role=SUPPLIER')
    await expect(api.saveFeed(feedInput())).rejects.toThrow('bản demo')
    await expect(api.setFeedAvailable(7, false)).rejects.toThrow('bản demo')
    await expect(api.saveSupplier({ name: 'Không ghi', phone: '', area: '', note: '' })).rejects.toThrow('bản demo')
    await expect(api.setSupplierActive(8, false)).rejects.toThrow('bản demo')
    expect(demoStore.saveFeed).not.toHaveBeenCalled()
    expect(demoStore.setFeedAvailable).not.toHaveBeenCalled()
    expect(demoStore.saveSupplier).not.toHaveBeenCalled()
    expect(demoStore.setSupplierActive).not.toHaveBeenCalled()
    expect(transport.command).not.toHaveBeenCalled()
  })

  it('propagates backend failures without serving local mock rows', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockRejectedValueOnce(new Error('backend unavailable'))
    const demoStore = { ...feedCatalogueDemoStore, listFeeds: vi.fn(async () => []) }
    const api = createFeedCatalogueApi({ mode: 'backend', farmId: 1, transport, demoStore })
    await expect(api.listFeeds()).rejects.toThrow('backend unavailable')
    expect(demoStore.listFeeds).not.toHaveBeenCalled()
  })
})
