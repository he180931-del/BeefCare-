import { createBackendClient } from './backendClient'
import { notifySessionExpired } from './sessionLifecycle'
import { readCurrentFarmId } from './currentFarm'

export interface BackendTransport {
  get(path: string): Promise<unknown>
  command(path: string, body: unknown, options?: { method?: string; key?: string }): Promise<unknown>
  farmPath(farmId: string | number, suffix?: string): string
}

export type BackendMode = 'local' | 'backend'

const env: Partial<ImportMetaEnv> = import.meta.env ?? {}

export const backendMode: BackendMode = env.VITE_BEEFCARE_DATA_SOURCE === 'backend' ? 'backend' : 'local'
const enteredFarmId = readCurrentFarmId()
/**
 * The current farm for every feature API: the farm entered on Select Farm in this tab (UC-FE02-02), otherwise the
 * configured one. Read once per page load; entering another farm reloads the page (see `currentFarm.ts`).
 */
export const backendFarmId = enteredFarmId != null ? String(enteredFarmId) : env.VITE_BEEFCARE_FARM_ID || '1'

export const backendTransport: BackendTransport = createBackendClient({
  baseUrl: env.VITE_BEEFCARE_API_URL || '',
  onUnauthorized: notifySessionExpired,
})

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}

export const asRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(asRecord) : []

export const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

export const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export const nullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export const enumPaymentMethod = (value: unknown): 'CASH' | 'BANK_TRANSFER' =>
  value === 'Tiền mặt' || value === 'CASH' ? 'CASH' : 'BANK_TRANSFER'

export const isoDate = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}

export const unwrapVoucher = (value: unknown): Record<string, unknown> => {
  const body = asRecord(value)
  return Object.hasOwn(body, 'voucher') ? asRecord(body.voucher) : body
}
