/**
 * UC-FE02-02: the farm the user entered on Select Farm (SCR-09), kept for this browser tab only.
 *
 * Feature APIs read it once when the page loads (`activeFarmId`), so entering another farm reloads the page; the reload
 * also drops every piece of data and every filter of the previous farm (R-02-12). The stored id is never proof of
 * permission: the backend rechecks membership, role and service status on every request (GBR-09).
 */
export const CURRENT_FARM_KEY = 'beefcare.currentFarmId'

function tabStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** A backend farm id written in an address or in storage; anything else is no farm. */
export function parseFarmId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function readCurrentFarmId(): number | null {
  try {
    return parseFarmId(tabStorage()?.getItem(CURRENT_FARM_KEY))
  } catch {
    return null
  }
}

/** The farm a farm screen works on. Its route is wrapped in `RequireFarm`, so a missing farm is a wiring error. */
export function requireFarm(farmId: number | null): number {
  if (farmId == null) throw new Error('A farm screen rendered without a farm: wrap its route in RequireFarm.')
  return farmId
}

/** False when the browser refuses to keep it; the caller must not reload into a farm it could not keep. */
export function writeCurrentFarmId(id: number): boolean {
  try {
    const storage = tabStorage()
    if (!storage) return false
    storage.setItem(CURRENT_FARM_KEY, String(id))
    return storage.getItem(CURRENT_FARM_KEY) === String(id)
  } catch {
    return false
  }
}

export function clearCurrentFarmId(): void {
  try {
    tabStorage()?.removeItem(CURRENT_FARM_KEY)
  } catch {
    // Nothing kept, nothing to clear.
  }
}

/**
 * The farm this page load works in: the farm entered on Select Farm in this tab, or null. There is no default farm:
 * farm screens open Select Farm without one (`RequireFarm`) and a farm-scoped request is refused before it is
 * sent (`farmPath`). Read once; entering another farm reloads the page.
 */
export const activeFarmId: number | null = readCurrentFarmId()

/**
 * Router state for Select Farm: `fromSignIn` lets it open the only ACTIVE farm directly (AF4), `returnTo` is the screen
 * that asked for a farm (a link opened in a new tab, a bookmark), loaded again once the farm is entered.
 */
export interface SelectFarmState { fromSignIn?: boolean; returnTo?: string }

/** An in-app path to come back to; another origin (`//host`), a URL or Select Farm itself is ignored. */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value === '/chon-trai' || value.startsWith('/chon-trai?') ? null : value
}

/** Full page load, so every feature API starts again with the farm just kept. Replaced in tests. */
export const pageLoader = {
  load(url: string): void {
    window.location.assign(url)
  },
}
