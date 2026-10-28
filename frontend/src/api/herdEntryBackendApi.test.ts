import assert from 'node:assert/strict'
import test from 'node:test'
import { createHerdEntryBackendApi, type BackendTransport } from '../features/herd-entry/api/herdEntryBackendApi'

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
