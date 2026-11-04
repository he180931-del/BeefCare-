import { useEffect, useState } from 'react'

export const LOCAL_STRESS_KEY = 'beefcare.preview.large-data.v1'
const LOCAL_STRESS_EVENT = 'beefcare:large-data-change'

export interface LocalStressConfig {
  enabled: boolean
  rowsPerTable: number
  seed: number
}

export type StressGeneratedRow = {
  __stressGenerated?: true
  __stressTable?: string
  __stressIndex?: number
}

const defaultConfig: LocalStressConfig = { enabled: import.meta.env.DEV, rowsPerTable: 100, seed: 49035 }
const cache = new Map<string, object[]>()

export function loadLocalStressConfig(): LocalStressConfig {
  if (typeof window === 'undefined') return defaultConfig
  try {
    const value = JSON.parse(window.localStorage.getItem(LOCAL_STRESS_KEY) || 'null') as Partial<LocalStressConfig> | null
    return {
      enabled: Boolean(value?.enabled),
      rowsPerTable: Math.min(1000, Math.max(50, Math.round(Number(value?.rowsPerTable) || 100))),
      seed: Number.isFinite(Number(value?.seed)) ? Number(value?.seed) : defaultConfig.seed,
    }
  } catch {
    return defaultConfig
  }
}

export function saveLocalStressConfig(value: LocalStressConfig) {
  if (typeof window === 'undefined') return
  const normalized = {
    enabled: value.enabled,
    rowsPerTable: Math.min(1000, Math.max(50, Math.round(value.rowsPerTable || 100))),
    seed: Number.isFinite(value.seed) ? value.seed : defaultConfig.seed,
  }
  window.localStorage.setItem(LOCAL_STRESS_KEY, JSON.stringify(normalized))
  cache.clear()
  window.dispatchEvent(new CustomEvent(LOCAL_STRESS_EVENT, { detail: normalized }))
}

export function useLocalStressConfig() {
  const [config, setConfig] = useState(loadLocalStressConfig)
  useEffect(() => {
    const update = () => setConfig(loadLocalStressConfig())
    window.addEventListener(LOCAL_STRESS_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(LOCAL_STRESS_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return config
}

function hash(value: string, seed: number) {
  let result = seed | 0
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619)
  return Math.abs(result >>> 0)
}

function shiftDate(value: unknown, days: number) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) return value
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  date.setDate(date.getDate() - days)
  return value.includes('T') ? date.toISOString() : date.toISOString().slice(0, 10)
}

function generatedValue(key: string, value: unknown, suffix: string, index: number): unknown {
  if (typeof value === 'string') {
    if (/^(id|code|tag|qr|reference|receiptCode|paymentCode|documentNumber)$/i.test(key)) return `${value.replace(/-L\d+$/, '')}-L${suffix}`
    if (/^(name|subject|title)$/i.test(key)) return `${value.replace(/ · mẫu \d+$/, '')} · mẫu ${index}`
    if (/date|At$|From$|To$/i.test(key)) return shiftDate(value, index % 365)
  }
  return value
}

function cloneGenerated<T extends object>(table: string, template: T, index: number, seed: number): T & StressGeneratedRow {
  const suffix = String(index + 1).padStart(4, '0')
  const copy = typeof structuredClone === 'function' ? structuredClone(template) : JSON.parse(JSON.stringify(template)) as T
  const generated = Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, generatedValue(key, value, suffix, index)])) as T
  return {
    ...generated,
    __stressGenerated: true,
    __stressTable: table,
    __stressIndex: index,
    // Keep the generated order stable but vary templates between tables.
    ...(hash(`${table}:${index}`, seed) % 7 === 0 && 'updatedAt' in generated ? { updatedAt: new Date(Date.UTC(2026, 10, 3) - index * 60_000).toISOString() } : {}),
  }
}

/**
 * Expands a local fixture table deterministically without writing the expanded
 * payload to localStorage. Only the small seed/config is persisted, avoiding
 * browser quota failures while still exercising 100-row tables locally.
 */
export function expandLocalTable<T extends object>(table: string, rows: T[]): Array<T & StressGeneratedRow> {
  const config = loadLocalStressConfig()
  if (!config.enabled || rows.length === 0 || rows.length >= config.rowsPerTable) return rows
  const identity = rows.map((row) => String((row as Record<string, unknown>).id ?? (row as Record<string, unknown>).code ?? '')).join('|')
  const cacheKey = `${table}:${config.rowsPerTable}:${config.seed}:${rows.length}:${hash(identity, config.seed)}`
  const cached = cache.get(cacheKey) as Array<T & StressGeneratedRow> | undefined
  if (cached) return cached
  const generated = [...rows] as Array<T & StressGeneratedRow>
  for (let index = rows.length; index < config.rowsPerTable; index += 1) {
    const templateIndex = hash(`${table}:template:${index}`, config.seed) % rows.length
    generated.push(cloneGenerated(table, rows[templateIndex], index, config.seed))
  }
  cache.set(cacheKey, generated)
  return generated
}

export function stripStressRows<T extends object>(rows: T[]): T[] {
  return rows.filter((row) => !(row as StressGeneratedRow).__stressGenerated)
}

export function isStressGenerated(value: unknown): value is StressGeneratedRow {
  return Boolean(value && typeof value === 'object' && (value as StressGeneratedRow).__stressGenerated)
}
