import assert from 'node:assert/strict'
import test from 'node:test'
import { createBackendClient, BackendError } from '../../src/api/backendClient'

test('TC-CAT-API01: GET /api/farms/{id}/cattle lists cattle with filters and pagination', async () => {
  const fetchMock: typeof fetch = async (input) => {
    const url = new URL(String(input), 'http://backend.test')
    if (url.pathname.includes('/api/farms/1/cattle')) {
      return new Response(JSON.stringify({
        items: [
          { id: 501, displayCode: 'BC-000501', earTagNumber: 'VN-501', herdStatus: 'ACTIVE', herdGroup: 'FATTENING', penCode: 'A1' },
          { id: 502, displayCode: 'BC-000502', earTagNumber: 'VN-502', herdStatus: 'ACTIVE', herdGroup: 'BREEDING_FEMALES', penCode: 'B1' },
        ],
        total: 2,
        page: 0,
        size: 25,
        counts: { ACTIVE: 2, EXITED: 0, VOIDED: 0 },
      }), { headers: { 'Content-Type': 'application/json' } })
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })
  const result = await client.get<{ items: Array<{ displayCode: string; herdStatus: string }>; total: number }>('/api/farms/1/cattle?herdStatus=ACTIVE')

  assert.equal(result.total, 2)
  assert.equal(result.items[0].displayCode, 'BC-000501')
  assert.equal(result.items[0].herdStatus, 'ACTIVE')
})

test('TC-CAT-API02: PUT /api/farms/{id}/cattle/{id}/profile updates identity and enforces unique secondary ear tag (GBR-23, MSG-FE05-02)', async () => {
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) return new Response(JSON.stringify({ token: 'csrf-ok' }), { headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/api/farms/1/cattle/501/profile')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (body.earTagNumber === 'DUPLICATE-TAG') {
        return new Response(JSON.stringify({ code: 'MSG-FE05-02', message: 'Số thẻ tai phụ đã tồn tại trong trại' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ id: 501, displayCode: 'BC-000501', earTagNumber: body.earTagNumber, name: body.name }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })

  // 1. Cập nhật thành công
  const updated = await client.command<{ earTagNumber: string; name: string }>('/api/farms/1/cattle/501/profile', {
    name: 'Bò cái đầu đàn',
    earTagNumber: 'VN-501-NEW',
  }, { method: 'PUT' })
  assert.equal(updated.earTagNumber, 'VN-501-NEW')
  assert.equal(updated.name, 'Bò cái đầu đàn')

  // 2. Cập nhật trùng thẻ tai phụ bị từ chối với lỗi MSG-FE05-02
  await assert.rejects(
    async () => {
      await client.command('/api/farms/1/cattle/501/profile', { earTagNumber: 'DUPLICATE-TAG' }, { method: 'PUT' })
    },
    (err: unknown) => {
      assert(err instanceof BackendError)
      assert.equal(err.status, 400)
      assert.equal(err.code, 'MSG-FE05-02')
      return true
    }
  )
})

test('TC-CAT-API03: POST /api/farms/{id}/cattle/{id}/reissue-qr reissues QR tag with reason (GBR-27, MSG-FE05-08)', async () => {
  let requestBody: unknown = null
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) return new Response(JSON.stringify({ token: 'csrf-ok' }), { headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/api/farms/1/cattle/501/reissue-qr')) {
      requestBody = init?.body ? JSON.parse(String(init.body)) : {}
      return new Response(JSON.stringify({
        newQrTag: 'QR-BC-000501-2',
        previousQrTag: 'QR-BC-000501-1',
        status: 'ACTIVE',
      }), { headers: { 'Content-Type': 'application/json' } })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })
  const result = await client.command<{ newQrTag: string; previousQrTag: string }>('/api/farms/1/cattle/501/reissue-qr', {
    reason: 'LOST',
    note: 'Rách mất thẻ khi gặm cỏ',
  })

  assert.equal(result.newQrTag, 'QR-BC-000501-2')
  assert.equal(result.previousQrTag, 'QR-BC-000501-1')
})

