import type { GrowthFilterOptions } from '../types'

/** Nhóm đàn và giai đoạn sống của bộ lọc cân nặng (nhãn theo enum backend). */
export const GROWTH_HERD_GROUPS: GrowthFilterOptions['herdGroups'] = [
  { value: 'CALVES', label: 'Bê' },
  { value: 'FATTENING', label: 'Vỗ béo' },
  { value: 'BREEDING_BULLS', label: 'Đực giống' },
  { value: 'BREEDING_FEMALES', label: 'Cái sinh sản' },
  { value: 'YOUNG_STOCK', label: 'Bò tơ' },
  { value: 'OTHER', label: 'Khác' },
]

export const GROWTH_LIFE_STAGES: GrowthFilterOptions['lifeStages'] = [
  { value: 'UNWEANED_CALF', label: 'Bê chưa cai sữa' },
  { value: 'WEANED_CALF', label: 'Bê cai sữa' },
  { value: 'YOUNG_STOCK', label: 'Bò tơ' },
  { value: 'ADULT', label: 'Trưởng thành' },
]
