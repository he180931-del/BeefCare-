import { describe, expect, it, vi } from 'vitest'
import { newFeedCommandKey } from '../../../src/features/feed-stock/api/command'

describe('feed command ownership', () => {
  it('uses the platform UUID generator when available', () => {
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('feed-command-id' as `${string}-${string}-${string}-${string}-${string}`)
    expect(newFeedCommandKey('feed-receipt')).toBe('feed-command-id')
    uuid.mockRestore()
  })

  it('keeps a scoped fallback for runtimes without randomUUID', () => {
    vi.stubGlobal('crypto', {})
    expect(newFeedCommandKey('feed-receipt')).toMatch(/^feed-receipt:\d+:/)
    vi.unstubAllGlobals()
  })
})
