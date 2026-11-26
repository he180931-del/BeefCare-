/** Shape failures are boundary errors: transport responses must not leak into screen models. */
export const failShape = (field: string): never => {
  throw new Error(`Dữ liệu máy chủ không hợp lệ: thiếu ${field}.`)
}

export const requiredString = (row: Record<string, unknown>, key: string): string =>
  typeof row[key] === 'string' ? row[key] as string : failShape(key)

export const requiredNumber = (row: Record<string, unknown>, key: string): number =>
  typeof row[key] === 'number' && Number.isFinite(row[key]) ? row[key] as number : failShape(key)

export const requiredRows = (value: unknown, field: string): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return failShape(field)
    return item as Record<string, unknown>
  }) : failShape(field)
