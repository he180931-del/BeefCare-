/** Primitive readers for untyped backend JSON. Business enums and envelopes belong to the feature mappers. */
export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}

export const asRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(asRecord) : []

export const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

export const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export const nullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
