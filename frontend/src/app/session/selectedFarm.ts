/** Per-device convenience state only. The backend still authorizes every farm request. */
export const SELECTED_FARM_STORAGE_KEY = 'beefcare:selected-farm-id'
export const SELECTED_FARM_CHANGED_EVENT = 'beefcare:selected-farm-changed'

function notifySelectionChanged(): void {
  window.dispatchEvent(new Event(SELECTED_FARM_CHANGED_EVENT))
}

export function selectedFarmId(): number | null {
  const value = Number(localStorage.getItem(SELECTED_FARM_STORAGE_KEY))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export function selectFarmOnDevice(farmId: number): void {
  if (!Number.isSafeInteger(farmId) || farmId <= 0) return
  localStorage.setItem(SELECTED_FARM_STORAGE_KEY, String(farmId))
  notifySelectionChanged()
}

export function clearSelectedFarmOnDevice(): void {
  localStorage.removeItem(SELECTED_FARM_STORAGE_KEY)
  notifySelectionChanged()
}
