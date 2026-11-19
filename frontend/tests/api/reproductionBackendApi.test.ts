import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendError } from '../../src/shared/api/backendClient'
import type { BackendTransport } from '../../src/api/backendTransport'
import { ReproductionDuplicateError, createReproductionBackend, mapReproductionError } from '../../src/features/reproduction/api/reproductionBackend'
import { ReproductionValidationError, isDueSoon } from '../../src/features/reproduction/domain/reproductionRules'
import type { CalvingCommand, ReproductionCommand } from '../../src/features/reproduction/types'

type Call = { method: string; path: string; body?: unknown }

function fakeTransport(routes: Record<string, unknown | ((body: unknown, path: string) => unknown)>) {
  const calls: Call[] = []
  const answer = (path: string, body?: unknown) => {
    const hit = routes[path] ?? routes[path.split('?')[0]] ?? (path === '/api/farms/1/context' ? { id: 1, timeZone: 'Asia/Ho_Chi_Minh' } : undefined)
    if (hit === undefined) throw new Error(`Unexpected request: ${path}`)
    return typeof hit === 'function' ? (hit as (b: unknown, p: string) => unknown)(body, path) : structuredClone(hit)
  }
  const transport: BackendTransport = {
    async get(path) { calls.push({ method: 'GET', path }); return answer(path) },
    async command(path, body, options) { calls.push({ method: options?.method ?? 'POST', path, body }); return answer(path, body) },
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
  }
  return { transport, calls }
}
const backendError = (status: number, code: string, params: Record<string, unknown> = {}) => new BackendError(status, { code, params, message: 'x' } as never)
async function rejection(promise: Promise<unknown>) {
  try { await promise } catch (e) { return e as Error }
  throw new Error('expected rejection')
}

// A2 của bò cái BC-087 (giờ trại = UTC+7): đẻ lứa trước, phối 2 lần, khám CÓ THAI, 1 diễn biến.
const profile = {
  cattleId: 87, code: 'BC-087', name: 'Mận', earTag: '0087', ageMonths: 40, sex: 'FEMALE', lifeStage: 'ADULT', purposeType: 'BREEDING', herdStatus: 'ACTIVE',
  breed: { id: 3, code: 'LS', name: 'Lai Sind' }, pen: { id: 21, code: 'D', name: 'Chuồng đẻ' }, version: 9, applicable: true, notApplicableReason: null,
  status: 'PREGNANT', statusSince: '2026-08-20T02:00:00Z', servicesInCycle: 2, parity: 2, lastCalving: { calvingId: 70, at: '2025-11-01T21:00:00Z' },
  latestWeight: { kg: 412.5, date: '2026-10-01' }, declaredPregnancyMonths: null,
  indicators: { ageAtFirstCalvingMonths: 26, lastIntervalDays: 390, daysSinceCalving: 368, daysOpen: 80, conceptions: 2, services: 3, overdue: false },
  canManage: true, allowedActions: ['PREGNANCY_CHECK', 'PREGNANCY_UPDATE', 'CALVING'], otherActions: ['PREGNANCY_CHECK', 'CALVING'],
  eligibility: null, window: null, latestBreeding: null,
  currentPregnancy: { episodeId: 5, version: 4, parity: 3, linkedBreedingId: 12, linkedBreedingAt: '2026-07-20T01:00:00Z', confirmingCheckId: 13, confirmedAt: '2026-08-20T02:00:00Z', expectedDate: '2027-04-29', basis: 'CONFIRMED', daysPregnant: 108, dueSoon: false },
  timeline: [
    { kind: 'ESTRUS', id: 10, at: '2026-07-19T23:30:00Z', recordedAt: '2026-07-20T00:00:00Z', recordedBy: 'Lê Quản Lý', source: 'DIRECT_OBSERVATION', status: 'VALID', corrected: false, version: 0, signs: ['STANDING', 'MUCUS'], description: null, observer: { id: 8, name: 'Nguyễn Kỹ Thuật' } },
    { kind: 'BREEDING', id: 11, at: '2026-07-20T00:00:00Z', recordedAt: '2026-07-20T00:10:00Z', recordedBy: 'Lê Quản Lý', source: 'DIRECT_OBSERVATION', status: 'VOIDED', corrected: false, version: 1, voidReason: 'Ghi nhầm', method: 'AI', sireSource: 'EXTERNAL', sireBreed: { id: 3, code: 'LS', name: 'Lai Sind' }, semenCode: 'ST-1', linkedEventId: 10 },
    { kind: 'BREEDING', id: 12, at: '2026-07-20T01:00:00Z', recordedAt: '2026-07-20T01:10:00Z', recordedBy: 'Lê Quản Lý', source: 'FARM_NOTEBOOK', status: 'VALID', corrected: true, version: 2, method: 'NATURAL', sireSource: 'INTERNAL', sire: { id: 301, code: 'BC-301', name: 'Sắm' }, performer: { id: null, name: 'Dẫn tinh viên' }, linkedEventId: 10, tentativeCalvingDate: '2027-04-29' },
    { kind: 'PREGNANCY_CHECK', id: 13, at: '2026-08-20T02:00:00Z', recordedAt: '2026-08-20T02:00:00Z', recordedBy: 'Lê Quản Lý', source: 'DIRECT_OBSERVATION', status: 'VALID', corrected: false, version: 0, method: 'ULTRASOUND', result: 'PREGNANT', examiner: { id: 7, name: 'Lê Quản Lý' }, linkedEventId: 12, episodeId: 5 },
    { kind: 'PREGNANCY_UPDATE', id: 40, at: '2026-09-10T03:00:00Z', recordedAt: '2026-09-10T03:00:00Z', recordedBy: 'Lê Quản Lý', source: 'DIRECT_OBSERVATION', status: 'VALID', corrected: false, version: 0, description: 'Phù chân', updateType: 'COMPLICATION', healthCaseId: 415, healthCaseCode: 'HC-000415', episodeId: 5 },
    { kind: 'CALVING', id: 70, at: '2025-11-01T21:00:00Z', recordedAt: '2025-11-02T01:00:00Z', recordedBy: 'Lê Quản Lý', source: 'DIRECT_OBSERVATION', status: 'VALID', corrected: false, version: 3, method: 'NORMAL', performer: { id: 7, name: 'Lê Quản Lý' }, episodeId: 2, calvingId: 70 },
  ],
  calvings: [{
    calvingId: 70, at: '2025-11-01T21:00:00Z', status: 'VALID', corrected: false, version: 3, source: 'DIRECT_OBSERVATION', attendant: { id: 7, name: 'Lê Quản Lý' },
    course: 'NORMAL', damCondition: 'NEEDS_MONITORING', retainedPlacenta: false, episodeId: 2,
    calves: [
      { calfId: 90, calfNo: 1, outcome: 'LIVE', sex: 'MALE', birthWeightKg: 24, weightBasis: 'MEASURED', tagCode: null, pen: { id: 21, code: 'D' }, breed: { id: 3, name: 'Lai Sind' }, registration: 'REGISTERED', cattleId: 501, cattleCode: 'BC-501', status: 'VALID', version: 2, corrected: false },
      { calfId: 91, calfNo: 2, outcome: 'LIVE', sex: 'FEMALE', birthWeightKg: null, weightBasis: null, tagCode: 'T-91', pen: { id: 21, code: 'D' }, breed: null, registration: 'PENDING_CONFIRMATION', status: 'VALID', version: 0, corrected: false },
    ],
  }],
}
const catalogue = {
  '/api/farms/1/cattle/resolve': { cattleId: 87 },
  '/api/farms/1/cattle/87/reproduction-history': profile,
  '/api/farms/1/members': [{ userId: 7, fullName: 'Lê Quản Lý', role: 'MANAGER', status: 'ACTIVE' }, { userId: 8, fullName: 'Nguyễn Kỹ Thuật', role: 'TECHNICIAN', status: 'ACTIVE' }],
  '/api/farms/1/cattle': { items: [{ id: 301, code: 'BC-301', name: 'Sắm', earTagNumber: 'VN-0101' }], total: 1 },
  '/api/farms/1/catalogues/breeds': { items: [{ id: 3, code: 'LS', name: 'Lai Sind', available: true }, { id: 4, code: 'BR', name: 'Brahman', available: true }] },
  '/api/farms/1/pens': [{ id: 21, code: 'D', name: 'Chuồng đẻ', status: 'ACTIVE' }, { id: 22, code: 'X', name: 'Ngưng', status: 'INACTIVE' }],
  '/api/farms/1/catalogues/production-purposes': { items: [{ id: 31, code: 'UN', name: 'Chưa xác định', purposeType: 'UNDECIDED', available: true }, { id: 32, code: 'SI', name: 'Đực giống', purposeType: 'SIRE', available: true }] },
  '/api/farms/1/health-cases/cattle/87': { openCases: [{ id: 415, caseCode: 'HC-000415', diagnosis: 'Phù chân' }], previousCases: [] },
}
const setup = (routes: Record<string, unknown> = {}) => {
  const { transport, calls } = fakeTransport({ ...catalogue, ...routes })
  return { api: createReproductionBackend({ farmId: 1, transport }), calls }
}
const sent = (calls: Call[], suffix: string) => calls.filter((c) => c.method === 'POST' && c.path.endsWith(suffix)).at(-1)!.body as Record<string, unknown>

// ------------------------------------------------------------------ FE-11 A1 / A2

test('TC-11-01 / TC-11-24 A1: dòng SCR-38 có giống, chuồng, việc tiếp theo, hạn theo giờ trại; tab Sắp đẻ đọc ngày dự kiến', async () => {
  const { api, calls } = setup({
    '/api/farms/1/reproduction-worklist': {
      tiles: { inEstrus: 1 }, counts: { all: 2 },
      items: [
        { cattleId: 87, code: 'BC-087', name: 'Mận', earTag: '0087', ageMonths: 40, latestWeightKg: 410, breed: { id: 3, name: 'Lai Sind' }, pen: { id: 21, code: 'D', name: 'Chuồng đẻ' }, status: 'IN_ESTRUS', statusSince: '2026-11-04T23:30:00Z',
          eligibility: { met: false, failed: ['MINIMUM_WEIGHT'], criteria: [{ name: 'MINIMUM_AGE', required: '13', value: '40', met: true }, { name: 'MINIMUM_WEIGHT', required: '450', value: '410', met: false }, { name: 'OPEN_HEALTH_CASE', required: '0', value: '0', met: true }] },
          latestEvent: { type: 'ESTRUS', at: '2026-11-04T23:30:00Z', date: '2026-11-05', daysAgo: 0 }, nextAction: 'MONITOR_WEIGHT', due: { windowFrom: '2026-11-05T07:30:00Z', windowTo: '2026-11-05T11:30:00Z' }, version: 3 },
        { cattleId: 88, code: 'BC-088', breed: { id: 3, name: 'Lai Sind' }, pen: { id: 21, code: 'D', name: 'Chuồng đẻ' }, status: 'PREGNANT', nextAction: 'PREPARE_CALVING_PEN', due: { date: '2026-11-20' }, expectedCalvingDate: '2026-11-20', expectedBasis: 'CONFIRMED', version: 1 },
      ],
    },
  })
  const rows = await api.listWorklist()
  assert.equal(calls.find((c) => c.path.includes('reproduction-worklist'))!.path, '/api/farms/1/reproduction-worklist?tab=ALL')
  assert.deepEqual([rows[0].cattleCode, rows[0].breed, rows[0].penCode, rows[0].statusAt, rows[0].nextAction], ['BC-087', 'Lai Sind', 'D', '2026-11-05T06:30', 'Theo dõi cân'])
  assert.deepEqual(rows[0].breedingWindow, { from: '2026-11-05T14:30', to: '2026-11-05T18:30' })
  assert.deepEqual([rows[0].eligibility?.status, rows[0].eligibility?.minimumWeightMet, rows[0].eligibility?.actualWeightKg, rows[0].eligibility?.requiredWeightKg], ['NOT_MET', false, 410, 450])
  assert.deepEqual([rows[0].events[0].summary, rows[0].events[0].occurredAt], ['Động dục', '2026-11-05T06:30'])
  assert.equal(isDueSoon(rows[1], '2026-11-05T10:00'), true)
  assert.equal(rows[1].nextAction, 'Chuẩn bị chuồng đẻ')
})

test('A2 / FE-12 A1: hồ sơ có thai hiện tại, chỉ số GBR-106, dòng thời gian mã theo loại và lịch sử đẻ với mã bò đã đăng ký', async () => {
  const { api } = setup()
  const p = await api.getProfile('BC-087')
  assert.deepEqual([p.status, p.parity, p.servicesInCurrentCycle, p.latestWeightKg, p.ageMonths, p.name], ['PREGNANT', 2, 2, 412.5, 40, 'Mận'])
  assert.deepEqual(p.openPregnancy, { id: 'p-5', pregnancyNumber: 3, linkedBreedingId: 'e-12', confirmedAt: '2026-08-20T09:00', expectedCalvingAt: '2027-04-29T00:00', expectedDateBasis: 'CONFIRMED', estimatedMonths: null, status: 'OPEN', version: 4 })
  assert.equal(p.indicators.conceptionSummary, '2 lần có thai / 3 lần phối') // TC-11-22
  assert.deepEqual(p.events.map((e) => e.id), ['e-40'.replace('e', 'u'), 'e-13', 'e-12', 'e-11', 'e-10', 'c-70'])
  const estrus = p.events.find((e) => e.id === 'e-10')!
  assert.deepEqual([estrus.signs, estrus.observer, estrus.occurredAt], [['Đứng yên cho nhảy', 'Chảy dịch nhờn trong'], 'Nguyễn Kỹ Thuật', '2026-07-20T06:30'])
  const breeding = p.events.find((e) => e.id === 'e-12')!
  assert.deepEqual([breeding.method, breeding.sireLabel, breeding.linkedEstrusId, breeding.summary, breeding.dataSource, breeding.corrected], ['NATURAL_SERVICE', 'Sắm · BC-301', 'e-10', 'Phối giống · lần 1', 'FARM_NOTEBOOK', true])
  assert.deepEqual([p.events.find((e) => e.id === 'e-11')!.status, p.events.find((e) => e.id === 'e-11')!.voidReason], ['VOIDED', 'Ghi nhầm'])
  assert.equal(p.events.find((e) => e.id === 'u-40')!.details, 'Biến chứng · Phù chân · ca HC-000415')
  const calving = p.calvings[0]
  assert.deepEqual([calving.id, calving.birthAt, calving.damCondition, calving.attendant, calving.recorder], ['c-70', '2025-11-02T04:00', 'MONITORING', 'Lê Quản Lý', 'Lê Quản Lý'])
  assert.deepEqual(calving.calves.map((c) => [c.id, c.registrationStatus, c.cattleCode, c.earTag, c.version]), [['f-90', 'REGISTERED', 'BC-501', null, 2], ['f-91', 'PENDING_CONFIRMATION', null, 'T-91', 0]])
  assert.equal(p.events.find((e) => e.id === 'c-70')!.details, '2 bê: Sống · Đực · 24 kg; Sống · Cái · T-91')
})

test('lựa chọn popup: thành viên ACTIVE, bò đực của trại, giống, chuồng ACTIVE, mục đích theo loại, ca bệnh của bò', async () => {
  const { api, calls } = setup()
  const o = await api.formOptions('BC-087')
  assert.ok(calls.some((c) => c.path === '/api/farms/1/cattle?sex=MALE&herdStatus=ACTIVE&size=200'))
  assert.deepEqual(o.members, [{ id: '7', name: 'Lê Quản Lý', role: 'Quản lý' }, { id: '8', name: 'Nguyễn Kỹ Thuật', role: 'Kỹ thuật viên' }])
  assert.deepEqual(o.sires, [{ id: '301', label: 'Sắm · BC-301 · VN-0101' }])
  assert.deepEqual([o.breeds, o.pens.map((p) => p.id), o.purposes.map((p) => [p.value, p.type])], [['Lai Sind', 'Brahman'], ['21'], [['31', 'UNDECIDED'], ['32', 'SIRE']]])
  assert.deepEqual(o.healthCases, [{ id: '415', label: 'HC-000415 · Phù chân' }])
})

// ------------------------------------------------------------------ FE-11 A3 / A4

test('TC-11-04 / TC-11-06 A3: động dục gửi giờ có offset trại, người quan sát là thành viên theo id, mã dấu hiệu; trùng 12 giờ hỏi lại rồi gửi confirmDuplicate', async () => {
  let first = true
  const { api, calls } = setup({
    '/api/farms/1/cattle/87/estrus-events': () => {
      if (first) { first = false; throw backendError(409, 'MSG-FE11-03', { event_type: 'động dục', cattle_code: 'BC-087', time: '05/11/2026 06:00' }) }
      return { eventId: 99 }
    },
  })
  const command: ReproductionCommand = { type: 'ESTRUS', occurredAt: '2026-11-05T15:00', observer: 'Nguyễn Kỹ Thuật', signs: ['Đứng yên cho nhảy', 'Âm hộ sưng đỏ'], description: '', dataSource: 'DIRECT_OBSERVATION' }
  const duplicate = await rejection(api.recordEvent('BC-087', command))
  assert.ok(duplicate instanceof ReproductionDuplicateError)
  assert.equal(duplicate.message, 'Đã có động dục tương tự của BC-087 lúc 05/11/2026 06:00. Vẫn lưu?')
  await api.recordEvent('BC-087', { ...command, confirmDuplicate: true })
  assert.deepEqual(sent(calls, '/estrus-events'), { expectedCattleVersion: 9, observedAt: '2026-11-05T15:00:00+07:00', observerId: 8, signs: ['STANDING', 'SWOLLEN_VULVA'], description: null, dataSource: 'DIRECT_OBSERVATION', confirmDuplicate: true })
  await api.recordEvent('BC-087', { ...command, observer: 'BS Trần Văn Bình', confirmDuplicate: true })
  assert.equal(sent(calls, '/estrus-events').observerName, 'BS Trần Văn Bình') // P1: tên người ngoài
})

test('A4: phối đực trong trại → INTERNAL + sireCattleId; tinh ngoài → giống theo id; động dục liên kết đổi về id backend', async () => {
  const { api, calls } = setup({ '/api/farms/1/cattle/87/breeding-events': { eventId: 100 } })
  await api.recordEvent('BC-087', { type: 'BREEDING', occurredAt: '2026-11-05T08:00', linkedEstrusId: 'e-10', dataSource: 'DIRECT_OBSERVATION', method: 'NATURAL_SERVICE', sireSource: 'FARM', farmSireId: '301', performer: 'Lê Quản Lý', note: '' })
  assert.deepEqual(sent(calls, '/breeding-events'), {
    expectedCattleVersion: 9, bredAt: '2026-11-05T08:00:00+07:00', dataSource: 'DIRECT_OBSERVATION', method: 'NATURAL', sireSource: 'INTERNAL', sireCattleId: 301,
    sireBreedId: null, sireBreed: null, semenCode: null, semenSupplier: null, performerId: 7, linkedEstrusId: 10, note: null, confirmDuplicate: false,
  })
  await api.recordEvent('BC-087', { type: 'BREEDING', occurredAt: '2026-11-05T09:00', method: 'ARTIFICIAL_INSEMINATION', sireSource: 'EXTERNAL', externalSireBreed: 'Brahman', semenCode: 'ST-9', semenSupplier: 'Trạm', performer: 'Dẫn tinh viên A' })
  const body = sent(calls, '/breeding-events')
  assert.deepEqual([body.method, body.sireSource, body.sireBreedId, body.sireBreed, body.semenCode, body.performerName, body.linkedEstrusId], ['AI', 'EXTERNAL', 4, null, 'ST-9', 'Dẫn tinh viên A', null])
})

test('TC-11-13 / TC-11-08 / TC-11-07 / BR-D14: lỗi backend thành câu tiếng Việt và ô lỗi', () => {
  const sire = mapReproductionError(backendError(422, 'MSG-FE11-04', { field: 'sireCattleId' })) as ReproductionValidationError
  assert.deepEqual(sire.issues, [{ field: 'sireCattleId', message: 'Đực giống phải là một bò đực khác của trại này.' }])
  const early = mapReproductionError(backendError(422, 'MSG-FE11-10', { event: 'động dục', time: '05/11/2026 06:30', field: 'bredAt' })) as ReproductionValidationError
  assert.deepEqual(early.issues, [{ field: 'occurredAt', message: 'Thời điểm không được sớm hơn động dục liên kết (05/11/2026 06:30).' }])
  assert.equal((mapReproductionError(backendError(422, 'MSG-FE11-05', { cattle_code: 'BC-087' })) as Error).message, 'BC-087 đang có thai đã xác nhận. Hãy xem lại trạng thái sinh sản trước khi ghi.')
  const entry = mapReproductionError(backendError(422, 'MSG-COM-15', { date: '2026-10-25', field: 'observedAt' })) as ReproductionValidationError
  assert.equal(entry.issues[0].message, 'Thời điểm không được trước ngày nhập đàn (25/10/2026).')
  assert.equal((mapReproductionError(backendError(422, 'MSG-FE11-11', { reason: 'PURPOSE' })) as Error).message, 'Con này không được theo dõi sinh sản. Nếu thực sự đã khám thai hoặc đẻ, hãy ghi từ Thao tác khác.')
})

// ------------------------------------------------------------------ FE-12 A2 / A3 / A4

test('FE-12 A2 / A3: khám thai gửi phối liên kết và người khám; diễn biến thai gửi thai OPEN và version; ca bệnh chỉ khi biến chứng', async () => {
  const { api, calls } = setup({ '/api/farms/1/cattle/87/pregnancy-checks': { eventId: 101 }, '/api/farms/1/pregnancy-episodes/5/updates': { updateId: 41 } })
  await api.recordEvent('BC-087', { type: 'PREGNANCY_CHECK', occurredAt: '2026-11-05T09:00', linkedBreedingId: 'e-12', result: 'PREGNANT', method: 'ULTRASOUND', estimatedMonths: null, examiner: 'Lê Quản Lý', note: '' })
  assert.deepEqual(sent(calls, '/pregnancy-checks'), { expectedCattleVersion: 9, linkedBreedingId: 12, checkedAt: '2026-11-05T09:00:00+07:00', dataSource: 'DIRECT_OBSERVATION', result: 'PREGNANT', method: 'ULTRASOUND', estimatedMonths: null, examinerId: 7, note: null })
  await api.recordEvent('BC-087', { type: 'PREGNANCY_UPDATE', occurredAt: '2026-11-05T10:00', updateType: 'OBSERVATION', details: 'Ổn', linkedHealthCaseId: '415' })
  assert.deepEqual(sent(calls, '/updates'), { expectedEpisodeVersion: 4, type: 'OBSERVATION', occurredAt: '2026-11-05T10:00:00+07:00', dataSource: 'DIRECT_OBSERVATION', details: 'Ổn', healthCaseId: null })
  assert.equal((mapReproductionError(backendError(409, 'MSG-FE12-12', { dam_code: 'BC-087' })) as Error).message, 'Đã có lần đẻ hoặc thay đổi thai cho BC-087. Vui lòng tải lại và xem lại.')
  assert.equal((mapReproductionError(backendError(409, 'MSG-FE12-02', { cattle_code: 'BC-087' })) as Error).message, 'Lần khám này mâu thuẫn với lần khám hoặc thai đã có của BC-087. Vui lòng xem lại.')
})

const calvingCommand = (over: Partial<CalvingCommand> = {}): CalvingCommand => ({
  birthAt: '2026-11-05T04:20', pregnancyId: 'p-5', dataSource: 'DIRECT_OBSERVATION', attendant: 'Hàng xóm', course: 'ASSISTED', damCondition: 'MONITORING', retainedPlacenta: true,
  calves: [
    { outcome: 'LIVE', sex: 'FEMALE', weightKg: 25.5, weightBasis: 'MEASURED', earTag: '', penId: '21', penCode: 'D', breed: 'Lai Sind', registration: 'DRAFT' },
    { outcome: 'LIVE', sex: 'MALE', weightKg: null, weightBasis: null, earTag: '', penId: '21', penCode: 'D', breed: 'Brahman', registration: 'REGISTER_NOW', productionPurpose: '31' },
    { outcome: 'STILLBORN', sex: 'UNKNOWN', weightKg: 18, weightBasis: 'ESTIMATED' },
  ],
  ...over,
})

test('TC-12-15 / Q5 A4: ghi đẻ gửi thai và version, bê đăng ký ngay không thẻ (tagCode null), chuồng / giống / mục đích theo id', async () => {
  const { api, calls } = setup({ '/api/farms/1/calvings': { calvingId: 71, calves: [], damStatus: 'POST_CALVING' } })
  await api.recordCalving('BC-087', calvingCommand())
  assert.deepEqual(sent(calls, '/calvings'), {
    damId: 87, expectedCattleVersion: 9, episodeId: 5, expectedEpisodeVersion: 4, noTrackedPregnancy: false, birthAt: '2026-11-05T04:20:00+07:00',
    dataSource: 'DIRECT_OBSERVATION', attendantName: 'Hàng xóm', course: 'ASSISTED', damCondition: 'NEEDS_MONITORING', retainedPlacenta: true,
    calves: [
      { outcome: 'LIVE', sex: 'FEMALE', birthWeightKg: 25.5, weightBasis: 'MEASURED', tagCode: null, penId: 21, breedId: 3, registration: 'DRAFT', purposeId: null },
      { outcome: 'LIVE', sex: 'MALE', birthWeightKg: null, weightBasis: null, tagCode: null, penId: 21, breedId: 4, registration: 'REGISTER_NOW', purposeId: 31 },
      { outcome: 'STILLBORN', sex: 'UNKNOWN', birthWeightKg: 18, weightBasis: 'ESTIMATED', tagCode: null, penId: null, breedId: null, registration: null, purposeId: null },
    ],
  })
})

test('TC-12-17 / TC-12-08,11,12,14: không có thai theo dõi; lỗi bê về đúng ô của đúng bê', async () => {
  const { api, calls } = setup({ '/api/farms/1/calvings': { calvingId: 72 } })
  await api.recordCalving('BC-087', calvingCommand({ pregnancyId: null }))
  const body = sent(calls, '/calvings')
  assert.deepEqual([body.episodeId, body.expectedEpisodeVersion, body.noTrackedPregnancy], [null, null, true])
  const tag = mapReproductionError(backendError(422, 'MSG-FE12-08', { tag_code: 'T-91', field: 'calves[1].tagCode', calf: 1 })) as ReproductionValidationError
  assert.deepEqual(tag.issues, [{ field: 'earTag', calf: 1, message: 'Bê số 2: Mã thẻ T-91 đã được dùng trong trại.' }])
  const weight = mapReproductionError(backendError(422, 'MSG-FE12-07', { field: 'calves[0].birthWeightKg', calf: 0 })) as ReproductionValidationError
  assert.deepEqual(weight.issues, [{ field: 'weight', calf: 0, message: 'Bê số 1: Cân sơ sinh phải từ 1 đến 80 kg và cần cơ sở đo hoặc ước tính.' }])
  const none = mapReproductionError(backendError(422, 'MSG-FE12-06', { field: 'calves' })) as ReproductionValidationError
  assert.equal(none.issues[0].message, 'Hãy thêm ít nhất một kết quả bê.')
  const pen = mapReproductionError(backendError(400, 'MSG-COM-06', { field: 'calves[0].penId', calf: 0 })) as ReproductionValidationError
  assert.deepEqual(pen.issues, [{ field: 'penId', calf: 0, message: 'Bê số 1: Chuồng ban đầu là bắt buộc.' }])
})

// ------------------------------------------------------------------ sửa / hủy

test('TC-11-18 / TC-11-19 A5: sửa chỉ gửi trường đã đổi; đổi đực giống theo nhãn bò đực; bỏ liên kết động dục', async () => {
  const { api, calls } = setup({ '/api/farms/1/reproduction-events/12/correction': { eventId: 12 } })
  const p = await api.getProfile('BC-087')
  const breeding = p.events.find((e) => e.id === 'e-12')!
  await api.correctEvent('BC-087', 'e-12', { occurredAt: breeding.occurredAt, dataSource: breeding.dataSource, method: breeding.method, sireLabel: breeding.sireLabel, performer: breeding.performer, linkedEstrusId: breeding.linkedEstrusId }, 'Không đổi gì')
  assert.deepEqual(sent(calls, '/12/correction'), { expectedVersion: 2, reason: 'Không đổi gì' })
  await api.correctEvent('BC-087', 'e-12', { occurredAt: '2026-07-20T09:00', sireLabel: 'Brahman', linkedEstrusId: null }, 'Sai giờ, tinh ngoài')
  assert.deepEqual(sent(calls, '/12/correction'), { expectedVersion: 2, reason: 'Sai giờ, tinh ngoài', occurredAt: '2026-07-20T09:00:00+07:00', unlinkEvent: true, sireSource: 'EXTERNAL', sireBreedId: 4, sireBreed: null })
  await api.correctEvent('BC-087', 'e-12', { sireLabel: 'BC-301' }, 'Đực trong trại')
  assert.deepEqual([sent(calls, '/12/correction').sireSource, sent(calls, '/12/correction').sireCattleId], ['INTERNAL', 301])
})

test('TC-11-17 / TC-12-20..24 A6–A8: hủy đi đúng route theo loại; bản ghi phụ thuộc báo MSG-FE11-07 liệt kê bản ghi', async () => {
  const { api, calls } = setup({
    '/api/farms/1/pregnancy-updates/40/void': {}, '/api/farms/1/calvings/70/void': () => { throw backendError(409, 'MSG-FE11-07', { records: 'bê đã đăng ký', dependents: [{ type: 'REGISTERED_CALF', id: 501 }] }) },
    '/api/farms/1/calf-outcomes/91/void': {}, '/api/farms/1/calf-outcomes/91/correction': {}, '/api/farms/1/calvings/70/correction': {},
  })
  await api.voidEvent('BC-087', 'u-40', 'Ghi nhầm')
  assert.deepEqual(sent(calls, '/pregnancy-updates/40/void'), { expectedVersion: 0, reason: 'Ghi nhầm' })
  const blocked = await rejection(api.voidCalving('BC-087', 'c-70', 'Ghi nhầm'))
  assert.equal(blocked.message, 'Bản ghi này đang được các bản ghi sau dùng (bê đã đăng ký). Hãy sửa hoặc hủy các bản ghi đó trước.')
  await api.voidCalf('BC-087', 'c-70', 'f-91', 'Trùng')
  assert.deepEqual(sent(calls, '/calf-outcomes/91/void'), { expectedVersion: 0, reason: 'Trùng' })
  const p = await api.getProfile('BC-087')
  const calving = p.calvings[0]
  await api.correctCalving('BC-087', 'c-70', { calves: calving.calves.map((c) => c.id === 'f-91' ? { ...c, weightKg: 20.5, weightBasis: 'ESTIMATED', earTag: 'T-92' } : c) }, 'Đo lại')
  assert.deepEqual(sent(calls, '/calf-outcomes/91/correction'), { expectedVersion: 0, reason: 'Đo lại', birthWeightKg: 20.5, weightBasis: 'ESTIMATED', tagCode: 'T-92' })
  assert.ok(!calls.some((c) => c.path.endsWith('/calf-outcomes/90/correction'))) // bê đã đăng ký không đổi → không gửi
  await api.correctCalving('BC-087', 'c-70', { birthAt: calving.birthAt, damCondition: 'CRITICAL', attendant: 'Lê Quản Lý' }, 'Sửa tình trạng')
  assert.deepEqual(sent(calls, '/calvings/70/correction'), { expectedVersion: 3, reason: 'Sửa tình trạng', damCondition: 'CRITICAL' })
})
