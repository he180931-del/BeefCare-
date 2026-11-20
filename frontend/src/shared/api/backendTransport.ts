import { backendBaseUrl } from '../config/runtime'
import { createBackendClient } from './backendClient'
import { notifySessionExpired } from './sessionExpiry'

export interface BackendTransport {
  get(path: string, options?: { headers?: Record<string, string> }): Promise<unknown>
  command(path: string, body: unknown, options?: { method?: string; key?: string; headers?: Record<string, string> }): Promise<unknown>
  /** Null (no farm entered in this tab) builds a path the client refuses to send. */
  farmPath(farmId: string | number | null, suffix?: string): string
}

/** The one HTTP client every feature API shares (CSRF token, credentials, Idempotency-Key, 401 signal). */
export const backendTransport: BackendTransport = createBackendClient({
  baseUrl: backendBaseUrl,
  onUnauthorized: notifySessionExpired,
})
