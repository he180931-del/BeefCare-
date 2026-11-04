import { expandLocalTable, isStressGenerated } from '../../app/localStressData'
import { seedPens } from '../../data/pensData'
import type { FeedRation, FeedStockItem, FeedStore, FeedSupplier, FeedVoucher } from './feedStore'

const itemNames = [
  'Cỏ voi tươi',
  'Cỏ ủ chua',
  'Rơm cuộn',
  'Cám hỗn hợp bò thịt',
  'Bã bia ủ',
  'Bột ngô',
  'Khô dầu đậu tương',
  'Khoáng liếm',
]
const supplierNames = ['HTX Nông nghiệp Ba Vì', 'Công ty Dinh dưỡng Việt', 'Trang trại xanh Mộc Châu', 'Nông sản Tây Bắc']
const warehouses = ['Kho thức ăn A', 'Kho thức ăn B']

function stressIndex(value: unknown) {
  return isStressGenerated(value) ? Number(value.__stressIndex || 0) : -1
}

export function previewFeedStock(rows: FeedStockItem[]) {
  return expandLocalTable('feed-stock', rows).map((row) => {
    const index = stressIndex(row)
    if (index < 0) return row
    const stockKg = 24 + ((index * 37) % 1480)
    const minimumKg = 80 + ((index * 13) % 240)
    const warehouse = warehouses[index % warehouses.length]
    const code = `TA-${String(index + 1).padStart(3, '0')}`
    const name = itemNames[index % itemNames.length]
    const expiryDate = `2026-${String(11 + Math.floor((index % 45) / 30)).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`
    return {
      ...row,
      id: `feed-preview-${index + 1}`,
      code,
      name: `${name} · lô ${String(index + 1).padStart(2, '0')}`,
      warehouse,
      warehouseQuantities: { [warehouse]: stockKg },
      stockKg,
      minimumKg,
      averageCost: 1_800 + ((index * 925) % 15_000),
      averageDailyUseKg: 5 + (index % 70),
      lots: [{ id: `lot-preview-${index + 1}`, code: `LOT-${String(index + 1).padStart(4, '0')}`, expiryDate, warehouse, quantityKg: stockKg }],
      nearExpiryLot: `LOT-${String(index + 1).padStart(4, '0')}`,
      nearExpiryDate: expiryDate,
      version: 1,
    }
  })
}

export function previewFeedSuppliers(rows: FeedSupplier[]) {
  return expandLocalTable('feed-suppliers', rows).map((row) => {
    const index = stressIndex(row)
    if (index < 0) return row
    return {
      ...row,
      id: `supplier-preview-${index + 1}`,
      code: `NCC-${String(index + 1).padStart(3, '0')}`,
      name: `${supplierNames[index % supplierNames.length]} ${String(index + 1).padStart(2, '0')}`,
      contact: `09${String(10000000 + index * 7919).slice(-8)}`,
      area: index % 2 ? 'Hà Nội' : 'Ba Vì',
      taxCode: String(3100000000 + index),
      status: index % 11 === 0 ? 'INACTIVE' as const : 'ACTIVE' as const,
      version: 1,
    }
  })
}

export function previewFeedVouchers(rows: FeedVoucher[]) {
  return expandLocalTable('feed-vouchers', rows).map((row) => {
    const index = stressIndex(row)
    if (index < 0) return row
    const totalKg = 120 + ((index * 47) % 1_880)
    const unitPrice = 2_100 + ((index * 317) % 12_000)
    const goodsAmount = totalKg * unitPrice
    const transportFee = (index % 4) * 50_000
    const totalAmount = goodsAmount + transportFee
    const paid = index % 5 === 0 ? Math.round(totalAmount * 0.6) : totalAmount
    const november = index % 2 === 1
    const date = `2026-${november ? '11' : '10'}-${String(november ? (index % 5) + 1 : (index % 28) + 1).padStart(2, '0')}`
    const feedName = itemNames[index % itemNames.length]
    return {
      ...row,
      id: `feed-voucher-preview-${index + 1}`,
      code: `PNK-2026-${String(index + 1).padStart(4, '0')}`,
      status: 'POSTED' as const,
      date,
      supplier: supplierNames[index % supplierNames.length],
      invoiceNo: `HD-${String(index + 1).padStart(5, '0')}`,
      storageLocation: warehouses[index % warehouses.length],
      lines: [{
        id: `feed-line-preview-${index + 1}`,
        feedId: `feed-preview-${index + 1}`,
        feedCode: `TA-${String(index + 1).padStart(3, '0')}`,
        feedName,
        lotNo: `LOT-${String(index + 1).padStart(4, '0')}`,
        expiryDate: '2027-04-30',
        quantity: totalKg,
        unit: 'KG' as const,
        conversionKg: 1,
        quantityKg: totalKg,
        unitPrice,
        amount: goodsAmount,
      }],
      totalKg,
      goodsAmount,
      transportFee,
      totalAmount,
      paid,
      outstanding: totalAmount - paid,
      paymentMethod: 'BANK' as const,
      payments: paid > 0 ? [{ id: `payment-preview-${index + 1}`, date, amount: paid, method: 'BANK' as const, reference: `CK-${String(index + 1).padStart(5, '0')}`, status: 'ACTIVE' as const, recordedBy: 'Chủ trại' }] : [],
      history: [`${date} · Ghi sổ và cộng kho`],
      version: 1,
    }
  })
}

export function previewFeedStore(store: FeedStore): FeedStore {
  return {
    ...store,
    stock: previewFeedStock(store.stock),
    suppliers: previewFeedSuppliers(store.suppliers),
    vouchers: previewFeedVouchers(store.vouchers),
  }
}

function rationTemplates(store: FeedStore): FeedRation[] {
  if (store.rations.length) return store.rations
  const feeds = store.stock.filter((item) => item.status === 'ACTIVE').slice(0, 2)
  const pen = seedPens.find((item) => item.status === 'ACTIVE') || seedPens[0]
  if (!feeds.length || !pen) return []
  return [{
    id: 'ration-preview-base',
    code: 'KP-001',
    name: 'Khẩu phần bò nuôi thịt',
    version: 1,
    herdGroup: 'Fattening',
    penIds: [pen.code],
    penNames: [pen.name],
    headcount: pen.count,
    sessions: [{ type: 'MORNING', time: '06:30' }, { type: 'AFTERNOON', time: '16:30' }],
    components: feeds.map((feed, index) => ({ feedId: feed.id, feedCode: feed.code, feedName: feed.name, kgPerHead: index ? [0.6, 0.5] : [3.2, 2.8] })),
    effectiveFrom: '2026-10-01',
    effectiveTo: '2027-03-31',
    basis: 'Khẩu phần mô phỏng phục vụ duyệt giao diện',
    status: 'EFFECTIVE',
    history: ['2026-10-01 · Bắt đầu áp dụng'],
    updatedAt: '2026-11-03T07:00:00.000Z',
  }]
}

export function previewFeedRations(store: FeedStore) {
  return expandLocalTable('feed-rations', rationTemplates(store)).map((row) => {
    const index = stressIndex(row)
    if (index < 0) return row
    const pen = seedPens[index % seedPens.length]
    return {
      ...row,
      id: `ration-preview-${index + 1}`,
      code: `KP-${String(index + 1).padStart(3, '0')}`,
      name: `Khẩu phần ${pen?.name || `chuồng ${index + 1}`}`,
      penIds: [pen?.code || `P${index + 1}`],
      penNames: [pen?.name || `Chuồng ${index + 1}`],
      headcount: pen?.count || 12 + (index % 30),
      version: (index % 4) + 1,
      status: index % 7 === 0 ? 'SCHEDULED' as const : 'EFFECTIVE' as const,
      effectiveFrom: index % 7 === 0 ? '2026-11-10' : '2026-10-01',
    }
  })
}
