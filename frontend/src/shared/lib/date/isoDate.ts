/** "dd/mm/yyyy" → "yyyy-mm-dd"; an ISO date or another value is returned as is. */
export const isoDate = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}
