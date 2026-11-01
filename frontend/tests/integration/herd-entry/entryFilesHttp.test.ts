import assert from 'node:assert/strict'
import test from 'node:test'
import { createBackendClient } from '../../../src/api/backendClient'
import { createHerdEntryBackendApi } from '../../../src/features/herd-entry/api/herdEntryBackendApi'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

test('entry adapter restores a draft and its private attachment metadata through the real HTTP client', async () => {
  const requests: Array<{ url: string; method: string; credentials: RequestCredentials | undefined }> = []
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = String(input)
    requests.push({ url, method: init.method ?? 'GET', credentials: init.credentials })
    if (url.endsWith('/api/farms/9/entry-vouchers')) return json({ items: [{ id: 41, code: 'PN-2026-0041', status: 'DRAFT', entryType: 'PURCHASE', version: 3 }] })
    if (url.endsWith('/api/farms/9/entry-vouchers/41')) return json({
      id: 41, code: 'PN-2026-0041', status: 'DRAFT', entryType: 'PURCHASE', entryDate: '2026-10-18', version: 3,
      seller: { id: 7, name: 'Trang trại Mộc Châu', phone: '0901000000' }, vehiclePlate: '29C-123.45', lines: [],
    })
    if (url.endsWith('/api/farms/9/entry-vouchers/41/attachments')) return json([
      { id: 71, originalFilename: 'kiem-dich.pdf', contentType: 'application/pdf', fileSize: 12 },
    ])
    throw new Error(`Unexpected request ${url}`)
  }
  const transport = createBackendClient({ baseUrl: 'https://beefcare.test', fetchImpl })
  const api = createHerdEntryBackendApi({ transport, farmId: 9 })

  const result = await api.get('PN-2026-0041')

  assert.equal(result.draft?.sourceId, '7')
  assert.equal(result.draft?.plate, '29C-123.45')
  assert.deepEqual(result.detail?.docs, [{
    id: 71,
    name: 'kiem-dich.pdf',
    ext: 'PDF',
    size: 12,
    url: '/api/farms/9/entry-vouchers/41/attachments/71',
  }])
  assert.ok(requests.every((request) => request.credentials === 'include'))
})
