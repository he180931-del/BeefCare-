/**
 * An object resolved at first use instead of at import. A module can hand it to a factory while it loads; nothing is
 * read until a property is used, so an adapter that never touches it (the backend one) never resolves it. Reads, writes,
 * definitions (a test spy) and deletions all reach the real object; a method is bound once per object and function.
 * The proxy's own target is an empty stand-in, so through the proxy every property stays configurable: a
 * non-configurable definition, freezing or sealing is refused before the real object changes.
 */
export function lazyObject<T extends object>(resolve: () => T): T {
  const bound = new WeakMap<object, WeakMap<(...args: never[]) => unknown, unknown>>()
  const bindOnce = (target: object, fn: (...args: never[]) => unknown) => {
    let methods = bound.get(target)
    if (!methods) { methods = new WeakMap(); bound.set(target, methods) }
    let method = methods.get(fn)
    if (!method) { method = fn.bind(target); methods.set(fn, method) }
    return method
  }
  return new Proxy({} as T, {
    get(_target, property) {
      const target = resolve()
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? bindOnce(target, value as (...args: never[]) => unknown) : value
    },
    set: (_target, property, value) => Reflect.set(resolve(), property, value),
    defineProperty: (_target, property, descriptor) => descriptor.configurable !== false && Reflect.defineProperty(resolve(), property, descriptor),
    deleteProperty: (_target, property) => Reflect.deleteProperty(resolve(), property),
    has: (_target, property) => Reflect.has(resolve(), property),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getPrototypeOf: () => Reflect.getPrototypeOf(resolve()),
    preventExtensions: () => false,
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve(), property)
      return descriptor ? { ...descriptor, configurable: true } : undefined
    },
  })
}
