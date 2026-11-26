import { userFacingError } from '../../../shared/api/userFacingError'

export function catalogueError(error: unknown, fallback: string): string {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; params?: Record<string, unknown> } : {}
  if (value.code === 'MSG-FE18-08') {
    const field = String(value.params?.field ?? 'trường này').replace(/([a-z])([A-Z])/g, '$1 $2')
    return `${field} không nằm trong danh mục đang hoạt động.`
  }
  return userFacingError(error, fallback)
}
