import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Button, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, Info, LoadingBlock, Note, PageHeader, Pagination, Table, Td, Th, inputCls } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { useSession } from '../../authorization'
import { platformServiceApi } from '../api/platformServiceApi'
import PeriodsDialog from '../components/PeriodsDialog'
import { ServiceBadge } from '../components/common'
import type { Coverage, ServiceStatus, SubscriptionFilters, SubscriptionPage } from '../types'
import { fmtDate, fmtEndDate, fmtSeconds } from '../domain/dates'
import { PERIOD_STATE_LABEL, STATUS_LABEL } from '../domain/servicePeriods'

const TITLE = 'Gói đăng ký'
const DEFAULT_FILTERS: SubscriptionFilters = { q: '', coverage: 'ALL', status: '', endFrom: '', endTo: '', dir: 'desc', page: 0 }
const invalidDates = (f: SubscriptionFilters) => !!(f.endFrom && f.endTo && f.endFrom > f.endTo)

function savedFilters(key: string): { filters: SubscriptionFilters; farmId: number | null } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (saved && typeof saved.filters?.q === 'string' && saved.filters.q.length <= 100
      && ['ALL', 'CURRENT', 'FUTURE_ONLY', 'NONE'].includes(saved.filters.coverage)
      && ['', 'ACTIVE', 'EXPIRED', 'PENDING_PAYMENT', 'SUSPENDED'].includes(saved.filters.status)
      && ['asc', 'desc'].includes(saved.filters.dir) && Number.isInteger(saved.filters.page) && saved.filters.page >= 0
      && saved.filters.page <= 107374182 && !invalidDates(saved.filters)) {
      return { filters: saved.filters, farmId: Number.isSafeInteger(saved.farmId) && saved.farmId > 0 ? saved.farmId : null }
    }
  } catch { /* Storage is optional; the API remains the source of truth. */ }
  return { filters: DEFAULT_FILTERS, farmId: null }
}

function DetailPanel({ farmId, refresh }: { farmId: number; refresh: number }) {
  const { data, loading, error, refetch } = useQuery(() => platformServiceApi.getSubscription(farmId), [farmId, refresh])
  const [modal, openModal, closeModal] = useModalParam()
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được chi tiết gói.')} onRetry={refetch} />
  const s = data.summary
  const latest = data.latestPurchase
  return (
    <section aria-label={`Gói của ${s.farmName}`}>
      <Card title={s.farmName} sub="Các kỳ đã mua" actions={<ServiceBadge status={s.serviceStatus} />}>
        <Info cols={2} items={[
          ['Dịch vụ', `${STATUS_LABEL[s.serviceStatus]} · ${data.suspended ? `tạm ngưng từ ${fmtDate(data.suspendedSince)}` : 'không tạm ngưng'}`],
          ['Kỳ hiện tại', s.currentStart && s.currentEnd ? `${fmtDate(s.currentStart)} → ${fmtEndDate(s.currentEnd)}` : '—'],
          ['Đã xác nhận đến', fmtEndDate(s.confirmedUntil)],
          ['Kỳ mua gần nhất', latest ? `${latest.termYears} năm · ${latest.paymentCode}` : '—'],
          ['Gia hạn mở từ', fmtDate(data.renewalOpens)],
        ]} />
        <div className="mt-3 mb-2 text-[12px] font-semibold text-ink">Kỳ đã mua và thanh toán nguồn</div>
        {data.periods.length === 0 ? <Note tone="info">{data.emptyMessage ?? 'Chưa có kỳ đã mua.'}</Note> : <>
          <Table stack={false} bordered>
            <thead><tr><Th>Kỳ</Th><Th>Thanh toán</Th></tr></thead>
            <tbody>{data.periods.map((p) => <tr key={p.paymentCode}>
              <Td><div className="font-medium text-ink">{fmtDate(p.start)} – {fmtEndDate(p.end)}</div><div className="text-[11px] text-muted">{PERIOD_STATE_LABEL[p.state]} · {p.termYears} năm</div></Td>
              <Td><div className="font-medium text-ink">{p.paymentCode}</div><div className="text-[11px] text-muted">Xác nhận {fmtSeconds(p.confirmedAt)}</div>
                {p.paymentId && <Link className="text-[12px] font-semibold text-brand underline" aria-label={`Xem thanh toán nguồn ${p.paymentCode}`}
                  to={`/nen-tang/thanh-toan?paymentId=${p.paymentId}&farmId=${farmId}`}>Xem thanh toán nguồn</Link>}
              </Td>
            </tr>)}</tbody>
          </Table>
          <Button variant="link" onClick={() => openModal('periods')}>Kỳ hiện tại / tương lai</Button>
        </>}
      </Card>
      {modal === 'periods' && <PeriodsDialog detail={data} onClose={closeModal} />}
    </section>
  )
}

export default function PlatformSubscriptionRoutes() {
  const session = useSession()
  const storageKey = `beefcare:platform-subscriptions:${session?.email ?? ''}`
  const [initial] = useState(() => savedFilters(storageKey))
  const [params] = useSearchParams()
  const [controls, setControls] = useState(initial.filters)
  const [filters, setFilters] = useState(initial.filters)
  const [search, setSearch] = useState(initial.filters.q ?? '')
  const [farmId, setFarmId] = useState<number | null>(() => {
    const requested = Number(params.get('farmId'))
    return Number.isSafeInteger(requested) && requested > 0 ? requested : initial.farmId
  })
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<{ data: SubscriptionPage | null; loading: boolean; error: unknown }>({ data: null, loading: true, error: null })
  const rangeError = invalidDates(controls)

  useEffect(() => {
    const timer = setTimeout(() => setControls((current) => current.q === search ? current : { ...current, q: search, page: 0 }), 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => { if (!rangeError) setFilters(controls) }, [controls, rangeError])
  useEffect(() => {
    let active = true
    setResult((previous) => ({ ...previous, loading: true, error: null }))
    platformServiceApi.listSubscriptions(filters).then((data) => {
      if (!active) return
      if (data.items.length === 0 && data.total > 0 && data.page * 20 >= data.total) {
        // A page kept in the session can pass the end once data changes: open the last existing page instead of "no matches".
        // The target page is always lower than the requested one, so this cannot loop.
        setControls((current) => ({ ...current, page: Math.ceil(data.total / 20) - 1 }))
        return
      }
      setResult({ data, loading: false, error: null })
      setFarmId((selected) => data.items.some((r) => r.farmId === selected) ? selected : data.items[0]?.farmId ?? null)
    }, (error: unknown) => active && setResult({ data: null, loading: false, error }))
    return () => { active = false }
  }, [filters, refresh])
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ filters, farmId })) } catch { /* Optional session preference. */ }
  }, [storageKey, filters, farmId])

  const change = (patch: Partial<SubscriptionFilters>) => setControls((current) => ({ ...current, page: 0, ...patch }))
  const reload = () => setRefresh((value) => value + 1)
  const clear = () => { setSearch(''); setControls({ ...DEFAULT_FILTERS }) }
  const { data, loading, error } = result
  const selected = data?.items.find((r) => r.farmId === farmId)

  return <Layout title={TITLE}>
    <PageHeader title={TITLE} sub="Kỳ dịch vụ hiện tại và tương lai của từng trại"><Button onClick={reload}>Làm mới</Button></PageHeader>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <input aria-label="Tìm tên trại hoặc mã thanh toán" maxLength={100} className={`${inputCls} w-[280px] max-w-full`}
        placeholder="Tên trại / mã thanh toán…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <FilterSelect aria-label="Bao phủ" value={controls.coverage ?? 'ALL'} onChange={(e) => change({ coverage: e.target.value as Coverage })}>
        <option value="ALL">Bao phủ: Tất cả</option><option value="CURRENT">Hiện tại</option><option value="FUTURE_ONLY">Chỉ tương lai</option><option value="NONE">Không có</option>
      </FilterSelect>
      <FilterSelect aria-label="Trạng thái dịch vụ" value={controls.status ?? ''} onChange={(e) => change({ status: e.target.value as ServiceStatus | '' })}>
        <option value="">Dịch vụ: Tất cả</option>{(Object.keys(STATUS_LABEL) as ServiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </FilterSelect>
      <div className="w-[160px]"><label htmlFor="end-from" className="text-[12px] text-muted">Xác nhận đến từ ngày</label><DateInput id="end-from" label="Xác nhận đến từ ngày" value={controls.endFrom ?? ''} onChange={(value) => change({ endFrom: value })} /></div>
      <div className="w-[160px]"><label htmlFor="end-to" className="text-[12px] text-muted">Xác nhận đến ngày</label><DateInput id="end-to" label="Xác nhận đến ngày" value={controls.endTo ?? ''} onChange={(value) => change({ endTo: value })} />
        {rangeError && <p role="alert" className="mt-1 text-[12px] text-err-fg">Ngày bắt đầu không được sau ngày kết thúc.</p>}
      </div>
    </div>
    {error ? <ErrorBlock message={userFacingError(error, 'Không tải được danh sách gói.')} onRetry={reload} /> : !data ? <LoadingBlock /> :
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_396px]">
        <div aria-busy={loading}>
          <Card>{data.items.length === 0 ? <EmptyBlock title="Không có trại phù hợp" sub="Thử đổi từ khóa hoặc khoảng hết kỳ." action={<Button onClick={clear}>Xóa bộ lọc</Button>} /> :
            <Table stack={false}><thead><tr><Th>Trang trại / Owner</Th><Th>Kỳ hiện tại</Th><Th>
              <button aria-label="Sắp xếp theo Xác nhận đến" onClick={() => change({ dir: controls.dir === 'desc' ? 'asc' : 'desc' })}>Xác nhận đến {controls.dir === 'asc' ? '↑' : '↓'}</button>
            </Th><Th>Dịch vụ</Th></tr></thead><tbody>{data.items.map((r) => <tr key={r.farmId} className={r.farmId === farmId ? 'bg-[#eef4ef]' : ''}>
              <Td><button type="button" className="text-left" aria-current={r.farmId === farmId ? 'true' : undefined} onClick={() => setFarmId(r.farmId)}><div className="font-medium text-ink">{r.farmName}</div><div className="text-[11px] text-muted">{r.ownerName || '—'}</div></button></Td>
              <Td>{r.currentStart && r.currentEnd ? `${fmtDate(r.currentStart)} → ${fmtEndDate(r.currentEnd)}` : '—'}</Td>
              <Td>{fmtEndDate(r.confirmedUntil)}</Td><Td><ServiceBadge status={r.serviceStatus} /></Td>
            </tr>)}</tbody></Table>}
          </Card>
          {data.total > 0 && <div className="mt-3"><Pagination page={data.page + 1} pageCount={Math.ceil(data.total / 20)} onChange={(value) => change({ page: value - 1 })}
            summary={`Hiển thị ${data.page * 20 + 1}–${data.page * 20 + data.items.length} / ${data.total} trại`} /></div>}
        </div>
        {selected && <DetailPanel key={selected.farmId} farmId={selected.farmId} refresh={refresh} />}
      </div>}
    <Foot>Chọn một trại để xem các kỳ đã mua và thanh toán nguồn. Trạng thái tạm ngưng và bao phủ được hiển thị độc lập.</Foot>
  </Layout>
}
