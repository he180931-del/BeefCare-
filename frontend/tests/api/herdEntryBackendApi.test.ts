import assert from 'node:assert/strict'
import test from 'node:test'
import { createHerdEntryBackendApi, type BackendTransport } from '../../src/features/herd-entry/api/herdEntryBackendApi'
import { BackendError } from '../../src/api/backendClient'

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
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
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
  await api.discard('PN-2026-0041')
  assert.deepEqual(calls, [{ method: 'DELETE', path: '/api/farms/9/entry-vouchers/41', body: undefined }])
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
    id: 'PN-2026-0041',
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
  await api.recordPayment('PN-2026-0041', { date: '2026-10-30', amount: 1000000, method: 'Tiền mặt', ref: 'PT-01', note: 'Đợt 2' })
  assert.deepEqual(commands[0], {
    path: '/api/farms/9/vouchers/entry/41/payments',
    body: { paymentDate: '2026-10-30', amount: 1000000, method: 'CASH', reference: 'PT-01', note: 'Đợt 2', voucherVersion: 3 },
  })
  await api.recordPayment('PN-2026-0041', { date: '2026-10-30', amount: 1000000, method: 'Tiền mặt', ref: '', note: '' })
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
  const result = await api.voidVoucher('PN-2026-0041', 'Nhập nhầm nguồn')
  assert.equal(result.status, 'Đã hủy')
  assert.deepEqual(commands[0], { path: '/api/farms/9/entry-vouchers/41/void', body: { reason: 'Nhập nhầm nguồn', expectedVersion: 3 } })
})

test('entry backend reads private attachments and imports the same xlsx through preview then commit', async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
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
    command: async (path, body) => {
      calls.push({ method: 'POST', path, body })
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
  assert.ok(multipartBodies.every((body) => body instanceof FormData))
  assert.equal((multipartBodies[0] as FormData).get('file'), file)
  assert.equal((multipartBodies[1] as FormData).get('file'), file)
})

test('entry backend serializes the selected pricing basis', async () => {
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
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Nháp', pricing: 'con', source: 'Nguồn mới', draft: { pricing: 'con' } },
    cattleRows: [{ tag: 'VN501', breed: 'Brahman', sex: 'Cái', weight: 320, barn: 'A1', unitPrice: 80000 }],
  })

  assert.equal(body.pricingBasis, 'PER_HEAD')
  assert.equal(body.lines[0].unitPrice, 80000)

  await api.save({
    record: { date: '2026-10-29', type: 'Mua ngoài', status: 'Nháp', pricing: 'kg', source: 'Nguồn mới', draft: { pricing: 'kg' } },
    cattleRows: [{ tag: 'VN501', breed: 'Brahman', sex: 'Cái', weight: 320, barn: 'A1', unitPrice: 80000 }],
  })
  assert.equal(body.pricingBasis, 'PER_KG')
})

test('entry backend preserves the stored draft type and version when updating a partial draft', async () => {
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
  await api.save({ id: 'PN-2026-0041', record: { status: 'Nháp', draft: { date: '2026-10-29', cows: [] } } })

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
    cattleRows: [{ tag: 'CALF-0007', mother: 'DAM-001', sex: 'Cái', born: '2026-10-28', stage: 'Bê', purposeId: 2, penId: 3, calfOutcomeId: 17, weight: 34, barn: 'A3', unitPrice: 0 }],
  })

  assert.equal(body.entryType, 'FARM_BORN')
  assert.equal(body.sellerId, null)
  assert.equal(body.lines[0].calfOutcomeId, 17)
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

  await assert.rejects(() => api.save({ id: 'PN-2026-0041', record: { type: 'Mua ngoài', status: 'Nháp' } }), /forbidden/)
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
  const input = { id: 'PN-2026-RETRY', record: { date: '2026-10-30', type: 'Mua ngoài' as const, status: 'Nháp' as const } }

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

  await api.save({ id: 'PN-2026-CHANGED', record: { date: '2026-10-30', type: 'Mua ngoài', status: 'Nháp', draft: { note: 'A' } } })
  await api.save({ id: 'PN-2026-CHANGED', record: { date: '2026-10-30', type: 'Mua ngoài', status: 'Nháp', draft: { note: 'B' } } })

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
  await api.save({ id: 'PN-2026-LONG', record: { date: '2026-10-30', type: 'Mua ngoài', status: 'Đã nhập' }, documents: [sameMetadataDifferentBytes('aaaa')] })

  assert.ok(keys.every(({ key }) => (key?.length ?? 0) <= 128))
  assert.ok(keys.some(({ path }) => path.endsWith('/post')))

  await api.save({ id: 'PN-2026-LONG', record: { date: '2026-10-30', type: 'Mua ngoài', status: 'Đã nhập' }, documents: [sameMetadataDifferentBytes('bbbb')] })
  const uploadKeys = keys.filter(({ path }) => path.endsWith('/attachments')).map(({ key }) => key)
  assert.notEqual(uploadKeys[0], uploadKeys[1])
})
