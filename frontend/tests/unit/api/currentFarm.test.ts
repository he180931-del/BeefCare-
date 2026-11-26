import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_FARM_KEY, clearCurrentFarmId, readCurrentFarmId, writeCurrentFarmId } from '../../../src/app/session/currentFarm'

describe('current farm of this tab (UC-FE02-02, decision 08/11/2026)', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('keeps the farm entered on Select Farm in this tab only', () => {
    expect(readCurrentFarmId()).toBeNull()
    expect(writeCurrentFarmId(7)).toBe(true)
    expect(sessionStorage.getItem(CURRENT_FARM_KEY)).toBe('7')
    expect(localStorage.getItem(CURRENT_FARM_KEY)).toBeNull()
    expect(readCurrentFarmId()).toBe(7)
    clearCurrentFarmId()
    expect(readCurrentFarmId()).toBeNull()
  })

  it.each(['0', '-3', '1.5', 'abc', ''])('ignores a stored value that is not a farm id (%s)', (raw) => {
    sessionStorage.setItem(CURRENT_FARM_KEY, raw)
    expect(readCurrentFarmId()).toBeNull()
  })

  it('works in the farm entered in this tab and has no default farm (no VITE_BEEFCARE_FARM_ID, no farm 1)', async () => {
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '1')
    vi.resetModules()
    expect((await import('../../../src/app/session/currentFarm')).activeFarmId).toBeNull()
    sessionStorage.setItem(CURRENT_FARM_KEY, '8')
    vi.resetModules()
    expect((await import('../../../src/app/session/currentFarm')).activeFarmId).toBe(8)
    vi.unstubAllEnvs()
  })

  it('reports a blocked storage instead of pretending the farm was kept', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(writeCurrentFarmId(7)).toBe(false)
    expect(readCurrentFarmId()).toBeNull()
  })
})
