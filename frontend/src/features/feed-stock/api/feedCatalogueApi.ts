import { asRows, backendFarmId, backendMode, backendTransport, nullableNumber, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import type { FeedCatalogueDemoStore, FeedCatalogueInput, FeedCatalogueItem, FeedSupplier, FeedSupplierInput } from '../types/feedCatalogue'
import { feedCatalogueDemoStore } from '../data/feedReceiptDemoStore'

const backendMutationMessage = 'Tạo, sửa và đổi trạng thái danh mục hiện chỉ hoạt động trong bản demo.'

function backendFeeds(value: unknown): FeedCatalogueItem[] {
  return asRows(value).map((row) => ({
    id: numberValue(row.id),
    code: textValue(row.code),
    name: textValue(row.name),
    group: textValue(row.feedGroup),
    stockUnit: textValue(row.stockUnit, 'kg'),
    purchaseUnit: textValue(row.purchaseUnit),
    kgPerPurchaseUnit: numberValue(row.kgPerPurchaseUnit),
    minimumStockKg: numberValue(row.minimumStockKg),
    // The backend view does not currently expose nutritionNote.
    nutritionNote: '',
    available: row.available === true,
    version: numberValue(row.version),
    averageUnitCost: nullableNumber(row.averageUnitCost),
  }))
}

function backendSuppliers(value: unknown): FeedSupplier[] {
  return asRows(value)
    .filter((row) => row.supplier === true)
    .map((row) => ({
      id: numberValue(row.id),
      name: textValue(row.name),
      phone: textValue(row.phone),
      area: textValue(row.area),
      note: textValue(row.note),
      active: textValue(row.status) === 'ACTIVE',
      version: numberValue(row.version),
    }))
}

export function createFeedCatalogueApi({
  mode,
  farmId,
  transport,
  demoStore = feedCatalogueDemoStore,
}: {
  mode: BackendMode
  farmId: string | number
  transport: BackendTransport
  demoStore?: FeedCatalogueDemoStore
}) {
  return {
    async listFeeds(): Promise<FeedCatalogueItem[]> {
      if (mode === 'backend') return backendFeeds(await transport.get(transport.farmPath(farmId, '/feed/catalogue')))
      return demoStore.listFeeds()
    },
    async saveFeed(input: FeedCatalogueInput) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.saveFeed(input)
    },
    async setFeedAvailable(id: number, available: boolean) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.setFeedAvailable(id, available)
    },
    async listSuppliers(): Promise<FeedSupplier[]> {
      if (mode === 'backend') {
        const path = transport.farmPath(farmId, '/trading-partners?role=SUPPLIER')
        return backendSuppliers(await transport.get(path))
      }
      return demoStore.listSuppliers()
    },
    async saveSupplier(input: FeedSupplierInput) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.saveSupplier(input)
    },
    async setSupplierActive(id: number, active: boolean) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.setSupplierActive(id, active)
    },
  }
}

const api = createFeedCatalogueApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

export const listFeedCatalogue = () => api.listFeeds()
export const saveFeedCatalogueItem = (input: FeedCatalogueInput) => api.saveFeed(input)
export const setFeedCatalogueAvailability = (id: number, available: boolean) => api.setFeedAvailable(id, available)
export const listFeedSuppliers = () => api.listSuppliers()
export const saveFeedSupplier = (input: FeedSupplierInput) => api.saveSupplier(input)
export const setFeedSupplierActive = (id: number, active: boolean) => api.setSupplierActive(id, active)
