import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendError, createBackendClient } from '../../src/api/backendClient'
import type { BackendTransport } from '../../src/api/backendTransport'
import { createVaccinationBackend, mapVaccine, toFarmTime } from '../../src/features/vaccination/api/vaccinationBackend'
import { CONFLICT_MESSAGE, VaccinationValidationError } from '../../src/features/vaccination/domain/vaccinationRules'
import type { ScheduleCommand } from '../../src/features/vaccination/types'

type Call = { method: string; path: string; body?: unknown; headers?: Record<string, string> }

function fakeTransport(routes: Record<string, unknown | ((body: unknown, path: string) => unknown)>) {
  const calls: Call[] = []
  const answer = (path: string, body?: unknown) => {
    // Trại hiện tại (múi giờ) mặc định Asia/Ho_Chi_Minh, trừ khi test khai báo route riêng.
    const hit = routes[path] ?? routes[path.split('?')[0]] ?? (path === '/api/farms/1' ? { id: 1, timeZone: 'Asia/Ho_Chi_Minh' } : undefined)
    if (hit === undefined) throw new Error(`Unexpected request: ${path}`)
    return typeof hit === 'function' ? (hit as (b: unknown, p: string) => unknown)(body, path) : structuredClone(hit)
  }
  const transport: BackendTransport = {
    async get(path) { calls.push({ method: 'GET', path }); return answer(path) },
    async command(path, body, options) { calls.push({ method: options?.method ?? 'POST', path, body, headers: options?.headers }); return answer(path, body) },
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
  }
  return { transport, calls }
}

// Hôm nay theo giờ trại: 05/11/2026 10:00.
const clock = () => new Date('2026-11-05T03:00:00Z')

const cow = (id: number, code: string, extra: Record<string, unknown> = {}) => ({
  id, displayCode: code, name: null, breedName: 'Brahman', sex: 'FEMALE', penId: 11, penCode: 'A1', penName: 'Chuồng A1',
  herdGroup: 'FATTENING', lifeStage: 'ADULT', herdStatus: 'ACTIVE', entryDate: '2026-01-10', ...extra,
})
const herd = {
  items: [
    cow(101, 'BC-101'), cow(102, 'BC-102'),
    cow(103, 'BC-103', { penId: 12, penCode: 'B1', penName: 'Chuồng B1', herdGroup: 'BREEDING_FEMALES' }),
    cow(104, 'BC-104', { herdStatus: 'EXITED' }),
  ],
  total: 4, page: 0, size: 200,
}
const vaccines = [
  { id: 1, code: 'LMLM', name: 'Aftopor (LMLM)', diseasePrevented: 'Lở mồm long móng', dose: '2 ml', route: 'INTRAMUSCULAR', withdrawalDays: 21, available: true },
  { id: 2, code: 'OLD', name: 'Vắc-xin cũ', diseasePrevented: 'Tụ huyết trùng', dose: '1 ml', route: 'SUBCUTANEOUS', withdrawalDays: 0, available: false },
]
const dose = (id: number, cattleId: number, code: string, doseNo: number, dueDate: string, status = 'PLANNED', extra: Record<string, unknown> = {}) => ({
  id, cattleId, cattleCode: code, doseNo, dueDate, newExpectedDate: null, status, deferralReason: null, version: 0, ...extra,
})
const schedules = [
  {
    id: 7, name: 'LMLM 2026', targetGroup: 'PENS', vaccineId: 1, vaccineName: 'Aftopor (LMLM)', firstDueDate: '2026-11-01', doseCount: 2,
    intervalDays: 21, boosterIntervalMonths: 6, status: 'ACTIVE', version: 3,
    doses: [
      dose(1, 101, 'BC-101', 1, '2026-11-01', 'DONE'),
      dose(2, 101, 'BC-101', 2, '2026-11-22'),
      dose(3, 102, 'BC-102', 1, '2026-11-01'),
      dose(4, 102, 'BC-102', 2, '2026-11-22'),
      dose(5, 103, 'BC-103', 1, '2026-11-01', 'DEFERRED', { newExpectedDate: '2026-11-20', deferralReason: 'Bò ốm' }),
      dose(6, 103, 'BC-103', 2, '2026-11-22'),
      dose(9, 101, 'BC-101', 3, '2027-05-22'),
    ],
  },
  {
    id: 8, name: 'Tụ huyết trùng', targetGroup: 'INDIVIDUALS', vaccineId: 2, vaccineName: 'Vắc-xin cũ', firstDueDate: '2026-10-01', doseCount: 1,
    intervalDays: 1, boosterIntervalMonths: null, status: 'STOPPED', version: 2, doses: [dose(20, 102, 'BC-102', 1, '2026-10-01', 'CANCELLED')],
  },
]
const baseRoutes = () => ({
  '/api/farms/1/vaccination-schedules': schedules,
  '/api/farms/1/cattle': herd,
  '/api/farms/1/vaccines': vaccines,
  '/api/farms/1/pens': { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }, { id: 12, code: 'B1', name: 'Chuồng B1' }] },
  '/api/farms/1/members': [
    { id: 1, userId: 5, fullName: 'Trần Văn Kỹ', status: 'ACTIVE' },
    { id: 2, userId: 6, fullName: 'Đã nghỉ', status: 'REMOVED' },
  ],
})
const api = (routes: Record<string, unknown> = baseRoutes()) => {
  const fake = fakeTransport(routes)
  return { ...fake, api: createVaccinationBackend({ farmId: 1, transport: fake.transport, clock }) }
}

test('TC-09-API01: danh mục vắc-xin đổi đường tiêm và tách liều "2 ml"; ẩn vắc-xin ngừng dùng ở bộ chọn', async () => {
  assert.deepEqual(mapVaccine(vaccines[0]), { id: 1, name: 'Aftopor (LMLM)', shortName: 'Aftopor (LMLM)', disease: 'Lở mồm long móng', referenceDose: 2, doseUnit: 'ml', route: 'IM', withdrawalDays: 21, active: true })
  const { api: a } = api()
  const options = await a.options()
  assert.deepEqual(options.vaccines.map((v) => v.id), [1])
  assert.deepEqual(options.members, [{ id: 5, name: 'Trần Văn Kỹ' }])
  assert.deepEqual(options.pens, [{ code: 'A1', label: 'Chuồng A1' }, { code: 'B1', label: 'Chuồng B1' }])
  assert.equal(options.now, '2026-11-05T10:00')
})

test('Múi giờ trại: trại ở UTC+9 gửi thời điểm tiêm +09:00 và hiện lịch sử theo giờ trại', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1': { id: 1, timeZone: 'Asia/Tokyo' },
    '/api/farms/1/vaccinations': { vaccinatedCount: 1, deferredCount: 0, vaccinationIds: [700] },
    '/api/farms/1/vaccinations/history': [{ id: 1, administeredAt: '2026-11-01T01:30:00Z', vaccinationDate: '2026-11-01', cattleCode: 'BC-101', source: 'ON_FARM', status: 'VALID', version: 0 }] })
  assert.equal((await a.options()).now, '2026-11-05T12:00', 'giờ hiện tại theo UTC+9')
  await a.recordVaccinations({ vaccineId: 1, source: 'ON_FARM', administeredAt: '2026-11-05T08:30', batchNo: 'L', animals: [{ cattleCode: 'BC-102', decision: 'VACCINATE' }] })
  assert.equal((calls.find((c) => c.method === 'POST')!.body as Record<string, unknown>).administeredAt, '2026-11-05T08:30:00+09:00')
  assert.equal((await a.listHistory({})).rows[0].administeredAt, '2026-11-01T10:30')
  assert.equal(calls.filter((c) => c.path === '/api/farms/1').length, 1, 'đọc múi giờ một lần')
})

test('TC-09-29: danh sách mũi chia tab Quá hạn / Đến hạn / Sắp tới / Đã hoãn theo hôm nay 05/11', async () => {
  const { api: a } = api()
  const page = await a.listDoses({})
  // Mỗi (lịch, bò) một dòng; lịch đã dừng không hiện.
  assert.equal(page.total, 3)
  assert.deepEqual(page.counts, { all: 3, overdue: 1, due: 0, upcoming: 1, deferred: 1, done: 0 })
  const byCode = Object.fromEntries(page.rows.map((r) => [r.cattleCode, r]))
  assert.equal(byCode['BC-101'].doseText, 'mũi 2/2')
  assert.equal(byCode['BC-101'].state, 'UPCOMING')
  assert.equal(byCode['BC-102'].state, 'OVERDUE')
  assert.equal(byCode['BC-102'].daysOverdue, 4)
  assert.equal(byCode['BC-103'].state, 'DEFERRED')
  assert.equal(byCode['BC-103'].effectiveDate, '2026-11-20')
  const overdue = await a.listDoses({ tab: 'overdue' })
  assert.deepEqual(overdue.rows.map((r) => r.id), [3])
})

test('TC-09-API02: thẻ lịch chỉ gồm lịch đang chạy; mũi số lớn hơn số mũi là mũi nhắc lại', async () => {
  const { api: a } = api()
  const cards = await a.listSchedules()
  assert.deepEqual(cards.map((c) => c.schedule.id), [7])
  assert.equal(cards[0].targetCount, 3)
  assert.equal(cards[0].overdueCount, 1)
  assert.equal(cards[0].vaccine.name, 'Aftopor (LMLM)')
  const booster = await a.getDose(9)
  assert.equal(booster.kind, 'BOOSTER')
  assert.equal(booster.doseText, 'nhắc lại')
  const detail = await a.getSchedule(7)
  assert.deepEqual(detail.plannedRows.map((r) => r.label), ['Mũi 1', 'Mũi 2', 'Nhắc lại'])
})

test('TC-09-04: xem trước đối tượng kết hợp chuồng VÀ nhóm đàn, bỏ bò đã rời đàn', async () => {
  const { api: a } = api()
  const matches = await a.previewTarget({ penCodes: ['A1'], herdGroups: ['FATTENING'], lifeStages: [], excluded: [], added: [] })
  assert.deepEqual(matches.map((c) => c.code), ['BC-101', 'BC-102'])
  assert.equal(Object.hasOwn(matches[0], 'id'), false)
})

const scheduleCmd = (extra: Partial<ScheduleCommand> = {}): ScheduleCommand => ({
  name: 'Viêm da nổi cục 2026', vaccineId: 1, firstDueDate: '2026-11-10', doseCount: 2, intervalDays: 21, boosterIntervalMonths: 12,
  target: { penCodes: ['A1'], herdGroups: ['FATTENING'], lifeStages: [], excluded: ['BC-102'], added: ['BC-103'] }, ...extra,
})

test('TC-09-06: tạo lịch gửi id chuồng / bò từ mã, có Idempotency-Key', async () => {
  let sent: Record<string, unknown> = {}
  let key: string | null = null
  const routes = baseRoutes()
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input), 'http://x')
    if (url.pathname === '/api/csrf') return Response.json({ token: 'csrf' })
    if (init?.method === 'POST' && url.pathname === '/api/farms/1/vaccination-schedules') {
      sent = JSON.parse(String(init.body))
      key = new Headers(init.headers).get('Idempotency-Key')
      return Response.json({ id: 30, name: 'Viêm da nổi cục 2026', status: 'ACTIVE', version: 0, targetCount: 2, plannedDoseCount: 4 }, { status: 201 })
    }
    const body = url.pathname === '/api/farms/1' ? { id: 1, timeZone: 'Asia/Ho_Chi_Minh' } : (routes as Record<string, unknown>)[url.pathname]
    if (body === undefined) throw new Error(`Unexpected request: ${url.pathname}`)
    return Response.json(body)
  }
  const a = createVaccinationBackend({ farmId: 1, transport: createBackendClient({ fetchImpl }), clock })
  const result = await a.createSchedule(scheduleCmd())
  assert.ok(key)
  assert.deepEqual(sent, {
    name: 'Viêm da nổi cục 2026', vaccineId: 1, firstDueDate: '2026-11-10', doseCount: 2, intervalDays: 21, boosterIntervalMonths: 12,
    cattleIds: [103], penIds: [11], herdGroups: ['FATTENING'], lifeStages: [], excludedCattleIds: [102],
  })
  assert.equal(result.schedule.id, 30)
  assert.equal(result.plannedDoseCount, 4)
  assert.equal(result.message, 'Đã lưu lịch Viêm da nổi cục 2026: 4 mũi dự kiến cho 2 bò.')
})

test('TC-09-01/02/03/05: kiểm tra lịch trước khi gửi; lịch 1 mũi vẫn gửi intervalDays cho backend', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules': (body: unknown) => (body ? { id: 31, name: 'Một mũi', version: 0, targetCount: 1, plannedDoseCount: 1 } : schedules) })
  await assert.rejects(a.createSchedule(scheduleCmd({ name: 'x'.repeat(101), doseCount: 11 })), (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields.name) && Boolean(e.fields.doseCount))
  await assert.rejects(a.createSchedule(scheduleCmd({ intervalDays: undefined })), (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields.intervalDays))
  await assert.rejects(a.createSchedule(scheduleCmd({ name: 'lmlm 2026' })), (e: unknown) => e instanceof VaccinationValidationError && /Đã có lịch/.test(e.fields.name))
  await assert.rejects(a.createSchedule(scheduleCmd({ target: { penCodes: ['B1'], herdGroups: ['FATTENING'], lifeStages: [], excluded: [], added: [] } })),
    (e: unknown) => e instanceof VaccinationValidationError && /Không có bò/.test(e.fields.form))
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0, 'không gửi khi còn lỗi')
  await a.createSchedule(scheduleCmd({ name: 'Một mũi', doseCount: 1, intervalDays: undefined, boosterIntervalMonths: undefined }))
  assert.equal((calls.find((c) => c.method === 'POST')!.body as Record<string, unknown>).intervalDays, 1)
})

test('TC-09-03b: lỗi trùng tên từ backend hiện ở ô tên', async () => {
  const { api: a } = api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules': (body: unknown) => {
    if (body) throw new BackendError(409, { code: 'COM-05', params: { reason: 'active_schedule_name_exists' } })
    return schedules
  } })
  await assert.rejects(a.createSchedule(scheduleCmd()), (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields.name))
})

test('TC-09-08: sửa lịch chỉ gửi trường đổi kèm expectedVersion; chặn đổi vắc-xin khi đã có mũi DONE (Q3)', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules/7': { id: 7, name: 'LMLM 2026', status: 'ACTIVE', version: 4, targetCount: 3, plannedDoseCount: 5 } })
  const detail = await a.getSchedule(7)
  const edit: ScheduleCommand = { ...detail.schedule, intervalDays: 28, expectedVersion: 3 }
  const result = await a.updateSchedule(7, edit)
  const put = calls.find((c) => c.method === 'PUT')!
  assert.equal(put.path, '/api/farms/1/vaccination-schedules/7')
  assert.deepEqual(put.body, {
    expectedVersion: 3, name: null, vaccineId: null, firstDueDate: null, intervalDays: 28, boosterIntervalMonths: null,
    doseCount: null, removeBooster: null, target: null,
  })
  assert.equal(result.schedule.version, 4)

  await assert.rejects(a.updateSchedule(7, { ...edit, vaccineId: 2 }), (e: unknown) => e instanceof VaccinationValidationError && /dừng lịch/.test(e.fields.vaccineId))
  await assert.rejects(a.updateSchedule(7, { ...edit, expectedVersion: 2 }), (e: unknown) => e instanceof Error && e.message === CONFLICT_MESSAGE)
})

// Lịch có đối tượng đã lưu (GAP-FE09-01): chuồng A1, thêm BC-103.
const storedTarget = { penIds: [11], penCodes: ['A1'], herdGroups: [], lifeStages: [], cattleIds: [103], cattleCodes: ['BC-103'], excludedCattleIds: [], excludedCattleCodes: [] }
const withStoredTarget = () => schedules.map((s) => (s.id === 7 ? { ...s, target: storedTarget } : s))

test('GAP-FE09-01: màn sửa hiện đúng đối tượng đã lưu (mã chuồng, bò thêm / bỏ)', async () => {
  const { api: a } = api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules': withStoredTarget() })
  assert.deepEqual((await a.getSchedule(7)).schedule.target, { penCodes: ['A1'], herdGroups: [], lifeStages: [], excluded: [], added: ['BC-103'] })
  assert.deepEqual((await api().api.getSchedule(7)).schedule.target.added, ['BC-101', 'BC-102', 'BC-103'], 'lịch lưu trước khi có target: dựng lại từ bò còn mũi')
})

test('TC-09-09 / GAP-FE09-01: đổi đối tượng, số mũi, bỏ nhắc lại gửi lên backend (id chuồng / bò từ mã)', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules': withStoredTarget(),
    '/api/farms/1/vaccination-schedules/7': { id: 7, name: 'LMLM 2026', status: 'ACTIVE', version: 4, targetCount: 2, plannedDoseCount: 4 } })
  const detail = await a.getSchedule(7)
  const target = { ...detail.schedule.target, excluded: ['BC-102'] }
  const result = await a.updateSchedule(7, { ...detail.schedule, target, doseCount: 3, boosterIntervalMonths: undefined })
  const put = calls.find((c) => c.method === 'PUT')!
  assert.deepEqual(put.body, {
    expectedVersion: 3, name: null, vaccineId: null, firstDueDate: null, intervalDays: null, boosterIntervalMonths: null,
    doseCount: 3, removeBooster: true,
    target: { cattleIds: [103], penIds: [11], herdGroups: [], lifeStages: [], excludedCattleIds: [102] },
  })
  assert.equal(result.targetCount, 2)
  assert.equal(result.schedule.doseCount, 3)
  assert.deepEqual(result.schedule.target.excluded, ['BC-102'])
})

test('GAP-FE09-01: đối tượng không có chuồng / nhóm / giai đoạn gửi đúng danh sách bò đã chốt', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules': (body: unknown) => (body ? { id: 9, name: 'Cả đàn', status: 'ACTIVE', version: 0, targetCount: 3, plannedDoseCount: 3 } : schedules) })
  await a.createSchedule(scheduleCmd({ name: 'Cả đàn', target: { penCodes: [], herdGroups: [], lifeStages: [], excluded: ['BC-102'], added: [] } }))
  const body = calls.find((c) => c.method === 'POST')!.body as Record<string, unknown>
  assert.deepEqual(body.cattleIds, [101, 103], 'xem trước là cả đàn còn nuôi trừ bò đã bỏ; bò đã rời đàn không vào')
  assert.deepEqual(body.excludedCattleIds, [])
  const empty = api().api
  await assert.rejects(empty.updateSchedule(7, { ...(await empty.getSchedule(7)).schedule, target: { penCodes: ['Z9'], herdGroups: [], lifeStages: [], excluded: [], added: [] } }),
    (e: unknown) => e instanceof VaccinationValidationError && /Không có bò/.test(e.fields.form))
})

test('TC-09-10: dừng lịch gửi phiên bản qua If-Match và lý do; thiếu lý do thì không gửi', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules/7/stop': { id: 7, name: 'LMLM 2026', status: 'STOPPED', version: 4, targetCount: 3, plannedDoseCount: 0 } })
  await assert.rejects(a.stopSchedule(7, { reason: '  ', expectedVersion: 3 }), VaccinationValidationError)
  const result = await a.stopSchedule(7, { reason: 'Đổi vắc-xin', expectedVersion: 3 })
  const stop = calls.at(-1)!
  assert.deepEqual(stop.headers, { 'If-Match': '3' })
  assert.deepEqual(stop.body, { reason: 'Đổi vắc-xin' })
  assert.equal(result.schedule.status, 'STOPPED')
  assert.equal(result.message, 'Đã dừng lịch LMLM 2026.')
})

test('TC-09-18: ngữ cảnh ghi tiêm từ hồ sơ bò lấy mũi mở sớm nhất cùng tiêu đề', async () => {
  const { api: a } = api()
  const fromDoses = await a.recordContext({ doseIds: [3, 5, 1] })
  // Mũi 1 đã DONE nên không vào danh sách ghi.
  assert.deepEqual(fromDoses.rows.map((r) => r.dose?.id), [3, 5])
  assert.equal(fromDoses.title, 'Ghi nhận tiêm – LMLM 2026 · mũi 1/2')
  assert.equal(fromDoses.vaccineId, 1)
  assert.equal(Object.hasOwn(fromDoses.rows[0].cattle, 'id'), false)
  const mixed = await a.recordContext({ doseIds: [3, 2] })
  assert.equal(mixed.title, 'Ghi nhận tiêm')
  const fromCow = await a.recordContext({ cattleCodes: ['BC-102'] })
  assert.equal(fromCow.rows[0].dose?.id, 3)
  assert.equal(fromCow.title, 'Ghi nhận tiêm – LMLM 2026 · mũi 1/2')
})

test('TC-09-15/19: ghi lô tiêm gửi id bò, đường tiêm đầy đủ, Instant giờ trại và quyết định hoãn', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/vaccinations': { vaccinatedCount: 1, deferredCount: 1, vaccinationIds: [500] } })
  const result = await a.recordVaccinations({
    vaccineId: 1, source: 'ON_FARM', administeredAt: '2026-11-05T08:30', batchNo: ' L-01 ', dose: '2 ml', route: 'IM', withdrawalDays: 21, vaccinator: 'Trần Văn Kỹ',
    animals: [
      { cattleCode: 'BC-102', scheduledDoseId: 3, expectedDoseVersion: 0, decision: 'VACCINATE' },
      { cattleCode: 'BC-103', scheduledDoseId: 5, expectedDoseVersion: 0, decision: 'DEFER', deferralReason: 'Bò ốm', newExpectedDate: '2026-11-12' },
    ],
  })
  const body = calls.at(-1)!.body as Record<string, unknown>
  assert.equal(body.administeredAt, '2026-11-05T08:30:00+07:00')
  assert.equal(body.vaccinationDate, '2026-11-05')
  assert.equal(body.batchNo, 'L-01')
  assert.equal(body.route, 'INTRAMUSCULAR')
  assert.equal(body.withdrawalDays, 21)
  assert.deepEqual(body.animals, [
    { cattleId: 102, scheduledDoseId: 3, expectedDoseVersion: 0, decision: 'VACCINATE', deferralReason: null, newExpectedDate: null },
    { cattleId: 103, scheduledDoseId: 5, expectedDoseVersion: 0, decision: 'DEFER', deferralReason: 'Bò ốm', newExpectedDate: '2026-11-12' },
  ])
  assert.equal(result.message, 'Đã ghi nhận 1 mũi tiêm; hoãn 1 mũi.')
  assert.deepEqual(result.vaccinationIds, [500])
})

test('TC-09-13/14: tiêm tại trại bắt buộc số lô; nhập lịch sử không đóng mũi, không ngưng thịt', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/vaccinations': { vaccinatedCount: 1, deferredCount: 0, vaccinationIds: [501] } })
  await assert.rejects(a.recordVaccinations({ vaccineId: 1, source: 'ON_FARM', administeredAt: '2026-11-05T08:30', animals: [{ cattleCode: 'BC-102', decision: 'VACCINATE' }] }),
    (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields.batchNo))
  await a.recordVaccinations({ vaccineId: 1, source: 'HISTORICAL', administeredAt: '2026-03-01T00:00', withdrawalDays: 0, animals: [{ cattleCode: 'BC-102', scheduledDoseId: 3, decision: 'VACCINATE' }] })
  const body = calls.at(-1)!.body as Record<string, unknown>
  assert.equal(body.administeredAt, null)
  assert.equal(body.vaccinationDate, '2026-03-01')
  assert.equal(body.withdrawalDays, 0)
  assert.equal((body.animals as Array<Record<string, unknown>>)[0].scheduledDoseId, null)
})

test('TC-09-17: bò đã tiêm mũi đó hoặc đã rời đàn được bỏ qua, các con khác vẫn ghi', async () => {
  const { api: a } = api({ ...baseRoutes(), '/api/farms/1/vaccinations': {
    vaccinatedCount: 1, deferredCount: 0, vaccinationIds: [600],
    skipped: [
      { cattleId: 101, cattleCode: 'BC-101', messageCode: 'MSG-FE09-09', doseNo: 1 },
      { cattleId: 103, cattleCode: 'BC-103', messageCode: 'MSG-COM-13', doseNo: null },
    ],
  } })
  const result = await a.recordVaccinations({ vaccineId: 1, source: 'ON_FARM', administeredAt: '2026-11-05T08:30', batchNo: 'L', animals: [
    { cattleCode: 'BC-101', scheduledDoseId: 1, expectedDoseVersion: 0, decision: 'VACCINATE' },
    { cattleCode: 'BC-102', scheduledDoseId: 3, expectedDoseVersion: 0, decision: 'VACCINATE' },
    { cattleCode: 'BC-103', scheduledDoseId: 5, expectedDoseVersion: 0, decision: 'VACCINATE' },
  ] })
  assert.equal(result.vaccinatedCount, 1)
  assert.deepEqual(result.skipped, [
    { cattleCode: 'BC-101', message: 'BC-101 đã tiêm mũi 1 của lịch này nên được bỏ qua.' },
    { cattleCode: 'BC-103', message: 'BC-103 đã rời đàn nên được bỏ qua.' },
  ])
})

test('TC-09-16/17: lỗi một con là lỗi cả lô; mũi đã đổi trả CONFLICT', async () => {
  const { api: a } = api({ ...baseRoutes(), '/api/farms/1/vaccinations': () => { throw new BackendError(409, { code: 'COM-05' }) } })
  await assert.rejects(a.recordVaccinations({ vaccineId: 1, source: 'ON_FARM', administeredAt: '2026-11-05T08:30', batchNo: 'L', animals: [{ cattleCode: 'BC-102', scheduledDoseId: 3, expectedDoseVersion: 0, decision: 'VACCINATE' }] }),
    (e: unknown) => e instanceof Error && e.message === CONFLICT_MESSAGE)
})

test('TC-09-21/23: hoãn mũi kiểm lý do và ngày mới; mũi đã tiêm trả xung đột', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/scheduled-doses/3/defer': { id: 3, status: 'DEFERRED', version: 1, reason: 'Thiếu vắc-xin', newExpectedDate: '2026-11-12' },
    '/api/farms/1/scheduled-doses/1/defer': () => { throw new BackendError(409, { code: 'COM-05' }) } })
  await assert.rejects(a.deferDose(3, { expectedVersion: 0, reason: '' }), (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields.reason))
  await assert.rejects(a.deferDose(3, { expectedVersion: 0, reason: 'x', newExpectedDate: '2026-11-04' }), (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields.newExpectedDate))
  const result = await a.deferDose(3, { expectedVersion: 0, reason: ' Thiếu vắc-xin ', newExpectedDate: '2026-11-12' })
  assert.deepEqual(calls.at(-1)!.body, { expectedVersion: 0, reason: 'Thiếu vắc-xin', newExpectedDate: '2026-11-12', note: null })
  assert.equal(result.message, 'Đã hoãn mũi tiêm đến 12/11/2026.')
  await assert.rejects(a.deferDose(1, { expectedVersion: 1, reason: 'x' }), (e: unknown) => e instanceof Error && e.message === CONFLICT_MESSAGE)
})

const historyRow = (id: number, extra: Record<string, unknown> = {}) => ({
  id, administeredAt: '2026-11-01T01:30:00Z', vaccinationDate: '2026-11-01', cattleId: 101, cattleCode: 'BC-101', penId: 11, penCode: 'A1', penName: 'Chuồng A1',
  vaccineId: 1, vaccineName: 'Aftopor (LMLM)', dose: '2 ml', batchNo: 'L-01', source: 'ON_FARM', vaccinator: 'Trần Văn Kỹ', withdrawalEndDate: '2026-11-22',
  reactionCaseId: null, reactionCaseCode: null, status: 'VALID', corrected: false, version: 0, ...extra,
})

test('TC-09-API03: lịch sử toàn đàn mặc định 3 tháng, đổi giờ trại và số ngày ngưng', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/vaccinations/history': [historyRow(1), historyRow(2, { administeredAt: null, vaccinationDate: '2026-09-01', source: 'HISTORICAL', withdrawalEndDate: null, batchNo: null })] })
  const page = await a.listHistory({ q: ' BC ' })
  const params = new URL(calls.find((c) => c.path.includes('/vaccinations/history'))!.path, 'http://x').searchParams
  assert.equal(params.get('from'), '2026-08-05')
  assert.equal(params.get('to'), '2026-11-05')
  assert.equal(params.get('search'), 'BC')
  assert.equal(page.rows[0].administeredAt, '2026-11-01T08:30')
  assert.equal(page.rows[0].withdrawalDays, 21)
  assert.equal(page.rows[0].penCode, 'A1')
  assert.equal(page.rows[1].administeredAt, '2026-09-01T00:00')
  assert.equal(page.rows[1].source, 'HISTORICAL')
})

test('TC-09-API04: tab tiêm của một con: tra mã bò, lịch sử toàn thời gian và mũi còn mở', async () => {
  const { api: a, calls } = api({ ...baseRoutes(),
    '/api/farms/1/cattle/resolve': { cattleId: 102, cattle: cow(102, 'BC-102') },
    '/api/farms/1/vaccinations/history': [historyRow(3, { cattleId: 102, cattleCode: 'BC-102' })] })
  const view = await a.getCattleVaccination('BC-102')
  const history = calls.find((c) => c.path.includes('/vaccinations/history'))!
  assert.match(history.path, /cattleId=102/)
  assert.match(history.path, /from=1970-01-01/)
  assert.deepEqual(view.doses.map((d) => d.id), [3, 4])
  assert.equal(view.records[0].id, 3)
  assert.equal(Object.hasOwn(view.records[0], 'penCode'), false)
})

test('TC-09-24/27: sửa và hủy bản ghi gửi expectedVersion, lý do và số ngày ngưng (GAP-FE09-04)', async () => {
  const { api: a, calls } = api({ ...baseRoutes(),
    '/api/farms/1/vaccinations/history': [historyRow(1)],
    '/api/farms/1/vaccinations/1/correction': { id: 1, status: 'VALID', version: 1, withdrawalEndDate: '2026-12-02', corrected: true, withdrawalDays: 30, cattleWithdrawalEndDate: '2026-12-02' },
    '/api/farms/1/vaccinations/1/void': { id: 1, status: 'VOIDED', version: 2, withdrawalEndDate: null, corrected: true } })
  await a.listHistory({})
  const base = { expectedVersion: 0, vaccineId: 1, administeredAt: '2026-11-02T08:30', batchNo: 'L-02', dose: '2 ml', route: 'IM' as const, withdrawalDays: 21, vaccinator: 'Trần Văn Kỹ', reason: 'Nhập nhầm ngày' }
  await assert.rejects(a.correctRecord(1, { ...base, withdrawalDays: 366 }), (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields.withdrawalDays))
  const corrected = await a.correctRecord(1, { ...base, withdrawalDays: 30 })
  assert.deepEqual(calls.at(-1)!.body, {
    expectedVersion: 0, vaccineId: 1, vaccinationDate: '2026-11-02', administeredAt: '2026-11-02T08:30:00+07:00', batchNo: 'L-02', dose: '2 ml', route: 'INTRAMUSCULAR',
    vaccinator: 'Trần Văn Kỹ', reason: 'Nhập nhầm ngày', withdrawalDays: 30,
  })
  assert.equal(corrected.corrected, true)
  assert.equal(corrected.withdrawalDays, 30)
  assert.equal(corrected.withdrawalEndDate, '2026-12-02')
  assert.equal(corrected.version, 1)

  await assert.rejects(a.voidRecord(1, { expectedVersion: 1, reason: '' }), VaccinationValidationError)
  const voided = await a.voidRecord(1, { expectedVersion: 1, reason: 'Ghi trùng' })
  assert.deepEqual(calls.at(-1)!.body, { expectedVersion: 1, reason: 'Ghi trùng' })
  assert.equal(voided.status, 'VOIDED')
  assert.equal(voided.withdrawalEndDate, undefined)
})

test('GAP-FE09-02: lịch đã dừng hiện lý do dừng do backend lưu (stopReason)', async () => {
  const stopped = schedules.map((s) => (s.status === 'STOPPED' ? { ...s, stopReason: 'Đổi sang vắc-xin khác' } : s))
  const { api: a } = api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules': stopped })
  assert.equal((await a.getSchedule(8)).schedule.stopReason, 'Đổi sang vắc-xin khác')
  assert.equal((await a.getSchedule(7)).schedule.stopReason, undefined)
})

test('GAP-FE09-03: lịch sử tiêm map đường tiêm, số ngày ngưng và lịch sử sửa (revision cũ thiếu trường vẫn đọc được)', async () => {
  const row = {
    ...historyRow(1), route: 'SUBCUTANEOUS', withdrawalDays: 30, withdrawalEndDate: '2026-12-02', corrected: true,
    revisions: [
      { id: 9, changedAt: '2026-11-05T02:00:00Z', changedBy: 'Lê Quản Lý', action: 'CORRECT', reason: 'Sửa ngưng thịt',
        before: { vaccineId: 1, vaccinationDate: '2026-11-02', administeredAt: '2026-11-02T01:30:00Z', batchNo: 'L-01', dose: '2 ml', route: 'SUBCUTANEOUS', vaccinator: 'Kỹ', withdrawalDays: 21, withdrawalEndDate: '2026-11-23' },
        after: { withdrawalDays: 30 } },
      { id: 10, changedAt: '2026-11-06T02:00:00Z', changedBy: 'Lê Quản Lý', action: 'VOID', reason: 'Ghi nhầm',
        before: { vaccineId: 1, vaccinationDate: '2026-11-02', batchNo: 'L-01', dose: '2 ml', route: '', vaccinator: 'Kỹ', withdrawalEndDate: '2026-11-23' }, after: {} },
    ],
  }
  const { api: a } = api({ ...baseRoutes(), '/api/farms/1/vaccinations/history': [row] })
  const [record] = (await a.listHistory({})).rows
  assert.equal(record.route, 'SC')
  assert.equal(record.withdrawalDays, 30)
  assert.deepEqual(record.revisions[0], {
    at: '2026-11-05T09:00', by: 'Lê Quản Lý', action: 'CORRECT', reason: 'Sửa ngưng thịt',
    before: { vaccineId: 1, administeredAt: '2026-11-02T08:30', batchNo: 'L-01', dose: '2 ml', route: 'SC', withdrawalDays: 21, vaccinator: 'Kỹ' },
  })
  assert.equal(record.revisions[1].action, 'VOID')
  assert.equal(record.revisions[1].before.administeredAt, '2026-11-02T00:00', 'revision cũ không có administeredAt: lấy ngày tiêm')
  assert.equal(record.revisions[1].before.withdrawalDays, 21, 'revision cũ không có withdrawalDays: suy từ ngày hết ngưng')
  assert.equal(record.revisions[1].before.route, undefined)
})

test('TC-09-API05: giờ trại của Instant qua nửa đêm UTC', () => {
  assert.equal(toFarmTime('2026-11-04T18:30:00Z'), '2026-11-05T01:30')
})

test('TC-09-03b (backend thật): mã MSG-COM-05 kèm reason vẫn hiện lỗi ở ô tên / ô vắc-xin', async () => {
  const failWith = (reason: string) => api({ ...baseRoutes(), '/api/farms/1/vaccination-schedules': (body: unknown) => {
    if (body) throw new BackendError(409, { code: 'MSG-COM-05', params: { reason } })
    return schedules
  } }).api
  await assert.rejects(failWith('active_schedule_name_exists').createSchedule(scheduleCmd()),
    (e: unknown) => e instanceof VaccinationValidationError && e.fields.name === 'Đã có lịch đang chạy cùng tên.')
  await assert.rejects(failWith('vaccine_inactive').createSchedule(scheduleCmd()),
    (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields.vaccineId))
  const { api: conflict } = api({ ...baseRoutes(), '/api/farms/1/vaccinations': () => { throw new BackendError(409, { code: 'MSG-COM-05', params: { expected: 0, actual: 1 } }) } })
  await assert.rejects(conflict.recordVaccinations({ vaccineId: 1, source: 'ON_FARM', administeredAt: '2026-11-05T08:30', batchNo: 'L', animals: [{ cattleCode: 'BC-102', scheduledDoseId: 3, expectedDoseVersion: 0, decision: 'VACCINATE' }] }),
    (e: unknown) => e instanceof Error && e.message === CONFLICT_MESSAGE)
})

test('SCR-33 #4 (backend thật): MSG-COM-15 / MSG-COM-07 hiện dưới ô Thời điểm tiêm bằng tiếng Việt', async () => {
  const failWith = (body: unknown) => api({ ...baseRoutes(), '/api/farms/1/vaccinations': () => { throw new BackendError(422, body) } }).api
  const cmd = { vaccineId: 1, source: 'ON_FARM' as const, administeredAt: '2026-11-05T08:30', batchNo: 'L', animals: [{ cattleCode: 'BC-102', scheduledDoseId: 3, expectedDoseVersion: 0, decision: 'VACCINATE' as const }] }
  await assert.rejects(failWith({ code: 'MSG-COM-15', params: { entryDate: '2026-08-01' }, message: 'The time cannot be earlier than the herd entry date (2026-08-01).' }).recordVaccinations(cmd),
    (e: unknown) => e instanceof VaccinationValidationError && e.fields.administeredAt === 'Thời điểm không được trước ngày nhập đàn (01/08/2026).')
  await assert.rejects(failWith({ code: 'MSG-COM-07', params: {}, message: 'The time cannot be in the future.' }).recordVaccinations(cmd),
    (e: unknown) => e instanceof VaccinationValidationError && e.fields.administeredAt === 'Thời điểm tiêm không được ở tương lai.')
})
