export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  constructor(initial: Record<string, string> = {}) { Object.entries(initial).forEach(([key, value]) => this.values.set(key, value)) }
  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, String(value)) }
}
