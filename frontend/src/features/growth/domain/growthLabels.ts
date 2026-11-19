import type { GrowthBasis, GrowthHerdStatus, GrowthMethod } from '../types'

export const METHOD_LABEL: Record<GrowthMethod, string> = { SCALE: 'Cân điện tử', TAPE: 'Thước dây', ESTIMATE: 'Ước tính khác' }
export const BASIS_LABEL: Record<GrowthBasis, string> = { MEASURED: 'thực tế', ESTIMATED: 'ước tính' }
export const STATUS_LABEL: Record<GrowthHerdStatus, string> = { OVERDUE: 'Quá hạn cân', LOW_ADG: 'ADG thấp', LOW_BCS: 'BCS thấp', NORMAL: 'Bình thường' }
