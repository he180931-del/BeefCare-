import type { HerdGroup, LifeStage, Schedule, ScheduledDose, VaccCattle, VaccinationOptions, VaccinationRecord, VaccineItem } from '../types'
import { addDays } from '../domain/vaccinationFormat'
import { doseDate, resolveTarget } from '../domain/vaccinationRules'

/** Đồng hồ demo: khớp các frame (hôm nay 20/10/2026 08:15). */
export const VACC_NOW = '2026-10-20T08:15'

export const VACCINES: VaccineItem[] = [
  { id: 1, name: 'Aftopor (LMLM type O)', shortName: 'Aftopor (LMLM)', disease: 'Lở mồm long móng type O', referenceDose: 2, doseUnit: 'ml', route: 'IM', withdrawalDays: 0, active: true },
  { id: 2, name: 'Pasteurella (Tụ huyết trùng)', shortName: 'Pasteurella', disease: 'Tụ huyết trùng', referenceDose: 2, doseUnit: 'ml', route: 'IM', withdrawalDays: 0, active: true },
  { id: 3, name: 'LSD vaccine (Viêm da nổi cục)', shortName: 'LSD', disease: 'Viêm da nổi cục', referenceDose: 2, doseUnit: 'ml', route: 'SC', withdrawalDays: 0, active: true },
]

export const MEMBERS = [
  { id: 1, name: 'Trần Quốc Long' },
  { id: 2, name: 'Lê Thị Mai' },
]

type PenKey = 'A1' | 'A2' | 'A3' | 'B1' | 'C1' | 'C2' | 'D' | 'Q'
const PEN_DEF: Record<PenKey, { name: string; group: HerdGroup; stage: LifeStage }> = {
  A1: { name: 'A1 – Bò cái sinh sản', group: 'BREEDING_FEMALES', stage: 'ADULT' },
  A2: { name: 'A2 – Bò mang thai', group: 'BREEDING_FEMALES', stage: 'ADULT' },
  D: { name: 'D – Chuồng đẻ', group: 'BREEDING_FEMALES', stage: 'ADULT' },
  B1: { name: 'B1 – Vỗ béo', group: 'FATTENING', stage: 'ADULT' },
  A3: { name: 'A3 – Bê con', group: 'CALVES', stage: 'UNWEANED_CALF' },
  C1: { name: 'C1 – Bò tơ', group: 'YOUNG_STOCK', stage: 'YOUNG_STOCK' },
  C2: { name: 'C2 – Bê cai sữa', group: 'CALVES', stage: 'WEANED_CALF' },
  Q: { name: 'Q – Chuồng cách ly', group: 'OTHER', stage: 'ADULT' },
}
const QUOTA: Array<[PenKey, number]> = [['A1', 39], ['A2', 30], ['D', 16], ['B1', 46], ['A3', 30], ['C1', 40], ['C2', 41], ['Q', 6]]
const NAMED: Record<number, { pen: PenKey; name?: string; breed: string; sex: 'Đực' | 'Cái' }> = {
  125: { pen: 'A1', name: 'Hoa Đỏ', breed: 'Zebu đỏ', sex: 'Cái' },
  131: { pen: 'A1', breed: 'Lai Sind', sex: 'Cái' },
  154: { pen: 'A1', breed: 'Zebu đỏ', sex: 'Cái' },
  92: { pen: 'A2', breed: 'Zebu đỏ', sex: 'Cái' },
  110: { pen: 'A2', breed: 'Lai Sind', sex: 'Cái' },
  87: { pen: 'D', name: 'Mận', breed: 'Lai Sind', sex: 'Cái' },
  61: { pen: 'B1', name: 'Nâu', breed: 'Lai Sind', sex: 'Cái' },
  203: { pen: 'B1', name: 'Bão', breed: 'Zebu đỏ', sex: 'Đực' },
  248: { pen: 'Q', breed: 'Lai Sind', sex: 'Cái' },
}

/** Đàn 248 con: số lượng mỗi chuồng khớp các con số trong frame (86 sinh sản, 46 vỗ béo). */
function buildPool(): VaccCattle[] {
  const left = new Map<PenKey, number>(QUOTA)
  Object.values(NAMED).forEach((n) => left.set(n.pen, (left.get(n.pen) ?? 0) - 1))
  const pool: VaccCattle[] = []
  for (let n = 1; n <= 248; n++) {
    const named = NAMED[n]
    let pen: PenKey
    if (named) pen = named.pen
    else {
      pen = QUOTA.find(([p]) => (left.get(p) ?? 0) > 0)![0]
      left.set(pen, (left.get(pen) ?? 0) - 1)
    }
    const def = PEN_DEF[pen]
    const mixed = pen === 'A3' || pen === 'C1' || pen === 'C2'
    pool.push({
      code: `BC-${String(n).padStart(6, '0')}`,
      name: named?.name,
      breed: named?.breed ?? (n % 2 ? 'Zebu đỏ' : 'Lai Sind'),
      sex: named?.sex ?? (pen === 'B1' ? (n % 3 ? 'Đực' : 'Cái') : mixed ? (n % 2 ? 'Đực' : 'Cái') : 'Cái'),
      penCode: pen,
      penName: def.name,
      herdGroup: def.group,
      lifeStage: def.stage,
      herdEntryDate: n === 248 ? '2026-08-01' : '2024-01-01',
      status: 'ACTIVE',
    })
  }
  return pool
}

const SCHEDULES: Schedule[] = [
  { id: 1, name: 'LMLM 2026 – Đàn sinh sản', vaccineId: 1, firstDueDate: '2026-09-17', doseCount: 2, intervalDays: 28, boosterIntervalMonths: 6, status: 'ACTIVE', version: 1, target: { penCodes: ['A1', 'A2', 'D'], herdGroups: ['BREEDING_FEMALES'], lifeStages: ['ADULT'], excluded: [], added: ['BC-000061'] } },
  { id: 2, name: 'Tụ huyết trùng – Toàn đàn', vaccineId: 2, firstDueDate: '2026-07-25', doseCount: 1, boosterIntervalMonths: 6, status: 'ACTIVE', version: 1, target: { penCodes: [], herdGroups: [], lifeStages: [], excluded: [], added: [] } },
  { id: 3, name: 'Viêm da nổi cục – Vỗ béo', vaccineId: 3, firstDueDate: '2026-10-27', doseCount: 1, status: 'ACTIVE', version: 1, target: { penCodes: ['B1'], herdGroups: ['FATTENING'], lifeStages: [], excluded: [], added: [] } },
]

function buildSeed() {
  const cattle = buildPool()
  let doseSeq = 0
  let recSeq = 0
  const doses: ScheduledDose[] = []
  const records: VaccinationRecord[] = []
  const label = (vaccineId: number) => VACCINES.find((v) => v.id === vaccineId)!.shortName

  const rec = (cattleCode: string, administeredAt: string, vaccineId: number, doseText: string | undefined, over: Partial<VaccinationRecord> = {}): VaccinationRecord => {
    const r: VaccinationRecord = {
      id: ++recSeq, cattleCode, vaccineId, vaccineLabel: label(vaccineId), doseText, dose: '2 ml', route: vaccineId === 3 ? 'SC' : 'IM',
      administeredAt, precision: 'EXACT', source: 'ON_FARM', vaccinator: 'Trần Quốc Long', withdrawalDays: 0, status: 'VALID', corrected: false, version: 1, revisions: [], ...over,
    }
    records.push(r)
    return r
  }
  const dose = (s: Schedule, cattleCode: string, doseNo: number, dueDate: string, over: Partial<ScheduledDose> = {}): ScheduledDose => {
    const d: ScheduledDose = { id: ++doseSeq, scheduleId: s.id, cattleCode, doseNo, kind: 'DOSE', dueDate, status: 'PLANNED', version: 1, ...over }
    doses.push(d)
    return d
  }
  const done = (d: ScheduledDose, r: VaccinationRecord) => {
    d.status = 'DONE'
    d.vaccinationId = r.id
    d.doneAt = r.administeredAt
    d.prior = { status: 'PLANNED' }
    r.scheduledDoseId = d.id
  }
  const pad = (n: number) => String(n).padStart(2, '0')

  // LMLM: mũi 1 đã tiêm cả 86 con; mũi 2 gồm 61 đã tiêm, 12 quá hạn, 4 hoãn, 9 chưa đến hạn.
  const [lmlm, pas, lsd] = SCHEDULES
  const first = ['BC-000125', 'BC-000131', 'BC-000154', 'BC-000061', 'BC-000092', 'BC-000110']
  const members = resolveTarget(cattle, lmlm.target)
  const ordered = [...first.map((c) => members.find((m) => m.code === c)!), ...members.filter((m) => !first.includes(m.code))]
  const namedDue = ['2026-10-15', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-17', '2026-10-18']
  const futureDue = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02']
  ordered.forEach((c, i) => {
    const d1 = dose(lmlm, c.code, 1, doseDate(lmlm, 1))
    done(d1, rec(c.code, `2026-09-17T08:${pad(20 + (i % 40))}`, 1, 'mũi 1/2', { batchNo: 'AFT-2608-03', reactionCaseCode: c.code === 'BC-000154' ? 'HC-0418' : undefined, reactionNote: c.code === 'BC-000154' ? 'sưng' : undefined }))
    if (i < 12) dose(lmlm, c.code, 2, i < 6 ? namedDue[i] : '2026-10-19')
    else if (i < 16) dose(lmlm, c.code, 2, '2026-10-15', { status: 'DEFERRED', newExpectedDate: addDays('2026-10-25', i - 12), deferralReason: 'Bò yếu sau sốt nhẹ' })
    else if (i < 25) dose(lmlm, c.code, 2, futureDue[i - 16])
    else done(dose(lmlm, c.code, 2, doseDate(lmlm, 2)), rec(c.code, `2026-10-${15 + (i % 5)}T08:${pad(10 + (i % 40))}`, 1, 'mũi 2/2', { batchNo: 'AFT-2609-17' }))
  })

  // Tụ huyết trùng toàn đàn: 214 đã tiêm, 5 quá hạn, còn lại chưa đến hạn; BC-000125 chỉ có mũi nhắc lại.
  cattle.filter((c) => c.code !== 'BC-000125').forEach((c, i) => {
    if (i < 214) done(dose(pas, c.code, 1, pas.firstDueDate), rec(c.code, `${addDays(pas.firstDueDate, i % 60)}T07:${pad(10 + (i % 40))}`, 2, 'mũi 1', { batchNo: `PAS-2607-${pad(1 + (i % 9))}` }))
    else if (i < 219) dose(pas, c.code, 1, addDays('2026-10-12', i - 214))
    else dose(pas, c.code, 1, addDays('2026-11-03', i % 20))
  })
  doses.push({ id: ++doseSeq, scheduleId: pas.id, cattleCode: 'BC-000125', doseNo: 2, kind: 'BOOSTER', dueDate: '2027-04-15', status: 'PLANNED', version: 1 })

  resolveTarget(cattle, lsd.target).forEach((c) => dose(lsd, c.code, 1, lsd.firstDueDate))

  // Bản ghi lẻ lấy từ các frame.
  rec('BC-000125', '2026-06-12T07:40', 2, 'mũi 1', { batchNo: 'PAS-2605-11', status: 'VOIDED', version: 2 })
  rec('BC-000125', '2025-10-15T08:00', 2, 'mũi 1', { batchNo: 'PAS-2510-02' })
  rec('BC-000125', '2024-03-01T00:00', 1, undefined, { vaccineLabel: 'LMLM type O (người bán khai)', source: 'HISTORICAL', precision: 'MONTH', batchNo: undefined, dose: undefined, route: undefined, vaccinator: undefined })
  rec('BC-000203', '2026-10-02T07:30', 2, 'nhắc lại', { batchNo: 'PAS-2609-04', vaccinator: 'Lê Thị Mai' })
  rec('BC-000248', '2026-08-01T00:00', 1, undefined, { vaccineLabel: 'LMLM type O (người bán khai)', source: 'HISTORICAL', precision: 'MONTH', batchNo: undefined, dose: undefined, route: undefined, vaccinator: undefined })

  return { cattle, schedules: SCHEDULES, doses, records, nextDoseId: doseSeq + 1, nextRecordId: recSeq + 1, nextScheduleId: SCHEDULES.length + 1 }
}

export const VACC_DEMO = buildSeed()
export type VaccinationSeed = typeof VACC_DEMO

export const STATIC_OPTIONS: Omit<VaccinationOptions, 'now' | 'vaccines'> = {
  members: MEMBERS,
  pens: Object.entries(PEN_DEF).map(([code, d]) => ({ code, label: d.name })),
  herdGroups: [
    { value: 'CALVES', label: 'Bê' },
    { value: 'FATTENING', label: 'Vỗ béo' },
    { value: 'BREEDING_BULLS', label: 'Đực giống' },
    { value: 'BREEDING_FEMALES', label: 'Bò cái sinh sản' },
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
