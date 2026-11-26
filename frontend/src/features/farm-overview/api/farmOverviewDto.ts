import type { HerdGroup, PenInfo, ReportCode } from '../types'

/** Raw transport envelopes and enum translations owned by the farm overview adapter. */
export type FarmContext = { timeZone: string; serviceUntil: string }
export type PenOption = PenInfo & { id: number }
export type BreedOption = { id: number; code: string; name: string }
export type FarmOverviewResponseDto = Record<string, unknown>
export type FarmOverviewRowsDto = Record<string, unknown>[]
export type FarmOverviewReportDto = Record<string, unknown>
export type FarmOverviewReportCode = ReportCode

export const toBackendGroup: Record<HerdGroup, string> = {
  BREEDING_FEMALE: 'BREEDING_FEMALES', YOUNG_STOCK: 'YOUNG_STOCK', FATTENING: 'FATTENING', CALF: 'CALVES', BREEDING_BULL: 'BREEDING_BULLS', OTHER: 'OTHER',
}
export const fromBackendGroup: Record<string, HerdGroup> = Object.fromEntries(Object.entries(toBackendGroup).map(([front, backend]) => [backend, front])) as Record<string, HerdGroup>

export const backendStep: Record<string, string> = {
  PENS: 'CREATE_PENS', BREEDS_PURPOSES: 'REVIEW_BREEDS_AND_PURPOSES', VACCINE_DOSES: 'COMPLETE_VACCINE_DOSES',
  REFERENCE_MEDICINES: 'ADD_REFERENCE_MEDICINES', FARM_PARAMETERS: 'CHECK_FARM_PARAMETERS', INVITE_MEMBERS: 'INVITE_MEMBERS', FIRST_HERD_ENTRY: 'FIRST_HERD_ENTRY_VOUCHER',
}
export const frontendStep = Object.fromEntries(Object.entries(backendStep).map(([front, backend]) => [backend, front])) as Record<string, string>

export const reminderRules: Record<string, { type: 'weighing' | 'breeding' | 'pregnancy-check' | 'calving' | 'vaccination' | 'pen-stage' | 'draft-calf' | 'feed' | 'health' | 'exit-finishing'; title: string }> = {
  'REM-01': { type: 'weighing', title: 'Đến hạn cân' },
  'REM-02': { type: 'breeding', title: 'Cửa sổ phối' },
  'REM-03': { type: 'pregnancy-check', title: 'Đến hạn khám thai' },
  'REM-04': { type: 'pregnancy-check', title: 'Khám lại thai' },
  'REM-05': { type: 'calving', title: 'Sắp đẻ' },
  'REM-06': { type: 'vaccination', title: 'Mũi tiêm đến hạn' },
  'REM-07': { type: 'breeding', title: 'Sẵn sàng phối sau đẻ' },
  'REM-08': { type: 'pen-stage', title: 'Gợi ý chuyển chuồng hoặc giai đoạn' },
  'REM-09': { type: 'draft-calf', title: 'Bê nháp chờ xác nhận' },
  'REM-10': { type: 'feed', title: 'Tồn thức ăn thấp' },
  'REM-11': { type: 'feed', title: 'Bữa ăn chưa ghi' },
  'REM-12': { type: 'health', title: 'Chết hoặc mất chờ xác nhận' },
  'REM-13': { type: 'exit-finishing', title: 'Đạt cân xuất chuồng' },
}
