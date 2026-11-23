import { textValue } from '../../../shared/api/parse'

/** A month-only declaration is stored on the first day, for both drafts and posted corrections. */
export const fullDate = (value: unknown): string | null => {
  const date = textValue(value).trim()
  const month = /^(\d{2})\/(\d{4})$/.exec(date)
  if (month) return `${month[2]}-${month[1]}-01`
  return /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date || null
}
export const validEntryDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
