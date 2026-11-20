import test from 'node:test'
import assert from 'node:assert/strict'
import { createBackendClient } from '../../src/shared/api/backendClient'
import { createFeedStockAdjustmentApi } from '../../src/features/feed-stock/api/feedStockAdjustmentApi'

const adjustmentView = (status: string, version: number, countedKg = 190) => ({
  id: 8130, code: 'ĐCK-2026-0030', countDate: '2026-11-13', adjustmentType: 'PERIODIC_COUNT', countedBy: 'Linh',
  status, totalDifferenceKg: -10, totalValue: -120000, postedAt: status === 'POSTED' ? '2026-11-13T08:05:00Z' : null,
  version,
  lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', systemKg: 200, countedKg,
    differenceKg: countedKg - 200, reason: 'Kiểm kê thực tế', unitCost: 12000, differenceValue: (countedKg - 200) * 12000 }],
})

const attachment = {
  id: 91, contentType: 'application/pdf', fileSize: 8, originalFilename: 'kiem-ke.pdf', createdAt: '2026-11-13T08:00:00Z',
}

test('stock adjustment lifecycle and attachments use farm-scoped HTTP, CSRF, versions and idempotency', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    const pathname = new URL(url).pathname
    calls.push({ url, init })
    if (pathname === '/api/csrf') return Response.json({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' })
    if (pathname === '/api/farms/32/feed/adjustments' && init?.method === 'POST') return Response.json(adjustmentView('DRAFT', 0))
    if (pathname === '/api/farms/32/feed/adjustments/8130' && init?.method === 'GET') return Response.json(adjustmentView('DRAFT', 0))
    if (pathname === '/api/farms/32/feed/adjustments/8130/draft' && init?.method === 'PUT') return Response.json(adjustmentView('DRAFT', 1, 188))
    if (pathname === '/api/farms/32/feed/adjustments/8130/post' && init?.method === 'POST') return Response.json(adjustmentView('POSTED', 2, 188))
    if (pathname === '/api/farms/32/feed/adjustments/8130/attachments' && init?.method === 'GET') return Response.json([attachment])
    if (pathname === '/api/farms/32/feed/adjustments/8130/attachments' && init?.method === 'POST') return Response.json(attachment)
    if (pathname === '/api/farms/32/feed/adjustments/8130/attachments/91' && init?.method === 'DELETE') return Response.json(attachment)
    if (pathname === '/api/farms/32/feed/adjustments/8130/attachments/91' && init?.method === 'GET') {
      return new Response('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } })
    }
    throw new Error(`Unexpected ${init?.method ?? 'GET'} ${pathname}`)
  }
  const transport = createBackendClient({ baseUrl: 'http://backend.test', fetchImpl })
  const api = createFeedStockAdjustmentApi({ mode: 'backend', farmId: 32, transport })
  const input = {
    countDate: '2026-11-13', adjustmentType: 'PERIODIC_COUNT' as const, countedBy: 'Linh',
    lines: [{ feedItemId: 101, countedKg: 190, reason: 'Kiểm kê thực tế' }],
  }

  const draft = await api.saveDraft(input, { key: 'adjustment-create-key' })
  assert.equal(draft.status, 'DRAFT')
  assert.equal((await api.get(String(draft.id))).lines[0]?.systemKg, 200)
  const createCall = calls.find((call) => new URL(call.url).pathname === '/api/farms/32/feed/adjustments' && call.init?.method === 'POST')!
  assert.equal((createCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'adjustment-create-key')
  assert.equal((createCall.init?.headers as Record<string, string>)['X-XSRF-TOKEN'], 'csrf-token')
  assert.equal(createCall.init?.credentials, 'include')
  assert.deepEqual(JSON.parse(String(createCall.init?.body)), {
    countDate: '2026-11-13', adjustmentType: 'PERIODIC_COUNT', countedBy: 'Linh',
    lines: [{ feedItemId: 101, countedKg: 190, reason: 'Kiểm kê thực tế' }], postNow: false,
  })

  const updated = await api.saveDraft({ ...input, id: draft.id, expectedVersion: draft.version, lines: [{ ...input.lines[0], countedKg: 188 }] }, { key: 'adjustment-update-key' })
  const updateCall = calls.find((call) => new URL(call.url).pathname.endsWith('/8130/draft'))!
  assert.equal((updateCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'adjustment-update-key')
  assert.deepEqual(JSON.parse(String(updateCall.init?.body)), {
    expectedVersion: 0, countDate: '2026-11-13', adjustmentType: 'PERIODIC_COUNT', countedBy: 'Linh',
    lines: [{ feedItemId: 101, countedKg: 188, reason: 'Kiểm kê thực tế' }],
  })

  const posted = await api.post(updated.id, updated.version, { key: 'adjustment-post-key' })
  const postCall = calls.find((call) => new URL(call.url).pathname.endsWith('/8130/post'))!
  assert.equal(posted.status, 'POSTED')
  assert.deepEqual(JSON.parse(String(postCall.init?.body)), { expectedVersion: 1 })
  assert.equal((postCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'adjustment-post-key')

  assert.deepEqual(await api.attachments(8130), [attachment])
  const file = new File(['%PDF-1.4'], 'kiem-ke.pdf', { type: 'application/pdf' })
  assert.deepEqual(await api.uploadAttachment(8130, file, { key: 'adjustment-upload-key' }), attachment)
  const uploadCall = calls.find((call) => new URL(call.url).pathname.endsWith('/attachments') && call.init?.method === 'POST')!
  assert.equal((uploadCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'adjustment-upload-key')
  assert.ok(uploadCall.init?.body instanceof FormData)
  const uploadedFile = (uploadCall.init?.body as FormData).get('file')
  assert.ok(uploadedFile instanceof File)
  if (uploadedFile instanceof File) assert.equal(uploadedFile.name, 'kiem-ke.pdf')

  await api.removeAttachment(8130, 91, { key: 'adjustment-remove-key' })
  const removeCall = calls.find((call) => new URL(call.url).pathname.endsWith('/attachments/91') && call.init?.method === 'DELETE')!
  assert.equal((removeCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'adjustment-remove-key')
  assert.equal(await (await api.downloadAttachment(8130, 91)).text(), '%PDF-1.4')
})
