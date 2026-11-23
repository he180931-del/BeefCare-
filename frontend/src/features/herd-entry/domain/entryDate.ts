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

/** Format stored ISO values for the history declaration date editor. */
export const displayHistoryDate = (value: unknown): string => {
  const date = textValue(value).trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (iso && validEntryDate(date)) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const month = /^(\d{4})-(\d{2})$/.exec(date)
  return month ? `${month[2]}/${month[1]}` : date
}

/** Convert accepted DD/MM/YYYY or MM/YYYY (and legacy ISO) into ISO LocalDate. */
export const parseHistoryDate = (value: string): string | null => {
  const date = value.trim()
  if (!date) return null
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date)
  if (dmy) { const iso = `${dmy[3]}-${dmy[2]}-${dmy[1]}`; return validEntryDate(iso) ? iso : null }
  const month = /^(\d{2})\/(\d{4})$/.exec(date)
  if (month) { const iso = `${month[2]}-${month[1]}-01`; return validEntryDate(iso) ? iso : null }
  if (/^\d{4}-\d{2}$/.test(date)) { const iso = `${date}-01`; return validEntryDate(iso) ? iso : null }
  return validEntryDate(date) ? date : null
}
