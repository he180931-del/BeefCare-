import assert from 'node:assert/strict'
import test from 'node:test'
import { createBackendClient, BackendError } from '../../src/shared/api/backendClient'

test('TC-AUTH-API01: /api/csrf retrieves CSRF token and header name', async () => {
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) {
      return new Response(JSON.stringify({ token: 'test-token-123', headerName: 'X-XSRF-TOKEN' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })
  const csrf = await client.getCsrf()

  assert.equal(csrf.token, 'test-token-123')
  assert.equal(csrf.headerName, 'X-XSRF-TOKEN')
})

test('TC-AUTH-API02: /api/authenticate handles successful 204 session and bad credentials 401', async () => {
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : {}

    if (url.endsWith('/api/csrf')) {
      return new Response(JSON.stringify({ token: 'csrf-ok' }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.endsWith('/api/authenticate')) {
      if (body.username === 'manager@beefcare.local' && body.password === 'beefcare-dev-password') {
        return new Response(null, { status: 204 })
      }
      return new Response(JSON.stringify({ code: 'MSG-FE01-01', message: 'Email hoặc mật khẩu không đúng' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })

  // 1. Đăng nhập thành công trả về 204
  await assert.doesNotReject(async () => {
    await client.login('manager@beefcare.local', 'beefcare-dev-password', true)
  })

  // 2. Đăng nhập sai mật khẩu trả về 401 với code MSG-FE01-01
  await assert.rejects(
    async () => {
      await client.login('manager@beefcare.local', 'wrong-password')
    },
    (err: unknown) => {
      assert(err instanceof BackendError)
      assert.equal(err.status, 401)
      assert.equal(err.code, 'MSG-FE01-01')
      return true
    }
  )
})

test('TC-AUTH-API03: /api/authenticate handles account lockout 423', async () => {
  const fetchMock: typeof fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) {
      return new Response(JSON.stringify({ token: 'csrf-ok' }), { headers: { 'Content-Type': 'application/json' } })
    }
    if (url.endsWith('/api/authenticate')) {
      return new Response(JSON.stringify({ code: 'MSG-FE01-02', message: 'Tài khoản đã bị tạm khóa 15 phút do nhập sai 5 lần' }), {
        status: 423,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })

  await assert.rejects(
    async () => {
      await client.login('locked@beefcare.local', 'password')
    },
    (err: unknown) => {
      assert(err instanceof BackendError)
      assert.equal(err.status, 423)
      assert.equal(err.code, 'MSG-FE01-02')
      return true
    }
  )
})

test('TC-AUTH-API04: /api/logout clears authentication session', async () => {
  let loggedOut = false
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) {
      return new Response(JSON.stringify({ token: 'csrf-ok' }), { headers: { 'Content-Type': 'application/json' } })
    }
    if (url.endsWith('/api/logout')) {
      loggedOut = true
      return new Response(null, { status: 204 })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })
  await client.logout()

  assert.equal(loggedOut, true)
})

test('TC-AUTH-API05: logout treats an already-missing server session as signed out', async () => {
  const fetchMock: typeof fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/api/csrf')) {
      return new Response(JSON.stringify({ token: 'csrf-ok' }), { headers: { 'Content-Type': 'application/json' } })
    }
    if (url.endsWith('/api/logout')) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const client = createBackendClient({ fetchImpl: fetchMock })

  await assert.doesNotReject(() => client.logout())
})

type CapturedRequest = { url: string; init: RequestInit | undefined }

function assertTransportRequest(captured: CapturedRequest, method: string, path: string, body?: unknown, csrf = false) {
  assert.equal(captured.url, path)
  assert.equal(captured.init?.method ?? 'GET', method)
  assert.equal(captured.init?.credentials, 'include')
  const headers = new Headers(captured.init?.headers)
  assert.equal(headers.get('Accept'), 'application/json')
  if (body === undefined) {
    assert.equal(captured.init?.body, undefined)
    assert.equal(headers.get('Content-Type'), null)
  } else {
    assert.equal(headers.get('Content-Type'), 'application/json')
    assert.deepEqual(JSON.parse(String(captured.init?.body)), body)
  }
  if (csrf) assert.equal(headers.get('X-XSRF-TOKEN'), 'csrf-wbs11')
  else assert.equal(headers.get('X-XSRF-TOKEN'), null)
}

test('TC-AUTH-API06: registration and verification resend preserve exact body, CSRF, credentials and response semantics', async () => {
  const cases = [
    {
      path: '/api/register',
      body: { fullName: 'Test Owner', email: 'owner@example.test', password: 'SomeStrongPass9', confirmPassword: 'SomeStrongPass9', termsAccepted: true },
      response: new Response(null, { status: 201 }),
      invoke: (client: ReturnType<typeof createBackendClient>, body: unknown) => client.request<void>('/api/register', { method: 'POST', body }),
    },
    {
      path: '/api/account/verification/resend',
      body: { email: 'owner@example.test' },
      response: new Response(JSON.stringify({ nextAllowedAt: '2026-11-24T08:01:00Z' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      invoke: (client: ReturnType<typeof createBackendClient>, body: unknown) => client.request<{ nextAllowedAt: string }>('/api/account/verification/resend', { method: 'POST', body }),
    },
  ]

  for (const scenario of cases) {
    const captured: CapturedRequest[] = []
    const fetchMock: typeof fetch = async (input, init) => {
      captured.push({ url: String(input), init })
      if (String(input).endsWith('/api/csrf')) return new Response(JSON.stringify({ token: 'csrf-wbs11' }), { headers: { 'Content-Type': 'application/json' } })
      return scenario.response.clone()
    }
    const client = createBackendClient({ fetchImpl: fetchMock })
    const result = await scenario.invoke(client, scenario.body)

    assert.equal(captured.length, 2)
    assertTransportRequest(captured[0], 'GET', '/api/csrf')
    assertTransportRequest(captured[1], 'POST', scenario.path, scenario.body, true)
    if (scenario.path.endsWith('resend')) assert.deepEqual(result, { nextAllowedAt: '2026-11-24T08:01:00Z' })
  }
})

test('TC-AUTH-API07: reset init, URL-encoded validation, and finish preserve exact HTTP contracts', async () => {
  const resetEmail = 'owner@example.test'
  const token = 'a+b /?&'

  {
    const captured: CapturedRequest[] = []
    const fetchMock: typeof fetch = async (input, init) => {
      captured.push({ url: String(input), init })
      if (String(input).endsWith('/api/csrf')) return new Response(JSON.stringify({ token: 'csrf-wbs11' }), { headers: { 'Content-Type': 'application/json' } })
      return new Response(null, { status: 200 })
    }
    const client = createBackendClient({ fetchImpl: fetchMock })
    await client.request<void>('/api/account/reset-password/init', { method: 'POST', body: { email: resetEmail } })
    assert.equal(captured.length, 2)
    assertTransportRequest(captured[0], 'GET', '/api/csrf')
    assertTransportRequest(captured[1], 'POST', '/api/account/reset-password/init', { email: resetEmail }, true)
  }

  {
    const captured: CapturedRequest[] = []
    const fetchMock: typeof fetch = async (input, init) => {
      captured.push({ url: String(input), init })
      return new Response(JSON.stringify({ valid: true, email: resetEmail }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    const client = createBackendClient({ fetchImpl: fetchMock })
    const result = await client.request<{ valid: boolean; email: string }>(`/api/account/reset-password/validate?token=${encodeURIComponent(token)}`)
    assert.deepEqual(result, { valid: true, email: resetEmail })
    assert.equal(captured.length, 1)
    assertTransportRequest(captured[0], 'GET', `/api/account/reset-password/validate?token=${encodeURIComponent(token)}`)
  }

  {
    const captured: CapturedRequest[] = []
    const fetchMock: typeof fetch = async (input, init) => {
      captured.push({ url: String(input), init })
      if (String(input).endsWith('/api/csrf')) return new Response(JSON.stringify({ token: 'csrf-wbs11' }), { headers: { 'Content-Type': 'application/json' } })
      return new Response(null, { status: 204 })
    }
    const client = createBackendClient({ fetchImpl: fetchMock })
    await client.request<void>('/api/account/reset-password/finish', {
      method: 'POST',
      body: { key: token, newPassword: 'ResetPassword-88', confirmPassword: 'ResetPassword-88' },
    })
    assert.equal(captured.length, 2)
    assertTransportRequest(captured[0], 'GET', '/api/csrf')
    assertTransportRequest(captured[1], 'POST', '/api/account/reset-password/finish', {
      key: token,
      newPassword: 'ResetPassword-88',
      confirmPassword: 'ResetPassword-88',
    }, true)
  }
})
