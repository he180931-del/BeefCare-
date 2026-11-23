import { asRecord, asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import type { FeedCatalogueDemoStore, FeedCatalogueInput, FeedCatalogueItem, FeedCatalogueSaveInput, FeedSupplier, FeedSupplierInput } from '../types/feedCatalogue'
import { demo } from '../../../demo/demoModules'
import { lazyObject } from '../../../shared/lib/lazyObject'
import { type FeedCommandOptions } from './command'

export type FeedCatalogueCommandOptions = FeedCommandOptions
export type FeedSupplierQuery = { q?: string; status?: 'ACTIVE' | 'INACTIVE' }

function commandOptions(method: string, options: FeedCatalogueCommandOptions = {}) {
  return options.key === undefined ? { method } : { method, key: options.key }
}

function backendFeed(value: unknown): FeedCatalogueItem {
  const row = asRecord(value)
  return {
    id: numberValue(row.id),
    code: textValue(row.code),
    name: textValue(row.name),
    group: textValue(row.feedGroup),
    stockUnit: textValue(row.stockUnit, 'kg'),
    purchaseUnit: textValue(row.purchaseUnit),
    kgPerPurchaseUnit: nullableNumber(row.kgPerPurchaseUnit),
    minimumStockKg: nullableNumber(row.minimumStockKg),
    nutritionNote: textValue(row.nutritionNote),
    available: row.available === true,
    version: numberValue(row.version),
    averageUnitCost: nullableNumber(row.averageUnitCost),
  }
}

function backendFeeds(value: unknown): FeedCatalogueItem[] {
  return asRows(value).map(backendFeed)
}

function backendSupplier(value: unknown): FeedSupplier {
  const row = asRecord(value)
  return {
    id: numberValue(row.id),
    name: textValue(row.name),
    phone: textValue(row.phone),
    area: textValue(row.area),
    note: textValue(row.note),
    active: textValue(row.status) === 'ACTIVE',
    version: numberValue(row.version),
    seller: row.seller === true,
    buyer: row.buyer === true,
  }
}

function backendSuppliers(value: unknown): FeedSupplier[] {
  return asRows(value).filter((row) => row.supplier === true).map(backendSupplier)
}

function requireExpectedVersion(value: number | undefined, entity: string): number {
  if (!Number.isInteger(value) || value! < 0) {
    throw new Error(`Thiếu phiên bản hiện tại của ${entity}. Vui lòng tải lại danh sách rồi thử lại.`)
  }
  return value!
}

function feedRequest(input: FeedCatalogueSaveInput, expectedVersion?: number) {
  const purchaseUnit = input.purchaseUnit.trim()
  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    feedGroup: input.group,
    purchaseUnit: purchaseUnit || null,
    kgPerPurchaseUnit: purchaseUnit ? input.kgPerPurchaseUnit : null,
    minimumStockKg: input.minimumStockKg,
    nutritionNote: input.nutritionNote.trim(),
    available: input.available,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  }
}

export function createFeedCatalogueApi({
  mode,
  farmId,
  transport,
  demoStore = lazyObject(() => demo.feedReceipt.feedCatalogueDemoStore),
}: {
  mode: BackendMode
  farmId: string | number | null
  transport: BackendTransport
  demoStore?: FeedCatalogueDemoStore
}) {
  const listBackendFeeds = async () => backendFeeds(await transport.get(transport.farmPath(farmId, '/feed/catalogue')))
  const listBackendSuppliers = async (query: FeedSupplierQuery = {}) => {
    const params = new URLSearchParams({ role: 'SUPPLIER' })
    if (query.q?.trim()) params.set('q', query.q.trim())
    if (query.status) params.set('status', query.status)
    const path = transport.farmPath(farmId, `/trading-partners?${params.toString()}`)
    return backendSuppliers(await transport.get(path))
  }
  const saveBackendFeed = async (input: FeedCatalogueSaveInput, options: FeedCatalogueCommandOptions = {}): Promise<FeedCatalogueItem> => {
    const isUpdate = input.id !== undefined
    const expectedVersion = isUpdate ? requireExpectedVersion(input.expectedVersion, 'thức ăn') : undefined
    const path = transport.farmPath(farmId, isUpdate ? `/feed/catalogue/${input.id}` : '/feed/catalogue')
    const response = await transport.command(path, feedRequest(input, expectedVersion), commandOptions(isUpdate ? 'PUT' : 'POST', options))
    return backendFeed(response)
  }

  return {
    async listFeeds(): Promise<FeedCatalogueItem[]> {
      if (mode === 'backend') return listBackendFeeds()
      return demoStore.listFeeds()
    },
    async saveFeed(input: FeedCatalogueSaveInput, options: FeedCatalogueCommandOptions = {}): Promise<FeedCatalogueItem> {
      if (mode !== 'backend') {
        const localInput: FeedCatalogueInput = {
          code: input.code,
          name: input.name,
          group: input.group,
          purchaseUnit: input.purchaseUnit.trim() || 'kg',
          kgPerPurchaseUnit: input.purchaseUnit.trim() ? input.kgPerPurchaseUnit ?? 1 : 1,
          minimumStockKg: input.minimumStockKg ?? 0,
          nutritionNote: input.nutritionNote,
          available: input.available,
          ...(input.id === undefined ? {} : { id: input.id }),
        }
        return demoStore.saveFeed(localInput)
      }
      return saveBackendFeed(input, options)
    },
    async setFeedAvailable(id: number, available: boolean, expectedVersion?: number, options: FeedCatalogueCommandOptions = {}): Promise<FeedCatalogueItem> {
      if (mode !== 'backend') return demoStore.setFeedAvailable(id, available)
      const current = (await listBackendFeeds()).find((item) => item.id === id)
      if (!current) throw new Error('Không tìm thấy thức ăn trong danh mục hiện tại.')
      return saveBackendFeed({
        ...current,
        id,
        expectedVersion: requireExpectedVersion(expectedVersion ?? current.version, 'thức ăn'),
        available,
      }, options)
    },
    async listSuppliers(query: FeedSupplierQuery = {}): Promise<FeedSupplier[]> {
      if (mode === 'backend') return listBackendSuppliers(query)
      const rows = await demoStore.listSuppliers()
      const q = query.q?.trim().toLocaleLowerCase()
      return rows.filter((supplier) => (!query.status || (supplier.active ? 'ACTIVE' : 'INACTIVE') === query.status)
        && (!q || `${supplier.name} ${supplier.phone} ${supplier.area}`.toLocaleLowerCase().includes(q)))
    },
    async saveSupplier(input: FeedSupplierInput, options: FeedCatalogueCommandOptions = {}): Promise<FeedSupplier> {
      if (mode !== 'backend') return demoStore.saveSupplier(input)
      if (input.active !== undefined) throw new Error('Trạng thái nhà cung cấp được đổi riêng qua thao tác kích hoạt/ngừng.')
      const isUpdate = input.id !== undefined
      const expectedVersion = isUpdate ? requireExpectedVersion(input.expectedVersion, 'nhà cung cấp') : undefined
      const current = isUpdate && (input.seller === undefined || input.buyer === undefined)
        ? (await listBackendSuppliers()).find((supplier) => supplier.id === input.id)
        : undefined
      if (isUpdate && (input.seller === undefined || input.buyer === undefined) && !current) {
        throw new Error('Không tìm thấy nhà cung cấp trong danh mục hiện tại.')
      }
      const path = transport.farmPath(farmId, isUpdate ? `/trading-partners/${input.id}` : '/trading-partners')
      const response = await transport.command(path, {
        name: input.name.trim(),
        seller: input.seller ?? current?.seller ?? false,
        buyer: input.buyer ?? current?.buyer ?? false,
        supplier: true,
        phone: input.phone.trim(),
        area: input.area.trim(),
        note: input.note.trim(),
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      }, commandOptions(isUpdate ? 'PUT' : 'POST', options))
      return backendSupplier(response)
    },
    async setSupplierActive(id: number, active: boolean, expectedVersion?: number, options: FeedCatalogueCommandOptions = {}): Promise<FeedSupplier> {
      if (mode !== 'backend') return demoStore.setSupplierActive(id, active)
      const current = expectedVersion === undefined
        ? (await listBackendSuppliers()).find((supplier) => supplier.id === id)
        : undefined
      const version = requireExpectedVersion(expectedVersion ?? current?.version, 'nhà cung cấp')
      const path = transport.farmPath(farmId, `/trading-partners/${id}/status`)
      const response = await transport.command(path, { status: active ? 'ACTIVE' : 'INACTIVE', expectedVersion: version }, commandOptions('PATCH', options))
      return backendSupplier(response)
    },
  }
}

const api = createFeedCatalogueApi({ mode: backendMode, farmId: activeFarmId, transport: backendTransport })

export const listFeedCatalogue = () => api.listFeeds()
export const saveFeedCatalogueItem = (input: FeedCatalogueSaveInput, options?: FeedCatalogueCommandOptions) => api.saveFeed(input, options)
export const setFeedCatalogueAvailability = (id: number, available: boolean, expectedVersion?: number, options?: FeedCatalogueCommandOptions) => api.setFeedAvailable(id, available, expectedVersion, options)
export const listFeedSuppliers = (query?: FeedSupplierQuery) => api.listSuppliers(query)
export const saveFeedSupplier = (input: FeedSupplierInput, options?: FeedCatalogueCommandOptions) => api.saveSupplier(input, options)
export const setFeedSupplierActive = (id: number, active: boolean, expectedVersion?: number, options?: FeedCatalogueCommandOptions) => api.setSupplierActive(id, active, expectedVersion, options)
