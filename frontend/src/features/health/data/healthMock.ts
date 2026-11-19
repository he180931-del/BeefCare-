import type { CaseOutcome, CaseStatus, EntryType, HealthCattle, Medicine, PendingExit, Progress, RecordStatus, Severity, TreatmentRoute } from '../types'

/** "Hôm nay" của dữ liệu mẫu: các frame Figma tính ngày từ 20/10/2026 (HC-0412 mở 13/10 là "ngày 8"). */
export const HEALTH_DEMO_NOW = '2026-10-20T08:00'

export interface Revision {
  at: string
  reason: string
  actor: string
  kind: 'CORRECTED' | 'VOIDED'
  before: Record<string, unknown>
}

export interface CaseRecord {
  id: number
  caseCode: string
  cattleCode: string
  diagnosis: string
  signs: string
  suspectedContagious: boolean
  severity: Severity
  openedAt: string
  status: CaseStatus
  chronicSince?: string
  outcome?: CaseOutcome
  closedAt?: string
  closedBy?: string
  version: number
}

export interface EntryRecord {
  id: number
  caseId: number
  type: EntryType
  occurredAt: string
  recordedBy: string
  status: RecordStatus
  corrected: boolean
  version: number
  temperatureC: number | null
  progress?: Progress
  description?: string
  medicineId?: number
  medicineName?: string
  dose?: string
  route?: TreatmentRoute
  courseDays?: number
  withdrawalDays?: number
  veterinaryAdvice?: string
  revisions: Revision[]
}

export interface HealthSeed {
  cattle: HealthCattle[]
  cases: CaseRecord[]
  entries: EntryRecord[]
  medicines: Medicine[]
  members: string[]
  diagnoses: string[]
  vouchers: PendingExit[]
}

const MANAGER = 'Trần Quốc Long'

export const MEDICINES: Medicine[] = [
  { id: 1, name: 'Oxytetracycline 20% LA', active: true, defaultDose: '30 ml', doseNote: '1 ml / 10 kg', route: 'INTRAMUSCULAR', withdrawalDays: 28 },
  { id: 2, name: 'Oresol thú y', active: true, defaultDose: '2 lít/ngày', doseNote: 'Pha theo hướng dẫn nhà sản xuất', route: 'ORAL', withdrawalDays: 0 },
  { id: 3, name: 'Meloxicam 5%', active: true, defaultDose: '20 ml', doseNote: '1 ml / 25 kg', route: 'INTRAMUSCULAR', withdrawalDays: 15 },
  { id: 4, name: 'Ivermectin 1%', active: true, defaultDose: '10 ml', doseNote: '1 ml / 50 kg', route: 'SUBCUTANEOUS', withdrawalDays: 35 },
  { id: 5, name: 'Vitamin B-complex', active: true, defaultDose: '10 ml', doseNote: '', route: 'INTRAMUSCULAR', withdrawalDays: 0 },
  { id: 6, name: 'Penicillin – Streptomycin', active: true, defaultDose: '20 ml', doseNote: '1 ml / 25 kg', route: 'INTRAMUSCULAR', withdrawalDays: 21 },
  { id: 7, name: 'Enrofloxacin 10%', active: false, defaultDose: '10 ml', doseNote: '1 ml / 40 kg', route: 'INTRAMUSCULAR', withdrawalDays: 28 },
]

const cow = (code: string, name: string, earTag: string, breed: string, sex: string, ageText: string, stage: string, pen: string, entryDate: string): HealthCattle => {
  const [penCode, ...rest] = pen.split(' – ')
  return { code, name, earTag, breed, sex, ageText, stage, penCode, penName: rest.join(' – '), entryDate, status: 'ACTIVE' }
}

const CATTLE: HealthCattle[] = [
  cow('BC-000203', 'Bão', 'VN-BV-0512', 'Zebu đỏ', 'Đực', '2 tuổi 1 tháng', 'Vỗ béo', 'B1 – Vỗ béo', '2024-11-05'),
  cow('BC-000154', '', 'VN-BV-0388', 'Zebu đỏ', 'Cái', '3 tuổi 4 tháng', 'Bò cái sinh sản', 'A1 – Bò cái sinh sản', '2023-08-14'),
  cow('BC-000017', 'Sấm', 'VN-BV-0101', 'Brahman đỏ', 'Đực', '5 tuổi 2 tháng', 'Đực giống', 'B2 – Đực giống', '2022-03-02'),
  cow('BC-000231', '', 'VN-BV-0603', 'Lai Sind', 'Đực', '3 tháng', 'Bê chưa cai sữa', 'A3 – Bê con', '2026-07-12'),
  cow('BC-000087', 'Mận', 'VN-BV-0290', 'Lai Sind', 'Cái', '4 tuổi 1 tháng', 'Cận đẻ', 'D – Chuồng đẻ', '2023-01-20'),
  cow('BC-000142', '', 'VN-BV-0344', 'Zebu đỏ', 'Cái', '1 tuổi 8 tháng', 'Bò tơ', 'C1 – Bò tơ', '2025-02-18'),
  cow('BC-000110', '', 'VN-BV-0312', 'Lai Sind', 'Cái', '3 tuổi 9 tháng', 'Mang thai', 'A2 – Bò mang thai', '2023-05-09'),
  cow('BC-000125', '', 'VN-BV-0327', 'Zebu đỏ', 'Cái', '3 tuổi 6 tháng', 'Bò cái sinh sản', 'A1 – Bò cái sinh sản', '2023-06-27'),
  cow('BC-000092', '', 'VN-BV-0265', 'Brahman đỏ', 'Đực', '4 tuổi 3 tháng', 'Đực giống', 'B2 – Đực giống', '2022-11-30'),
  { ...cow('BC-000064', '', 'VN-BV-0198', 'Lai Sind', 'Cái', '3 tuổi', 'Vỗ béo', 'B1 – Vỗ béo', '2023-04-11'), status: 'EXITED', exitDate: '2026-08-14', exitType: 'Chết' },
]

const kase = (n: number, cattleCode: string, signs: string, severity: Severity, openedAt: string, extra: Partial<CaseRecord> = {}): CaseRecord => ({
  id: n, caseCode: `HC-${String(n).padStart(4, '0')}`, cattleCode, diagnosis: '', signs, suspectedContagious: false, severity, openedAt, status: 'OPEN', version: 1, ...extra,
})
const closed = (n: number, cattleCode: string, signs: string, severity: Severity, openedAt: string, closedAt: string, outcome: CaseOutcome = 'RECOVERED', extra: Partial<CaseRecord> = {}) =>
  kase(n, cattleCode, signs, severity, openedAt, { status: 'CLOSED', outcome, closedAt, closedBy: MANAGER, ...extra })

const CASES: CaseRecord[] = [
  kase(418, 'BC-000154', 'Sưng chỗ tiêm', 'MILD', '2026-10-19T09:10'),
  kase(417, 'BC-000017', 'Què chân trước trái', 'SEVERE', '2026-10-19T08:00'),
  kase(416, 'BC-000231', 'Ho, chảy nước mũi', 'MODERATE', '2026-10-18T07:30', { diagnosis: 'Viêm đường hô hấp' }),
  kase(415, 'BC-000087', 'Phù chân sau – cận đẻ', 'MILD', '2026-10-15T08:30'),
  kase(412, 'BC-000203', 'Tiêu chảy, bỏ ăn một phần', 'MODERATE', '2026-10-13T07:00', { diagnosis: 'Tiêu chảy' }),
  kase(409, 'BC-000142', 'Chảy nước mắt', 'MILD', '2026-10-10T09:00'),
  kase(405, 'BC-000110', 'Bỏ ăn nhẹ', 'MILD', '2026-10-06T08:00'),
  kase(398, 'BC-000125', 'Viêm khớp chân sau', 'MODERATE', '2026-09-05T08:00', { status: 'CHRONIC', chronicSince: '2026-09-20' }),
  kase(386, 'BC-000092', 'Ho kéo dài', 'MILD', '2026-08-28T08:00', { status: 'CHRONIC', chronicSince: '2026-09-12' }),
  closed(411, 'BC-000154', 'Sưng khớp gối', 'MILD', '2026-10-11T08:00', '2026-10-16T08:00'),
  closed(410, 'BC-000231', 'Tiêu chảy', 'MODERATE', '2026-10-10T07:30', '2026-10-15T08:00'),
  closed(408, 'BC-000017', 'Ho khan', 'MILD', '2026-10-09T08:00', '2026-10-14T08:00'),
  closed(407, 'BC-000087', 'Chướng hơi', 'MODERATE', '2026-10-08T07:00', '2026-10-10T08:00'),
  closed(404, 'BC-000142', 'Viêm mắt', 'MILD', '2026-10-03T08:00', '2026-10-09T08:00'),
  closed(401, 'BC-000110', 'Sốt cao, bỏ ăn', 'SEVERE', '2026-09-30T07:30', '2026-10-06T08:00'),
  closed(396, 'BC-000092', 'Ghẻ da', 'MILD', '2026-09-24T08:00', '2026-10-02T08:00'),
  closed(388, 'BC-000231', 'Rốn sưng', 'MODERATE', '2026-09-02T08:00', '2026-09-10T08:00'),
  closed(372, 'BC-000064', 'Sốt cao, nằm liệt', 'SEVERE', '2026-08-12T07:00', '2026-08-14T05:30', 'DIED'),
  closed(331, 'BC-000203', 'Ho, sốt nhẹ', 'MILD', '2026-05-14T08:00', '2026-05-20T08:00'),
  closed(207, 'BC-000203', 'Chướng hơi', 'MODERATE', '2025-11-03T08:00', '2025-11-08T08:00'),
]

let nextEntry = 100
const entry = (caseId: number, type: EntryType, occurredAt: string, extra: Partial<EntryRecord>): EntryRecord => ({
  id: nextEntry++, caseId, type, occurredAt, recordedBy: MANAGER, status: 'VALID', corrected: false, version: 1, temperatureC: null, revisions: [], ...extra,
})
const opening = (caseId: number, occurredAt: string, description: string, temperatureC: number | null = null) => entry(caseId, 'OPENING', occurredAt, { description, temperatureC })
const followUp = (caseId: number, occurredAt: string, progress: Progress, description: string, temperatureC: number | null = null) => entry(caseId, 'FOLLOW_UP', occurredAt, { progress, description, temperatureC })
const treatment = (caseId: number, occurredAt: string, medicineId: number, dose: string, courseDays: number, withdrawalDays: number, veterinaryAdvice = '') => {
  const m = MEDICINES.find((x) => x.id === medicineId)!
  return entry(caseId, 'TREATMENT', occurredAt, { medicineId, medicineName: m.name, dose, route: m.route, courseDays, withdrawalDays, veterinaryAdvice })
}

const ENTRIES: EntryRecord[] = [
  opening(418, '2026-10-19T09:10', 'Sưng chỗ tiêm', 38.9),
  opening(417, '2026-10-19T08:00', 'Què chân trước trái, không chịu đứng lâu', 39.4),
  treatment(417, '2026-10-19T08:40', 3, '20 ml', 3, 15),
  opening(416, '2026-10-18T07:30', 'Ho, chảy nước mũi', 39.5),
  treatment(416, '2026-10-18T08:10', 1, '10 ml', 1, 28),
  opening(415, '2026-10-15T08:30', 'Phù chân sau, cận ngày đẻ', null),
  opening(412, '2026-10-13T07:00', 'Phân lỏng, bỏ ăn một phần', 39.8),
  treatment(412, '2026-10-13T07:30', 1, '30 ml', 1, 28),
  treatment(412, '2026-10-16T08:00', 2, '2 lít/ngày', 3, 0),
  followUp(412, '2026-10-18T07:10', 'IMPROVED', 'Ăn lại bình thường, phân gần như bình thường', 38.6),
  opening(409, '2026-10-10T09:00', 'Chảy nước mắt', null),
  opening(405, '2026-10-06T08:00', 'Bỏ ăn nhẹ', 38.8),
  opening(398, '2026-09-05T08:00', 'Đi khập khiễng chân sau, khớp sưng', 38.7),
  treatment(398, '2026-09-05T08:30', 3, '20 ml', 3, 15),
  opening(386, '2026-08-28T08:00', 'Ho kéo dài về sáng', null),
  opening(411, '2026-10-11T08:00', 'Sưng khớp gối'),
  opening(410, '2026-10-10T07:30', 'Tiêu chảy', 39.2),
  opening(408, '2026-10-09T08:00', 'Ho khan'),
  opening(407, '2026-10-08T07:00', 'Chướng hơi bên trái'),
  opening(404, '2026-10-03T08:00', 'Viêm mắt'),
  opening(401, '2026-09-30T07:30', 'Sốt cao, bỏ ăn', 40.3),
  opening(396, '2026-09-24T08:00', 'Ghẻ da vùng cổ'),
  opening(388, '2026-09-02T08:00', 'Rốn sưng'),
  opening(372, '2026-08-12T07:00', 'Sốt cao, nằm liệt', 41.2),
  opening(331, '2026-05-14T08:00', 'Ho, sốt nhẹ', 39.1),
  opening(207, '2025-11-03T08:00', 'Chướng hơi'),
]

export const HEALTH_SEED: HealthSeed = {
  cattle: CATTLE,
  cases: CASES,
  entries: ENTRIES,
  medicines: MEDICINES,
  members: [MANAGER, 'Nguyễn Văn Hùng'],
  diagnoses: ['Tiêu chảy', 'Viêm phổi', 'Chướng hơi'],
  vouchers: [],
}
