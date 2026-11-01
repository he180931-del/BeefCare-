import assert from 'node:assert/strict'
import test from 'node:test'
import { createBackendClient, BackendError } from '../../src/api/backendClient'

test('TC-PEN-API01: GET /api/farms/{id}/pens lists farm pens with capacity and status', async () => {
  const fetchMock: typeof fetch = async (input) => {
    const url = String(input)
    if (url.includes('/api/farms/1/pens')) {
      return new Response(JSON.stringify({
        pens: [
          { id: 11, code: 'A1', name: 'Chuồng A1', capacity: 10, headcount: 3, status: 'ACTIVE', acceptsSummary: 'Sinh sản' },
          { id: 12, code: 'B1', name: 'Chuồng B1', capacity: 10, headcount: 5, status: 'INACTIVE', acceptsSummary: 'Vỗ béo' },
        ],
      }), { headers: { 'Content-Type': 'application/json' } })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })
  const result = await client.get<{ pens: Array<{ code: string; capacity: number; headcount: number; status: string }> }>('/api/farms/1/pens')

  assert.equal(result.pens.length, 2)
  assert.equal(result.pens[0].code, 'A1')
  assert.equal(result.pens[0].capacity, 10)
  assert.equal(result.pens[0].headcount, 3)
})

test('TC-PEN-API02: POST /api/farms/{id}/pens creates new pen and validates uniqueness (GBR-19)', async () => {
  let createdPayload: unknown = null
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) return new Response(JSON.stringify({ token: 'csrf-ok' }), { headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/api/farms/1/pens')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (body.code === 'A1') {
        return new Response(JSON.stringify({ code: 'MSG-FE04-01', message: 'Mã chuồng đã tồn tại' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      createdPayload = body
      return new Response(JSON.stringify({ id: 13, code: body.code, name: body.name, capacity: body.capacity, headcount: 0, status: 'ACTIVE' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })

  // 1. Tạo chuồng C1 thành công
  const created = await client.command<{ id: number; code: string; capacity: number }>('/api/farms/1/pens', {
    code: 'C1',
    name: 'Chuồng C1 mới',
    capacity: 15,
  })
  assert.equal(created.code, 'C1')
  assert.equal(created.capacity, 15)

  // 2. Tạo trùng mã A1 thất bại với mã lỗi MSG-FE04-01
  await assert.rejects(
    async () => {
      await client.command('/api/farms/1/pens', { code: 'A1', name: 'Trùng A1', capacity: 10 })
    },
    (err: unknown) => {
      assert(err instanceof BackendError)
      assert.equal(err.status, 400)
      assert.equal(err.code, 'MSG-FE04-01')
      return true
    }
  )
})

test('TC-PEN-API03: POST /api/farms/{id}/pen-moves/check pre-checks capacity and advisory criteria (GBR-20, GBR-21)', async () => {
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) return new Response(JSON.stringify({ token: 'csrf-ok' }), { headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/api/farms/1/pen-moves/check')) {
      return new Response(JSON.stringify({
        toPenId: 12,
        toPenCode: 'B1',
        destinationActive: true,
        capacity: 10,
        headcount: 5,
        freePlaces: 5,
        movingCount: 1,
        blocked: false,
        cattle: [
          {
            cattleId: 501,
            cattleCode: 'BC-000501',
            currentPenCode: 'A1',
            alreadyInDestination: false,
            allMet: false,
            warningReasonRequired: true,
            results: [{ criterion: 'PURPOSE', met: false, detail: 'Mục đích không khớp tiêu chí chuồng' }],
          },
        ],
      }), { headers: { 'Content-Type': 'application/json' } })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })
  const check = await client.command<{ blocked: boolean; freePlaces: number; cattle: Array<{ allMet: boolean; warningReasonRequired: boolean }> }>('/api/farms/1/pen-moves/check', {
    cattleId: 501,
    toPenId: 12,
    moveDate: '2026-10-31',
  })

  assert.equal(check.blocked, false)
  assert.equal(check.freePlaces, 5)
  assert.equal(check.cattle[0].allMet, false)
  assert.equal(check.cattle[0].warningReasonRequired, true)
})

