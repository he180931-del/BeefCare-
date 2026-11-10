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

  it('reads and mutates the backend catalogue with backend IDs, versions, and no demo fallback', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get)
      .mockResolvedValueOnce([
        { id: 7, code: 'TA-77', name: 'Tồn server', feedGroup: 'TMR', nutritionNote: 'Đạm 16%', purchaseUnit: 'bao', kgPerPurchaseUnit: 20, stockUnit: 'kg', minimumStockKg: 5, available: true, version: 1 },
        { id: 9, code: 'TA-09', name: 'Không quy cách', feedGroup: 'CALF_FEED', nutritionNote: '', purchaseUnit: null, kgPerPurchaseUnit: null, stockUnit: 'kg', minimumStockKg: null, available: true, version: 0 },
      ])
      .mockResolvedValueOnce([{ id: 8, name: 'NCC server', seller: false, buyer: false, supplier: true, phone: '', area: '', note: '', status: 'ACTIVE', version: 1 }])
    const demoStore: FeedCatalogueDemoStore = {
      listFeeds: vi.fn(async () => []), saveFeed: vi.fn(), setFeedAvailable: vi.fn(),
      listSuppliers: vi.fn(async () => []), saveSupplier: vi.fn(), setSupplierActive: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedCatalogueApi({ mode: 'backend', farmId: 32, transport, demoStore })

    expect(await api.listFeeds()).toMatchObject([
      { id: 7, code: 'TA-77', name: 'Tồn server', group: 'TMR', nutritionNote: 'Đạm 16%', available: true, version: 1 },
      { id: 9, purchaseUnit: '', kgPerPurchaseUnit: null, minimumStockKg: null },
    ])
    expect(await api.listSuppliers()).toMatchObject([{ id: 8, name: 'NCC server', seller: false, buyer: false, active: true, version: 1 }])
    expect(transport.get).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/catalogue')
    expect(transport.get).toHaveBeenNthCalledWith(2, '/api/farms/32/trading-partners?role=SUPPLIER')
    vi.mocked(transport.command)
      .mockResolvedValueOnce({ id: 10, code: 'TA-09', name: 'Cỏ voi demo', feedGroup: 'GREEN_ROUGHAGE', purchaseUnit: 'bó', kgPerPurchaseUnit: 12, stockUnit: 'kg', onHandKg: 0, averageUnitCost: 0, minimumStockKg: 45, available: true, version: 0 })
      .mockResolvedValueOnce({ id: 7, code: 'TA-77', name: 'Tồn server đã sửa', feedGroup: 'TMR', purchaseUnit: 'bao', kgPerPurchaseUnit: 20, stockUnit: 'kg', onHandKg: 0, averageUnitCost: 0, minimumStockKg: 5, available: true, version: 2 })
    const created = await api.saveFeed(feedInput())
    expect(created.id).toBe(10)
    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/catalogue', {
      code: 'TA-09', name: 'Cỏ voi demo', feedGroup: 'GREEN_ROUGHAGE', purchaseUnit: 'bó', kgPerPurchaseUnit: 12,
      minimumStockKg: 45, nutritionNote: 'Mẫu tổng hợp', available: true,
    }, { method: 'POST' })
    const updated = await api.saveFeed({ ...feedInput({ code: 'TA-77', name: 'Tồn server đã sửa' }), id: 7, expectedVersion: 1 })
    expect(updated.version).toBe(2)
    expect(transport.command).toHaveBeenNthCalledWith(2, '/api/farms/32/feed/catalogue/7', {
      code: 'TA-77', name: 'Tồn server đã sửa', feedGroup: 'GREEN_ROUGHAGE', purchaseUnit: 'bó', kgPerPurchaseUnit: 12,
      minimumStockKg: 45, nutritionNote: 'Mẫu tổng hợp', available: true, expectedVersion: 1,
    }, { method: 'PUT' })
    expect(demoStore.saveFeed).not.toHaveBeenCalled()
    expect(demoStore.setFeedAvailable).not.toHaveBeenCalled()
    expect(demoStore.saveSupplier).not.toHaveBeenCalled()
    expect(demoStore.setSupplierActive).not.toHaveBeenCalled()
  })

  it('creates, edits, and changes supplier status through TradingPartner commands', async () => {
    const transport = makeTransport()
    const api = createFeedCatalogueApi({ mode: 'backend', farmId: 32, transport })
    vi.mocked(transport.command)
      .mockResolvedValueOnce({ id: 31, name: 'NCC mới', seller: false, buyer: false, supplier: true, phone: '0900000000', area: 'Ba Vì', note: 'Giao thứ 2', status: 'ACTIVE', version: 0 })
      .mockResolvedValueOnce({ id: 31, name: 'NCC mới sửa', seller: true, buyer: false, supplier: true, phone: '0911111111', area: 'Sơn Tây', note: '', status: 'ACTIVE', version: 1 })
      .mockResolvedValueOnce({ id: 31, name: 'NCC mới sửa', seller: true, buyer: false, supplier: true, phone: '0911111111', area: 'Sơn Tây', note: '', status: 'INACTIVE', version: 2 })

    await api.saveSupplier({ name: 'NCC mới', phone: '0900000000', area: 'Ba Vì', note: '' })
    await api.saveSupplier({ id: 31, expectedVersion: 0, name: 'NCC mới sửa', phone: '0911111111', area: 'Sơn Tây', note: '', seller: true, buyer: false })
    await api.setSupplierActive(31, false, 1)

    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/trading-partners', {
      name: 'NCC mới', seller: false, buyer: false, supplier: true, phone: '0900000000', area: 'Ba Vì', note: '',
    }, { method: 'POST' })
    expect(transport.command).toHaveBeenNthCalledWith(2, '/api/farms/32/trading-partners/31', {
      name: 'NCC mới sửa', seller: true, buyer: false, supplier: true, phone: '0911111111', area: 'Sơn Tây', note: '', expectedVersion: 0,
    }, { method: 'PUT' })
    expect(transport.command).toHaveBeenNthCalledWith(3, '/api/farms/32/trading-partners/31/status', {
      status: 'INACTIVE', expectedVersion: 1,
    }, { method: 'PATCH' })
  })

  it('uses server version for a feed availability change and propagates command failures without demo fallback', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockResolvedValueOnce([{
      id: 7, code: 'TA-77', name: 'Tồn server', feedGroup: 'TMR', purchaseUnit: 'bao', kgPerPurchaseUnit: 20,
      stockUnit: 'kg', onHandKg: 10, averageUnitCost: 1200, minimumStockKg: 5, available: true, version: 3,
    }])
    const demoStore: FeedCatalogueDemoStore = {
      listFeeds: vi.fn(async () => []), saveFeed: vi.fn(), setFeedAvailable: vi.fn(),
      listSuppliers: vi.fn(async () => []), saveSupplier: vi.fn(), setSupplierActive: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedCatalogueApi({ mode: 'backend', farmId: 32, transport, demoStore })
    vi.mocked(transport.command).mockRejectedValueOnce(new Error('backend unavailable'))

    await expect(api.setFeedAvailable(7, false)).rejects.toThrow('backend unavailable')
    expect(transport.command).toHaveBeenCalledWith('/api/farms/32/feed/catalogue/7', {
      code: 'TA-77', name: 'Tồn server', feedGroup: 'TMR', purchaseUnit: 'bao', kgPerPurchaseUnit: 20,
      minimumStockKg: 5, nutritionNote: '', available: false, expectedVersion: 3,
    }, { method: 'PUT' })
    expect(demoStore.setFeedAvailable).not.toHaveBeenCalled()
  })

  it('sends unset purchase conversion and minimum level as null', async () => {
    const transport = makeTransport()
    const api = createFeedCatalogueApi({ mode: 'backend', farmId: 32, transport })
    vi.mocked(transport.command).mockResolvedValueOnce({
      id: 21, code: 'TA-21', name: 'Không ngưỡng', feedGroup: 'CALF_FEED', nutritionNote: '', purchaseUnit: null,
      kgPerPurchaseUnit: null, stockUnit: 'kg', onHandKg: 0, averageUnitCost: 0, minimumStockKg: null, available: true, version: 0,
    })

    await api.saveFeed({
      code: 'TA-21', name: 'Không ngưỡng', group: 'CALF_FEED', purchaseUnit: '', kgPerPurchaseUnit: null,
      minimumStockKg: null, nutritionNote: '', available: true,
    })

    expect(transport.command).toHaveBeenCalledWith('/api/farms/32/feed/catalogue', {
      code: 'TA-21', name: 'Không ngưỡng', feedGroup: 'CALF_FEED', purchaseUnit: null, kgPerPurchaseUnit: null,
      minimumStockKg: null, nutritionNote: '', available: true,
    }, { method: 'POST' })
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
