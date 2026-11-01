import type { ReproductionEvent, ReproductionFemale } from '../types'

const event = (
  id: string,
  type: ReproductionEvent['type'],
  occurredAt: string,
  summary: string,
  details: string,
  extra: Partial<ReproductionEvent> = {},
): ReproductionEvent => ({
  id, type, occurredAt, recordedAt: occurredAt, recorder: 'Trần Quốc Long',
  status: 'VALID', summary, details, version: 1, ...extra,
})

const eligible = (ageMonths: number, weightKg: number | null, failedConditions: string[] = []) => ({
  status: failedConditions.length ? 'NOT_MET' as const : 'MET' as const,
  minimumAgeMet: ageMonths >= 15,
  minimumWeightMet: weightKg != null && weightKg >= 230,
  noOpenHealthCase: true,
  requiredAgeMonths: 15,
  actualAgeMonths: ageMonths,
  requiredWeightKg: 230,
  actualWeightKg: weightKg,
  failedConditions,
})

export const REPRODUCTION_DEMO: ReproductionFemale[] = [
  {
    cattleId: 'cattle-142', cattleCode: 'BC-000142', name: '—', earTag: 'VN-BV-0142', sex: 'FEMALE', breed: 'Zebu đỏ',
    penId: 'pen-c1', penCode: 'C1', penName: 'Chuồng C1 · Bò tơ', herdStatus: 'ACTIVE', lifeStage: 'YOUNG_STOCK',
    purposeType: 'BREEDING', applicable: true, status: 'IN_ESTRUS', statusAt: '2026-10-20T06:30', ageMonths: 14,
    latestWeightKg: 236, parity: 0, earlierCalvings: 0, servicesInCurrentCycle: 0, lastCalvingAt: null,
    breedingWindow: { from: '2026-10-20T14:30', to: '2026-10-20T18:30' }, nextAction: 'Cửa sổ phối giống hôm nay',
    dueAt: '2026-10-20T14:30', eligibility: eligible(14, 236, ['Chưa đủ tuổi tối thiểu (15 tháng).']),
    openHealthCase: false, openPregnancy: null,
    events: [
      event('re-142-e2', 'ESTRUS', '2026-10-20T06:30', 'Động dục', 'Đứng cho con khác nhảy · dịch nhầy trong', { observer: 'Lê Minh Anh', dataSource: 'DIRECT_OBSERVATION' }),
      event('re-142-e1', 'ESTRUS', '2026-09-28T07:00', 'Động dục · chu kỳ trước', 'Kêu nhiều, đứng yên khi phối', { observer: 'Lê Minh Anh', dataSource: 'DIRECT_OBSERVATION' }),
    ],
    calvings: [], revisions: [], indicators: { ageAtFirstCalvingMonths: null, lastCalvingIntervalDays: null, daysSinceLastCalving: null, daysOpen: null, conceptionSummary: 'Chưa có lứa đẻ', overdueForConception: false },
    declaredPregnancyAtEntryMonths: null, version: 2,
  },
  {
    cattleId: 'cattle-061', cattleCode: 'BC-000061', name: 'Nâu', earTag: 'VN-BV-0206', sex: 'FEMALE', breed: 'Lai Sind',
    penId: 'pen-b1', penCode: 'B1', penName: 'Chuồng B1 · Sinh sản', herdStatus: 'ACTIVE', lifeStage: 'ADULT',
    purposeType: 'BREEDING', applicable: true, status: 'BRED', statusAt: '2026-10-02T08:30', ageMonths: 60,
    latestWeightKg: 338, parity: 2, earlierCalvings: 2, servicesInCurrentCycle: 1, lastCalvingAt: '2025-12-15T08:00',
    breedingWindow: null, nextAction: 'Chờ đến ngày khám thai', dueAt: '2026-10-30T08:30',
    eligibility: eligible(60, 338), openHealthCase: false, openPregnancy: null,
    events: [
      event('re-061-b1', 'BREEDING', '2026-10-02T08:30', 'Phối giống · lần 1', 'Phối tự nhiên · Sắm (VN-BV-0101)', { method: 'NATURAL_SERVICE', sireLabel: 'Sắm · VN-BV-0101', performer: 'Trần Quốc Long', dataSource: 'DIRECT_OBSERVATION' }),
      event('re-061-e1', 'ESTRUS', '2026-10-02T06:00', 'Động dục', 'Đứng cho con khác nhảy', { observer: 'Lê Minh Anh', dataSource: 'DIRECT_OBSERVATION' }),
    ],
    calvings: [], revisions: [], indicators: { ageAtFirstCalvingMonths: 31, lastCalvingIntervalDays: null, daysSinceLastCalving: 320, daysOpen: 291, conceptionSummary: '1 lần phối trong chu kỳ', overdueForConception: false },
    declaredPregnancyAtEntryMonths: null, version: 1,
  },
  {
    cattleId: 'cattle-087', cattleCode: 'BC-000087', name: 'Mận', earTag: 'VN-BV-0311', sex: 'FEMALE', breed: 'Lai Sind',
    penId: 'pen-d', penCode: 'D', penName: 'Chuồng D · Sinh sản', herdStatus: 'ACTIVE', lifeStage: 'ADULT',
    purposeType: 'BREEDING', applicable: true, status: 'PREGNANT', statusAt: '2026-02-18T09:00', ageMonths: 74,
    latestWeightKg: 365, parity: 3, earlierCalvings: 3, servicesInCurrentCycle: 2, lastCalvingAt: '2025-07-06T08:00',
    breedingWindow: null, nextAction: 'Chuẩn bị theo dõi đẻ', dueAt: '2026-10-28T09:00',
    eligibility: null, openHealthCase: true,
    openPregnancy: { id: 'preg-087-4', pregnancyNumber: 4, linkedBreedingId: 're-087-b4', confirmedAt: '2026-02-18T09:00', expectedCalvingAt: '2026-10-28T09:00', expectedDateBasis: 'CONFIRMED', estimatedMonths: null, status: 'OPEN' },
    events: [
      event('re-087-pc4', 'PREGNANCY_CHECK', '2026-02-18T09:00', 'Khám thai · Có thai', 'Siêu âm · BS. Trần Văn Bình', { result: 'PREGNANT', method: 'ULTRASOUND', examiner: 'BS. Trần Văn Bình', linkedBreedingId: 're-087-b4', pregnancyId: 'preg-087-4' }),
      event('re-087-b4', 'BREEDING', '2026-01-20T08:00', 'Phối giống · lần 2', 'Phối nhân tạo · tinh BRD-118', { method: 'ARTIFICIAL_INSEMINATION', sireLabel: 'Tinh BRD-118 · Lai Sind', performer: 'Nguyễn Văn Tâm', dataSource: 'FARM_NOTEBOOK' }),
      event('re-087-pu1', 'PREGNANCY_UPDATE', '2026-10-18T07:30', 'Theo dõi thai', 'Bầu vú phát triển, ăn uống bình thường', { updateType: 'OBSERVATION', pregnancyId: 'preg-087-4', dataSource: 'DIRECT_OBSERVATION' }),
    ],
    calvings: [
      { id: 'calv-087-3', birthAt: '2025-07-06T08:00', recordedAt: '2025-07-06T10:00', recorder: 'Trần Quốc Long', dataSource: 'DIRECT_OBSERVATION', pregnancyId: 'preg-087-3', course: 'NORMAL', damCondition: 'GOOD', retainedPlacenta: false, status: 'VALID', version: 1,
        calves: [{ id: 'calf-087-3-1', number: 1, outcome: 'LIVE', sex: 'FEMALE', weightKg: 24, weightBasis: 'MEASURED', earTag: 'VN-BV-0502', penId: 'pen-d', penCode: 'D', breed: 'Lai Sind', registrationChoice: 'REGISTER_NOW', registrationStatus: 'REGISTERED', productionPurpose: 'Chưa xác định' }] },
    ],
    revisions: [], indicators: { ageAtFirstCalvingMonths: 29, lastCalvingIntervalDays: 378, daysSinceLastCalving: 106, daysOpen: 199, conceptionSummary: '3 thai kỳ từ 5 lần phối', overdueForConception: false },
    declaredPregnancyAtEntryMonths: null, version: 3,
  },
  {
    cattleId: 'cattle-125', cattleCode: 'BC-000125', name: 'Hoa Đỏ', earTag: 'VN-BV-0457', sex: 'FEMALE', breed: 'Zebu đỏ',
    penId: 'pen-a1', penCode: 'A1', penName: 'Chuồng A1 · Sinh sản', herdStatus: 'ACTIVE', lifeStage: 'ADULT',
    purposeType: 'BREEDING', applicable: true, status: 'PREGNANT', statusAt: '2026-06-10T09:00', ageMonths: 55,
    latestWeightKg: 342, parity: 2, earlierCalvings: 2, servicesInCurrentCycle: 1, lastCalvingAt: '2025-06-01T08:00',
    breedingWindow: null, nextAction: 'Theo dõi ngày đẻ dự kiến', dueAt: '2027-02-19T09:00',
    eligibility: null, openHealthCase: false,
    openPregnancy: { id: 'preg-125-3', pregnancyNumber: 3, linkedBreedingId: 're-125-b3', confirmedAt: '2026-06-10T09:00', expectedCalvingAt: '2027-02-19T09:00', expectedDateBasis: 'CONFIRMED', estimatedMonths: null, status: 'OPEN' },
    events: [
      event('re-125-pc3', 'PREGNANCY_CHECK', '2026-06-10T09:00', 'Khám thai · Có thai', 'Siêu âm · BS. Trần Văn Bình', { result: 'PREGNANT', method: 'ULTRASOUND', examiner: 'BS. Trần Văn Bình', linkedBreedingId: 're-125-b3', pregnancyId: 'preg-125-3' }),
      event('re-125-b3', 'BREEDING', '2026-05-12T07:30', 'Phối giống · lần 1', 'Phối nhân tạo · tinh BRD-118', { method: 'ARTIFICIAL_INSEMINATION', sireLabel: 'Tinh BRD-118 · Lai Sind', performer: 'Nguyễn Văn Tâm' }),
    ],
    calvings: [], revisions: [], indicators: { ageAtFirstCalvingMonths: 28, lastCalvingIntervalDays: null, daysSinceLastCalving: 141, daysOpen: null, conceptionSummary: '2 thai kỳ từ 3 lần phối', overdueForConception: false },
    declaredPregnancyAtEntryMonths: null, version: 1,
  },
  {
    cattleId: 'cattle-240', cattleCode: 'BC-000240', name: '—', earTag: 'VN-0472', sex: 'FEMALE', breed: 'Brahman đỏ',
    penId: 'pen-a2', penCode: 'A2', penName: 'Chuồng A2 · Bò cái sinh sản', herdStatus: 'ACTIVE', lifeStage: 'ADULT',
    purposeType: 'BREEDING', applicable: true, status: 'AWAITING_BREEDING', statusAt: '2026-10-02T09:00', ageMonths: 41,
    latestWeightKg: 352, parity: 0, earlierCalvings: 0, servicesInCurrentCycle: 0, lastCalvingAt: null,
    breedingWindow: null, nextAction: 'Theo dõi chu kỳ động dục', dueAt: null,
    eligibility: eligible(41, 352), openHealthCase: false, openPregnancy: null,
    events: [], calvings: [], revisions: [], indicators: { ageAtFirstCalvingMonths: null, lastCalvingIntervalDays: null, daysSinceLastCalving: null, daysOpen: null, conceptionSummary: 'Chưa có lứa đẻ', overdueForConception: false },
    declaredPregnancyAtEntryMonths: null, version: 1,
  },
]

