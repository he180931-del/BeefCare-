import { describe, expect, it } from 'vitest'
import { routeForScreen, screenOwner } from '../../../src/app/ScreenRouter'
import { SCREEN_MANIFEST } from '../../../src/app/screenManifest'

describe('screen reachability', () => {
  it('resolves every SRS screen to a page or owning surface', () => {
    for (const screen of SCREEN_MANIFEST) {
      expect(routeForScreen(screen), screen.id).toMatch(/^\//)
      expect(screenOwner(screen), screen.id).toBeTruthy()
    }
  })

  it('preserves backend-connected routes', () => {
    expect(SCREEN_MANIFEST.find((screen) => screen.id === 'SCR-22')?.route).toBe('/pens')
    expect(SCREEN_MANIFEST.find((screen) => screen.id === 'SCR-26')?.route).toBe('/cattle')
    expect(SCREEN_MANIFEST.find((screen) => screen.id === 'SCR-33')?.route).toBe('/herd-entry')
    expect(SCREEN_MANIFEST.find((screen) => screen.id === 'SCR-69')?.route).toBe('/herd-exit')
  })
})
