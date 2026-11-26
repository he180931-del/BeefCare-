import { businessDate } from '../../../shared/lib/date/farmTime'
import type { FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedRation } from '../types/feedRation'

export type QuantityComparison = {
  state: 'planned-vs-actual' | 'actual-only'
  varianceKg: number | null
  variancePct: number | null
}

/** Keeps print labels honest when a line was recorded outside the ration. */
export function comparePlannedActual(plannedKg: number, actualKg: number, inRation: boolean | null = true): QuantityComparison {
  if (inRation === false || plannedKg <= 0) return { state: 'actual-only', varianceKg: null, variancePct: null }
  const varianceKg = Math.round((actualKg - plannedKg) * 100) / 100
  return {
    state: 'planned-vs-actual',
    varianceKg,
    variancePct: plannedKg === 0 ? null : Math.round((varianceKg / plannedKg) * 10000) / 100,
  }
}

export function rationPrintState(row: Pick<FeedRation, 'status' | 'effectiveFrom' | 'effectiveTo'>, today = businessDate()) {
  if (row.status === 'CANCELLED') return { code: 'cancelled' as const, label: 'Đã hủy', detail: 'Phiên bản đã hủy, không dùng để lập kế hoạch.' }
  if (row.effectiveFrom > today || row.status === 'SCHEDULED') {
    return { code: 'future' as const, label: 'Sắp áp dụng', detail: `Chưa hiệu lực đến ${row.effectiveFrom}.` }
  }
  if (row.status === 'ENDED' || (row.effectiveTo !== null && row.effectiveTo < today)) {
    return { code: 'ended' as const, label: 'Đã kết thúc', detail: 'Phiên bản chỉ được giữ để tra cứu lịch sử.' }
  }
  return { code: 'effective' as const, label: 'Đang áp dụng', detail: 'Phiên bản đang có hiệu lực theo dữ liệu đã lưu.' }
}

export type FeedingPrintState = 'valid' | 'voided' | 'missing' | 'no-ration'

export function feedingRecordPrintState(record: FeedFeedingRecord | null, hasRation: boolean): FeedingPrintState {
  if (!hasRation) return 'no-ration'
  if (!record) return 'missing'
  if (record.status === 'VOIDED') return 'voided'
  if (record.status !== 'VALID') return 'missing'
  return 'valid'
}

export function feedingRecordStatusLabel(record: FeedFeedingRecord) {
  if (record.status === 'VOIDED') return 'Đã hủy'
  if (record.status === 'VALID') return 'Hợp lệ'
  return record.status || 'Không xác định'
}

export function revisionActionLabel(action: string) {
  return action === 'VOIDED' || action === 'VOID' ? 'Hủy bản ghi' : 'Sửa bản ghi'
}
