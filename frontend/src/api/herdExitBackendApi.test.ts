import assert from 'node:assert/strict'
import test from 'node:test'
import { createHerdExitBackendApi, type BackendTransport } from '../features/herd-exit/api/herdExitBackendApi'

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
  assert.equal((await api.dismissVoucher('PX-2026-0061', 'Ca sức khỏe sai')).status, 'Đã bác')
  assert.deepEqual(commands, [
    { path: '/api/farms/9/exit-vouchers/61/void', body: { reason: 'Khách trả lại', penOverrides: {}, warningReasons: {}, expectedVersion: 5 } },
    { path: '/api/farms/9/exit-vouchers/61/dismiss', body: { reason: 'Ca sức khỏe sai', expectedVersion: 5 } },
  ])
})
