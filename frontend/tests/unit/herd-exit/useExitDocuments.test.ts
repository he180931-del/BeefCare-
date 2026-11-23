import { describe, expect, it } from 'vitest'
import { isSupportedExitDocument } from '../../../src/features/herd-exit/hooks/useExitDocuments'

describe('isSupportedExitDocument', () => {
  it('accepts PDF/JPG files up to 10MB', () => {
    expect(isSupportedExitDocument(new File(['pdf'], 'contract.pdf', { type: 'application/pdf' }))).toBe(true)
    expect(isSupportedExitDocument(new File(['jpg'], 'scale.jpg', { type: 'image/jpeg' }))).toBe(true)
  })

  it('rejects unsupported types and oversized files', () => {
    expect(isSupportedExitDocument(new File(['x'], 'note.txt', { type: 'text/plain' }))).toBe(false)
    const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' })
    expect(isSupportedExitDocument(large)).toBe(false)
  })
})
