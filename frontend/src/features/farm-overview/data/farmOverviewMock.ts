import type {
  AttentionSeed, FarmOverviewSeed, HerdCell, HerdGroup, LifeStage, PenInfo, ReminderSeed, ReportRowSeed, ViewerRole,
} from '../types'

const PENS: PenInfo[] = [
  { code: 'A1', name: 'Sinh sản', capacity: 50 },
  { code: 'A2', name: 'Bò mang thai', capacity: 32 },
  { code: 'D', name: 'Chuồng đẻ', capacity: 10 },
  { code: 'B1', name: 'Bò tơ', capacity: 40 },
  { code: 'B3', name: 'Cách ly – điều trị', capacity: 10 },
  { code: 'C1', name: 'Phối giống', capacity: 20 },
  { code: 'C2', name: 'Chuồng C2', capacity: 48 },
  { code: 'D1', name: 'Vỗ béo', capacity: 40 },
  { code: 'Đ1', name: 'Bê', capacity: 50 },
]
const penLabel = (code: string) => `${code} · ${PENS.find((p) => p.code === code)!.name}`

const ZERO: Omit<HerdCell, 'pen' | 'group' | 'stage' | 'head' | 'zebu'> = {
  pregnant: 0, treating: 0, monitoring: 0, withdrawal: 0, dosesDue: 0, dosesOverdue: 0, calving30: 0, calving7: 0, weighOverdue: 0, adgN: 0, adg30: 0,
}
const cell = (pen: string, group: HerdGroup, stage: LifeStage, head: number, zebu: number, extra: Partial<HerdCell> = {}): HerdCell => ({
  pen, group, stage, head, zebu, ...ZERO, ...extra,
})

// 248 con: Zebu đỏ 142 + Lai Sind 106; 7 con cần chú ý sức khỏe; 18 mũi đến hạn (3 quá hạn); 6 con sắp đẻ; 12 con quá hạn cân.
const CELLS: HerdCell[] = [
  cell('A1', 'BREEDING_FEMALE', 'ADULT', 50, 29, { pregnant: 17, dosesDue: 8, dosesOverdue: 2, calving30: 3, calving7: 1, weighOverdue: 2 }),
  cell('A2', 'BREEDING_FEMALE', 'ADULT', 22, 13, { pregnant: 14, dosesDue: 3, calving30: 2, calving7: 1, weighOverdue: 1 }),
  cell('D', 'BREEDING_FEMALE', 'ADULT', 6, 4, { pregnant: 6, calving30: 1 }),
  cell('C1', 'BREEDING_FEMALE', 'ADULT', 10, 6, { pregnant: 1, treating: 1, dosesDue: 2, dosesOverdue: 1, weighOverdue: 1 }),
  cell('C2', 'BREEDING_FEMALE', 'ADULT', 8, 5, { pregnant: 3 }),
  cell('C1', 'BREEDING_BULL', 'ADULT', 4, 4),
  cell('B1', 'YOUNG_STOCK', 'YOUNG_STOCK', 38, 22, { treating: 1, dosesDue: 2, weighOverdue: 3, adgN: 35, adg30: 0.51 }),
  cell('B3', 'OTHER', 'ADULT', 4, 2, { treating: 2, monitoring: 2, withdrawal: 2 }),
  cell('C2', 'FATTENING', 'YOUNG_STOCK', 24, 14, { treating: 1, dosesDue: 1, weighOverdue: 3, adgN: 10, adg30: 0.75 }),
  cell('D1', 'FATTENING', 'ADULT', 40, 20, { weighOverdue: 2, adgN: 14, adg30: 0.8 }),
  cell('Đ1', 'CALF', 'UNWEANED_CALF', 20, 11, { dosesDue: 1 }),
  cell('Đ1', 'CALF', 'WEANED_CALF', 22, 12, { dosesDue: 1 }),
]

const ATTENTION: AttentionSeed[] = [
  { code: 'BC-000024', pen: 'B1', group: 'YOUNG_STOCK', stage: 'YOUNG_STOCK', issue: 'Mũi LMLM lần 2 – quá hạn 2 ngày', status: 'Quá hạn', tone: 'err', kind: 'A01', to: '/cattle/BC-000024?tab=vaccine' },
  { code: 'BC-000118', pen: 'C2', group: 'BREEDING_FEMALE', stage: 'ADULT', issue: 'Dự kiến đẻ 29/10 – chuẩn bị chuồng đẻ', status: 'Sắp đẻ', tone: 'warn', kind: 'A01', to: '/sinh-san' },
  { code: 'BC-000142', pen: 'C1', group: 'BREEDING_FEMALE', stage: 'ADULT', issue: 'Cửa sổ phối hôm nay 14:30–18:30', status: 'Nên phối', tone: 'info', kind: 'A01', to: '/sinh-san' },
  { code: 'BC-000076', pen: 'B3', group: 'OTHER', stage: 'ADULT', issue: 'Ca viêm phổi mở hôm nay', status: 'Đang điều trị', tone: 'err', kind: 'A01', to: '/suc-khoe' },
  { code: 'BC-000131', pen: 'C2', group: 'BREEDING_FEMALE', stage: 'ADULT', issue: 'Khám thai đến hạn (45 ngày sau phối)', status: 'Đến hạn khám', tone: 'info', kind: 'A01', to: '/sinh-san' },
  { code: 'Bê của BC-000097', pen: 'Đ1', group: 'CALF', stage: 'UNWEANED_CALF', issue: 'Bê sinh 24/10 chờ xác nhận nhập đàn', status: 'Chờ xác nhận', tone: 'warn', kind: 'A02', to: '/sinh-san' },
  { code: 'BC-000061', pen: 'A2', group: 'BREEDING_FEMALE', stage: 'ADULT', issue: 'Phiếu xuất chết PX-2026-0012 chờ chủ trại', status: 'Chờ xác nhận', tone: 'warn', kind: 'A03', to: '/herd-exit', ownerOnly: true },
  { code: 'BC-000088', pen: 'D1', group: 'FATTENING', stage: 'ADULT', issue: 'Đạt khối lượng xuất chuồng · 452 kg', status: 'Đạt cân xuất', tone: 'ok', kind: 'A04', to: '/can-nang' },
]

const ALL: ViewerRole[] = ['OWNER', 'MANAGER', 'TECHNICIAN']
const MGMT: ViewerRole[] = ['OWNER', 'MANAGER']
const d = (day: string, time = '08:00') => `2026-10-${day}T${time}:00+07:00`
const VACCINE_TAB = (code: string) => `/cattle/${code}?tab=vaccine`

// "Hôm nay" của trại mẫu: T3 20/10/2026. Hạn của REM-09/10/12/13 đặt trong 7 ngày tới để đủ 17 nhắc việc như Figma.
const REMINDERS: ReminderSeed[] = [
  { id: 1, rule: 'Theo dõi ca bệnh', type: 'health', title: 'Tái khám sau điều trị', code: 'BC-000076', breed: 'Zebu đỏ', pen: 'B3', due: d('19', '09:00'), basis: 'Lịch tái khám của ca viêm phổi (5 ngày sau khi điều trị)', parameterVersion: null, source: 'Ca viêm phổi mở 14/10 · đang dùng kháng sinh', to: '/suc-khoe', openLabel: 'Cập nhật hồ sơ', audience: ALL },
  { id: 2, rule: 'REM-06 · Mũi vắc-xin theo lịch', type: 'vaccination', title: 'Tiêm nhắc lại mũi 2', code: 'BC-000021', breed: 'Lai Sind', pen: 'B1', due: d('19'), basis: 'Mũi 2 đến hạn 21 ngày sau mũi 1', parameterVersion: 3, source: 'Lịch LMLM · liều 2 · Aftopor (tiêm bắp)', to: VACCINE_TAB('BC-000021'), openLabel: 'Cập nhật hồ sơ', audience: ALL },
  { id: 3, rule: 'REM-06 · Mũi vắc-xin theo lịch', type: 'vaccination', title: 'Tiêm phòng theo lịch', code: 'BC-000024', breed: 'Zebu đỏ', pen: 'B1', due: d('20', '08:30'), basis: 'Mũi 2 đến hạn 21 ngày sau mũi 1', parameterVersion: 3, source: 'Lịch LMLM · liều 2 · Aftopor (tiêm bắp)', to: VACCINE_TAB('BC-000024'), openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 4, rule: 'REM-03 · Đến hạn khám thai', type: 'pregnancy-check', title: 'Khám thai lần tiếp theo', code: 'BC-000118', breed: 'Lai Sind', pen: 'C2', due: d('20', '10:00'), basis: 'Lần phối + 28 ngày', parameterVersion: 2, source: 'Lần phối 22/09 · TTNT', to: '/sinh-san', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 5, rule: 'REM-01 · Đến hạn cân', type: 'weighing', title: 'Cân đo tăng trưởng', code: 'BC-000133', breed: 'Lai Sind', pen: 'D1', due: d('20', '14:00'), basis: 'Lần cân gần nhất + 30 ngày', parameterVersion: 1, source: 'Lần cân gần nhất 20/09 · 438 kg', to: '/can-nang', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 6, rule: 'REM-02 · Khung phối giống', type: 'breeding', title: 'Khung phối gợi ý 14:30–18:30', code: 'BC-000142', breed: 'Zebu đỏ', pen: 'C1', due: d('20', '14:30'), windowEnd: d('20', '18:30'), basis: 'Động dục ghi nhận 06:30 + 8 đến 12 giờ', parameterVersion: 1, source: 'Động dục 06:30 ngày 20/10', to: '/sinh-san', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 7, rule: 'REM-05 · Sắp đẻ', type: 'calving', title: 'Dự kiến đẻ 22/10 – chuẩn bị chuồng đẻ', code: 'BC-000087', breed: 'Lai Sind', pen: 'D', due: d('22'), basis: 'Ngày đẻ dự kiến 22/10/2026 (CONFIRMED)', parameterVersion: 2, source: 'Khám thai dương tính 02/08', to: '/sinh-san', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 8, rule: 'REM-01 · Đến hạn cân', type: 'weighing', title: 'Cân định kỳ', code: 'BC-000219', breed: 'Lai Sind', pen: 'C2', due: d('21'), basis: 'Lần cân gần nhất + 30 ngày', parameterVersion: 1, source: 'Lần cân gần nhất 21/09 · 389 kg', to: '/can-nang', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 9, rule: 'REM-03 · Đến hạn khám thai', type: 'pregnancy-check', title: 'Khám thai đến hạn (45 ngày sau phối)', code: 'BC-000131', breed: 'Lai Sind', pen: 'C2', due: d('23'), basis: 'Lần phối + 45 ngày', parameterVersion: 2, source: 'Lần phối 08/09 · TTNT', to: '/sinh-san', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 10, rule: 'REM-05 · Sắp đẻ', type: 'calving', title: 'Dự kiến đẻ 27/10 – chuẩn bị chuồng đẻ', code: 'BC-000118', breed: 'Lai Sind', pen: 'C2', due: d('27'), basis: 'Ngày đẻ dự kiến 27/10/2026 (TENTATIVE)', parameterVersion: 2, source: 'Khám thai dương tính 12/08', to: '/sinh-san', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 11, rule: 'REM-06 · Mũi vắc-xin theo lịch', type: 'vaccination', title: 'Tiêm LMLM mũi 2 · 12 con · chuồng B1', code: null, breed: null, pen: 'B1', group: '12 con · chuồng B1', due: d('24'), basis: 'Mũi 2 đến hạn 21 ngày sau mũi 1', parameterVersion: 3, source: 'Lịch LMLM · liều 2 · 12 con', to: '/tiem-phong', openLabel: 'Mở lịch tiêm', audience: ALL },
  { id: 12, rule: 'REM-08 · Gợi ý giai đoạn', type: 'pen-stage', title: 'Đủ tuổi chuyển giai đoạn: Bê đã cai sữa → Bò tơ', code: 'BC-000149', breed: 'Zebu đỏ', pen: 'Đ1', due: d('22'), basis: 'Tuổi cai sữa 6 tháng', parameterVersion: 1, source: 'Ngày sinh 22/04/2026', to: '/cattle/BC-000149', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 13, rule: 'REM-07 · Sẵn sàng phối sau đẻ', type: 'breeding', title: 'Sẵn sàng phối sau đẻ', code: 'BC-000071', breed: 'Lai Sind', pen: 'A2', due: null, basis: null, basisMissing: 'khoảng nghỉ sau đẻ (tham số trại)', parameterVersion: null, source: 'Đẻ 05/09/2026', to: '/sinh-san', openLabel: 'Mở hồ sơ', audience: ALL },
  { id: 14, rule: 'REM-09 · Bê nháp chờ xác nhận', type: 'draft-calf', title: 'Bê sinh 17/10 chờ xác nhận nhập đàn', code: 'Bê của BC-000097', breed: 'Zebu đỏ', pen: 'Đ1', due: d('21'), highlighted: true, basis: 'Hiển thị ngay khi bê được ghi nhận; nổi bật sau 3 ngày', parameterVersion: null, source: 'Phiếu đẻ ngày 17/10', to: '/sinh-san', openLabel: 'Mở hồ sơ', audience: MGMT },
  { id: 15, rule: 'REM-10 · Tồn kho thức ăn thấp', type: 'feed', title: 'Cám hỗn hợp dưới mức tồn tối thiểu', code: null, breed: null, pen: null, group: 'Kho thức ăn', due: d('21'), basis: 'Tồn kho ≤ mức tối thiểu', parameterVersion: null, source: 'Cám hỗn hợp · tồn 420 kg / tối thiểu 500 kg', to: '/thuc-an', openLabel: 'Mở kho', audience: MGMT },
  { id: 16, rule: 'REM-12 · Chết/mất chờ xác nhận', type: 'exit-finishing', title: 'Phiếu xuất chết PX-2026-0012 chờ chủ trại', code: 'BC-000061', breed: 'Zebu đỏ', pen: 'A2', due: d('22'), highlighted: true, basis: 'Hiển thị ngay; nổi bật sau 3 ngày', parameterVersion: null, source: 'Ca đóng với kết cục CHẾT ngày 17/10', to: '/herd-exit', openLabel: 'Mở phiếu', audience: MGMT },
  { id: 17, rule: 'REM-13 · Đạt khối lượng xuất chuồng', type: 'exit-finishing', title: 'Đạt khối lượng xuất chuồng · 452 kg', code: 'BC-000088', breed: 'Lai Sind', pen: 'D1', due: d('22'), basis: 'Cân gần nhất ≥ khối lượng xuất chuồng mục tiêu', parameterVersion: 1, source: 'Lần cân 19/10 · 452 kg', to: '/can-nang', openLabel: 'Mở hồ sơ', audience: MGMT },
]

const pen = (code: string, groups: HerdGroup[], stages: LifeStage[], v: Record<string, number>, missing?: number): ReportRowSeed => ({ pen: code, label: penLabel(code), groups, stages, v, missing })
const BF: HerdGroup[] = ['BREEDING_FEMALE']
const ADULT: LifeStage[] = ['ADULT']

const HERD_MOVES: Array<[string, HerdGroup[], LifeStage[], number, number, number, number, number]> = [
  // chuồng, nhóm, giai đoạn, số con, nhập, xuất, chuyển đến, chuyển đi
  ['A1', BF, ADULT, 50, 3, 1, 4, 1], ['A2', BF, ADULT, 22, 1, 0, 2, 3], ['D', BF, ADULT, 6, 0, 0, 3, 0],
  ['B1', ['YOUNG_STOCK'], ['YOUNG_STOCK'], 38, 4, 0, 0, 3], ['B3', ['OTHER'], ADULT, 4, 0, 1, 1, 2],
  ['C1', ['BREEDING_FEMALE', 'BREEDING_BULL'], ADULT, 14, 1, 0, 0, 1], ['C2', ['BREEDING_FEMALE', 'FATTENING'], ['ADULT', 'YOUNG_STOCK'], 32, 2, 1, 2, 2],
  ['D1', ['FATTENING'], ADULT, 40, 2, 3, 0, 0], ['Đ1', ['CALF'], ['UNWEANED_CALF', 'WEANED_CALF'], 42, 5, 0, 0, 0],
]

const REPORTS: FarmOverviewSeed['reports'] = {
  'RPT-01': HERD_MOVES.map(([p, g, s, head, inn, out]) => pen(p, g, s, { head, in: inn, out })),
  'RPT-02': [
    pen('B1', ['YOUNG_STOCK'], ['YOUNG_STOCK'], { weigh: 35, est: 3, avgW: 286, adg: 0.51 }),
    pen('C2', ['FATTENING'], ['YOUNG_STOCK'], { weigh: 28, est: 4, avgW: 402, adg: 0.75 }),
    pen('D1', ['FATTENING'], ADULT, { weigh: 40, est: 2, avgW: 468, adg: 0.8 }),
  ],
  'RPT-03': ['LMLM · mũi 1', 'LMLM · mũi 2', 'Tụ huyết trùng'].map((label, i) => ({
    pen: '', label, groups: [], stages: [], v: [{ planned: 120, done: 116, deferred: 2, overdue: 2 }, { planned: 96, done: 85, deferred: 8, overdue: 3 }, { planned: 64, done: 60, deferred: 2, overdue: 2 }][i],
  })),
  'RPT-04': [
    pen('B3', ['OTHER'], ADULT, { opened: 4, chronic: 1, closed: 3, treat: 7, withdraw: 2 }),
    pen('B1', ['YOUNG_STOCK'], ['YOUNG_STOCK'], { opened: 2, chronic: 1, closed: 1, treat: 2, withdraw: 0 }),
    pen('C1', ['BREEDING_FEMALE'], ADULT, { opened: 1, chronic: 0, closed: 1, treat: 2, withdraw: 0 }),
    pen('C2', ['FATTENING'], ['YOUNG_STOCK'], { opened: 2, chronic: 0, closed: 1, treat: 3, withdraw: 0 }),
  ],
  'RPT-05': [
    pen('A1', BF, ADULT, { cows: 58, breed: 29, ttnt: 24, check: 24, preg: 14, calv: 6, live: 5, still: 1, fs: 17, fsPreg: 11, intervalDays: 412, intervalN: 31 }),
    pen('A2', BF, ADULT, { cows: 22, breed: 8, ttnt: 6, check: 8, preg: 8, calv: 7, live: 7, still: 0, fs: 9, fsPreg: 5, intervalDays: 398, intervalN: 19 }),
    pen('D', BF, ADULT, { cows: 6, breed: 4, ttnt: 3, check: 4, preg: 4, calv: 5, live: 5, still: 0, fs: 7, fsPreg: 3, intervalDays: 0, intervalN: 0 }, 4),
  ],
  'RPT-06': HERD_MOVES.map(([p, g, s, , inn, out, moveIn, moveOut]) => pen(p, g, s, { in: inn, out, moveIn, moveOut })),
  'RPT-07': [
    pen('C2', ['FATTENING'], ['YOUNG_STOCK'], { head: 24, incl: 20, startW: 310, endW: 352, adg: 0.75, feed: 7.8, cost: 38500, reached: 3 }, 4),
    pen('D1', ['FATTENING'], ADULT, { head: 40, incl: 38, startW: 410, endW: 455, adg: 0.8, feed: 8.2, cost: 41200, reached: 7 }, 2),
  ],
}

const CATALOGUE_DONE = { PENS: true, REFERENCE_MEDICINES: true, INVITE_MEMBERS: true, FIRST_HERD_ENTRY: true }

export const FARM_OVERVIEW_SEED: FarmOverviewSeed = {
  dashboards: {
    default: {
      farmName: 'Trại bò Yên Bài – Ba Vì',
      serviceLabel: 'Đang hoạt động',
      serviceUntil: '2026-11-14',
      generatedAt: d('26'),
      pens: PENS,
      cells: CELLS,
      attention: ATTENTION,
      reproduction: { calvingIntervalDays: 412, conceptionRate: 58, overdueFemales: 5 },
      onboarding: { data: CATALOGUE_DONE, marked: ['BREEDS_PURPOSES', 'VACCINE_DOSES', 'FARM_PARAMETERS'], dismissed: true },
    },
    'new-farm': {
      farmName: 'Trại bò Yên Bài – Ba Vì',
      serviceLabel: 'Đang hoạt động',
      serviceUntil: '2026-11-14',
      generatedAt: d('26'),
      pens: [PENS[0]],
      cells: [],
      attention: [],
      reproduction: null,
      onboarding: { data: { PENS: true, REFERENCE_MEDICINES: false, INVITE_MEMBERS: false, FIRST_HERD_ENTRY: false }, marked: ['BREEDS_PURPOSES'], dismissed: false },
    },
  },
  today: '2026-10-20',
  reminders: REMINDERS,
  feeding: { label: 'Cữ chiều 16:30', unrecorded: 2, total: 5 },
  reports: REPORTS,
  reportGeneratedAt: d('26'),
  conceptionByMonth: [{ label: 'T7', value: 52 }, { label: 'T8', value: 61 }, { label: 'T9', value: 58 }],
}
