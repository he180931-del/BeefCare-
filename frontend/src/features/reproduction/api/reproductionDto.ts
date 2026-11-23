import { asRecord, asRows } from '../../../shared/api/parse'

/** Raw response envelopes owned by the FE-11/FE-12 backend adapter. */
export type ReproductionWorklistDto = { items?: unknown[] }
export type ReproductionProfileDto = Record<string, unknown>
export type ReproductionHealthCasesDto = { openCases?: unknown[]; previousCases?: unknown[] }
export type ReproductionCatalogueDto = unknown[] | { items?: unknown[]; members?: unknown[]; pens?: unknown[] }

/** Request DTOs sent by the reproduction facade. Keeping these here prevents transport payloads becoming screen models. */
export type ReproductionCommandDto = Record<string, unknown>
export type ReproductionCorrectionDto = Record<string, unknown>
export type ReproductionVoidDto = { expectedVersion: number | null; reason: string }

export const SIGN_CODE: Record<string, string> = {
  'Đứng yên cho nhảy': 'STANDING', 'Nhảy lên con khác': 'MOUNTING', 'Kêu rống': 'BELLOWING', 'Chảy dịch nhờn trong': 'MUCUS', 'Âm hộ sưng đỏ': 'SWOLLEN_VULVA',
}
export const METHOD_OUT: Record<string, string> = { NATURAL_SERVICE: 'NATURAL', ARTIFICIAL_INSEMINATION: 'AI' }
export const ROLE_TEXT: Record<string, string> = { OWNER: 'Chủ trại', MANAGER: 'Quản lý', TECHNICIAN: 'Kỹ thuật viên' }

export const rowsOf = (body: unknown, ...keys: string[]): Record<string, unknown>[] => {
  if (Array.isArray(body)) return asRows(body)
  const record = asRecord(body)
  for (const key of keys) if (Array.isArray(record[key])) return asRows(record[key])
  return []
}

export const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value))
  const value = search.toString()
  return value ? `?${value}` : ''
}
