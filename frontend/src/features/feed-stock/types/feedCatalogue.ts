import type { FeedGroup } from '../types'

export type FeedCatalogueItem = {
  id: number
  code: string
  name: string
  group: FeedGroup | string
  stockUnit: string
  purchaseUnit: string
  kgPerPurchaseUnit: number | null
  minimumStockKg: number | null
  nutritionNote: string
  available: boolean
  version: number
  /** FeedItemView.averageUnitCost: weighted average cost per kg, when the source provides it. */
  averageUnitCost?: number | null
}

/** Local demo-store input remains numeric; the SRS/backend form may leave both values unset. */
export type FeedCatalogueInput = Omit<FeedCatalogueItem, 'id' | 'stockUnit' | 'version' | 'averageUnitCost' | 'kgPerPurchaseUnit' | 'minimumStockKg'> & {
  id?: number
  kgPerPurchaseUnit: number
  minimumStockKg: number
}

/** User-facing input for both create and update, with backend expectedVersion on updates. */
export type FeedCatalogueSaveInput = Omit<FeedCatalogueItem, 'id' | 'stockUnit' | 'version' | 'averageUnitCost'> & {
  id?: number
  expectedVersion?: number
}

export type FeedSupplier = {
  id: number
  name: string
  phone: string
  area: string
  note: string
  active: boolean
  version: number
  /** TradingPartner roles are preserved when a supplier record has more than one role. */
  seller?: boolean
  buyer?: boolean
}

export type FeedSupplierInput = Omit<FeedSupplier, 'id' | 'active' | 'version'> & { id?: number; active?: boolean; expectedVersion?: number }

export type FeedCatalogueDemoStore = {
  listFeeds: () => Promise<FeedCatalogueItem[]>
  saveFeed: (input: FeedCatalogueInput) => Promise<FeedCatalogueItem>
  setFeedAvailable: (id: number, available: boolean) => Promise<FeedCatalogueItem>
  listSuppliers: () => Promise<FeedSupplier[]>
  saveSupplier: (input: FeedSupplierInput) => Promise<FeedSupplier>
  setSupplierActive: (id: number, active: boolean) => Promise<FeedSupplier>
  reset: () => Promise<void>
}
