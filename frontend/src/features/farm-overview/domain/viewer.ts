import type { ViewerRole } from '../types'

/** Vai trò trong trại; không có phiên (test từng trang) thì coi là Chủ trại. */
export const viewerRole = (role?: string): ViewerRole => (role === 'MANAGER' ? 'MANAGER' : role === 'TECHNICIAN' ? 'TECHNICIAN' : 'OWNER')

export const SERVICE_TONE = 'ok' as const
