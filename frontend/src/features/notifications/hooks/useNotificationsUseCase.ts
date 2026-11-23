import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { notificationsApi } from '../api/notificationsApi'
import type { NotificationView } from '../types'

export interface NotificationsUseCaseResult {
  data: { list: NotificationView[]; now: Date } | null
  loading: boolean
  error: unknown
  refetch: () => Promise<{ list: NotificationView[]; now: Date } | undefined>
  markRead: (id: number) => Promise<NotificationView | null>
  markAllRead: () => Promise<void>
}

/** Keeps notification reads and commands out of the route-facing page. */
export function useNotificationsUseCase(): NotificationsUseCaseResult {
  const query = useQuery(async () => ({ list: await notificationsApi.listMine(), now: notificationsApi.now() }), [])

  const markRead = useCallback((id: number) => notificationsApi.markRead(id), [])
  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead()
    await query.refetch()
  }, [query.refetch])

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    markRead,
    markAllRead,
  }
}
