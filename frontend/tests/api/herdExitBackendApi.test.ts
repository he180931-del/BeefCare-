import assert from 'node:assert/strict'
import test from 'node:test'
import { createHerdExitBackendApi, type BackendTransport } from '../../src/features/herd-exit/api/herdExitBackendApi'

const voucher = (status = 'DRAFT') => ({
  id: 61, code: 'PX-2026-0061', exitType: 'SALE', status, exitDate: '2026-10-29', buyer: { id: 8, name: 'Lò mổ Hà Đông' },
  destination: null, transportCertNo: 'VC-61', vehiclePlate: '30H-12345', note: 'Bán lứa 1', pricingBasis: 'PER_KG',
  deductions: 200000, depositCollected: 1000000, cattleCount: 1, totalWeightKg: 410, cattleAmount: 32800000,
  totalAmount: 32600000, paidAmount: 1000000, outstandingAmount: 31600000, version: 5,
  lines: [{ id: 71, cattleId: 301, cattleCode: 'BC-000301', earTagNumber: 'VN301', breedName: 'Brahman', sex: 'MALE', exitWeightKg: 410, lastPenCode: 'B1', lineAmount: 32800000 }],
  payments: [], documents: [], history: [],
})

test('exit backend resolves cattle and buyer ids before creating and confirming a sale', async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      calls.push({ method: 'GET', path })
      if (path.includes('/trading-partners')) return [{ id: 8, name: 'Lò mổ Hà Đông' }]
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async (path, body, options) => {
      calls.push({ method: options?.method ?? 'POST', path, body })
      return path.endsWith('/confirm') ? { voucher: voucher('CONFIRMED') } : voucher('DRAFT')
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  const saved = await api.save({
    record: {
      date: '2026-10-29', type: 'Bán', status: 'Đã xuất', who: 'Lò mổ Hà Đông',
      draft: { buyerId: 'b1', quarantine: 'VC-61', plate: '30H-12345', note: 'Bán lứa 1', pricing: 'kg', deduction: 200000, collected: 1000000, method: 'Chuyển khoản', dueDate: '2026-11-05' },
    },
    cattleRows: [{ code: 'BC-000301', weight: 410, estimated: false, unitPrice: 80000 }],
  })

  assert.equal(saved.id, 'PX-2026-0061')
  assert.equal(saved.status, 'Đã xuất')
  const create = calls.find((call) => call.method === 'POST' && call.path.endsWith('/exit-vouchers'))
  assert.deepEqual(create?.body, {
    exitType: 'SALE', exitDate: '2026-10-29', buyerId: 8, destination: null, transportCertNo: 'VC-61', vehiclePlate: '30H-12345', note: 'Bán lứa 1',
    lossKind: null, deathCause: null, carcassDisposal: null, pricingBasis: 'PER_KG', deductions: 200000, depositCollected: 1000000,
    paymentMethod: 'BANK_TRANSFER', collectionDueDate: '2026-11-05', lines: [{ cattleId: 301, exitWeightKg: 410, weightBasis: 'MEASURED', unitPrice: 80000 }], expectedVersion: null,
  })
  assert.deepEqual(calls.at(-1), { method: 'POST', path: '/api/farms/9/exit-vouchers/61/confirm', body: { acknowledged: true, expectedVersion: 5 } })
})

test('exit backend preserves per-head pricing and maps persisted per-head drafts', async () => {
  const writes: Array<{ path: string; body: unknown }> = []
  const perHeadVoucher = { ...voucher('DRAFT'), pricingBasis: 'PER_HEAD', lines: [{ ...voucher('DRAFT').lines[0], unitPrice: 8500000 }] }
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [perHeadVoucher] }
      if (path.endsWith('/attachments')) return []
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      if (path.includes('/trading-partners')) return [{ id: 8, name: 'Lò mổ Hà Đông' }]
      return perHeadVoucher
    },
    command: async (path, body) => { writes.push({ path, body }); return { voucher: { ...perHeadVoucher, version: 6 } } },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })

  const loaded = await api.get('PX-2026-0061')
  await api.save({
    id: 'PX-2026-0061', record: { status: 'Nháp', type: 'Bán', date: '2026-10-29', draft: { pricing: 'con' } },
    cattleRows: [{ code: 'BC-000301', backendId: 301, weight: 410, unitPrice: 8500000, estimated: false }],
  })

  assert.equal(loaded.draft?.pricing, 'con')
  assert.equal((writes[0]?.body as Record<string, unknown>)?.pricingBasis, 'PER_HEAD')
})

test('exit backend preserves an OTHER MISSING loss when reopening and saving a draft', async () => {
  const missingVoucher = {
    ...voucher('DRAFT'), exitType: 'OTHER', loss: true, lossKind: 'MISSING', deathCause: 'Báo mất tích', lines: [{ ...voucher('DRAFT').lines[0], penCode: 'C9' }],
  }
  const commands: Array<{ path: string; body: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [missingVoucher] }
      if (path.endsWith('/attachments')) return []
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      return missingVoucher
    },
    command: async (path, body) => { commands.push({ path, body }); return { voucher: missingVoucher } },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  const loaded = await api.get('PX-2026-0061')
  assert.equal(loaded.type, 'Khác')
  assert.equal(loaded.detail?.lossType, 'Mất tích')

  await api.save({
    id: loaded.id,
    record: { status: 'Nháp', type: 'Khác', date: loaded.date, detail: { ...loaded.detail, lossType: loaded.detail?.lossType } },
    cattleRows: [{ code: 'BC-000301', backendId: 301, weight: 410, estimated: false, unitPrice: 0 }],
  })

  assert.equal((commands[0]?.body as Record<string, unknown>)?.exitType, 'OTHER')
  assert.equal((commands[0]?.body as Record<string, unknown>)?.lossKind, 'MISSING')
})

test('exit backend maps an OTHER MISSING loss kind to the UI loss label', async () => {
  const missingVoucher = { ...voucher('DRAFT'), exitType: 'OTHER', loss: true, lossKind: 'MISSING', deathCause: 'Báo mất tích' }
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => path.endsWith('/exit-vouchers') ? { vouchers: [missingVoucher] } : path.endsWith('/attachments') ? [] : missingVoucher,
    command: async () => ({ voucher: missingVoucher }),
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })

  const loaded = await api.get('PX-2026-0061')

  assert.equal(loaded.detail?.lossType, 'Mất tích')
  assert.equal(loaded.detail?.disposal, '')
})

test('exit backend keeps backend selectable cattle DTOs and defaults their unit price to zero', async () => {
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => path.endsWith('/selectable-cattle') ? [{
      cattleId: 991, cattleCode: 'BC-BACKEND-ONLY', earTagNumber: 'TAG-991', breedName: 'Brahman', sex: 'FEMALE', ageMonths: 31,
      herdGroup: 'BREEDING_FEMALES', lifeStage: 'ADULT', penCode: 'C9',
      latestWeight: { weightKg: 512, basis: 'MEASURED', date: '2026-10-28' }, withdrawalEndDate: '2026-11-03', openCaseId: 77,
    }] : [],
    command: async () => ({}),
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })

  assert.deepEqual(await api.selectableCattle(), [{
    code: 'BC-BACKEND-ONLY', backendId: 991, tag: 'TAG-991', breed: 'Brahman', sex: 'Cái', age: '31 tháng', group: 'Bò cái sinh sản', groupKey: 'BREEDING_FEMALES', stage: 'Bò trưởng thành', stageKey: 'ADULT', barn: 'C9',
    weight: 512, weightNote: 'cân 2026-10-28', estimated: false, unitPrice: 0, withdrawalUntil: '2026-11-03', openCase: 'HC-77',
  }])
})

test('exit backend records collection using ISO date, backend id and version', async () => {
  const commands: Array<{ path: string; body: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => path.endsWith('/exit-vouchers')
      ? { vouchers: [{ id: 61, code: 'PX-2026-0061', exitType: 'SALE', status: 'CONFIRMED', exitDate: '2026-10-29', cattleCount: 1, totalWeightKg: 410, totalAmount: 32600000, outstandingAmount: 31600000, version: 5 }] }
      : voucher('CONFIRMED'),
    command: async (path, body) => { commands.push({ path, body }); return voucher('CONFIRMED') },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  await api.recordPayment('PX-2026-0061', { date: '2026-10-30', amount: 500000, method: 'Chuyển khoản', ref: 'MB-01', note: 'Đợt 2' })
  assert.deepEqual(commands[0], {
    path: '/api/farms/9/vouchers/exit/61/payments',
    body: { paymentDate: '2026-10-30', amount: 500000, method: 'BANK_TRANSFER', reference: 'MB-01', note: 'Đợt 2', voucherVersion: 5 },
  })
  await api.recordPayment('PX-2026-0061', { date: '2026-10-30', amount: 500000, method: 'Chuyển khoản', ref: '', note: '' })
  assert.deepEqual(commands[1]?.body, { paymentDate: '2026-10-30', amount: 500000, method: 'BANK_TRANSFER', reference: null, note: null, voucherVersion: 5 })
})

test('exit backend void and dismiss commands keep the backend id and version', async () => {
  const commands: Array<{ path: string; body: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async () => ({ vouchers: [{ id: 61, code: 'PX-2026-0061', exitType: 'SALE', status: 'CONFIRMED', exitDate: '2026-10-29', cattleCount: 1, version: 5 }] }),
    command: async (path, body) => {
      commands.push({ path, body })
      return { voucher: voucher(path.endsWith('/dismiss') ? 'DISMISSED' : 'VOIDED') }
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  assert.equal((await api.voidVoucher('PX-2026-0061', 'Khách trả lại')).status, 'Đã hủy')
  assert.equal((await api.dismissVoucher('PX-2026-0061', 'Ca sức khỏe sai', 9)).status, 'Đã bác')
  assert.deepEqual(commands, [
    { path: '/api/farms/9/exit-vouchers/61/void', body: { reason: 'Khách trả lại', penOverrides: {}, warningReasons: {}, expectedVersion: 5 } },
    { path: '/api/farms/9/exit-vouchers/61/dismiss', body: { reason: 'Ca sức khỏe sai', expectedVersion: 9 } },
  ])
})

test('exit backend persists the draft, uploads documents, then confirms without changing the saved type', async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  const draft = voucher('DRAFT')
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      calls.push({ method: 'GET', path })
      if (path.endsWith('/exit-vouchers')) return { vouchers: [draft] }
      if (path.endsWith('/attachments')) return []
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      if (path.includes('/trading-partners')) return [{ id: 8, name: 'Lò mổ Hà Đông' }]
      return draft
    },
    command: async (path, body, options) => {
      calls.push({ method: options?.method ?? 'POST', path, body })
      if (path.endsWith('/attachments')) return { id: 901, contentType: 'application/pdf', fileSize: 12, originalFilename: 'hop-dong.pdf' }
      if (path.endsWith('/confirm')) return { voucher: { ...draft, status: 'CONFIRMED', version: 7 } }
      return { voucher: { ...draft, version: 6 } }
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  const file = new File(['%PDF-1.4'], 'hop-dong.pdf', { type: 'application/pdf' })
  await api.save({
    id: 'PX-2026-0061',
    record: { type: 'Chết / mất', status: 'Đã xuất', date: '2026-10-29', who: 'Lò mổ Hà Đông', draft: { pricing: 'con' } },
    cattleRows: [{ code: 'BC-000301', backendId: 301, weight: 410, estimated: false, unitPrice: 80000 }],
    documents: [file],
  })

  const writes = calls.filter((call) => call.method !== 'GET')
  assert.equal(writes[0]?.method, 'PUT')
  assert.equal(writes[0]?.path, '/api/farms/9/exit-vouchers/61')
  assert.equal((writes[0]?.body as Record<string, unknown>)?.exitType, 'SALE')
  assert.equal((writes[0]?.body as Record<string, unknown>)?.pricingBasis, 'PER_HEAD')
  assert.equal(writes[1]?.path, '/api/farms/9/exit-vouchers/61/attachments')
  assert.ok(writes[1]?.body instanceof FormData)
  assert.equal(writes[2]?.path, '/api/farms/9/exit-vouchers/61/confirm')
})

test('exit backend maps attachment metadata and downloads private bytes through the transport', async () => {
  const attachment = { id: 901, contentType: 'image/jpeg', fileSize: 18, originalFilename: 'anh-bo.jpg' }
  const bytes = new Blob(['private image'], { type: 'image/jpeg' })
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher('CONFIRMED'), status: 'CONFIRMED' }] }
      if (path.endsWith('/attachments')) return [attachment]
      if (path.endsWith('/attachments/901')) return bytes
      if (path.includes('/trading-partners') || path.endsWith('/selectable-cattle')) return []
      return voucher('CONFIRMED')
    },
    command: async () => voucher('CONFIRMED'),
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  const loaded = await api.get('PX-2026-0061')
  assert.deepEqual(loaded.detail?.docs, [{ id: 901, ext: 'JPG', name: 'anh-bo.jpg', size: 18, url: '/api/farms/9/exit-vouchers/61/attachments/901' }])
  assert.equal(await api.downloadAttachment('PX-2026-0061', 901), bytes)
})

test('exit backend loads the persisted voucher checks with per-cattle warning messages', async () => {
  const requests: string[] = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      requests.push(path)
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher('DRAFT'), status: 'DRAFT' }] }
      if (path.endsWith('/checks')) return {
        voucherId: 61, code: 'PX-2026-0061', version: 5, exitDate: '2026-10-29',
        cattle: [{ cattleId: 301, cattleCode: 'BC-000301', penId: 11, penCode: 'B1', hasWarnings: true, messages: [{ code: 'MSG-FE13-07', text: 'Ngưng giết mổ đến 31/10/2026' }] }],
        occupancy: [{ penId: 11, penCode: 'B1', capacity: 10, before: 1, after: 0 }],
      }
      throw new Error(`Unexpected GET ${path}`)
    },
    command: async () => voucher('DRAFT'),
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })

  const result = await api.checks('PX-2026-0061')

  assert.equal(requests.at(-1), '/api/farms/9/exit-vouchers/61/checks')
  assert.equal(result.cattle[0]?.cattleCode, 'BC-000301')
  assert.deepEqual(result.cattle[0]?.messages, [{ code: 'MSG-FE13-07', text: 'Ngưng giết mổ đến 31/10/2026' }])
  assert.equal(result.cattle[0]?.hasWarnings, true)
})

test('exit backend confirms the exact checks version with acknowledgement', async () => {
  const writes: Array<{ path: string; body: unknown; options?: unknown }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher('DRAFT'), status: 'DRAFT', version: 8 }] }
      return voucher('DRAFT')
    },
    command: async (path, body, options) => {
      writes.push({ path, body, options })
      return { voucher: { ...voucher('CONFIRMED'), status: 'CONFIRMED', version: 9 } }
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })

  await api.confirm('PX-2026-0061', 8)

  assert.deepEqual(writes, [{
    path: '/api/farms/9/exit-vouchers/61/confirm',
    body: { acknowledged: true, expectedVersion: 8 },
    options: { key: writes[0]?.options && (writes[0].options as { key?: string }).key },
  }])
  assert.ok((writes[0]?.options as { key?: string }).key)
  assert.ok(((writes[0]?.options as { key: string }).key).length <= 128)
})

test('exit backend stops before confirmation when a document upload fails', async () => {
  const writes: string[] = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher('DRAFT'), status: 'DRAFT' }] }
      if (path.endsWith('/attachments')) return []
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      if (path.includes('/trading-partners')) return [{ id: 8, name: 'Lò mổ Hà Đông' }]
      return voucher('DRAFT')
    },
    command: async (path) => {
      writes.push(path)
      if (path.endsWith('/attachments')) throw new Error('upload failed')
      return { voucher: { ...voucher('DRAFT'), version: 6 } }
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  await assert.rejects(api.save({
    id: 'PX-2026-0061', record: { status: 'Đã xuất', type: 'Bán', date: '2026-10-29' },
    cattleRows: [{ code: 'BC-000301', backendId: 301, weight: 410, unitPrice: 80000, estimated: false }],
    documents: [new File(['%PDF'], 'fail.pdf', { type: 'application/pdf' })],
  }), /upload failed/)
  assert.deepEqual(writes, ['/api/farms/9/exit-vouchers/61', '/api/farms/9/exit-vouchers/61/attachments'])
})

test('exit backend retries a partial upload without re-uploading the attachment that already succeeded', async () => {
  const writes: Array<{ path: string; body?: unknown; options?: unknown }> = []
  let uploadCount = 0
  let persisted = false
  let failSecond = true
  const first = new File(['1'], 'one.pdf', { type: 'application/pdf' })
  const second = new File(['2'], 'two.pdf', { type: 'application/pdf' })
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher('DRAFT'), status: 'DRAFT', version: persisted ? 6 : 5 }] }
      if (path.endsWith('/attachments')) return persisted ? [{ id: 901, contentType: 'application/pdf', fileSize: 1, originalFilename: 'one.pdf' }] : []
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      if (path.includes('/trading-partners')) return [{ id: 8, name: 'Lò mổ Hà Đông' }]
      return { ...voucher('DRAFT'), version: persisted ? 6 : 5 }
    },
    command: async (path, body, options) => {
      writes.push({ path, body, options })
      if (path.endsWith('/attachments')) {
        uploadCount += 1
        if (uploadCount === 2 && failSecond) { failSecond = false; throw new Error('second upload failed') }
        persisted = true
        return path.includes('two') ? { id: 902, contentType: 'application/pdf', fileSize: 1, originalFilename: 'two.pdf' } : { id: 901, contentType: 'application/pdf', fileSize: 1, originalFilename: 'one.pdf' }
      }
      if (path.endsWith('/confirm')) return { voucher: { ...voucher('CONFIRMED'), status: 'CONFIRMED', version: 7 } }
      return { voucher: { ...voucher('DRAFT'), version: persisted ? 6 : 5 } }
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  const input = {
    id: 'PX-2026-0061', record: { status: 'Đã xuất' as const, type: 'Bán' as const, date: '2026-10-29' },
    cattleRows: [{ code: 'BC-000301', backendId: 301, weight: 410, unitPrice: 80000, estimated: false }], documents: [first, second],
  }

  await assert.rejects(api.save(input), /second upload failed/)
  const retry = await api.save(input)

  assert.equal(retry.status, 'Đã xuất')
  assert.equal(writes.filter((write) => write.path.endsWith('/attachments')).length, 3)
  assert.equal(writes.filter((write) => write.path.endsWith('/confirm')).length, 1)
})

test('exit backend retries a failed confirmation without uploading the same persisted file again', async () => {
  const writes: string[] = []
  let persisted = false
  let failConfirm = true
  const file = new File(['1'], 'one.pdf', { type: 'application/pdf' })
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher('DRAFT'), status: 'DRAFT', version: persisted ? 6 : 5 }] }
      if (path.endsWith('/attachments')) return persisted ? [{ id: 901, contentType: 'application/pdf', fileSize: 1, originalFilename: 'one.pdf' }] : []
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      if (path.includes('/trading-partners')) return [{ id: 8, name: 'Lò mổ Hà Đông' }]
      return { ...voucher('DRAFT'), version: persisted ? 6 : 5 }
    },
    command: async (path) => {
      writes.push(path)
      if (path.endsWith('/attachments')) { persisted = true; return { id: 901, contentType: 'application/pdf', fileSize: 1, originalFilename: 'one.pdf' } }
      if (path.endsWith('/confirm') && failConfirm) { failConfirm = false; throw new Error('confirm failed') }
      if (path.endsWith('/confirm')) return { voucher: { ...voucher('CONFIRMED'), status: 'CONFIRMED', version: 7 } }
      return { voucher: { ...voucher('DRAFT'), version: 6 } }
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  const input = {
    id: 'PX-2026-0061', record: { status: 'Đã xuất' as const, type: 'Bán' as const, date: '2026-10-29' },
    cattleRows: [{ code: 'BC-000301', backendId: 301, weight: 410, unitPrice: 80000, estimated: false }], documents: [file],
  }

  await assert.rejects(api.save(input), /confirm failed/)
  await api.save(input)

  assert.equal(writes.filter((path) => path.endsWith('/attachments')).length, 1)
  assert.equal(writes.filter((path) => path.endsWith('/confirm')).length, 2)
})

test('exit backend reconciles a confirmation that succeeded before the response failed', async () => {
  const writes: string[] = []
  let confirmed = false
  let uploaded = false
  const file = new File(['1'], 'one.pdf', { type: 'application/pdf' })
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher(confirmed ? 'CONFIRMED' : 'DRAFT'), status: confirmed ? 'CONFIRMED' : 'DRAFT', version: confirmed ? 7 : 5 }] }
      if (path.endsWith('/attachments')) return uploaded ? [{ id: 901, contentType: 'application/pdf', fileSize: 1, originalFilename: 'one.pdf' }] : []
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      if (path.includes('/trading-partners')) return [{ id: 8, name: 'Lò mổ Hà Đông' }]
      return { ...voucher(confirmed ? 'CONFIRMED' : 'DRAFT'), status: confirmed ? 'CONFIRMED' : 'DRAFT', version: confirmed ? 7 : 5 }
    },
    command: async (path) => {
      writes.push(path)
      if (path.endsWith('/confirm')) { confirmed = true; throw new Error('response lost after confirmation') }
      if (path.endsWith('/attachments')) { uploaded = true; return { id: 901, contentType: 'application/pdf', fileSize: 1, originalFilename: 'one.pdf' } }
      return { voucher: { ...voucher('DRAFT'), version: 6 } }
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  const input = {
    id: 'PX-2026-0061', record: { status: 'Đã xuất' as const, type: 'Bán' as const, date: '2026-10-29' },
    cattleRows: [{ code: 'BC-000301', backendId: 301, weight: 410, unitPrice: 80000, estimated: false }], documents: [file],
  }

  await assert.rejects(api.save(input), /response lost after confirmation/)
  const retry = await api.save(input)

  assert.equal(retry.status, 'Đã xuất')
  assert.equal(writes.filter((path) => path.endsWith('/attachments')).length, 1)
  assert.equal(writes.filter((path) => path.endsWith('/confirm')).length, 1)
})

test('exit backend removes a persisted attachment through the private route', async () => {
  const writes: Array<{ path: string; body: unknown; method?: string }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher('DRAFT'), status: 'DRAFT' }] }
      if (path.endsWith('/attachments')) return []
      return voucher('DRAFT')
    },
    command: async (path, body, options) => { writes.push({ path, body, method: options?.method }); return { id: 901 } },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  await api.removeAttachment('PX-2026-0061', 901)
  assert.deepEqual(writes.at(-1), {
    path: '/api/farms/9/exit-vouchers/61/attachments/901', body: undefined, method: 'DELETE',
  })
})

test('exit backend uses bounded content digests for stable save and upload idempotency keys', async () => {
  const keys: Array<{ path: string; key?: string }> = []
  const transport: BackendTransport = {
    farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}`,
    get: async (path) => {
      if (path.endsWith('/exit-vouchers')) return { vouchers: [{ ...voucher('DRAFT'), status: 'DRAFT', version: 5 }] }
      if (path.endsWith('/attachments')) return []
      if (path.endsWith('/selectable-cattle')) return [{ cattleId: 301, cattleCode: 'BC-000301' }]
      if (path.includes('/trading-partners')) return [{ id: 8, name: 'Lò mổ Hà Đông' }]
      return voucher('DRAFT')
    },
    command: async (path, _body, options) => {
      keys.push({ path, key: options?.key })
      if (path.endsWith('/attachments')) return { id: 901, contentType: 'application/pdf', fileSize: 1, originalFilename: 'a'.repeat(255) + '.pdf' }
      return { voucher: { ...voucher('DRAFT'), version: 6 } }
    },
  }
  const api = createHerdExitBackendApi({ transport, farmId: 9 })
  const longName = `${'a'.repeat(255)}.pdf`
  const input = {
    id: 'PX-2026-0061', record: { status: 'Nháp' as const, type: 'Bán' as const, date: '2026-10-29' },
    cattleRows: [{ code: 'BC-000301', backendId: 301, weight: 410, unitPrice: 80000, estimated: false }],
    documents: [new File(['same-content'], longName, { type: 'application/pdf' })],
  }

  await api.save(input)
  const firstSaveKey = keys[0]?.key
  const firstUploadKey = keys[1]?.key
  await api.save(input)

  assert.ok(firstSaveKey)
  assert.ok(firstUploadKey)
  assert.ok(firstSaveKey!.length <= 128)
  assert.ok(firstUploadKey!.length <= 128)
  assert.equal(keys[2]?.key, firstSaveKey)
  assert.equal(keys[3]?.key, firstUploadKey)

  await api.save({ ...input, cattleRows: [{ ...input.cattleRows[0], weight: 411 }] })
  assert.notEqual(keys[4]?.key, firstSaveKey)
  await api.save({ ...input, documents: [new File(['changed-content'], longName, { type: 'application/pdf' })] })
  assert.notEqual(keys[6]?.key, firstUploadKey)
})
