import type { FeedGroup } from '../types'

export type FeedCatalogueItem = {
  id: number
  code: string
  name: string
  group: FeedGroup | string
  stockUnit: string
  purchaseUnit: string
  kgPerPurchaseUnit: number
  minimumStockKg: number
  nutritionNote: string
  available: boolean
  version: number
}

export type FeedCatalogueInput = Omit<FeedCatalogueItem, 'id' | 'stockUnit' | 'version'> & { id?: number }

export type FeedSupplier = {
  id: number
  name: string
  phone: string
  area: string
  note: string
  active: boolean
  version: number
}

export type FeedSupplierInput = Omit<FeedSupplier, 'id' | 'active' | 'version'> & { id?: number; active?: boolean }

export type FeedCatalogueDemoStore = {
  listFeeds: () => Promise<FeedCatalogueItem[]>
  saveFeed: (input: FeedCatalogueInput) => Promise<FeedCatalogueItem>
  setFeedAvailable: (id: number, available: boolean) => Promise<FeedCatalogueItem>
  listSuppliers: () => Promise<FeedSupplier[]>
  saveSupplier: (input: FeedSupplierInput) => Promise<FeedSupplier>
  setSupplierActive: (id: number, active: boolean) => Promise<FeedSupplier>
  reset: () => Promise<void>
}
