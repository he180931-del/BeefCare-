import type { VaccinationOptions } from '../types'

/** Nhóm đàn và giai đoạn sống của bộ lọc lịch tiêm (nhãn theo enum backend). */
export const VACCINATION_HERD_GROUPS: VaccinationOptions['herdGroups'] = [
  { value: 'CALVES', label: 'Bê' },
  { value: 'FATTENING', label: 'Vỗ béo' },
  { value: 'BREEDING_BULLS', label: 'Đực giống' },
  { value: 'BREEDING_FEMALES', label: 'Bò cái sinh sản' },
  { value: 'YOUNG_STOCK', label: 'Bò tơ' },
  { value: 'OTHER', label: 'Khác' },
]

export const VACCINATION_LIFE_STAGES: VaccinationOptions['lifeStages'] = [
  { value: 'UNWEANED_CALF', label: 'Bê chưa cai sữa' },
  { value: 'WEANED_CALF', label: 'Bê cai sữa' },
  { value: 'YOUNG_STOCK', label: 'Bò tơ' },
  { value: 'ADULT', label: 'Trưởng thành' },
]
