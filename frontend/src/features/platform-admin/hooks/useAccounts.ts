import { useMemo } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { useDemoState } from '../../../demo/demoModules'
import { platformAdminApi } from '../api/platformAdminApi'
import type { AccountDetail, AccountFilters } from '../types'

const PAGE_SIZE = 20

export function useAccounts({ filters, page, selectedId }: {
  filters: AccountFilters
  page: number
  selectedId: number | null
}) {
  const demo = useDemoState()
  const list = useQuery(
    () => (demo === 'load-error'
      ? Promise.reject(new Error('Không tải được danh sách tài khoản.'))
      : platformAdminApi.listAccounts({ ...filters, page, size: PAGE_SIZE })),
    [filters.q, filters.status, filters.platformRole, filters.dir, page, demo],
  )
  const rows = useMemo(() => list.data?.content ?? [], [list.data])
  const detailId = selectedId ?? rows[0]?.id ?? null
  const detail = useQuery<AccountDetail | null>(
    () => (detailId == null ? Promise.resolve(null) : platformAdminApi.getAccount(detailId)),
    [detailId],
  )

  const refresh = () => {
    void list.refetch()
    if (detailId != null) void detail.refetch()
  }

  return { list, rows, detail, detailId, refresh }
}
