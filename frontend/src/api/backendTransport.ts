// Compatibility facade (refactor phase 1). The transport, runtime config and primitive parsers moved to
// `shared/api/backendTransport`, `shared/config/runtime` and `shared/api/parse`; feature APIs still import them here.
// What is left below is not shared infrastructure and leaves this file in a later phase:
// - `backendFarmId` (legacy farm fallback) → removed in phase 4, the active farm belongs to `app/session`.
// `enumPaymentMethod` / `unwrapVoucher` moved to the Herd Entry / Herd Exit mappers and `isoDate` to shared/lib/date (phase 2b).
import { readCurrentFarmId } from '../app/session/currentFarm'
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
