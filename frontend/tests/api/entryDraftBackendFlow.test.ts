import assert from 'node:assert/strict'
import test from 'node:test'
import { createBackendClient } from '../../src/api/backendClient'
import { createHerdEntryBackendApi } from '../../src/features/herd-entry/api/herdEntryBackendApi'

type EntryServerState = {
  voucher: Record<string, unknown>
  attachments: Array<Record<string, unknown>>
}

const entryVoucher = (entryType: 'PURCHASE' | 'FARM_BORN'): Record<string, unknown> => ({
  id: 41,
  code: 'PN-2026-0041',
  entryType,
  status: 'DRAFT',
  entryDate: '2026-10-29',
  seller: entryType === 'PURCHASE' ? { id: 7, name: 'Trang trại Mộc Châu', phone: '0901000000' } : null,
  quarantineCertNo: entryType === 'PURCHASE' ? 'KD-41' : null,
  vehiclePlate: entryType === 'PURCHASE' ? '29C-12345' : null,
  note: entryType === 'PURCHASE' ? 'Nhập đợt 1' : null,
  pricingBasis: 'PER_KG',
  transportFee: entryType === 'PURCHASE' ? 100000 : 0,
  cattleCount: 1,
  totalWeightKg: 320,
  cattleAmount: entryType === 'PURCHASE' ? 25600000 : 0,
  totalAmount: entryType === 'PURCHASE' ? 25700000 : 0,
  outstandingAmount: entryType === 'PURCHASE' ? 20700000 : 0,
  version: 3,
  lines: [{
    id: 91,
    cattleId: null,
    cattleCode: null,
    earTagNumber: 'VN-ENTRY-1',
    breedName: 'Brahman',
    sex: 'FEMALE',
    entryWeightKg: entryType === 'PURCHASE' ? 320 : 32,
    penCode: 'A1',
    lineAmount: entryType === 'PURCHASE' ? 25600000 : 0,
    calfOutcomeId: entryType === 'FARM_BORN' ? 501 : null,
    damCode: entryType === 'FARM_BORN' ? 'BC-000125' : null,
    data: {
      name: entryType === 'FARM_BORN' ? 'Bê Mộc Châu' : 'Mây',
      breedName: 'Brahman',
      sex: 'FEMALE',
      birthDate: entryType === 'FARM_BORN' ? '2026-10-29' : '2024-01-02',
      birthDateAccuracy: 'EXACT',
      lifeStage: entryType === 'FARM_BORN' ? 'UNWEANED_CALF' : 'ADULT',
      purposeName: entryType === 'FARM_BORN' ? 'Chưa xác định' : 'Vỗ béo',
      purposeId: entryType === 'FARM_BORN' ? 0 : 31,
      entryWeightKg: entryType === 'PURCHASE' ? 320 : 32,
      weightBasis: 'MEASURED',
      unitPrice: entryType === 'PURCHASE' ? 80000 : 0,
      calfOutcomeId: entryType === 'FARM_BORN' ? 501 : null,
      damCode: entryType === 'FARM_BORN' ? 'BC-000125' : null,
      earTagNumber: 'VN-ENTRY-1',
    },
  }],
  payments: [],
  history: [],
})

async function createEntryApi(entryType: 'PURCHASE' | 'FARM_BORN') {
  const state: EntryServerState = { voucher: entryVoucher(entryType), attachments: [] }
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? init.body : ''
    let result: { status?: number; body?: unknown }
    if (url.pathname === '/api/csrf') result = { body: { token: 'test-csrf' } }
    else if (url.pathname === '/api/farms/9/pens') result = { body: { pens: [{ id: 11, code: 'A1', name: 'Chuồng A1' }] } }
    else if (url.pathname === '/api/farms/9/catalogues/breeds') result = { body: [{ id: 21, name: 'Brahman' }] }
    else if (url.pathname === '/api/farms/9/catalogues/production-purposes') result = { body: [{ id: 31, name: 'Vỗ béo' }] }
    else if (url.pathname === '/api/farms/9/trading-partners') result = { body: entryType === 'PURCHASE' ? [{ id: 7, name: 'Trang trại Mộc Châu' }] : [] }
    else if (url.pathname === '/api/farms/9/pending-calves') result = { body: [{ calfOutcomeId: 501, damCode: 'BC-000125', sireCode: 'Không rõ', sex: 'FEMALE', birthDate: '2026-10-29', birthWeightKg: 32, tagCode: 'VN-ENTRY-1', proposedPenId: 11, proposedPenCode: 'A1', defaultPurposeId: 0, registrationState: 'PENDING_CONFIRMATION', draftVoucherId: 41 }] }
    else if (url.pathname === '/api/farms/9/entry-vouchers' && method === 'GET') result = { body: { items: [state.voucher] } }
    else if (url.pathname === '/api/farms/9/entry-vouchers/41' && method === 'GET') result = { body: state.voucher }
    else if (url.pathname === '/api/farms/9/entry-vouchers/41/attachments' && method === 'GET') result = { body: state.attachments }
    else if (url.pathname === '/api/farms/9/entry-vouchers' && method === 'POST') {
      const payload = JSON.parse(body) as Record<string, unknown>
      const lines = Array.isArray(payload.lines) ? payload.lines : []
      state.voucher = {
        ...state.voucher,
        entryType: payload.entryType,
        entryDate: payload.entryDate,
        quarantineCertNo: payload.quarantineCertNo,
        vehiclePlate: payload.vehiclePlate,
        note: payload.note,
        lines: lines.map((line, index) => ({
          id: 91 + index,
          ...line,
          cattleCode: null,
          earTagNumber: (line as Record<string, unknown>).earTagNumber,
          breedName: 'Brahman',
          sex: (line as Record<string, unknown>).sex,
          entryWeightKg: entryType === 'FARM_BORN' ? 32 : (line as Record<string, unknown>).entryWeightKg,
          penCode: 'A1',
          data: {
            name: (line as Record<string, unknown>).name,
            breedName: 'Brahman',
            sex: (line as Record<string, unknown>).sex,
            birthDate: entryType === 'FARM_BORN' ? '2026-10-29' : (line as Record<string, unknown>).birthDate,
            birthDateAccuracy: (line as Record<string, unknown>).birthDateAccuracy,
            lifeStage: entryType === 'FARM_BORN' ? 'UNWEANED_CALF' : (line as Record<string, unknown>).lifeStage,
            purposeName: entryType === 'FARM_BORN' ? 'Chưa xác định' : 'Vỗ béo',
            purposeId: entryType === 'FARM_BORN' ? 0 : 31,
            entryWeightKg: (line as Record<string, unknown>).entryWeightKg,
            weightBasis: (line as Record<string, unknown>).weightBasis,
            unitPrice: (line as Record<string, unknown>).unitPrice,
            earTagNumber: (line as Record<string, unknown>).earTagNumber,
            calfOutcomeId: entryType === 'FARM_BORN' ? 501 : null,
            damCode: entryType === 'FARM_BORN' ? 'BC-000125' : null,
          },
        })),
        version: 4,
      }
      result = { body: state.voucher }
    }
    else if (url.pathname === '/api/farms/9/entry-vouchers/41/attachments' && method === 'POST') {
      const attachment = { id: 71, contentType: 'application/pdf', fileSize: 12, originalFilename: 'kiem-dich.pdf' }
      state.attachments = [attachment]
      result = { body: attachment }
    }
    else throw new Error(`Unexpected ${method} ${url.pathname}`)
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { 'content-type': 'application/json' } })
  }
  const transport = createBackendClient({ baseUrl: 'http://backend.test', fetchImpl })
  return { api: createHerdEntryBackendApi({ transport, farmId: 9 }) }
}

test('farm-born entry backend reopens the selected calf row instead of resetting to pending calves', async () => {
  const { api } = await createEntryApi('FARM_BORN')
  try {
    await api.save({
      record: {
        date: '2026-10-29', type: 'Bê sinh tại trại', status: 'Nháp',
        draft: {
          type: 'Bê sinh tại trại', date: '2026-10-29',
          calves: [{ name: 'Bê Mộc Châu', tag: 'VN-ENTRY-1', mother: 'BC-000125', father: 'Không rõ', born: '2026-10-01', sex: 'Cái', weight: 32, estimated: false, purpose: 'Vỗ béo', picked: true, barn: 'A1' }],
        },
      },
      cattleRows: [{ tag: 'VN-ENTRY-1', name: 'Bê Mộc Châu', sex: 'Cái', weight: 32, barn: 'A1', purpose: 'Vỗ béo', calfOutcomeId: 501 }],
    })

    const reopened = await api.get('PN-2026-0041')
    assert.equal(reopened.draft?.type, 'Bê sinh tại trại')
    const calves = (reopened.draft as unknown as { calves?: Array<Record<string, unknown>> }).calves ?? []
    assert.equal(calves[0]?.calfOutcomeId, 501)
    assert.equal(calves[0]?.mother, 'BC-000125')
    assert.equal(calves[0]?.tag, 'VN-ENTRY-1')
    assert.equal(calves[0]?.born, '2026-10-29')
    assert.equal(calves[0]?.picked, true)
    assert.equal(calves[0]?.penId, 11)
    assert.equal(calves[0]?.purposeId, 0)
    const pending = await api.pendingCalves()
    assert.deepEqual(pending[0], { name: 'Bê số 1', tag: 'VN-ENTRY-1', mother: 'BC-000125', father: 'Không rõ', born: '2026-10-29', sex: 'Cái', weight: 32, estimated: false, purpose: 'Chưa xác định', picked: false, barn: 'A1', calfOutcomeId: 501, penId: 11, purposeId: 0, draftVoucherId: 41 })
    assert.equal(reopened.draft?.sourceId, '')
    assert.equal(reopened.draft?.paid, 0)
    assert.deepEqual(reopened.detail?.payments, [])
  } finally { /* intercepted fetch has no external resources */ }
})
