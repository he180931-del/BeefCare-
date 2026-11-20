// Input validation moved out of src/features/platform-service/domain/pricing.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { PriceVersion } from '../types'
import { fmtDateTime } from '../domain/dates'
import { PAST_ERROR } from '../domain/pricing'

export function validateEffective(mode: 'NOW' | 'SCHEDULE', effectiveAt: string, now: string, versions: PriceVersion[]) {
  if (mode === 'NOW') return null
  if (!effectiveAt) return 'Thời điểm hiệu lực là bắt buộc.'
  const at = effectiveAt.length === 16 ? `${effectiveAt}:00` : effectiveAt
  if (at < now) return PAST_ERROR
  const clash = versions.find((v) => !v.withdrawn && v.effectiveAt === at)
  if (clash) return `Phiên bản v${clash.version} đã được lên lịch vào ${fmtDateTime(at)}.`
  return null
}
