import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendError, createBackendClient } from '../../src/api/backendClient'
import type { BackendTransport } from '../../src/api/backendTransport'
import { createGrowthBackend, toFarmTime, toInstant } from '../../src/features/growth/api/growthBackend'
import { GrowthLargeChangeError, GrowthValidationError } from '../../src/features/growth/domain/growthRules'

type Call = { method: string; path: string; body?: unknown; key?: string }

/** Transport giả: ghi lại request, trả response theo path. */
function fakeTransport(routes: Record<string, unknown | ((body: unknown) => unknown)>) {
  const calls: Call[] = []
  const answer = (path: string, body?: unknown) => {
    const bare = path.split('?')[0]
    const hit = routes[path] ?? routes[bare]
    if (hit === undefined) throw new Error(`Unexpected request: ${path}`)
    return typeof hit === 'function' ? (hit as (b: unknown) => unknown)(body) : structuredClone(hit)
  }
  const transport: BackendTransport = {
    async get(path) { calls.push({ method: 'GET', path }); return answer(path) },
    async command(path, body, options) { calls.push({ method: options?.method ?? 'POST', path, body, key: options?.key }); return answer(path, body) },
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
  }
  return { transport, calls }
}

const profile = {
  id: 203, displayCode: 'BC-000203', earTagNumber: 'VN-203', name: 'Mận', sex: 'FEMALE', breedName: 'Brahman',
  lifeStage: 'ADULT', herdStatus: 'ACTIVE', herdGroup: 'FATTENING', penId: 11, penCode: 'A1', penName: 'Chuồng A1',
  entry: { source: 'PURCHASE', entryDate: '2026-06-01' },
}
const resolve = { farmId: 1, cattleId: 203, switchFarmRequired: false, replacedTag: false, cattle: profile }
const record = (id: number, at: string, kg: number | null, extra: Record<string, unknown> = {}) => ({
  id, cattleId: 203, measuredAt: at, recordedAt: at, measuredBy: 5, measuredByName: 'Trần Quốc Long', method: 'SCALE',
  weightKg: kg, basis: kg === null ? null : 'MEASURED', heartGirthCm: null, bodyLengthCm: null, bcs: 3, note: null,
  status: 'VALID', corrected: false, version: 0, ...extra,
})
const summary = {
  currentWeight: record(2, '2026-10-01T01:00:00Z', 420), latestBcs: 3, adg: 0.85, windowDays: 90, nextWeighing: '2026-10-31',
  projectedFinishingDate: null, finishingStatus: 'NOT_APPLICABLE', measurements: 2,
  records: [record(2, '2026-10-01T01:00:00Z', 420), record(1, '2026-08-01T01:00:00Z', 368, { method: 'OTHER', basis: 'ESTIMATED', status: 'CORRECTED' })],
}
const clock = () => new Date('2026-11-09T03:00:00Z')

test('TC-08-API01: giờ trại đổi qua lại Instant theo UTC+7', () => {
  assert.equal(toFarmTime('2026-10-01T01:00:00Z'), '2026-10-01T08:00')
  assert.equal(toFarmTime('2026-10-01T20:30:00Z'), '2026-10-02T03:30')
  assert.equal(toInstant('2026-10-02T03:30'), '2026-10-02T03:30:00+07:00')
  assert.equal(Date.parse(toInstant(toFarmTime('2026-10-01T20:30:00Z'))), Date.parse('2026-10-01T20:30:00Z'))
})

test('TC-08-API03: danh sách đàn gửi bộ lọc, đổi trang 1-based ↔ 0-based và map cờ cảnh báo', async () => {
  const { transport, calls } = fakeTransport({
    '/api/farms/1/pens': { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }, { id: 12, code: 'B1', name: 'Chuồng B1' }] },
    '/api/farms/1/growth': {
      items: [
        { cattleId: 203, code: 'BC-000203', breed: 'Brahman', sex: 'FEMALE', penCode: 'B1', penName: 'Chuồng B1', weightKg: 420, basis: 'MEASURED', weighedOn: '2026-10-01', adg: 0.85, bcs: 3, flags: ['LOW_ADG'] },
        { cattleId: 204, code: 'BC-000204', breed: 'Lai Sind', sex: 'MALE', penCode: 'B1', penName: 'Chuồng B1', weightKg: null, basis: null, weighedOn: null, adg: null, bcs: 2, flags: ['WEIGHING_OVERDUE', 'LOW_BCS'] },
      ],
      total: 9, page: 1, size: 7, windowDays: 30, summary: { WEIGHING_OVERDUE: 3, LOW_ADG: 2, LOW_BCS: 1, WEIGHINGS_30_DAYS: 14 },
    },
  })
  const api = createGrowthBackend({ farmId: 1, transport, clock })
  const page = await api.listHerd({ q: ' 203 ', penCode: 'B1', herdGroup: 'FATTENING', lifeStage: 'ADULT', windowDays: 30, page: 2, dir: 'desc' })

  const growthCall = calls.find((c) => c.path.startsWith('/api/farms/1/growth'))!
  const params = new URL(growthCall.path, 'http://x').searchParams
  assert.equal(params.get('q'), '203')
  assert.equal(params.get('penId'), '12')
  assert.equal(params.get('herdGroup'), 'FATTENING')
  assert.equal(params.get('lifeStage'), 'ADULT')
  assert.equal(params.get('windowDays'), '30')
  assert.equal(params.get('page'), '1')
  assert.equal(params.get('size'), '7')
  assert.equal(params.get('sort'), '-weighedOn')

  assert.equal(page.page, 2)
  assert.equal(page.total, 9)
  assert.equal(page.windowDays, 30)
  assert.deepEqual(page.tiles, { overdue: 3, lowAdg: 2, lowBcs: 1, weighings30: 14 })
  assert.equal(page.rows[0].status, 'LOW_ADG')
  assert.equal(page.rows[0].sex, 'Cái')
  assert.equal(page.rows[0].latestWeightKg, 420)
  assert.equal(page.rows[1].status, 'OVERDUE')
  assert.equal(page.rows[1].latestWeightKg, undefined)
})

test('TC-08-API02: bộ lọc chuồng lấy từ /pens, không hardcode', async () => {
  const { transport } = fakeTransport({ '/api/farms/1/pens': { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }] } })
  const options = await createGrowthBackend({ farmId: 1, transport, clock }).filterOptions()
  assert.deepEqual(options.pens, [{ code: 'A1', label: 'Chuồng A1' }])
  assert.ok(options.herdGroups.length > 0 && options.lifeStages.length > 0)
})

test('TC-08-API04: hồ sơ tăng trưởng tra mã bò rồi đọc /cattle/{id}/growth, số tổng hợp lấy theo backend', async () => {
  const { transport, calls } = fakeTransport({
    '/api/farms/1/cattle/resolve': resolve,
    '/api/farms/1/cattle/203/growth': summary,
  })
  const api = createGrowthBackend({ farmId: 1, transport, clock })
  const p = await api.getProfile('BC-000203')

  assert.equal(calls[0].path, '/api/farms/1/cattle/resolve?code=BC-000203')
  assert.equal(calls[1].path, '/api/farms/1/cattle/203/growth?windowDays=90')
  assert.equal(p.cattle.code, 'BC-000203')
  assert.equal(p.cattle.sex, 'Cái')
  assert.equal(p.cattle.herdEntryDate, '2026-06-01')
  assert.equal(p.adg90, 0.85)
  assert.equal(p.latestBcs, 3)
  assert.equal(p.nextWeighingDate, '2026-10-31')
  assert.equal(p.count, 2)
  assert.equal(p.records[0].measuredAt, '2026-10-01T08:00')
  assert.equal(p.latest?.kg, 420)
  // OTHER của backend = "ước lượng" ở màn hình; CORRECTED = hợp lệ + đã sửa.
  assert.equal(p.records[1].method, 'ESTIMATE')
  assert.equal(p.records[1].status, 'VALID')
  assert.equal(p.records[1].corrected, true)
  assert.equal(p.correctedCount, 1)

  await api.getProfile('BC-000203')
  assert.equal(calls.filter((c) => c.path.includes('/resolve')).length, 1, 'mã bò chỉ resolve một lần')
})

test('TC-08-20: hộp thoại ghi nhận lấy người đo từ /members (userId, chỉ ACTIVE) và giờ trại hiện tại', async () => {
  const { transport } = fakeTransport({
    '/api/farms/1/cattle/resolve': resolve,
    '/api/farms/1/members': [
      { id: 1, userId: 5, fullName: 'Trần Quốc Long', role: 'TECHNICIAN', status: 'ACTIVE' },
      { id: 2, userId: 6, fullName: 'Nghỉ việc', role: 'WORKER', status: 'REMOVED' },
    ],
  })
  const options = await createGrowthBackend({ farmId: 1, transport, clock }).formOptions('BC-000203')
  assert.deepEqual(options.members, [{ id: 5, name: 'Trần Quốc Long' }])
  assert.equal(options.now, '2026-11-09T10:00')
  assert.equal(options.cattle.penCode, 'A1')
})

test('TC-08-20 với A1 dạng {items, counts} (FE-03 D29): vẫn lấy người đo đang hoạt động theo userId', async () => {
  const { transport } = fakeTransport({
    '/api/farms/1/cattle/resolve': resolve,
    '/api/farms/1/members': {
      farmName: 'Trại', timeZone: 'Asia/Ho_Chi_Minh', serviceStatus: 'ACTIVE', counts: { all: 2, managers: 1, technicians: 1 },
      items: [
        { id: 1, userId: 5, fullName: 'Trần Quốc Long', email: 'long@example.test', role: 'MANAGER', status: 'ACTIVE', joinedAt: '2024-05-02T02:00:00Z', version: 1, actions: [] },
        { id: 2, userId: 6, fullName: 'Lê Thị Mai', email: 'mai@example.test', role: 'TECHNICIAN', status: 'ACTIVE', joinedAt: '2025-01-02T02:00:00Z', version: 1, actions: [] },
      ],
    },
  })
  const options = await createGrowthBackend({ farmId: 1, transport, clock }).formOptions('BC-000203')
  assert.deepEqual(options.members, [{ id: 5, name: 'Trần Quốc Long' }, { id: 6, name: 'Lê Thị Mai' }])
})

test('TC-08-06: ghi nhận gửi Measurement đúng DTO, không gửi basis, có Idempotency-Key', async () => {
  let sent: Record<string, unknown> = {}
  let key: string | null = null
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) return Response.json({ token: 'csrf-ok' })
    if (url.includes('/cattle/resolve')) return Response.json(resolve)
    if (url.endsWith('/api/farms/1/cattle/203/growth') && init?.method === 'POST') {
      sent = JSON.parse(String(init.body))
      key = new Headers(init.headers).get('Idempotency-Key')
      return Response.json(record(9, '2026-11-09T00:30:00Z', 431.5, { method: 'TAPE', basis: 'ESTIMATED', heartGirthCm: 190, bodyLengthCm: 140 }), { status: 201 })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  const api = createGrowthBackend({ farmId: 1, transport: createBackendClient({ fetchImpl }), clock })
  const saved = await api.record('BC-000203', { measuredAt: '2026-11-09T07:30', measuredBy: 5, method: 'TAPE', heartGirthCm: 190, bodyLengthCm: 140, bcs: 3, note: 'Cân tháng 11' })

  assert.ok(key, 'thiếu Idempotency-Key')
  assert.equal(sent.measuredAt, '2026-11-09T07:30:00+07:00')
  assert.equal(sent.method, 'TAPE')
  assert.equal(sent.measuredBy, 5)
  assert.equal(sent.weightKg, null)
  assert.equal(sent.acknowledgedLargeChange, false)
  assert.equal(Object.hasOwn(sent, 'basis'), false)
  assert.equal(saved.basis, 'ESTIMATED')
  assert.equal(saved.weightKg, 431.5)
  assert.equal(saved.measuredAt, '2026-11-09T07:30')
})

test('TC-08-API05: phương pháp "ước lượng" gửi lên backend là OTHER', async () => {
  const { transport, calls } = fakeTransport({
    '/api/farms/1/cattle/resolve': resolve,
    '/api/farms/1/cattle/203/growth': record(10, '2026-11-09T00:30:00Z', 400, { method: 'OTHER', basis: 'ESTIMATED' }),
  })
  const saved = await createGrowthBackend({ farmId: 1, transport, clock }).record('BC-000203', { measuredAt: '2026-11-09T07:30', method: 'ESTIMATE', weightKg: 400 })
  assert.equal((calls[1].body as Record<string, unknown>).method, 'OTHER')
  assert.equal(saved.method, 'ESTIMATE')
})

test('TC-08-07: MSG-FE08-04 đổi thành GrowthLargeChangeError; gửi lại kèm acknowledgedLargeChange', async () => {
  let attempt = 0
  const { transport, calls } = fakeTransport({
    '/api/farms/1/cattle/resolve': resolve,
    '/api/farms/1/cattle/203/growth': (body: unknown) => {
      attempt += 1
      if (!(body as { acknowledgedLargeChange: boolean }).acknowledgedLargeChange) {
        throw new BackendError(422, { code: 'MSG-FE08-04', params: { new: 520, last: 420, date: '2026-10-01' } })
      }
      return record(11, '2026-11-09T00:30:00Z', 520)
    },
  })
  const api = createGrowthBackend({ farmId: 1, transport, clock })
  const command = { measuredAt: '2026-11-09T07:30', method: 'SCALE' as const, weightKg: 520 }
  await assert.rejects(api.record('BC-000203', command), (error: unknown) => {
    assert.ok(error instanceof GrowthLargeChangeError)
    assert.equal(error.newKg, 520)
    assert.equal(error.lastKg, 420)
    assert.equal(error.lastAt, '2026-10-01')
    return true
  })
  const saved = await api.record('BC-000203', { ...command, acknowledgedLargeChange: true })
  assert.equal(saved.weightKg, 520)
  assert.equal(attempt, 2)
  assert.equal((calls.at(-1)!.body as Record<string, unknown>).acknowledgedLargeChange, true)
})

test('TC-08-01/02: lỗi trường của backend hiện đúng ô (COM-10 field, MSG-FE08-02)', async () => {
  const failWith = (body: unknown) => fakeTransport({
    '/api/farms/1/cattle/resolve': resolve,
    '/api/farms/1/cattle/203/growth': () => { throw new BackendError(400, body) },
  }).transport
  const cmd = { measuredAt: '2026-11-09T07:30', method: 'SCALE' as const, weightKg: 2000 }

  await assert.rejects(createGrowthBackend({ farmId: 1, transport: failWith({ code: 'COM-10', params: { field: 'weightKg' } }), clock }).record('BC-000203', cmd),
    (error: unknown) => error instanceof GrowthValidationError && Boolean(error.fields.weightKg))
  await assert.rejects(createGrowthBackend({ farmId: 1, transport: failWith({ code: 'MSG-FE08-02' }), clock }).record('BC-000203', { measuredAt: cmd.measuredAt }),
    (error: unknown) => error instanceof GrowthValidationError && Boolean(error.fields.form))
  await assert.rejects(createGrowthBackend({ farmId: 1, transport: failWith({ code: 'COM-02', message: 'Không có quyền' }), clock }).record('BC-000203', cmd),
    (error: unknown) => error instanceof BackendError && error.code === 'COM-02', 'lỗi khác giữ nguyên để màn hình hiện thông báo chung')
})

test('TC-08-13: sửa bản ghi gửi Measurement đầy đủ, lý do và expectedVersion', async () => {
  const { transport, calls } = fakeTransport({
    '/api/farms/1/cattle/resolve': resolve,
    '/api/farms/1/cattle/203/growth': summary,
    '/api/farms/1/cattle/203/growth/2/correction': record(2, '2026-10-01T01:00:00Z', 425, { version: 1, status: 'CORRECTED' }),
  })
  const api = createGrowthBackend({ farmId: 1, transport, clock })
  await api.getProfile('BC-000203')
  const saved = await api.correct('BC-000203', 2, { action: 'CORRECT', reason: 'Nhập nhầm', expectedVersion: 0, values: { measuredAt: '2026-10-01T08:00', method: 'SCALE', weightKg: 425 } })

  const sent = calls.at(-1)!
  assert.equal(sent.method, 'POST')
  const body = sent.body as { action: string; reason: string; expectedVersion: number; values: Record<string, unknown> }
  assert.equal(body.action, 'CORRECT')
  assert.equal(body.reason, 'Nhập nhầm')
  assert.equal(body.expectedVersion, 0)
  assert.equal(body.values.measuredAt, '2026-10-01T08:00:00+07:00')
  assert.equal(body.values.weightKg, 425)
  assert.equal(body.values.bcs, 3, 'giữ BCS cũ khi người dùng không sửa trường này')
  assert.equal(body.values.measuredBy, 5)
  assert.equal(saved.corrected, true)
  assert.equal(saved.version, 1)
})

test('TC-08-15: loại trừ không gửi values; xung đột version giữ nguyên lỗi backend', async () => {
  const { transport, calls } = fakeTransport({
    '/api/farms/1/cattle/resolve': resolve,
    '/api/farms/1/cattle/203/growth/2/correction': (body: unknown) => {
      if ((body as { expectedVersion: number }).expectedVersion !== 1) throw new BackendError(409, { code: 'COM-05' })
      return record(2, '2026-10-01T01:00:00Z', 420, { version: 2, status: 'EXCLUDED' })
    },
  })
  const api = createGrowthBackend({ farmId: 1, transport, clock })
  await assert.rejects(api.correct('BC-000203', 2, { action: 'EXCLUDE', reason: 'Cân lỗi', expectedVersion: 0 }),
    (error: unknown) => error instanceof BackendError && error.status === 409)
  const saved = await api.correct('BC-000203', 2, { action: 'EXCLUDE', reason: 'Cân lỗi', expectedVersion: 1 })
  assert.equal((calls.at(-1)!.body as { values: unknown }).values, null)
  assert.equal(saved.status, 'EXCLUDED')
})
