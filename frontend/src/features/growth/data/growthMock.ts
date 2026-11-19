import type { GrowthCattle, GrowthFilterOptions, GrowthMember, GrowthMethod, GrowthRecord } from '../types'
import { addDays } from '../domain/growthFormat'
import { basisOf } from '../domain/growthRules'

/** Đồng hồ demo: khớp các frame (hôm nay 20/10/2026). */
export const GROWTH_NOW = '2026-10-20T07:30'

export const GROWTH_MEMBERS: GrowthMember[] = [
  { id: 1, name: 'Trần Quốc Long' },
  { id: 2, name: 'Lê Thị Mai' },
]

const PENS = {
  A1: 'A1 – Bò cái sinh sản',
  A2: 'A2 – Bò mang thai',
  A3: 'A3 – Bê con',
  B1: 'B1 – Vỗ béo',
  C1: 'C1 – Bò tơ',
  C2: 'C2 – Bê cai sữa',
  D: 'D – Chuồng đẻ',
  Q: 'Q – Chuồng cách ly',
}

type Seed = Pick<GrowthCattle, 'code' | 'breed' | 'sex' | 'herdGroup' | 'lifeStage'> & Partial<GrowthCattle> & { pen: keyof typeof PENS }
const cow = ({ pen, ...c }: Seed): GrowthCattle => ({ penCode: pen, penName: PENS[pen], herdEntryDate: '2025-03-10', status: 'ACTIVE', ...c })

export const GROWTH_CATTLE: GrowthCattle[] = [
  cow({ code: 'BC-000203', name: 'Bão', earTag: 'VN-BV-0512', breed: 'Zebu đỏ', sex: 'Đực', pen: 'B1', herdGroup: 'FATTENING', lifeStage: 'ADULT', targetWeightKg: 380 }),
  cow({ code: 'BC-000150', breed: 'Zebu đỏ', sex: 'Đực', pen: 'B1', herdGroup: 'FATTENING', lifeStage: 'ADULT', targetWeightKg: 450 }),
  cow({ code: 'BC-000061', name: 'Nâu', breed: 'Lai Sind', sex: 'Cái', pen: 'B1', herdGroup: 'FATTENING', lifeStage: 'ADULT', targetWeightKg: 400 }),
  cow({ code: 'BC-000219', breed: 'Zebu đỏ', sex: 'Cái', pen: 'C2', herdGroup: 'CALVES', lifeStage: 'WEANED_CALF', herdEntryDate: '2026-06-01' }),
  cow({ code: 'BC-000087', name: 'Mận', breed: 'Lai Sind', sex: 'Cái', pen: 'D', herdGroup: 'BREEDING_FEMALES', lifeStage: 'ADULT' }),
  cow({ code: 'BC-000125', name: 'Hoa Đỏ', earTag: 'VN-BV-0457', breed: 'Zebu đỏ', sex: 'Cái', pen: 'A1', herdGroup: 'BREEDING_FEMALES', lifeStage: 'ADULT' }),
  cow({ code: 'BC-000131', breed: 'Lai Sind', sex: 'Cái', pen: 'A1', herdGroup: 'BREEDING_FEMALES', lifeStage: 'ADULT' }),
  cow({ code: 'BC-000154', breed: 'Zebu đỏ', sex: 'Cái', pen: 'A1', herdGroup: 'BREEDING_FEMALES', lifeStage: 'ADULT' }),
  cow({ code: 'BC-000092', breed: 'Zebu đỏ', sex: 'Cái', pen: 'A2', herdGroup: 'BREEDING_FEMALES', lifeStage: 'ADULT' }),
  cow({ code: 'BC-000110', breed: 'Lai Sind', sex: 'Cái', pen: 'A2', herdGroup: 'BREEDING_FEMALES', lifeStage: 'ADULT' }),
  cow({ code: 'BC-000142', breed: 'Zebu đỏ', sex: 'Cái', pen: 'C1', herdGroup: 'YOUNG_STOCK', lifeStage: 'YOUNG_STOCK' }),
  cow({ code: 'BC-000174', breed: 'Lai Sind', sex: 'Đực', pen: 'C1', herdGroup: 'YOUNG_STOCK', lifeStage: 'YOUNG_STOCK' }),
  cow({ code: 'BC-000231', breed: 'Lai Sind', sex: 'Đực', pen: 'A3', herdGroup: 'CALVES', lifeStage: 'UNWEANED_CALF', herdEntryDate: '2026-04-02' }),
  cow({ code: 'BC-000199', breed: 'Zebu đỏ', sex: 'Cái', pen: 'A3', herdGroup: 'CALVES', lifeStage: 'UNWEANED_CALF', herdEntryDate: '2026-04-20' }),
  cow({ code: 'BC-000188', breed: 'Zebu đỏ', sex: 'Đực', pen: 'C2', herdGroup: 'CALVES', lifeStage: 'WEANED_CALF', herdEntryDate: '2026-02-11' }),
  cow({ code: 'BC-000248', breed: 'Lai Sind', sex: 'Cái', pen: 'Q', herdGroup: 'OTHER', lifeStage: 'ADULT', herdEntryDate: '2026-08-01' }),
]

let seq = 0
const rec = (
  cattleCode: string,
  measuredAt: string,
  kg: number | undefined,
  method: GrowthMethod | undefined,
  bcs?: number,
  extra: Partial<GrowthRecord> = {},
): GrowthRecord => {
  const by = extra.measuredBy ?? 1
  return {
    id: ++seq,
    cattleCode,
    measuredAt,
    recordedAt: measuredAt,
    measuredBy: by,
    measuredByName: GROWTH_MEMBERS.find((m) => m.id === by)?.name ?? 'Trần Quốc Long',
    method,
    weightKg: kg,
    basis: basisOf(method),
    bcs,
    status: 'VALID',
    corrected: false,
    version: 1,
    revisions: [],
    ...extra,
  }
}

/** Hai lần cân: lần trước cách lần gần nhất 56 ngày, chênh lệch theo ADG mong muốn. */
const pair = (code: string, day: string, kg: number, adg: number, method: GrowthMethod, bcs?: number): GrowthRecord[] => [
  rec(code, `${addDays(day, -56)}T07:00`, Math.round((kg - adg * 56) * 10) / 10, method, bcs),
  rec(code, `${day}T07:10`, kg, method, bcs),
]

const bao: GrowthRecord[] = [
  rec('BC-000203', '2026-03-25T07:15', 205, 'SCALE', 2.5),
  rec('BC-000203', '2026-04-22T07:05', 224, 'SCALE', 2.5),
  rec('BC-000203', '2026-05-20T07:00', 243, 'SCALE', 2.5),
  rec('BC-000203', '2026-06-18T07:20', 262, 'SCALE', 2.5),
  rec('BC-000203', '2026-07-20T07:10', 282, 'SCALE', 2.5, {
    corrected: true,
    version: 2,
    revisions: [{ at: '2026-07-21T09:00', by: 'Lê Thị Mai', action: 'CORRECT', reason: 'Nhập nhầm 328 thay vì 282 – đối chiếu sổ cân', before: { measuredAt: '2026-07-20T07:10', method: 'SCALE', weightKg: 328, bcs: 2.5 } }],
  }),
  rec('BC-000203', '2026-08-15T06:50', 293, 'SCALE', 3),
  rec('BC-000203', '2026-09-02T07:00', 251, 'TAPE', undefined, { measuredBy: 2, status: 'EXCLUDED', heartGirthCm: 150, bodyLengthCm: 128 }),
  rec('BC-000203', '2026-09-12T07:05', 306, 'SCALE', 3),
  rec('BC-000203', '2026-10-10T07:20', 318, 'TAPE', 3, { heartGirthCm: 158, bodyLengthCm: 132 }),
]

export const GROWTH_RECORDS: GrowthRecord[] = [
  ...bao,
  ...pair('BC-000150', '2026-10-16', 402, 0.78, 'SCALE', 3.5),
  rec('BC-000061', '2026-10-01T07:30', 338, 'SCALE', 3),
  ...pair('BC-000087', '2026-10-08', 365, 0.12, 'SCALE', 2),
  ...pair('BC-000125', '2026-10-12', 342, 0.31, 'SCALE', 3.5),
  ...pair('BC-000131', '2026-10-11', 351, 0.28, 'SCALE', 3),
  ...pair('BC-000154', '2026-10-09', 336, 0.33, 'SCALE', 3),
  ...pair('BC-000092', '2026-10-05', 372, 0.25, 'SCALE', 3.5),
  ...pair('BC-000110', '2026-10-03', 359, 0.22, 'SCALE', 3),
  ...pair('BC-000142', '2026-10-15', 236, 0.52, 'SCALE', 3),
  ...pair('BC-000174', '2026-09-12', 251, 0.48, 'SCALE', 3),
  ...pair('BC-000231', '2026-10-14', 74, 0.6, 'TAPE'),
  ...pair('BC-000199', '2026-10-13', 68, 0.55, 'TAPE'),
  ...pair('BC-000188', '2026-10-17', 128, 0.62, 'SCALE', 2.5),
  ...pair('BC-000248', '2026-10-06', 301, 0.18, 'SCALE', 2),
]

export const GROWTH_FILTER_OPTIONS: GrowthFilterOptions = {
  pens: Object.entries(PENS).map(([code, label]) => ({ code, label })),
  herdGroups: [
    { value: 'CALVES', label: 'Bê' },
    { value: 'FATTENING', label: 'Vỗ béo' },
    { value: 'BREEDING_BULLS', label: 'Đực giống' },
    { value: 'BREEDING_FEMALES', label: 'Cái sinh sản' },
    { value: 'YOUNG_STOCK', label: 'Bò tơ' },
    { value: 'OTHER', label: 'Khác' },
  ],
  lifeStages: [
    { value: 'UNWEANED_CALF', label: 'Bê chưa cai sữa' },
    { value: 'WEANED_CALF', label: 'Bê cai sữa' },
    { value: 'YOUNG_STOCK', label: 'Bò tơ' },
    { value: 'ADULT', label: 'Trưởng thành' },
  ],
}

export const GROWTH_DEMO = { cattle: GROWTH_CATTLE, records: GROWTH_RECORDS, nextId: seq + 1 }
export type GrowthSeed = typeof GROWTH_DEMO
