import test from 'node:test'
import assert from 'node:assert/strict'
import { createBackendClient, BackendError } from './backendClient'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
test('command retains cookies, CSRF token and the caller request key', async () => {
  const calls: Array<{ path: string; options?: RequestInit }> = []
  const api = createBackendClient({ fetchImpl: async (path, options) => {
    const url = String(path)
    calls.push({ path: url, options })
    return url.endsWith('/csrf') ? json({ token: 'csrf-value', headerName: 'X-XSRF-TOKEN' }) : json({ id: 42 })
  }, newKey: () => 'generated-key' })
  const result = await api.command<{ id: number }>('/api/farms/1/pens', { code: 'A' }, { key: 'same-key-for-retry' })
  assert.equal(result.id, 42)
  const request = calls[1]?.options
  assert.equal(request?.credentials, 'include')
  const headers = request?.headers as Record<string, string>
  assert.equal(headers['X-XSRF-TOKEN'], 'csrf-value')
  assert.equal(headers['Idempotency-Key'], 'same-key-for-retry')
  assert.deepEqual(JSON.parse(String(request?.body)), { code: 'A' })
})
test('validation errors preserve backend field errors and code', async () => {
  const api = createBackendClient({ fetchImpl: async () => json({ code: 'MSG-COM-06', fieldErrors: [{ field: 'name', message: 'required' }] }, 400) })
  await assert.rejects(api.get('/api/farms'), (error) => error instanceof BackendError && error.status === 400 && error.fieldErrors[0].field === 'name')
})
test('login accepts a 204 session response and refreshes CSRF', async () => {
  let tokens = 0
  const api = createBackendClient({ fetchImpl: async (path) => String(path).endsWith('/csrf') ? json({ token: `csrf-${++tokens}` }) : new Response(null, { status: 204 }) })
  await api.login('owner@example.test', 'secret')
  assert.equal(tokens, 2)
})
test('absolute external URLs cannot receive session headers', async () => {
  const api = createBackendClient({ fetchImpl: async () => { throw new Error('must not fetch') } })
  await assert.rejects(api.get('https://example.test/api/farms'), /relative/)
})
