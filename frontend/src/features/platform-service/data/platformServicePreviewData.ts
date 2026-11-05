import { expandLocalTable, isStressGenerated, type StressGeneratedRow } from '../../../app/localStressData'
import type { FarmSubscription } from '../../subscription/subscriptionStore'
import type { PaymentIntent } from '../../subscription/subscriptionStore'
import type { PaymentReconciliation, ReconciliationStatus, ServicePeriod } from '../platformServiceStore'

export interface ServiceCoveragePreviewRow extends StressGeneratedRow {
  farm: FarmSubscription
  owner: string
  code: string
  current?: ServicePeriod
  future?: ServicePeriod
  selected?: ServicePeriod
  latest?: ServicePeriod
  renewalOpen?: string
  coverage: ServicePeriod['status'] | 'NONE'
  periods: ServicePeriod[]
}

function previewIndex(row: StressGeneratedRow, fallback: number) {
  return (row.__stressIndex ?? fallback) + 1
}

function copyPeriod(period: ServicePeriod | undefined, farmId: string, suffix: string) {
  if (!period) return undefined
  return {
    ...period,
    id: `${period.id.replace(/-L\d+$/, '')}-L${suffix}`,
    farmId,
    farmName: `Trang trại mô phỏng ${suffix}`,
    sourcePaymentId: period.sourcePaymentId ? `preview-payment-${suffix}` : undefined,
    sourcePaymentCode: period.sourcePaymentCode ? `PAY-PREVIEW-${suffix}` : undefined,
  }
}

/**
 * Expands the service register for density/responsive review only. Generated
 * rows never enter the subscription store and their domain actions stay locked.
 */
export function previewServiceCoverage(rows: ServiceCoveragePreviewRow[]): Array<ServiceCoveragePreviewRow & StressGeneratedRow> {
  return expandLocalTable('platform-service-coverage', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = previewIndex(row, index)
    const suffix = String(value).padStart(3, '0')
    const farmId = `preview-farm-${suffix}`
    const periods = row.periods.map((period) => copyPeriod(period, farmId, suffix) as ServicePeriod)
    const current = copyPeriod(row.current, farmId, suffix)
    const future = copyPeriod(row.future, farmId, suffix)
    const selected = copyPeriod(row.selected, farmId, suffix)
    const latest = copyPeriod(row.latest, farmId, suffix)
    const status: FarmSubscription['status'] = value % 11 === 0 ? 'SUSPENDED' : value % 7 === 0 ? 'EXPIRED' : value % 5 === 0 ? 'PENDING_PAYMENT' : 'ACTIVE'
    const coverage: ServiceCoveragePreviewRow['coverage'] = selected?.status ?? 'NONE'
    return {
      ...row,
      farm: {
        ...row.farm,
        id: farmId,
        name: `Trang trại mô phỏng ${suffix}`,
        status,
        suspendedSince: status === 'SUSPENDED' ? '2026-10-28' : undefined,
        pendingRequestCode: status === 'PENDING_PAYMENT' ? `PAY-PREVIEW-${suffix}` : undefined,
        periods,
      },
      owner: `Chủ trại mô phỏng ${suffix}`,
      code: `SUB-PREVIEW-${suffix}`,
      current,
      future,
      selected,
      latest,
      renewalOpen: row.renewalOpen ?? '01/10/2027',
      coverage,
      periods,
    }
  })
}

const reconciliationStatuses: ReconciliationStatus[] = ['PENDING', 'HOLD', 'ACCEPTED', 'REJECTED']

/** Visual-only bank evidence used to exercise long reconciliation queues. */
export function previewReconciliations(rows: PaymentReconciliation[]): Array<PaymentReconciliation & StressGeneratedRow> {
  return expandLocalTable('platform-service-reconciliation', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = previewIndex(row, index)
    const suffix = String(value).padStart(3, '0')
    const status = reconciliationStatuses[value % reconciliationStatuses.length]
    const farmId = `preview-farm-${suffix}`
    return {
      ...row,
      id: `preview-reconciliation-${suffix}`,
      paymentIntentId: `preview-intent-${suffix}`,
      farmId,
      farmName: `Trang trại mô phỏng ${suffix}`,
      amount: 900_000 + (value % 12) * 125_000,
      bankReference: `VCB-PREVIEW-${suffix}`,
      transferContent: `BEEFCARE PAY-PREVIEW-${suffix}`,
      evidenceRefs: [`sao-ke-mo-phong-${suffix}.pdf`],
      status,
      locked: status === 'ACCEPTED' || value % 9 === 0,
      matchResult: status === 'ACCEPTED' ? 'MATCHED' : value % 3 === 0 ? 'PARTIAL' : 'PENDING_MATCH',
      candidatePaymentId: status === 'ACCEPTED' ? `preview-intent-${suffix}` : undefined,
      decidedAt: status === 'ACCEPTED' || status === 'REJECTED' ? row.receivedAt : undefined,
      decidedBy: status === 'ACCEPTED' || status === 'REJECTED' ? 'Quản lý nền tảng' : undefined,
      history: row.history,
    }
  })
}

/** Visual-only payment requests. They are never passed to store mutation APIs. */
export function previewPaymentIntents(rows: PaymentIntent[]): Array<PaymentIntent & StressGeneratedRow> {
  return expandLocalTable('platform-service-payment-intents', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = previewIndex(row, index)
    const suffix = String(value).padStart(3, '0')
    const status: PaymentIntent['status'] = value % 5 === 0 ? 'EXPIRED' : value % 4 === 0 ? 'PAID' : 'PENDING'
    return {
      ...row,
      id: `preview-intent-${suffix}`,
      code: `PAY-PREVIEW-${suffix}`,
      farmId: `preview-farm-${suffix}`,
      farmName: `Trang trại mô phỏng ${suffix}`,
      amount: 900_000 + (value % 12) * 125_000,
      status,
      transferContent: `BEEFCARE PAY-PREVIEW-${suffix}`,
      confirmedAt: status === 'PAID' ? row.receivedAt ?? row.createdAt : undefined,
    }
  })
}
