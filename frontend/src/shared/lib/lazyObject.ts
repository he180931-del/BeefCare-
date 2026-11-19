/**
 * An object resolved at first use instead of at import. A module can hand it to a factory while it loads; nothing is
 * read until a property is used, so an adapter that never touches it (the backend one) never resolves it.
 */
export function lazyObject<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const target = resolve()
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
    has: (_target, property) => Reflect.has(resolve(), property),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve(), property)
      return descriptor ? { ...descriptor, configurable: true } : undefined
    },
  })
}
