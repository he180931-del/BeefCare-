import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import Modal from '../../../components/Modal'
import { Button, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, Note, PageHeader, SearchInput, Table, Td, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { subscriptionApi } from '../api/subscriptionApi'
import { Facts, PaymentBadge, useIsPhone } from '../components/shared'
import { useStateDialog } from '../components/StateDialog'
import { useFarmScope } from '../components/useFarmScope'
import { fmtDateTime, fmtDateTimeSec, fmtPeriod, fmtVnd, termLabel, versionLabel } from '../domain/subscriptionRules'
import type { Payment, PaymentFilters, PaymentState } from '../types'
import { useOverview } from './useOverview'

const TITLE = 'Lịch sử thanh toán'
type SortKey = NonNullable<PaymentFilters['sort']>

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
  return (
    <Modal title="Chi tiết thanh toán" sub={<span className="inline-flex items-center gap-2">{payment.quoteRef} <PaymentBadge state={payment.state} /></span>} width={600} onClose={onClose}>
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
      <div className="flex justify-end"><Button size="lg" onClick={onClose}>Đóng</Button></div>
    </Modal>
  )
}

export default function HistoryPage() {
  const { id } = useParams()
  const { farmId, to } = useFarmScope()
  const navigate = useNavigate()
  const phone = useIsPhone()
  const [q, setQ] = useState('')
  const [state, setState] = useState<PaymentState | ''>('')
  const [from, setFrom] = useState('')
  const [until, setUntil] = useState('')
  const [sort, setSort] = useState<SortKey>('requestedAt')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const list = useQuery(() => subscriptionApi.listPayments(farmId, { q, state, from, to: until, sort, dir }), [farmId, q, state, from, until, sort, dir])
  const overview = useOverview(farmId)
  const detail = useQuery(() => (id ? subscriptionApi.getPayment(farmId, id) : Promise.resolve(null)), [farmId, id])
  const open = detail.data
  const backToList = () => navigate(to('/goi-dich-vu/lich-su'))
  const dialog = useStateDialog({
    forced: id && open?.state === 'EXPIRED' ? { kind: 'expired', payment: open } : null,
    onDismiss: id ? backToList : undefined,
  })

  const farmName = overview.data?.farmName ?? ''
  const filtered = !!(q || state || from || until)
  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else { setSort(key); setDir('desc') }
  }
  const clear = () => { setQ(''); setState(''); setFrom(''); setUntil('') }

  if (id && open?.state === 'PENDING') return <Navigate to={to(`/goi-dich-vu/chuyen-khoan/${open.quoteRef}`, { from: 'lich-su' })} replace />

  const rows = list.data ?? []
  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub={farmName} />
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-full sm:w-[220px]"><SearchInput placeholder="Tìm mã thanh toán" aria-label="Tìm mã thanh toán" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="w-full sm:w-[170px]">
            <FilterSelect aria-label="Trạng thái" value={state} onChange={(e) => setState(e.target.value as PaymentState | '')}>
              <option value="">Trạng thái: Tất cả</option>
              <option value="PENDING">Đang chờ</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="EXPIRED">Đã hết hạn</option>
            </FilterSelect>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-muted">Tạo từ <div className="w-[150px]"><DateInput id="from" value={from} onChange={setFrom} /></div></div>
          <div className="flex items-center gap-1.5 text-[13px] text-muted">Tạo đến <div className="w-[150px]"><DateInput id="until" value={until} onChange={setUntil} /></div></div>
        </div>
        {id && detail.error ? <Note tone="err">{userFacingError(detail.error, 'Không tìm thấy thanh toán.')}</Note> : null}
        {list.loading && !list.data ? (
          <LoadingBlock />
        ) : list.error ? (
          <ErrorBlock message={userFacingError(list.error, 'Không tải được lịch sử thanh toán.')} onRetry={list.refetch} />
        ) : (
          <>
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
                        ? <Button variant="link" size="sm" onClick={() => navigate(to(`/goi-dich-vu/chuyen-khoan/${p.quoteRef}`, { from: 'lich-su' }))}>Mở lại</Button>
                        : <Button variant="link" size="sm" aria-label={`Xem ${p.quoteRef}`} onClick={() => navigate(to(`/goi-dich-vu/lich-su/${p.quoteRef}`))}>Xem</Button>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {rows.length === 0 && (
              filtered
                ? <EmptyBlock title="Không có thanh toán phù hợp" sub="Thử đổi từ khóa, trạng thái hoặc khoảng ngày." action={<Button onClick={clear}>Xóa bộ lọc</Button>} />
                : <EmptyBlock title="Chưa có thanh toán nào" action={<Button onClick={() => navigate(to('/goi-dich-vu'))}>Xem gói của trại</Button>} />
            )}
          </>
        )}
        <Foot>
          {rows.length === 0 && !filtered
            ? 'Chưa có giao dịch thanh toán của trại; mở trang gói dịch vụ để xem kỳ hiện tại và bảng giá.'
            : 'Tìm theo mã thanh toán, lọc trạng thái hoặc khoảng ngày; yêu cầu đang chờ có thể mở lại hướng dẫn chuyển khoản.'}
        </Foot>
      </div>
      {id && open?.state === 'PAID' && <PaymentDetail payment={open} farmName={farmName} onClose={backToList} />}
      {dialog.element}
    </Layout>
  )
}
