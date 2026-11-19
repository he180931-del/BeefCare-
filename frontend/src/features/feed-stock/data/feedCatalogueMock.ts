import type { FeedCatalogueItem } from '../types/feedCatalogue'

/** Catalogue rows from the Danh mục frame; unitCost is the weighted average cost per kg (Giá BQ). */
export const FEED_CATALOGUE_MOCK: Array<FeedCatalogueItem & { unitCost: number }> = [
  { id: 101, code: 'TA-01', name: 'Cỏ voi', group: 'GREEN_ROUGHAGE', stockUnit: 'kg', purchaseUnit: 'kg', kgPerPurchaseUnit: 1, minimumStockKg: 1500, nutritionNote: 'Thô xanh cắt tươi từ HTX cỏ Ba Vì', available: true, version: 3, unitCost: 700 },
  { id: 102, code: 'TA-02', name: 'Rơm khô', group: 'DRY_ROUGHAGE', stockUnit: 'kg', purchaseUnit: 'Cuộn', kgPerPurchaseUnit: 20, minimumStockKg: 1000, nutritionNote: 'Rơm cuộn ~20 kg', available: true, version: 1, unitCost: 1000 },
  { id: 103, code: 'TA-03', name: 'Cỏ non', group: 'GREEN_ROUGHAGE', stockUnit: 'kg', purchaseUnit: 'kg', kgPerPurchaseUnit: 1, minimumStockKg: 50, nutritionNote: 'Dùng cho bê tập ăn', available: true, version: 1, unitCost: 1000 },
  { id: 104, code: 'TA-04', name: 'Thức ăn TMR', group: 'TMR', stockUnit: 'kg', purchaseUnit: 'Bao', kgPerPurchaseUnit: 40, minimumStockKg: 1000, nutritionNote: 'Hỗn hợp hoàn chỉnh cho vỗ béo', available: true, version: 2, unitCost: 3800 },
  { id: 105, code: 'TA-05', name: 'Cám hỗn hợp', group: 'CONCENTRATE', stockUnit: 'kg', purchaseUnit: 'Bao', kgPerPurchaseUnit: 25, minimumStockKg: 500, nutritionNote: 'Đạm 16%', available: true, version: 4, unitCost: 11600 },
  { id: 106, code: 'TA-06', name: 'Cám ngô', group: 'CONCENTRATE', stockUnit: 'kg', purchaseUnit: 'Bao', kgPerPurchaseUnit: 25, minimumStockKg: 250, nutritionNote: 'Năng lượng cao, dùng cho vỗ béo giai đoạn cuối', available: true, version: 2, unitCost: 6600 },
  { id: 107, code: 'TA-07', name: 'Khoáng premix', group: 'MINERAL_ADDITIVE', stockUnit: 'kg', purchaseUnit: 'Bao', kgPerPurchaseUnit: 5, minimumStockKg: 10, nutritionNote: 'Khoáng vi lượng, vitamin', available: true, version: 1, unitCost: 39000 },
  { id: 108, code: 'TA-08', name: 'Sữa thay thế', group: 'CALF_FEED', stockUnit: 'kg', purchaseUnit: 'Bao', kgPerPurchaseUnit: 20, minimumStockKg: 5, nutritionNote: 'Sữa bột cho bê', available: true, version: 1, unitCost: 36000 },
]

export const FEED_UNIT_COST = new Map(FEED_CATALOGUE_MOCK.map((item) => [item.id, item.unitCost]))
