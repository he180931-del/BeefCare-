import { describe, expect, it } from 'vitest'
import { SCREEN_MANIFEST, screenById, screensForRole } from '../../../src/app/screenManifest'

describe('SCREEN_MANIFEST', () => {
  it('covers every SRS screen exactly once', () => {
    expect(SCREEN_MANIFEST).toHaveLength(122)
    const ids = SCREEN_MANIFEST.map((screen) => screen.id)
    expect(new Set(ids).size).toBe(122)
    expect(ids).toEqual(Array.from({ length: 122 }, (_, index) => `SCR-${String(index + 1).padStart(2, '0')}`))
  })

  it('contains complete delivery metadata and resolvable parents', () => {
    const knownIds = new Set(SCREEN_MANIFEST.map((screen) => screen.id))
    for (const screen of SCREEN_MANIFEST) {
      expect(screen.viTitle.trim(), screen.id).not.toBe('')
      expect(screen.feature.trim(), screen.id).not.toBe('')
      expect(screen.roles.length, screen.id).toBeGreaterThan(0)
      expect(['page', 'tab', 'dialog'], screen.id).toContain(screen.kind)
      expect(['public', 'list', 'detail', 'form', 'dashboard', 'report', 'catalogue', 'workbench', 'mobile'], screen.id).toContain(screen.archetype)
      expect(screen.route.startsWith('/'), screen.id).toBe(true)
      expect(['backend', 'fixture', 'hybrid'], screen.id).toContain(screen.dataMode)
      if (screen.parentId) expect(knownIds.has(screen.parentId), `${screen.id} -> ${screen.parentId}`).toBe(true)
    }
  })

  it('provides typed lookup helpers', () => {
    expect(screenById('SCR-34')?.viTitle).toBe('Tạo phiếu nhập mua ngoài')
    expect(screensForRole('technician').some((screen) => screen.id === 'SCR-104')).toBe(true)
    expect(screensForRole('guest').every((screen) => screen.roles.includes('guest'))).toBe(true)
  })
})
