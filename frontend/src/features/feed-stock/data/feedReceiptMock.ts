import type { FeedReceipt, FeedReceiptLine } from '../types/feedReceipt'
import { daysFromToday } from './feedDemoDates'

// Synthetic local-demo rows shaped after ReceiptView; amounts and lots follow the receipt frames.
let lineId = 9100
function line(feedItemId: number, feedCode: string, feedName: string, quantityPurchase: number, purchaseUnit: string, kgPerUnit: number, unitPrice: number, lot: [string, number] | null): FeedReceiptLine {
  return {
    id: ++lineId,
    feedItemId,
    feedCode,
    feedName,
    lotNumber: lot ? lot[0] : null,
    expiryDate: lot ? daysFromToday(lot[1]) : null,
    quantityPurchase,
    purchaseUnit,
    kgReceived: quantityPurchase * kgPerUnit,
    unitPrice,
    lineAmount: Math.round(quantityPurchase * unitPrice),
  }
}

function receipt(id: number, code: string, daysAgo: number, supplierId: number, supplierName: string, status: string, transportFee: number, version: number, lines: FeedReceiptLine[]): FeedReceipt {
  const goodsAmount = lines.reduce((sum, row) => sum + row.lineAmount, 0)
  return { id, code, receiptDate: daysFromToday(-daysAgo), supplierId, supplierName, status, goodsAmount, transportFee, totalPayable: goodsAmount + transportFee, version, lines }
}

export const FEED_RECEIPT_MOCK: FeedReceipt[] = [
  receipt(8131, 'PNK-2026-0031', 0, 201, 'Đại lý TACN Hưng Thịnh – Sơn Tây', 'DRAFT', 300_000, 0, [
    line(105, 'TA-05', 'Cám hỗn hợp', 20, 'Bao', 25, 290_000, ['L2410', 85]),
    line(106, 'TA-06', 'Cám ngô', 40, 'Bao', 25, 165_000, ['L1022', 59]),
    line(107, 'TA-07', 'Khoáng premix', 50, 'kg', 1, 39_000, ['PM-0811', 250]),
  ]),
  receipt(8130, 'PNK-2026-0030', 4, 202, 'HTX cỏ Ba Vì', 'POSTED', 0, 1, [line(101, 'TA-01', 'Cỏ voi', 6000, 'kg', 1, 700, null)]),
  receipt(8129, 'PNK-2026-0029', 12, 203, 'Công ty TMR Việt Phát', 'POSTED', 0, 1, [line(104, 'TA-04', 'Thức ăn TMR', 125, 'Bao', 40, 152_000, ['L0922', 8])]),
  receipt(8128, 'PNK-2026-0028', 20, 202, 'HTX cỏ Ba Vì', 'POSTED', 0, 1, [
    line(101, 'TA-01', 'Cỏ voi', 5000, 'kg', 1, 700, null),
    line(103, 'TA-03', 'Cỏ non', 400, 'kg', 1, 1000, null),
  ]),
  receipt(8127, 'PNK-2026-0027', 35, 201, 'Đại lý TACN Hưng Thịnh – Sơn Tây', 'VOIDED', 0, 2, [line(105, 'TA-05', 'Cám hỗn hợp', 40, 'Bao', 25, 290_000, null)]),
  receipt(8126, 'PNK-2026-0026', 35, 201, 'Đại lý TACN Hưng Thịnh – Sơn Tây', 'POSTED', 0, 1, [
    line(105, 'TA-05', 'Cám hỗn hợp', 40, 'Bao', 25, 290_000, ['L2409', 14]),
    line(108, 'TA-08', 'Sữa thay thế', 50, 'kg', 1, 31_000, null),
  ]),
]

/** Local-only receipt fields (not in ReceiptView): invoice, receiver, payments and the void reason. */
export const FEED_RECEIPT_DEMO_EXTRAS: Record<number, { invoiceNumber: string; receivedBy: string; storageLocation: string; note: string; amountPaid: number; paymentMethod: 'CASH' | 'BANK_TRANSFER' | null; balanceDueDays: number | null; voidReason?: string }> = {
  8131: { invoiceNumber: 'HĐ 0004521', receivedBy: 'Trần Quốc Long', storageLocation: 'Kho cám – dãy A', note: 'Giao đủ, bao còn nguyên, kiểm tra cảm quan đạt', amountPaid: 10_000_000, paymentMethod: 'CASH', balanceDueDays: 14 },
  8130: { invoiceNumber: 'Phiếu giao 1810', receivedBy: 'Trần Quốc Long', storageLocation: 'Bãi cỏ', note: '', amountPaid: 4_200_000, paymentMethod: 'BANK_TRANSFER', balanceDueDays: null },
  8129: { invoiceNumber: 'HĐ 0001188', receivedBy: 'Trần Quốc Long', storageLocation: 'Kho TMR', note: '', amountPaid: 16_500_000, paymentMethod: 'BANK_TRANSFER', balanceDueDays: 5 },
  8128: { invoiceNumber: 'Phiếu giao 0210', receivedBy: 'Lê Thị Mai', storageLocation: 'Bãi cỏ', note: '', amountPaid: 3_900_000, paymentMethod: 'CASH', balanceDueDays: null },
  8127: { invoiceNumber: '', receivedBy: 'Trần Quốc Long', storageLocation: 'Kho cám – dãy A', note: '', amountPaid: 0, paymentMethod: null, balanceDueDays: null, voidReason: 'nhập trùng PNK-0026' },
  8126: { invoiceNumber: 'HĐ 0004390', receivedBy: 'Trần Quốc Long', storageLocation: 'Kho cám – dãy A', note: '', amountPaid: 13_150_000, paymentMethod: 'CASH', balanceDueDays: null },
}
