import { describe, expect, it, vi } from 'vitest'
import { lazyObject } from '../../../src/shared/lib/lazyObject'

const makeStore = () => ({
  items: ['a'],
  list() { return this.items },
})

describe('lazyObject', () => {
  it('resolves only when a property is used', () => {
    const resolve = vi.fn(makeStore)
    const store = lazyObject(resolve)
    expect(resolve).not.toHaveBeenCalled()
    expect(store.list()).toEqual(['a'])
    expect(resolve).toHaveBeenCalled()
  })

  it('writes, defines and deletes on the real object, so later reads see them', () => {
    const real = makeStore()
    const store = lazyObject(() => real)
    store.items = ['b']
    expect(real.items).toEqual(['b'])
    expect(store.list()).toEqual(['b'])
    Object.defineProperty(store, 'extra', { value: 1, configurable: true, enumerable: true, writable: true })
    expect((real as Record<string, unknown>).extra).toBe(1)
    delete (store as Record<string, unknown>).extra
    expect('extra' in real).toBe(false)
  })

  it('lets a spy replace a method and sees the calls', () => {
    const real = makeStore()
    const store = lazyObject(() => real)
    const spy = vi.spyOn(store, 'list').mockReturnValue(['spied'])
    expect(store.list()).toEqual(['spied'])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('returns the same bound method on every access', () => {
    const real = makeStore()
    const store = lazyObject(() => real)
    expect(store.list).toBe(store.list)
  })
})

describe('lazyObject invariants', () => {
  it('refuses a non-configurable definition before the real object changes', () => {
    const real: Record<string, unknown> = {}
    const store = lazyObject(() => real)
    expect(() => Object.defineProperty(store, 'flag', { value: true, configurable: false })).toThrow(TypeError)
    expect('flag' in real).toBe(false)
    Object.defineProperty(store, 'other', { value: 1, configurable: true, writable: true, enumerable: true })
    expect(real.other).toBe(1)
  })

  it('reports the prototype of the real object and cannot be frozen', () => {
    class Store { size() { return 1 } }
    const store = lazyObject(() => new Store())
    expect(store instanceof Store).toBe(true)
    expect(() => Object.freeze(store)).toThrow(TypeError)
    expect(store.size()).toBe(1)
  })
})
