// Compatibility facade (refactor phase 1). The transport, runtime config and primitive parsers moved to
// `shared/api/backendTransport`, `shared/config/runtime` and `shared/api/parse`; feature APIs still import them here.
// What is left below is not shared infrastructure and leaves this file in a later phase:
// - `backendFarmId` (legacy farm fallback) → removed in phase 4, the active farm belongs to `app/session`;
// - `enumPaymentMethod`, `unwrapVoucher`, `isoDate` → the Herd Entry / Herd Exit mappers in phase 2.
import { readCurrentFarmId } from '../app/session/currentFarm'
import { asRecord } from '../shared/api/parse'
import { configuredFarmId } from '../shared/config/runtime'

export { backendTransport, type BackendTransport } from '../shared/api/backendTransport'
export { backendMode, type BackendMode } from '../shared/config/runtime'
export { asRecord, asRows, nullableNumber, numberValue, textValue } from '../shared/api/parse'

const enteredFarmId = readCurrentFarmId()
/**
 * The current farm for every feature API: the farm entered on Select Farm in this tab (UC-FE02-02), otherwise the
 * configured one. Read once per page load; entering another farm reloads the page (see `currentFarm.ts`).
 */
export const backendFarmId = enteredFarmId != null ? String(enteredFarmId) : configuredFarmId || '1'

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
