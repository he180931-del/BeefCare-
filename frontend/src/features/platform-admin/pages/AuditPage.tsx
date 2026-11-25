import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import { Button, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, Icon, Info, LoadingBlock, PageHeader, Pagination, SearchInput, SearchSelect, Table, Td, Th } from '../../../shared/ui'
import { auditDefaultRange, useAudit, useAuditDetail } from '../hooks/useAudit'
import { ICON_BUTTON, PersonCell, SaPage, Toast, restPathId, searchWithoutModal, wideScreen } from '../components/common'
import { AUDIT_RANGE_HINT, AUDIT_TARGET_TYPES, auditActionLabel, auditChanges, auditRoleLabel, formatPlatformDateTime, targetTypeLabel } from '../domain/platformRules'
import { validateAuditRange } from '../validation/platformValidation'
import type { AuditFilters } from '../types'

const TITLE = 'Lịch sử audit nền tảng'
const PAGE_SIZE = 20
const LABEL_CLS = 'text-xs font-medium text-ink'
/** Red border on both date boxes while the range is invalid (the message below has role="alert"). */
const DATE_INVALID_CLS = '[&>div]:border-err-fg'
/**
 * Below 560 px of list width the table keeps only the time sort in its header and every row becomes a two-column card
 * (action + time, then actor, then target) instead of the generic label / value stack, so 1366 px laptops with the detail
 * panel still get a real table and phones get readable rows.
 */
const LIST_CLS = '@container @max-[560px]:[&_table]:block @max-[560px]:[&_thead]:block @max-[560px]:[&_thead_tr]:flex '
  + '@max-[560px]:[&_thead_th]:w-full @max-[560px]:[&_thead_th:not(:first-child)]:hidden @max-[560px]:[&_tbody]:block'
const ROW_CLS = '@max-[560px]:grid @max-[560px]:grid-cols-[minmax(0,1fr)_auto] @max-[560px]:gap-x-3 @max-[560px]:gap-y-1.5 '
  + '@max-[560px]:border-b @max-[560px]:border-rule @max-[560px]:px-3 @max-[560px]:py-3 @max-[560px]:last:border-b-0'
// `!`: Td's own first:pl-3 / last:pr-3 / border-b are more specific than a container-query utility.
const CELL_CLS = '@max-[560px]:border-0! @max-[560px]:p-0!'
/** MSG-COM-03 / MSG-COM-04. */
const LOAD_ERROR = 'Không thể tải dữ liệu.'
const NO_MATCH = 'Không có bản ghi phù hợp.'

/** An action code may wrap only after its underscores (FARM_SERVICE_<wbr>STATUS_<wbr>CHANGED), never mid-word; text is unchanged. */
function ActionCode({ code }: { code: string }) {
  return <>{code.split('_').map((part, i) => <Fragment key={i}>{i > 0 && <>_<wbr /></>}{part}</Fragment>)}</>
}

/** Chi tiết (A2, D34): hành động, vai trò, mã đối tượng, trước / sau trong danh sách cho phép, mã truy vết sao chép được. */
function AuditDetailCard({ id, reveal }: { id: number; reveal: boolean }) {
  const detail = useAuditDetail(id)
  const [toast, setToast] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const shownId = detail.data?.id ?? null
  // Below xl the detail sits under the list. Scroll only once the entry is loaded: while it is still a short loading card
  // the page is not tall enough and the panel would stop half way down the screen.
  useEffect(() => {
    if (reveal && shownId === id && !wideScreen()) box.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [reveal, shownId, id])
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
      <div ref={box} className="flex min-w-0 scroll-mt-4 flex-col gap-3.5">
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
      </div>
      <Toast message={toast} onClose={() => setToast(null)} />
    </Card>
  )
}

function AuditContent() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const selectedId = restPathId(useParams()['*'])
  const [range, setRange] = useState(() => auditDefaultRange())
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
  const audit = useAudit({ range, actor, action, targetType, dir, page, detailId: null, enabled: !rangeError })
  const { actions, list } = audit
  const { data, loading, error, refetch } = list

  const filterChange = (apply: () => void) => { apply(); setPage(1) }
  const clearFilters = () => {
    setRange(auditDefaultRange())
    setActorInput('')
    setActor('')
    setAction('')
    setTargetType('')
    setPage(1)
  }
  const select = (id: number) => navigate({ pathname: `/nen-tang/audit/${id}`, search: searchWithoutModal(params) })
  const rows = data?.content ?? []
  const detailId = selectedId ?? rows[0]?.id ?? null
  // Filter / page / sort reloads keep the previous rows on screen: dim them and mark the list busy until the answer arrives.
  const reloading = loading && data != null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* GBR-86 / R-17-04 is enforced by the allowlist; the page states it once, without the internal rule code. */}
      <PageHeader title={TITLE} sub="Tìm và xem các thay đổi quan trọng của nền tảng. Lý do, dữ liệu bò và chăm sóc, nội dung ticket, chứng từ ngân hàng và giá trị bí mật không bao giờ được hiển thị." />
      {/* Every filter has a label on the same line so the controls share one baseline at every width. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,280px)_minmax(0,250px)_minmax(0,200px)]">
        <div className="flex min-w-0 flex-col gap-1 sm:col-span-3 xl:col-span-1">
          <span className={LABEL_CLS}>
            Khoảng thời gian <span aria-hidden className="text-err-fg">*</span>
            <span aria-hidden className="mx-1.5 font-normal text-faint">·</span>
            <span className="text-[11px] font-normal text-muted">{AUDIT_RANGE_HINT}</span>
          </span>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm text-ink xl:flex">
            {/* `label` names the hidden date input itself (its default aria-label "Chọn ngày" would hide a <label>). */}
            <DateInput id="audit-from" label="Từ ngày" className={`min-w-0 xl:w-[164px] ${rangeError ? DATE_INVALID_CLS : ''}`} value={range.from} onChange={(v) => filterChange(() => setRange((r) => ({ ...r, from: v })))} />
            <span aria-hidden className="text-muted">–</span>
            <DateInput id="audit-to" label="Đến ngày" className={`min-w-0 xl:w-[164px] ${rangeError ? DATE_INVALID_CLS : ''}`} value={range.to} onChange={(v) => filterChange(() => setRange((r) => ({ ...r, to: v })))} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="audit-actor" className={LABEL_CLS}>Người thực hiện</label>
          <SearchInput
            id="audit-actor"
            className="w-full"
            value={actorInput}
            maxLength={254}
            placeholder="Tên, email hoặc “Hệ thống”"
            aria-label="Tìm người thực hiện"
            onChange={(e) => setActorInput(e.target.value)}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="audit-action" className={LABEL_CLS}>Hành động</label>
          {/* ~30 codes (A3): type to narrow by label or code, accents optional. Only the label is shown; the table keeps label + code (SCR-51 #7). */}
          <SearchSelect
            id="audit-action"
            aria-label="Lọc theo hành động"
            options={(actions.data ?? []).map((a) => ({ value: a.code, label: auditActionLabel(a.code), keywords: a.code }))}
            value={action}
            onChange={(next) => filterChange(() => setAction(next))}
            placeholder="gõ để tìm"
            emptyText="Không có hành động phù hợp"
            clearLabel="Bỏ lọc hành động"
          />
          {actions.error != null && (
            <p role="alert" className="m-0 text-[11px] text-err-fg">
              Không tải được danh sách hành động.{' '}
              <button type="button" className="cursor-pointer font-medium underline" onClick={actions.refetch}>Thử lại</button>
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="audit-target-type" className={LABEL_CLS}>Loại đối tượng</label>
          {/* 46 px like the date and search fields beside it. */}
          <FilterSelect id="audit-target-type" size="lg" className="w-full" aria-label="Lọc theo loại đối tượng" value={targetType} onChange={(e) => filterChange(() => setTargetType(e.target.value as typeof targetType))}>
            <option value="">Tất cả</option>
            {AUDIT_TARGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </FilterSelect>
        </div>
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
              <div className={`${LIST_CLS} transition-opacity ${reloading ? 'pointer-events-none opacity-60' : ''}`} aria-busy={reloading || undefined}>
                <Table stack={false}>
                  <thead>
                    <tr>
                      <Th className="w-[108px]" aria-sort={dir === 'asc' ? 'ascending' : 'descending'}>
                        <button type="button" className="inline-flex min-h-6 cursor-pointer items-center gap-1" onClick={() => filterChange(() => setDir(dir === 'asc' ? 'desc' : 'asc'))}>
                          Thời gian <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>
                        </button>
                      </Th>
                      <Th>Người thực hiện</Th><Th>Hành động</Th><Th>Đối tượng</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => {
                      const active = e.id === detailId
                      const [date, time] = formatPlatformDateTime(e.time).split(' ')
                      const target = `${targetTypeLabel(e.targetType)} · ${e.targetLabel}`
                      return (
                        <tr key={e.id} onClick={() => select(e.id)} className={`cursor-pointer hover:bg-[#f6faf7] ${active ? 'bg-[#eef4ef] hover:bg-[#eef4ef]' : ''} ${ROW_CLS}`}>
                          <Td className={`whitespace-nowrap font-medium @max-[560px]:col-start-2 @max-[560px]:row-start-1 @max-[560px]:text-right ${CELL_CLS}`}>
                            <button type="button" aria-current={active ? 'true' : undefined} onClick={(ev) => { ev.stopPropagation(); select(e.id) }} className="text-left @max-[560px]:text-right">
                              <span className="block text-ink">{date}</span>{' '}<span className="block text-[11px] font-normal text-muted">{time}</span>
                            </button>
                          </Td>
                          <Td className={`@max-[560px]:col-span-2 ${CELL_CLS}`}>
                            <PersonCell name={e.actor?.name ?? 'Hệ thống'} sub={e.actor ? auditRoleLabel(e.actor.role) || undefined : undefined} system={!e.actor} />
                          </Td>
                          <Td className={`@max-[560px]:col-start-1 @max-[560px]:row-start-1 ${CELL_CLS}`}>
                            <div className="text-xs font-semibold text-ink">{auditActionLabel(e.action)}</div>
                            <div className="font-mono text-[10px] text-muted [overflow-wrap:normal]"><ActionCode code={e.action} /></div>
                          </Td>
                          <Td className={`@max-[560px]:col-span-2 ${CELL_CLS}`}>
                            <div className="text-[11px] text-muted">{targetTypeLabel(e.targetType)}</div>
                            {/* break-word (not Td's "anywhere") keeps codes like BC3A4C7B40B1F8 whole and sizes the column to them. */}
                            <div className="line-clamp-2 font-medium text-ink [overflow-wrap:break-word]" title={target}>{e.targetLabel}</div>
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              </div>
              <Pagination page={page} pageCount={data.totalPages} onChange={setPage} summary={`Hiển thị ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + rows.length} trong ${data.totalElements} mục`} />
            </Card>
          ) : (
            <EmptyBlock title={NO_MATCH} action={<Button onClick={clearFilters}>Xóa bộ lọc</Button>} />
          )}
          {detailId != null && (
            // Sticky beside the list on wide screens so the detail stays visible while scrolling 20 rows.
            <div className="min-w-0 xl:sticky xl:top-4">
              <AuditDetailCard id={detailId} reveal={selectedId != null} />
            </div>
          )}
        </div>
      )}
      <Foot>Lịch sử audit nền tảng (chỉ Quản trị hệ thống). Mỗi dòng là một thay đổi đã lưu; chọn dòng để xem giá trị trước / sau và mã truy vết. Không có thao tác sửa hay xóa.</Foot>
    </div>
  )
}

export default function AuditPage() {
  return <SaPage title={TITLE}><AuditContent /></SaPage>
}
