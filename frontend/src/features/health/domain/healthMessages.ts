import type { HealthCaseResult, RecordResult } from '../types'
import { fmtDate, OUTCOME_LABEL } from './healthFormat'

// Thông báo thành công (MSG-FE10-01..04, 08, 09, 11, 12), dịch từ SRS.
export const openedToast = (r: HealthCaseResult) => `Đã ${r.kind === 'ADDED' ? 'cập nhật' : 'mở'} ca sức khỏe ${r.caseCode} cho ${r.cattleCode}.`
export const followUpToast = (caseCode: string) => `Đã ghi theo dõi cho ca ${caseCode}.`
export const treatmentToast = (withdrawalEnd: string) => `Đã ghi điều trị. Ngưng sử dụng thịt đến ${fmtDate(withdrawalEnd)}.`

export function statusToast(r: HealthCaseResult): string {
  if (r.kind === 'CLOSED') return `Đã đóng ca ${r.caseCode} với kết quả ${OUTCOME_LABEL[r.outcome ?? 'RECOVERED']}.`
  if (r.kind === 'CHRONIC') return `Ca ${r.caseCode} đã chuyển sang theo dõi mạn tính.`
  if (r.kind === 'REOPENED') return `Ca ${r.caseCode} đã mở lại (OPEN).`
  return followUpToast(r.caseCode)
}

export function recordToast(r: RecordResult): string {
  const what = r.recordType === 'TREATMENT' ? 'điều trị' : 'theo dõi'
  const base = `Đã ${r.action === 'VOIDED' ? 'hủy' : 'sửa'} bản ghi ${what}. Thay đổi và lý do được lưu trong lịch sử.`
  return r.withdrawalBefore !== r.withdrawalAfter ? `${base} Ngưng thịt của ${r.cattleCode} đổi từ ${fmtDate(r.withdrawalBefore)} sang ${fmtDate(r.withdrawalAfter)}.` : base
}
