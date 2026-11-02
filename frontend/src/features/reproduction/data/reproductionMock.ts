import type { CalfOutcome, ReproductionEvent, ReproductionFemale } from '../types'

const event = (
  id: string,
  type: ReproductionEvent['type'],
  occurredAt: string,
  summary: string,
  details: string,
  extra: Partial<ReproductionEvent> = {},
): ReproductionEvent => ({
  id, type, occurredAt, recordedAt: occurredAt, recorder: 'Trần Quốc Long',
  status: 'VALID', summary, details, dataSource: 'DIRECT_OBSERVATION', version: 1, ...extra,
})

// Farm parameters: minimum 13 months and 230 kg for breeding eligibility (advisory only).
const eligible = (ageMonths: number, weightKg: number | null, failedConditions: string[] = []) => ({
  status: failedConditions.length ? 'NOT_MET' as const : 'MET' as const,
  minimumAgeMet: ageMonths >= 13,
  minimumWeightMet: weightKg != null && weightKg >= 230,
  noOpenHealthCase: true,
  requiredAgeMonths: 13,
  actualAgeMonths: ageMonths,
  requiredWeightKg: 230,
  actualWeightKg: weightKg,
  failedConditions,
})

const noIndicators = { ageAtFirstCalvingMonths: null, lastCalvingIntervalDays: null, daysSinceLastCalving: null, daysOpen: null, conceptionSummary: 'Chưa có lứa đẻ', overdueForConception: false }

const liveCalf = (id: string, number: number, sex: 'MALE' | 'FEMALE', weightKg: number, code: string, penCode: string, breed: string): CalfOutcome => ({
  id, number, outcome: 'LIVE', sex, weightKg, weightBasis: 'MEASURED', earTag: code, penId: `pen-${penCode.toLowerCase()}`, penCode, breed,
  registrationChoice: 'REGISTER_NOW', registrationStatus: 'REGISTERED', productionPurpose: 'Chưa xác định',
})

export interface ReproductionMember { name: string; role: string }
/** ACTIVE farm members offered as observer / performer. There is no member API for this feature yet (chưa có API). */
export const REPRODUCTION_MEMBERS: ReproductionMember[] = [
  { name: 'Trần Quốc Long', role: 'Quản lý' },
  { name: 'Lê Thị Mai', role: 'Kỹ thuật viên' },
  { name: 'Nguyễn Văn Tâm', role: 'Dẫn tinh viên' },
]
/** People outside the farm who can still be typed as examiner / performer. */
export const REPRODUCTION_EXTERNAL_PEOPLE = ['BS Trần Văn Bình']
export const REPRODUCTION_BREEDS = ['Zebu đỏ', 'Lai Sind', 'Brahman đỏ']
export const REPRODUCTION_PENS = [
  { id: 'pen-a1', code: 'A1', label: 'A1 – Sinh sản' },
  { id: 'pen-a2', code: 'A2', label: 'A2 – Bò cái sinh sản' },
  { id: 'pen-b1', code: 'B1', label: 'B1 – Sinh sản' },
  { id: 'pen-c1', code: 'C1', label: 'C1 – Bò tơ' },
  { id: 'pen-d', code: 'D', label: 'D – Chuồng đẻ' },
]
/** Production purposes of the farm catalogue: SIRE only for males, BREEDING only for females (GBR-25). */
export const REPRODUCTION_PURPOSES = [
  { value: 'UNDECIDED', label: 'Chưa xác định' },
  { value: 'BREEDING', label: 'Sinh sản' },
  { value: 'FATTENING', label: 'Vỗ béo' },
  { value: 'SIRE', label: 'Đực giống' },
]
/** Tags and codes already used in the farm by cattle outside this feature's seed (MSG-FE12-08). */
export const REPRODUCTION_USED_TAGS: Record<string, string> = { 'QR-6701-0001': 'bò BC-000112' }
/** Health cases a pregnancy complication can link to, by cattle code. */
export const REPRODUCTION_HEALTH_CASES: Record<string, Array<{ id: string; label: string }>> = {
  'BC-000087': [{ id: 'HC-0415', label: 'HC-0415 · Phù chân sau – cận đẻ' }],
}
/** Male ACTIVE cattle of the farm offered as farm sire. */
export const REPRODUCTION_SIRES = [{ id: 'sire-1', label: 'Sắm · BC-000301 · VN-BV-0101' }, { id: 'sire-2', label: 'Đại Hùng · BC-000302 · VN-BV-0118' }]

export const REPRODUCTION_DEMO: ReproductionFemale[] = [
  {
    cattleId: 'cattle-142', cattleCode: 'BC-000142', name: '—', earTag: '0142', sex: 'FEMALE', breed: 'Zebu đỏ',
    penId: 'pen-c1', penCode: 'C1', penName: 'Chuồng C1 · Bò tơ', herdStatus: 'ACTIVE', lifeStage: 'YOUNG_STOCK',
    purposeType: 'BREEDING', applicable: true, status: 'IN_ESTRUS', statusAt: '2026-10-20T06:30', ageMonths: 14,
    latestWeightKg: 236, parity: 0, earlierCalvings: 0, servicesInCurrentCycle: 0, lastCalvingAt: null,
    breedingWindow: { from: '2026-10-20T14:30', to: '2026-10-20T18:30' }, nextAction: 'Xem xét phối giống',
    dueAt: '2026-10-20T14:30', eligibility: eligible(14, 236),
    openHealthCase: false, openPregnancy: null,
    events: [
      event('re-142-e3', 'ESTRUS', '2026-10-20T06:30', 'Động dục', 'Đứng yên cho nhảy, chảy nhớt trong, âm hộ sưng đỏ', { observer: 'Lê Thị Mai' }),
      event('re-142-e2', 'ESTRUS', '2026-10-19T18:10', 'Động dục', 'Bồn chồn, nhảy lên con khác', { observer: 'Lê Thị Mai', recorder: 'Lê Thị Mai' }),
      event('re-142-e1', 'ESTRUS', '2026-09-22T07:00', 'Động dục', 'Kêu rống, nhảy lên con khác', { observer: 'Lê Thị Mai' }),
    ],
    calvings: [], revisions: [], indicators: { ...noIndicators },
    declaredPregnancyAtEntryMonths: null, version: 2,
  },
  {
    cattleId: 'cattle-217', cattleCode: 'BC-000217', name: '—', earTag: '0217', sex: 'FEMALE', breed: 'Zebu đỏ',
    penId: 'pen-c2', penCode: 'C2', penName: 'Chuồng C2 · Bò tơ', herdStatus: 'ACTIVE', lifeStage: 'YOUNG_STOCK',
    purposeType: 'BREEDING', applicable: true, status: 'IN_ESTRUS', statusAt: '2026-10-20T05:50', ageMonths: 16,
    latestWeightKg: 244, parity: 0, earlierCalvings: 0, servicesInCurrentCycle: 0, lastCalvingAt: null,
    breedingWindow: { from: '2026-10-20T14:00', to: '2026-10-20T18:00' }, nextAction: 'Xem xét phối giống',
    dueAt: '2026-10-20T14:00', eligibility: eligible(16, 244),
    openHealthCase: false, openPregnancy: null,
    events: [event('re-217-e1', 'ESTRUS', '2026-10-20T05:50', 'Động dục', 'Đứng yên cho nhảy', { observer: 'Lê Thị Mai' })],
    calvings: [], revisions: [], indicators: { ...noIndicators },
    declaredPregnancyAtEntryMonths: null, version: 1,
  },
  {
    cattleId: 'cattle-188', cattleCode: 'BC-000188', name: '—', earTag: '0188', sex: 'FEMALE', breed: 'Zebu đỏ',
    penId: 'pen-c1', penCode: 'C1', penName: 'Chuồng C1 · Bò tơ', herdStatus: 'ACTIVE', lifeStage: 'YOUNG_STOCK',
    purposeType: 'BREEDING', applicable: true, status: 'IN_ESTRUS', statusAt: '2026-10-19T19:10', ageMonths: 15,
    latestWeightKg: 228, parity: 0, earlierCalvings: 0, servicesInCurrentCycle: 0, lastCalvingAt: null,
    breedingWindow: null, nextAction: 'Theo dõi cân nặng', dueAt: null,
    eligibility: eligible(15, 228, ['Cân nặng 228 kg chưa đạt tối thiểu 230 kg.']),
    openHealthCase: false, openPregnancy: null,
    events: [event('re-188-e1', 'ESTRUS', '2026-10-19T19:10', 'Động dục', 'Bồn chồn, kêu rống', { observer: 'Lê Thị Mai' })],
    calvings: [], revisions: [], indicators: { ...noIndicators },
    declaredPregnancyAtEntryMonths: null, version: 1,
  },
  {
    cattleId: 'cattle-061', cattleCode: 'BC-000061', name: 'Nâu', earTag: '0061', sex: 'FEMALE', breed: 'Lai Sind',
    penId: 'pen-b1', penCode: 'B1', penName: 'Chuồng B1 · Sinh sản', herdStatus: 'ACTIVE', lifeStage: 'ADULT',
    purposeType: 'BREEDING', applicable: true, status: 'BRED', statusAt: '2026-09-20T07:00', ageMonths: 60,
    latestWeightKg: 338, parity: 3, earlierCalvings: 2, servicesInCurrentCycle: 1, lastCalvingAt: '2026-02-02T03:40',
    breedingWindow: null, nextAction: 'Kiểm tra có thai', dueAt: '2026-10-20T07:00',
    eligibility: eligible(60, 338), openHealthCase: false, openPregnancy: null,
    events: [
      event('re-061-b1', 'BREEDING', '2026-09-20T07:00', 'Phối giống · lần 1', 'Thụ tinh nhân tạo · Brahman đỏ BRD-118 · Nguyễn Văn Tâm', { method: 'ARTIFICIAL_INSEMINATION', sireLabel: 'Brahman đỏ', semenCode: 'BRD-118', performer: 'Nguyễn Văn Tâm', linkedEstrusId: 're-061-e1' }),
      event('re-061-e1', 'ESTRUS', '2026-09-19T18:00', 'Động dục', 'Đứng yên cho nhảy, chảy nhớt trong', { observer: 'Lê Thị Mai', recorder: 'Lê Thị Mai' }),
      event('calv-061-3', 'CALVING', '2026-02-02T03:40', 'Sự kiện đẻ', '1 bê: Sống · Đực · 25 kg · BC-000198', { pregnancyId: 'preg-061-3' }),
    ],
    calvings: [
      { id: 'calv-061-3', birthAt: '2026-02-02T03:40', recordedAt: '2026-02-02T05:00', recorder: 'Trần Quốc Long', dataSource: 'DIRECT_OBSERVATION', pregnancyId: 'preg-061-3', course: 'NORMAL', damCondition: 'GOOD', retainedPlacenta: false, status: 'VALID', version: 1,
        calves: [liveCalf('calf-061-3-1', 1, 'MALE', 25, 'BC-000198', 'B1', 'Lai Sind')] },
    ],
    revisions: [], indicators: { ageAtFirstCalvingMonths: 26, lastCalvingIntervalDays: 392, daysSinceLastCalving: 260, daysOpen: 230, conceptionSummary: '3 thai / 5 lần phối', overdueForConception: false },
    declaredPregnancyAtEntryMonths: null, version: 1,
  },
  {
    cattleId: 'cattle-087', cattleCode: 'BC-000087', name: 'Mận', earTag: '0087', sex: 'FEMALE', breed: 'Lai Sind',
    penId: 'pen-d', penCode: 'D', penName: 'Chuồng D – Chuồng đẻ', herdStatus: 'ACTIVE', lifeStage: 'ADULT',
    purposeType: 'BREEDING', applicable: true, status: 'PREGNANT', statusAt: '2026-03-12T09:00', ageMonths: 74,
    latestWeightKg: 365, parity: 2, earlierCalvings: 0, servicesInCurrentCycle: 1, lastCalvingAt: '2024-12-12T03:10',
    breedingWindow: null, nextAction: 'Chuẩn bị chuồng đẻ', dueAt: '2026-10-22T07:30',
    eligibility: null, openHealthCase: true,
    openPregnancy: { id: 'preg-087-3', pregnancyNumber: 3, linkedBreedingId: 're-087-b4', confirmedAt: '2026-03-12T09:00', expectedCalvingAt: '2026-10-22T07:30', expectedDateBasis: 'CONFIRMED', estimatedMonths: null, status: 'OPEN' },
    events: [
      event('re-087-pu1', 'PREGNANCY_UPDATE', '2026-10-15T07:00', 'Diễn biến thai · Biến chứng', 'Biến chứng · Phù chân sau, đi lại chậm · ca HC-0415', { updateType: 'COMPLICATION', pregnancyId: 'preg-087-3', linkedHealthCaseId: 'HC-0415' }),
      event('re-087-pc4', 'PREGNANCY_CHECK', '2026-03-12T09:00', 'Khám thai · Có thai', 'Có thai · Siêu âm · BS Trần Văn Bình', { result: 'PREGNANT', method: 'ULTRASOUND', examiner: 'BS Trần Văn Bình', linkedBreedingId: 're-087-b4', pregnancyId: 'preg-087-3', expectedCalvingAt: '2026-10-22T07:30', expectedDateBasis: 'CONFIRMED' }),
      event('re-087-pc3', 'PREGNANCY_CHECK', '2026-02-20T08:30', 'Khám thai · Chưa kết luận', 'Chưa xác định · Khám trực tràng · BS Trần Văn Bình', { result: 'INCONCLUSIVE', method: 'RECTAL', examiner: 'BS Trần Văn Bình', linkedBreedingId: 're-087-b4' }),
      event('re-087-b4', 'BREEDING', '2026-01-12T07:30', 'Phối giống · lần 1', 'Thụ tinh nhân tạo · Brahman đỏ BRD-204 · Nguyễn Văn Tâm', { method: 'ARTIFICIAL_INSEMINATION', sireLabel: 'Brahman đỏ', semenCode: 'BRD-204', performer: 'Nguyễn Văn Tâm' }),
    ],
    calvings: [
      { id: 'calv-087-2', birthAt: '2024-12-12T03:10', recordedAt: '2024-12-12T05:00', recorder: 'Trần Quốc Long', dataSource: 'DIRECT_OBSERVATION', pregnancyId: 'preg-087-2', course: 'NORMAL', damCondition: 'GOOD', retainedPlacenta: false, status: 'VALID', version: 1,
        calves: [liveCalf('calf-087-2-1', 1, 'FEMALE', 22, 'BC-000171', 'D', 'Lai Sind')] },
      { id: 'calv-087-1', birthAt: '2023-11-05T04:00', recordedAt: '2023-11-05T06:00', recorder: 'Trần Quốc Long', dataSource: 'DIRECT_OBSERVATION', pregnancyId: 'preg-087-1', course: 'NORMAL', damCondition: 'GOOD', retainedPlacenta: false, status: 'VALID', version: 1,
        calves: [liveCalf('calf-087-1-1', 1, 'MALE', 24, 'BC-000120', 'D', 'Lai Sind')] },
    ],
    revisions: [], indicators: { ageAtFirstCalvingMonths: 27, lastCalvingIntervalDays: 403, daysSinceLastCalving: null, daysOpen: 29, conceptionSummary: '3 thai / 4 lần phối', conceptionDetail: '3 lần đậu / 5 lần phối', overdueForConception: false },
    declaredPregnancyAtEntryMonths: null, version: 3,
  },
  {
    cattleId: 'cattle-125', cattleCode: 'BC-000125', name: 'Hoa Đỏ', earTag: '0125', sex: 'FEMALE', breed: 'Zebu đỏ',
    penId: 'pen-a1', penCode: 'A1', penName: 'Chuồng A1 · Sinh sản', herdStatus: 'ACTIVE', lifeStage: 'ADULT',
    purposeType: 'BREEDING', applicable: true, status: 'PREGNANT', statusAt: '2026-06-10T09:00', ageMonths: 55,
    latestWeightKg: 342, parity: 2, earlierCalvings: 2, servicesInCurrentCycle: 1, lastCalvingAt: '2025-06-01T08:00',
    breedingWindow: null, nextAction: 'Theo dõi thai kỳ', dueAt: '2027-02-19T09:00',
    eligibility: null, openHealthCase: false,
    openPregnancy: { id: 'preg-125-3', pregnancyNumber: 3, linkedBreedingId: 're-125-b3', confirmedAt: '2026-06-10T09:00', expectedCalvingAt: '2027-02-19T09:00', expectedDateBasis: 'CONFIRMED', estimatedMonths: null, status: 'OPEN' },
    events: [
      event('re-125-pc3', 'PREGNANCY_CHECK', '2026-06-10T09:00', 'Khám thai · Có thai', 'Có thai · Siêu âm · BS Trần Văn Bình', { result: 'PREGNANT', method: 'ULTRASOUND', examiner: 'BS Trần Văn Bình', linkedBreedingId: 're-125-b3', pregnancyId: 'preg-125-3', expectedCalvingAt: '2027-02-19T09:00', expectedDateBasis: 'CONFIRMED' }),
      event('re-125-b3', 'BREEDING', '2026-05-12T07:30', 'Phối giống · lần 1', 'Thụ tinh nhân tạo · Brahman đỏ BRD-118 · Nguyễn Văn Tâm', { method: 'ARTIFICIAL_INSEMINATION', sireLabel: 'Brahman đỏ', semenCode: 'BRD-118', performer: 'Nguyễn Văn Tâm' }),
    ],
    calvings: [], revisions: [], indicators: { ageAtFirstCalvingMonths: 28, lastCalvingIntervalDays: null, daysSinceLastCalving: 141, daysOpen: null, conceptionSummary: '2 thai kỳ từ 3 lần phối', overdueForConception: false },
    declaredPregnancyAtEntryMonths: null, version: 1,
  },
  {
    cattleId: 'cattle-240', cattleCode: 'BC-000240', name: '—', earTag: '0240', sex: 'FEMALE', breed: 'Brahman đỏ',
    penId: 'pen-a2', penCode: 'A2', penName: 'Chuồng A2 · Bò cái sinh sản', herdStatus: 'ACTIVE', lifeStage: 'ADULT',
    purposeType: 'BREEDING', applicable: true, status: 'AWAITING_BREEDING', statusAt: '2026-10-02T09:00', ageMonths: 41,
    latestWeightKg: 352, parity: 0, earlierCalvings: 0, servicesInCurrentCycle: 0, lastCalvingAt: null,
    breedingWindow: null, nextAction: 'Theo dõi chu kỳ động dục', dueAt: null,
    eligibility: eligible(41, 352), openHealthCase: false, openPregnancy: null,
    events: [], calvings: [], revisions: [], indicators: { ...noIndicators },
    declaredPregnancyAtEntryMonths: null, version: 1,
  },
]
