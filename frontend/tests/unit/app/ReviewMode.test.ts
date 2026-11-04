import { describe, expect, it } from 'vitest'
import { isDevelopmentReviewRoute } from '../../../src/app/reviewMode'

describe('isDevelopmentReviewRoute', () => {
  it('bypasses authentication only for development review URLs', () => {
    expect(isDevelopmentReviewRoute('/ui/scr-77', true)).toBe(true)
    expect(isDevelopmentReviewRoute('/ui/scr-104', true)).toBe(true)
    expect(isDevelopmentReviewRoute('/herd-entry', true)).toBe(false)
    expect(isDevelopmentReviewRoute('/ui/scr-77', false)).toBe(false)
  })
})
