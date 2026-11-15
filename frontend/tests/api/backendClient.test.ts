import test from 'node:test'
import assert from 'node:assert/strict'
import { createBackendClient, BackendError } from '../../src/api/backendClient'

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
test('session check distinguishes an authenticated response from 401', async () => {
  const authenticated = createBackendClient({ fetchImpl: async () => new Response(null, { status: 204 }) })
  assert.equal(await authenticated.isAuthenticated(), true)
  const anonymous = createBackendClient({ fetchImpl: async () => json({ message: 'unauthorized' }, 401) })
  assert.equal(await anonymous.isAuthenticated(), false)
})
test('protected requests report an expired session on 401 but not a permission-only 403', async () => {
  let expiredSessions = 0
  let status = 401
  const api = createBackendClient({
    fetchImpl: async () => json({ message: status === 401 ? 'unauthorized' : 'forbidden' }, status),
    onUnauthorized: () => { expiredSessions += 1 },
  })

  await assert.rejects(api.get('/api/protected'), (error) => error instanceof BackendError && error.status === 401)
  assert.equal(expiredSessions, 1)

  status = 403
  await assert.rejects(api.get('/api/protected'), (error) => error instanceof BackendError && error.status === 403)
  assert.equal(expiredSessions, 1)
})
// Found while testing in the browser (15/11/2026): after switching account in the same tab, the feature client still
// sent the CSRF token of the previous session and every command got a bare 403 ("Phiên làm việc không còn hợp lệ").
test('a command rejected by the CSRF filter refreshes the token and is resent once with the same key', async () => {
  const calls: Array<{ path: string; token?: string; key?: string }> = []
  let current = 'csrf-old'
  const api = createBackendClient({ fetchImpl: async (path, options) => {
    const url = String(path)
    const headers = (options?.headers ?? {}) as Record<string, string>
    if (url.endsWith('/csrf')) return json({ token: current })
    calls.push({ path: url, token: headers['X-XSRF-TOKEN'], key: headers['Idempotency-Key'] })
    return headers['X-XSRF-TOKEN'] === 'csrf-new' ? json({ id: 1 }, 201) : json({ status: 403, title: 'Forbidden' }, 403)
  } })
  await api.getCsrf() // token of the earlier session
  current = 'csrf-new' // the other client signed in again: the session has a new token
  assert.deepEqual(await api.request('/api/farms/1/cattle/7/growth', { method: 'POST', key: 'k-1', body: {} }), { id: 1 })
  assert.deepEqual(calls.map((c) => [c.token, c.key]), [['csrf-old', 'k-1'], ['csrf-new', 'k-1']])
})

test('a domain 403 (with a code) is not resent and a second bare 403 is reported', async () => {
  let posts = 0
  const domain = createBackendClient({ fetchImpl: async (path) => String(path).endsWith('/csrf') ? json({ token: 't' }) : (posts++, json({ code: 'MSG-COM-01' }, 403)) })
  await assert.rejects(domain.request('/api/x', { method: 'POST', body: {} }), (error) => error instanceof BackendError && error.code === 'MSG-COM-01')
  assert.equal(posts, 1)
  posts = 0
  const bare = createBackendClient({ fetchImpl: async (path) => String(path).endsWith('/csrf') ? json({ token: 't' }) : (posts++, json({ title: 'Forbidden' }, 403)) })
  await assert.rejects(bare.request('/api/x', { method: 'POST', body: {} }), (error) => error instanceof BackendError && error.status === 403)
  assert.equal(posts, 2)
})

test('absolute external URLs cannot receive session headers', async () => {
  const api = createBackendClient({ fetchImpl: async () => { throw new Error('must not fetch') } })
  await assert.rejects(api.get('https://example.test/api/farms'), /relative/)
})
