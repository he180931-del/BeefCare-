import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { activateTableRow, activateTableRowByKey, Button, Card, EmptyBlock, ErrorBlock, FilterSelect, Foot, Icon, interactiveRowClass, LoadingBlock, Metric, Note, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useFarmList, useFarmServiceCommands } from '../hooks/usePlatformServiceUseCase'
import ServiceChangeDialog from '../components/ServiceChangeDialog'
import { ServiceBadge, downloadCsv, usePmAccess } from '../components/common'
import type { FarmOverview, FarmSort, FarmTiles, ServiceStatus } from '../types'
import { fmtDate } from '../domain/dates'
import { STATUS_LABEL } from '../domain/servicePeriods'

const TITLE = 'Dịch vụ trang trại'
const PAGE_SIZE = 20

type SortField = 'name' | 'status' | 'coverageEnd'

/** SCR-12 tiles: every farm of the platform; selecting one filters the list ("Tổng số trại" shows all again). */
const TILES: Array<{ status: ServiceStatus | ''; label: string; value: (t: FarmTiles) => number; note: (t: FarmTiles) => string; extra?: (t: FarmTiles) => string; warn?: boolean }> = [
  { status: '', label: 'Tổng số trại', value: (t) => t.total, note: () => 'Toàn nền tảng' },
  { status: 'ACTIVE', label: 'Đang hoạt động', value: (t) => t.active, note: (t) => `${t.activePercent}% tổng số trại`, extra: (t) => ` · ${t.activePercent}%` },
  { status: 'PENDING_PAYMENT', label: 'Chờ thanh toán', value: (t) => t.pending, note: () => 'Chưa có kỳ dịch vụ', warn: true },
  { status: 'EXPIRED', label: 'Hết hạn', value: (t) => t.expired, note: () => 'Cần gia hạn' },
  { status: 'SUSPENDED', label: 'Tạm ngưng', value: (t) => t.suspended, note: () => 'Do PM tạm ngưng' },
]

/** SCR-12 (UC-FE02-04): tổng quan dịch vụ các trại cho PM; không có dữ liệu bò hay chăm sóc (GBR-11). */
export default function FarmServiceRoutes() {
  const navigate = useNavigate()
  const canAct = usePmAccess()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ServiceStatus | ''>('')
  const [sort, setSort] = useState<FarmSort>('name')
  // Table III-1: 20 rows a page; a new search, filter or sort starts again at the first page.
  const [page, setPage] = useState(0)
  const [tick, setTick] = useState(0)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [m, openModal, closeModal] = useModalParam()
  const { listFarms } = useFarmServiceCommands()
  const filters = useMemo(() => ({ q, status, sort, page, size: PAGE_SIZE }), [q, status, sort, page])
  const { data, loading, error, refetch } = useFarmList(filters, tick)
  // After a change the current page may no longer exist (e.g. a filtered farm left the list): show the last one that does.
  useEffect(() => {
    if (data && page > 0 && page * PAGE_SIZE >= data.total) setPage(Math.max(0, Math.ceil(data.total / PAGE_SIZE) - 1))
  }, [data, page])
  const search = (value: string) => { setQ(value); setPage(0) }
  const filter = (value: ServiceStatus | '') => { setStatus(value); setPage(0) }

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được danh sách trại.')} onRetry={refetch} /></Layout>

  const { items, tiles, total } = data
  const mode = m === 'restore' ? 'restore' : m === 'suspend' ? 'suspend' : null
  const target = mode ? items.find((f) => f.farmId === targetId) ?? items.find((f) => f.suspended === (mode === 'restore')) : undefined
  const toggleSort = (field: SortField) => { setSort((current) => (current === field ? `-${field}` : field) as FarmSort); setPage(0) }
  const ariaSort = (field: SortField) => (sort === field ? 'ascending' : sort === `-${field}` ? 'descending' : 'none')
  const arrow = (field: SortField) => (sort === field ? '↑' : sort === `-${field}` ? '↓' : '')
  const sortHeader = (field: SortField, label: string) => (
    <Th aria-sort={ariaSort(field)}>
      <button type="button" onClick={() => toggleSort(field)} className="inline-flex min-h-6 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-semibold text-muted">
        {label}<span aria-hidden="true">{arrow(field)}</span>
      </button>
    </Th>
  )

  // The export holds every farm matching the search and filter, not only the page on screen: read pages of 100.
  const exportList = async () => {
    setExportError(null)
    const rows: FarmOverview[] = []
    try {
      for (let next = 0; ; next += 1) {
        const result = await listFarms({ q, status, sort, page: next, size: 100 })
        rows.push(...result.items)
        if (result.items.length === 0 || rows.length >= result.total) break
      }
    } catch (failure) {
      setExportError(userFacingError(failure, 'Không xuất được danh sách trại. Vui lòng thử lại.'))
      return
    }
    downloadCsv('dich-vu-trang-trai.csv', [['Trang trại', 'Chủ trại', 'Email', 'Dịch vụ', 'Hết kỳ', 'Tạm ngưng', 'Quy mô'], ...rows.map((f) => [f.farmName, f.ownerName, f.ownerEmail, STATUS_LABEL[f.serviceStatus], fmtDate(f.coverageEnd), f.suspended ? `Có · từ ${fmtDate(f.suspendedSince)}` : 'Không', `${f.herdSize} con`])])
  }

  return (
    <Layout title={TITLE}>
      <PageHeader title={TITLE} sub="Tổng quan trạng thái dịch vụ của các trại – PM không truy cập dữ liệu chăm sóc bò của trại">
        <Button onClick={() => void exportList()}><Icon name="table-export" size={16} />Xuất danh sách</Button>
      </PageHeader>
      {message ? <Note tone="ok">{message}</Note> : null}
      {exportError ? <Note tone="err">{exportError}</Note> : null}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {TILES.map((tile) => (
          <button
            key={tile.label} type="button" aria-pressed={status === tile.status}
            aria-label={`${tile.label} (${tile.value(tiles)}${tile.extra?.(tiles) ?? ''})`}
            onClick={() => filter(tile.status)}
            className={`cursor-pointer rounded-md border-0 bg-transparent p-0 text-left ${status === tile.status ? 'ring-2 ring-brand' : ''}`}
          >
            <Metric label={tile.label} value={String(tile.value(tiles))} note={tile.note(tiles)} warn={tile.warn} />
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        {/* A width class next to `inputCls` loses to its `w-full`; the wrapper sets the width (as on SCR-16). */}
        <div className="w-[320px] max-w-full"><SearchInput aria-label="Tìm trại" placeholder="Tên trại, email chủ trại…" value={q} onChange={(e) => search(e.target.value)} /></div>
        <FilterSelect size="lg" aria-label="Trạng thái dịch vụ" value={status} onChange={(e) => filter(e.target.value as ServiceStatus | '')}>
          <option value="">Trạng thái dịch vụ: Tất cả</option>
          {(Object.keys(STATUS_LABEL) as ServiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </FilterSelect>
      </div>
      <Card>
        {items.length === 0 ? (
          <EmptyBlock title="Không có trại phù hợp" sub="Thử đổi từ khóa hoặc bộ lọc trạng thái." />
        ) : (
          <Table wide>
            <thead>
              <tr>{sortHeader('name', 'Trang trại')}{sortHeader('status', 'Dịch vụ')}{sortHeader('coverageEnd', 'Hết kỳ')}<Th>Tạm ngưng</Th><Th>Quy mô</Th><Th>{' '}</Th></tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr
                  key={f.farmId}
                  tabIndex={0}
                  aria-label={`Mở gói đăng ký của ${f.farmName}`}
                  className={`${interactiveRowClass} ${f.suspended ? 'bg-page' : ''}`}
                  onClick={(event) => activateTableRow(event, () => navigate(`/nen-tang/goi-dang-ky?farmId=${f.farmId}`))}
                  onKeyDown={(event) => activateTableRowByKey(event, () => navigate(`/nen-tang/goi-dang-ky?farmId=${f.farmId}`))}
                >
                  <Td><div className="font-medium text-ink">{f.farmName}</div><div className="text-[11px] text-muted">Chủ trại {f.ownerName}</div></Td>
                  <Td><ServiceBadge status={f.serviceStatus} /></Td>
                  <Td>{fmtDate(f.coverageEnd)}</Td>
                  <Td>{f.suspended ? `Có · từ ${fmtDate(f.suspendedSince)}` : 'Không'}</Td>
                  <Td>{f.herdSize} con</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {f.suspended ? (
                        <Button variant="primary" size="sm" disabled={!canAct} onClick={() => { setTargetId(f.farmId); openModal('restore') }}><Icon name="refresh" size={16} />Khôi phục</Button>
                      ) : (
                        <Button size="sm" disabled={!canAct} onClick={() => { setTargetId(f.farmId); openModal('suspend') }}>Tạm ngưng</Button>
                      )}
                      <Link className="inline-flex min-h-8 items-center text-[12px] font-semibold text-brand" to={`/nen-tang/goi-dang-ky?farmId=${f.farmId}`}>Xem gói</Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="px-4 py-3">
          <Pagination page={page + 1} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} onChange={(next) => setPage(next - 1)}
            summary={total ? `Hiển thị ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + items.length} trong ${total} trại` : '0 trại'} />
        </div>
      </Card>
      <div className="mt-4">
        <Note tone="info">Tạm ngưng và khôi phục tách biệt với thanh toán: trại tạm ngưng vẫn giữ kỳ dịch vụ đã mua, và thanh toán không tự gỡ tạm ngưng.</Note>
      </div>
      <Foot>Dịch vụ trang trại (PM). Ô số liệu đếm mọi trại theo trạng thái và bấm để lọc; bảng sắp xếp được theo tên, trạng thái và ngày hết kỳ. Nút cuối dòng mở hộp thoại tạm ngưng hoặc khôi phục.</Foot>
      {mode && target ? (
        <ServiceChangeDialog
          key={`${mode}-${target.farmId}`}
          farm={target}
          mode={mode}
          onClose={closeModal}
          onDone={(msg) => { setMessage(msg); setTick((t) => t + 1); closeModal() }}
        />
      ) : null}
    </Layout>
  )
}
