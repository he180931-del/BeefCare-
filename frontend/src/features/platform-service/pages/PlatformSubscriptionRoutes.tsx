import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Button, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, Info, LoadingBlock, Note, PageHeader, Table, Td, Th, inputCls } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { platformServiceApi } from '../api/platformServiceApi'
import PeriodsDialog from '../components/PeriodsDialog'
import { ServiceBadge } from '../components/common'
import type { ServiceStatus } from '../types'
import { fmtDate, fmtDateTime } from '../domain/dates'
import { PERIOD_STATE_LABEL, STATUS_LABEL } from '../domain/servicePeriods'

const TITLE = 'Gói đăng ký'

function DetailPanel({ farmId, onPeriods }: { farmId: number; onPeriods: () => void }) {
  const { data, loading, error, refetch } = useQuery(() => platformServiceApi.getSubscription(farmId), [farmId])
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được chi tiết gói.')} onRetry={refetch} />
  const s = data.summary
  const current = data.periods.find((p) => p.state === 'CURRENT')
  const latest = data.latestPurchase
  return (
    <Card title={s.farmName} sub={`${s.subscriptionCode ?? 'Chưa có đăng ký'} · các kỳ đã mua không thể sửa`} actions={<ServiceBadge status={s.serviceStatus} />}>
      <Info cols={2} items={[
        ['Dịch vụ', `${STATUS_LABEL[s.serviceStatus]} · ${data.suspended ? `tạm ngừng từ ${fmtDate(data.suspendedSince)}` : 'không tạm ngừng'}`],
        ['Kỳ hiện tại', current ? `${fmtDate(current.start)} → ${fmtDate(current.end)}` : '—'],
        ['Đã xác nhận đến', fmtDate(s.confirmedUntil)],
        ['Kỳ mua gần nhất', latest ? `${latest.termYears} năm · ${latest.paymentCode}` : '—'],
        ['Gia hạn mở từ', fmtDate(data.renewalOpens)],
      ]} />
      <div className="mt-3 mb-2 text-[12px] font-semibold text-ink">Kỳ đã mua và thanh toán nguồn</div>
      {data.periods.length === 0 ? (
        <Note tone="info">{data.emptyMessage ?? 'Chưa có kỳ nào.'} Trại tạm ngừng vẫn có thể còn kỳ sử dụng hợp lệ.</Note>
      ) : (
        <>
          <Table stack={false} bordered>
            <thead><tr><Th>Kỳ</Th><Th>Thanh toán</Th></tr></thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p.paymentCode}>
                  <Td><div className="font-medium text-ink">{fmtDate(p.start)} – {fmtDate(p.end)}</div><div className="text-[11px] text-muted">{PERIOD_STATE_LABEL[p.state]} · {p.termYears} năm</div></Td>
                  <Td><div className="font-medium text-ink">{p.paymentCode}</div><div className="text-[11px] text-muted">Xác nhận {fmtDateTime(p.confirmedAt)}</div></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-3 flex items-center gap-2">
            <Link to="/nen-tang/thanh-toan" className="inline-flex h-[35px] items-center rounded border border-field bg-white px-3 text-[12px] font-semibold text-ink">Xem thanh toán nguồn</Link>
            <Button variant="link" onClick={onPeriods}>Kỳ hiện tại / tương lai</Button>
          </div>
        </>
      )}
    </Card>
  )
}

export default function PlatformSubscriptionRoutes() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ServiceStatus | ''>('')
  const [endFrom, setEndFrom] = useState('')
  const [endTo, setEndTo] = useState('')
  const [farmId, setFarmId] = useState(1)
  const [m, openModal, closeModal] = useModalParam()
  const filters = useMemo(() => ({ q, status, endFrom, endTo }), [q, status, endFrom, endTo])
  const { data, loading, error, refetch } = useQuery(() => platformServiceApi.listSubscriptions(filters), [filters])
  const detail = useQuery(() => platformServiceApi.getSubscription(farmId), [farmId, m])

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được danh sách gói.')} onRetry={refetch} /></Layout>

  return (
    <Layout title={TITLE}>
      <PageHeader title={TITLE} sub="Kỳ dịch vụ hiện tại và tương lai của từng trại – chỉ xem, PM không kích hoạt thủ công" />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <input aria-label="Tìm trại hoặc mã đăng ký" className={`${inputCls} w-[280px] max-w-full`} placeholder="Trại / mã đăng ký…" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect aria-label="Trạng thái dịch vụ" value={status} onChange={(e) => setStatus(e.target.value as ServiceStatus | '')}>
          <option value="">Trạng thái dịch vụ: Tất cả</option>
          {(Object.keys(STATUS_LABEL) as ServiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </FilterSelect>
        <label className="flex items-center gap-2 text-[12px] text-muted">Hết kỳ từ <span className="w-[160px]"><DateInput id="end-from" value={endFrom} onChange={setEndFrom} /></span></label>
        <label className="flex items-center gap-2 text-[12px] text-muted">đến <span className="w-[160px]"><DateInput id="end-to" value={endTo} onChange={setEndTo} /></span></label>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_396px]">
        <Card>
          {data.length === 0 ? (
            <EmptyBlock title="Không có trại phù hợp" sub="Thử đổi từ khóa hoặc khoảng hết kỳ." />
          ) : (
            <Table stack={false}>
              <thead><tr><Th>Trang trại</Th><Th>Kỳ hiện tại</Th><Th>Đã xác nhận đến</Th><Th>Dịch vụ</Th></tr></thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.farmId} aria-selected={r.farmId === farmId} onClick={() => setFarmId(r.farmId)} className={`cursor-pointer ${r.farmId === farmId ? 'bg-[#eef4ef]' : ''}`}>
                    <Td><button type="button" className="text-left" onClick={() => setFarmId(r.farmId)}><div className="font-medium text-ink">{r.farmName}</div><div className="text-[11px] text-muted">{r.ownerName}</div></button></Td>
                    <Td>{r.currentEnd ? `${fmtDate(r.currentStart)} → ${fmtDate(r.currentEnd)}` : '—'}</Td>
                    <Td>{fmtDate(r.confirmedUntil)}</Td>
                    <Td><ServiceBadge status={r.serviceStatus} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="px-4 py-3 text-[12px] text-muted">{data.length} trại trong khoảng hết kỳ đã chọn</div>
        </Card>
        <DetailPanel farmId={farmId} onPeriods={() => openModal('periods')} />
      </div>
      <Foot>Gói đăng ký (PM, chỉ xem). Chọn một trại để xem kỳ hiện tại, các kỳ đã mua và thanh toán nguồn ở khung phải. Kỳ đã mua không sửa được; PM không kích hoạt gói thủ công.</Foot>
      {m === 'periods' && detail.data ? <PeriodsDialog detail={detail.data} onClose={closeModal} /> : null}
    </Layout>
  )
}
