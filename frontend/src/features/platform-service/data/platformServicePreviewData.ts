import { expandLocalTable, isStressGenerated, type StressGeneratedRow } from '../../../app/localStressData'
import type { FarmSubscription } from '../../subscription/subscriptionStore'
import type { ServicePeriod } from '../platformServiceStore'

export interface ServiceCoveragePreviewRow {
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
export function previewServiceCoverage(rows: ServiceCoveragePreviewRow[]) {
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
      coverage: selected?.status ?? 'NONE',
      periods,
    }
  })
}
