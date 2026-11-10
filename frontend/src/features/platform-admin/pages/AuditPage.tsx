import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { Button, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, Info, LoadingBlock, Note, PageHeader, Pagination, Table, Td, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { platformAdminApi } from '../api/platformAdminApi'
import { ICON_BUTTON, PersonCell, SaPage, Toast, downloadTextFile, errorMessage, restPathId, searchWithoutModal } from '../components/common'
import {
  AUDIT_ACTIONS, AUDIT_TARGET_TYPES, auditActionLabel, formatDateTime, formatShortDateTime, targetTypeLabel, validateAuditRange,
} from '../domain/platformRules'
import type { AuditEntry, AuditFilters } from '../types'

const PAGE_SIZE = 50
const TITLE = 'Lịch sử kiểm toán nền tảng'

function AuditDetail({ entry }: { entry: AuditEntry }) {
  const { details } = entry
  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-3.5">
        <div>
          <h2 className="m-0 text-sm font-semibold text-ink">Chi tiết sự kiện</h2>
          <p className="m-0 text-[11px] text-muted">{entry.action}</p>
        </div>
        <Info cols={2} items={[
          ['Hành động', `${auditActionLabel(entry.action)}${details.scope ? ` · ${details.scope}` : ''}`],
          ['Thời điểm', formatDateTime(entry.loggedAt)],
          ['Người thực hiện', entry.actorName ? `${entry.actorName} · ${entry.actorRole ?? ''}` : 'Hệ thống'],
          ['Đối tượng', `${targetTypeLabel(entry.targetType)} ${entry.targetRef}`],
          ['Mã truy vết', details.correlationId || '—'],
        ]} />
        <Table stack={false}>
          <thead><tr><Th className="w-16"><span className="sr-only">Mốc</span></Th><Th>Giá trị</Th></tr></thead>
          <tbody>
            <tr><Td className="font-medium">Trước</Td><Td>{details.before || '—'}</Td></tr>
            <tr><Td className="font-medium">Sau</Td><Td>{details.after || '—'}</Td></tr>
          </tbody>
        </Table>
        <Note>Dòng thời gian của bò và lịch sử nghiệp vụ trại nằm trong từng tính năng của trại – không truy cập qua audit nền tảng.</Note>
      </div>
    </Card>
  )
}

function AuditContent() {
  const demo = useDemoState()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const selectedId = restPathId(useParams()['*'])
  const [range, setRange] = useState(() => platformAdminApi.auditDefaultRange())
  const [actorId, setActorId] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState<NonNullable<AuditFilters['targetType']>>('')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  const rangeError = validateAuditRange(range)
  const filters: AuditFilters = { ...range, actorId, action, targetType }
  const actors = useQuery(() => platformAdminApi.listAuditActors(), [])
  const { data, loading, error, refetch } = useQuery(
    () => {
      if (demo === 'load-error') return Promise.reject(new Error('Không tải được lịch sử kiểm toán.'))
      if (rangeError) return Promise.resolve(null)
      return platformAdminApi.listAudit({ ...filters, page, size: PAGE_SIZE })
    },
    [range.from, range.to, actorId, action, targetType, page, demo, rangeError],
  )

  const filterChange = (apply: () => void) => { apply(); setPage(1) }
  const select = (id: number) => navigate({ pathname: `/nen-tang/audit/${id}`, search: searchWithoutModal(params) })
  const selected = data ? (data.content.find((e) => e.id === selectedId) ?? data.content[0]) : undefined

  const exportCsv = async () => {
    if (rangeError) return
    try {
      const csv = await platformAdminApi.exportAuditCsv(filters)
      downloadTextFile('audit-nen-tang.csv', csv)
      setToast(`Đã xuất ${Math.max(0, csv.split('\r\n').length - 1)} sự kiện theo bộ lọc đang xem.`)
    } catch (e) {
      setToast(errorMessage(e, 'Không xuất được CSV.'))
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={TITLE} sub="Chỉ siêu dữ liệu kiểm toán được phép xem – không hiển thị dữ liệu chăm sóc bò, nội dung yêu cầu hỗ trợ riêng tư hay chứng từ tài chính">
        <Button className={ICON_BUTTON} onClick={exportCsv} disabled={!!rangeError}>
          <Icon name="table-export" size={16} />
          Xuất CSV
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-ink">
          <span>Thời gian:</span>
          <label htmlFor="audit-from" className="sr-only">Từ ngày</label>
          <DateInput id="audit-from" value={range.from} onChange={(v) => filterChange(() => setRange((r) => ({ ...r, from: v })))} />
          <span aria-hidden>–</span>
          <label htmlFor="audit-to" className="sr-only">Đến ngày</label>
          <DateInput id="audit-to" value={range.to} onChange={(v) => filterChange(() => setRange((r) => ({ ...r, to: v })))} />
        </div>
        <FilterSelect className="w-[220px] max-w-full" aria-label="Lọc theo người thực hiện" value={actorId} onChange={(e) => filterChange(() => setActorId(e.target.value))}>
          <option value="">Người thực hiện: Tất cả</option>
          {actors.data?.map((a) => <option key={a.value} value={a.value}>Người thực hiện: {a.label}</option>)}
        </FilterSelect>
        <FilterSelect className="w-[210px] max-w-full" aria-label="Lọc theo hành động" value={action} onChange={(e) => filterChange(() => setAction(e.target.value))}>
          <option value="">Hành động: Tất cả</option>
          {AUDIT_ACTIONS.map((a) => <option key={a.code} value={a.code}>Hành động: {a.label}</option>)}
        </FilterSelect>
        <FilterSelect className="w-[200px] max-w-full" aria-label="Lọc theo đối tượng" value={targetType} onChange={(e) => filterChange(() => setTargetType(e.target.value as typeof targetType))}>
          <option value="">Đối tượng: Tất cả</option>
          {AUDIT_TARGET_TYPES.map((t) => <option key={t.value} value={t.value}>Đối tượng: {t.label}</option>)}
        </FilterSelect>
      </div>
      {rangeError && <p role="alert" className="m-0 text-xs text-err-fg">{rangeError}</p>}

      {loading && !data && !rangeError && <LoadingBlock />}
      {error != null && <ErrorBlock message={userFacingError(error, 'Không tải được lịch sử kiểm toán.')} onRetry={refetch} />}
      {data && !error && data.content.length === 0 && <EmptyBlock title="Không có sự kiện nào trong khoảng đã chọn" sub="Mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc." />}
      {data && !error && selected && (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_376px]">
          <Card>
            <Table>
              <thead>
                <tr><Th>Thời điểm</Th><Th>Người thực hiện</Th><Th>Hành động</Th><Th>Đối tượng</Th></tr>
              </thead>
              <tbody>
                {data.content.map((e) => {
                  const active = e.id === selected.id
                  return (
                    <tr key={e.id} onClick={() => select(e.id)} className={`cursor-pointer ${active ? 'bg-[#eef4ef]' : ''}`}>
                      <Td className="whitespace-nowrap font-medium">
                        <button type="button" aria-current={active ? 'true' : undefined} onClick={(ev) => { ev.stopPropagation(); select(e.id) }} className="text-left">{formatShortDateTime(e.loggedAt)}</button>
                      </Td>
                      <Td><PersonCell name={e.actorName ?? 'Hệ thống'} sub={e.actorName ? (e.actorRole ?? undefined) : undefined} system={!e.actorName} /></Td>
                      <Td>
                        <div className="text-xs font-medium text-ink">{auditActionLabel(e.action)}</div>
                        <div className="text-[11px] text-muted">{e.action}</div>
                      </Td>
                      <Td><span className="block max-w-[200px] truncate">{targetTypeLabel(e.targetType)} · {e.targetLabel}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={data.totalPages} onChange={setPage} summary={`${data.totalElements} sự kiện trong khoảng đã chọn`} />
          </Card>
          <AuditDetail entry={selected} />
        </div>
      )}
      <Foot>Lịch sử kiểm toán nền tảng (quản trị hệ thống). Mỗi dòng là một sự kiện kèm tên dễ đọc và mã hành động; chọn dòng để xem giá trị trước/sau và mã truy vết. Xuất CSV theo bộ lọc đang xem.</Foot>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default function AuditPage() {
  return <SaPage title={TITLE}><AuditContent /></SaPage>
}
