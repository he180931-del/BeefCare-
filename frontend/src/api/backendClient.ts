/** HTTP transport for the real backend. Existing localStorage prototype adapters stay separate. */
type ErrorBody = {
  message?: string
  detail?: string
  title?: string
  code?: string
  errorKey?: string
  params?: Record<string, unknown>
  fieldErrors?: Array<{ field: string; message: string }>
}

const errorBody = (value: unknown): ErrorBody => typeof value === 'object' && value !== null ? value as ErrorBody : {}

export class BackendError extends Error {
  readonly status: number
  readonly code: string | null
  readonly params: Record<string, unknown>
  readonly fieldErrors: Array<{ field: string; message: string }>

  constructor(status: number, value: unknown = {}) {
    const body = errorBody(value)
    super(body.message || body.detail || body.title || `HTTP ${status}`)
    this.name = 'BackendError'
    this.status = status
    this.code = body.code || body.errorKey || null
    this.params = body.params || {}
    this.fieldErrors = body.fieldErrors || []
  }
}

type ClientOptions = { baseUrl?: string; fetchImpl?: typeof fetch; newKey?: () => string }
type RequestOptions = { method?: string; body?: unknown; key?: string; signal?: AbortSignal; headers?: Record<string, string> }
type CsrfBody = { token: string; headerName?: string }

export function createBackendClient({ baseUrl = '', fetchImpl = globalThis.fetch, newKey = () => globalThis.crypto.randomUUID() }: ClientOptions = {}) {
  let csrfToken: string | undefined
  let csrfHeader = 'X-XSRF-TOKEN'
  const pathUrl = (path: string): string => {
    if (!path.startsWith('/api/')) throw new TypeError('Use a relative /api/ path')
    return `${baseUrl.replace(/\/$/, '')}${path}`
  }
  async function responseBody(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('json')) return response.json()
    if (!response.ok) return { message: await response.text() }
    return response.blob()
  }
  async function getCsrf(): Promise<CsrfBody> {
    const response = await fetchImpl(pathUrl('/api/csrf'), { credentials: 'include', headers: { Accept: 'application/json' } })
    const body = await responseBody(response)
    if (!response.ok) throw new BackendError(response.status, body)
    const csrf = errorBody(body) as ErrorBody & Partial<CsrfBody>
    if (!csrf.token) throw new Error('Backend did not return a CSRF token')
    csrfToken = csrf.token
    csrfHeader = csrf.headerName || 'X-XSRF-TOKEN'
    return { token: csrf.token, headerName: csrf.headerName }
  }
  async function request<T = unknown>(path: string, { method = 'GET', body, key, signal, headers = {} }: RequestOptions = {}): Promise<T> {
    const changing = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
    if (changing && !csrfToken) await getCsrf()
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData
    const actualHeaders: Record<string, string> = { Accept: 'application/json', ...headers }
    if (body !== undefined && !multipart) actualHeaders['Content-Type'] = 'application/json'
    if (changing && csrfToken) actualHeaders[csrfHeader] = csrfToken
    if (key) actualHeaders['Idempotency-Key'] = key
    const response = await fetchImpl(pathUrl(path), {
      method, credentials: 'include', headers: actualHeaders,
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal,
    })
    const result = await responseBody(response)
    if (!response.ok) throw new BackendError(response.status, result)
    return result as T
  }
  return {
    request,
    getCsrf,
    newCommandKey: newKey,
    async login(username: string, password: string, rememberMe = false) {
      await getCsrf()
      await request('/api/authenticate', { method: 'POST', body: { username, password, rememberMe } })
      csrfToken = undefined
      await getCsrf()
    },
    async logout() {
      await request('/api/logout', { method: 'POST' })
      csrfToken = undefined
    },
    get: <T = unknown>(path: string, options?: RequestOptions) => request<T>(path, options),
    // Keep this key for a retry after a timeout; generate a new key only for a new user action.
    command: <T = unknown>(path: string, body: unknown, { method = 'POST', key = newKey(), ...options }: RequestOptions = {}) => request<T>(path, { ...options, method, body, key }),
    farmPath: (farmId: string | number, suffix = '') => {
      if (!/^\d+$/.test(String(farmId))) throw new TypeError('farmId must be the backend numeric ID')
      return `/api/farms/${farmId}${suffix}`
    },
  }
}
