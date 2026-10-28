/** HTTP transport for the real backend. Existing localStorage prototype adapters stay separate. */
export class BackendError extends Error {
  constructor(status, body = {}) {
    super(body.message || body.detail || body.title || `HTTP ${status}`)
    this.name = 'BackendError'
    this.status = status
    this.code = body.code || body.errorKey || null
    this.params = body.params || {}
    this.fieldErrors = body.fieldErrors || []
  }
}

export function createBackendClient({ baseUrl = '', fetchImpl = globalThis.fetch, newKey = () => globalThis.crypto.randomUUID() } = {}) {
  let csrfToken
  let csrfHeader = 'X-XSRF-TOKEN'
  const pathUrl = (path) => {
    if (!path.startsWith('/api/')) throw new TypeError('Use a relative /api/ path')
    return `${baseUrl.replace(/\/$/, '')}${path}`
  }
  async function responseBody(response) {
    if (response.status === 204) return undefined
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('json')) return response.json()
    if (!response.ok) return { message: await response.text() }
    return response.blob()
  }
  async function getCsrf() {
    const response = await fetchImpl(pathUrl('/api/csrf'), { credentials: 'include', headers: { Accept: 'application/json' } })
    const body = await responseBody(response)
    if (!response.ok) throw new BackendError(response.status, body)
    if (!body?.token) throw new Error('Backend did not return a CSRF token')
    csrfToken = body.token
    csrfHeader = body.headerName || 'X-XSRF-TOKEN'
    return body
  }
  async function request(path, { method = 'GET', body, key, signal, headers = {} } = {}) {
    const changing = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
    if (changing && !csrfToken) await getCsrf()
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData
    const actualHeaders = { Accept: 'application/json', ...headers }
    if (body !== undefined && !multipart) actualHeaders['Content-Type'] = 'application/json'
    if (changing) actualHeaders[csrfHeader] = csrfToken
    if (key) actualHeaders['Idempotency-Key'] = key
    const response = await fetchImpl(pathUrl(path), {
      method, credentials: 'include', headers: actualHeaders,
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal,
    })
    const result = await responseBody(response)
    if (!response.ok) throw new BackendError(response.status, result)
    return result
  }
  return {
    request,
    getCsrf,
    newCommandKey: newKey,
    async login(username, password, rememberMe = false) {
      await getCsrf()
      await request('/api/authenticate', { method: 'POST', body: { username, password, rememberMe } })
      csrfToken = undefined
      await getCsrf()
    },
    async logout() {
      await request('/api/logout', { method: 'POST' })
      csrfToken = undefined
    },
    get: (path, options) => request(path, options),
    // Keep this key for a retry after a timeout; generate a new key only for a new user action.
    command: (path, body, { method = 'POST', key = newKey(), ...options } = {}) => request(path, { ...options, method, body, key }),
    farmPath: (farmId, suffix = '') => {
      if (!/^\d+$/.test(String(farmId))) throw new TypeError('farmId must be the backend numeric ID')
      return `/api/farms/${farmId}${suffix}`
    },
  }
}

