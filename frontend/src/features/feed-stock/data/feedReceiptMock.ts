import type { FeedReceipt } from '../types/feedReceipt'

// Synthetic local-demo rows shaped after ReceiptView; none represent live farm data.
const now = new Date()
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const currentMonth = iso(now)
const previousMonth = iso(new Date(now.getFullYear(), now.getMonth() - 1, 15))
const olderMonth = iso(new Date(now.getFullYear(), now.getMonth() - 2, 15))
const year = now.getFullYear()

export const FEED_RECEIPT_MOCK: FeedReceipt[] = [
  {
    id: 8101,
    code: `PNK-${year}-0001`,
    receiptDate: currentMonth,
    supplierId: 202,
    supplierName: 'Công ty Thức ăn Xanh',
    status: 'POSTED',
    goodsAmount: 5_000_000,
    transportFee: 100_000,
    totalPayable: 5_100_000,
    version: 1,
    lines: [
      {
        id: 9101,
        feedItemId: 101,
        feedCode: 'TA-01',
        feedName: 'Bắp ủ chua',
        lotNumber: 'LO-DEMO-01',
        expiryDate: '2026-12-15',
        quantityPurchase: 300,
        purchaseUnit: 'kg',
        kgReceived: 300,
        unitPrice: 10_000,
        lineAmount: 3_000_000,
      },
      {
        id: 9102,
        feedItemId: 102,
        feedCode: 'TA-02',
        feedName: 'Cám hỗn hợp bò thịt',
        lotNumber: null,
        expiryDate: null,
        quantityPurchase: 200,
        purchaseUnit: 'kg',
        kgReceived: 200,
        unitPrice: 10_000,
        lineAmount: 2_000_000,
      },
    ],
  },
  {
    id: 8102,
    code: `PNK-${year}-0002`,
    receiptDate: previousMonth,
    supplierId: 201,
    supplierName: 'Nông sản Ba Vì',
    status: 'DRAFT',
    goodsAmount: 1_200_000,
    transportFee: 0,
    totalPayable: 1_200_000,
    version: 0,
    lines: [
      {
        id: 9103,
        feedItemId: 101,
        feedCode: 'TA-01',
        feedName: 'Bắp ủ chua',
        lotNumber: 'LO-DEMO-02',
        expiryDate: '2027-01-15',
        quantityPurchase: 120,
        purchaseUnit: 'kg',
        kgReceived: 120,
        unitPrice: 10_000,
        lineAmount: 1_200_000,
      },
    ],
  },
  {
    id: 8103,
    code: `PNK-${year}-0003`,
    receiptDate: olderMonth,
    supplierId: 202,
    supplierName: 'Công ty Thức ăn Xanh',
    status: 'VOIDED',
    goodsAmount: 2_400_000,
    transportFee: 50_000,
    totalPayable: 2_450_000,
    version: 2,
    lines: [
      {
        id: 9104,
        feedItemId: 102,
        feedCode: 'TA-02',
        feedName: 'Cám hỗn hợp bò thịt',
        lotNumber: null,
        expiryDate: null,
        quantityPurchase: 240,
        purchaseUnit: 'kg',
        kgReceived: 240,
        unitPrice: 10_000,
        lineAmount: 2_400_000,
      },
    ],
  },
]
