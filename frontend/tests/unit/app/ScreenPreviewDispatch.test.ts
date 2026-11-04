import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { previewKindFor } from '../../../src/features/ui-preview/pages/ScreenPreviewPage'

describe('previewKindFor', () => {
  it('keeps each preview owned by its feature archetype', () => {
    expect(previewKindFor(screenById('SCR-03')!, 'owner')).toBe('account')
    expect(previewKindFor(screenById('SCR-55')!, 'owner')).toBe('form')
    expect(previewKindFor(screenById('SCR-79')!, 'owner')).toBe('record')
    expect(previewKindFor(screenById('SCR-77')!, 'owner')).toBe('insight')
    expect(previewKindFor(screenById('SCR-91')!, 'pm')).toBe('platform')
    expect(previewKindFor(screenById('SCR-104')!, 'technician')).toBe('technician')
    expect(previewKindFor(screenById('SCR-46')!, 'owner')).toBe('operations')
  })
})
