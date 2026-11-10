import assert from 'node:assert/strict'
import test from 'node:test'
import { createBackendClient, BackendError } from '../../src/api/backendClient'

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
