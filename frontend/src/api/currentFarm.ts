/**
 * UC-FE02-02: the farm the user entered on Select Farm (SCR-09), kept for this browser tab only.
 *
 * Feature APIs read it once when the page loads (`backendFarmId`), so entering another farm reloads the page; the reload
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

export function readCurrentFarmId(): number | null {
  try {
    const raw = tabStorage()?.getItem(CURRENT_FARM_KEY)
    if (!raw || !/^\d+$/.test(raw)) return null
    const id = Number(raw)
    return Number.isSafeInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
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

/** Full page load, so every feature API starts again with the farm just kept. Replaced in tests. */
export const pageLoader = {
  load(url: string): void {
    window.location.assign(url)
  },
}
