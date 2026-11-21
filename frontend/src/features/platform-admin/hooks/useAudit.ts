import { useQuery } from '../../../shared/hooks/useQuery'
import { useDemoState } from '../../../demo/demoModules'
import { platformAdminApi } from '../api/platformAdminApi'
import type { AuditFilters } from '../types'

const PAGE_SIZE = 20

export function useAudit({ range, actor, action, targetType, dir, page, detailId, enabled = true }: {
  range: Pick<AuditFilters, 'from' | 'to'>
  actor: string
  action: string
  targetType: AuditFilters['targetType']
  dir: NonNullable<AuditFilters['dir']>
  page: number
  detailId: number | null
  enabled?: boolean
}) {
  const demo = useDemoState()
  const actions = useQuery(() => platformAdminApi.listAuditActions(), [])
  const list = useQuery(
    () => (!enabled
      ? Promise.resolve(null)
      : demo === 'load-error'
      ? Promise.reject(new Error('Không thể tải dữ liệu.'))
      : platformAdminApi.listAudit({ ...range, actor, action, targetType, dir, page, size: PAGE_SIZE })),
    [range.from, range.to, actor, action, targetType, dir, page, demo, enabled],
  )
  const detail = useQuery(
    () => (detailId == null ? Promise.resolve(null) : platformAdminApi.getAuditEntry(detailId)),
    [detailId],
  )

  return { actions, list, detail, defaultRange: platformAdminApi.auditDefaultRange }
}

export function auditDefaultRange() {
  return platformAdminApi.auditDefaultRange()
}

export function useAuditDetail(id: number) {
  return useQuery(() => platformAdminApi.getAuditEntry(id), [id])
}
