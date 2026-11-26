import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRequestKey } from '../../../src/features/farm-workspace/hooks/useRequestKey'

const storedValues = () => Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.getItem(sessionStorage.key(index) ?? '') ?? '')

describe('useRequestKey (GBR-88, R-02-02)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('reuses the key for the same data, also after a page reload, and issues a new key when the data changes', () => {
    const first = renderHook(() => useRequestKey('farm-registration'))
    const key = first.result.current.keyFor({ name: 'Trại A' })
    expect(key).toMatch(/\S{8,}/)
    expect(first.result.current.keyFor({ name: 'Trại A' })).toBe(key)
    first.unmount()

    const reloaded = renderHook(() => useRequestKey('farm-registration'))
    expect(reloaded.result.current.keyFor({ name: 'Trại A' })).toBe(key)
    const changed = reloaded.result.current.keyFor({ name: 'Trại B' })
    expect(changed).not.toBe(key)
    expect(reloaded.result.current.keyFor({ name: 'Trại B' })).toBe(changed)
  })

  it('starts a new key after a successful submission', () => {
    const { result } = renderHook(() => useRequestKey('farm-registration'))
    const key = result.current.keyFor({ name: 'Trại A' })
    result.current.clear()
    expect(result.current.keyFor({ name: 'Trại A' })).not.toBe(key)
  })

  it('does not keep the entered data itself in session storage', () => {
    const { result } = renderHook(() => useRequestKey('farm-registration'))
    result.current.keyFor({ name: 'Trại A', contactPhone: '0912345678' })
    expect(storedValues().join(' ')).not.toContain('0912345678')
  })

  it('keeps the key in memory when session storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useRequestKey('farm-registration'))
    const key = result.current.keyFor({ name: 'Trại A' })
    expect(result.current.keyFor({ name: 'Trại A' })).toBe(key)
  })
})
