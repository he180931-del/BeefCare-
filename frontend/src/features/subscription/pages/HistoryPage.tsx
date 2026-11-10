import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { Button, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization/sessionContext'
import { subscriptionApi } from '../api/subscriptionApi'
import { Facts, PaymentBadge, useIsPhone } from '../components/shared'
import { useFarmScope } from '../components/useFarmScope'
import { fmtDateTime, fmtDateTimeSec, fmtPeriod, fmtVnd, termLabel, versionLabel } from '../domain/subscriptionRules'
import type { Payment, PaymentFilters, PaymentState } from '../types'
import { useOverview } from './useOverview'

const TITLE = 'Lịch sử thanh toán'
type SortKey = NonNullable<PaymentFilters['sort']>
const DEFAULT_FILTERS: Required<PaymentFilters> = { q: '', state: '', from: '', to: '', sort: 'requestedAt', dir: 'desc', page: 0 }
/** One request after the Owner pauses typing instead of one per keystroke. */
const SEARCH_DELAY_MS = 300
const invalidRange = (filters: PaymentFilters) => !!(filters.from && filters.to && filters.from > filters.to)
const paymentRouteId = (payment: Payment) => backendMode === 'backend' ? String(payment.id) : payment.quoteRef

function savedFilters(key: string): Required<PaymentFilters> {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (!value || typeof value !== 'object') return DEFAULT_FILTERS
    return {
      q: typeof value.q === 'string' ? value.q.slice(0, 100) : '',
      state: ['PENDING', 'PAID', 'EXPIRED'].includes(value.state) ? value.state : '',
      from: typeof value.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.from) ? value.from : '',
      to: typeof value.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.to) ? value.to : '',
      sort: value.sort === 'expiresAt' ? 'expiresAt' : 'requestedAt', dir: value.dir === 'asc' ? 'asc' : 'desc',
      page: Number.isSafeInteger(value.page) && value.page >= 0 ? value.page : 0,
    }
  } catch { return DEFAULT_FILTERS }
}

function SortHead({ label, active, dir, onClick }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[11px] font-semibold text-muted" aria-label={`Sắp xếp theo ${label}`}>
      {label}
      {active && <Icon name="chevron-down" size={12} className={dir === 'asc' ? 'rotate-180' : ''} />}
    </button>
  )
}

function PaymentDetail({ payment, farmName, onClose }: { payment: Payment; farmName: string; onClose: () => void }) {
  const sec = (v?: string | null) => (v ? fmtDateTimeSec(v) : '—')
  const panel = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  // The panel opens below a 20-row page: bring it into view and move focus so "Xem" visibly does something.
  useEffect(() => {
    panel.current?.scrollIntoView?.({ block: 'nearest' })
    heading.current?.focus({ preventScroll: true })
  }, [payment.id])
  return (
    <section ref={panel} aria-label="Chi tiết thanh toán" className="rounded-md border border-edge bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 ref={heading} tabIndex={-1} className="m-0 text-base font-semibold outline-none">Chi tiết thanh toán</h2><span className="inline-flex items-center gap-2">{payment.quoteRef} <PaymentBadge state={payment.state} /></span></div>
        <Button onClick={onClose}>Đóng</Button>
      </div>
      <Facts items={[
        ['Trang trại', farmName],
        ['Bảng giá', versionLabel(payment.priceVersionId)],
        ['Thời hạn', termLabel(payment.durationYears)],
        ['Số tiền', fmtVnd(payment.amountVnd)],
        ['Ngân hàng trả tiền lúc', sec(payment.bankPaidAt)],
        ['Hệ thống nhận lúc', sec(payment.receivedAt)],
        ['Hệ thống xác nhận lúc', sec(payment.confirmedAt)],
        ['Kỳ đã mua', payment.purchasedStart && payment.purchasedEnd ? fmtPeriod(payment.purchasedStart, payment.purchasedEnd) : '—'],
      ]} />
    </section>
  )
}

export default function HistoryPage() {
  const { farmId, to } = useFarmScope()
  const session = useSession()
  const storageKey = `beefcare:subscription-history:${backendMode}:${session?.email ?? ''}:${farmId}`
  return <FarmHistory key={storageKey} farmId={farmId} to={to} storageKey={storageKey} />
}

function FarmHistory({ farmId, to, storageKey }: { farmId: number; to: ReturnType<typeof useFarmScope>['to']; storageKey: string }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const phone = useIsPhone()
  // `filters` is what the controls show (kept for the session); `applied` is what the list was loaded with.
  // An invalid date range stays in the controls with MSG-COM-11 but never reaches the API (D16).
  const [filters, setFilters] = useState(() => savedFilters(storageKey))
  const [applied, setApplied] = useState(() => (invalidRange(filters) ? { ...filters, from: '', to: '' } : filters))
  const [searchText, setSearchText] = useState(() => filters.q.trim())
  const { q, state, from, to: until, sort, dir } = filters
  const rangeError = invalidRange(filters)
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(filters)) } catch { /* Filters remain usable when storage is unavailable. */ }
  }, [storageKey, filters])
  useEffect(() => {
    const text = q.trim()
    if (text === searchText) return undefined
    const timer = setTimeout(() => setSearchText(text), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [q, searchText])
  const query = { ...applied, q: searchText }
  const change = (patch: Partial<PaymentFilters>) => {
    const next = { ...filters, ...patch, page: 0 }
    setFilters(next)
    setApplied((previous) => (invalidRange(next) ? { ...next, from: previous.from, to: previous.to } : next))
  }
  const goToPage = (value: number) => {
    setFilters((previous) => ({ ...previous, page: value }))
    setApplied((previous) => ({ ...previous, page: value }))
  }
  const list = useQuery(() => subscriptionApi.listPayments(farmId, query),
    [farmId, query.q, query.state, query.from, query.to, query.sort, query.dir, query.page])
  const overview = useOverview(farmId)
  const detail = useQuery(() => (id ? subscriptionApi.getPayment(farmId, id) : Promise.resolve(null)), [farmId, id])
  const open = detail.data && paymentRouteId(detail.data) === id ? detail.data : null
  const backToList = () => navigate(to('/goi-dich-vu/lich-su'))
  const farmName = overview.data?.farmId === farmId ? overview.data.farmName : ''
  const filtered = !!(query.q || query.state || query.from || query.to)
  const toggleSort = (key: SortKey) => {
    change({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc' })
  }
  const clear = () => { setFilters(DEFAULT_FILTERS); setApplied(DEFAULT_FILTERS); setSearchText('') }

  if (id && open?.state === 'PENDING') return <Navigate to={to(`/goi-dich-vu/chuyen-khoan/${paymentRouteId(open)}`, { from: 'lich-su' })} replace />

  const shown = list.data
  const rows = shown?.content ?? []
  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub={farmName}><Button disabled={list.loading} onClick={() => { list.refetch(); if (id) detail.refetch(); overview.refetch() }}>Làm mới</Button></PageHeader>
        <div className={`flex flex-wrap items-center gap-2.5${rangeError ? ' pb-5' : ''}`}>
          <div className="w-full sm:w-[220px]"><SearchInput placeholder="Tìm mã thanh toán" aria-label="Tìm mã thanh toán" maxLength={100} value={q} onChange={(e) => change({ q: e.target.value })} /></div>
          <div className="w-full sm:w-[170px]">
            <FilterSelect aria-label="Trạng thái" value={state} onChange={(e) => change({ state: e.target.value as PaymentState | '' })}>
              <option value="">Trạng thái: Tất cả</option>
              <option value="PENDING">Đang chờ</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="EXPIRED">Đã hết hạn</option>
            </FilterSelect>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-muted">Tạo từ <div className="w-[150px]"><DateInput id="from" value={from} onChange={(value) => change({ from: value })} /></div></div>
          <div className="flex items-center gap-1.5 text-[13px] text-muted">Tạo đến <div className="relative w-[150px]"><DateInput id="until" value={until} onChange={(value) => change({ to: value })} />
            {rangeError && <p role="alert" className="absolute left-0 top-full m-0 mt-1 w-max text-[12px] text-err-fg">Ngày bắt đầu không được sau ngày kết thúc.</p>}
          </div></div>
        </div>
        {!!overview.error && <ErrorBlock message={userFacingError(overview.error, 'Không tải được thông tin trại.')} onRetry={overview.refetch} />}
        {id && detail.loading && !open && <LoadingBlock />}
        {id && !!detail.error && <ErrorBlock message={userFacingError(detail.error, 'Không tìm thấy thanh toán.')} onRetry={detail.refetch} />}
        {list.loading && !shown ? (
          <LoadingBlock />
        ) : list.error ? (
          <ErrorBlock message={userFacingError(list.error, 'Không tải được lịch sử thanh toán.')} onRetry={list.refetch} />
        ) : (
          <div aria-busy={list.loading} className="flex flex-col gap-4">
            <Table wide stack={phone} scroll={!phone}>
              <thead>
                <tr>
                  <Th className="whitespace-nowrap">Mã</Th><Th className="whitespace-nowrap">Thời hạn</Th><Th className="whitespace-nowrap">Số tiền</Th>
                  <Th className="whitespace-nowrap"><SortHead label="Tạo lúc" active={sort === 'requestedAt'} dir={dir} onClick={() => toggleSort('requestedAt')} /></Th>
                  <Th className="whitespace-nowrap"><SortHead label="Hết hạn" active={sort === 'expiresAt'} dir={dir} onClick={() => toggleSort('expiresAt')} /></Th>
                  <Th className="whitespace-nowrap">Trạng thái</Th><Th>Xác nhận lúc · Kỳ</Th><Th className="whitespace-nowrap">Thao tác</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.quoteRef}>
                    <Td className="whitespace-nowrap font-medium">{p.quoteRef}</Td>
                    <Td className="whitespace-nowrap">{termLabel(p.durationYears)}</Td>
                    <Td className="whitespace-nowrap">{fmtVnd(p.amountVnd)}</Td>
                    <Td className="whitespace-nowrap">{fmtDateTime(p.requestedAt)}</Td>
                    <Td className="whitespace-nowrap">{fmtDateTime(p.expiresAt)}</Td>
                    <Td className="whitespace-nowrap"><PaymentBadge state={p.state} /></Td>
                    <Td>{p.confirmedAt && p.purchasedStart && p.purchasedEnd ? `${fmtDateTime(p.confirmedAt)} · ${fmtPeriod(p.purchasedStart, p.purchasedEnd)}` : '—'}</Td>
                    <Td>
                      {p.state === 'PENDING'
                        ? <Button variant="link" size="sm" onClick={() => navigate(to(`/goi-dich-vu/chuyen-khoan/${paymentRouteId(p)}`, { from: 'lich-su' }))}>Mở lại</Button>
                        : <Button variant="link" size="sm" aria-label={`Xem ${p.quoteRef}`} onClick={() => navigate(to(`/goi-dich-vu/lich-su/${paymentRouteId(p)}`))}>Xem</Button>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {shown && shown.totalElements > 0 && <Pagination page={shown.number + 1} pageCount={shown.totalPages}
              onChange={(value) => goToPage(value - 1)}
              summary={`Hiển thị ${shown.number * 20 + 1}–${shown.number * 20 + rows.length} trong ${shown.totalElements} thanh toán`} />}
            {rows.length === 0 && (
              filtered
                ? <EmptyBlock title="Không có thanh toán phù hợp" sub="Thử đổi từ khóa, trạng thái hoặc khoảng ngày." action={<Button onClick={clear}>Xóa bộ lọc</Button>} />
                : <EmptyBlock title="Chưa có thanh toán nào" action={<Button onClick={() => navigate(to('/goi-dich-vu'))}>Xem gói của trại</Button>} />
            )}
          </div>
        )}
        {id && open && open.state !== 'PENDING' && farmName && <PaymentDetail payment={open} farmName={farmName} onClose={backToList} />}
        <Foot>
          {rows.length === 0 && !filtered
            ? 'Chưa có giao dịch thanh toán của trại; mở trang gói dịch vụ để xem kỳ hiện tại và bảng giá.'
            : 'Tìm theo mã thanh toán, lọc trạng thái hoặc khoảng ngày; yêu cầu đang chờ có thể mở lại hướng dẫn chuyển khoản.'}
        </Foot>
      </div>
    </Layout>
  )
}
