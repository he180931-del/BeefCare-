import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import {
  Button, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, Info, LoadingBlock, Note, PageHeader, Pagination, SearchInput, Table, Td, Th,
} from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { platformAdminApi } from '../api/platformAdminApi'
import { ICON_BUTTON, PersonCell, SaPage, Toast, restPathId, searchWithoutModal } from '../components/common'
import {
  AUDIT_RANGE_HINT, AUDIT_TARGET_TYPES, auditActionLabel, auditChanges, auditRoleLabel, formatPlatformDateTime, targetTypeLabel, validateAuditRange,
} from '../domain/platformRules'
import type { AuditFilters } from '../types'

const PAGE_SIZE = 20
const TITLE = 'Lịch sử audit nền tảng'
/** MSG-COM-03 / MSG-COM-04. */
const LOAD_ERROR = 'Không thể tải dữ liệu.'
const NO_MATCH = 'Không có bản ghi phù hợp.'

/** Chi tiết (A2, D34): hành động, vai trò, mã đối tượng, trước / sau trong danh sách cho phép, mã truy vết sao chép được. */
function AuditDetailCard({ id }: { id: number }) {
  const detail = useQuery(() => platformAdminApi.getAuditEntry(id), [id])
  const [toast, setToast] = useState<string | null>(null)
  if (detail.error != null) return <Card><ErrorBlock message={userFacingError(detail.error, LOAD_ERROR)} onRetry={detail.refetch} /></Card>
  const entry = detail.data
  if (!entry || entry.id !== id) return <Card><LoadingBlock /></Card>
  const changes = auditChanges(entry.before, entry.after)
  const correlationId = entry.correlationId
  const copy = async () => {
    if (!correlationId) return
    try {
      await navigator.clipboard.writeText(correlationId)
      setToast('Đã sao chép mã truy vết.')
    } catch {
      setToast('Không sao chép được mã truy vết. Hãy chọn và sao chép thủ công.')
    }
  }
  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-3.5">
        <div>
          <h2 className="m-0 text-sm font-semibold text-ink">Chi tiết mục audit</h2>
          <p className="m-0 break-all text-[11px] text-muted">{entry.action}</p>
        </div>
        <Info cols={2} items={[
          ['Hành động', auditActionLabel(entry.action)],
          ['Thời điểm', formatPlatformDateTime(entry.time)],
          ['Người thực hiện', entry.actor ? entry.actor.name : 'Hệ thống'],
          ['Vai trò', entry.actor ? auditRoleLabel(entry.actor.role) || '—' : '—'],
          ['Đối tượng', `${targetTypeLabel(entry.targetType)} · ${entry.targetLabel}`],
          ['Mã đối tượng', String(entry.targetId)],
          ['Trang trại', entry.farm?.name ?? '—'],
        ]} />
        {changes.length > 0 ? (
          <Table stack={false}>
            <thead><tr><Th>Trường</Th><Th>Trước</Th><Th>Sau</Th></tr></thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.field}><Td className="font-medium">{c.label}</Td><Td className="break-words">{c.before}</Td><Td className="break-words">{c.after}</Td></tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="m-0 text-xs text-muted">Không có giá trị trước / sau được phép hiển thị.</p>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Mã truy vết:</span>
          <code className="min-w-0 break-all text-ink">{correlationId ?? '—'}</code>
          {correlationId && (
            <Button className={ICON_BUTTON} onClick={copy} aria-label="Sao chép mã truy vết">
              <Icon name="clipboard-list" size={14} />
              Sao chép
            </Button>
          )}
        </div>
        <Note>Chỉ hiện giá trị được phép (GBR-86): không có lý do, dữ liệu bò và chăm sóc, nội dung ticket, chứng từ ngân hàng hay giá trị bí mật.</Note>
      </div>
      <Toast message={toast} onClose={() => setToast(null)} />
    </Card>
  )
}

function AuditContent() {
  const demo = useDemoState()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const selectedId = restPathId(useParams()['*'])
  const [range, setRange] = useState(() => platformAdminApi.auditDefaultRange())
  const [actorInput, setActorInput] = useState('')
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState<NonNullable<AuditFilters['targetType']>>('')
  const [dir, setDir] = useState<NonNullable<AuditFilters['dir']>>('desc')
  const [page, setPage] = useState(1)

  // Ô tìm người thực hiện: chờ người dùng gõ xong rồi mới gọi A1.
  useEffect(() => {
    const next = actorInput.trim()
    if (next === actor) return undefined
    const timer = setTimeout(() => { setActor(next); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [actorInput, actor])

  const rangeError = validateAuditRange(range)
  const actions = useQuery(() => platformAdminApi.listAuditActions(), [])
  const { data, loading, error, refetch } = useQuery(
    () => {
      if (demo === 'load-error') return Promise.reject(new Error(LOAD_ERROR))
      if (rangeError) return Promise.resolve(null)
      return platformAdminApi.listAudit({ ...range, actor, action, targetType, dir, page, size: PAGE_SIZE })
    },
    [range.from, range.to, actor, action, targetType, dir, page, demo, rangeError],
  )

  const filterChange = (apply: () => void) => { apply(); setPage(1) }
  const clearFilters = () => {
    setRange(platformAdminApi.auditDefaultRange())
    setActorInput('')
    setActor('')
    setAction('')
    setTargetType('')
    setPage(1)
  }
  const select = (id: number) => navigate({ pathname: `/nen-tang/audit/${id}`, search: searchWithoutModal(params) })
  const rows = data?.content ?? []
  const detailId = selectedId ?? rows[0]?.id ?? null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={TITLE} sub="Tìm và mở các thay đổi quan trọng của nền tảng (GBR-86). Dữ liệu bò, chăm sóc, nội dung ticket, chứng từ ngân hàng và giá trị bí mật không bao giờ hiển thị." />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Khoảng thời gian <span aria-hidden className="text-err-fg">*</span></span>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
            <label htmlFor="audit-from" className="sr-only">Từ ngày</label>
            <DateInput id="audit-from" value={range.from} onChange={(v) => filterChange(() => setRange((r) => ({ ...r, from: v })))} />
            <span aria-hidden>–</span>
            <label htmlFor="audit-to" className="sr-only">Đến ngày</label>
            <DateInput id="audit-to" value={range.to} onChange={(v) => filterChange(() => setRange((r) => ({ ...r, to: v })))} />
          </div>
          <span className="text-[11px] text-muted">{AUDIT_RANGE_HINT}</span>
        </div>
        <SearchInput
          className="w-[240px] max-w-full"
          value={actorInput}
          maxLength={254}
          placeholder="Tên, email hoặc “Hệ thống”"
          aria-label="Tìm người thực hiện"
          onChange={(e) => setActorInput(e.target.value)}
        />
        <FilterSelect className="w-[230px] max-w-full" aria-label="Lọc theo hành động" value={action} onChange={(e) => filterChange(() => setAction(e.target.value))}>
          <option value="">Hành động: Tất cả</option>
          {actions.data?.map((a) => <option key={a.code} value={a.code}>Hành động: {auditActionLabel(a.code)}</option>)}
        </FilterSelect>
        <FilterSelect className="w-[210px] max-w-full" aria-label="Lọc theo loại đối tượng" value={targetType} onChange={(e) => filterChange(() => setTargetType(e.target.value as typeof targetType))}>
          <option value="">Loại đối tượng: Tất cả</option>
          {AUDIT_TARGET_TYPES.map((t) => <option key={t.value} value={t.value}>Loại đối tượng: {t.label}</option>)}
        </FilterSelect>
      </div>
      {rangeError && <p role="alert" className="m-0 text-xs text-err-fg">{rangeError}</p>}

      {loading && !data && !rangeError && error == null && <LoadingBlock />}
      {error != null && <ErrorBlock message={userFacingError(error, LOAD_ERROR)} onRetry={refetch} />}
      {data && error == null && rows.length === 0 && !selectedId && (
        <EmptyBlock title={NO_MATCH} action={<Button onClick={clearFilters}>Xóa bộ lọc</Button>} />
      )}
      {data && error == null && (rows.length > 0 || selectedId) && (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_376px]">
          {rows.length > 0 ? (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th aria-sort={dir === 'asc' ? 'ascending' : 'descending'}>
                      <button type="button" className="inline-flex cursor-pointer items-center gap-1" onClick={() => filterChange(() => setDir(dir === 'asc' ? 'desc' : 'asc'))}>
                        Thời gian <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>
                      </button>
                    </Th>
                    <Th>Người thực hiện</Th><Th>Hành động</Th><Th>Đối tượng</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const active = e.id === detailId
                    return (
                      <tr key={e.id} onClick={() => select(e.id)} className={`cursor-pointer ${active ? 'bg-[#eef4ef]' : ''}`}>
                        <Td className="whitespace-nowrap font-medium">
                          <button type="button" aria-current={active ? 'true' : undefined} onClick={(ev) => { ev.stopPropagation(); select(e.id) }} className="text-left">{formatPlatformDateTime(e.time)}</button>
                        </Td>
                        <Td><PersonCell name={e.actor?.name ?? 'Hệ thống'} sub={e.actor ? auditRoleLabel(e.actor.role) || undefined : undefined} system={!e.actor} /></Td>
                        <Td>
                          <div className="text-xs font-medium text-ink">{auditActionLabel(e.action)}</div>
                          <div className="break-all text-[11px] text-muted">{e.action}</div>
                        </Td>
                        <Td><span className="block max-w-[220px] truncate">{targetTypeLabel(e.targetType)} · {e.targetLabel}</span></Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
              <Pagination page={page} pageCount={data.totalPages} onChange={setPage} summary={`${data.totalElements} mục trong khoảng đã chọn`} />
            </Card>
          ) : (
            <EmptyBlock title={NO_MATCH} action={<Button onClick={clearFilters}>Xóa bộ lọc</Button>} />
          )}
          {detailId != null && <AuditDetailCard id={detailId} />}
        </div>
      )}
      <Foot>Lịch sử audit nền tảng (chỉ System Admin). Mỗi dòng là một thay đổi đã lưu; chọn dòng để xem giá trị trước / sau và mã truy vết. Không có thao tác sửa hay xóa.</Foot>
    </div>
  )
}

export default function AuditPage() {
  return <SaPage title={TITLE}><AuditContent /></SaPage>
}
