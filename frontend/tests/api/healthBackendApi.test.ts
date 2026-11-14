import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendError } from '../../src/api/backendClient'
import type { BackendTransport } from '../../src/api/backendTransport'
import { createHealthBackend, mapHealthError } from '../../src/features/health/api/healthBackend'
import { HealthValidationError } from '../../src/features/health/domain/healthRules'

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

// Hôm nay theo giờ trại: 05/11/2026 10:00.
const clock = () => new Date('2026-11-05T03:00:00Z')
const backendError = (status: number, code: string, params: Record<string, unknown> = {}) => new BackendError(status, { code, params, message: 'x' } as never)

const cattle = { id: 101, displayCode: 'BC-101', name: null, earTagNumber: 'TAG-101', breedName: 'Brahman', sex: 'FEMALE', lifeStage: 'ADULT', birthDate: '2024-05-01', herdStatus: 'ACTIVE', penCode: 'A1', penName: 'Chuồng A1', entry: { entryDate: '2026-01-10' } }
const members = [{ userId: 7, fullName: 'Lê Quản Lý', status: 'ACTIVE' }, { userId: 8, fullName: 'Nguyễn Kỹ Thuật', status: 'ACTIVE' }, { userId: 9, fullName: 'Người cũ', status: 'LEFT' }]
const medicines = [
  { id: 3, code: 'OXY', name: 'Oxytetracycline 20% LA', description: '1 ml / 10 kg', dose: '30 ml', route: 'INTRAMUSCULAR', withdrawalDays: 28, available: true },
  { id: 7, code: 'ENRO', name: 'Enrofloxacin 10%', description: null, dose: '10 ml', route: 'IM', withdrawalDays: 14, available: false },
]
const timeline = [
  { id: 51, caseId: 412, type: 'OPENING', occurredAt: '2026-10-13T00:00:00Z', recordedBy: 'Lê Quản Lý', observer: 'Nguyễn Kỹ Thuật', observerId: 8, status: 'VALID', corrected: false, version: 0, temperatureC: 40.2, progress: 'UNCHANGED', description: 'Sốt, bỏ ăn', linkedVaccinationId: 77 },
  { id: 52, caseId: 412, type: 'TREATMENT', occurredAt: '2026-10-14T01:00:00Z', status: 'VALID', corrected: true, version: 1, medicineId: 3, medicineName: 'Oxytetracycline 20% LA', dose: '30 ml', route: 'INTRAMUSCULAR', courseDays: 3, withdrawalDays: 28, withdrawalEndDate: '2026-11-13', performer: 'BS. Hùng', veterinaryAdvice: 'Theo dõi' },
  { id: 53, caseId: 412, type: 'FOLLOW_UP', occurredAt: '2026-10-15T02:30:00Z', recordedBy: 'Lê Quản Lý', observer: 'Lê Quản Lý', observerId: 7, status: 'VOIDED', corrected: false, version: 2, temperatureC: null, progress: 'IMPROVED', description: 'Ăn lại' },
]
const profile = {
  cattleId: 101, cattleCode: 'BC-101', healthState: 'UNDER_TREATMENT', withdrawalEndDate: '2026-11-13', suspectedContagious: true,
  pendingExit: null,
  openCases: [{ id: 412, caseCode: 'HC-000412', status: 'OPEN', severity: 'MODERATE', diagnosis: 'Viêm phổi', suspectedContagious: true, openingSigns: 'Sốt, bỏ ăn', openedDate: '2026-10-13', openedAt: '2026-10-13T00:00:00Z', dayN: 24, chronicSince: null, treatmentCount: 1, linkedVaccinationId: 77, latestEntryAt: '2026-10-14T01:00:00Z', timeline, version: 2 }],
  previousCases: [{ id: 331, caseCode: 'HC-000331', openingSigns: 'Ho', diagnosis: null, severity: 'MILD', openedDate: '2026-09-01', outcome: 'RECOVERED', closedDate: '2026-09-20', month: '2026-09', confirmedBy: 'Lê Quản Lý' }],
}
const baseRoutes = () => ({
  '/api/farms/1/cattle/resolve': { farmId: 1, cattleId: 101, cattle: { id: 101, displayCode: 'BC-101' } },
  '/api/farms/1/cattle/101': cattle,
  '/api/farms/1/members': members,
  '/api/farms/1/medicines': medicines,
  '/api/farms/1/pens': [{ id: 11, code: 'A1', name: 'Chuồng A1' }, { id: 12, code: 'B1', name: 'Chuồng B1' }],
  '/api/farms/1/health-cases/cattle/101': profile,
})
const api = (routes: Record<string, unknown> = baseRoutes()) => {
  const { transport, calls } = fakeTransport(routes)
  return { api: createHealthBackend({ farmId: 1, transport, clock }), calls }
}
const post = (calls: Call[], suffix: string) => calls.find((c) => c.method === 'POST' && c.path.endsWith(suffix))!.body as Record<string, unknown>

async function rejection(promise: Promise<unknown>) {
  try { await promise } catch (e) { return e as Error }
  throw new Error('expected rejection')
}

// ------------------------------------------------------------------ A1

test('A1 / TC-10-26: danh sách ca gửi tab, kỳ, chuồng theo id và đọc counts; giờ mở theo giờ trại', async () => {
  const { api: a, calls } = api({
    ...baseRoutes(),
    '/api/farms/1/health-cases': {
      items: [{ id: 412, caseCode: 'HC-000412', cattleId: 101, cattleCode: 'BC-101', breed: 'Brahman', sex: 'FEMALE', penId: 11, penCode: 'A1', penName: 'Chuồng A1', diagnosis: 'Viêm phổi', signs: 'Sốt', suspectedContagious: true, severity: 'MODERATE', openedDate: '2026-10-13', openedAt: '2026-10-13T00:00:00Z', dayN: 24, status: 'OPEN', chronicSince: null, outcome: null, closedDate: null, treatmentCount: 1, version: 2 }],
      total: 1, page: 0, size: 200, counts: { open: 3, chronic: 1, closed: 0, all: 4 },
    },
  })
  const list = await a.listCases({ tab: 'closed', penCode: 'B1', from: '2026-10-01', to: '2026-11-05', severity: 'SEVERE', search: ' bc ', sort: 'caseCode', dir: 'asc' })
  assert.equal(calls.find((c) => c.path.startsWith('/api/farms/1/health-cases?'))!.path, '/api/farms/1/health-cases?tab=CLOSED&search=bc&severity=SEVERE&penId=12&from=2026-10-01&to=2026-11-05&sort=caseCode&dir=asc&page=0&size=200')
  assert.deepEqual(list.counts, { open: 3, chronic: 1, closed: 0, all: 4 })
  assert.deepEqual(list.pens, [{ id: 11, code: 'A1', name: 'Chuồng A1' }, { id: 12, code: 'B1', name: 'Chuồng B1' }])
  assert.deepEqual(list.rows[0], {
    id: 412, caseCode: 'HC-000412', cattleCode: 'BC-101', cattleName: '', breed: 'Brahman', sex: 'Cái', penCode: 'A1', penName: 'Chuồng A1', diagnosis: 'Viêm phổi', signs: 'Sốt', suspectedContagious: true,
    severity: 'MODERATE', openedDate: '2026-10-13', openedAt: '2026-10-13T07:00', status: 'OPEN', chronicSince: undefined, outcome: undefined, treatmentCount: 1, day: 24, version: 2,
  })
  // Chuồng không có trong trại: không gọi backend với penId sai.
  assert.deepEqual((await a.listCases({ penCode: 'ZZ' })).rows, [])
})

// ------------------------------------------------------------------ A2

test('A2 / SCR-37: hồ sơ gộp dòng thời gian của các ca đang mở (mới nhất trước), đủ trường để sửa, ca cũ và đầu hồ sơ bò', async () => {
  const { api: a, calls } = api()
  const p = await a.getProfile('BC-101')
  assert.equal(calls.find((c) => c.path.startsWith('/api/farms/1/cattle/resolve'))!.path, '/api/farms/1/cattle/resolve?code=BC-101')
  assert.deepEqual(p.cattle, { code: 'BC-101', name: '', earTag: 'TAG-101', breed: 'Brahman', sex: 'Cái', ageText: '30 tháng', stage: 'ADULT', penCode: 'A1', penName: 'Chuồng A1', entryDate: '2026-01-10', status: 'ACTIVE', exitDate: undefined, exitType: undefined })
  assert.equal(p.healthState, 'UNDER_TREATMENT')
  assert.equal(p.withdrawalEndDate, '2026-11-13')
  assert.equal(p.suspectedContagious, true)
  assert.equal(p.pendingExit, null)
  assert.equal(p.activeCases.length, 1)
  assert.deepEqual(p.activeCases[0], {
    id: 412, caseCode: 'HC-000412', status: 'OPEN', severity: 'MODERATE', diagnosis: 'Viêm phổi', signs: 'Sốt, bỏ ăn', openingSigns: 'Sốt, bỏ ăn', suspectedContagious: true,
    openedAt: '2026-10-13T07:00', openedDate: '2026-10-13', chronicSince: undefined, treatmentCount: 1, day: 24, withdrawalEndDate: '2026-11-13', latestEntryAt: '2026-10-14T08:00', version: 2,
  })
  assert.deepEqual(p.timeline.map((r) => [r.id, r.type, r.occurredAt, r.status, r.recordedBy]), [
    [53, 'FOLLOW_UP', '2026-10-15T09:30', 'VOIDED', 'Lê Quản Lý'], [52, 'TREATMENT', '2026-10-14T08:00', 'VALID', 'BS. Hùng'], [51, 'OPENING', '2026-10-13T07:00', 'VALID', 'Nguyễn Kỹ Thuật'],
  ])
  const treatment = p.timeline[1]
  assert.deepEqual([treatment.medicineId, treatment.medicineName, treatment.dose, treatment.route, treatment.courseDays, treatment.withdrawalDays, treatment.withdrawalEndDate, treatment.veterinaryAdvice, treatment.corrected],
    [3, 'Oxytetracycline 20% LA', '30 ml', 'INTRAMUSCULAR', 3, 28, '2026-11-13', 'Theo dõi', true])
  assert.equal(treatment.details, 'Oxytetracycline 20% LA · 30 ml × 3 ngày · tiêm bắp · ngưng 28 ngày')
  assert.equal(p.timeline[2].details, 'Sốt, bỏ ăn · 40,2°C')
  assert.equal(p.timeline[2].linkedVaccinationId, 77)
  assert.equal(p.timeline[0].progress, 'IMPROVED')
  assert.deepEqual(p.previousCases.map((c) => [c.caseCode, c.outcome, c.closedAt, c.signs]), [['HC-000331', 'RECOVERED', '2026-09-20T00:00', 'Ho']])
})

test('A2: phiếu xuất chờ (Chết / Mất tích) và bò đã rời đàn', async () => {
  const { api: a } = api({
    ...baseRoutes(),
    '/api/farms/1/cattle/101': { ...cattle, herdStatus: 'EXITED', exitDate: '2026-11-01', exitType: 'DEATH' },
    '/api/farms/1/health-cases/cattle/101': { ...profile, openCases: [], pendingExit: { voucherId: 900, code: 'PX-2026-0009', lossKind: 'MISSING', exitDate: '2026-11-04', caseId: 412, caseCode: 'HC-000412' } },
  })
  const p = await a.getProfile('BC-101')
  assert.deepEqual(p.cattle.status, 'EXITED')
  assert.deepEqual([p.cattle.exitDate, p.cattle.exitType], ['2026-11-01', 'DEATH'])
  assert.deepEqual(p.pendingExit, { id: 900, cattleCode: 'BC-101', caseCode: 'HC-000412', type: 'OTHER', reason: 'Mất tích', date: '2026-11-04', reportedBy: '', status: 'PENDING' })
})

test('formOptions: thuốc từ danh mục, tên thành viên ACTIVE và gợi ý chẩn đoán từ các ca của trại', async () => {
  const { api: a } = api({ ...baseRoutes(), '/api/farms/1/health-cases': { items: [{ id: 1, diagnosis: 'Viêm phổi' }, { id: 2, diagnosis: 'Tiêu chảy' }, { id: 3, diagnosis: 'Viêm phổi' }, { id: 4, diagnosis: null }], total: 4, page: 0, size: 200, counts: {} } })
  const o = await a.formOptions()
  assert.deepEqual(o.medicines, [
    { id: 3, name: 'Oxytetracycline 20% LA', active: true, defaultDose: '30 ml', doseNote: '1 ml / 10 kg', route: 'INTRAMUSCULAR', withdrawalDays: 28 },
    { id: 7, name: 'Enrofloxacin 10%', active: false, defaultDose: '10 ml', doseNote: '', route: 'INTRAMUSCULAR', withdrawalDays: 14 },
  ])
  assert.deepEqual(o.members, ['Lê Quản Lý', 'Nguyễn Kỹ Thuật'])
  assert.deepEqual(o.diagnoses, ['Tiêu chảy', 'Viêm phổi'])
})

// ------------------------------------------------------------------ A3 / A4

test('TC-10-03/04: mở ca gửi cattleId, giờ trại có offset, observerId theo tên; nối vào ca đang có trả kind ADDED', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/health-cases': { id: 419, caseCode: 'HC-000419', status: 'OPEN', version: 1, cattleId: 101, cattleCode: 'BC-101', observationId: 60, healthState: 'MONITORING', outcome: null } })
  const r = await a.openCase('BC-101', { observedAt: '2026-11-05T08:30', observer: 'Nguyễn Kỹ Thuật', temperatureC: 39.6, signs: ' Ho, chảy nước mũi ', diagnosis: '', suspectedContagious: false, severity: 'MILD' })
  assert.deepEqual(post(calls, '/health-cases'), { cattleId: 101, existingCaseId: null, expectedVersion: null, observedAt: '2026-11-05T08:30:00+07:00', observerId: 8, temperatureC: 39.6, signs: 'Ho, chảy nước mũi', diagnosis: null, suspectedContagious: false, severity: 'MILD' })
  assert.deepEqual(r, { id: 419, caseCode: 'HC-000419', cattleCode: 'BC-101', status: 'OPEN', version: 1, observationId: 60, healthState: 'MONITORING', kind: 'OPENED', outcome: undefined, deathVoucher: null })
  const added = await a.openCase('BC-101', { existingCaseId: 419, expectedVersion: 1, observedAt: '2026-11-05T09:00', observer: 'Không phải thành viên', temperatureC: null, signs: 'Bú kém', diagnosis: 'Viêm phổi', suspectedContagious: true, severity: 'MODERATE' })
  assert.deepEqual(post(calls, '/health-cases'), { cattleId: 101, existingCaseId: null, expectedVersion: null, observedAt: '2026-11-05T08:30:00+07:00', observerId: 8, temperatureC: 39.6, signs: 'Ho, chảy nước mũi', diagnosis: null, suspectedContagious: false, severity: 'MILD' })
  const second = calls.filter((c) => c.method === 'POST')[1].body as Record<string, unknown>
  assert.deepEqual([second.existingCaseId, second.expectedVersion, second.observerId, second.diagnosis], [419, 1, null, 'Viêm phổi'])
  assert.equal(added.kind, 'ADDED')
  // Bò đọc một lần (resolve + hồ sơ), thành viên đọc một lần.
  assert.equal(calls.filter((c) => c.path.startsWith('/api/farms/1/cattle/resolve')).length, 1)
  assert.equal(calls.filter((c) => c.path === '/api/farms/1/members').length, 1)
})

test('TC-10-01/02/07: lỗi backend hiện dưới đúng ô bằng tiếng Việt', async () => {
  const errorOf = (e: unknown) => (e as HealthValidationError).errors
  assert.deepEqual(errorOf(mapHealthError(backendError(422, 'MSG-FE10-06', { field: 'temperatureC' }))), { temperatureC: 'Thân nhiệt phải trong khoảng 35,0 – 43,0 °C.' })
  assert.deepEqual(errorOf(mapHealthError(backendError(400, 'MSG-COM-06', { field: 'signs' }))), { signs: 'Dấu hiệu / mô tả là bắt buộc.' })
  assert.deepEqual(errorOf(mapHealthError(backendError(400, 'MSG-COM-10', { field: 'diagnosis' }))), { diagnosis: 'Chẩn đoán nghi ngờ tối đa 100 ký tự.'.replace('tối đa 100 ký tự', 'không hợp lệ') })
  assert.deepEqual(errorOf(mapHealthError(backendError(422, 'MSG-FE10-07', { date: '2026-11-01T03:00:00Z' }), 'observedAt')), { observedAt: 'Thời điểm không được trước 01/11/2026 10:00, lần ghi gần nhất của ca này.' })
  assert.deepEqual(errorOf(mapHealthError(backendError(422, 'MSG-FE10-07', { date: '2026-11-01T03:00:00Z' }), 'closedAt', 'Asia/Tokyo')), { closedAt: 'Thời điểm không được trước 01/11/2026 12:00, lần ghi gần nhất của ca này.' })
  assert.deepEqual(errorOf(mapHealthError(backendError(422, 'MSG-COM-15', { date: '2026-01-10' }), 'treatmentTime')), { treatmentTime: 'Thời điểm không được trước ngày nhập đàn (10/01/2026).' })
  assert.deepEqual(errorOf(mapHealthError(backendError(422, 'MSG-COM-07'), 'treatmentTime')), { treatmentTime: 'Thời điểm không được ở tương lai.' })
  assert.deepEqual(errorOf(mapHealthError(backendError(422, 'MSG-FE18-08', { field: 'medicineId' }))), { medicineId: 'Thuốc đã ngưng sử dụng, không thể chọn cho bản ghi mới.' })
  assert.deepEqual(errorOf(mapHealthError(backendError(400, 'MSG-COM-06', { field: 'latestProgress' }))), { progressText: 'Diễn biến mới là bắt buộc.' })
  assert.deepEqual(errorOf(mapHealthError(backendError(400, 'MSG-COM-10', { field: 'performerName' }))), { performer: 'Người thực hiện không hợp lệ.' })
  assert.equal((mapHealthError(backendError(409, 'MSG-COM-05')) as Error).message, 'Bản ghi đã được thay đổi hoặc không còn ở trạng thái cho phép thao tác. Vui lòng tải lại và kiểm tra trước khi thử lại.')
  assert.equal((mapHealthError(backendError(422, 'MSG-COM-17', { cattle_code: 'BC-101' })) as Error).message, 'Bò đang chờ xác nhận chết / mất nên chưa nhận thêm sự kiện chăm sóc mới.')
  assert.equal((mapHealthError(backendError(422, 'MSG-COM-13', { cattle_code: 'BC-101', date: '2026-11-01', exit_type: 'SALE' })) as Error).message, 'BC-101 đã rời đàn ngày 01/11/2026 (SALE). Hồ sơ chỉ được xem.')
  assert.equal((mapHealthError(backendError(409, 'MSG-FE10-13')) as Error).message, 'Lần ghi mở ca không thể hủy. Hãy sửa lại, hoặc đóng ca kèm lý do.')
  const plain = new Error('mạng')
  assert.equal(mapHealthError(plain), plain)
})

test('TC-10-07 (adapter): theo dõi gửi diễn biến, mô tả, observerId và đổi lỗi FE10-07 sang ô Thời điểm', async () => {
  const { api: a, calls } = api({
    ...baseRoutes(),
    '/api/farms/1/health-cases/412/observations': (body: unknown) => {
      if ((body as Record<string, unknown>).observedAt === '2026-10-12T07:00:00+07:00') throw backendError(422, 'MSG-FE10-07', { date: '2026-10-14T01:00:00Z', field: 'observedAt' })
      return { id: 412, caseCode: 'HC-000412', status: 'OPEN', version: 2, cattleId: 101, cattleCode: 'BC-101', observationId: 61, healthState: 'UNDER_TREATMENT' }
    },
  })
  const early = await rejection(a.recordFollowUp(412, { expectedVersion: 2, observedAt: '2026-10-12T07:00', temperatureC: 38.5, progress: 'IMPROVED', description: 'Ăn uống bình thường', observer: 'Lê Quản Lý' }))
  assert.equal((early as HealthValidationError).errors.observedAt, 'Thời điểm không được trước 14/10/2026 08:00, lần ghi gần nhất của ca này.')
  const r = await a.recordFollowUp(412, { expectedVersion: 2, observedAt: '2026-11-05T09:10', temperatureC: 38.5, progress: 'IMPROVED', description: 'Ăn uống bình thường', observer: 'Lê Quản Lý' })
  assert.deepEqual(post(calls, '/412/observations'), { expectedVersion: 2, observedAt: '2026-10-12T07:00:00+07:00', temperatureC: 38.5, progress: 'IMPROVED', description: 'Ăn uống bình thường', observerId: 7 })
  assert.deepEqual([r.kind, r.observationId, r.healthState, r.caseCode], ['FOLLOWED', 61, 'UNDER_TREATMENT', 'HC-000412'])
})

// ------------------------------------------------------------------ A6

test('TC-10-08/09/10: điều trị gửi administeredAt giờ trại, người thực hiện là thành viên (id) hoặc tên ngoài; nhận ngày hết ngưng và ca mở lại', async () => {
  const { api: a, calls } = api({
    ...baseRoutes(),
    '/api/farms/1/health-cases/412/treatments': { id: 70, caseId: 412, caseVersion: 3, caseStatus: 'OPEN', withdrawalEndDate: '2026-12-05', cattleWithdrawalEndDate: '2026-12-05', healthState: 'UNDER_TREATMENT', courseDays: 3, medicineName: 'Oxytetracycline 20% LA', returnedToOpen: true },
  })
  await a.getProfile('BC-101')
  const r = await a.recordTreatment(412, { expectedVersion: 2, medicineId: 3, treatmentTime: '2026-11-05T07:30', dose: '30 ml', route: 'INTRAMUSCULAR', courseDays: 3, withdrawalDays: 28, performer: 'Nguyễn Kỹ Thuật', veterinaryAdvice: '' })
  assert.deepEqual(post(calls, '/412/treatments'), { expectedVersion: 2, medicineId: 3, administeredAt: '2026-11-05T07:30:00+07:00', dose: '30 ml', route: 'INTRAMUSCULAR', courseDays: 3, withdrawalDays: 28, performerId: 8, veterinaryAdvice: null })
  assert.deepEqual(r, { id: 70, caseId: 412, caseCode: 'HC-000412', caseVersion: 3, caseStatus: 'OPEN', withdrawalEndDate: '2026-12-05', courseDays: 3, medicineName: 'Oxytetracycline 20% LA', healthState: 'UNDER_TREATMENT', returnedToOpen: true })
  await a.recordTreatment(412, { expectedVersion: 3, medicineId: 3, treatmentTime: '2026-11-05T08:00', dose: '30 ml', route: 'ORAL', courseDays: 1, withdrawalDays: null, performer: 'BS. Hùng', veterinaryAdvice: ' Uống nhiều nước ' })
  const second = calls.filter((c) => c.path.endsWith('/412/treatments'))[1].body as Record<string, unknown>
  assert.deepEqual([second.performerId, second.performerName, second.withdrawalDays, second.veterinaryAdvice], [undefined, 'BS. Hùng', null, 'Uống nhiều nước'])
})

test('TC-10-25: thuốc ngưng → lỗi ở ô Thuốc; thời điểm trước lúc mở ca → ô Thời điểm bắt đầu', async () => {
  const { api: a } = api({ ...baseRoutes(), '/api/farms/1/health-cases/412/treatments': (body: unknown) => { throw (body as Record<string, unknown>).medicineId === 7 ? backendError(422, 'MSG-FE18-08', { field: 'medicineId' }) : backendError(422, 'MSG-FE10-07', { date: '2026-10-13T00:00:00Z' }) } })
  const inactive = await rejection(a.recordTreatment(412, { medicineId: 7, treatmentTime: '2026-11-05T07:30', dose: '10 ml', route: 'INTRAMUSCULAR', courseDays: 1, withdrawalDays: 14, performer: '', veterinaryAdvice: '' }))
  assert.equal((inactive as HealthValidationError).errors.medicineId, 'Thuốc đã ngưng sử dụng, không thể chọn cho bản ghi mới.')
  const early = await rejection(a.recordTreatment(412, { medicineId: 3, treatmentTime: '2026-10-10T07:00', dose: '10 ml', route: 'INTRAMUSCULAR', courseDays: 1, withdrawalDays: 14, performer: '', veterinaryAdvice: '' }))
  assert.equal((early as HealthValidationError).errors.treatmentTime, 'Thời điểm không được trước 13/10/2026 07:00, lần ghi gần nhất của ca này.')
})

// ------------------------------------------------------------------ A5

test('TC-10-11/12/13: đổi trạng thái gửi action, diễn biến mới nhất, chẩn đoán, người xác nhận; kind theo action', async () => {
  const statusRoute = (status: string, extra: Record<string, unknown> = {}) => ({ id: 412, caseCode: 'HC-000412', status, version: 3, cattleId: 101, cattleCode: 'BC-101', observationId: 62, healthState: 'MONITORING', outcome: null, ...extra })
  let answer = statusRoute('CHRONIC', { chronicSince: '2026-11-05' })
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/health-cases/412/status': () => answer })
  const chronic = await a.updateStatus(412, { expectedVersion: 2, action: 'TO_CHRONIC', progressText: ' Vẫn sốt nhẹ ', diagnosis: 'Viêm phổi mạn', suspectedContagious: true, confirmedBy: 'Lê Quản Lý' })
  assert.deepEqual(post(calls, '/412/status'), { expectedVersion: 2, action: 'TO_CHRONIC', latestProgress: 'Vẫn sốt nhẹ', progress: 'UNCHANGED', suspectedDiagnosis: 'Viêm phổi mạn', suspectedContagious: true, outcome: null, closedAt: null, confirmedById: 7 })
  assert.deepEqual([chronic.kind, chronic.status, chronic.observationId, chronic.deathVoucher], ['CHRONIC', 'CHRONIC', 62, null])
  answer = statusRoute('OPEN')
  assert.equal((await a.updateStatus(412, { expectedVersion: 3, action: 'TO_OPEN', progressText: '', diagnosis: '', suspectedContagious: false, confirmedBy: '' })).kind, 'REOPENED')
  assert.equal((await a.updateStatus(412, { expectedVersion: 3, action: 'KEEP', progressText: 'Như cũ', diagnosis: '', suspectedContagious: false, confirmedBy: '' })).kind, 'KEPT')
  answer = statusRoute('CLOSED', { outcome: 'RECOVERED', closedAt: '2026-11-05T02:00:00Z', healthState: 'HEALTHY' })
  const closed = await a.updateStatus(412, { expectedVersion: 3, action: 'CLOSE', progressText: 'Khỏe lại', diagnosis: '', suspectedContagious: false, outcome: 'RECOVERED', closedAt: '2026-11-05T09:00', confirmedBy: 'Lê Quản Lý' })
  const body = calls.filter((c) => c.path.endsWith('/412/status')).at(-1)!.body as Record<string, unknown>
  assert.deepEqual([body.action, body.outcome, body.closedAt, body.progress, body.latestProgress, body.confirmedById], ['CLOSE', 'RECOVERED', '2026-11-05T09:00:00+07:00', 'IMPROVED', 'Khỏe lại', 7])
  assert.deepEqual([closed.kind, closed.status, closed.outcome, closed.healthState, closed.deathVoucher], ['CLOSED', 'CLOSED', 'RECOVERED', 'HEALTHY', null])
})

test('TC-10-14/15: đóng Chết / Mất tích trả phiếu xuất chờ từ pendingExitVoucherId; lỗi thời điểm đóng vào ô closedAt', async () => {
  const { api: a } = api({
    ...baseRoutes(),
    '/api/farms/1/health-cases/412/status': (body: unknown) => {
      const b = body as Record<string, unknown>
      if (b.closedAt === '2026-10-13T06:00:00+07:00') throw backendError(422, 'MSG-FE10-07', { date: '2026-10-14T01:00:00Z' })
      return { id: 412, caseCode: 'HC-000412', status: 'CLOSED', version: 3, cattleId: 101, cattleCode: 'BC-101', observationId: null, healthState: 'HEALTHY', outcome: b.outcome, closedAt: '2026-11-05T02:00:00Z', pendingExitVoucherId: 900 }
    },
  })
  const died = await a.updateStatus(412, { expectedVersion: 2, action: 'CLOSE', progressText: '', diagnosis: '', suspectedContagious: false, outcome: 'DIED', closedAt: '2026-11-05T09:00', confirmedBy: 'Lê Quản Lý' })
  assert.deepEqual(died.deathVoucher, { id: 900, cattleCode: 'BC-101', caseCode: 'HC-000412', type: 'DEATH', reason: 'Chết', date: '2026-11-05', reportedBy: 'Lê Quản Lý', status: 'PENDING' })
  const missing = await a.updateStatus(412, { expectedVersion: 2, action: 'CLOSE', progressText: '', diagnosis: '', suspectedContagious: false, outcome: 'MISSING', closedAt: '2026-11-05T09:00', confirmedBy: '' })
  assert.deepEqual([missing.deathVoucher?.type, missing.deathVoucher?.reason], ['OTHER', 'Mất tích'])
  const early = await rejection(a.updateStatus(412, { expectedVersion: 2, action: 'CLOSE', progressText: '', diagnosis: '', suspectedContagious: false, outcome: 'RECOVERED', closedAt: '2026-10-13T06:00', confirmedBy: '' }))
  assert.equal((early as HealthValidationError).errors.closedAt, 'Thời điểm không được trước 14/10/2026 08:00, lần ghi gần nhất của ca này.')
})

// ------------------------------------------------------------------ A7 / A8

test('TC-10-19/20: sửa / hủy đi đúng route theo loại bản ghi đã đọc; trả ngưng thịt trước → sau', async () => {
  const { api: a, calls } = api({
    ...baseRoutes(),
    '/api/farms/1/treatments/52/correction': { id: 52, status: 'VALID', version: 2, healthState: 'UNDER_TREATMENT', caseId: 412, caseStatus: 'OPEN', withdrawalBefore: '2026-11-13', withdrawalAfter: '2026-11-20' },
    '/api/farms/1/treatments/52/void': { id: 52, status: 'VOIDED', version: 3, healthState: 'MONITORING', caseId: 412, caseStatus: 'OPEN', withdrawalBefore: '2026-11-20', withdrawalAfter: null },
    '/api/farms/1/health-observations/53/correction': { id: 53, status: 'VALID', version: 3, healthState: 'UNDER_TREATMENT', caseId: 412, caseStatus: 'OPEN', withdrawalBefore: '2026-11-13', withdrawalAfter: '2026-11-13' },
  })
  const unknown = await rejection(a.correctEntry(52, { expectedVersion: 1, reason: 'x' }))
  assert.match(unknown.message, /mở lại hồ sơ/)
  await a.getProfile('BC-101')
  const r = await a.correctEntry(52, { expectedVersion: 1, reason: ' Đọc nhầm nhãn ', medicineId: 3, treatmentTime: '2026-10-14T08:00', dose: '30 ml', route: 'INTRAMUSCULAR', courseDays: 3, withdrawalDays: 35, performer: 'BS. Hùng' })
  assert.deepEqual(post(calls, '/treatments/52/correction'), { expectedVersion: 1, reason: 'Đọc nhầm nhãn', medicineId: 3, administeredAt: '2026-10-14T08:00:00+07:00', dose: '30 ml', route: 'INTRAMUSCULAR', courseDays: 3, withdrawalDays: 35, performerName: 'BS. Hùng' })
  assert.deepEqual(r, { id: 52, status: 'VALID', version: 2, healthState: 'UNDER_TREATMENT', action: 'CORRECTED', recordType: 'TREATMENT', cattleCode: 'BC-101', withdrawalBefore: '2026-11-13', withdrawalAfter: '2026-11-20' })
  const o = await a.correctEntry(53, { expectedVersion: 2, reason: 'Bổ sung', observedAt: '2026-10-15T09:30', temperatureC: 39.1, progress: 'IMPROVED', description: 'Ăn lại tốt', observer: 'Nguyễn Kỹ Thuật' })
  assert.deepEqual(post(calls, '/health-observations/53/correction'), { expectedVersion: 2, reason: 'Bổ sung', observedAt: '2026-10-15T09:30:00+07:00', temperatureC: 39.1, signs: 'Ăn lại tốt', progress: 'IMPROVED', observerId: 8 })
  assert.deepEqual([o.recordType, o.action, o.withdrawalBefore, o.withdrawalAfter], ['FOLLOW_UP', 'CORRECTED', '2026-11-13', '2026-11-13'])
  const v = await a.voidEntry(52, { expectedVersion: 2, reason: 'Ghi trùng' })
  assert.deepEqual(post(calls, '/treatments/52/void'), { expectedVersion: 2, reason: 'Ghi trùng' })
  assert.deepEqual([v.action, v.status, v.healthState, v.withdrawalAfter], ['VOIDED', 'VOIDED', 'MONITORING', null])
})

test('TC-10-21: quan sát mở ca không gọi backend để hủy; lỗi FE10-13 từ backend cũng ra cùng câu', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/health-observations/53/void': () => { throw backendError(409, 'MSG-FE10-13') } })
  await a.getProfile('BC-101')
  const e = await rejection(a.voidEntry(51, { expectedVersion: 0, reason: 'Nhầm' }))
  assert.equal(e.message, 'Lần ghi mở ca không thể hủy. Hãy sửa lại, hoặc đóng ca kèm lý do.')
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0)
  assert.equal((await rejection(a.voidEntry(53, { expectedVersion: 2, reason: 'x' }))).message, e.message)
})

test('Múi giờ trại: trại UTC+9 gửi +09:00 và hiện giờ theo múi giờ trại', async () => {
  const { api: a, calls } = api({ ...baseRoutes(), '/api/farms/1/context': { id: 1, timeZone: 'Asia/Tokyo' }, '/api/farms/1/health-cases': { id: 419, caseCode: 'HC-000419', status: 'OPEN', version: 1, cattleCode: 'BC-101', observationId: 60, healthState: 'MONITORING' } })
  await a.openCase('BC-101', { observedAt: '2026-11-05T08:30', observer: '', temperatureC: null, signs: 'x', diagnosis: '', suspectedContagious: false, severity: 'MILD' })
  assert.equal(post(calls, '/health-cases').observedAt, '2026-11-05T08:30:00+09:00')
  assert.equal(a.now(), '2026-11-05T12:00')
  assert.equal((await a.getProfile('BC-101')).activeCases[0].openedAt, '2026-10-13T09:00')
  assert.equal(calls.filter((c) => c.path === '/api/farms/1/context').length, 1, 'đọc múi giờ một lần')
})
