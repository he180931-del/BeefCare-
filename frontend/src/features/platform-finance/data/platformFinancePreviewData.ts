import { expandLocalTable, isStressGenerated, type StressGeneratedRow } from '../../../app/localStressData'
import type { ReceiptRecord } from '../platformFinanceStore'

export type ReceiptPreviewRow = ReceiptRecord & StressGeneratedRow

/**
 * Creates read-only receipt rows for density and responsive review. Generated
 * rows remain outside the finance store and must never be used as a mutation
 * or reconciliation source.
 */
export function previewReceipts(rows: ReceiptRecord[]): ReceiptPreviewRow[] {
  return expandLocalTable('platform-finance-receipts', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = (row.__stressIndex ?? index) + 1
    const suffix = String(value).padStart(3, '0')
    const day = String((value % 28) + 1).padStart(2, '0')
    const month = String((value % 10) + 1).padStart(2, '0')
    const bankDate = `2026-${month}-${day}`
    return {
      ...row,
      id: `preview-receipt-${suffix}`,
      receiptCode: `BR-PREVIEW-${suffix}`,
      paymentCode: `PAY-PREVIEW-${suffix}`,
      paymentIntentId: `preview-intent-${suffix}`,
      farmId: `preview-farm-${suffix}`,
      farmName: `Trang trại mô phỏng ${suffix}`,
      termYears: value % 3 === 0 ? 3 : value % 2 === 0 ? 2 : 1,
      amount: 900_000 + (value % 12) * 125_000,
      bankDate,
      bankPaidAt: `${bankDate}T02:30:00.000Z`,
      confirmedAt: `${bankDate}T02:35:00.000Z`,
      periodStart: bankDate,
      periodEnd: `${2026 + (value % 3 === 0 ? 3 : value % 2 === 0 ? 2 : 1)}-${month}-${day}`,
      priceVersion: `PV-2026.${(value % 4) + 1}`,
      evidenceCode: `sao-ke-mo-phong-${suffix}.pdf`,
      sourceReconciliationId: `preview-reconciliation-${suffix}`,
      sourceProvider: 'Ngân hàng mô phỏng',
      sourceAccount: `0123456${suffix}`,
      sourceTransferContent: `BEEFCARE PAY-PREVIEW-${suffix}`,
    }
  })
}
