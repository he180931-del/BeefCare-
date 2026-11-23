import assert from 'node:assert/strict'
import test from 'node:test'

test('PR-H posted and draft lines read declarations from the actual data wrapper without losing items or zero parity', () => {
  const data = {
    sex: 'FEMALE', vaccination: { status: 'KNOWN', informationSource: 'Nguồn chung', items: [
      { vaccineId: 1, vaccineName: 'LMLM', date: '2026-03-01', informationSource: 'Sổ cũ' },
      { vaccineName: 'Vắc-xin chữ tự do', date: null, informationSource: null },
    ] }, disease: { status: 'NONE', description: null },
    reproduction: { status: 'KNOWN', earlierCalvings: 0, pregnantAtEntry: 'YES', estMonthsPregnant: 4, description: 'Người bán khai' },
  }
  const posted = mapVoucher({ ...voucher('POSTED'), lines: [{ id: 91, cattleCode: 'BC-H', data }] })
  const history = posted.detail!.cows![0].hist!
  assert.equal(history.vaccine, 'Có'); assert.equal(history.vaccineItems?.length, 2)
  assert.equal(history.vaccineDeclarationSource, 'Nguồn chung'); assert.equal(history.vaccineSource, 'Sổ cũ')
  assert.equal(history.disease, 'Không'); assert.equal(history.repro, 'Có')
  assert.equal(history.earlierCalvings, 0); assert.equal(history.pregnancyMonths, 4)
  const draft = mapVoucher({ ...voucher('DRAFT'), lines: [{ id: 91, data }] })
  assert.deepEqual(draft.draft!.cows![0].hist, history)
})

test('PR-H correction sends declaration blocks with observed versions and a stable canonical content key', async () => {
  const calls: Array<{ body: unknown; key?: string }> = []
  const api = createHerdEntryBackendApi({ farmId: 9, transport: {
    farmPath: (farm, path = '') => `/api/farms/${farm}${path}`,
    get: async () => { throw new Error('Must not refresh versions') },
    command: async (_path, body, options) => { calls.push({ body, key: options?.key }); return {} },
  } })
  const vaccination = { status: 'KNOWN' as const, informationSource: null, items: [{ vaccineId: 1, vaccineName: 'LMLM', date: '2026-03-01', informationSource: 'Sổ cũ' }] }
  const input = { reason: ' Sửa khai báo ', expectedVersion: 0, voucherVersion: 3, changes: { vaccination, disease: { status: 'NONE' as const, description: null } } }
  await api.correctEntryLine(91, input)
  await api.correctEntryLine(91, { ...input, changes: { disease: input.changes.disease, vaccination } })
  assert.deepEqual(calls[0].body, { ...input, reason: 'Sửa khai báo' })
  assert.equal(calls[0].key, calls[1].key)
  await api.correctEntryLine(91, { ...input, changes: { vaccination: { ...vaccination, status: 'UNKNOWN', items: [] } } })
  assert.notEqual(calls[0].key, calls[2].key)
})
import { createHerdEntryBackendApi, type BackendTransport } from '../../src/features/herd-entry/api/herdEntryBackendApi'
import { BackendError } from '../../src/shared/api/backendClient'
import { mapVoucher } from '../../src/features/herd-entry/api/herdEntryMapper'

test('entry payments preserve identities, status, void metadata and server paid totals', () => {
  const mapped = mapVoucher({ ...voucher('POSTED'), totalPayable: 10000000, amountPaid: 2000000, outstanding: 8000000, payments: [
    { id: 11, version: 0, status: 'VOIDED', paymentDate: '2026-10-20', amount: 3000000, recordedByName: 'An', method: 'CASH', note: 'Đợt đầu', voidReason: 'Nhập nhầm', voidedAt: '2026-11-22T18:05:00Z' },
    { paymentDate: '2026-10-20', amount: 2000000, method: 'BANK_TRANSFER' },
  ] })
  assert.equal(mapped.paid, 2000000); assert.equal(mapped.debt, 8000000)
  const [voided, legacy] = mapped.detail!.payments!
  assert.deepEqual([voided.id, voided.version, voided.status, voided.by, voided.note, voided.voidReason, voided.voidedAt], [11, 0, 'VOIDED', 'An', 'Đợt đầu', 'Nhập nhầm', '2026-11-22T18:05:00Z'])
  assert.equal(legacy.status, 'RECORDED'); assert.equal(legacy.id, undefined); assert.equal(legacy.version, undefined)
  assert.equal(mapVoucher({}).paid, undefined)
})
test('entry payment void keeps the opened payment version and has canonical body-specific keys without GETs', async () => {
  const calls: Array<{ path: string; body: unknown; key?: string }> = []
  const api = createHerdEntryBackendApi({ farmId: 9, transport: {
    farmPath: (farm, path = '') => `/api/farms/${farm}${path}`,
    get: async () => { throw new Error('No eager snapshot refresh') },
    command: async (path, body, options) => { calls.push({ path, body, key: options?.key }); return { payment: { id: 11, status: 'VOIDED', version: 1 }, summary: { total: 10000000, paid: 2000000, outstanding: 8000000, voucherVersion: 10 } } },
  } })
  const result = await api.voidPayment(11, { reason: '  Nhập nhầm  ', version: 0 })
  await api.voidPayment(11, { version: 0, reason: 'Nhập nhầm' })
  await api.voidPayment(11, { reason: 'Khác', version: 0 })
  await api.voidPayment(12, { reason: 'Nhập nhầm', version: 0 })
  await api.voidPayment(11, { reason: 'Nhập nhầm', version: 1 })
  assert.equal(calls[0].path, '/api/farms/9/payments/11/void')
  assert.deepEqual(calls[0].body, { reason: 'Nhập nhầm', version: 0 })
  assert.match(calls[0].key!, /^beefcare-voucher-payment-void-/)
  assert.equal(calls[0].key, calls[1].key)
  for (const call of calls.slice(2)) assert.notEqual(call.key, calls[0].key)
  assert.equal(result.payment.status, 'VOIDED'); assert.equal(result.summary.outstanding, 8000000)
  for (const version of [undefined, -1, 0.5]) await assert.rejects(() => api.voidPayment(11, { reason: 'Nhầm', version }), /phiên bản/)
  for (const reason of ['  ', 'x'.repeat(501)]) await assert.rejects(() => api.voidPayment(11, { reason, version: 0 }), /lý do/i)
  assert.equal(calls.length, 5)
})
test('entry payment recording retries keep the same key and changed bodies or voucher snapshots change it', async () => {
  const calls: Array<{ body: unknown; key?: string }> = []
  const api = createHerdEntryBackendApi({ farmId: 9, transport: {
    farmPath: (farm, path = '') => `/api/farms/${farm}${path}`,
    get: async path => path.endsWith('/attachments') || path.endsWith('/catalogues/breeds') ? [] : voucher('POSTED'),
    command: async (_path, body, options) => { calls.push({ body, key: options?.key }); return {} },
  } })
  const input = { date: '2026-10-20', amount: 2000000, method: 'Tiền mặt', ref: '' }
  await api.recordPayment('PN', input, { backendId: 41, voucherVersion: 0 })
  await api.recordPayment('PN', input, { backendId: 41, voucherVersion: 0 })
  await api.recordPayment('PN', { ...input, amount: 1 }, { backendId: 41, voucherVersion: 0 })
  await api.recordPayment('PN', input, { backendId: 41, voucherVersion: 1 })
  assert.match(calls[0].key!, /^beefcare-entry-payment-/)
  assert.equal(calls[0].key, calls[1].key)
  assert.notEqual(calls[0].key, calls[2].key); assert.notEqual(calls[0].key, calls[3].key)
})

test('entry detail resolves current breed labels from the farm catalogue, including historical inactive breeds', async () => {
  const api = createHerdEntryBackendApi({ farmId: 9, transport: {
    farmPath: (farm, path = '') => `/api/farms/${farm}${path}`,
    get: async path => path.endsWith('/attachments') ? [] : path.endsWith('/catalogues/breeds') ? [{ id: 21, name: 'Lai Sind', available: false }] : { ...voucher('POSTED'), lines: [{ id: 91, data: { breedId: 21, sex: 'FEMALE' } }] },
    command: async () => { throw new Error('Unexpected command') },
  } })
  const loaded = await api.get('PN-2026-0041', 41)
  assert.equal(loaded.detail?.cows?.[0].breed, 'Lai Sind · Cái')
})
test('entry line correction and void history include UTC+7 time, actor, cattle and reason without changing other history', () => {
  const loaded = mapVoucher({ ...voucher('POSTED'), history: [
    { kind: 'ENTRY_POST' },
    { kind: 'ENTRY_LINE_CORRECT', at: '2026-11-22T12:00:00Z', actor: 'Manager test', details: { cattle: 'BC-501', reason: 'Sửa cân' } },
    { kind: 'ENTRY_LINE_VOID', at: '2026-11-22T12:05:00Z', actor: 'Owner test', details: { cattle: 'BC-502', reason: 'Nhập nhầm' } },
  ] })
  assert.equal(loaded.detail?.history?.[0], 'ENTRY_POST')
  assert.match(loaded.detail!.history![1], /22\/11\/2026 19:00.*Manager test.*Sửa bản ghi nhập BC-501.*Sửa cân/)
  assert.match(loaded.detail!.history![2], /19:05.*Owner test.*Hủy bản ghi nhập BC-502.*Nhập nhầm/)
})

test('entry detail preserves line identities, zero versions and correction fields without inventing missing ids', () => {
  const row = mapVoucher({ ...voucher('POSTED'), sellerId: 7, lines: [
    { id: 91, version: 0, status: 'VALID', cattleId: 501, cattleCode: 'BC-000501', entryWeightKg: 250, weightBasis: 'MEASURED', data: { breedId: 21, sex: 'FEMALE', birthDate: '2023-01-02', birthDateAccuracy: 'EXACT' } },
    { status: 'VOID', cattleCode: 'BC-VOID' },
  ] })
  assert.equal(row.sellerId, 7)
  assert.equal(row.entryType, 'PURCHASE')
  assert.equal(row.pricingBasis, 'PER_KG')
  assert.equal(row.count, 1)
  assert.equal(row.detail?.cows?.length, 2)
  const line = row.detail!.cows![0]
  assert.deepEqual([line.entryId, line.lineStatus, line.lineVersion, line.cattleId, line.weightBasis, line.breedId, line.sexCode, line.birthDate, line.birthDateAccuracy], [91, 'VALID', 0, 501, 'MEASURED', 21, 'FEMALE', '2023-01-02', 'EXACT'])
  const missing = row.detail!.cows![1]
  assert.equal(missing.lineStatus, 'VOID')
  assert.equal(missing.entryId, undefined)
  assert.equal(missing.lineVersion, undefined)
  assert.equal(missing.cattleId, undefined)
})

test('entry line void-check maps its eligibility fields and event labels', async () => {
  const paths: string[] = []
  const api = createHerdEntryBackendApi({ farmId: 9, transport: {
    farmPath: (farm, path = '') => `/api/farms/${farm}${path}`,
    get: async path => { paths.push(path); return { entryId: 91, lineNo: 2, cattleId: 501, cattleCode: 'BC-000501', eventsAfterEntry: ['Cân ngày 01/11/2026'], canVoid: false, reason: 'HAS_EVENTS' } },
    command: async () => { throw new Error('Unexpected command') },
  } })
  assert.deepEqual(await api.entryVoidCheck(91), { entryId: 91, lineNo: 2, cattleId: 501, cattleCode: 'BC-000501', eventsAfterEntry: ['Cân ngày 01/11/2026'], canVoid: false, reason: 'HAS_EVENTS' })
  assert.deepEqual(paths, ['/api/farms/9/herd-entries/91/void-check'])
})

test('entry line commands retain opened versions, trim reasons, map notices and use stable content keys without GETs', async () => {
  const calls: Array<{ path: string; body: unknown; method?: string; key?: string }> = []
  const api = createHerdEntryBackendApi({ farmId: 9, transport: {
    farmPath: (farm, path = '') => `/api/farms/${farm}${path}`,
    get: async () => { throw new Error('Commands must not fetch newer versions') },
    command: async (path, body, options) => { calls.push({ path, body, ...options }); return { notice: { code: 'MSG-FE06-06', message: 'Đã sửa bản ghi.' }, overpaidNotice: { code: 'MSG-FE06-23', message: 'Đã trả vượt tổng mới: 123 đ.' } } },
  } })
  const first = await api.correctEntryLine(91, { reason: '  Sửa cân  ', expectedVersion: 0, voucherVersion: 3, changes: { entryWeightKg: 260, weightBasis: 'MEASURED', sellerId: null, vehiclePlate: undefined } })
  assert.deepEqual(calls[0].body, { reason: 'Sửa cân', expectedVersion: 0, voucherVersion: 3, changes: { entryWeightKg: 260, weightBasis: 'MEASURED' } })
  assert.equal(calls[0].method, 'PATCH')
  assert.equal(calls[0].path, '/api/farms/9/herd-entries/91')
  assert.match(calls[0].key!, /^beefcare-entry-line-correct-/)
  assert.equal(first.notice?.message, 'Đã sửa bản ghi.')
  assert.equal(first.overpaidNotice?.message, 'Đã trả vượt tổng mới: 123 đ.')
  await api.correctEntryLine(91, { reason: 'Sửa cân', expectedVersion: 0, voucherVersion: 3, changes: { weightBasis: 'MEASURED', entryWeightKg: 260 } })
  await api.correctEntryLine(91, { reason: 'Sửa cân', expectedVersion: 0, voucherVersion: 3, changes: { entryWeightKg: 270, weightBasis: 'MEASURED' } })
  assert.equal(calls[0].key, calls[1].key)
  assert.notEqual(calls[0].key, calls[2].key)
  await api.voidEntryLine(91, { reason: '  Ghi nhầm  ', expectedVersion: 0 })
  await api.voidEntryLine(91, { reason: 'Ghi nhầm', expectedVersion: 0 })
  await api.voidEntryLine(92, { reason: 'Ghi nhầm', expectedVersion: 0 })
  assert.deepEqual(calls[3].body, { reason: 'Ghi nhầm', expectedVersion: 0 })
  assert.equal(calls[3].path, '/api/farms/9/herd-entries/91/void')
  assert.match(calls[3].key!, /^beefcare-entry-line-void-/)
  assert.equal(calls[3].key, calls[4].key)
  assert.notEqual(calls[3].key, calls[5].key)
})

test('entry line commands reject missing snapshot versions before transport', async () => {
  const api = createHerdEntryBackendApi({ farmId: 9, transport: {
    farmPath: (farm, path = '') => `/api/farms/${farm}${path}`,
    get: async () => { throw new Error('Unexpected GET') }, command: async () => { throw new Error('Unexpected command') },
  } })
  await assert.rejects(api.voidEntryLine(91, { reason: 'Lý do', expectedVersion: undefined }), /phiên bản/)
  await assert.rejects(api.correctEntryLine(91, { reason: 'Lý do', expectedVersion: undefined, voucherVersion: 3, changes: {} }), /phiên bản/)
  await assert.rejects(api.correctEntryLine(91, { reason: 'Lý do', expectedVersion: 0, voucherVersion: undefined, changes: {} }), /phiên bản/)
})

const voucher = (status = 'DRAFT') => ({
  id: 41, code: 'PN-2026-0041', entryType: 'PURCHASE', status, entryDate: '2026-10-29',
  seller: { id: 7, name: 'Trang trại Mộc Châu', phone: '0901000000' }, quarantineCertNo: 'KD-41',
  vehiclePlate: '29C-12345', note: 'Nhập đợt 1', pricingBasis: 'PER_KG', transportFee: 100000,
  cattleCount: 1, totalWeightKg: 320, cattleAmount: 25600000, totalAmount: 25700000,
  paidAmount: 5000000, outstandingAmount: 20700000, version: 3,
  lines: [{ id: 91, cattleId: 501, cattleCode: 'BC-000501', earTagNumber: 'VN501', breedName: 'Brahman', sex: 'FEMALE', entryWeightKg: 320, penCode: 'A1', lineAmount: 25600000 }],
  payments: [], documents: [], history: [],
})

test('entry backend saves a purchase draft then posts the same versioned voucher', async () => {
  const calls: Array<{ method: string; path: string; body?: unknown; key?: string }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      calls.push({ method: 'GET', path })
      if (path.endsWith('/pens')) return { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }] }
      if (path.endsWith('/catalogues/breeds')) return [{ id: 21, name: 'Brahman' }]
      if (path.endsWith('/catalogues/production-purposes')) return [{ id: 31, name: 'Nuôi thịt' }]
      if (path.includes('/trading-partners')) return [{ id: 7, name: 'Trang trại Mộc Châu' }]
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (path, body, options) => {
      calls.push({ method: options?.method ?? 'POST', path, body })
      return path.endsWith('/post') ? { voucher: voucher('POSTED') } : voucher('DRAFT')
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  const saved = await api.save({
    record: {
      date: '2026-10-29', type: 'Mua ngoài', status: 'Đã nhập', source: 'Trang trại Mộc Châu',
      draft: { pricing: 'kg', sourceId: 'src-moc-chau', quarantine: 'KD-41', freight: 100000, paid: 5000000, method: 'Chuyển khoản' },
      detail: { sourceName: 'Trang trại Mộc Châu', plate: '29C-12345', note: 'Nhập đợt 1' },
    },
    cattleRows: [{ tag: 'VN501', breed: 'Brahman', sex: 'Cái', weight: 320, barn: 'A1', purpose: 'Nuôi thịt', unitPrice: 80000 }],
  })

  assert.equal(saved.id, 'PN-2026-0041')
  assert.equal(saved.status, 'Đã nhập')
  const create = calls.find((call) => call.method === 'POST' && call.path.endsWith('/entry-vouchers'))
  assert.deepEqual(create?.body, {
    entryType: 'PURCHASE', entryDate: '2026-10-29', sellerId: 7, newSeller: null,
    quarantineCertNo: 'KD-41', vehiclePlate: '29C-12345', note: 'Nhập đợt 1', pricingBasis: 'PER_KG',
    transportFee: 100000, amountPaid: 5000000, paymentMethod: 'BANK_TRANSFER', paymentDueDate: null,
    lines: [{ earTagNumber: 'VN501', name: null, photoUrl: null, colourMarkings: null, breedId: 21, sex: 'FEMALE', birthDate: null, birthDateAccuracy: 'UNKNOWN', ageMonths: null, lifeStage: 'ADULT', purposeId: 31, entryWeightKg: 320, weightBasis: 'MEASURED', penId: 11, unitPrice: 80000, quarantineUntil: null, warningReason: null, vaccination: { status: 'UNKNOWN', informationSource: null, items: [] }, disease: { status: 'UNKNOWN', description: null }, reproduction: { status: 'UNKNOWN', earlierCalvings: null, pregnantAtEntry: 'UNKNOWN', estMonthsPregnant: null, description: null }, calfOutcomeId: null }],
    expectedVersion: null,
  })
  assert.deepEqual(calls.at(-1), { method: 'POST', path: '/api/farms/9/entry-vouchers/41/post', body: { expectedVersion: 3, printQr: false } })
})

test('entry backend resolves the editor purpose label for a female young-stock cow', async () => {
  let request: any
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/pens')) return { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }] }
      if (path.endsWith('/catalogues/breeds')) return [{ id: 21, name: 'Lai Sind' }]
      if (path.endsWith('/catalogues/production-purposes')) return [{ id: 32, code: 'BREEDING', name: 'Bò cái sinh sản', purposeType: 'BREEDING', available: true }]
      if (path.includes('/trading-partners')) return []
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (_path, body) => { request = body; return voucher('DRAFT') },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  await api.save({
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Nháp', source: 'Nguồn mới' },
    cattleRows: [{
      tag: 'VN-YOUNG-F-001', breed: 'Lai Sind', sex: 'Cái', stage: 'Bò tơ',
      purpose: 'Bò sinh sản · loại Sinh sản', weight: 236, weightBasis: 'MEASURED',
      barn: 'A1', unitPrice: 85000, hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
    }],
  })

  assert.equal(request.lines[0].lifeStage, 'YOUNG_STOCK')
  assert.equal(request.lines[0].purposeId, 32)
})

test('entry backend resolves the selected breed label to its farm catalogue id', async () => {
  let request: any
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/pens')) return { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }] }
      if (path.endsWith('/catalogues/breeds')) return [{ id: 87, code: 'BRAHMAN-D', name: 'Brahman đỏ', available: true }]
      if (path.endsWith('/catalogues/production-purposes')) return [{ id: 32, name: 'Bò cái sinh sản', purposeType: 'BREEDING', available: true }]
      if (path.includes('/trading-partners')) return []
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (_path, body) => { request = body; return voucher('DRAFT') },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  await api.save({
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Nháp', source: 'Nguồn mới' },
    cattleRows: [{
      tag: 'VN-BREED-001', breed: 'Brahman đỏ', sex: 'Cái', stage: 'Bò tơ',
      purpose: 'Bò sinh sản · loại Sinh sản', weight: 236, weightBasis: 'MEASURED',
      barn: 'A1', unitPrice: 85000, hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
    }],
  })

  assert.equal(request.lines[0].breedId, 87)
})

test('entry backend round-trips complete pre-entry history fields', async () => {
  let request: any
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/pens')) return { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }] }
      if (path.endsWith('/catalogues/breeds')) return [{ id: 21, name: 'Brahman' }]
      if (path.endsWith('/catalogues/production-purposes')) return [{ id: 31, name: 'Nuôi thịt' }]
      if (path.includes('/trading-partners')) return []
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (_path, body) => { request = body; return voucher('DRAFT') },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  await api.save({ record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Nháp', source: 'Nguồn mới' }, cattleRows: [{
    tag: 'VN502', breed: 'Brahman', sex: 'Cái', weight: 320, barn: 'A1', purpose: 'Nuôi thịt', unitPrice: 80000,
    hist: { vaccine: 'Có', vaccineId: 55, vaccineName: 'LMLM', vaccineDate: '2026-03-01', vaccineSource: 'Sổ tiêm cũ', disease: 'Có', diseaseNote: 'Viêm móng cũ', repro: 'Có', earlierCalvings: 3, pregnantAtEntry: 'YES', pregnancyMonths: 4, reproductionNote: 'Theo người bán' },
  }] })
  const line = request.lines[0]
  assert.deepEqual(line.vaccination, { status: 'KNOWN', informationSource: 'Sổ tiêm cũ', items: [{ vaccineId: 55, vaccineName: 'LMLM', date: '2026-03-01', informationSource: 'Sổ tiêm cũ' }] })
  assert.deepEqual(line.disease, { status: 'KNOWN', description: 'Viêm móng cũ' })
  assert.deepEqual(line.reproduction, { status: 'KNOWN', earlierCalvings: 3, pregnantAtEntry: 'YES', estMonthsPregnant: 4, description: 'Theo người bán' })
})

test('entry backend discards a temporary draft without posting or changing cattle', async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => path.endsWith('/entry-vouchers') ? { items: [{ id: 41, code: 'PN-2026-0041', status: 'DRAFT', version: 0 }] } : {},
    command: async (path, body, options) => {
      calls.push({ method: options?.method ?? 'POST', path, body })
      return undefined
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  await api.discard('PN-2026-0041', 3)
  assert.deepEqual(calls, [{ method: 'DELETE', path: '/api/farms/9/entry-vouchers/41?expectedVersion=3', body: undefined }])
})

test('entry backend keeps persisted attachments visible when reposting without new uploads', async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      calls.push({ method: 'GET', path })
      if (path.endsWith('/entry-vouchers')) return { items: [{ id: 41, code: 'PN-2026-0041', entryType: 'PURCHASE', status: 'DRAFT', version: 3 }] }
      if (path.endsWith('/attachments')) return [{ id: 71, contentType: 'application/pdf', fileSize: 12, originalFilename: 'kiem-dich.pdf' }]
      if (path.endsWith('/pens')) return { pens: [] }
      if (path.endsWith('/catalogues/breeds')) return []
      if (path.endsWith('/catalogues/production-purposes')) return []
      if (path.includes('/trading-partners')) return []
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (path, body, options) => {
      calls.push({ method: options?.method ?? 'POST', path, body })
      if (path.endsWith('/post')) return { voucher: voucher('POSTED') }
      return voucher('DRAFT')
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  const saved = await api.save({
    id: 'PN-2026-0041', expectedVersion: 3,
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Đã nhập', source: 'Trang trại Mộc Châu' },
    documents: [],
  })

  assert.deepEqual(saved.detail?.docs, [{ id: 71, name: 'kiem-dich.pdf', ext: 'PDF', size: 12, url: '/api/farms/9/entry-vouchers/41/attachments/71' }])
  assert.deepEqual(calls.filter((call) => call.method !== 'GET').map((call) => call.path), [
    '/api/farms/9/entry-vouchers/41',
    '/api/farms/9/entry-vouchers/41/post',
  ])
})

test('entry backend uploads selected documents before posting the voucher', async () => {
  const calls: Array<{ path: string; body: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/pens')) return { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }] }
      if (path.endsWith('/catalogues/breeds')) return []
      if (path.endsWith('/catalogues/production-purposes')) return []
      if (path.includes('/trading-partners')) return [{ id: 7, name: 'Trang trại Mộc Châu' }]
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (path, body) => {
      calls.push({ path, body })
      if (path.endsWith('/attachments')) return { id: 71, contentType: 'application/pdf', fileSize: 12, originalFilename: 'kiem-dich.pdf' }
      return path.endsWith('/post') ? { voucher: voucher('POSTED') } : voucher('DRAFT')
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  const document = new File(['%PDF-1.4'], 'kiem-dich.pdf', { type: 'application/pdf' })

  await api.save({
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Đã nhập', source: 'Trang trại Mộc Châu' },
    documents: [document],
  })

  assert.deepEqual(calls.map((call) => call.path), [
    '/api/farms/9/entry-vouchers',
    '/api/farms/9/entry-vouchers/41/attachments',
    '/api/farms/9/entry-vouchers/41/post',
  ])
  assert.ok(calls[1].body instanceof FormData)
  assert.equal((calls[1].body as FormData).get('file'), document)
})

test('entry backend keeps the voucher as a draft when an attachment upload fails', async () => {
  const calls: string[] = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/pens')) return { pens: [] }
      if (path.endsWith('/catalogues/breeds')) return []
      if (path.endsWith('/catalogues/production-purposes')) return []
      if (path.includes('/trading-partners')) return [{ id: 7, name: 'Trang trại Mộc Châu' }]
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (path) => {
      calls.push(path)
      if (path.endsWith('/attachments')) throw new Error('Upload failed')
      return voucher('DRAFT')
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  await assert.rejects(() => api.save({
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Đã nhập', source: 'Trang trại Mộc Châu' },
    documents: [new File(['%PDF-1.4'], 'kiem-dich.pdf', { type: 'application/pdf' })],
  }), /Upload failed/)

  assert.deepEqual(calls, [
    '/api/farms/9/entry-vouchers',
    '/api/farms/9/entry-vouchers/41/attachments',
  ])
})

test('entry backend removes a persisted draft attachment through the private voucher route', async () => {
  const calls: Array<{ path: string; body: unknown; method?: string }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => path.endsWith('/entry-vouchers')
      ? { items: [{ id: 41, code: 'PN-2026-0041', status: 'DRAFT', entryType: 'PURCHASE', version: 3 }] }
      : [],
    command: async (path, body, options) => {
      calls.push({ path, body, method: options?.method })
      return { id: 71, originalFilename: 'kiem-dich.pdf' }
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  await api.removeAttachment('PN-2026-0041', 71)

  assert.deepEqual(calls, [{
    path: '/api/farms/9/entry-vouchers/41/attachments/71',
    body: undefined,
    method: 'DELETE',
  }])
})

test('entry backend records payment against the backend voucher id and version', async () => {
  const commands: Array<{ path: string; body: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => path.endsWith('/entry-vouchers')
      ? { items: [{ id: 41, code: 'PN-2026-0041', entryType: 'PURCHASE', status: 'POSTED', entryDate: '2026-10-29', cattleCount: 1, totalWeightKg: 320, totalAmount: 25700000, outstandingAmount: 20700000, version: 3 }] }
      : voucher('POSTED'),
    command: async (path, body) => { commands.push({ path, body }); return voucher('POSTED') },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  await api.recordPayment('PN-2026-0041', { date: '2026-10-30', amount: 1000000, method: 'Tiền mặt', ref: 'PT-01', note: 'Đợt 2' }, { voucherVersion: 3 })
  assert.deepEqual(commands[0], {
    path: '/api/farms/9/vouchers/entry/41/payments',
    body: { paymentDate: '2026-10-30', amount: 1000000, method: 'CASH', reference: 'PT-01', note: 'Đợt 2', voucherVersion: 3 },
  })
  await api.recordPayment('PN-2026-0041', { date: '2026-10-30', amount: 1000000, method: 'Tiền mặt', ref: '', note: '' }, { voucherVersion: 3 })
  assert.deepEqual(commands[1]?.body, { paymentDate: '2026-10-30', amount: 1000000, method: 'CASH', reference: null, note: null, voucherVersion: 3 })
})

test('entry backend voids the resolved voucher with its optimistic-lock version', async () => {
  const commands: Array<{ path: string; body: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async () => ({ items: [{ id: 41, code: 'PN-2026-0041', entryType: 'PURCHASE', status: 'POSTED', entryDate: '2026-10-29', cattleCount: 1, version: 3 }] }),
    command: async (path, body) => { commands.push({ path, body }); return { voucher: voucher('VOIDED') } },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  const result = await api.voidVoucher('PN-2026-0041', { reason: 'Nhập nhầm nguồn', expectedVersion: 3 })
  assert.equal(result.status, 'Đã hủy')
  assert.deepEqual(commands[0], { path: '/api/farms/9/entry-vouchers/41/void', body: { reason: 'Nhập nhầm nguồn', expectedVersion: 3 } })
})

test('entry backend reads private attachments and imports the same xlsx through preview then commit', async () => {
  const calls: Array<{ method: string; path: string; body?: unknown; key?: string }> = []
  const file = new File(['xlsx-bytes'], 'dan-bo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      calls.push({ method: 'GET', path })
      if (path.endsWith('/entry-vouchers')) return { items: [{ id: 41, code: 'PN-2026-0041', status: 'DRAFT', entryType: 'PURCHASE', version: 3 }] }
      if (path.endsWith('/import-template')) return new Blob(['template'])
      if (path.endsWith('/attachments/71')) return new Blob(['pdf'], { type: 'application/pdf' })
      return { items: [] }
    },
    command: async (path, body, options) => {
      calls.push({ method: 'POST', path, body, key: options?.key })
      return { total: 1, valid: 1, warnings: 0, errors: 0, added: path.includes('commit=true') ? 1 : 0, committed: path.includes('commit=true'), rows: [], voucher: voucher('DRAFT') }
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  const template = await api.downloadImportTemplate()
  const attachment = await api.downloadAttachment('PN-2026-0041', 71)
  await api.previewExcel('PN-2026-0041', file)
  await api.commitExcel('PN-2026-0041', file)

  assert.ok(template instanceof Blob)
  assert.ok(attachment instanceof Blob)
  assert.deepEqual(calls.map(({ method, path }) => `${method} ${path}`), [
    'GET /api/farms/9/entry-vouchers/import-template',
    'GET /api/farms/9/entry-vouchers',
    'GET /api/farms/9/entry-vouchers/41/attachments/71',
    'GET /api/farms/9/entry-vouchers',
    'POST /api/farms/9/entry-vouchers/41/import?commit=false',
    'GET /api/farms/9/entry-vouchers',
    'POST /api/farms/9/entry-vouchers/41/import?commit=true',
  ])
  const multipartBodies = calls.filter((call) => call.path.includes('/import?')).map((call) => call.body)
  assert.equal(multipartBodies.length, 2)
  const importKeys = calls.filter((call) => call.path.includes('/import?')).map((call) => call.key)
  assert.ok(importKeys.every((key) => Boolean(key) && key!.length <= 128))
  assert.notEqual(importKeys[0], importKeys[1])
  assert.ok(multipartBodies.every((body) => body instanceof FormData))
  assert.equal((multipartBodies[0] as FormData).get('file'), file)
  assert.equal((multipartBodies[1] as FormData).get('file'), file)
})

test('entry backend serializes voucher pricing and preserves an entered per-head weight (GBR-92)', async () => {
  let body: any
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/pens')) return { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }] }
      if (path.endsWith('/catalogues/breeds')) return []
      if (path.endsWith('/catalogues/production-purposes')) return []
      if (path.includes('/trading-partners')) return []
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (_path, requestBody) => {
      body = requestBody
      return voucher('DRAFT')
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  await api.save({
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Nháp', pricing: 'kg', source: 'Nguồn mới', draft: { pricing: 'kg' } },
    cattleRows: [{ tag: 'VN501', breed: 'Brahman', sex: 'Cái', weight: 320, barn: 'A1', unitPrice: 80000 }],
  })

  assert.equal(body.pricingBasis, 'PER_KG')
  assert.equal(body.lines[0].unitPrice, 80000)

  await api.save({
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Nháp', pricing: 'con', source: 'Nguồn mới', draft: { pricing: 'con' } },
    cattleRows: [{ tag: 'VN501', breed: 'Brahman', sex: 'Cái', weight: 320, barn: 'A1', unitPrice: 8500000, pricing: 'con', weightBasis: null }],
  })
  assert.equal(body.pricingBasis, 'PER_HEAD')
  // PER_HEAD makes the weight optional; it does not discard an entered weight.
  assert.equal(body.lines[0].entryWeightKg, 320)
  assert.equal(body.lines[0].weightBasis, 'MEASURED')
  assert.equal(body.lines[0].unitPrice, 8500000)
})

for (const scenario of [
  { name: 'measured per-head weight', pricing: 'con' as const, rows: [{ weight: 250, estimated: false, pricing: 'con', weightBasis: 'MEASURED' }], weights: [250], bases: ['MEASURED'] },
  { name: 'optional absent per-head weight', pricing: 'con' as const, rows: [{ weight: 0, estimated: false, pricing: 'con', weightBasis: 'ESTIMATED' }], weights: [null], bases: [null] },
  { name: 'estimated per-head weight', pricing: 'con' as const, rows: [{ weight: 300, estimated: true, pricing: 'con' }], weights: [300], bases: ['ESTIMATED'] },
  { name: 'Excel row without its own pricing', pricing: 'con' as const, rows: [{ weight: 250, estimated: false, pricing: 'con' }, { weight: 300, estimated: true }], weights: [250, 300], bases: ['MEASURED', 'ESTIMATED'] },
  { name: 'empty per-head draft before Excel preview', pricing: 'con' as const, rows: [], weights: [], bases: [] },
  { name: 'per-head header without draft data when posting', pricing: 'con' as const, recordOnly: true, rows: [{ weight: 250, estimated: false }], weights: [250], bases: ['MEASURED'] },
  { name: 'kg header overriding stale per-head rows', pricing: 'kg' as const, rows: [{ weight: 250, estimated: false, pricing: 'con' }], weights: [250], bases: ['MEASURED'] },
]) {
  test(`entry backend follows voucher pricing: ${scenario.name}`, async () => {
    let body: any
    const transport: BackendTransport = {
      farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
      get: async (path) => path.endsWith('/pens') ? { pens: [] } : [],
      command: async (_path, value) => { body = value; return voucher('DRAFT') },
    }
    const recordOnly = 'recordOnly' in scenario && scenario.recordOnly
    await createHerdEntryBackendApi({ transport, farmId: 9 }).save({
      record: { type: 'Mua ngoài', status: 'Nháp', pricing: recordOnly ? scenario.pricing : scenario.pricing === 'con' ? 'kg' : 'con', draft: recordOnly ? undefined : { pricing: scenario.pricing } },
      cattleRows: scenario.rows.map((row, index) => ({ ...row, tag: `HEAD-${index}`, barn: 'A1', unitPrice: 8_500_000 })),
    })
    assert.equal(body.pricingBasis, scenario.pricing === 'con' ? 'PER_HEAD' : 'PER_KG')
    assert.deepEqual(body.lines.map((line: any) => line.entryWeightKg), scenario.weights)
    assert.deepEqual(body.lines.map((line: any) => line.weightBasis), scenario.bases)
    assert.ok(body.lines.every((line: any) => line.unitPrice === 8_500_000))
  })
}

test('entry backend sends the loaded farm-born draft type and explicit snapshot version', async () => {
  let body: any
  const farmBorn = voucher('DRAFT')
  farmBorn.entryType = 'FARM_BORN'
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/entry-vouchers')) return { items: [{ id: 41, code: 'PN-2026-0041', entryType: 'FARM_BORN', status: 'DRAFT', version: 3 }] }
      if (path.endsWith('/attachments')) return []
      if (path.endsWith('/entry-vouchers/41')) return farmBorn
      if (path.endsWith('/pens')) return { pens: [] }
      if (path.endsWith('/catalogues/breeds')) return []
      if (path.endsWith('/catalogues/production-purposes')) return []
      if (path.includes('/trading-partners')) return []
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (_path, requestBody) => {
      body = requestBody
      return farmBorn
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  const loaded = await api.get('PN-2026-0041')
  await api.save({ id: loaded.id, expectedVersion: loaded.version, record: { ...loaded, status: 'Nháp', draft: { date: '2026-10-29', cows: [] } } })

  assert.equal(body.entryType, 'FARM_BORN')
  assert.equal(body.expectedVersion, 3)
})

test('entry backend serializes FARM_BORN calves without purchase pricing or payment fields', async () => {
  let body: any
  const farmBorn = { ...voucher('DRAFT'), entryType: 'FARM_BORN', seller: null, exitDate: null }
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/pens')) return { pens: [{ id: 3, code: 'A3', name: 'A3' }] }
      if (path.endsWith('/catalogues/breeds')) return [{ id: 21, name: 'Brahman' }]
      if (path.endsWith('/catalogues/production-purposes')) return [{ id: 2, code: 'UNDECIDED', name: 'Chưa xác định', purposeType: 'UNDECIDED', available: true }]
      if (path.includes('/trading-partners')) return []
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (_path, requestBody) => { body = requestBody; return farmBorn },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  await api.save({
    record: { date: '2026-10-28', type: 'Bê sinh tại trại', status: 'Nháp', source: 'Bê của DAM-001' },
    cattleRows: [{ tag: 'CALF-0007', mother: 'DAM-001', damId: 125, sireId: 126, sex: 'Cái', born: '2026-10-28', stage: 'Bê', purposeId: 2, penId: 3, calfOutcomeId: 17, weight: 34, barn: 'A3', unitPrice: 0 }],
  })

  assert.equal(body.entryType, 'FARM_BORN')
  assert.equal(body.sellerId, null)
  assert.equal(body.lines[0].calfOutcomeId, 17)
  assert.equal(body.lines[0].damId, 125)
  assert.equal(body.lines[0].sireId, 126)
  assert.equal(body.lines[0].penId, 3)
  assert.equal(body.lines[0].purposeId, 2)
  assert.equal(body.lines[0].lifeStage, 'UNWEANED_CALF')
  assert.equal(body.lines[0].birthDate, '2026-10-28')
  assert.equal('pricingBasis' in body, false)
  assert.equal('amountPaid' in body, false)
  assert.equal('paymentMethod' in body, false)
  assert.equal('transportFee' in body, false)
  assert.equal('newSeller' in body, false)
  assert.equal('paymentDueDate' in body, false)
})

test('entry backend leaves pending calves unassigned until the user selects them', async () => {
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async () => [{ calfOutcomeId: 17, damCode: 'DAM-001', sireCode: 'SIRE-001', sex: 'FEMALE', birthDate: '2026-10-28', birthWeightKg: 34, tagCode: 'CALF-0007', proposedPenId: 3, proposedPenCode: 'A3', defaultPurposeId: 2, registrationState: 'PENDING_CONFIRMATION' }],
    command: async () => undefined,
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  const [calf] = await api.pendingCalves()

  assert.equal(calf.picked, false)
})

test('entry backend does not create a voucher when resolving an existing id is forbidden', async () => {
  let commands = 0
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async () => { throw new BackendError(403, { message: 'forbidden' }) },
    command: async () => { commands += 1; return voucher('DRAFT') },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  await assert.rejects(() => api.save({ id: 'PN-2026-0041', expectedVersion: 3, record: { type: 'Mua ngoài', status: 'Nháp' } }), /forbidden/)
  assert.equal(commands, 0)
})

test('entry backend reuses one idempotency key when retrying the same draft save', async () => {
  const keys: Array<string | undefined> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/entry-vouchers')) return { items: [] }
      if (path.endsWith('/pens')) return { pens: [] }
      if (path.endsWith('/catalogues/breeds') || path.endsWith('/catalogues/production-purposes')) return []
      if (path.includes('/trading-partners')) return []
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (_path, _body, options) => {
      keys.push(options?.key)
      return voucher('DRAFT')
    },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  const input = { record: { date: '2026-10-30', type: 'Mua ngoài' as const, status: 'Nháp' as const } }

  await api.save(input)
  await api.save(input)

  assert.equal(keys.length, 2)
  assert.equal(keys[0], keys[1])
})

test('entry backend changes the idempotency key when the draft payload changes', async () => {
  const keys: Array<string | undefined> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => path.endsWith('/entry-vouchers') ? { items: [] } : path.endsWith('/pens') ? { pens: [] } : [],
    command: async (_path, _body, options) => { keys.push(options?.key); return voucher('DRAFT') },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  await api.save({ record: { date: '2026-10-30', type: 'Mua ngoài', status: 'Nháp', draft: { note: 'A' } } })
  await api.save({ record: { date: '2026-10-30', type: 'Mua ngoài', status: 'Nháp', draft: { note: 'B' } } })

  assert.notEqual(keys[0], keys[1])
})

test('entry backend bounds attachment and post idempotency keys for long filenames', async () => {
  const keys: Array<{ path: string; key?: string }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => path.endsWith('/entry-vouchers') ? { items: [] } : path.endsWith('/pens') ? { pens: [] } : [],
    command: async (path, _body, options) => { keys.push({ path, key: options?.key }); return path.endsWith('/post') ? { voucher: voucher('POSTED') } : voucher('DRAFT') },
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })
  const filename = `${'x'.repeat(255)}.pdf`

  const sameMetadataDifferentBytes = (value: string) => new File([value], filename, { type: 'application/pdf', lastModified: 123 })
  await api.save({ record: { date: '2026-10-30', type: 'Mua ngoài', status: 'Đã nhập' }, documents: [sameMetadataDifferentBytes('aaaa')] })

  assert.ok(keys.every(({ key }) => (key?.length ?? 0) <= 128))
  assert.ok(keys.some(({ path }) => path.endsWith('/post')))

  await api.save({ record: { date: '2026-10-30', type: 'Mua ngoài', status: 'Đã nhập' }, documents: [sameMetadataDifferentBytes('bbbb')] })
  const uploadKeys = keys.filter(({ path }) => path.endsWith('/attachments')).map(({ key }) => key)
  assert.notEqual(uploadKeys[0], uploadKeys[1])
})
